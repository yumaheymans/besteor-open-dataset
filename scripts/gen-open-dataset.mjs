/**
 * Portable open-data snapshot generator. Both local publishing and the public
 * repository's release process run this exact file, with no dependencies.
 * Only the live canonical exports are inputs; never mix local and deployed data.
 * Run: node scripts/gen-open-dataset.mjs <output-directory>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const SITE = "https://besteor.co";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const DATA_FILES = [
  "eor-providers.csv", "eor-providers.json",
  "eor-country-employment.csv", "eor-country-employment.json",
];
export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

function check(ok, message) {
  if (!ok) throw new Error(`Snapshot rejected: ${message}`);
}

/** RFC 4180, including quoted newlines and doubled quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(value); value = "";
      if (c !== ",") {
        rows.push(row); row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else value += c;
  }
  check(!quoted, "unclosed CSV quote");
  if (row.length || value) rows.push([...row, value]);
  const header = rows.shift() ?? [];
  check(header.length > 0 && new Set(header).size === header.length, "invalid CSV header");
  return rows.map((cells) => {
    check(cells.length === header.length, "CSV column count mismatch");
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}

function verifyParity(jsonRows, csvText, key, flatten = (row) => row) {
  const csvRows = parseCsv(csvText);
  check(csvRows.length === jsonRows.length, `${key}: CSV/JSON row counts differ`);
  const lookup = new Map(csvRows.map((r) => [r[key], r]));
  check(lookup.size === csvRows.length, `${key}: duplicate CSV keys`);
  for (const raw of jsonRows) {
    const row = flatten(raw), csv = lookup.get(row[key]);
    check(csv, `${key}: missing CSV row`);
    check(Object.keys(row).length === Object.keys(csv).length, `${key}: CSV/JSON columns differ`);
    for (const [field, value] of Object.entries(row)) {
      check(csv[field] === (value == null ? "" : String(value)), `${row[key]}.${field}: CSV/JSON values differ`);
    }
  }
}

export function validateSnapshot(files) {
  const prov = JSON.parse(files["data/eor-providers.json"]);
  const countries = JSON.parse(files["data/eor-country-employment.json"]);
  for (const [rows, count, key] of [
    [prov.providers, prov.provider_count, "besteor_profile_slug"],
    [countries.countries, countries.country_count, "country_code"],
  ]) {
    check(Array.isArray(rows) && rows.length > 0 && rows.length === count, `${key}: invalid count`);
    check(rows.every((r) => typeof r[key] === "string" && r[key]), `${key}: missing identifier`);
    check(new Set(rows.map((r) => r[key])).size === count, `${key}: duplicate identifiers`);
  }
  check(prov.license === LICENSE_URL && countries.license === LICENSE_URL, "unexpected license");
  for (const p of prov.providers) {
    check(p.eor_monthly_price_usd === null || (Number.isFinite(p.eor_monthly_price_usd) && p.eor_monthly_price_usd >= 0), `${p.provider}: invalid fee`);
    check(/^https?:\/\//.test(p.price_source_url), `${p.provider}: missing price citation`);
  }
  const prices = prov.providers.flatMap((p) => p.eor_monthly_price_usd === null ? [] : [p.eor_monthly_price_usd]).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length === 0 ? null : prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  check(prov.published_price_count === prices.length && prov.median_published_price_usd === median, "provider summary mismatch");
  for (const c of countries.countries) {
    check(c.employer_cost_basis === "percentage" || c.employer_cost_basis === "fixed-amounts", `${c.country}: missing cost basis`);
    check(c.employer_cost_basis === "fixed-amounts"
      ? c.employer_cost_pct === null
      : Number.isFinite(c.employer_cost_pct) && c.employer_cost_pct >= 0 && c.employer_cost_pct <= 100,
    `${c.country}: percentage conflicts with cost basis`);
    check(/^https?:\/\//.test(c.employer_cost_source_url), `${c.country}: missing cost citation`);
    check(typeof c.employer_cost_detail === "string" && c.employer_cost_detail.length > 0 && typeof c.employer_cost_note === "string", `${c.country}: missing cost detail or note`);
    check(Object.keys(c.employment_terms ?? {}).length === countries.statutory_terms_per_country, `${c.country}: missing employment terms`);
  }
  check(countries.percentage_rate_country_count === countries.countries.filter((c) => c.employer_cost_basis === "percentage").length, "percentage summary mismatch");
  verifyParity(prov.providers, files["data/eor-providers.csv"], "besteor_profile_slug");
  verifyParity(countries.countries, files["data/eor-country-employment.csv"], "country_code", (row) => {
    const { employment_terms, ...flat } = row;
    for (const [key, term] of Object.entries(employment_terms)) {
      flat[key] = term.value;
      flat[`${key}_source_url`] = term.source_url;
    }
    return flat;
  });
  return { prov, countryDs: countries };
}

async function fetchText(file) {
  const response = await fetch(`${SITE}/data/${file}`, {
    headers: { "user-agent": "BestEOR-DatasetSyncBot/1.0" },
    signal: AbortSignal.timeout(45000),
  });
  check(response.ok, `${file}: HTTP ${response.status}`);
  const text = await response.text();
  check(text.length < 8000000, `${file}: unexpected payload size`);
  return text;
}

function countCitedUrls(csv) {
  return new Set([...csv.matchAll(/https?:\/\/[^",\s]+/g)].map((m) => m[0])).size;
}

export async function collectSnapshot() {
  const files = Object.fromEntries(await Promise.all(DATA_FILES.map(async (name) => [`data/${name}`, await fetchText(name)])));
  const { prov, countryDs } = validateSnapshot(files);
  const fetchedAt = new Date().toISOString();
  const date = fetchedAt.slice(0, 10);
  const provCsv = files["data/eor-providers.csv"], countryCsv = files["data/eor-country-employment.csv"];
  const dimensions = Object.entries(countryDs.countries[0].employment_terms).map(([key, term]) => ({ key, label: term.label }));
  // Request timestamps change on every GET. Fingerprint data without that field.
  const fingerprint = sha256(DATA_FILES.map((name) => {
    if (!name.endsWith(".json")) return files[`data/${name}`];
    const { generated_at, ...data } = JSON.parse(files[`data/${name}`]);
    return JSON.stringify(data);
  }).join("\n"));
  files["data/_manifest.json"] = JSON.stringify({
    fetched_at: fetchedAt,
    content_fingerprint: fingerprint,
    generator_version: 2,
    note: "Fetch time is not source verification time. Read per-record sources and price verification dates.",
    files: Object.fromEntries(DATA_FILES.map((name) => [name, {
      source: `${SITE}/data/${name}`,
      sha256: sha256(files[`data/${name}`]),
    }])),
  }, null, 2) + "\n";
  // --- Computed stats for the README (never hand-typed) ---
  const providerCount = prov.provider_count ?? prov.providers?.length ?? 0;
  const publishedPriceCount = prov.published_price_count ?? 0;
  const medianPrice = prov.median_published_price_usd ?? null;
  const pricesVerified = prov.prices_last_verified ?? "";
  const countryCitedUrls = countCitedUrls(countryCsv);
  const providerCitedUrls = countCitedUrls(provCsv);

  const stats = {
    generated: date,
    providerCount,
    publishedPriceCount,
    quoteOnlyCount: providerCount - publishedPriceCount,
    medianPrice,
    pricesVerified,
    countryCount: countryDs.country_count,
    citedDataPoints: countryDs.cited_data_points,
    avgDimsPerCountry: countryDs.avg_dimensions_per_country,
    statutoryTerms: countryDs.statutory_terms_per_country,
    lowest: countryDs.lowest_employer_cost,
    highest: countryDs.highest_employer_cost,
    countrySourceUrls: countryCitedUrls,
    providerSourceUrls: providerCitedUrls,
  };

  files["data/_stats.json"] = JSON.stringify(stats, null, 2) + "\n";

  const termList = dimensions.map((d) => d.label).join(", ");

  const readme = `# BestEOR.co Open Dataset

Open, cited data on **global employment**: what it costs to employ someone through an
Employer of Record (EOR), and selected statutory employment terms for every country covered. Two
machine-readable datasets, released under **[CC BY 4.0](${LICENSE_URL})**.

Maintained and kept current by **[BestEOR.co](${SITE}/?utm_source=github&utm_medium=dataset&utm_campaign=open-data)**, an independent comparison resource for
Employer-of-Record and global-payroll buyers. The website is the canonical source;
this repository is a dated snapshot of it. Fetched ${date}.

**Need current figures? Download the live exports:**

| Dataset | CSV | JSON |
|---------|-----|------|
| Providers | [Live CSV](${SITE}/data/eor-providers.csv?utm_source=github&utm_medium=dataset&utm_campaign=open-data) | [Live JSON](${SITE}/data/eor-providers.json?utm_source=github&utm_medium=dataset&utm_campaign=open-data) |
| Countries | [Live CSV](${SITE}/data/eor-country-employment.csv?utm_source=github&utm_medium=dataset&utm_campaign=open-data) | [Live JSON](${SITE}/data/eor-country-employment.json?utm_source=github&utm_medium=dataset&utm_campaign=open-data) |

The files in this repository are dated snapshots, refreshed when a release is published. They do not
update automatically. See [data/_manifest.json](data/_manifest.json) for the fetch time, source URLs
and checksums. A fetch date is not a legal or price verification date.
[Archived releases](https://doi.org/10.5281/zenodo.22845248) have permanent, versioned DOIs.

> **Attribution (required by the licence):** if you use this data, credit **BestEOR.co** with a link
> to <${SITE}>. That is the whole ask.

## What is in here

### 1. EOR providers and pricing (\`data/eor-providers.*\`)
${providerCount} Employer-of-Record and global-payroll providers, ${publishedPriceCount} of which
publish a list price (the other ${providerCount - publishedPriceCount} are quote-only, marked as such
rather than guessed). Median published EOR fee: **$${medianPrice}/employee/month**. Each row carries
the provider's delivery model, the price exactly as the provider states it, the price basis, a
confidence flag, and the **primary-source URL** the figure was taken from. Prices last verified
against source on ${pricesVerified}.

### 2. Country employment terms and employer cost (\`data/eor-country-employment.*\`)
${stats.countryCount} countries, each with the statutory employer cost of employment plus selected
employment terms useful when planning a hire: ${termList}. Plus a World Bank macro backbone
(currency, GNI/GDP per capita, population, unemployment) and the statutory minimum wage and paid
annual leave. **${stats.citedDataPoints.toLocaleString("en-US")} cited data points** in the underlying site catalog
(~${stats.avgDimsPerCountry} per country), and **each figure retains its cited source URL**. Sources include government publications and
secondary legal/tax references. Representative percentage-based employer contributions range from
**${stats.lowest?.pct}%** (${stats.lowest?.country}) to **${stats.highest?.pct}%**
(${stats.highest?.country}). ${countryDs.percentage_rate_country_count} records use a
percentage comparison rate; the remaining records use fixed local-currency amounts with a null
percentage. Null is not zero. Rates are not salary-specific payroll quotes: read the caps,
thresholds, contribution bases and eligibility caveats in each record.

## Files

| File | Rows | Format |
|------|------|--------|
| \`data/eor-providers.csv\` | ${providerCount} providers | CSV (RFC 4180) |
| \`data/eor-providers.json\` | ${providerCount} providers | JSON, with dataset-level summary stats |
| \`data/eor-country-employment.csv\` | ${stats.countryCount} countries | CSV (RFC 4180), one row per country |
| \`data/eor-country-employment.json\` | ${stats.countryCount} countries | JSON, nested with per-figure citations |

See **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** for every column and field.

## Methodology and integrity

- **Sources stay attached.** Prices come from the provider's own pricing page;
  statutory figures come from governments, official gazettes, and neutral legal/tax references
  (PwC, DLA Piper, WageIndicator, ILO-adjacent bodies, and the like), never from a competing EOR
  vendor as the authority for its rivals.
- **Confidence is explicit.** The catalog's \`confirmed\` and \`reported\` flags are
  preserved. Inspect the linked source to assess its authority and applicability.
- **Nothing is invented.** Quote-only prices are blank, not estimated. Fixed contributions have a blank
  percentage and an explicit basis; other missing values remain blank.
- **The site is canonical.** These files are a snapshot of the curated catalog, not independent verification
  of every original source on the fetch date.
  Explore any figure in context:
  - Providers and pricing: <${SITE}/prices?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - Countries: <${SITE}/countries?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - How much an EOR costs (2026 report): <${SITE}/blog/how-much-does-an-eor-cost-2026?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - The whole comparison: <${SITE}>

## Regenerating

These files are produced from the BestEOR.co dataset by \`scripts/gen-open-dataset.mjs\` in the
BestEOR codebase. All four CSV/JSON files are pulled verbatim from the live site exports after validating row
counts, unique keys, numeric types, fixed-amount semantics and CSV/JSON agreement.
Run \`node scripts/gen-open-dataset.mjs <output-directory>\` to generate a local snapshot.
The maintainer publishes through \`scripts/sync-open-dataset.mjs\`, which uses the same generator,
requires a repository token, preserves unrelated files, and reads the published commit back to
verify every checksum. Repeating the same data on the same UTC day does not create another commit.

## Licence

[Creative Commons Attribution 4.0 International (CC BY 4.0)](${LICENSE_URL}). You may share and adapt
the data for any purpose, including commercially, as long as you credit **BestEOR.co** with a link to
<${SITE}>. See [LICENSE](LICENSE).
`;

  files["README.md"] = readme;

  const dict = `# Data dictionary

All figures are cited: every value column has a companion \`*_source_url\` (CSV) or \`source_url\`
(JSON) giving the cited source. Blank prices mean "not published / unknown"; a blank employer percentage
with \`fixed-amounts\` means fixed contributions, not zero. \`confidence\` preserves the catalog
flag (\`confirmed\` or \`reported\`); consult the linked source for authority and applicability.

## \`eor-providers\` (${providerCount} rows)

| Column | Meaning |
|--------|---------|
| \`provider\` | Provider (company) name. |
| \`model\` | Delivery model: owned-entity EOR, hybrid EOR, or aggregator EOR. |
| \`eor_monthly_price_usd\` | Published EOR list price per employee per month, USD. Blank when quote-only. |
| \`eor_price_text\` | The price exactly as the provider states it, or "Custom quote". |
| \`price_basis\` | What the figure represents. |
| \`price_confidence\` | \`confirmed\` or \`reported\`, including quote-only terms. |
| \`price_source_url\` | Primary source for the price or quote terms (raw provider URL, never an affiliate redirect). |
| \`founded_year\` | Year the provider was founded, where known. |
| \`besteor_profile_slug\` | The provider's page slug on BestEOR.co (\`${SITE}/mowers/<slug>\`). |

The JSON file additionally carries dataset-level summary stats (provider count, published-price count,
median/min/max published price, \`prices_last_verified\`).

## \`eor-country-employment\` (${stats.countryCount} rows)

Identity and macro:

| Column | Meaning |
|--------|---------|
| \`country\`, \`country_code\` | Country name and ISO-3166 alpha-2 code. |
| \`slug\` | The country's page slug on BestEOR.co (\`${SITE}/countries/<slug>\`). |
| \`region\`, \`income_group\` | World Bank region and income group. |
| \`currency\` | Local currency (ISO 4217). |
| \`employer_cost_pct\` | Representative comparison percentage, not a salary-specific effective rate. Null for fixed contributions; a numeric zero remains a real zero. |
| \`employer_cost_basis\` | \`percentage\` or \`fixed-amounts\`. Never infer zero from a blank percentage. |
| \`employer_cost_detail\`, \`employer_cost_note\` | The breakdown text and caveats behind that headline rate. |
| \`gni_per_capita_usd\`, \`gdp_per_capita_usd\`, \`population\`, \`unemployment_pct\` | World Bank macro backbone. \`macro_year\` gives the reference year. |
| \`minimum_wage\` | Statutory minimum wage, as stated by the source. |
| \`annual_leave\` | Statutory paid annual leave. |

Statutory employment terms (each a value column plus a \`*_source_url\`):

| Column key | Meaning |
|------------|---------|
${dimensions.map((d) => `| \`${d.key}\` | ${d.label}. |`).join("\n")}

The JSON file nests these under \`employment_terms\`, each with \`label\`, \`value\`, \`source_url\` and
\`confidence\`, and carries \`employer_cost_detail\`, \`employer_cost_note\`,
\`employer_cost_basis\` and \`employer_cost_pct_description\` for interpretation.
`;

  files["DATA_DICTIONARY.md"] = dict;


  return files;
}

export async function main(outDir = process.argv[2]) {
  if (!outDir) throw new Error("Provide an output directory outside the deploy roots");
  const files = await collectSnapshot();
  for (const [name, content] of Object.entries(files)) {
    const target = join(outDir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  process.stdout.write(`Validated and wrote ${Object.keys(files).length} files to ${outDir}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

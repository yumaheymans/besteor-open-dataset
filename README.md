# BestEOR.co Open Dataset

Open, cited data on **global employment**: what it costs to employ someone through an
Employer of Record (EOR), and selected statutory employment terms for every country covered. Two
machine-readable datasets, released under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.

Maintained and kept current by **[BestEOR.co](https://besteor.co/?utm_source=github&utm_medium=dataset&utm_campaign=open-data)**, an independent comparison resource for
Employer-of-Record and global-payroll buyers. The website is the canonical source;
this repository is a dated snapshot of it. Fetched 2026-09-23.

**Need current figures? Download the live exports:**

| Dataset | CSV | JSON |
|---------|-----|------|
| Providers | [Live CSV](https://besteor.co/data/eor-providers.csv?utm_source=github&utm_medium=dataset&utm_campaign=open-data) | [Live JSON](https://besteor.co/data/eor-providers.json?utm_source=github&utm_medium=dataset&utm_campaign=open-data) |
| Countries | [Live CSV](https://besteor.co/data/eor-country-employment.csv?utm_source=github&utm_medium=dataset&utm_campaign=open-data) | [Live JSON](https://besteor.co/data/eor-country-employment.json?utm_source=github&utm_medium=dataset&utm_campaign=open-data) |

The files in this repository are dated snapshots, refreshed when a release is published. They do not
update automatically. See [data/_manifest.json](data/_manifest.json) for the fetch time, source URLs
and checksums. A fetch date is not a legal or price verification date.
[Archived releases](https://doi.org/10.5281/zenodo.22845248) have permanent, versioned DOIs.

> **Attribution (required by the licence):** if you use this data, credit **BestEOR.co** with a link
> to <https://besteor.co>. That is the whole ask.

## What is in here

### 1. EOR providers and pricing (`data/eor-providers.*`)
63 Employer-of-Record and global-payroll providers, 30 of which
publish a list price (the other 33 are quote-only, marked as such
rather than guessed). Median published EOR fee: **$349/employee/month**. Each row carries
the provider's delivery model, the price exactly as the provider states it, the price basis, a
confidence flag, and the **primary-source URL** the figure was taken from. Prices last verified
against source on 2026-09-12.

### 2. Country employment terms and employer cost (`data/eor-country-employment.*`)
139 countries, each with the statutory employer cost of employment plus selected
employment terms useful when planning a hire: Paid public holidays, Statutory sick leave, Maternity leave, Paternity / parental leave, Standard working hours, Overtime premium, Notice period, Severance pay, Probation period, Termination regime, 13th-month salary, Payroll cycle, Data-protection regime, Business language, Time zone. Plus a World Bank macro backbone
(currency, GNI/GDP per capita, population, unemployment) and the statutory minimum wage and paid
annual leave. **4,901 cited data points** in the underlying site catalog
(~35.26 per country), and **each figure retains its cited source URL**. Sources include government publications and
secondary legal/tax references. Representative percentage-based employer contributions range from
**0%** (United Arab Emirates) to **42.5%**
(France). 138 records use a
percentage comparison rate; the remaining records use fixed local-currency amounts with a null
percentage. Null is not zero. Rates are not salary-specific payroll quotes: read the caps,
thresholds, contribution bases and eligibility caveats in each record.

## Files

| File | Rows | Format |
|------|------|--------|
| `data/eor-providers.csv` | 63 providers | CSV (RFC 4180) |
| `data/eor-providers.json` | 63 providers | JSON, with dataset-level summary stats |
| `data/eor-country-employment.csv` | 139 countries | CSV (RFC 4180), one row per country |
| `data/eor-country-employment.json` | 139 countries | JSON, nested with per-figure citations |

See **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** for every column and field.

## Methodology and integrity

- **Sources stay attached.** Prices come from the provider's own pricing page;
  statutory figures come from governments, official gazettes, and neutral legal/tax references
  (PwC, DLA Piper, WageIndicator, ILO-adjacent bodies, and the like), never from a competing EOR
  vendor as the authority for its rivals.
- **Confidence is explicit.** The catalog's `confirmed` and `reported` flags are
  preserved. Inspect the linked source to assess its authority and applicability.
- **Nothing is invented.** Quote-only prices are blank, not estimated. Fixed contributions have a blank
  percentage and an explicit basis; other missing values remain blank.
- **The site is canonical.** These files are a snapshot of the curated catalog, not independent verification
  of every original source on the fetch date.
  Explore any figure in context:
  - Providers and pricing: <https://besteor.co/prices?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - Countries: <https://besteor.co/countries?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - How much an EOR costs (2026 report): <https://besteor.co/blog/how-much-does-an-eor-cost-2026?utm_source=github&utm_medium=dataset&utm_campaign=open-data>
  - The whole comparison: <https://besteor.co>

## Regenerating

These files are produced from the BestEOR.co dataset by `scripts/gen-open-dataset.mjs` in the
BestEOR codebase. All four CSV/JSON files are pulled verbatim from the live site exports after validating row
counts, unique keys, numeric types, fixed-amount semantics and CSV/JSON agreement.
Run `node scripts/gen-open-dataset.mjs <output-directory>` to generate a local snapshot.
The maintainer publishes through `scripts/sync-open-dataset.mjs`, which uses the same generator,
requires a repository token, preserves unrelated files, and reads the published commit back to
verify every checksum. Repeating the same data on the same UTC day does not create another commit.

## Licence

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You may share and adapt
the data for any purpose, including commercially, as long as you credit **BestEOR.co** with a link to
<https://besteor.co>. See [LICENSE](LICENSE).

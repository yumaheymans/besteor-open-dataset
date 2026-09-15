# BestEOR.co Open Dataset

Open, cited data on **global employment**: what it costs to employ someone through an
Employer of Record (EOR), and the statutory employment rules of every country covered. Two
machine-readable datasets, released under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.

Maintained and kept current by **[BestEOR.co](https://besteor.co)**, an independent comparison resource for
Employer-of-Record and global-payroll buyers. The website is the canonical, always-current source;
this repository is a periodic snapshot of it. Generated 2026-09-15.

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
139 countries, each with the statutory employer cost of employment plus the full
statutory framework a buyer needs before hiring there: Paid public holidays, Statutory sick leave, Maternity leave, Paternity / parental leave, Standard working hours, Overtime premium, Notice period, Severance pay, Probation period, Termination regime, 13th-month salary, Payroll cycle, Data-protection regime, Business language, Time zone. Plus a World Bank macro backbone
(currency, GNI/GDP per capita, population, unemployment) and the statutory minimum wage and paid
annual leave. **4,901 cited data points** in total
(~35.26 per country), and **every single figure keeps the URL of the primary
source that proves it**. Statutory employer burden ranges from
**0%** (United Arab Emirates) to **42.5%**
(France).

## Files

| File | Rows | Format |
|------|------|--------|
| `data/eor-providers.csv` | 63 providers | CSV (RFC 4180) |
| `data/eor-providers.json` | 63 providers | JSON, with dataset-level summary stats |
| `data/eor-country-employment.csv` | 139 countries | CSV (RFC 4180), one row per country |
| `data/eor-country-employment.json` | 139 countries | JSON, nested with per-figure citations |

See **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** for every column and field.

## Methodology and integrity

- **Every figure is cited to a primary source.** Prices come from the provider's own pricing page;
  statutory figures come from governments, official gazettes, and neutral legal/tax references
  (PwC, DLA Piper, WageIndicator, ILO-adjacent bodies, and the like), never from a competing EOR
  vendor as the authority for its rivals.
- **Confidence is explicit.** Each figure is flagged `confirmed` (read from the primary source) or
  `reported` (from a reputable secondary source pending primary confirmation).
- **Nothing is invented.** Quote-only prices are blank, not estimated. Unknown figures are blank.
- **The site is canonical.** These files are a snapshot; the live pages update on a running cadence.
  Explore any figure in context:
  - Providers and pricing: <https://besteor.co/prices>
  - Countries: <https://besteor.co/countries>
  - How much an EOR costs (2026 report): <https://besteor.co/blog/how-much-does-an-eor-cost-2026>
  - The whole comparison: <https://besteor.co>

## Regenerating

These files are produced from the BestEOR.co dataset by `scripts/gen-open-dataset.mts` in the
BestEOR codebase. The provider files are pulled verbatim from the live site exports; the country
files are built from the same source the country pages render.

## Licence

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You may share and adapt
the data for any purpose, including commercially, as long as you credit **BestEOR.co** with a link to
<https://besteor.co>. See [LICENSE](LICENSE).

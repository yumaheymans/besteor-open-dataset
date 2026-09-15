# Data dictionary

All figures are cited: every value column has a companion `*_source_url` (CSV) or `source_url`
(JSON) giving the primary source it was taken from. Blank means "not published / unknown", never a
guess. `confidence` is `confirmed` (read from the primary source) or `reported` (reputable
secondary source).

## `eor-providers` (63 rows)

| Column | Meaning |
|--------|---------|
| `provider` | Provider (company) name. |
| `model` | Delivery model: owned-entity EOR, hybrid EOR, or aggregator EOR. |
| `eor_monthly_price_usd` | Published EOR list price per employee per month, USD. Blank when quote-only. |
| `eor_price_text` | The price exactly as the provider states it, or "Custom quote". |
| `price_basis` | What the figure represents. |
| `price_confidence` | `confirmed` or `reported`, including quote-only terms. |
| `price_source_url` | Primary source for the price or quote terms (raw provider URL, never an affiliate redirect). |
| `founded_year` | Year the provider was founded, where known. |
| `besteor_profile_slug` | The provider's page slug on BestEOR.co (`https://besteor.co/<slug>`). |

The JSON file additionally carries dataset-level summary stats (provider count, published-price count,
median/min/max published price, `prices_last_verified`).

## `eor-country-employment` (139 rows)

Identity and macro:

| Column | Meaning |
|--------|---------|
| `country`, `country_code` | Country name and ISO-3166 alpha-2 code. |
| `slug` | The country's page slug on BestEOR.co (`https://besteor.co/countries/<slug>`). |
| `region`, `income_group` | World Bank region and income group. |
| `currency` | Local currency (ISO 4217). |
| `employer_cost_pct` | Statutory employer cost of employment, as a % of gross salary (core mandatory contributions). |
| `employer_cost_detail`, `employer_cost_note` | The breakdown text and caveats behind that headline rate. |
| `gni_per_capita_usd`, `gdp_per_capita_usd`, `population`, `unemployment_pct` | World Bank macro backbone. `macro_year` gives the reference year. |
| `minimum_wage` | Statutory minimum wage, as stated by the source. |
| `annual_leave` | Statutory paid annual leave. |

Statutory employment terms (each a value column plus a `*_source_url`):

| Column key | Meaning |
|------------|---------|
| `publicHolidays` | Paid public holidays. |
| `sickLeave` | Statutory sick leave. |
| `maternityLeave` | Maternity leave. |
| `paternityLeave` | Paternity / parental leave. |
| `workingHoursWeek` | Standard working hours. |
| `overtimePremium` | Overtime premium. |
| `noticePeriod` | Notice period. |
| `severancePay` | Severance pay. |
| `probationMax` | Probation period. |
| `terminationRegime` | Termination regime. |
| `thirteenthMonth` | 13th-month salary. |
| `payrollCycle` | Payroll cycle. |
| `dataProtection` | Data-protection regime. |
| `language` | Business language. |
| `timeZone` | Time zone. |

The JSON file nests these under `employment_terms`, each with `label`, `value`, `source_url` and
`confidence`, and additionally carries the employer-cost breakdown components per country.

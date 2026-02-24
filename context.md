# Federal Budget Visualization — Project Context

## Overview
Interactive block-based visualization of the U.S. federal budget (revenue, spending, deficit, debt accumulation, and net interest growth). Part of the **Visualize Policy** project alongside a county-level OBBBA impact map at https://obbba-preview-demo.pages.dev/.

## User
Aadit Bhatia — senior at Northeastern, Economics + Data Science minor. Works on a repo trading desk. Strong Python/R/Stata skills. Writing thesis on re-greening programs using satellite imagery. Has experience with econometrics, causal inference, and policy evaluation research.

## Tech Stack
- **Data pipeline**: Python (Jupyter notebook), pandas, openpyxl
- **Visualization**: React (Vite), papaparse for CSV loading
- **Deployment**: Vercel (https://viz-smoky.vercel.app/)
- **Development**: VS Code, Mac (new machine — previously Windows)
- **Design language**: Matches https://obbba-preview-demo.pages.dev/ — light background (#f8fafc), white cards with subtle borders, navy header bar, Segoe UI/system-ui font, blue/orange colorblind-safe palette

## File Structure
```
OBBB Dashboard/
  viz/
    datapipeline/
      BUDGET-2026-HIST.xlsx    ← OMB source data
      CPIAUCSL.csv             ← CPI from FRED
      datapipeline.py          ← (or .ipynb) data parsing pipeline
      output/                  ← generated CSVs
    public/
      spending_by_function.csv
      receipts_by_source.csv
      summary.csv
      federal_debt.csv
    src/
      App.jsx                  ← main visualization code
      App.css                  ← empty
      main.jsx                 ← React entry point (6 lines)
      index.css                ← empty
    package.json
```

## Data Sources

### Primary: OMB Historical Tables (FY2026 Budget, June 2025)
- **URL**: https://www.whitehouse.gov/wp-content/uploads/2025/06/BUDGET-2026-HIST.xlsx
- Single XLSX workbook, ~71 sheet tabs using codes like `hist03z1`
- All amounts in **millions of dollars**
- **IMPORTANT**: This version of the XLSX has cells with leading single quotes (e.g., `'1940'` instead of `1940`). All parsing code must `.strip("'")` values.

### Sheet mapping:
| Code | Table | Content |
|------|-------|---------|
| hist01z1 | Table 1.1 | Summary: total receipts, outlays, surplus/deficit (1789–2024) |
| hist02z1 | Table 2.1 | Receipts by source (1934–2024) — **transposed layout** |
| hist03z1 | Table 3.1 | Outlays by superfunction & function (1940–2024) — **standard layout** |
| hist07z1 | Table 7.1 | Federal debt at end of year (1940–2024) — **transposed layout** |
| hist10z1 | Table 10.1 | GDP deflator (1940–2024) — base FY2017=1.000 |

### Sheet layout types:
- **Standard** (Table 3.1): Categories in rows (col A), years as column headers (row 1). Has "As percentages" section below that must be stopped at.
- **Transposed** (Tables 1.1, 2.1, 7.1): Years in rows (col A), categories as column headers. Multi-row headers with merged cells.

### CPI Data: FRED CPIAUCSL
- Monthly CPI-U, seasonally adjusted
- Downloaded from: https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL
- Converted to fiscal year averages (Oct–Sep) before applying

## Output CSVs — All in tidy/long format:
```
category    |  year  |  amount
------------|--------|----------
Medicare    |  1970  |  6213
Medicare    |  1971  |  7874
```

### spending_by_function.csv
- 18 functional categories (Defense, Medicare, SS, Health, Net interest, etc.)
- Cleaned: removed superfunction totals (Human resources, Physical resources, Other functions), accounting splits (On/Off-budget), percentage sections
- Includes nominal + GDP Real 2024$ + CPI Real 2024$ variants

### receipts_by_source.csv
- 5 categories: Individual Income Tax, Corporate Income Tax, Payroll Taxes (FICA), Excise Taxes, Other
- Renamed from raw OMB names (e.g., "Corporation Income Taxes (1)" → "Corporate Income Tax")
- Includes nominal + real variants

### federal_debt.csv
- 10 categories: 5 in millions (Gross Federal Debt, Held by Govt Accounts, Held by Public Total/Fed Reserve/Other) + 5 as % GDP
- **NOT inflation-adjusted** (debt is a stock, not a flow)

### summary.csv
- 3 categories: Total Receipts, Total Outlays, Surplus or Deficit
- Includes nominal + real variants

## Inflation Adjustment
- **GDP deflator**: From Table 10.1 (hist10z1), col 2. Base FY2017=1.000, rebased to FY2024=1.0
- **CPI deflator**: From FRED CPIAUCSL monthly, averaged to fiscal years (Oct–Sep), rebased to FY2024=1.0
- Applied to: spending, receipts, summary. NOT applied to debt.
- Category naming: `"Medicare (Real 2024$)"`, `"Medicare (CPI Real 2024$)"`

## Visualization Sections (App.jsx)

### 1. Revenue vs Spending (FY2024)
- Side-by-side card layout
- Each block = $10B, 22-column grid
- Blue sequential palette (revenue), orange sequential palette (spending) — ColorBrewer colorblind-safe
- Hover highlights category across blocks + legend
- Legend shows category name + dollar amount

### 2. The Deficit
- Dark red (#8b0000) blocks showing the gap
- Deficit block count derived from actual deficit figure: `Math.round(Math.abs(deficit) / BLOCK_SIZE)`
- Shows $/day calculation: `(blocks * 10000) / 1e3 / 365` = billions per day

### 3. How Deficits Become Debt
- Year slider (1970–2024), drag to scrub
- Stats row: Revenue, Spending, Deficit/Surplus, Deficit Debt (1970–year), Gross Federal Debt
- Current year deficit blocks (orange)
- Accumulated debt pile: gray blocks (pre-1970 inherited debt ~$378B) + colored blocks by year (lighter=older, darker=newer)
- Hover on debt pile shows which fiscal year those blocks were borrowed
- Surplus years show green callout
- Debt reconciliation table: Pre-1970 + Cumulative deficits + Trust fund borrowing + Other = Gross Federal Debt

### 4. Rising Cost of Debt Service
- Dropdown to select comparison category
- Year slider (1970–2024)
- Side-by-side block comparison: Net Interest (orange) vs selected category (blue)
- Dynamic callout when interest exceeds the comparison category

## Key Design Decisions
- Block size = $10B everywhere (BLOCK_SIZE = 10000, amounts in millions)
- Colors: Blue (#08519c sequential) for revenue, Orange (#d94801 sequential) for spending, Dark red (#8b0000) for deficit/debt
- Card component: white bg, 10px border-radius, 1px #e5e7eb border, subtle shadow
- Header bar: #1e3a5f background, "Visualize Policy" + "Federal Budget Explorer"
- All data loaded from CSVs via fetch, filtered to exclude "Real" categories for display
- No scroll-triggered animations (removed due to bugs) — everything visible immediately

## Known Issues / Notes
- XLSX has single-quote-wrapped cell values on Mac — all parsers must `.strip("'")`
- `find_year_header()` uses try/except with `int(float(str(val)))` to handle mixed types
- The `clean()` helper in cell 6 handles NaN detection with `pd.isna()` instead of string comparison
- Debt reconciliation "Other adjustments" captures gap between deficit-based accounting and actual gross debt (off-budget items, credit programs, cash changes)
- Trust fund borrowing = "Held by Federal Government Accounts" from Table 7.1

## Deployment
```bash
cd viz
npm run build
cp public/*.csv dist/
npx vercel --prod
```
Live at: https://viz-smoky.vercel.app/

## Next Steps (in progress when context was saved)
- Incorporate CBO February 2026 Budget and Economic Outlook (2026–2036) projections
- Build counterfactual scenario visualization for OBBBA impact:
  - Scenario 1: CBO Jan 2025 baseline (before OBBBA)
  - Scenario 2: OBBBA as enacted (+$4.1T debt through 2034)
  - Scenario 3: OBBBA made permanent (+$5T)
  - Scenario 4: Worst case (tariffs struck down + permanent + high rates, debt to 134% GDP)
- CBO Feb 2026 Outlook report: https://www.cbo.gov/publication/62105
- CBO Feb 2026 PDF: https://www.cbo.gov/system/files/2026-02/61882-Outlook-2026.pdf
- OBBBA adds $4.7T through 2035 (dynamic); tariffs subtract ~$3T; lower immigration adds $0.5T
- Key OBBBA numbers: $4.5T tax cuts, $1.1T spending cuts, front-loaded costs peaking 2027

## Artifact IDs in this conversation
- `notebook-recovery` — Jupyter notebook data pipeline
- `app-jsx-recovery` — Full App.jsx visualization code
- `project-context` — This file
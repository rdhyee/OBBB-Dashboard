# --- Cell 1: Setup & Download ---

import pandas as pd
import numpy as np
from pathlib import Path

XLSX_URL = "https://www.whitehouse.gov/wp-content/uploads/2025/06/BUDGET-2026-HIST.xlsx"
XLSX_PATH = Path("BUDGET-2026-HIST.xlsx")

if not XLSX_PATH.exists():
    import urllib.request
    print("Downloading OMB Historical Tables (~5MB)...")
    urllib.request.urlretrieve(XLSX_URL, XLSX_PATH)
    print(f"Saved to {XLSX_PATH}")
else:
    print(f"Using existing {XLSX_PATH}")


# --- Cell 2: List all sheets ---

xls = pd.ExcelFile(XLSX_PATH)
for i, name in enumerate(xls.sheet_names):
    print(f"  {i:2d}  {name}")


# --- Cell 3: Inspect Table 3.1 raw structure ---

SHEETS = {
    'summary':    'hist01z1',  # Table 1.1 — Receipts, Outlays, Deficit
    'receipts':   'hist02z1',  # Table 2.1 — Receipts by Source
    'spending_fn':'hist03z1',  # Table 3.1 — Outlays by Function
    'debt':       'hist07z1',  # Table 7.1 — Federal Debt
}

raw = pd.read_excel(XLSX_PATH, sheet_name=SHEETS['spending_fn'], header=None, nrows=15)
print("=== hist03z1 (Table 3.1) — First 15 rows (raw) ===")
for i, row in raw.iterrows():
    vals = [str(v)[:25] for v in row.values[:8]]
    print(f"  row {i:2d}: {vals}")


# --- Cell 4: Core parser ---

def find_year_header(df, max_rows=10):
    """Find the row where fiscal year numbers appear as column headers."""
    for i in range(min(max_rows, len(df))):
        row_vals = df.iloc[i].astype(str).str.strip()
        year_count = sum(
            1 for v in row_vals
            if v.replace('.0', '').isdigit() and 1900 <= int(float(v)) <= 2040
        )
        if year_count >= 5:
            return i
    return None


def get_year_map(header_row):
    """Map column index -> fiscal year integer from the header row."""
    mapping = {}
    for col_idx, val in enumerate(header_row):
        s = str(val).strip().replace('.0', '').replace(',', '')
        try:
            yr = int(float(s))
            if 1900 <= yr <= 2040:
                mapping[col_idx] = yr
        except (ValueError, TypeError):
            pass
    return mapping


def parse_sheet(sheet_name, label_col=0, min_year=1962):
    """
    Parse one OMB historical table sheet into tidy (long) format.
    Returns DataFrame: [category, year, amount]
    """
    df = pd.read_excel(XLSX_PATH, sheet_name=sheet_name, header=None)
    
    hdr_idx = find_year_header(df)
    if hdr_idx is None:
        raise ValueError(f"Could not find year header in {sheet_name}")
    
    year_map = get_year_map(df.iloc[hdr_idx])
    print(f"  {sheet_name}: header at row {hdr_idx}, "
          f"{len(year_map)} year cols ({min(year_map.values())}-{max(year_map.values())})")
    
    records = []
    for i in range(hdr_idx + 1, len(df)):
        label = str(df.iloc[i, label_col]).strip()
        
        # skip empty, nan, footnotes
        if not label or label == 'nan' or label.startswith(('Note', 'Source')):
            continue
        
        # Stop when we hit percentage sections (reuses same category names)
        if 'as percentages' in label.lower() or 'as a percentage' in label.lower():
            print(f"    Stopped at row {i}: '{label}'")
            break
        
        for col_idx, yr in year_map.items():
            if yr < min_year:
                continue
            raw_val = df.iloc[i, col_idx]
            try:
                amt = float(str(raw_val).replace(',', '').strip())
            except (ValueError, TypeError):
                continue
            records.append((label, yr, amt))
    
    result = pd.DataFrame(records, columns=['category', 'year', 'amount'])
    print(f"    → {len(result):,} rows, {result['category'].nunique()} categories")
    return result


# --- Cell 5: Parse Table 3.1 — Outlays by Function ---

print("Parsing hist03z1 — Outlays by Function...")
spending_fn_raw = parse_sheet(SHEETS['spending_fn'], min_year=1970)

DROP_FN = [
    'In millions of dollars:',
    'Human resources',
    'Physical resources',
    'Other functions',
    '(On-budget)', '(Off-budget)',
    'Total, Federal outlays',
    'As percentages of outlays:',
    'As percentages of GDP:',
    'National defense',
    '* 0.05 percent or less',
    'Undistributed offsetting receipts',
]
spending_fn = spending_fn_raw[~spending_fn_raw['category'].isin(DROP_FN)].copy()

print(f"\nAfter cleanup: {len(spending_fn):,} rows, {spending_fn['category'].nunique()} categories")
print("\nFinal categories:")
for c in spending_fn['category'].unique():
    print(f"  {c}")


# --- Cell 6: Parse Table 2.1 — Receipts by Source ---

raw2 = pd.read_excel(XLSX_PATH, sheet_name=SHEETS['receipts'], header=None)

r2 = raw2.iloc[2].astype(str).str.strip()
r3 = raw2.iloc[3].astype(str).str.strip()

col_names = []
last_parent = ''
for a, b in zip(r2, r3):
    if a != 'nan':
        last_parent = a
    if b != 'nan':
        col_names.append(f"{last_parent} - {b}")
    else:
        col_names.append(last_parent)

print("Column names resolved:")
for i, c in enumerate(col_names):
    print(f"  col {i:2d}: {c}")

data = raw2.iloc[4:].copy()
data.columns = col_names
data = data.rename(columns={col_names[0]: 'year'})

data['year'] = pd.to_numeric(data['year'], errors='coerce')
data = data.dropna(subset=['year'])
data['year'] = data['year'].astype(int)
data = data[data['year'] >= 1970]

receipts = data.melt(id_vars='year', var_name='category', value_name='amount')

receipts['amount'] = pd.to_numeric(
    receipts['amount'].astype(str).str.replace(',', '').str.strip(),
    errors='coerce'
)
receipts = receipts.dropna(subset=['amount'])

KEEP_RECEIPTS = {
    'Individual Income Taxes':                                    'Individual Income Tax',
    'Corporation Income Taxes (1)':                               'Corporate Income Tax',
    'Social Insurance and Retirement Receipts (2) - Total':       'Payroll Taxes (FICA)',
    'Excise Taxes (2)':                                           'Excise Taxes',
    'Other (3)':                                                  'Other',
}
receipts = receipts[receipts['category'].isin(KEEP_RECEIPTS)].copy()
receipts['category'] = receipts['category'].map(KEEP_RECEIPTS)

print(f"\n{len(receipts):,} rows, {receipts['category'].nunique()} categories")
print("\nFinal receipt categories:")
for c in receipts['category'].unique():
    print(f"  {c}")


# --- Cell 7: Parse Table 7.1 — Federal Debt ---

raw7 = pd.read_excel(XLSX_PATH, sheet_name=SHEETS['debt'], header=None)

debt_cols = {
    0: 'year',
    1: 'Gross Federal Debt',
    2: 'Held by Federal Government Accounts',
    3: 'Held by the Public - Total',
    4: 'Held by the Public - Federal Reserve',
    5: 'Held by the Public - Other',
    6: 'Gross Federal Debt (% GDP)',
    7: 'Held by Federal Government Accounts (% GDP)',
    8: 'Held by the Public - Total (% GDP)',
    9: 'Held by the Public - Federal Reserve (% GDP)',
    10: 'Held by the Public - Other (% GDP)',
}

data7 = raw7.iloc[4:, :11].copy()
data7.columns = [debt_cols[i] for i in range(11)]

data7['year'] = pd.to_numeric(data7['year'], errors='coerce')
data7 = data7.dropna(subset=['year'])
data7['year'] = data7['year'].astype(int)
data7 = data7[data7['year'] >= 1970]

debt = data7.melt(id_vars='year', var_name='category', value_name='amount')
debt['amount'] = pd.to_numeric(
    debt['amount'].astype(str).str.replace(',', '').str.strip(),
    errors='coerce'
)
debt = debt.dropna(subset=['amount'])

print(f"{len(debt):,} rows, {debt['category'].nunique()} categories")
print("\nCategories:")
for c in debt['category'].unique():
    print(f"  {c}")


# --- Cell 8: Parse Table 1.1 — Summary ---

raw1 = pd.read_excel(XLSX_PATH, sheet_name=SHEETS['summary'], header=None)

summary_cols = {
    0: 'year',
    1: 'Total Receipts',
    2: 'Total Outlays',
    3: 'Surplus or Deficit',
}

data1 = raw1.iloc[5:, :4].copy()
data1.columns = [summary_cols[i] for i in range(4)]

data1['year'] = pd.to_numeric(data1['year'], errors='coerce')
data1 = data1.dropna(subset=['year'])
data1['year'] = data1['year'].astype(int)
data1 = data1[data1['year'] >= 1970]

summary = data1.melt(id_vars='year', var_name='category', value_name='amount')
summary['amount'] = pd.to_numeric(
    summary['amount'].astype(str).str.replace(',', '').str.strip(),
    errors='coerce'
)
summary = summary.dropna(subset=['amount'])

print(f"{len(summary):,} rows, {summary['category'].nunique()} categories")
print("\nCategories:")
for c in summary['category'].unique():
    print(f"  {c}")


# --- Cell 9: Save all datasets ---

out = Path("output")
out.mkdir(exist_ok=True)

datasets = {
    'spending_by_function.csv': spending_fn,
    'receipts_by_source.csv': receipts,
    'federal_debt.csv': debt,
    'summary.csv': summary,
}

for fname, df in datasets.items():
    path = out / fname
    df.to_csv(path, index=False)
    print(f"  {fname:30s} {len(df):>5,} rows")

print(f"\nSaved to {out.resolve()}/")


# --- Cell 10: Data structure overview ---

print("=== Shapes ===")
for name, df in [('spending_fn', spending_fn), ('receipts', receipts),
                  ('debt', debt), ('summary', summary)]:
    cats = df['category'].nunique()
    yrs = f"{df['year'].min()}-{df['year'].max()}"
    print(f"  {name:20s}  {len(df):>5,} rows  |  {cats:>2} categories  |  {yrs}")


# --- Cell 11: Quick queries demo ---

val = spending_fn.query("category == 'Medicare' and year == 2024")['amount'].values[0]
print(f"Medicare spending in 2024: ${val:,.0f}M (${val/1e6:,.2f}T)")

print("\n=== FY2024 Spending by Function ===")
fy24 = (spending_fn[spending_fn['year'] == 2024]
        .sort_values('amount', ascending=False))
for _, r in fy24.iterrows():
    print(f"  {r['category']:50s}  ${r['amount']:>12,.0f}M")

print("\n=== Receipts vs Outlays, last 5 years ===")
deficit = summary.pivot(index='year', columns='category', values='amount').tail(5)
print(deficit.to_string())


# --- Cell 12: GDP Deflator ---

raw10 = pd.read_excel(XLSX_PATH, sheet_name='hist10z1', header=None)
deflator_raw = raw10.iloc[5:, [0, 2]].copy()
deflator_raw.columns = ['year', 'gdp_deflator']
deflator_raw['year'] = pd.to_numeric(deflator_raw['year'], errors='coerce')
deflator_raw['gdp_deflator'] = pd.to_numeric(deflator_raw['gdp_deflator'], errors='coerce')
deflator = deflator_raw.dropna().copy()
deflator['year'] = deflator['year'].astype(int)

base_val = deflator.loc[deflator['year'] == 2024, 'gdp_deflator'].values[0]
deflator['gdp_adj_factor'] = base_val / deflator['gdp_deflator']

print(f"GDP deflator: {len(deflator)} years, base rebased to FY2024 = 1.0")
print(f"  FY2024 raw deflator: {base_val:.4f}")
print(f"  FY1970 adj factor:   {deflator.loc[deflator['year']==1970, 'gdp_adj_factor'].values[0]:.2f}x")
print(f"  FY2000 adj factor:   {deflator.loc[deflator['year']==2000, 'gdp_adj_factor'].values[0]:.2f}x")

def add_real_rows(df, deflator_df):
    to_adjust = df.copy()
    merged = to_adjust.merge(deflator_df[['year', 'gdp_adj_factor']], on='year', how='left')
    merged = merged.dropna(subset=['gdp_adj_factor'])
    merged['amount'] = merged['amount'] * merged['gdp_adj_factor']
    merged['category'] = merged['category'] + ' (Real 2024$)'
    merged = merged.drop(columns=['gdp_adj_factor'])
    return pd.concat([df, merged], ignore_index=True)

spending_fn = add_real_rows(spending_fn, deflator)
receipts = add_real_rows(receipts, deflator)
summary = add_real_rows(summary, deflator)

print("\n=== Spot check: Net interest FY2024 ===")
check = spending_fn[
    (spending_fn['year'] == 2024) & 
    spending_fn['category'].str.contains('Net interest')
]
for _, r in check.iterrows():
    print(f"  {r['category']:45s}  ${r['amount']:>12,.0f}M")

print(f"\nDataset sizes after adding real rows:")
for name, df in [('spending_fn', spending_fn), ('receipts', receipts),
                  ('debt', debt), ('summary', summary)]:
    print(f"  {name:20s}  {len(df):>6,} rows  |  {df['category'].nunique():>2} categories")


# --- Cell 13: CPI Deflator ---

CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
CPI_PATH = Path("CPIAUCSL.csv")

if not CPI_PATH.exists():
    import urllib.request
    print("Downloading CPI-U monthly from FRED...")
    urllib.request.urlretrieve(CPI_URL, CPI_PATH)

cpi_monthly = pd.read_csv(CPI_PATH)
cpi_monthly.columns = ['date', 'cpi']
cpi_monthly['date'] = pd.to_datetime(cpi_monthly['date'])
cpi_monthly['cpi'] = pd.to_numeric(cpi_monthly['cpi'], errors='coerce')

cpi_monthly['fiscal_year'] = cpi_monthly['date'].apply(
    lambda d: d.year + 1 if d.month >= 10 else d.year
)

fy_counts = cpi_monthly.groupby('fiscal_year')['cpi'].count()
complete_fys = fy_counts[fy_counts == 12].index

cpi_fy = (cpi_monthly[cpi_monthly['fiscal_year'].isin(complete_fys)]
          .groupby('fiscal_year')['cpi']
          .mean()
          .reset_index())
cpi_fy.columns = ['year', 'cpi']

cpi_base = cpi_fy.loc[cpi_fy['year'] == 2024, 'cpi'].values[0]
cpi_fy['cpi_adj_factor'] = cpi_base / cpi_fy['cpi']

print(f"CPI-U fiscal year series: {len(cpi_fy)} years")
print(f"  FY2024 CPI level: {cpi_base:.2f}")
print(f"  FY1970 adj factor: {cpi_fy.loc[cpi_fy['year']==1970, 'cpi_adj_factor'].values[0]:.2f}x")
print(f"  FY2000 adj factor: {cpi_fy.loc[cpi_fy['year']==2000, 'cpi_adj_factor'].values[0]:.2f}x")

def add_cpi_real_rows(df, cpi_df):
    nominal = df[~df['category'].str.contains('Real 2024', na=False)].copy()
    merged = nominal.merge(cpi_df[['year', 'cpi_adj_factor']], on='year', how='left')
    merged = merged.dropna(subset=['cpi_adj_factor'])
    merged['amount'] = merged['amount'] * merged['cpi_adj_factor']
    merged['category'] = merged['category'] + ' (CPI Real 2024$)'
    merged = merged.drop(columns=['cpi_adj_factor'])
    return pd.concat([df, merged], ignore_index=True)

spending_fn = add_cpi_real_rows(spending_fn, cpi_fy)
receipts = add_cpi_real_rows(receipts, cpi_fy)
summary = add_cpi_real_rows(summary, cpi_fy)

print(f"\nDataset sizes with both deflators:")
for name, df in [('spending_fn', spending_fn), ('receipts', receipts),
                  ('debt', debt), ('summary', summary)]:
    print(f"  {name:20s}  {len(df):>6,} rows  |  {df['category'].nunique():>2} categories")


# --- Cell 14: Final export ---

out = Path("output")
out.mkdir(exist_ok=True)

datasets = {
    'spending_by_function.csv': spending_fn,
    'receipts_by_source.csv': receipts,
    'federal_debt.csv': debt,
    'summary.csv': summary,
}

for fname, df in datasets.items():
    path = out / fname
    df.to_csv(path, index=False)
    print(f"  {fname:30s} {len(df):>6,} rows")

print(f"\nAll files saved to {out.resolve()}/")
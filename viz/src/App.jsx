import { useState, useEffect, useRef, useMemo } from "react";
import Papa from "papaparse";

var BLOCK_SIZE = 10000;
var YEAR = 2024;
var COLS = 22;
var SZ = 12;
var GAP = 2;

var REV_COLORS = {
  "Individual Income Tax": "#08519c",
  "Payroll Taxes (FICA)": "#3182bd",
  "Corporate Income Tax": "#6baed6",
  Other: "#9ecae1",
  "Excise Taxes": "#c6dbef",
};

var SPEND_COLORS = {
  "Social Security": "#7f2704",
  Health: "#a63603",
  "Net interest": "#d94801",
  Medicare: "#e6550d",
  "National Defense": "#f16913",
  "Income Security": "#fd8d3c",
  "Veterans Benefits and Services": "#fdae6b",
  "Education, Training, Employment, and Social Services": "#fdd0a2",
};
var SPEND_OTHER_COLOR = "#fee6ce";

var SPEND_SHORT = {
  "Social Security": "Social Security",
  Health: "Health (Medicaid/ACA)",
  "Net interest": "Net Interest",
  Medicare: "Medicare",
  "National Defense": "National Defense",
  "Income Security": "Income Security",
  "Veterans Benefits and Services": "Veterans",
  "Education, Training, Employment, and Social Services": "Education & Training",
};

function fmtAmt(v) {
  var abs = Math.abs(v);
  if (abs >= 1e6) return "$" + (abs / 1e6).toFixed(2) + "T";
  return "$" + Math.round(abs / 1e3) + "B";
}

function useCSV(path) {
  var _s = useState(null);
  var data = _s[0]; var setData = _s[1];
  useEffect(function () {
    var cancelled = false;
    fetch("/" + path)
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        if (cancelled) return;
        setData(Papa.parse(txt.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true }).data);
      })
      .catch(function (e) { console.error("Failed to load", path, e); });
    return function () { cancelled = true; };
  }, [path]);
  return data;
}

function buildBlocks(sources) {
  var blocks = [];
  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    var n = Math.round(src.amount / BLOCK_SIZE);
    for (var j = 0; j < n; j++) blocks.push({ color: src.color, name: src.label });
  }
  return blocks;
}

function BlockGrid(props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ", " + SZ + "px)", gap: GAP + "px" }}>
      {props.blocks.map(function (b, i) {
        var hl = props.hoveredCat === null || props.hoveredCat === b.name;
        return (
          <div key={i}
            onMouseEnter={function () { props.setHoveredCat(b.name); }}
            onMouseLeave={function () { props.setHoveredCat(null); }}
            style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: b.color, opacity: hl ? 1 : 0.12, transition: "opacity 0.2s", cursor: "pointer" }}
          />
        );
      })}
    </div>
  );
}

function Legend(props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
      {props.sources.map(function (s) {
        var isActive = props.hoveredCat === null || props.hoveredCat === s.label;
        var amt = s.amount >= 1e6 ? "$" + (s.amount / 1e6).toFixed(2) + "T" : "$" + Math.round(s.amount / 1e3) + "B";
        return (
          <div key={s.label}
            onMouseEnter={function () { props.setHoveredCat(s.label); }}
            onMouseLeave={function () { props.setHoveredCat(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, opacity: isActive ? 1 : 0.2, transition: "opacity 0.2s", cursor: "pointer", fontSize: 13 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color, flexShrink: 0 }} />
            <span style={{ color: "#374151" }}>{s.label}</span>
            <span style={{ color: "#9ca3af", marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{amt}</span>
          </div>
        );
      })}
    </div>
  );
}

function Card(props) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "24px 28px", ...(props.style || {}) }}>
      {props.children}
    </div>
  );
}

/* ─── Debt Accumulation ─── */

function DebtAccumulation(props) {
  var summaryData = props.summaryData;
  var debtData = props.debtData;

  var yearData = useMemo(function () {
    if (!summaryData) return [];
    var rows = summaryData.filter(function (r) { return r.year >= 1970 && r.year <= 2024 && !String(r.category).includes("Real"); });
    var byYear = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!byYear[r.year]) byYear[r.year] = {};
      if (r.category === "Total Receipts") byYear[r.year].receipts = r.amount;
      if (r.category === "Total Outlays") byYear[r.year].outlays = r.amount;
      if (r.category === "Surplus or Deficit") byYear[r.year].deficit = r.amount;
    }
    var cumDebt = 0; var result = [];
    for (var y = 1970; y <= 2024; y++) {
      var d = byYear[y] || {};
      var def = d.deficit || 0;
      if (def < 0) cumDebt += Math.abs(def);
      result.push({ year: y, receipts: d.receipts || 0, outlays: d.outlays || 0, deficit: def, cumDebt: cumDebt });
    }
    return result;
  }, [summaryData]);

  var pre1970Debt = useMemo(function () {
    if (!debtData || !summaryData) return 0;
    var debtRows = debtData.filter(function (r) { return r.category === "Gross Federal Debt" && !String(r.category).includes("Real"); });
    var fy1970 = debtRows.find(function (r) { return r.year === 1970; });
    var defRow = summaryData.find(function (r) { return r.year === 1970 && r.category === "Surplus or Deficit"; });
    var fy1970deficit = (defRow && defRow.amount < 0) ? Math.abs(defRow.amount) : 0;
    return fy1970 ? Math.max(fy1970.amount - fy1970deficit, 0) : 0;
  }, [debtData, summaryData]);

  var _idx = useState(0); var yearIdx = _idx[0]; var setYearIdx = _idx[1];
  var _hovY = useState(null); var hoveredYear = _hovY[0]; var setHoveredYear = _hovY[1];

  useEffect(function () { if (yearData.length > 0) setYearIdx(yearData.length - 1); }, [yearData.length]);

  var debtPileBlocks = useMemo(function () {
    var blocks = [];
    for (var i = 0; i <= yearIdx; i++) {
      var yd = yearData[i];
      if (!yd || yd.deficit >= 0) continue;
      var n = Math.round(Math.abs(yd.deficit) / BLOCK_SIZE);
      for (var j = 0; j < n; j++) blocks.push({ year: yd.year });
    }
    return blocks;
  }, [yearIdx, yearData]);

  if (yearData.length === 0) return null;

  var cur = yearData[yearIdx] || yearData[yearData.length - 1];
  var deficitBlocks = cur.deficit < 0 ? Math.round(Math.abs(cur.deficit) / BLOCK_SIZE) : 0;
  var minPileYear = debtPileBlocks.length > 0 ? debtPileBlocks[0].year : cur.year;
  var maxPileYear = debtPileBlocks.length > 0 ? debtPileBlocks[debtPileBlocks.length - 1].year : cur.year;
  var pre1970Blocks = Math.round(pre1970Debt / BLOCK_SIZE);

  var actualDebtThisYear = useMemo(function () {
    if (!debtData) return 0;
    var rows = debtData.filter(function (r) { return !String(r.category).includes("Real"); });
    var row = rows.find(function (r) { return r.year === cur.year && r.category === "Gross Federal Debt"; });
    return row ? row.amount : 0;
  }, [debtData, cur.year]);

  var totalDebtEst = pre1970Debt + cur.cumDebt;

  var debtBreakdown = useMemo(function () {
    if (!debtData) return { gross: 0, heldByGovt: 0 };
    var rows = debtData.filter(function (r) { return r.year === cur.year && !String(r.category).includes("Real") && !String(r.category).includes("% GDP"); });
    var gross = 0; var heldByGovt = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].category === "Gross Federal Debt") gross = rows[i].amount;
      if (rows[i].category === "Held by Federal Government Accounts") heldByGovt = rows[i].amount;
    }
    return { gross: gross, heldByGovt: heldByGovt };
  }, [debtData, cur.year]);

  var pre1970TrustFund = useMemo(function () {
    if (!debtData) return 0;
    var row = debtData.find(function (r) { return r.year === 1970 && r.category === "Held by Federal Government Accounts" && !String(r.category).includes("Real"); });
    return row ? row.amount : 0;
  }, [debtData]);

  var trustFundBorrowing = debtBreakdown.heldByGovt - pre1970TrustFund;
  var otherAdjustments = actualDebtThisYear - totalDebtEst - Math.max(trustFundBorrowing, 0) - pre1970TrustFund;

  function yearColor(blockYear) {
    var range = Math.max(maxPileYear - minPileYear, 1);
    var t = (blockYear - minPileYear) / range;
    return "rgb(" + Math.round(220 - t * 90) + "," + Math.round(100 - t * 70) + "," + Math.round(100 - t * 70) + ")";
  }

  return (
    <Card style={{ marginTop: 28, borderLeft: "4px solid #8b0000" }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#8b0000", margin: "0 0 6px" }}>How Deficits Become Debt</h3>
      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 20px" }}>
        Each year the government runs a deficit, it borrows to cover the gap. Year after year, these deficits accumulate into the national debt. Drag the slider to scrub through time.
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>1970</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>FY {cur.year}</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>2024</span>
        </div>
        <input type="range" min={0} max={yearData.length - 1} value={yearIdx}
          onChange={function (e) { setYearIdx(Number(e.target.value)); }}
          style={{ width: "100%", accentColor: "#8b0000", cursor: "grab" }} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#08519c" }}>{fmtAmt(cur.receipts)}</div>
        </div>
        <div style={{ background: "#fff7ed", borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Spending</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#d94801" }}>{fmtAmt(cur.outlays)}</div>
        </div>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{cur.deficit >= 0 ? "Surplus" : "Deficit"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: cur.deficit >= 0 ? "#16a34a" : "#8b0000" }}>{cur.deficit >= 0 ? "+" : "−"}{fmtAmt(cur.deficit)}</div>
        </div>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Deficit Debt (1970–{cur.year})</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#8b0000" }}>{fmtAmt(cur.cumDebt)}</div>
        </div>
        <div style={{ background: "#fce4ec", borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Gross Federal Debt</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#4a0000" }}>{fmtAmt(actualDebtThisYear)}</div>
        </div>
      </div>

      {deficitBlocks > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>FY{cur.year} deficit: {deficitBlocks} blocks × $10B</div>
          <div style={{ display: "flex", gap: GAP, flexWrap: "wrap" }}>
            {Array.from({ length: deficitBlocks }).map(function (_, i) {
              return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#d94801", opacity: 0.9 }} />;
            })}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>▼ These blocks get added to the debt pile below</div>
        </div>
      )}

      {cur.deficit >= 0 && (
        <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f0fdf4", borderRadius: 6, fontSize: 13, color: "#16a34a" }}>
          ✓ The government ran a surplus in FY{cur.year} — no new borrowing this year.
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
          Total debt pile: {pre1970Blocks + debtPileBlocks.length} blocks × $10B = {fmtAmt(pre1970Debt + cur.cumDebt)}
          {hoveredYear !== null && hoveredYear !== -1 && <span style={{ marginLeft: 12, color: "#8b0000", fontWeight: 600 }}>Viewing: FY{hoveredYear}</span>}
          {hoveredYear === -1 && <span style={{ marginLeft: 12, color: "#6b7280", fontWeight: 600 }}>Pre-1970 inherited debt</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: GAP + "px" }}>
          {Array.from({ length: pre1970Blocks }).map(function (_, i) {
            var isHl = hoveredYear === null || hoveredYear === -1;
            return (
              <div key={"pre" + i}
                onMouseEnter={function () { setHoveredYear(-1); }}
                onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#9ca3af", opacity: isHl ? 0.7 : 0.1, transition: "opacity 0.2s", cursor: "pointer" }} />
            );
          })}
          {debtPileBlocks.map(function (b, i) {
            var isHl = hoveredYear === null || hoveredYear === b.year;
            return (
              <div key={i}
                onMouseEnter={function () { setHoveredYear(b.year); }}
                onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: yearColor(b.year), opacity: isHl ? 0.95 : 0.15, transition: "opacity 0.2s", cursor: "pointer" }} />
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
          <span style={{ color: "#9ca3af" }}>■</span> Gray = pre-1970 inherited debt ({fmtAmt(pre1970Debt)}).
          Colored blocks = deficit-driven debt since 1970. Hover to see year.
        </div>
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Debt Reconciliation — FY{cur.year}</div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9ca3af" }}>Pre-1970 inherited debt</span>
            <span>{fmtAmt(pre1970Debt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#8b0000" }}>+ Cumulative budget deficits (1970–{cur.year})</span>
            <span>{fmtAmt(cur.cumDebt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>+ Trust fund borrowing (SS, Medicare, pensions)</span>
            <span>{fmtAmt(debtBreakdown.heldByGovt)}</span>
          </div>
          {Math.abs(otherAdjustments) > 1000 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>+ Other (credit programs, cash changes, etc.)</span>
              <span>{otherAdjustments >= 0 ? "+" : "−"}{fmtAmt(otherAdjustments)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #d1d5db", paddingTop: 4, marginTop: 4, fontWeight: 700, color: "#4a0000" }}>
            <span>= Gross Federal Debt</span>
            <span>{fmtAmt(actualDebtThisYear)}</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
          Trust fund borrowing = debt the government owes to its own trust funds (Social Security, Medicare, federal employee retirement). These funds ran surpluses that were lent to the Treasury.
        </div>
      </div>
    </Card>
  );
}

/* ─── Net Interest Comparison ─── */

function NetInterestComparison(props) {
  var spendingData = props.spendingData;

  var categories = useMemo(function () {
    if (!spendingData) return [];
    var cats = {};
    var rows = spendingData.filter(function (r) { return !String(r.category).includes("Real") && r.category !== "Net interest"; });
    for (var i = 0; i < rows.length; i++) cats[rows[i].category] = true;
    return Object.keys(cats).sort();
  }, [spendingData]);

  var _comp = useState("National Defense"); var compareCat = _comp[0]; var setCompareCat = _comp[1];
  var _yr = useState(0); var yearIdx = _yr[0]; var setYearIdx = _yr[1];

  var timeData = useMemo(function () {
    if (!spendingData) return [];
    var rows = spendingData.filter(function (r) { return !String(r.category).includes("Real") && r.year >= 1970 && r.year <= 2024; });
    var byYear = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!byYear[r.year]) byYear[r.year] = {};
      byYear[r.year][r.category] = r.amount;
    }
    var result = [];
    for (var y = 1970; y <= 2024; y++) { if (byYear[y]) result.push({ year: y, interest: byYear[y]["Net interest"] || 0, data: byYear[y] }); }
    return result;
  }, [spendingData]);

  useEffect(function () { if (timeData.length > 0) setYearIdx(timeData.length - 1); }, [timeData.length]);

  if (timeData.length === 0) return null;

  var cur = timeData[yearIdx] || timeData[timeData.length - 1];
  var interestAmt = cur.interest;
  var compareAmt = cur.data[compareCat] || 0;
  var interestBlocks = Math.round(interestAmt / BLOCK_SIZE);
  var compareBlocks = Math.round(compareAmt / BLOCK_SIZE);
  var shortName = SPEND_SHORT[compareCat] || compareCat;

  return (
    <Card style={{ marginTop: 28, borderLeft: "4px solid #d94801" }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#d94801", margin: "0 0 6px" }}>The Rising Cost of Debt Service</h3>
      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 20px" }}>
        As debt accumulates, the government pays more in interest each year. Net interest is now one of the largest line items in the federal budget. Compare it against other categories to see how it has grown.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#6b7280" }}>Compare with:</label>
        <select value={compareCat} onChange={function (e) { setCompareCat(e.target.value); }}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#111827", background: "#fff", cursor: "pointer" }}>
          {categories.map(function (c) { return <option key={c} value={c}>{SPEND_SHORT[c] || c}</option>; })}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>1970</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>FY {cur.year}</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>2024</span>
        </div>
        <input type="range" min={0} max={timeData.length - 1} value={yearIdx}
          onChange={function (e) { setYearIdx(Number(e.target.value)); }}
          style={{ width: "100%", accentColor: "#d94801", cursor: "grab" }} />
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#d94801" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#d94801" }}>Net Interest</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#d94801" }}>{fmtAmt(interestAmt)}</span>
          </div>
          <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af" }}>{interestBlocks} blocks</div>
          <div style={{ display: "flex", gap: GAP, flexWrap: "wrap" }}>
            {Array.from({ length: interestBlocks }).map(function (_, i) {
              return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#d94801", opacity: 0.9 }} />;
            })}
          </div>
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#08519c" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#08519c" }}>{shortName}</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#08519c" }}>{fmtAmt(compareAmt)}</span>
          </div>
          <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af" }}>{compareBlocks} blocks</div>
          <div style={{ display: "flex", gap: GAP, flexWrap: "wrap" }}>
            {Array.from({ length: compareBlocks }).map(function (_, i) {
              return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#08519c", opacity: 0.9 }} />;
            })}
          </div>
        </div>
      </div>

      {interestAmt > compareAmt && (
        <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", borderRadius: 6, fontSize: 13, color: "#8b0000", lineHeight: 1.5 }}>
          <strong>Net interest exceeds {shortName}</strong> by {fmtAmt(interestAmt - compareAmt)} in FY{cur.year} — the government spends more servicing its debt than on this entire category.
        </div>
      )}
      {interestAmt <= compareAmt && compareAmt > 0 && (
        <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0f9ff", borderRadius: 6, fontSize: 13, color: "#08519c", lineHeight: 1.5 }}>
          In FY{cur.year}, {shortName} still exceeds net interest by {fmtAmt(compareAmt - interestAmt)}. Scrub forward to see when interest catches up.
        </div>
      )}
    </Card>
  );
}

/* ─── Main App ─── */

export default function App() {
  var spendingData = useCSV("spending_by_function.csv");
  var receiptsData = useCSV("receipts_by_source.csv");
  var summaryData = useCSV("summary.csv");
  var debtData = useCSV("federal_debt.csv");
  var _hov = useState(null); var hoveredCat = _hov[0]; var setHoveredCat = _hov[1];

  var computed = useMemo(function () {
    if (!spendingData || !receiptsData || !summaryData)
      return { revSources: [], spendSources: [], totalRev: 0, totalSpend: 0, deficit: 0 };

    var revRows = receiptsData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var revSrc = revRows.map(function (r) { return { label: r.category, amount: r.amount, color: REV_COLORS[r.category] || "#93c5fd" }; }).sort(function (a, b) { return b.amount - a.amount; });

    var spendRows = spendingData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var named = []; var otherTotal = 0;
    spendRows.sort(function (a, b) { return b.amount - a.amount; }).forEach(function (r) {
      if (SPEND_COLORS[r.category]) named.push({ label: SPEND_SHORT[r.category] || r.category, amount: r.amount, color: SPEND_COLORS[r.category] });
      else otherTotal += r.amount;
    });
    named.push({ label: "All Other", amount: otherTotal, color: SPEND_OTHER_COLOR });

    var sumRow = summaryData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var find = function (cat) { var f = sumRow.find(function (r) { return r.category === cat; }); return f ? f.amount : 0; };
    return { revSources: revSrc, spendSources: named.sort(function (a, b) { return b.amount - a.amount; }), totalRev: find("Total Receipts"), totalSpend: find("Total Outlays"), deficit: find("Surplus or Deficit") };
  }, [spendingData, receiptsData, summaryData]);

  var revSources = computed.revSources, spendSources = computed.spendSources, totalRev = computed.totalRev, totalSpend = computed.totalSpend, deficit = computed.deficit;
  var revBlocks = useMemo(function () { return buildBlocks(revSources); }, [revSources]);
  var spendBlocks = useMemo(function () { return buildBlocks(spendSources); }, [spendSources]);
  var deficitBlockCount = Math.round(Math.abs(deficit) / BLOCK_SIZE);

  if (!spendingData || !receiptsData || !summaryData || !debtData) {
    return <div style={{ background: "#f8fafc", minHeight: "100vh", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", fontSize: 16 }}>Loading data…</div>;
  }

  return (
    <div style={{ background: "#f8fafc", color: "#111827", fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh" }}>
      <div style={{ background: "#1e3a5f", padding: "14px 32px", color: "#fff" }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3 }}>Visualize Policy</span>
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 16 }}>Federal Budget Explorer</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 56px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px" }}>The Federal Budget: How has it changed? Why does it matter?</h1>
        <h2 style={{ fontSize: 16, fontWeight: 400, color: "#6b7280", margin: "0 0 24px" }}>Revenue, Spending, and the Deficit</h2>

        <Card style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.65, margin: 0 }}>
            In fiscal year {YEAR}, the federal government collected <strong style={{ color: "#08519c" }}>${(totalRev / 1e6).toFixed(2)} trillion</strong> in revenue
            and spent <strong style={{ color: "#d94801" }}>${(totalSpend / 1e6).toFixed(2)} trillion</strong>,
            resulting in a deficit of <strong style={{ color: "#8b0000" }}>${(Math.abs(deficit) / 1e6).toFixed(2)} trillion</strong>. Each block = <strong>$10 billion</strong>.
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "10px 0 0" }}>Data source: OMB Historical Tables (FY2026 Budget, June 2025). Hover over blocks or legend items to highlight categories.</p>
        </Card>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 28 }}>
          <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#08519c", margin: 0 }}>Revenue</h3>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#08519c" }}>${(totalRev / 1e6).toFixed(2)}T</span>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px" }}>Individual income taxes and payroll taxes (FICA) account for over 80% of federal revenue.</p>
            <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af" }}>{revBlocks.length} blocks</div>
            <BlockGrid blocks={revBlocks} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
            <Legend sources={revSources} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
          </Card>
          <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#d94801", margin: 0 }}>Spending</h3>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#d94801" }}>${(totalSpend / 1e6).toFixed(2)}T</span>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px" }}>Social Security, healthcare, defense, and net interest make up the majority of federal outlays.</p>
            <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af" }}>{spendBlocks.length} blocks</div>
            <BlockGrid blocks={spendBlocks} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
            <Legend sources={spendSources} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
          </Card>
        </div>

        <Card style={{ marginBottom: 28, borderLeft: "4px solid #8b0000" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#8b0000", margin: 0 }}>The Deficit</h3>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#8b0000" }}>−${(Math.abs(deficit) / 1e6).toFixed(2)}T</span>
          </div>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 16px" }}>
            <strong style={{ color: "#8b0000" }}>{deficitBlockCount} blocks</strong> of spending had no corresponding revenue — that's <strong style={{ color: "#8b0000" }}>${((deficitBlockCount * BLOCK_SIZE) / 1e3 / 365).toFixed(1)}B per day</strong> added to the national debt.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ", " + SZ + "px)", gap: GAP + "px" }}>
            {Array.from({ length: deficitBlockCount }).map(function (_, i) { return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#8b0000", opacity: 0.8 }} />; })}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>Each block = $10B of borrowed money</div>
        </Card>

        <DebtAccumulation summaryData={summaryData} debtData={debtData} />
        <NetInterestComparison spendingData={spendingData} />

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
          Visualization by <a href="https://visualizepolicy.org" style={{ color: "#6b7280" }}>Visualize Policy</a>. Data: OMB Historical Tables, FY2026 Budget (June 2025).
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";

var BLOCK_SIZE = 10000;
var YEAR = 2024;
var COLS = 22;
var SZ = 12;
var GAP = 2;

var PROJ_BLOCK_B = 10;
var PROJ_SZ      = 7;
var PROJ_GAP     = 1;
var PROJ_COL_W   = 10;

// ── Editorial palette ──
var BG        = "#f5f0e8";   // cream background
var SURFACE   = "#faf7f2";   // card background
var BORDER    = "#ddd5c0";   // card borders
var TEXT      = "#1a1208";   // near-black ink
var MUTED     = "#7a6e5a";   // muted text
var GOLD      = "#8b6914";   // dark gold accent
var AMBER     = "#b84c1a";   // orange-red accent
var RED       = "#8b1a1a";   // deficit/debt red
var BLUE      = "#1a3a5c";   // deep navy blue

var C_JAN      = "#1a3a5c";
var C_OBBBA    = "#8b6914";
var C_NOTARIFF = "#b84c1a";

var REV_COLORS = {
  "Individual Income Tax": "#1a3a5c",
  "Payroll Taxes (FICA)":  "#2a5a8c",
  "Corporate Income Tax":  "#3a7ab0",
  Other:                   "#6aa0c8",
  "Excise Taxes":          "#9abcd8",
};

var SPEND_COLORS = {
  "Social Security":   "#5c1a1a",
  Health:              "#7a2020",
  "Net interest":      "#b84c1a",
  Medicare:            "#8b3a14",
  "National Defense":  "#3a2800",
  "Income Security":   "#6b4a10",
  "Veterans Benefits and Services": "#8b6914",
  "Education, Training, Employment, and Social Services": "#a08030",
};
var SPEND_OTHER_COLOR = "#d4c8a0";

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

var PAGES = [
  { prompt: "Let's look at where the money comes from — and where it goes." },
  { prompt: "The government spent $875B more than it collected. What does that gap look like?" },
  { prompt: "Every year's deficit adds to a growing pile. How big has it gotten?" },
  { prompt: "All that debt has a price. How much is the government paying just to borrow?" },
  { prompt: "A new law just changed the trajectory. What does the One Big Beautiful Bill Act add?" },
  { prompt: null },
];

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
            style={{ width: SZ, height: SZ, borderRadius: 1, backgroundColor: b.color, opacity: hl ? 1 : 0.1, transition: "opacity 0.2s", cursor: "pointer" }}
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
            <div style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: s.color, flexShrink: 0 }} />
            <span style={{ color: TEXT, fontFamily: "Georgia, serif" }}>{s.label}</span>
            <span style={{ color: MUTED, marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{amt}</span>
          </div>
        );
      })}
    </div>
  );
}

function Card(props) {
  return (
    <div style={{ background: SURFACE, borderRadius: 4, border: "1px solid " + BORDER, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "24px 28px", ...(props.style || {}) }}>
      {props.children}
    </div>
  );
}

/* ─── Page 0: Intro ─── */
function IntroPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", maxWidth: 600 }}>
      <div style={{ fontSize: 11, fontWeight: 400, color: MUTED, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24, fontFamily: "Georgia, serif" }}>Visualize Policy</div>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: TEXT, lineHeight: 1.1, margin: "0 0 28px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        The Federal Budget
      </h1>
      <div style={{ width: 40, height: 2, background: RED, marginBottom: 28 }} />
      <p style={{ fontSize: 18, color: MUTED, lineHeight: 1.8, margin: 0, fontFamily: "Georgia, serif" }}>
        Where does the government's money come from? Where does it go? And what happens when it spends more than it takes in?
      </p>
    </div>
  );
}

/* ─── Page 1: Revenue vs Spending ─── */
function RevSpendPage({ spendingData, receiptsData, summaryData }) {
  var _hov = useState(null); var hoveredCat = _hov[0]; var setHoveredCat = _hov[1];

  var computed = useMemo(function () {
    if (!spendingData || !receiptsData || !summaryData)
      return { revSources: [], spendSources: [], totalRev: 0, totalSpend: 0 };

    var revRows = receiptsData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var revSrc  = revRows.map(function (r) { return { label: r.category, amount: r.amount, color: REV_COLORS[r.category] || "#93c5fd" }; }).sort(function (a, b) { return b.amount - a.amount; });

    var spendRows = spendingData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var named = []; var otherTotal = 0;
    spendRows.sort(function (a, b) { return b.amount - a.amount; }).forEach(function (r) {
      if (SPEND_COLORS[r.category]) named.push({ label: SPEND_SHORT[r.category] || r.category, amount: r.amount, color: SPEND_COLORS[r.category] });
      else otherTotal += r.amount;
    });
    named.push({ label: "All Other", amount: otherTotal, color: SPEND_OTHER_COLOR });

    var sumRow = summaryData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var find = function (cat) { var f = sumRow.find(function (r) { return r.category === cat; }); return f ? f.amount : 0; };
    return { revSources: revSrc, spendSources: named.sort(function (a, b) { return b.amount - a.amount; }), totalRev: find("Total Receipts"), totalSpend: find("Total Outlays") };
  }, [spendingData, receiptsData, summaryData]);

  var revBlocks   = useMemo(function () { return buildBlocks(computed.revSources); }, [computed.revSources]);
  var spendBlocks = useMemo(function () { return buildBlocks(computed.spendSources); }, [computed.spendSources]);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>Revenue vs. Spending — FY{YEAR}</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>Each block = $10B. Hover to highlight a category.</p>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: BLUE, margin: 0, fontFamily: "Georgia, serif" }}>Revenue</h3>
            <span style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>${(computed.totalRev / 1e6).toFixed(2)}T</span>
          </div>
          <BlockGrid blocks={revBlocks} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
          <Legend sources={computed.revSources} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
        </Card>
        <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: GOLD, margin: 0, fontFamily: "Georgia, serif" }}>Spending</h3>
            <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>${(computed.totalSpend / 1e6).toFixed(2)}T</span>
          </div>
          <BlockGrid blocks={spendBlocks} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
          <Legend sources={computed.spendSources} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
        </Card>
      </div>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Source: OMB Historical Tables, FY2026 Budget.</p>
    </div>
  );
}

/* ─── Page 2: The Deficit ─── */
function DeficitPage({ summaryData }) {
  var deficit = useMemo(function () {
    if (!summaryData) return 0;
    var row = summaryData.find(function (r) { return r.year === YEAR && r.category === "Surplus or Deficit"; });
    return row ? row.amount : 0;
  }, [summaryData]);

  var deficitBlockCount = Math.round(Math.abs(deficit) / BLOCK_SIZE);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>The Deficit — FY{YEAR}</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>Each block = $10B of borrowed money.</p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: RED, margin: 0, fontFamily: "Georgia, serif" }}>The Deficit</h3>
          <span style={{ fontSize: 26, fontWeight: 800, color: RED }}>−${(Math.abs(deficit) / 1e6).toFixed(2)}T</span>
        </div>
        <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: "0 0 16px" }}>
          <strong style={{ color: RED }}>{deficitBlockCount} blocks</strong> of spending had no corresponding revenue — that's <strong style={{ color: RED }}>${((deficitBlockCount * BLOCK_SIZE) / 1e3 / 365).toFixed(1)}B per day</strong> added to the national debt.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ", " + SZ + "px)", gap: GAP + "px" }}>
          {Array.from({ length: deficitBlockCount }).map(function (_, i) {
            return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: RED, opacity: 0.85 }} />;
          })}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Each block = $10B of borrowed money</div>
      </Card>
    </div>
  );
}

/* ─── Page 3: Debt Accumulation ─── */
function DebtAccumulation({ summaryData, debtData }) {
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

  var _idx = useState(yearData.length - 1); var yearIdx = _idx[0]; var setYearIdx = _idx[1];
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
    var row = debtData.find(function (r) { return r.year === cur.year && r.category === "Gross Federal Debt" && !String(r.category).includes("Real"); });
    return row ? row.amount : 0;
  }, [debtData, cur.year]);

  var debtBreakdown = useMemo(function () {
    if (!debtData) return { heldByGovt: 0 };
    var rows = debtData.filter(function (r) { return r.year === cur.year && !String(r.category).includes("Real") && !String(r.category).includes("% GDP"); });
    var heldByGovt = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].category === "Held by Federal Government Accounts") heldByGovt = rows[i].amount;
    }
    return { heldByGovt: heldByGovt };
  }, [debtData, cur.year]);

  var pre1970TrustFund = useMemo(function () {
    if (!debtData) return 0;
    var row = debtData.find(function (r) { return r.year === 1970 && r.category === "Held by Federal Government Accounts" && !String(r.category).includes("Real"); });
    return row ? row.amount : 0;
  }, [debtData]);

  var trustFundBorrowing = debtBreakdown.heldByGovt - pre1970TrustFund;
  var otherAdjustments = actualDebtThisYear - (pre1970Debt + cur.cumDebt) - Math.max(trustFundBorrowing, 0) - pre1970TrustFund;

  function yearColor(blockYear) {
    var range = Math.max(maxPileYear - minPileYear, 1);
    var t = (blockYear - minPileYear) / range;
    return "rgb(" + Math.round(220 - t * 90) + "," + Math.round(100 - t * 70) + "," + Math.round(100 - t * 70) + ")";
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>How Deficits Become Debt</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>Drag the slider to scrub through time. Each block = $10B.</p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: MUTED }}>1970</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif" }}>FY {cur.year}</span>
            <span style={{ fontSize: 13, color: MUTED }}>2024</span>
          </div>
          <input type="range" min={0} max={yearData.length - 1} value={yearIdx}
            onChange={function (e) { setYearIdx(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: GOLD, cursor: "grab" }} />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { label: "Revenue", val: cur.receipts, bg: "#e8f0f8", color: BLUE },
            { label: "Spending", val: cur.outlays, bg: "#f8f0e8", color: AMBER },
            { label: cur.deficit >= 0 ? "Surplus" : "Deficit", val: cur.deficit, bg: "#f8e8e8", color: RED, prefix: cur.deficit >= 0 ? "+" : "−" },
            { label: "Gross Federal Debt", val: actualDebtThisYear, bg: "#f0e8e8", color: "#6b1a1a" },
          ].map(function (s) {
            return (
              <div key={s.label} style={{ background: s.bg, borderRadius: 4, padding: "10px 16px", flex: "1 1 120px", border: "1px solid " + BORDER }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "Georgia, serif" }}>{s.prefix || ""}{fmtAmt(s.val)}</div>
              </div>
            );
          })}
        </div>
        {deficitBlocks > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>FY{cur.year} deficit: {deficitBlocks} blocks × $10B</div>
            <div style={{ display: "flex", gap: GAP, flexWrap: "wrap" }}>
              {Array.from({ length: deficitBlocks }).map(function (_, i) {
                return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: AMBER, opacity: 0.9 }} />;
              })}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>▼ Added to the debt pile below</div>
          </div>
        )}
        {cur.deficit >= 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#e8f4ec", borderRadius: 4, fontSize: 13, color: "#2a6a3a", border: "1px solid #b8d8c0", fontFamily: "Georgia, serif" }}>
            ✓ Surplus in FY{cur.year} — no new borrowing.
          </div>
        )}
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
            Debt pile: {pre1970Blocks + debtPileBlocks.length} blocks × $10B = {fmtAmt(pre1970Debt + cur.cumDebt)}
            {hoveredYear !== null && hoveredYear !== -1 && <span style={{ marginLeft: 12, color: GOLD, fontWeight: 600 }}>FY{hoveredYear}</span>}
            {hoveredYear === -1 && <span style={{ marginLeft: 12, color: MUTED, fontWeight: 600 }}>Pre-1970</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: GAP + "px" }}>
            {Array.from({ length: pre1970Blocks }).map(function (_, i) {
              var isHl = hoveredYear === null || hoveredYear === -1;
              return <div key={"pre" + i} onMouseEnter={function () { setHoveredYear(-1); }} onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#555", opacity: isHl ? 0.7 : 0.08, transition: "opacity 0.2s", cursor: "pointer" }} />;
            })}
            {debtPileBlocks.map(function (b, i) {
              var isHl = hoveredYear === null || hoveredYear === b.year;
              return <div key={i} onMouseEnter={function () { setHoveredYear(b.year); }} onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: yearColor(b.year), opacity: isHl ? 0.95 : 0.1, transition: "opacity 0.2s", cursor: "pointer" }} />;
            })}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Gray = pre-1970 debt. Colored = deficit-driven since 1970. Hover to see year.</div>
        </div>
        <div style={{ marginTop: 20, padding: "16px 20px", background: BG, borderRadius: 4, border: "1px solid " + BORDER }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 8, fontFamily: "Georgia, serif" }}>Debt Reconciliation — FY{cur.year}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 2, fontFamily: "system-ui, sans-serif" }}>
            {[
              { label: "Pre-1970 inherited debt", val: fmtAmt(pre1970Debt), color: MUTED },
              { label: "+ Cumulative deficits (1970–" + cur.year + ")", val: fmtAmt(cur.cumDebt), color: RED },
              { label: "+ Trust fund borrowing", val: fmtAmt(debtBreakdown.heldByGovt), color: MUTED },
            ].map(function (row) {
              return (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted " + BORDER, paddingBottom: 2 }}>
                  <span style={{ color: row.color }}>{row.label}</span><span style={{ color: TEXT }}>{row.val}</span>
                </div>
              );
            })}
            {Math.abs(otherAdjustments) > 1000 && (
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted " + BORDER, paddingBottom: 2 }}>
                <span>+ Other adjustments</span>
                <span style={{ color: TEXT }}>{otherAdjustments >= 0 ? "+" : "−"}{fmtAmt(otherAdjustments)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, marginTop: 2, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", fontSize: 13 }}>
              <span>= Gross Federal Debt</span><span>{fmtAmt(actualDebtThisYear)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Page 4: Net Interest Comparison ─── */
function NetInterestPage({ spendingData }) {
  var categories = useMemo(function () {
    if (!spendingData) return [];
    var cats = {};
    spendingData.filter(function (r) { return !String(r.category).includes("Real") && r.category !== "Net interest"; })
      .forEach(function (r) { cats[r.category] = true; });
    return Object.keys(cats).sort();
  }, [spendingData]);

  var _comp = useState("National Defense"); var compareCat = _comp[0]; var setCompareCat = _comp[1];
  var _yr = useState(0); var yearIdx = _yr[0]; var setYearIdx = _yr[1];

  var timeData = useMemo(function () {
    if (!spendingData) return [];
    var byYear = {};
    spendingData.filter(function (r) { return !String(r.category).includes("Real") && r.year >= 1970 && r.year <= 2024; })
      .forEach(function (r) {
        if (!byYear[r.year]) byYear[r.year] = {};
        byYear[r.year][r.category] = r.amount;
      });
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
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>The Rising Cost of Debt Service</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>Net interest is now one of the largest line items in the federal budget.</p>
      <Card style={{ borderLeft: "4px solid " + AMBER }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: MUTED }}>Compare with:</label>
          <select value={compareCat} onChange={function (e) { setCompareCat(e.target.value); }}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid " + BORDER, fontSize: 13, background: SURFACE, color: TEXT, cursor: "pointer" }}>
            {categories.map(function (c) { return <option key={c} value={c}>{SPEND_SHORT[c] || c}</option>; })}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: MUTED }}>1970</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif" }}>FY {cur.year}</span>
            <span style={{ fontSize: 13, color: MUTED }}>2024</span>
          </div>
          <input type="range" min={0} max={timeData.length - 1} value={yearIdx}
            onChange={function (e) { setYearIdx(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: AMBER, cursor: "grab" }} />
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          {[
            { label: "Net Interest", amt: interestAmt, blocks: interestBlocks, color: AMBER },
            { label: shortName, amt: compareAmt, blocks: compareBlocks, color: BLUE },
          ].map(function (s) {
            return (
              <div key={s.label} style={{ flex: "1 1 280px", minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: s.color }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: "Georgia, serif" }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{fmtAmt(s.amt)}</span>
                </div>
                <div style={{ display: "flex", gap: GAP, flexWrap: "wrap" }}>
                  {Array.from({ length: s.blocks }).map(function (_, i) {
                    return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: s.color, opacity: 0.9 }} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {interestAmt > compareAmt && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f8e8e0", borderRadius: 4, fontSize: 13, color: AMBER, border: "1px solid #d4b8a0", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
            <strong>Net interest exceeds {shortName}</strong> by {fmtAmt(interestAmt - compareAmt)} in FY{cur.year}.
          </div>
        )}
        {interestAmt <= compareAmt && compareAmt > 0 && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#e8eef8", borderRadius: 4, fontSize: 13, color: BLUE, border: "1px solid #b0c0d8", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
            In FY{cur.year}, {shortName} still exceeds net interest by {fmtAmt(compareAmt - interestAmt)}.
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Page 5: OBBBA ─── */
function ProjBar({ nBaseline, nObbba, nNoTariff, maxRows }) {
  var total      = nBaseline + nObbba + nNoTariff;
  var myRows     = Math.ceil(total / PROJ_COL_W);
  var padRows    = maxRows - myRows;
  var totalCells = maxRows * PROJ_COL_W;
  var emptyCells = padRows * PROJ_COL_W;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + PROJ_COL_W + ", " + PROJ_SZ + "px)", gap: PROJ_GAP + "px", width: PROJ_COL_W * (PROJ_SZ + PROJ_GAP) - PROJ_GAP, alignSelf: "flex-end" }}>
      {Array.from({ length: totalCells }).map(function (_, i) {
        if (i < emptyCells) return <div key={i} style={{ width: PROJ_SZ, height: PROJ_SZ }} />;
        var filled = i - emptyCells;
        var color = filled < nNoTariff ? C_NOTARIFF : filled < nNoTariff + nObbba ? C_OBBBA : C_JAN;
        return <div key={i} style={{ width: PROJ_SZ, height: PROJ_SZ, borderRadius: 1, backgroundColor: color }} />;
      })}
    </div>
  );
}

function ProjectionPanel({ years, baselineSeries, obbbaWithTariffSeries, obbbaNoTariffSeries }) {
  var _hov = useState(null); var hoveredYear = _hov[0]; var setHoveredYear = _hov[1];
  var base = baselineSeries || {}; var withTar = obbbaWithTariffSeries || {}; var noTar = obbbaNoTariffSeries || {};

  function fmt(v) { return v == null ? "—" : "$" + (v / 1000).toFixed(2) + "T"; }

  var maxRows = useMemo(function () {
    var m = 1;
    years.forEach(function (yr) {
      var rows = Math.ceil(Math.round((noTar[yr] || 0) / PROJ_BLOCK_B) / PROJ_COL_W);
      if (rows > m) m = rows;
    });
    return m;
  }, [years, noTar]);

  var colPx = PROJ_COL_W * (PROJ_SZ + PROJ_GAP) - PROJ_GAP;
  var tenYr = function (s) { return years.reduce(function (a, yr) { return a + ((s || {})[yr] || 0); }, 0); };

  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ color: C_JAN, label: "Pre-OBBBA (Jan 2025)" }, { color: C_OBBBA, label: "OBBBA w/ tariffs" }, { color: C_NOTARIFF, label: "OBBBA, tariffs struck down" }].map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
              <div style={{ width: PROJ_SZ + 2, height: PROJ_SZ + 2, borderRadius: 1, backgroundColor: l.color }} />{l.label}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2 }}>
        {years.map(function (yr) {
          var baseline = base[yr] || 0; var withTariff = withTar[yr] || 0; var noTariff = noTar[yr] || 0;
          var nBaseline = Math.round(baseline / PROJ_BLOCK_B);
          var nObbba = Math.max(Math.round(withTariff / PROJ_BLOCK_B) - nBaseline, 0);
          var nNoTariff = Math.max(Math.round(noTariff / PROJ_BLOCK_B) - nBaseline - nObbba, 0);
          var isHov = hoveredYear === yr;
          return (
            <div key={yr} onMouseEnter={function () { setHoveredYear(yr); }} onMouseLeave={function () { setHoveredYear(null); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", position: "relative", overflow: "visible" }}>
              {isHov && (
                <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, zIndex: 10, whiteSpace: "nowrap", fontSize: 11, textAlign: "center", lineHeight: 1.6, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 5, padding: "5px 9px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{yr}</div>
                  <div style={{ color: C_JAN }}>Baseline: {fmt(baseline)}</div>
                  <div style={{ color: C_OBBBA }}>w/ tariffs: {fmt(withTariff)}</div>
                  <div style={{ color: C_NOTARIFF }}>No tariffs: {fmt(noTariff)}</div>
                </div>
              )}
              <ProjBar nBaseline={nBaseline} nObbba={nObbba} nNoTariff={nNoTariff} maxRows={maxRows} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, textAlign: "center", width: colPx }}>{yr}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        {[{ label: "Pre-OBBBA 10yr", val: tenYr(base), bg: "#e8eef8", color: C_JAN },
          { label: "With tariffs 10yr", val: tenYr(withTar), bg: "#f8f2e0", color: C_OBBBA },
          { label: "No tariffs 10yr", val: tenYr(noTar), bg: "#f8ece8", color: C_NOTARIFF }].map(function (s) {
          return (
            <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 4, padding: "8px 12px", border: "1px solid " + BORDER }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2, fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: "Georgia, serif" }}>{fmt(s.val)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OBBBAPage({ deficitProj, niProj }) {
  var deficitSeries = useMemo(function () {
    if (!deficitProj) return {};
    var out = {};
    deficitProj.forEach(function (r) { if (!out[r.scenario]) out[r.scenario] = {}; out[r.scenario][r.year] = r.deficit_billions; });
    return out;
  }, [deficitProj]);

  var niSeries = useMemo(function () {
    if (!niProj) return {};
    var out = {};
    niProj.forEach(function (r) { if (!out[r.scenario]) out[r.scenario] = {}; out[r.scenario][r.year] = r.net_interest_billions; });
    return out;
  }, [niProj]);

  var years = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];
  var janDef = deficitSeries["jan_2025_baseline"] || {}; var febDef = deficitSeries["feb_2026_current_law"] || {}; var noTarDef = deficitSeries["no_tariff_revenue"] || {};
  var janNI = niSeries["jan_2025_baseline"] || {}; var febNI = niSeries["feb_2026_current_law"] || {};
  var noTarNI = {};
  years.forEach(function (yr) {
    var defGap = (febDef[yr] || 0) - (janDef[yr] || 0);
    var niGap = (febNI[yr] || 0) - (janNI[yr] || 0);
    var noTarGap = (noTarDef[yr] || 0) - (janDef[yr] || 0);
    noTarNI[yr] = (janNI[yr] || 0) + niGap * (defGap > 0 ? noTarGap / defGap : 1);
  });

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>The One Big Beautiful Bill Act</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 24px" }}>
        CBO's current law baseline includes ~$3.45T in new tariff revenue offsetting OBBBA's gross $4.7T cost. Each block = $10B. Hover a column for detail.
      </p>
      <Card style={{ borderLeft: "4px solid " + AMBER, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 16px" }}>Annual Deficits</h3>
        <ProjectionPanel years={years} baselineSeries={janDef} obbbaWithTariffSeries={febDef} obbbaNoTariffSeries={noTarDef} />
      </Card>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, fontFamily: "Georgia, serif", margin: "0 0 16px" }}>Net Interest Payments</h3>
        <ProjectionPanel years={years} baselineSeries={janNI} obbbaWithTariffSeries={febNI} obbbaNoTariffSeries={noTarNI} />
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Source: CBO February 2026 Budget Projections.</p>
    </div>
  );
}

/* ─── Page Shell & Navigation ─── */

var SLIDE_MS = 320;

function PageShell({ page, setPage, total, children, prompt }) {
  var _dir = useState(1); var dir = _dir[0]; var setDir = _dir[1];
  var _visible = useState(true); var visible = _visible[0]; var setVisible = _visible[1];
  var _displayed = useState(page); var displayed = _displayed[0]; var setDisplayed = _displayed[1];
  var _content = useState(children); var content = _content[0]; var setContent = _content[1];
  var pendingPage = useRef(null);

  function navigate(next) {
    if (next === page) return;
    var d = next > page ? 1 : -1;
    pendingPage.current = { next: next, d: d };
    setDir(d);
    setVisible(false);
  }

  useEffect(function () {
    if (!visible && pendingPage.current) {
      var t = setTimeout(function () {
        var p = pendingPage.current;
        pendingPage.current = null;
        setPage(p.next);
        setDisplayed(p.next);
        setVisible(true);
      }, SLIDE_MS);
      return function () { clearTimeout(t); };
    }
  }, [visible]);

  useEffect(function () {
    setContent(children);
  }, [page]);

  var translateOut = visible ? "translateY(0)" : (dir > 0 ? "translateY(-40px)" : "translateY(40px)");
  var translateIn  = visible ? "translateY(0)" : (dir > 0 ? "translateY(40px)"  : "translateY(-40px)");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, fontFamily: "Georgia, 'Times New Roman', serif", color: TEXT }}>

      {/* Nav bar */}
      <div style={{ background: TEXT, padding: "12px 28px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {page > 0 && (
          <button onClick={function () { navigate(page - 1); }}
            style={{ background: "none", border: "none", color: BG, fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1, opacity: 0.6 }}>←</button>
        )}
        <span style={{ fontSize: 13, fontWeight: 400, letterSpacing: 2, color: BG, flex: 1, textTransform: "uppercase" }}>Visualize Policy</span>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: "system-ui, sans-serif", letterSpacing: 0.5, opacity: 0.7 }}>Federal Budget Explorer</span>
      </div>

      {/* Content — animated */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "36px 28px 0",
        maxWidth: 1100, margin: "0 auto", width: "100%",
        transform: translateOut,
        opacity: visible ? 1 : 0,
        transition: "transform " + SLIDE_MS + "ms cubic-bezier(0.4,0,0.2,1), opacity " + SLIDE_MS + "ms ease",
      }}>
        {content}
      </div>

      {/* Prompt / next button */}
      <div style={{
        padding: "24px 28px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box",
        transform: translateOut,
        opacity: visible ? 1 : 0,
        transition: "transform " + SLIDE_MS + "ms cubic-bezier(0.4,0,0.2,1), opacity " + SLIDE_MS + "ms ease",
      }}>
        {prompt && page < total - 1 && (
          <button onClick={function () { navigate(page + 1); }}
            style={{ width: "100%", background: SURFACE, color: TEXT, border: "1px solid " + BORDER, borderRadius: 4, padding: "16px 24px", fontSize: 15, fontWeight: 400, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "Georgia, serif" }}>
            <span style={{ color: MUTED, fontStyle: "italic" }}>{prompt}</span>
            <span style={{ fontSize: 18, color: RED, opacity: 0.9 }}>↓</span>
          </button>
        )}
        {page === total - 1 && (
          <div style={{ textAlign: "center", fontSize: 12, color: MUTED, paddingBottom: 12, fontFamily: "system-ui, sans-serif", letterSpacing: 0.5 }}>
            End of tour · <a href="https://visualizepolicy.org" style={{ color: TEXT }}>Visualize Policy</a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  var spendingData = useCSV("spending_by_function.csv");
  var receiptsData = useCSV("receipts_by_source.csv");
  var summaryData  = useCSV("summary.csv");
  var debtData     = useCSV("federal_debt.csv");
  var deficitProj  = useCSV("projections_deficit.csv");
  var niProj       = useCSV("projections_net_interest.csv");

  var _p = useState(0); var page = _p[0]; var setPage = _p[1];

  var loading = !spendingData || !receiptsData || !summaryData || !debtData || !deficitProj || !niProj;

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 16, color: MUTED }}>
        Loading…
      </div>
    );
  }

  var pages = [
    <IntroPage />,
    <RevSpendPage spendingData={spendingData} receiptsData={receiptsData} summaryData={summaryData} />,
    <DeficitPage summaryData={summaryData} />,
    <DebtAccumulation summaryData={summaryData} debtData={debtData} />,
    <NetInterestPage spendingData={spendingData} />,
    <OBBBAPage deficitProj={deficitProj} niProj={niProj} />,
  ];

  return (
    <PageShell page={page} setPage={setPage} total={pages.length} prompt={PAGES[page].prompt}>
      {pages[page]}
    </PageShell>
  );
}
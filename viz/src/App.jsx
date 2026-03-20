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

// ── Clean light palette ──
var BG        = "#f8fafc";
var SURFACE   = "#ffffff";
var BORDER    = "#e5e7eb";
var TEXT      = "#111827";
var MUTED     = "#6b7280";
var GOLD      = "#d97706";
var AMBER     = "#d94801";
var RED       = "#8b0000";
var BLUE      = "#08519c";

var C_JAN      = "#6baed6";
var C_TCJA     = "#74c476";   // green — TCJA Extended, No OBBBA baseline
var C_OBBBA    = "#f0b429";
var C_NOTARIFF = "#d94801";

// ── Baseline configs — selected at runtime in App() via ?baseline= param ──
var BASELINE_CONFIGS = {
  jan: {
    scenario:     "jan_2025_baseline",
    color:        C_JAN,
    label:        "Pre-OBBBA (Jan 2025)",
    labelShort:   "Pre-OBBBA",
    tourBody:     "Blue is CBO's January 2025 baseline — the ten-year outlook before the OBBBA passed, assuming the 2017 TCJA tax cuts expired on schedule.",
    subtitleNote: "Blue baseline assumes TCJA tax cuts expire as originally scheduled (Jan 2025 CBO baseline).",
    bodyText:     "The newest budget bill, the One Big Beautiful Bill Act (OBBBA), was passed in July 2025. The OBBBA adds trillions to our debt over the next ten years. The combination of extending tax cuts from 2017 and massive increases in defense and border spending make it the most costly budget bill in history. The OBBBA's budgetary changes mean that we will continue running a deficit through 2034. President Trump's tariffs are supposed to offset some of the tax cuts. However, in February 2026 the Supreme Court struck them down, meaning the $3.45T in tariff revenue will have to be borrowed by the government and added to the debt.",
  },
  tcja: {
    scenario:     "tcja_extended_no_obbba",
    color:        C_TCJA,
    label:        "TCJA Extended, No OBBBA",
    labelShort:   "TCJA Only",
    tourBody:     "Green is a counterfactual baseline: TCJA tax cuts are extended permanently but none of the other OBBBA provisions (spending cuts, tips/overtime exemptions, defense spending) are enacted.",
    subtitleNote: "Green baseline assumes only the TCJA tax cuts are extended — no other OBBBA provisions.",
    bodyText:     "The One Big Beautiful Bill Act goes far beyond simply extending the 2017 TCJA tax cuts. Even assuming TCJA was already renewed, the OBBBA adds hundreds of billions more through new provisions: tips and overtime exemptions, expanded SALT deductions, defense and border spending increases, and more — partially offset by Medicaid cuts and IRA credit clawbacks.",
  },
};

var REV_COLORS = {
  "Individual Income Tax": "#08519c",
  "Payroll Taxes (FICA)":  "#3182bd",
  "Corporate Income Tax":  "#6baed6",
  Other:                   "#9ecae1",
  "Excise Taxes":          "#c6dbef",
};

var SPEND_COLORS = {
  "Social Security":   "#7f2704",
  Health:              "#a63603",
  "Net interest":      "#d94801",
  Medicare:            "#e6550d",
  "National Defense":  "#f16913",
  "Income Security":   "#fd8d3c",
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

var PAGES = [
  { prompt: "Let's look at where the money comes from — and where it goes." },
  { prompt: "The government spent $1.83 trillion more than it collected. What does that gap look like?" },
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
            <span style={{ color: TEXT }}>{s.label}</span>
            <span style={{ color: MUTED, marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{amt}</span>
          </div>
        );
      })}
    </div>
  );
}

function Card(props) {
  return (
    <div style={{ background: SURFACE, borderRadius: 10, border: "1px solid " + BORDER, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "24px 28px", ...(props.style || {}) }}>
      {props.children}
    </div>
  );
}

/* ─── Tour System ─── */

var TOUR_CONFIGS = {
  1: [
    { title: "Each block = $10 billion", body: "Every square represents $10 billion of government money. Blue blocks are revenue, orange blocks are spending." },
    { title: "Hover to highlight", body: "Move your mouse over any block to highlight that category across the grid and legend. Hover a legend item to do the same from the other direction." },
    { title: "Read the legend", body: "The legend below each grid lists every category with its total dollar amount. Categories are sorted largest to smallest." },
  ],
  3: [
    { title: "Drag the slider", body: "Scrub left and right to move through time. Each year you pass, that year's deficit gets added as new blocks to the pile below.", anchor: "slider" },
    { title: "The debt pile", body: "Each block here is $10B of accumulated debt. Lighter blocks are older debt; hover any block to see exactly which year it came from. Gray blocks are debt inherited from before 1970.", anchor: "pile" },
    { title: "Where does the debt come from?", body: "The highlighted box breaks the total into three pieces: (1) debt inherited from before 1970, (2) every annual deficit since 1970 added together, and (3) money the government has borrowed from its own trust funds — for example, surplus Social Security taxes collected over the years.", anchor: "reconciliation" },
    { title: "Why doesn't it add up exactly?", body: "Blocks round to the nearest $10B — small gaps from the official number are normal.", anchor: "slider" },
  ],
  4: [
    { title: "Compare any program", body: "Use the dropdown to select any government program. The block grids below will update to show net interest payments alongside your chosen program for that year." },
    { title: "Scrub through time", body: "Use the slider to move from 1970 to 2024 and see how both figures have changed over time. Compare how fast spending on interest has grown versus other categories." },
  ],
  5: [
    { title: "Three scenarios, three colors", body: "Each bar shows three possible futures. The bottom color is the pre-OBBBA baseline. Yellow is the current CBO baseline with OBBBA enacted, which assumes ~$3.45T in tariff revenue offsets much of the cost. Orange shows the picture if those tariffs are struck down or reversed." },
    { title: "Hover a year to dig in", body: "Mouse over any year column to see the exact deficit or interest figures for all three scenarios in that year." },
  ],
};

function Tour({ pageIndex, onDone, highlightAnchor }) {
  var steps = TOUR_CONFIGS[pageIndex];
  if (!steps) return null;

  var _step = useState(0); var step = _step[0]; var setStep = _step[1];
  var cur = steps[step];
  var isLast = step === steps.length - 1;
  var anchor = cur.anchor || null;

  useEffect(function() {
    if (highlightAnchor) highlightAnchor(anchor);
    return function() { if (highlightAnchor) highlightAnchor(null); };
  }, [anchor]);

  // Vertical anchor: slider→near top, pile→middle, reconciliation→lower, default→top
  var topMap = { slider: "100px", pile: "40%", reconciliation: "18%" };
  var topPos = topMap[anchor] || "100px";

  return (
    <div style={{
      position: "fixed",
      top: topPos,
      right: 20,
      zIndex: 1000,
      width: 240,
      transition: "top 0.35s cubic-bezier(0.4,0,0.2,1)",
      // Pointer events only on the card itself — background stays interactive
    }}>
      {/* Connector arrow pointing left toward the highlighted element */}
      <div style={{
        position: "absolute", left: -8, top: 20,
        width: 0, height: 0,
        borderTop: "7px solid transparent",
        borderBottom: "7px solid transparent",
        borderRight: "8px solid #e5e7eb",
      }} />
      <div style={{
        position: "absolute", left: -6, top: 21,
        width: 0, height: 0,
        borderTop: "6px solid transparent",
        borderBottom: "6px solid transparent",
        borderRight: "7px solid #fff",
        zIndex: 1,
      }} />
      <div style={{
        background: "#fff", borderRadius: 10, padding: "18px 20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
        border: "1px solid #e5e7eb",
        position: "relative",
      }}>
        {/* Step indicator + close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map(function(_, i) {
              return <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? "#1e3a5f" : "#e5e7eb", transition: "background 0.2s" }} />;
            })}
          </div>
          <button onClick={onDone} style={{
            background: "none", border: "none", fontSize: 15,
            color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 5 }}>{cur.title}</div>
        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.65, margin: "0 0 14px" }}>{cur.body}</p>

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {step > 0 && (
            <button onClick={function() { setStep(step - 1); }} style={{
              background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: "5px 12px", fontSize: 11, color: "#374151", cursor: "pointer",
            }}>Back</button>
          )}
          <button onClick={function() { isLast ? onDone() : setStep(step + 1); }} style={{
            background: "#1e3a5f", border: "none", borderRadius: 6,
            padding: "5px 14px", fontSize: 11, color: "#fff", cursor: "pointer", fontWeight: 600,
          }}>
            {isLast ? "Got it" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useTour(pageIndex) {
  var hasTour = !!TOUR_CONFIGS[pageIndex];
  var storageKey = "tour_done_" + pageIndex;
  var _show = useState(function() {
    return hasTour && !sessionStorage.getItem(storageKey);
  });
  var show = _show[0]; var setShow = _show[1];

  function done() {
    sessionStorage.setItem(storageKey, "1");
    setShow(false);
  }

  function reopen() { setShow(true); }

  return { show: show, done: done, reopen: reopen, hasTour: hasTour };
}

function IntroPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", maxWidth: 600 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24 }}>Visualize Policy</div>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: TEXT, lineHeight: 1.1, margin: "0 0 28px" }}>
        The Federal Budget
      </h1>
      <div style={{ width: 40, height: 2, background: RED, marginBottom: 28 }} />
      <p style={{ fontSize: 18, color: MUTED, lineHeight: 1.8, margin: 0 }}>
        Where does the government's money come from? Where does it go? And what happens when it spends more than it takes in?
      </p>
    </div>
  );
}

/* ─── Page 1: Revenue vs Spending ─── */
function RevSpendPage({ spendingData, receiptsData, summaryData }) {
  var _hov = useState(null); var hoveredCat = _hov[0]; var setHoveredCat = _hov[1];
  var tour = useTour(1);

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
      {tour.show && <Tour pageIndex={1} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Revenue vs. Spending — FY{YEAR}</h2>
        <button onClick={tour.reopen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Here are more detailed examples of the U.S. government's revenues and expenditures. In Fiscal Year (FY) 2024, the federal government's spending exceeds revenue by over $1.8 trillion. This means the government ran on a deficit for FY{YEAR}.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>Each block = $10B. Hover to highlight a category.</p>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: BLUE, margin: 0 }}>Revenue</h3>
            <span style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>${(computed.totalRev / 1e6).toFixed(2)}T</span>
          </div>
          <BlockGrid blocks={revBlocks} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
          <Legend sources={computed.revSources} hoveredCat={hoveredCat} setHoveredCat={setHoveredCat} />
        </Card>
        <Card style={{ flex: "1 1 400px", minWidth: 340 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: GOLD, margin: 0 }}>Spending</h3>
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
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>The Deficit — FY{YEAR}</h2>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        In FY2024, the U.S. government ran a budget deficit of $1.83 trillion. Each year that the government runs on a deficit, it adds to our national debt.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>Each block = $10B of borrowed money.</p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: RED, margin: 0 }}>The Deficit</h3>
          <span style={{ fontSize: 26, fontWeight: 800, color: RED }}>−${(Math.abs(deficit) / 1e6).toFixed(2)}T</span>
        </div>
        <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: "0 0 16px" }}>
          <strong style={{ color: RED }}>{deficitBlockCount} blocks</strong> of spending had no corresponding revenue — that's <strong style={{ color: RED }}>${((deficitBlockCount * BLOCK_SIZE) / 1e3 / 365).toFixed(1)}B per day</strong> added to the national debt.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ", " + SZ + "px)", gap: GAP + "px" }}>
          {Array.from({ length: deficitBlockCount }).map(function (_, i) {
            return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: RED, opacity: 0.8 }} />;
          })}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Each block = $10B of borrowed money</div>
      </Card>
    </div>
  );
}

/* ─── Page 3: Debt Accumulation ─── */
function DebtAccumulation({ summaryData, debtData }) {
  var tour = useTour(3);
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
  var _tourAnchor = useState(null); var tourAnchor = _tourAnchor[0]; var setTourAnchor = _tourAnchor[1];

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
      {tour.show && <Tour pageIndex={3} onDone={tour.done} highlightAnchor={setTourAnchor} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>How Deficits Become Debt</h2>
        <button onClick={tour.reopen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Our national debt has grown to over $39T as of 2026, up from $35.23T as of FY2024. The national debt is the sum of all of the borrowed money still owed by the government; each year we run a deficit, that is added on to the total debt. Use the tool below to see how the debt has risen.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>Drag the slider to scrub through time. Each block = $10B.</p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <div style={{ marginBottom: 20, borderRadius: 8, padding: tourAnchor === "slider" ? "10px 12px" : 0, outline: tourAnchor === "slider" ? "2px solid " + RED : "none", transition: "outline 0.2s, padding 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: MUTED }}>1970</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>FY {cur.year}</span>
            <span style={{ fontSize: 13, color: MUTED }}>2024</span>
          </div>
          <input type="range" min={0} max={yearData.length - 1} value={yearIdx}
            onChange={function (e) { setYearIdx(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: RED, cursor: "grab" }} />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { label: "Revenue", val: cur.receipts, bg: "#f0f9ff", color: BLUE },
            { label: "Spending", val: cur.outlays, bg: "#fff7ed", color: AMBER },
            { label: cur.deficit >= 0 ? "Surplus" : "Deficit", val: cur.deficit, bg: "#fef2f2", color: cur.deficit >= 0 ? "#16a34a" : RED, prefix: cur.deficit >= 0 ? "+" : "−" },
            { label: "Gross Federal Debt", val: actualDebtThisYear, bg: "#fce4ec", color: "#4a0000" },
          ].map(function (s) {
            return (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: "10px 16px", flex: "1 1 120px" }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.prefix || ""}{fmtAmt(s.val)}</div>
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
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>▼ Added to the debt pile below</div>          </div>
        )}
        {cur.deficit >= 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f0fdf4", borderRadius: 6, fontSize: 13, color: "#16a34a" }}>
            ✓ Surplus in FY{cur.year} — no new borrowing.
          </div>
        )}
        <div style={{ borderRadius: 8, padding: tourAnchor === "pile" ? "10px 12px" : 0, outline: tourAnchor === "pile" ? "2px solid " + RED : "none", transition: "outline 0.2s, padding 0.2s" }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
            Debt pile: {pre1970Blocks + debtPileBlocks.length} blocks × $10B = {fmtAmt(pre1970Debt + cur.cumDebt)}
            {hoveredYear !== null && hoveredYear !== -1 && <span style={{ marginLeft: 12, color: RED, fontWeight: 600 }}>FY{hoveredYear}</span>}
            {hoveredYear === -1 && <span style={{ marginLeft: 12, color: MUTED, fontWeight: 600 }}>Pre-1970</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: GAP + "px" }}>
            {Array.from({ length: pre1970Blocks }).map(function (_, i) {
              var isHl = hoveredYear === null || hoveredYear === -1;
              return <div key={"pre" + i} onMouseEnter={function () { setHoveredYear(-1); }} onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: "#9ca3af", opacity: isHl ? 0.7 : 0.1, transition: "opacity 0.2s", cursor: "pointer" }} />;
            })}
            {debtPileBlocks.map(function (b, i) {
              var isHl = hoveredYear === null || hoveredYear === b.year;
              return <div key={i} onMouseEnter={function () { setHoveredYear(b.year); }} onMouseLeave={function () { setHoveredYear(null); }}
                style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: yearColor(b.year), opacity: isHl ? 0.95 : 0.15, transition: "opacity 0.2s", cursor: "pointer" }} />;
            })}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Gray = pre-1970 debt. Colored = deficit-driven since 1970. Hover to see year.</div>
        </div>
        <div style={{ marginTop: 20, padding: "12px 16px", background: tourAnchor === "reconciliation" ? "#fff7ed" : "#f9fafb", borderRadius: 8, border: "1px solid " + (tourAnchor === "reconciliation" ? RED : BORDER), outline: tourAnchor === "reconciliation" ? "2px solid " + RED : "none", transition: "all 0.2s" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Debt Reconciliation — FY{cur.year}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {[
              { label: "Pre-1970 inherited debt", val: fmtAmt(pre1970Debt), color: MUTED },
              { label: "+ Cumulative deficits (1970–" + cur.year + ")", val: fmtAmt(cur.cumDebt), color: RED },
              { label: "+ Trust fund borrowing", val: fmtAmt(debtBreakdown.heldByGovt), color: MUTED },
            ].map(function (row) {
              return (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: row.color }}>{row.label}</span><span style={{ color: TEXT }}>{row.val}</span>
                </div>
              );
            })}
            {Math.abs(otherAdjustments) > 1000 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>+ Other adjustments</span>
                <span style={{ color: TEXT }}>{otherAdjustments >= 0 ? "+" : "−"}{fmtAmt(otherAdjustments)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid " + BORDER, paddingTop: 4, marginTop: 4, fontWeight: 700, color: "#4a0000" }}>
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
  var tour = useTour(4);
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
      {tour.show && <Tour pageIndex={4} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The Rising Cost of Debt Service</h2>
        <button onClick={tour.reopen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        As of 2024, net interest payments have reached $880B by themselves. This means interest payments alone are more costly than almost every important government program — including Medicare, national defense, and education.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>Select a program below to compare.</p>
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
            <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>FY {cur.year}</span>
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
                    <span style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.label}</span>
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
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", borderRadius: 6, fontSize: 13, color: RED }}>
            <strong>Net interest exceeds {shortName}</strong> by {fmtAmt(interestAmt - compareAmt)} in FY{cur.year}.
          </div>
        )}
        {interestAmt <= compareAmt && compareAmt > 0 && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0f9ff", borderRadius: 6, fontSize: 13, color: BLUE }}>
            In FY{cur.year}, {shortName} still exceeds net interest by {fmtAmt(compareAmt - interestAmt)}.
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Page 5: OBBBA ─── */
function ProjBar({ nBaseline, nObbba, nNoTariff, maxRows, cfg }) {
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
        var color = filled < nNoTariff ? C_NOTARIFF : filled < nNoTariff + nObbba ? C_OBBBA : cfg.color;
        return <div key={i} style={{ width: PROJ_SZ, height: PROJ_SZ, borderRadius: 1, backgroundColor: color }} />;
      })}
    </div>
  );
}

function ProjectionPanel({ years, baselineSeries, obbbaWithTariffSeries, obbbaNoTariffSeries, cfg }) {
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
        {[
          { color: cfg.color, label: cfg.label },
          { color: C_OBBBA,    label: "OBBBA w/ tariffs" },
          { color: C_NOTARIFF, label: "OBBBA, tariffs struck down" },
        ].map(function (l) {
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
                  <div style={{ color: cfg.color }}>{cfg.labelShort}: {fmt(baseline)}</div>
                  <div style={{ color: C_OBBBA }}>w/ tariffs: {fmt(withTariff)}</div>
                  <div style={{ color: C_NOTARIFF }}>No tariffs: {fmt(noTariff)}</div>
                </div>
              )}
              <ProjBar nBaseline={nBaseline} nObbba={nObbba} nNoTariff={nNoTariff} maxRows={maxRows} cfg={cfg} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, textAlign: "center", width: colPx }}>{yr}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        {[
          { label: cfg.labelShort + " 10yr", val: tenYr(base),    bg: "#f0f9ff", color: cfg.color },
          { label: "With tariffs 10yr",                  val: tenYr(withTar), bg: "#fffbeb", color: C_OBBBA },
          { label: "No tariffs 10yr",                    val: tenYr(noTar),   bg: "#fef2f2", color: C_NOTARIFF },
        ].map(function (s) {
          return (
            <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{fmt(s.val)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OBBBAPage({ deficitProj, niProj }) {
  var cfg = BASELINE_CONFIGS[(new URLSearchParams(window.location.search).get("baseline") || "jan") === "tcja" ? "tcja" : "jan"];
  var tour = useTour(5);
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

  // Baseline series swaps based on query param
  var baseDef = deficitSeries[cfg.scenario] || {};
  var baseNI  = niSeries[cfg.scenario] || {};
  var febDef  = deficitSeries["feb_2026_current_law"] || {};
  var febNI   = niSeries["feb_2026_current_law"] || {};
  var noTarDef = deficitSeries["no_tariff_revenue"] || {};

  // Derive no-tariff NI using same proportional method as existing code
  var noTarNI = {};
  years.forEach(function (yr) {
    var defGap   = (febDef[yr] || 0) - (baseDef[yr] || 0);
    var niGap    = (febNI[yr]  || 0) - (baseNI[yr]  || 0);
    var noTarGap = (noTarDef[yr] || 0) - (baseDef[yr] || 0);
    noTarNI[yr] = (baseNI[yr] || 0) + niGap * (defGap > 0 ? noTarGap / defGap : 1);
  });



  return (
    <div>
      {tour.show && <Tour pageIndex={5} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The One Big Beautiful Bill Act</h2>
        <button onClick={tour.reopen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        {cfg.bodyText}
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px" }}>
        Each block = $10B. Hover a column for detail.
      </p>
      <Card style={{ borderLeft: "4px solid " + AMBER, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Annual Deficits</h3>
        <ProjectionPanel years={years} baselineSeries={baseDef} obbbaWithTariffSeries={febDef} obbbaNoTariffSeries={noTarDef} cfg={cfg} />
      </Card>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        Higher deficits mean that over the course of the next 10 years, the government will have to pay even more interest on a growing pile of debt. Without tariffs, more than $3T extra in taxpayer dollars will go to debt payments over the next decade.
      </p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Net Interest Payments</h3>
        <ProjectionPanel years={years} baselineSeries={baseNI} obbbaWithTariffSeries={febNI} obbbaNoTariffSeries={noTarNI} cfg={cfg} />
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Source: CBO February 2026 Budget Projections; CBO July 2025 OBBBA Cost Estimate (P.L. 119-21).</p>
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, fontFamily: "'Segoe UI', system-ui, sans-serif", color: TEXT }}>

      {/* Nav bar */}
      <div style={{ background: "#1e3a5f", padding: "12px 28px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {page > 0 && (
          <button onClick={function () { navigate(page - 1); }}
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>←</button>
        )}
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3, color: "#fff", flex: 1 }}>Visualize Policy</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Federal Budget Explorer</span>
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
            style={{ width: "100%", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "16px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{prompt}</span>
            <span style={{ fontSize: 20, opacity: 0.7 }}>↓</span>
          </button>
        )}
        {page === total - 1 && (
          <div style={{ textAlign: "center", fontSize: 13, color: MUTED, paddingBottom: 12 }}>
            End of tour · <a href="https://visualizepolicy.org" style={{ color: "#1e3a5f" }}>Visualize Policy</a>
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
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 16, color: MUTED }}>
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
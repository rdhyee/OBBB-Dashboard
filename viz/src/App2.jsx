import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";

// ─────────────────────────────────────────────
// BLOCK / GRID CONSTANTS
// ─────────────────────────────────────────────
var BLOCK_SIZE   = 10000;   // $10B per block (OMB historical, millions)
var YEAR         = 2024;    // current snapshot year
var COLS         = 22;
var SZ           = 12;
var GAP          = 2;

var PROJ_BLOCK_B = 10;      // $10B per block (CBO projections, billions)
var PROJ_SZ      = 7;
var PROJ_GAP     = 1;
var PROJ_COL_W   = 10;

// ─────────────────────────────────────────────
// DESIGN TOKENS  (identical to App.jsx)
// ─────────────────────────────────────────────
var BG      = "#f8fafc";
var SURFACE = "#ffffff";
var BORDER  = "#e5e7eb";
var TEXT    = "#111827";
var MUTED   = "#6b7280";
var GOLD    = "#d97706";
var AMBER   = "#d94801";
var RED     = "#8b0000";
var BLUE    = "#08519c";

// Projection scenario colors
var C_JAN      = "#6baed6";   // Scenario 1 — Jan 2025 baseline (TCJA expiring)
var C_TCJA     = "#2ca02c";   // Scenario 2 — TCJA extended, no other OBBBA
var C_OBBBA    = "#f0b429";   // Scenario 3 — OBBBA w/ tariffs
var C_NOTARIFF = "#d94801";   // Scenario 4 — OBBBA, tariffs struck down

// Section accent colors
var S1_COLOR = "#1e3a5f";   // Section I  — How Did We Get Here
var S2_COLOR = "#7f2704";   // Section II — Where Are We Going
var S3_COLOR = "#374151";   // Section III — What Are the Consequences

// ─────────────────────────────────────────────
// REVENUE / SPENDING COLOR MAPS  (from App.jsx)
// ─────────────────────────────────────────────
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
  "Veterans Benefits and Services":                            "#fdae6b",
  "Education, Training, Employment, and Social Services":      "#fdd0a2",
};
var SPEND_OTHER_COLOR = "#fee6ce";

var SPEND_SHORT = {
  "Social Security":      "Social Security",
  Health:                 "Health (Medicaid/ACA)",
  "Net interest":         "Net Interest",
  Medicare:               "Medicare",
  "National Defense":     "National Defense",
  "Income Security":      "Income Security",
  "Veterans Benefits and Services":                            "Veterans",
  "Education, Training, Employment, and Social Services":      "Education & Training",
};

// ─────────────────────────────────────────────
// SECTION + PAGE MANIFEST
//
// Each entry is one page.  The `section` field
// drives the section banner in the nav bar.
// `prompt` is the forward-navigation button text.
// ─────────────────────────────────────────────
var SECTIONS = [
  { id: 0, label: "I. How Did We Get Here?",        color: S1_COLOR },
  { id: 1, label: "II. Where Are We Going?",         color: S2_COLOR },
  { id: 2, label: "III. What Are the Consequences?", color: S3_COLOR },
];

var PAGES = [
  // ── Landing ────────────────────────────────────────────────────
  {
    section: null,
    component: "IntroPage",
    prompt: "Let's start with history — how did we get here?",
  },

  // ── Section I: How Did We Get Here? ────────────────────────────
  {
    section: 0,
    component: "DeficitHistoryPage",   // I.a  — FRED FYFSGDA188S block viz
    title: "A History of Deficits",
    prompt: "So how do annual deficits turn into debt?",
  },
  {
    section: 0,
    component: "DebtAccumulation",     // I.b  — repurposed from App.jsx page 3
    title: "How Deficits Become Debt",
    prompt: "How far back does that debt go?",
  },
  {
    section: 0,
    component: "DebtToGDPPage",        // I.c  — debt-to-GDP time series
    title: "Debt as a Share of the Economy",
    prompt: "What changed the trajectory along the way?",
  },
  {
    section: 0,
    component: "ObamaEraPage",         // I.d  — decomposition of Obama-era deficits
    title: "The Obama Years: Automatic Stabilizers vs. Policy",
    prompt: "Now let's look at where things are heading.",
  },

  // ── Section II: Where Are We Going? ────────────────────────────
  {
    section: 1,
    component: "RevSpendPage",         // II.a — repurposed from App.jsx page 1, with per-capita punchline
    title: "Revenue vs. Spending — FY2024",
    prompt: "What does the annual gap look like in blocks?",
  },
  {
    section: 1,
    component: "DeficitPage",          // II.b — repurposed from App.jsx page 2
    title: "The Deficit — FY2024",
    prompt: "And how does that pile up over the next decade?",
  },
  {
    section: 1,
    component: "ProjectedDebtPage",    // II.c — projected debt/deficit block viz, scenario toggle
    title: "Projected Deficits & Debt",
    prompt: "What changes with the One Big Beautiful Bill Act?",
  },
  {
    section: 1,
    component: "OBBBAPage",            // II.d — repurposed from App.jsx page 5, 4-scenario
    title: "The One Big Beautiful Bill Act",
    prompt: "What are the real-world consequences of all this?",
  },

  // ── Section III: What Are the Consequences? ────────────────────
  {
    section: 2,
    component: "CrowdingOutPage",      // III.a — are we stealing from our children?
    title: "Are We Stealing from Our Children?",
    prompt: "One direct consequence is the rising cost of interest.",
  },
  {
    section: 2,
    component: "NetInterestPage",      // III.b.i — repurposed from App.jsx page 4
    title: "The Rising Cost of Debt Service",
    prompt: "What choices does that leave for the budget?",
  },
  {
    section: 2,
    component: "BudgetDilemmaPage",    // III.b.ii — spending vs. taxes dilemma
    title: "The Budget Dilemma",
    prompt: "Deficits also shape our trade relationships.",
  },
  {
    section: 2,
    component: "TradeDeficitPage",     // III.b.iii — current account deficit time series
    title: "The Trade Deficit Connection",
    prompt: null,  // last page
  },
];

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────
function Card(props) {
  return (
    <div style={{
      background: SURFACE, borderRadius: 10,
      border: "1px solid " + BORDER,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      padding: "24px 28px",
      ...(props.style || {}),
    }}>
      {props.children}
    </div>
  );
}

function BlockGrid({ blocks, hoveredCat, setHoveredCat }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ", " + SZ + "px)", gap: GAP + "px" }}>
      {blocks.map(function (b, i) {
        var hl = hoveredCat === null || hoveredCat === b.name;
        return (
          <div key={i}
            onMouseEnter={function () { setHoveredCat(b.name); }}
            onMouseLeave={function () { setHoveredCat(null); }}
            style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: b.color, opacity: hl ? 1 : 0.12, transition: "opacity 0.2s", cursor: "pointer" }}
          />
        );
      })}
    </div>
  );
}

function Legend({ sources, hoveredCat, setHoveredCat }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
      {sources.map(function (s) {
        var isActive = hoveredCat === null || hoveredCat === s.label;
        var amt = s.amount >= 1e6
          ? "$" + (s.amount / 1e6).toFixed(2) + "T"
          : "$" + Math.round(s.amount / 1e3) + "B";
        return (
          <div key={s.label}
            onMouseEnter={function () { setHoveredCat(s.label); }}
            onMouseLeave={function () { setHoveredCat(null); }}
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

// ─────────────────────────────────────────────
// TOUR SYSTEM
// ─────────────────────────────────────────────

// Tour steps are keyed by page index in PAGES array.
// Add entries here as each page is built out.
var TOUR_CONFIGS = {
  // Page 1 — Deficit History
  1: [
    { title: "Each block = 0.5% of GDP", body: "Every square represents 0.5% of gross domestic product. Blue blocks are surpluses, red blocks are deficits." },
    { title: "Height shows severity", body: "Taller columns mean larger deficits or surpluses relative to the economy. WWII and COVID-era columns are deliberately capped to keep the chart readable." },
    { title: "Hover any column", body: "Mouse over a year to see the exact surplus or deficit figure and the era label." },
  ],
  // Page 3 — Debt to GDP
  3: [
    { title: "Scroll left and right", body: "The chart spans 85 years — scroll horizontally to move through time from 1939 to the present." },
    { title: "Each block = 0.5% of GDP", body: "Deeper columns mean more debt relative to the size of the economy." },
    { title: "Hover any column", body: "Mouse over a year to see the exact debt level and which president was in office." },
  ],
  // Page 4 — Obama Era / Automatic Stabilizers
  4: [
    { title: "Two components of the deficit", body: "Each column is split into two parts: the structural deficit (what would exist even at full employment) and the automatic stabilizer contribution (the recession-driven portion)." },
    { title: "Automatic stabilizers", body: "When the economy slows, tax revenues fall automatically and safety-net spending rises — without any new legislation. These are automatic stabilizers, and they temporarily inflate the deficit." },
    { title: "Hover for detail", body: "Mouse over any year to see the exact structural deficit and automatic stabilizer contribution for that year." },
  ],
  // Page 5 — Revenue vs Spending (II.a)
  5: [
    { title: "Each block = $10 billion", body: "Every square represents $10 billion of government money. Blue blocks are revenue, orange blocks are spending." },
    { title: "Hover to highlight", body: "Move your mouse over any block to highlight that category across the grid and legend." },
    { title: "Read the legend", body: "The legend below each grid lists every category with its total. Categories are sorted largest to smallest." },
  ],
  // Page 7 — Projected Deficits & Debt
  7: [
    { title: "Two panels, one story", body: "The top panel shows each year's projected deficit as a column of blocks. The bottom panel shows how those deficits accumulate into the national debt pile." },
    { title: "Toggle the scenario", body: "Use the buttons at the top to switch between a scenario where tariff revenues are maintained and one where they are struck down — and see how the outlook changes." },
    { title: "Hover for detail", body: "Mouse over any year's column to highlight those blocks in the debt pile below and see the exact deficit and cumulative debt figures." },
  ],
  // Page 8 — OBBBA
  8: [
    { title: "Three scenarios, three colors", body: "Each bar shows three possible futures. Blue is CBO's projections of the next ten years before the bill passed. Yellow is the current CBO baseline with OBBBA enacted, which assumes ~$3.45T in tariff income offset much of the costs. Orange shows the picture if those tariffs are struck down or reversed." },
    { title: "Hover a year to dig in", body: "Mouse over any year column to see the exact deficit or interest figures for all three scenarios in that year." },
  ],
  // Page 9 — Crowding Out (III.a) — placeholder
  9: [
    { title: "The crowding-out mechanism", body: "When the government borrows heavily it competes with private borrowers for available savings, tending to push interest rates higher." },
  ],
};

function Tour({ pageIndex, onDone }) {
  var steps = TOUR_CONFIGS[pageIndex];
  if (!steps) return null;

  var _step = useState(0); var step = _step[0]; var setStep = _step[1];
  var cur = steps[step];
  var isLast = step === steps.length - 1;

  function handleBackdrop(e) { if (e.target === e.currentTarget) onDone(); }

  return (
    <div onClick={handleBackdrop} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: 64,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "24px 28px",
        maxWidth: 420, width: "calc(100% - 48px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        position: "relative",
      }}>
        <button onClick={onDone} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
          Step {step + 1} of {steps.length}
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
          {steps.map(function (_, i) {
            return <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? "#1e3a5f" : "#e5e7eb" }} />;
          })}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{cur.title}</div>
        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, margin: "0 0 20px" }}>{cur.body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {step > 0 && (
            <button onClick={function () { setStep(step - 1); }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "8px 18px", fontSize: 13, color: "#374151", cursor: "pointer" }}>Back</button>
          )}
          <button onClick={function () { isLast ? onDone() : setStep(step + 1); }} style={{ background: "#1e3a5f", border: "none", borderRadius: 7, padding: "8px 20px", fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            {isLast ? "Got it" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useTour(pageIndex) {
  var hasTour = !!TOUR_CONFIGS[pageIndex];
  var storageKey = "tour2_done_" + pageIndex;  // "tour2_" prefix avoids collisions with App.jsx
  var _show = useState(function () {
    return hasTour && !sessionStorage.getItem(storageKey);
  });
  var show = _show[0]; var setShow = _show[1];
  function done()   { sessionStorage.setItem(storageKey, "1"); setShow(false); }
  function reopen() { setShow(true); }
  return { show: show, done: done, reopen: reopen, hasTour: hasTour };
}

// Reusable tour-trigger button used in page headers
function TourBtn({ onOpen }) {
  return (
    <button onClick={onOpen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
  );
}

// ─────────────────────────────────────────────
// PAGE COMPONENTS
// ─────────────────────────────────────────────

/* ── Landing ──────────────────────────────── */
function IntroPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", maxWidth: 600 }}>
      <div style={{ fontSize: 11, fontWeight: 400, color: MUTED, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24, fontFamily: "Georgia, serif" }}>Visualize Policy</div>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: TEXT, lineHeight: 1.1, margin: "0 0 28px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        The Federal Budget
      </h1>
      <div style={{ width: 40, height: 2, background: RED, marginBottom: 28 }} />
      <p style={{ fontSize: 18, color: MUTED, lineHeight: 1.8, margin: "0 0 32px", fontFamily: "Georgia, serif" }}>
        Where does the government's money come from? Where does it go? And what happens when it consistently spends more than it takes in?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTIONS.map(function (s) {
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: MUTED }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── I.a  Deficit History ─────────────────── */

// 1 block = 0.5% of GDP
var DEFICIT_BLOCK_PCT = 0.5;
var XAXIS_H = 24;  // px reserved for the permanent year label row at top

// Presidential era bands — Hoover onwards, party drives band color
var ERAS = [
  { label: "Hoover",     start: 1929, end: 1932, party: "R", color: "#ef444414" },
  { label: "FDR",        start: 1933, end: 1945, party: "D", color: "#3b82f614" },
  { label: "Truman",     start: 1946, end: 1952, party: "D", color: "#3b82f614" },
  { label: "Eisenhower", start: 1953, end: 1960, party: "R", color: "#ef444414" },
  { label: "Kennedy",    start: 1961, end: 1963, party: "D", color: "#3b82f614" },
  { label: "LBJ",        start: 1964, end: 1968, party: "D", color: "#3b82f614" },
  { label: "Nixon",      start: 1969, end: 1974, party: "R", color: "#ef444414" },
  { label: "Ford",       start: 1975, end: 1976, party: "R", color: "#ef444414" },
  { label: "Carter",     start: 1977, end: 1980, party: "D", color: "#3b82f614" },
  { label: "Reagan",     start: 1981, end: 1988, party: "R", color: "#ef444414" },
  { label: "Bush Sr.",   start: 1989, end: 1992, party: "R", color: "#ef444414" },
  { label: "Clinton",    start: 1993, end: 2000, party: "D", color: "#3b82f614" },
  { label: "Bush Jr.",   start: 2001, end: 2008, party: "R", color: "#ef444414" },
  { label: "Obama",      start: 2009, end: 2016, party: "D", color: "#3b82f614" },
  { label: "Trump",      start: 2017, end: 2020, party: "R", color: "#ef444414" },
  { label: "Biden",      start: 2021, end: 2024, party: "D", color: "#3b82f614" },
  { label: "Trump",      start: 2025, end: 2025, party: "R", color: "#ef444414" },
];

function deficitBarColor(val) {
  if (val >= 0) return BLUE;
  var abs = Math.abs(val);
  if (abs >= 3) return RED;
  return "#c0392b";
}

// Column width breakpoints — fewer years = wider columns
function colWidthForCount(n) {
  if (n <= 30)  return 18;
  if (n <= 55)  return 13;
  if (n <= 75)  return 10;
  return 8;
}

function DeficitHistoryViz({ data }) {
  var _hov    = useState(null);  var hovYear   = _hov[0];    var setHovYear   = _hov[1];

  var filtered = useMemo(function () {
    return data.filter(function (r) { return r.year >= 1929; });
  }, [data]);

  // Column sizing — recalculated whenever the year range changes
  var colSz  = colWidthForCount(filtered.length);   // block face size in px
  var colGap = Math.max(1, Math.round(colSz * 0.15));
  var CELL   = colSz + colGap;
  var totalW = filtered.length * CELL;

  var maxAbs = useMemo(function () {
    return Math.max.apply(null, filtered.map(function (r) { return Math.abs(r.deficit_pct_gdp); }));
  }, [filtered]);

  var maxSurplus = useMemo(function () {
    var surs = filtered.filter(function (r) { return r.deficit_pct_gdp > 0; });
    return surs.length ? Math.max.apply(null, surs.map(function (r) { return r.deficit_pct_gdp; })) : 0;
  }, [filtered]);

  var maxDefBlocks = Math.ceil(maxAbs / DEFICIT_BLOCK_PCT);
  var maxSurBlocks = Math.ceil(Math.max(maxSurplus, 0.5) / DEFICIT_BLOCK_PCT);
  var chartH = (maxDefBlocks + maxSurBlocks) * CELL;
  var zeroY  = maxSurBlocks * CELL;

  // Era rects — clipped to visible years, keyed per column position
  var eraByYear = useMemo(function () {
    var map = {};
    ERAS.forEach(function (era) {
      filtered.forEach(function (r) {
        if (r.year >= era.start && r.year <= era.end) {
          map[r.year] = { label: era.label, party: era.party, color: era.color };
        }
      });
    });
    return map;
  }, [filtered]);

  // Compute contiguous era bands for background rendering
  var eraBands = useMemo(function () {
    var bands = []; var cur = null;
    filtered.forEach(function (r, i) {
      var e = eraByYear[r.year];
      if (!e) return;
      if (!cur || cur.label !== e.label || cur.party !== e.party) {
        if (cur) bands.push(cur);
        cur = { label: e.label, party: e.party, color: e.color, x: i * CELL, w: CELL, startYear: r.year, endYear: r.year };
      } else {
        cur.w += CELL;
        cur.endYear = r.year;
      }
    });
    if (cur) bands.push(cur);
    return bands;
  }, [filtered, eraByYear, CELL]);

  // Find which president the hovered year belongs to
  var hovRow = hovYear != null ? filtered.find(function (r) { return r.year === hovYear; }) : null;
  var hovEra = hovYear != null ? eraByYear[hovYear] : null;

  return (
    <div>
      {/* Hover callout — year, value, president */}
      <div style={{ minHeight: 36, marginBottom: 8 }}>
        {hovRow ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{hovRow.year}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: deficitBarColor(hovRow.deficit_pct_gdp) }}>
              {hovRow.deficit_pct_gdp >= 0 ? "+" : ""}{hovRow.deficit_pct_gdp.toFixed(2)}% of GDP
            </span>
            <span style={{ fontSize: 13, color: MUTED }}>
              {hovRow.deficit_pct_gdp >= 0 ? "surplus" : "deficit"}
            </span>
            {hovEra && (
              <span style={{
                fontSize: 16, color: hovEra.party === "D" ? "#1d4ed8" : "#b91c1c",
                fontWeight: 600, marginLeft: 4,
              }}>
                {hovEra.label}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: MUTED }}>Hover any column for details</span>
        )}
      </div>

      {/* Scrollable chart */}
      <div style={{ overflowX: "auto", overflowY: "visible" }}>
        <div style={{ position: "relative", width: totalW, height: XAXIS_H + chartH + 4, flexShrink: 0 }}>

          {/* X-axis year labels — permanent row at top */}
          {filtered.map(function (row, i) {
            var showTick = filtered.length <= 55 ? row.year % 5 === 0 : row.year % 10 === 0;
            if (!showTick) return null;
            return (
              <div key={"tick-" + row.year} style={{
                position: "absolute",
                left: i * CELL, top: 0,
                width: colSz, height: XAXIS_H,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 4,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: MUTED,
                  whiteSpace: "nowrap",
                }}>{row.year}</span>
              </div>
            );
          })}

          {/* Era background bands — shifted down by XAXIS_H */}
          {eraBands.map(function (band) {
            return (
              <div key={band.label + band.startYear} style={{
                position: "absolute",
                left: band.x, top: XAXIS_H,
                width: band.w, height: chartH,
                background: band.color,
                borderLeft: "1px solid " + BORDER + "44",
              }} />
            );
          })}

          {/* Zero line */}
          <div style={{
            position: "absolute", left: 0, top: XAXIS_H + zeroY,
            width: totalW, height: 2,
            background: "#9ca3af", zIndex: 1,
          }} />

          {/* Year columns */}
          {filtered.map(function (row, i) {
            var val       = row.deficit_pct_gdp;
            var blocks    = Math.max(1, Math.round(Math.abs(val) / DEFICIT_BLOCK_PCT));
            var color     = deficitBarColor(val);
            var isSurplus = val >= 0;
            var isHov     = hovYear === row.year;
            var x         = i * CELL;

            return (
              <div key={row.year}
                onMouseEnter={function () { setHovYear(row.year); }}
                onMouseLeave={function () { setHovYear(null); }}
                style={{
                  position: "absolute", left: x, top: XAXIS_H,
                  width: colSz, height: chartH,
                  zIndex: 2, cursor: "default",
                }}>
                {Array.from({ length: blocks }).map(function (_, b) {
                  var top = isSurplus
                    ? zeroY - (b + 1) * CELL
                    : zeroY + 2 + b * CELL;
                  return (
                    <div key={b} style={{
                      position: "absolute", left: 0, top: top,
                      width: colSz, height: colSz,
                      borderRadius: Math.max(1, Math.round(colSz * 0.15)),
                      backgroundColor: color,
                      opacity: isHov ? 1 : 0.82,
                      transition: "opacity 0.1s",
                    }} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: BLUE,      label: "Surplus" },
          { color: "#c0392b", label: "Deficit < 3% GDP" },
          { color: RED,       label: "Deficit ≥ 3% GDP" },
        ].map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: MUTED }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
              {l.label}
            </div>
          );
        })}
        <span style={{ fontSize: 11, color: MUTED }}>· Each block = 0.5% of GDP · Hover a column for president</span>
      </div>
    </div>
  );
}

function DeficitHistoryPage({ deficitData }) {
  var tour = useTour(1);
  return (
    <div>
      {tour.show && <Tour pageIndex={1} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>A History of Deficits</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        The United States has run a deficit in most years of its history — but the size of those deficits relative to the economy has varied enormously. Wars, recessions, and policy choices have all left their mark on the fiscal record.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>Each block = 0.5% of GDP. Blue columns rise above the line for surplus years; red columns fall below for deficits.</p>
      <Card style={{ borderLeft: "4px solid " + RED, overflowX: "auto" }}>
        {deficitData
          ? <DeficitHistoryViz data={deficitData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: FRED series FYFSGDA188S.</p>
    </div>
  );
}

/* ── I.b  Debt Accumulation ──────────────── */
// Ported directly from App.jsx DebtAccumulation.
// Accepts summaryData + debtData, same logic, same slider/pile UX.
function DebtAccumulation({ summaryData, debtData }) {
  var tour = useTour(2);

  var yearData = useMemo(function () {
    if (!summaryData) return [];
    var rows = summaryData.filter(function (r) { return r.year >= 1970 && r.year <= 2024 && !String(r.category).includes("Real"); });
    var byYear = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!byYear[r.year]) byYear[r.year] = {};
      if (r.category === "Total Receipts")     byYear[r.year].receipts = r.amount;
      if (r.category === "Total Outlays")      byYear[r.year].outlays  = r.amount;
      if (r.category === "Surplus or Deficit") byYear[r.year].deficit  = r.amount;
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
    var fy1970   = debtRows.find(function (r) { return r.year === 1970; });
    var defRow   = summaryData.find(function (r) { return r.year === 1970 && r.category === "Surplus or Deficit"; });
    var fy1970deficit = (defRow && defRow.amount < 0) ? Math.abs(defRow.amount) : 0;
    return fy1970 ? Math.max(fy1970.amount - fy1970deficit, 0) : 0;
  }, [debtData, summaryData]);

  var _idx = useState(0); var yearIdx = _idx[0]; var setYearIdx = _idx[1];
  var _hovY = useState(null); var hoveredYear = _hovY[0]; var setHoveredYear = _hovY[1];

  useEffect(function () { if (yearData.length > 0) setYearIdx(0); }, [yearData.length]);

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

  var cur = yearData[yearIdx] || yearData[yearData.length - 1] || {};

  var actualDebtThisYear = useMemo(function () {
    if (!debtData || !cur.year) return 0;
    var row = debtData.find(function (r) { return r.year === cur.year && r.category === "Gross Federal Debt" && !String(r.category).includes("Real"); });
    return row ? row.amount : 0;
  }, [debtData, cur.year]);

  var debtBreakdown = useMemo(function () {
    if (!debtData || !cur.year) return { heldByGovt: 0 };
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

  if (yearData.length === 0) return null;

  var deficitBlocks = cur.deficit < 0 ? Math.round(Math.abs(cur.deficit) / BLOCK_SIZE) : 0;
  var minPileYear  = debtPileBlocks.length > 0 ? debtPileBlocks[0].year : cur.year;
  var maxPileYear  = debtPileBlocks.length > 0 ? debtPileBlocks[debtPileBlocks.length - 1].year : cur.year;
  var pre1970Blocks = Math.round(pre1970Debt / BLOCK_SIZE);

  var trustFundBorrowing = debtBreakdown.heldByGovt - pre1970TrustFund;
  var otherAdjustments   = actualDebtThisYear - (pre1970Debt + cur.cumDebt) - Math.max(trustFundBorrowing, 0) - pre1970TrustFund;

  function yearColor(blockYear) {
    var range = Math.max(maxPileYear - minPileYear, 1);
    var t     = (blockYear - minPileYear) / range;
    return "rgb(" + Math.round(220 - t * 90) + "," + Math.round(100 - t * 70) + "," + Math.round(100 - t * 70) + ")";
  }

  return (
    <div>
      {tour.show && <Tour pageIndex={2} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>How Deficits Become Debt</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Our national debt has grown to over $39 trillion as of 2026, up from $35.23 trillion as of FY{YEAR}. Like regular loans, as the government runs a deficit for a longer period of time, interest payments increase as well, creating a compounding effect.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>Drag the slider to scrub through time. Each block = $10B.</p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <div style={{ marginBottom: 20 }}>
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
            { label: "Revenue",            val: cur.receipts,         bg: "#f0f9ff", color: BLUE },
            { label: "Spending",           val: cur.outlays,          bg: "#fff7ed", color: AMBER },
            { label: cur.deficit >= 0 ? "Surplus" : "Deficit", val: cur.deficit, bg: "#fef2f2", color: cur.deficit >= 0 ? "#16a34a" : RED, prefix: cur.deficit >= 0 ? "+" : "−" },
            { label: "Gross Federal Debt", val: actualDebtThisYear,   bg: "#fce4ec", color: "#4a0000" },
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
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>▼ Added to the debt pile below</div>
          </div>
        )}
        {cur.deficit >= 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f0fdf4", borderRadius: 6, fontSize: 13, color: "#16a34a" }}>
            ✓ Surplus in FY{cur.year} — no new borrowing.
          </div>
        )}
        <div>
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
        <div style={{ marginTop: 20, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid " + BORDER }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Debt Reconciliation — FY{cur.year}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {[
              { label: "Pre-1970 inherited debt",                          val: fmtAmt(pre1970Debt),             color: MUTED },
              { label: "+ Cumulative deficits (1970–" + cur.year + ")",    val: fmtAmt(cur.cumDebt),             color: RED   },
              { label: "+ Trust fund borrowing",                           val: fmtAmt(debtBreakdown.heldByGovt), color: MUTED },
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

/* ── I.c  Debt-to-GDP ─────────────────────── */
// TODO: time series of debt as % of GDP from founding to present.
// Data: federal_debt.csv has "Debt Held by Public (% GDP)" and "Gross Federal Debt (% GDP)" columns.
// Design: line/area chart with era annotations (Civil War, WWII, post-war paydown, modern rise).
// Block viz constants — debt scale is much larger than deficit so we use
// coarser blocks (0.5% each) but make each year 8 blocks wide and smaller blocks
var DEBT_BLOCK_PCT = 0.5;    // % of GDP per block
var DEBT_BLK_SZ   = 6;      // px per block face
var DEBT_BLK_GAP  = 1;      // px gap between blocks within a column
var DEBT_YR_WIDE  = 8;      // blocks wide per year
var DEBT_YR_GAP   = 4;      // px gap between years
var DEBT_CELL     = DEBT_BLK_SZ + DEBT_BLK_GAP;   // px per block row
var DEBT_YR_W     = DEBT_YR_WIDE * DEBT_CELL + DEBT_YR_GAP;  // px per year column

function DebtToGDPViz({ data }) {
  var _hov = useState(null); var hovYear = _hov[0]; var setHovYear = _hov[1];

  var maxBlocks = useMemo(function () {
    return Math.ceil(Math.max.apply(null, data.map(function (r) { return r.debt_pct_gdp; })) / DEBT_BLOCK_PCT);
  }, [data]);

  var maxRows = Math.ceil(maxBlocks / DEBT_YR_WIDE);
  var chartH  = maxRows * DEBT_CELL;
  var totalW  = data.length * DEBT_YR_W;

  // Reuse presidential era bands from page I.a
  var eraByYear = useMemo(function () {
    var map = {};
    ERAS.forEach(function (era) {
      data.forEach(function (r) {
        if (r.year >= era.start && r.year <= era.end) {
          map[r.year] = { label: era.label, party: era.party, color: era.color };
        }
      });
    });
    return map;
  }, [data]);

  var eraBands = useMemo(function () {
    var bands = []; var cur = null;
    data.forEach(function (r, i) {
      var e = eraByYear[r.year];
      if (!e) return;
      if (!cur || cur.label !== e.label || cur.party !== e.party) {
        if (cur) bands.push(cur);
        cur = { label: e.label, party: e.party, color: e.color, x: i * DEBT_YR_W, w: DEBT_YR_W, startYear: r.year };
      } else {
        cur.w += DEBT_YR_W;
      }
    });
    if (cur) bands.push(cur);
    return bands;
  }, [data, eraByYear]);

  var hovRow = hovYear != null ? data.find(function (r) { return r.year === hovYear; }) : null;
  var hovEra = hovYear != null ? eraByYear[hovYear] : null;

  return (
    <div>
      {/* Hover callout */}
      <div style={{ minHeight: 36, marginBottom: 8 }}>
        {hovRow ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{hovRow.year}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: RED }}>
              {hovRow.debt_pct_gdp.toFixed(1)}% of GDP
            </span>
            {hovEra && (
              <span style={{
                fontSize: 16, fontWeight: 600,
                color: hovEra.party === "D" ? "#1d4ed8" : "#b91c1c",
              }}>{hovEra.label}</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: MUTED }}>Hover any column for details</span>
        )}
      </div>

      {/* Scrollable chart */}
      <div style={{ overflowX: "auto", overflowY: "visible" }}>
        <div style={{ position: "relative", width: totalW, height: XAXIS_H + chartH + 4, flexShrink: 0 }}>

          {/* X-axis year labels */}
          {data.map(function (row, i) {
            if (row.year % 10 !== 0) return null;
            return (
              <div key={"tick-" + row.year} style={{
                position: "absolute",
                left: i * DEBT_YR_W, top: 0,
                width: DEBT_YR_W * 4, height: XAXIS_H,
                display: "flex", alignItems: "flex-end", paddingBottom: 4,
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: MUTED }}>{row.year}</span>
              </div>
            );
          })}

          {/* Era background bands */}
          {eraBands.map(function (band) {
            return (
              <div key={band.label + band.startYear} style={{
                position: "absolute",
                left: band.x, top: XAXIS_H,
                width: band.w, height: chartH,
                background: band.color,
                borderLeft: "1px solid " + BORDER + "44",
              }} />
            );
          })}

          {/* Year columns — grow downward from top */}
          {data.map(function (row, i) {
            var blocks  = Math.round(row.debt_pct_gdp / DEBT_BLOCK_PCT);
            var isHov   = hovYear === row.year;
            var x       = i * DEBT_YR_W;

            return (
              <div key={row.year}
                onMouseEnter={function () { setHovYear(row.year); }}
                onMouseLeave={function () { setHovYear(null); }}
                style={{
                  position: "absolute",
                  left: x, top: XAXIS_H,
                  width: DEBT_YR_WIDE * DEBT_CELL - 1,
                  height: chartH,
                  zIndex: 2, cursor: "default",
                }}>
                {Array.from({ length: blocks }).map(function (_, b) {
                  var col     = b % DEBT_YR_WIDE;
                  var row     = Math.floor(b / DEBT_YR_WIDE);
                  var pct     = row / Math.max(maxRows - 1, 1);
                  var r       = Math.round(120 + pct * 19);
                  var g       = Math.round(20  - pct * 20);
                  var bl      = Math.round(20  - pct * 20);
                  var color   = "rgb(" + r + "," + Math.max(0,g) + "," + Math.max(0,bl) + ")";
                  return (
                    <div key={b} style={{
                      position: "absolute",
                      left: col * DEBT_CELL,
                      top:  row * DEBT_CELL,
                      width: DEBT_BLK_SZ, height: DEBT_BLK_SZ,
                      borderRadius: 1,
                      backgroundColor: color,
                      opacity: isHov ? 1 : 0.85,
                      transition: "opacity 0.1s",
                    }} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: MUTED }}>
        <span>Each block = 0.5% of GDP · Scroll to explore · Hover for details</span>
      </div>
    </div>
  );
}

function DebtToGDPPage({ debtPctData }) {
  var tour = useTour(3);
  return (
    <div>
      {tour.show && <Tour pageIndex={3} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Debt as a Share of the Economy</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Federal debt held by the public has swung dramatically over the past 85 years — from a WWII peak of 106% of GDP, down to just 22% by 1974 as the post-war economy grew faster than the debt, and back up to nearly 100% following the 2008 financial crisis and COVID-19 pandemic.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>Each block = 0.5% of GDP. Columns grow downward. Scroll right to move through time.</p>
      <Card style={{ borderLeft: "4px solid " + RED, overflowX: "auto" }}>
        {debtPctData
          ? <DebtToGDPViz data={debtPctData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: FRED FYPUGDA188S — Gross Federal Debt Held by the Public as % of GDP.</p>
    </div>
  );
}

/* ── I.d  Obama-Era Decomposition ────────── */

// Block constants for this viz — % of GDP scale, one column per year
var STAB_BLOCK_PCT  = 0.5;   // 0.5% GDP per block
var STAB_BLK_SZ     = 20;    // px — square block face
var STAB_BLK_GAP    = 2;     // px gap between blocks (within column, both x and y)
var STAB_CELL       = STAB_BLK_SZ + STAB_BLK_GAP;   // px per block row
var STAB_COLS_WIDE  = 2;     // blocks wide per year column
var STAB_COL_W      = STAB_COLS_WIDE * STAB_CELL - STAB_BLK_GAP;  // total column width
var STAB_COL_GAP    = 16;    // px gap between year columns

// Colors
var C_STRUCTURAL   = RED;          // structural deficit (policy + demographics)
var C_STABILIZER   = "#f0b429";    // automatic stabilizer component (amber)

function AutoStabViz({ data }) {
  var _hov = useState(null); var hovYear = _hov[0]; var setHovYear = _hov[1];

  // Focus window: 2005–2016 for context (pre-GFC through end of Obama)
  var filtered = useMemo(function () {
    return data.filter(function (r) { return r.year >= 2005 && r.year <= 2016; });
  }, [data]);

  var maxAbs = useMemo(function () {
    return Math.max.apply(null, filtered.map(function (r) {
      return Math.abs(r.deficit_pct_with_stabilizers);
    }));
  }, [filtered]);

  var maxBlocks  = Math.ceil(maxAbs / STAB_BLOCK_PCT);
  var maxRows    = Math.ceil(maxBlocks / STAB_COLS_WIDE);
  var chartH     = maxRows * STAB_CELL;
  var totalW     = filtered.length * (STAB_COL_W + STAB_COL_GAP);

  var hovRow = hovYear != null ? filtered.find(function (r) { return r.year === hovYear; }) : null;

  return (
    <div>
      {/* Hover callout */}
      <div style={{ minHeight: 52, marginBottom: 8 }}>
        {hovRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{hovRow.year}</span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: RED }}>
                Structural: {hovRow.deficit_pct_without_stabilizers.toFixed(1)}% of GDP (${Math.abs(hovRow.deficit_without_stabilizers).toFixed(0)}B)
              </span>
              <span style={{ fontSize: 13, color: C_STABILIZER }}>
                Auto stabilizers: {hovRow.stabilizer_effect_pct.toFixed(2)}% of GDP (${Math.abs(hovRow.stabilizer_effect).toFixed(0)}B)
              </span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: MUTED }}>Hover any column for detail</span>
        )}
      </div>

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", width: totalW, height: XAXIS_H + chartH + 4, flexShrink: 0 }}>

          {/* X-axis year labels */}
          {filtered.map(function (row, i) {
            return (
              <div key={"tick-" + row.year} style={{
                position: "absolute",
                left: i * (STAB_COL_W + STAB_COL_GAP),
                top: 0, width: STAB_COL_W, height: XAXIS_H,
                display: "flex", alignItems: "flex-end",
                justifyContent: "center", paddingBottom: 4,
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: MUTED }}>{row.year}</span>
              </div>
            );
          })}

          {/* Zero line */}
          <div style={{
            position: "absolute", left: 0, top: XAXIS_H,
            width: totalW, height: 2, background: BORDER, zIndex: 1,
          }} />

          {/* Year columns — 2 blocks wide, stacked downward */}
          {filtered.map(function (row, i) {
            var totalPct  = Math.abs(row.deficit_pct_with_stabilizers);
            var structPct = Math.abs(row.deficit_pct_without_stabilizers);

            var totalBlocks  = Math.round(totalPct  / STAB_BLOCK_PCT);
            var structBlocks = Math.round(structPct / STAB_BLOCK_PCT);
            var stabBlocks   = Math.max(0, totalBlocks - structBlocks);

            // Pad to even number so last row is complete
            var paddedTotal  = Math.ceil(totalBlocks  / STAB_COLS_WIDE) * STAB_COLS_WIDE;
            var paddedStruct = Math.ceil(structBlocks / STAB_COLS_WIDE) * STAB_COLS_WIDE;

            var isHov    = hovYear === row.year;
            var x        = i * (STAB_COL_W + STAB_COL_GAP);

            // Build block list: each entry has {color, col, row}
            var blockList = [];
            for (var b = 0; b < paddedTotal; b++) {
              var bRow = Math.floor(b / STAB_COLS_WIDE);
              var bCol = b % STAB_COLS_WIDE;
              var isPad = b >= totalBlocks;
              var color = isPad ? null
                : b < structBlocks ? C_STRUCTURAL
                : C_STABILIZER;
              blockList.push({ bRow: bRow, bCol: bCol, color: color });
            }

            return (
              <div key={row.year}
                onMouseEnter={function () { setHovYear(row.year); }}
                onMouseLeave={function () { setHovYear(null); }}
                style={{
                  position: "absolute", left: x, top: XAXIS_H,
                  width: STAB_COL_W, height: chartH,
                  zIndex: 2, cursor: "default",
                }}>

                {blockList.map(function (bl, idx) {
                  if (!bl.color) return null;
                  return (
                    <div key={idx} style={{
                      position: "absolute",
                      left: bl.bCol * STAB_CELL,
                      top:  bl.bRow * STAB_CELL,
                      width: STAB_BLK_SZ, height: STAB_BLK_SZ,
                      borderRadius: 2,
                      backgroundColor: bl.color,
                      opacity: isHov ? 1 : 0.82,
                      transition: "opacity 0.1s",
                    }} />
                  );
                })}

              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: C_STRUCTURAL, label: "Structural deficit (policy + demographics)" },
          { color: C_STABILIZER, label: "Automatic stabilizers (recession-driven)" },
        ].map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: MUTED }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
              {l.label}
            </div>
          );
        })}
        <span style={{ fontSize: 11, color: MUTED }}>· Each block = 0.5% of GDP</span>
      </div>
    </div>
  );
}

function ObamaEraPage({ stabilizersData }) {
  var tour = useTour(4);
  return (
    <div>
      {tour.show && <Tour pageIndex={4} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Recession vs. Policy: The Obama Years</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        When the 2008 financial crisis hit, deficits surged, but not all of that increase reflected deliberate policy choices. Automatic stabilizers are parts of the budget that increase spending during recessions, and decrease during growth. Programs like unemployment insurance and food assistance pay more when a greater share of the population is facing financial challenges. As the government tries to inject money in the economy, this automatically grows the deficit without passing any new laws.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>
        Each column shows the total deficit split into its structural component and the automatic stabilizer contribution.
      </p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        {stabilizersData
          ? <AutoStabViz data={stabilizersData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
        Source: CBO, Effects of Automatic Stabilizers on the Federal Budget: 2024 to 2034 (pub. 60662).
      </p>
    </div>
  );
}

/* ── II.a  Revenue vs. Spending ──────────── */
// Ported from App.jsx RevSpendPage.
// Added: per-capita punchline ("That's more than $4,700 for every man, woman and child").
// Population source: US Census pop clock as of 3/25/2025 ≈ 336.1M
var US_POPULATION_M = 336.1;   // millions, Census pop clock March 2025

function RevSpendPage({ spendingData, receiptsData, summaryData }) {
  var _hov = useState(null); var hoveredCat = _hov[0]; var setHoveredCat = _hov[1];
  var tour = useTour(5);

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
    var find   = function (cat) { var f = sumRow.find(function (r) { return r.category === cat; }); return f ? f.amount : 0; };
    return {
      revSources:  revSrc,
      spendSources: named.sort(function (a, b) { return b.amount - a.amount; }),
      totalRev:    find("Total Receipts"),
      totalSpend:  find("Total Outlays"),
    };
  }, [spendingData, receiptsData, summaryData]);

  var revBlocks   = useMemo(function () { return buildBlocks(computed.revSources);   }, [computed.revSources]);
  var spendBlocks = useMemo(function () { return buildBlocks(computed.spendSources); }, [computed.spendSources]);

  var gapPerCapita = useMemo(function () {
    if (!computed.totalRev || !computed.totalSpend) return 0;
    // gap is in millions; convert to dollars per person
    var gapMillions = computed.totalSpend - computed.totalRev;
    return Math.round((gapMillions * 1e6) / (US_POPULATION_M * 1e6));
  }, [computed.totalRev, computed.totalSpend]);

  return (
    <div>
      {tour.show && <Tour pageIndex={5} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Revenue vs. Spending — FY{YEAR}</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        In Fiscal Year {YEAR}, the federal government spent more than it collected in revenue — a gap of over $1.8 trillion.
        That's more than <strong style={{ color: RED }}>${gapPerCapita.toLocaleString()}</strong> for every man, woman, and child in the United States.
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

/* ── II.b  The Deficit ────────────────────── */
// Ported from App.jsx DeficitPage, unchanged.
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
        In FY{YEAR}, the U.S. government ran a budget deficit of $1.83 trillion. Each year that the government runs a deficit, it adds to our national debt.
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

/* ── II.c  Projected Debt / Deficit ─────── */
// TODO: projected debt and deficit block visualization.
// Shows CBO 10-year projections as accumulating debt pile or annual deficit bars.
// Scenario toggle: with tariffs / without tariffs.
// Data: projections_deficit.csv, projections_summary.csv
function ProjectedDebtPage({ deficitProj }) {
  var tour = useTour(7);
  var _scenario = useState("no_tariff_revenue");
  var scenario = _scenario[0]; var setScenario = _scenario[1];
  var _hovYear = useState(null); var hovYear = _hovYear[0]; var setHovYear = _hovYear[1];
  var _scrubYear = useState(2025); var scrubYear = _scrubYear[0]; var setScrubYear = _scrubYear[1];

  var YEARS = [2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];

  // Parse projections into lookup by scenario
  var series = useMemo(function () {
    if (!deficitProj) return {};
    var out = {};
    deficitProj.forEach(function (r) {
      if (!out[r.scenario]) out[r.scenario] = {};
      out[r.scenario][r.year] = r.deficit_billions;
    });
    return out;
  }, [deficitProj]);

  var activeSeries = useMemo(function () {
    var s = series[scenario] || {};
    // no_tariff_revenue starts at 2026 — use feb_2026_current_law for 2025
    if (!s[2025] && series["feb_2026_current_law"]) {
      return Object.assign({}, s, { 2025: series["feb_2026_current_law"][2025] });
    }
    return s;
  }, [series, scenario]);

  // ── Panel 1: annual deficit bars ──────────────────
  var maxDeficit = useMemo(function () {
    return Math.max.apply(null, YEARS.map(function (y) { return activeSeries[y] || 0; }));
  }, [activeSeries]);

  var BAR_BLOCK_B  = 10;   // $10B per block
  var BAR_BLK_SZ   = 5;
  var BAR_BLK_GAP  = 1;
  var BAR_CELL     = BAR_BLK_SZ + BAR_BLK_GAP;
  var BAR_COL_WIDE = 9;    // blocks wide per year column
  var BAR_COL_GAP  = 10;
  var BAR_COL_W    = BAR_COL_WIDE * BAR_CELL;

  var barMaxBlocks = Math.ceil(maxDeficit / BAR_BLOCK_B);
  var barMaxRows   = Math.ceil(barMaxBlocks / BAR_COL_WIDE);
  var barChartH    = barMaxRows * BAR_CELL;
  var barTotalW    = YEARS.length * (BAR_COL_W + BAR_COL_GAP);

  // ── Panel 2: cumulative debt pile ─────────────────
  // Anchor: debt held by public end of 2024 ≈ $28.2T (from projections_summary)
  var ANCHOR_DEBT_B = 28200;   // billions

  var cumulativeByYear = useMemo(function () {
    var cum = ANCHOR_DEBT_B;
    var out = {};
    YEARS.forEach(function (y) {
      cum += (activeSeries[y] || 0);
      out[y] = cum;
    });
    return out;
  }, [activeSeries]);

  var PILE_BLOCK_B = 10;    // $10B per block — same scale as bars
  var PILE_COLS    = 120;   // blocks wide — wider grid
  var PILE_SZ      = 5;     // 1px bigger blocks
  var PILE_GAP     = 1;
  var PILE_CELL    = PILE_SZ + PILE_GAP;

  // Year colors for pile
  var YEAR_COLORS = ["#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#084594",
                     "#99000d","#cb181d","#ef3b2c","#fb6a4a","#fc9272"];

  return (
    <div>
      {tour.show && <Tour pageIndex={7} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Projected Deficits & Debt (2025–2035)</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        CBO projects the federal government will run deficits totaling over $20 trillion through 2035, pushing debt held by the public past $48 trillion. The scenario shown depends on whether current tariff revenues are maintained.
      </p>

      {/* Scenario toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 20px" }}>
        <span style={{ fontSize: 12, color: MUTED }}>Scenario:</span>
        {[
          { key: "no_tariff_revenue", label: "Tariffs struck down" },
          { key: "feb_2026_current_law", label: "With tariff revenue" },
        ].map(function (s) {
          var active = scenario === s.key;
          return (
            <button key={s.key} onClick={function () { setScenario(s.key); }} style={{
              padding: "4px 14px", fontSize: 12, borderRadius: 6, cursor: "pointer",
              border: "1px solid " + (active ? RED : BORDER),
              background: active ? RED : SURFACE,
              color: active ? "#fff" : TEXT,
              fontWeight: active ? 600 : 400,
            }}>{s.label}</button>
          );
        })}
      </div>

      {/* Panel 1 — Annual deficit bars */}
      <Card style={{ borderLeft: "4px solid " + RED, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: "0 0 14px" }}>Annual Deficit</h3>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>Each block = $10B. Columns grow downward.</p>
        <div style={{ overflowX: "auto" }}>
          <div style={{ position: "relative", width: barTotalW, height: XAXIS_H + barChartH + 4, flexShrink: 0 }}>
            {/* X-axis */}
            {YEARS.map(function (y, i) {
              return (
                <div key={y} style={{
                  position: "absolute", left: i * (BAR_COL_W + BAR_COL_GAP),
                  top: 0, width: BAR_COL_W, height: XAXIS_H,
                  display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 3,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: MUTED }}>{y}</span>
                </div>
              );
            })}
            {/* Zero line */}
            <div style={{ position: "absolute", left: 0, top: XAXIS_H, width: barTotalW, height: 2, background: BORDER, zIndex: 1 }} />
            {/* Bars — individual blocks restored */}
            {YEARS.map(function (y, i) {
              var deficit = activeSeries[y] || 0;
              var blocks  = Math.round(deficit / BAR_BLOCK_B);
              var isHov   = hovYear === y || scrubYear === y;
              var idx     = YEARS.indexOf(y);
              var color   = YEAR_COLORS[idx] || RED;
              return (
                <div key={y}
                  onMouseEnter={function () { setHovYear(y); }}
                  onMouseLeave={function () { setHovYear(null); }}
                  style={{ position: "absolute", left: i * (BAR_COL_W + BAR_COL_GAP), top: XAXIS_H, width: BAR_COL_W, height: barChartH, zIndex: 2, cursor: "default" }}>
                  {Array.from({ length: blocks }).map(function (_, b) {
                    var bCol = b % BAR_COL_WIDE;
                    var bRow = Math.floor(b / BAR_COL_WIDE);
                    return (
                      <div key={b} style={{
                        position: "absolute",
                        left: bCol * BAR_CELL, top: bRow * BAR_CELL,
                        width: BAR_BLK_SZ, height: BAR_BLK_SZ, borderRadius: 1,
                        backgroundColor: color,
                        opacity: isHov ? 1 : 0.82, transition: "opacity 0.1s",
                      }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {/* Year color legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 12 }}>
          {YEARS.map(function (y, i) {
            return (
              <div key={y} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: MUTED }}>
                <div style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: YEAR_COLORS[i] }} />
                {y}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Year scrubber */}
      <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>Scrub year:</span>
        <input type="range" min={0} max={YEARS.length - 1} value={YEARS.indexOf(scrubYear) === -1 ? YEARS.length - 1 : YEARS.indexOf(scrubYear)}
          onChange={function (e) { setScrubYear(YEARS[Number(e.target.value)]); }}
          style={{ flex: 1, accentColor: RED }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, minWidth: 36 }}>{scrubYear}</span>
      </div>
      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Annual deficit</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${((activeSeries[scrubYear] || 0) / 1000).toFixed(2)}T</div>
        </div>
        <div style={{ background: "#fce4ec", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Cumulative debt</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#4a0000" }}>${(cumulativeByYear[scrubYear] / 1000).toFixed(1)}T</div>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Added since 2024</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${((cumulativeByYear[scrubYear] - ANCHOR_DEBT_B) / 1000).toFixed(1)}T</div>
        </div>
      </div>

      {/* Panel 2 — Cumulative debt pile */}
      <Card style={{ borderLeft: "4px solid #4a0000" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: "0 0 14px" }}>Cumulative Debt Held by Public</h3>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>Each block = $10B. Gray = existing debt (~$28.2T end of 2024). Colors match deficit years above.</p>
        {/* Pile — builds up to scrubYear as slider moves */}
        <div style={{ width: PILE_COLS * PILE_CELL }}>
          {(function () {
            var segments = [{ year: "anchor", count: Math.round(ANCHOR_DEBT_B / PILE_BLOCK_B), color: "#9ca3af" }];
            YEARS.forEach(function (y, idx) {
              if (y > scrubYear) return;   // only show years up to scrubYear
              segments.push({ year: y, count: Math.round((activeSeries[y] || 0) / PILE_BLOCK_B), color: YEAR_COLORS[idx] || RED });
            });

            return segments.map(function (seg) {
              if (seg.count === 0) return null;
              var paddedCount = Math.ceil(seg.count / PILE_COLS) * PILE_COLS;
              var rows = paddedCount / PILE_COLS;
              var isScrub = scrubYear === seg.year;
              var opacity = seg.year === "anchor" ? 0.7 : isScrub ? 1 : 0.8;
              return (
                <div key={seg.year} style={{
                  width: PILE_COLS * PILE_CELL,
                  height: rows * PILE_CELL,
                  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent " + PILE_SZ + "px, rgba(255,255,255,0.3) " + PILE_SZ + "px, rgba(255,255,255,0.3) " + PILE_CELL + "px), repeating-linear-gradient(to right, " + seg.color + " 0px, " + seg.color + " " + PILE_SZ + "px, rgba(255,255,255,0.3) " + PILE_SZ + "px, rgba(255,255,255,0.3) " + PILE_CELL + "px)",
                  opacity: opacity,
                  outline: isScrub && seg.year !== "anchor" ? "2px solid " + seg.color : "none",
                  outlineOffset: -1,
                }} />
              );
            });
          })()}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: MUTED }}>
          Total projected debt by 2035: <strong style={{ color: "#4a0000" }}>${(cumulativeByYear[2035] / 1000).toFixed(1)}T</strong>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: CBO February 2026 Budget Projections.</p>
    </div>
  );
}

/* ── II.d  OBBBA ─────────────────────────── */
// Ported from App.jsx OBBBAPage.
// Extended to support 4 scenarios once tcja_extended_no_obbba CSV data is available.
// ProjBar and ProjectionPanel lifted verbatim from App.jsx for now.

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
        var color;
        if      (filled < nNoTariff)             color = C_NOTARIFF;
        else if (filled < nNoTariff + nObbba)    color = C_OBBBA;
        else                                     color = C_JAN;
        return <div key={i} style={{ width: PROJ_SZ, height: PROJ_SZ, borderRadius: 1, backgroundColor: color }} />;
      })}
    </div>
  );
}

function ProjectionPanel({ years, baselineSeries, obbbaWithTariffSeries, obbbaNoTariffSeries }) {
  var _hov = useState(null); var hoveredYear = _hov[0]; var setHoveredYear = _hov[1];
  var base    = baselineSeries       || {};
  var withTar = obbbaWithTariffSeries || {};
  var noTar   = obbbaNoTariffSeries  || {};

  function fmt(v) { return v == null ? "—" : "$" + (v / 1000).toFixed(2) + "T"; }

  var maxRows = useMemo(function () {
    var m = 1;
    years.forEach(function (yr) {
      var rows = Math.ceil(Math.round((noTar[yr] || 0) / PROJ_BLOCK_B) / PROJ_COL_W);
      if (rows > m) m = rows;
    });
    return m;
  }, [years, noTar]);

  var colPx  = PROJ_COL_W * (PROJ_SZ + PROJ_GAP) - PROJ_GAP;
  var tenYr  = function (s) { return years.reduce(function (a, yr) { return a + ((s || {})[yr] || 0); }, 0); };

  var legendItems = [
    { color: C_JAN,      label: "Pre-OBBBA (Jan 2025 baseline)" },
    { color: C_OBBBA,    label: "OBBBA w/ tariffs" },
    { color: C_NOTARIFF, label: "OBBBA, tariffs struck down" },
  ];

  var summaryItems = [
    { color: C_JAN,      label: "Pre-OBBBA 10yr",   val: tenYr(base),    bg: "#f0f9ff" },
    { color: C_OBBBA,    label: "With tariffs 10yr", val: tenYr(withTar), bg: "#fffbeb" },
    { color: C_NOTARIFF, label: "No tariffs 10yr",   val: tenYr(noTar),   bg: "#fef2f2" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        {legendItems.map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
              <div style={{ width: PROJ_SZ + 2, height: PROJ_SZ + 2, borderRadius: 1, backgroundColor: l.color }} />{l.label}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2 }}>
        {years.map(function (yr) {
          var baseline   = base[yr]    || 0;
          var withTariff = withTar[yr] || 0;
          var noTariff   = noTar[yr]   || 0;
          var nBaseline  = Math.round(baseline    / PROJ_BLOCK_B);
          var nObbba     = Math.max(Math.round(withTariff / PROJ_BLOCK_B) - nBaseline, 0);
          var nNoTariff  = Math.max(Math.round(noTariff   / PROJ_BLOCK_B) - nBaseline - nObbba, 0);
          var isHov      = hoveredYear === yr;
          return (
            <div key={yr}
              onMouseEnter={function () { setHoveredYear(yr); }}
              onMouseLeave={function () { setHoveredYear(null); }}
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
              <div style={{ fontSize: 11, color: MUTED, marginTop: 5, textAlign: "center", width: colPx }}>{yr}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {summaryItems.map(function (s) {
          return (
            <div key={s.label} style={{ flex: 1, minWidth: 120, background: s.bg, borderRadius: 6, padding: "8px 12px" }}>
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
  var tour = useTour(8);

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

  var years   = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];
  var janDef  = deficitSeries["jan_2025_baseline"]     || {};
  var febDef  = deficitSeries["feb_2026_current_law"]  || {};
  var noTarDef = deficitSeries["no_tariff_revenue"]    || {};

  var janNI  = niSeries["jan_2025_baseline"]     || {};
  var febNI  = niSeries["feb_2026_current_law"]  || {};

  // no-tariff NI back-calculated proportionally (same approach as App.jsx)
  var noTarNI = {};
  years.forEach(function (yr) {
    var defGap    = (febDef[yr] || 0) - (janDef[yr] || 0);
    var niGap     = (febNI[yr]  || 0) - (janNI[yr]  || 0);
    var noTarGap  = (noTarDef[yr] || 0) - (janDef[yr] || 0);
    noTarNI[yr]   = (janNI[yr] || 0) + niGap * (defGap > 0 ? noTarGap / defGap : 1);
  });

  return (
    <div>
      {tour.show && <Tour pageIndex={8} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The One Big Beautiful Bill Act</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        The One Big Beautiful Bill Act (OBBBA) adds trillions to our debt over the next ten years. The combination of extending tax cuts and massive increases in defense and border spending make it the most costly budget bill in history. The OBBBA's budgetary changes mean that we will continue running a deficit through 2034.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px" }}>
        CBO's current law baseline includes ~$3.45T in new tariff revenue offsetting OBBBA's gross $4.7T cost. Each block = $10B. Hover a column for detail.
      </p>
      <Card style={{ borderLeft: "4px solid " + AMBER, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Annual Deficits</h3>
        <ProjectionPanel years={years} baselineSeries={janDef} obbbaWithTariffSeries={febDef} obbbaNoTariffSeries={noTarDef} />
      </Card>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Net Interest Payments</h3>
        <ProjectionPanel years={years} baselineSeries={janNI} obbbaWithTariffSeries={febNI} obbbaNoTariffSeries={noTarNI} />
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Source: CBO February 2026 Budget Projections; CBO pub. 61570 (OBBBA cost estimate).</p>
    </div>
  );
}

/* ── III.a  Crowding Out ─────────────────── */
// TODO: explainer on the crowding-out mechanism:
//   - Government borrowing competes with private borrowers for savings
//   - Higher interest rates → reduced private investment
//   - Effects on productive capital, housing (mortgages), trade deficit
//   - Cushioned by foreign capital inflows, but that creates external debt
// Design: narrative text + simple illustrative diagram or annotated chart.
function CrowdingOutPage() {
  var tour = useTour(9);
  return (
    <div>
      {tour.show && <Tour pageIndex={9} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Are We Stealing from Our Children?</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 20px" }}>
        {/* TODO: intro copy — "yes and no" framing */}
      </p>
      <Card style={{ borderLeft: "4px solid " + S3_COLOR }}>
        <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>[ Crowding-out mechanism explainer — coming soon ]</div>
      </Card>
    </div>
  );
}

/* ── III.b.i  Net Interest ───────────────── */
// Ported from App.jsx NetInterestPage, unchanged.
function NetInterestPage({ spendingData }) {
  var tour = useTour(10);

  var categories = useMemo(function () {
    if (!spendingData) return [];
    var cats = {};
    spendingData.filter(function (r) { return !String(r.category).includes("Real") && r.category !== "Net interest"; })
      .forEach(function (r) { cats[r.category] = true; });
    return Object.keys(cats).sort();
  }, [spendingData]);

  var _comp = useState("National Defense"); var compareCat = _comp[0]; var setCompareCat = _comp[1];
  var _yr   = useState(0);                  var yearIdx    = _yr[0];   var setYearIdx    = _yr[1];

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

  var cur           = timeData[yearIdx] || timeData[timeData.length - 1];
  var interestAmt   = cur.interest;
  var compareAmt    = cur.data[compareCat] || 0;
  var interestBlocks = Math.round(interestAmt  / BLOCK_SIZE);
  var compareBlocks  = Math.round(compareAmt   / BLOCK_SIZE);
  var shortName      = SPEND_SHORT[compareCat] || compareCat;

  return (
    <div>
      {tour.show && <Tour pageIndex={10} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The Rising Cost of Debt Service</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        As of FY{YEAR}, net interest payments have reached $880 billion — more than Medicare, national defense, or any other individual program except Social Security.
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
            { label: shortName,      amt: compareAmt,  blocks: compareBlocks,  color: BLUE  },
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

/* ── III.b.ii  Budget Dilemma ────────────── */
// TODO: spending vs. taxes framing.
// Content:
//   - All remaining programs are highly popular (Social Security, Medicare, defense, veterans)
//   - Show what programs remain if you exclude "politically untouchable" categories
//   - Tax side: link to external tax calculator (TPC, CRFB) or simple illustrative widget
//     showing how much revenue different bracket changes would raise
// Design: TBD — likely a split card showing "cut side" vs "tax side".
function BudgetDilemmaPage({ spendingData }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>The Budget Dilemma</h2>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 20px" }}>
        {/* TODO: intro copy */}
      </p>
      <Card style={{ borderLeft: "4px solid " + S3_COLOR }}>
        <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>[ Budget dilemma — spending cuts vs. tax increases — coming soon ]</div>
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: OMB Historical Tables.</p>
    </div>
  );
}

/* ── III.b.iii  Trade Deficit ────────────── */
// TODO: current account deficit time series as % of GDP.
// Data source: BEA / FRED NETFI (net international investment position) or BOP current account.
// Target: back to 1960 or as far as available.
// Design: line chart or block-based annual bars, same color language.
// Note: close connection to crowding-out narrative — when domestic savings gap is filled by
// foreign capital, it shows up as a current account deficit.
function TradeDeficitPage() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>The Trade Deficit Connection</h2>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 20px" }}>
        {/* TODO: intro copy */}
      </p>
      <Card style={{ borderLeft: "4px solid " + S3_COLOR }}>
        <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>[ Current account deficit time series — coming soon ]</div>
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: BEA / FRED.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// NAVIGATION SHELL
// ─────────────────────────────────────────────
var SLIDE_MS = 320;

function PageShell({ page, setPage, children, prompt }) {
  var _dir     = useState(1);     var dir     = _dir[0];     var setDir     = _dir[1];
  var _visible = useState(true);  var visible = _visible[0]; var setVisible = _visible[1];
  var _content = useState(children); var content = _content[0]; var setContent = _content[1];
  var pendingPage = useRef(null);

  var total    = PAGES.length;
  var pageMeta = PAGES[page] || PAGES[0];
  var section  = pageMeta.section != null ? SECTIONS[pageMeta.section] : null;

  function navigate(next) {
    if (next === page || next < 0 || next >= total) return;
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
        setVisible(true);
      }, SLIDE_MS);
      return function () { clearTimeout(t); };
    }
  }, [visible]);

  useEffect(function () { setContent(children); }, [page]);

  var ty = visible ? "translateY(0)" : (dir > 0 ? "translateY(-40px)" : "translateY(40px)");

  // Progress dots — one dot per section
  function sectionProgress() {
    return SECTIONS.map(function (s) {
      var sectionPages = PAGES.filter(function (p) { return p.section === s.id; });
      var firstIdx     = PAGES.findIndex(function (p) { return p.section === s.id; });
      var lastIdx      = firstIdx + sectionPages.length - 1;
      var active       = page >= firstIdx && page <= lastIdx;
      var done         = page > lastIdx;
      return { s: s, active: active, done: done };
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, fontFamily: "'Segoe UI', system-ui, sans-serif", color: TEXT }}>

      {/* Nav bar */}
      <div style={{ background: "#1e3a5f", padding: "10px 28px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {page > 0 && (
          <button onClick={function () { navigate(page - 1); }}
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>←</button>
        )}
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3, color: "#fff", flex: 1 }}>Visualize Policy</span>

        {/* Section progress pills */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {sectionProgress().map(function (sp) {
            return (
              <div key={sp.s.id} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: sp.active ? "#fff" : sp.done ? "#4a7bb5" : "#2d5080",
                transition: "background 0.3s",
              }} />
            );
          })}
        </div>

        {/* Current section label */}
        {section && (
          <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            {section.label}
          </span>
        )}
      </div>

      {/* Section entry banner — shows when moving into a new section */}
      {section && pageMeta.title && (
        <div style={{ background: section.color, padding: "6px 28px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1.5 }}>{section.label}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>·</span>
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{pageMeta.title}</span>
        </div>
      )}

      {/* Page content */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "36px 28px 0",
        maxWidth: 1100, margin: "0 auto", width: "100%",
        transform: ty, opacity: visible ? 1 : 0,
        transition: "transform " + SLIDE_MS + "ms cubic-bezier(0.4,0,0.2,1), opacity " + SLIDE_MS + "ms ease",
      }}>
        {content}
      </div>

      {/* Forward prompt button */}
      <div style={{
        padding: "24px 28px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box",
        transform: ty, opacity: visible ? 1 : 0,
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

// ─────────────────────────────────────────────
// ROOT — DATA LOADING + PAGE DISPATCH
// ─────────────────────────────────────────────
export default function App() {
  var spendingData    = useCSV("spending_by_function.csv");
  var receiptsData    = useCSV("receipts_by_source.csv");
  var summaryData     = useCSV("summary.csv");
  var debtData        = useCSV("federal_debt.csv");
  var deficitProj     = useCSV("projections_deficit.csv");
  var niProj          = useCSV("projections_net_interest.csv");
  var deficitData     = useCSV("deficit_pct_gdp.csv");
  var debtPctData     = useCSV("debt_pct_gdp.csv");
  var stabilizersData = useCSV("automatic_stabilizers.csv");

  var _p = useState(0); var page = _p[0]; var setPage = _p[1];

  var loading = !spendingData || !receiptsData || !summaryData || !debtData || !deficitProj || !niProj || !deficitData || !debtPctData || !stabilizersData;

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 16, color: MUTED }}>
        Loading…
      </div>
    );
  }

  // Page components indexed to match PAGES manifest
  var pages = [
    /* 0  */ <IntroPage />,
    /* 1  */ <DeficitHistoryPage deficitData={deficitData} />,
    /* 2  */ <DebtAccumulation   summaryData={summaryData} debtData={debtData} />,
    /* 3  */ <DebtToGDPPage      debtPctData={debtPctData} />,
    /* 4  */ <ObamaEraPage       stabilizersData={stabilizersData} />,
    /* 5  */ <RevSpendPage       spendingData={spendingData} receiptsData={receiptsData} summaryData={summaryData} />,
    /* 6  */ <DeficitPage        summaryData={summaryData} />,
    /* 7  */ <ProjectedDebtPage  deficitProj={deficitProj} />,
    /* 8  */ <OBBBAPage          deficitProj={deficitProj} niProj={niProj} />,
    /* 9  */ <CrowdingOutPage />,
    /* 10 */ <NetInterestPage    spendingData={spendingData} />,
    /* 11 */ <BudgetDilemmaPage  spendingData={spendingData} />,
    /* 12 */ <TradeDeficitPage />,
  ];

  return (
    <PageShell page={page} setPage={setPage} prompt={PAGES[page].prompt}>
      {pages[page]}
    </PageShell>
  );
}
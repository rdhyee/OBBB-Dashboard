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

var PROJ_BLOCK_PCT = 0.1;   // 0.1% of GDP per block
var PROJ_SZ        = 7;
var PROJ_GAP       = 1;
var PROJ_COL_W     = 5;    // 5 blocks wide per bar

// ─────────────────────────────────────────────
// DESIGN TOKENS  (identical to App.jsx)
// ─────────────────────────────────────────────
var BG      = "#f8fafc";
var SURFACE = "#ffffff";
var BORDER  = "#e5e7eb";
var TEXT    = "#111827";
var MUTED   = "#6b7280";
var GOLD    = "#b91c1c";
var AMBER   = "#dc2626";
var RED     = "#991b1b";
var BLUE    = "#166534";

// Block colors — distinct from RED/BLUE to avoid partisan reads
var BLOCK_POS = "#16a34a";   // surplus / revenue — green
var BLOCK_NEG = "#dc2626";   // deficit / spending — red

// Projection scenario colors
var C_JAN      = "#6b7280";   // Scenario 1 — Jan 2025 baseline (neutral grey)
var C_TCJA     = "#2ca02c";   // Scenario 2 — TCJA extended, no other OBBBA
var C_OBBBA    = "#c8860a";   // Scenario 3 — OBBBA w/ tariffs
var C_NOTARIFF = "#991b1b";   // Scenario 4 — OBBBA, tariffs struck down (dark red)

// Section accent colors
var S1_COLOR = "#1e3a5f";   // Section I  — How Did We Get Here
var S2_COLOR = "#1e40af";   // Section II — Where Are We Going (blue)
var S3_COLOR = "#374151";   // Section III — What Are the Consequences

// ─────────────────────────────────────────────
// REVENUE / SPENDING COLOR MAPS  (from App.jsx)
// ─────────────────────────────────────────────
var REV_COLORS = {
  "Individual Income Tax": "#14532d",
  "Payroll Taxes (FICA)":  "#166534",
  "Corporate Income Tax":  "#16a34a",
  Other:                   "#4ade80",
  "Excise Taxes":          "#bbf7d0",
};

var SPEND_COLORS = {
  "Social Security":   "#7f1d1d",
  Health:              "#991b1b",
  "Net interest":      "#b91c1c",
  Medicare:            "#dc2626",
  "National Defense":  "#ef4444",
  "Income Security":   "#f87171",
  "Veterans Benefits and Services":                            "#fca5a5",
  "Education, Training, Employment, and Social Services":      "#fecaca",
};
var SPEND_OTHER_COLOR = "#fee2e2";

var SPEND_SHORT = {
  "Social Security":      "Social Security",
  Health:                 "Health (Medicaid/ACA)",
  "Net interest":         "Net Interest",
  Medicare:               "Medicare",
  "National Defense":     "National Defense",
  "Income Security":      "Income Security (unemployment insurance, food stamps, etc.)",
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
    prompt: "Let's start with history. How did we get here?",
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
    title: "Debt Divided by National Income (in %)",
    prompt: "What changed the trajectory along the way?",
  },
  {
    section: 0,
    component: "ObamaEraPage",         // I.d — decomposition of Obama-era deficits
    title: "Recession vs. Policy: Crisis Deficits",
    prompt: "Now let's look at where things are heading.",
  },

  // ── Section II: Where Are We Going? ────────────────────────────
  {
    section: 1,
    component: "DeficitPage",          // II.a — FY2024 deficit block
    title: "The Deficit — FY2024",
    prompt: "What does the full picture of revenue and spending look like?",
  },
  {
    section: 1,
    component: "RevSpendPage",         // II.b — revenue vs spending
    title: "Revenue vs. Spending — FY2024",
    prompt: "What is our government's plan for the deficit in the future?",
  },
  {
    section: 1,
    component: "OBBBAPage",            // II.c — OBBBA scenarios
    title: "The One Big Beautiful Bill Act",
    prompt: "What does that mean for the national debt?",
  },
  {
    section: 1,
    component: "ProjectedDebtPage",    // II.d — projected debt/deficit block viz, scenario toggle
    title: "Projected Deficits & Debt",
    prompt: "What are the real-world consequences of all this?",
  },

  // ── Section III: What Are the Consequences? ────────────────────
  {
    section: 2,
    component: "CrowdingOutPage",      // III.a — are we stealing from our children?
    title: "Paying for the Past",
    prompt: "Does this play out in the real world?",
  },
  {
    section: 2,
    component: "CrowdingOutTextPage",  // III.a.ii — Crowding out text explainer
    title: "Our Children",
    prompt: "One direct consequence is the rising cost of interest.",
  },
  {
    section: 2,
    component: "NetInterestPage",      // III.b — repurposed from App.jsx page 4
    title: "The Rising Cost of Debt Service",
    prompt: "What choices does that leave for the budget?",
  },
  {
    section: 2,
    component: "BudgetDilemmaPage",
    title: "The Budget Dilemma",
    prompt: "So what would it actually take to raise enough in taxes?",
  },
  {
    section: 2,
    component: "TaxPage",
    title: "Raising Taxes",
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
    <div id={props.id} style={{
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
  // Group sources if any have a `group` field, otherwise render flat
  var useGroups = sources.some(function (s) { return s.group; });
  var groups = [];
  if (useGroups) {
    var seen = {};
    sources.forEach(function (s) {
      var g = s.group || "Other";
      if (!seen[g]) { seen[g] = true; groups.push(g); }
    });
  }

  function renderItem(s) {
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
  }

  if (!useGroups) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
        {sources.map(renderItem)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
      {groups.map(function (g) {
        var items = sources.filter(function (s) { return (s.group || "Other") === g; });
        return (
          <div key={g}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 8, marginBottom: 4 }}>{g}</div>
            {items.map(renderItem)}
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
  // Page 0 — Intro
  0: [
    { title: "Welcome to Visualize Policy", body: "Throughout this site you'll see ? buttons like the one you just clicked. They open guided tours that explain how to read and interact with each chart." },
    { title: "Move forward with the question boxes", body: "At the bottom of each page is a question box. Click it to advance to the next page — each question leads naturally into the next topic." },
    { title: "Jump anywhere with the menu", body: "The Menu button in the top-right lets you jump to any page directly. It shows all three sections and every page within them." },
  ],
  // Page 1 — Deficit History
  1: [
    { title: "Each block = 0.5% of GDP", body: "Every square represents 0.5% of gross domestic product. Green blocks are surpluses, red blocks are deficits." },
    { title: "Height shows magnitude", body: "Bigger columns mean larger deficits or surpluses as a percentage of national income." },
    { title: "During crises, borrowing spikes", body: "During crises, like the COVID pandemic, the government has borrowed a larger share of the national income to cover emergency spending." },
    { title: "Hover any column", body: "Hover any year to see the exact surplus or deficit figure and the era label." },
  ],
  // Page 2 — Debt Accumulation
  2: [
    { title: "Drag the slider", body: "Drag the slider to see how the deficit and the debt have changed since 1970. Each year's deficit gets added as new blocks at the end of the pile." },
    { title: "Hover the debt pile", body: "Hover any block in the pile to see which fiscal year it came from. Gray blocks represent debt inherited from before 1970." },
    { title: "Debt reconciliation", body: "The box at the bottom breaks down how the total gross federal debt is composed — pre-1970 inherited debt, cumulative deficits since 1970, and trust fund borrowing." },
  ],
  // Page 3 — Debt to GDP
  3: [
    { title: "Scroll left and right", body: "The chart spans 85 years — scroll horizontally to move through time from 1939 to the present." },
    { title: "Each block = 0.5% of national income", body: "Deeper columns mean more debt relative to the size of the economy. National income (GDP) measures the total value a country produces each year." },
    { title: "Hover any column", body: "Hover any year to see the exact debt level and which president was in office." },
  ],
  // Page 4 — Crisis Deficit Decomposition
  4: [
    { title: "Two crises, same pattern", body: "The left panel shows the 2008 financial crisis and Obama years. The right shows the COVID pandemic under Trump and Biden. Both follow the same playbook: automatic stabilizers kick in on top of deliberate stimulus legislation." },
    { title: "Two layers", body: "Grey is the structural deficit — driven by policy choices and existing law, including stimulus bills like ARRA and the CARES Act. Amber is automatic stabilizers — programs that expand automatically without new legislation." },
    { title: "Hover for detail", body: "Hover any year to see the exact structural deficit and automatic stabilizer contribution for that year." },
  ],
  // Page 6 — Revenue vs Spending
  6: [
    { title: "Each block = $10 billion", body: "Every square represents $10 billion of government money. Green blocks are revenue, red blocks are spending." },
    { title: "Hover to highlight", body: "Hover any block to highlight that category across the grid and legend." },
    { title: "Read the legend", body: "The legend below each grid lists every category with its total. Categories are sorted largest to smallest." },
  ],
  // Page 8 — Projected Deficits & Debt
  8: [
    { title: "Deficits in the next decade", body: "The top panel shows each year's projected deficit as a column of blocks. The bottom panel shows how those deficits accumulate into the national debt pile." },
    { title: "Toggle the scenario", body: "Use the buttons at the top to switch between a scenario where tariff revenues are maintained and one where they are struck down — and see how the outlook changes." },
    { title: "Scrub through the next decade", body: "Use the slider to see how each year's deficit is added to future debt, and how it compares to what we've already accumulated." },
  ],
  // Page 7 — OBBBA
  7: [
    { title: "Increases in the annual deficit", body: "Over the next 10 years, tax cuts under the OBBBA will grow the amount of money the government borrows by hundreds of billions. Each year's bar shows three scenarios: what would have happened if the OBBBA wasn't passed, what will happen if President Trump is able to cover some of his tax cuts with import tariffs, and what will happen if the tariffs are struck down and that money must be borrowed.", targetId: "obbba-deficit-card" },
    { title: "Why might the tariffs be struck down?", body: "President Trump has touted his import tariffs as a way to make up the deficit spending from the OBBBA. The tariffs he announced in April 2025 were estimated by the CBO to raise $3.4 trillion over the next 10 years. However, the Supreme Court ruled he did not have the authority to apply taxes, and they were replaced by temporary duties.", targetId: "obbba-deficit-card" },
    { title: "Will the government still tax imports?", body: "Right now, it's unclear. There are ongoing lawsuits on which tariffs are legal, how high each tax will be, and whether the government has to pay back tariffs already collected. We believe that the revenue from tariffs from now till 2034 will fall somewhere between the no tariff revenue case and the CBO's projections assuming the July 2025 tariffs remain in place.", targetId: "obbba-deficit-card" },
  ],
  // Page 9 — Paying for the Past
  9: [
    { title: "Cents of every tax dollar", body: "The big number at the top shows how many cents of each tax dollar go straight to interest payments — money that can't be spent on anything else. In 1970 it was around 7 cents. Today it's over 16." },
    { title: "The chart tells the story", body: "Hover any year to see the exact share. Notice how it rose sharply in the 1980s as Reagan-era deficits compounded, fell during the Clinton surplus years, then began climbing again after 2008." },
  ],
  // Page 10 — Crowding Out (text explainer, no tour needed)
  // Page 11 — Net Interest
  11: [
    { title: "Compare any program", body: "Use the dropdown to select any government program. The block grids below will update to show net interest payments alongside your chosen program for that year." },
    { title: "Scrub through time", body: "Use the slider to move from 1970 to 2024 and see how both figures have changed over time. Compare how fast spending on interest has grown versus other categories." },
  ],
  // Page 12 — Budget Dilemma
  12: [
    { title: "Hover a slice", body: "Click any slice of the donut to see what that category costs, why it's hard to cut, and polling data on public support. Red slices are mandatory spending — legally required by statute. Green slices are discretionary." },
    { title: "The math is brutal", body: "Even eliminating every green slice entirely: all of defense, education, veterans, foreign aid. It barely covers the deficit. Any plan to balance the budget requires some combination of cuts to mandatory programs, discretionary programs, and tax increases." },
  ],
  // Page 13 — Tax increases
  13: [
    { title: "Drag the sliders", body: "Each slider raises the effective tax rate on that income group by up to 20 percentage points. The bar at the top fills in green as you close more of the deficit." },
    { title: "The static vs. real gap", body: "These numbers assume people keep earning and reporting the same income. In reality, higher rates lead to more deductions, income shifting, and deferral. The true revenue gain is real but smaller than what you see here." },
    { title: "Cutting spending", body: "You can also adjust spending instead of revenue. The spending slider lets you cut a portion of the budget's discretionary spending across the board. This is called budget sequestration, and happened in 2012 to offset the additional spending from the 2008 Financial Crisis." },
    { title: "In the real world", body: "In reality, some of these effects work against you. Cutting government spending reduces growth and new investments, but increasing taxes does the same. Economists disagree on how much each factor matters." },
  ],
};

function Tour({ steps, onDone }) {
  if (!steps) return null;

  var _step = useState(0); var step = _step[0]; var setStep = _step[1];
  var _arrowPos = useState(null); var arrowPos = _arrowPos[0]; var setArrowPos = _arrowPos[1];
  var cur = steps[step];
  var isLast = step === steps.length - 1;

  useEffect(function () {
    var el = document.querySelector("[data-content-scroll]");
    if (el) el.scrollTop = 0;
  }, []);

  // Compute highlight position on target element
  useEffect(function () {
    if (!cur.targetId) { setArrowPos(null); return; }
    var target = document.getElementById(cur.targetId);
    if (!target) { setArrowPos(null); return; }
    var rect = target.getBoundingClientRect();
    setArrowPos({ x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + 20) });
  }, [step, cur.targetId]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>

      {/* Tour panel — centered above content, works at any viewport width */}
      <div style={{
        position: "fixed",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(340px, calc(100vw - 32px))",
        pointerEvents: "auto",
        zIndex: 1001,
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          padding: "14px 12px",
          overflowY: "auto",
          maxHeight: "100%",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
              Step {step + 1} of {steps.length}
            </div>
            <button onClick={onDone} style={{ background: "none", border: "none", fontSize: 16, color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {steps.map(function (_, i) {
              return <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i === step ? "#1e3a5f" : "#e5e7eb", flexShrink: 0 }} />;
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6, lineHeight: 1.3 }}>{cur.title}</div>
          <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.55, margin: "0 0 12px" }}>{cur.body}</p>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {step > 0 && (
              <button onClick={function () { setStep(step - 1); }} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#374151", cursor: "pointer" }}>Back</button>
            )}
            <button onClick={function () { isLast ? onDone() : setStep(step + 1); }} style={{ background: "#1e3a5f", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              {isLast ? "Got it" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useTour(pageIndex) {
  var steps = TOUR_CONFIGS[pageIndex] || null;
  var hasTour = !!steps;
  var _show = useState(hasTour);
  var show = _show[0]; var setShow = _show[1];
  function done()   { setShow(false); }
  function reopen() { setShow(true); }
  return { show: show, done: done, reopen: reopen, hasTour: hasTour, steps: steps };
}

// Reusable tour-trigger button used in page headers
function TourBtn({ onOpen }) {
  var _hov = useState(false); var hov = _hov[0]; var setHov = _hov[1];
  return (
    <div style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}>
      <button onClick={onOpen} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>?</button>
      {hov && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#1e3a5f", color: "#fff",
          fontSize: 12, lineHeight: 1.5,
          padding: "8px 12px", borderRadius: 7,
          whiteSpace: "nowrap", zIndex: 200,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          pointerEvents: "none",
        }}>
          Click for a guided tour of this chart
          <div style={{ position: "absolute", top: -5, right: 9, width: 10, height: 10, background: "#1e3a5f", transform: "rotate(45deg)" }} />
        </div>
      )}
    </div>
  );
}

// Inline info icon with styled hover tooltip (matches TourBtn style)
function InfoTip({ text }) {
  var _hov = useState(false); var hov = _hov[0]; var setHov = _hov[1];
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}>
      <span style={{ cursor: "help", fontSize: 14, color: BLUE, fontWeight: 400, lineHeight: 1 }}>ⓘ</span>
      {hov && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#fff", border: "1px solid #e5e7eb",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          borderRadius: 10, padding: "14px 12px",
          width: 300, zIndex: 300,
          pointerEvents: "none", whiteSpace: "normal",
        }}>
          {text.split("\n\n").map(function (para, i) {
            return <p key={i} style={{ fontSize: 11, color: "#374151", lineHeight: 1.55, margin: i === 0 ? 0 : "8px 0 0" }}>{para}</p>;
          })}
          <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 10, height: 10, background: "#fff", border: "1px solid #e5e7eb", borderTop: "none", borderLeft: "none" }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE COMPONENTS
// ─────────────────────────────────────────────

/* ── Landing ──────────────────────────────── */
function IntroPage({ onNavigate }) {
  var _hov = useState(null); var hovSection = _hov[0]; var setHovSection = _hov[1];
  var tour = useTour(0);

  var sectionPages = SECTIONS.map(function (s) {
    var items = PAGES.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.section === s.id && x.p.title; });
    return { s: s, items: items, firstIdx: items[0] ? items[0].i : 1 };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", maxWidth: 600, paddingBottom: 24 }}>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}

      {/* Eyebrow */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 4, textTransform: "uppercase", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Visualize Policy
        <TourBtn onOpen={tour.reopen} />
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 52, fontWeight: 800, color: TEXT, lineHeight: 1.0, margin: "0 0 24px", letterSpacing: "-1.5px" }}>
        The Federal<br />Budget
      </h1>

      {/* Lede */}
      <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.8, margin: "0 0 36px", maxWidth: 480 }}>
        Where does the government's money come from? Where does it go?
        And what happens when it spends more than it takes in?
      </p>

      {/* Clickable section rows */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
        {sectionPages.map(function (sp, i) {
          var isHov = hovSection === sp.s.id;
          return (
            <button key={sp.s.id}
              onClick={function () { onNavigate(sp.firstIdx); }}
              onMouseEnter={function () { setHovSection(sp.s.id); }}
              onMouseLeave={function () { setHovSection(null); }}
              style={{
                borderTop: "1px solid " + (i === 0 ? "#d1d5db" : BORDER),
                borderBottom: i === sectionPages.length - 1 ? "1px solid " + BORDER : "none",
                borderLeft: "none", borderRight: "none",
                padding: "14px 12px 14px 0",
                display: "flex", alignItems: "center", gap: 20,
                background: isHov ? "#f9fafb" : "transparent",
                cursor: "pointer",
                transition: "background 0.15s",
                textAlign: "left", width: "100%",
              }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: sp.s.color, letterSpacing: 2, textTransform: "uppercase", minWidth: 24, flexShrink: 0 }}>
                {["I", "II", "III"][i]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isHov ? sp.s.color : TEXT, marginBottom: 3, transition: "color 0.15s" }}>
                  {sp.s.label.replace(/^[IV]+\.\s*/, "")}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sp.items.map(function (x) { return x.p.title; }).join("  ·  ")}
                </div>
              </div>
              <div style={{ fontSize: 15, color: sp.s.color, flexShrink: 0, opacity: isHov ? 1 : 0, transform: isHov ? "translateX(0px)" : "translateX(-8px)", transition: "opacity 0.15s, transform 0.15s" }}>→</div>
            </button>
          );
        })}
      </div>

      {/* Forward prompt — same style as PageShell's button */}
      <button onClick={function () { onNavigate(1); }}
        style={{ width: "100%", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "16px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span>Let's start with history. How did we get here?</span>
        <span style={{ fontSize: 20, opacity: 0.7 }}>↓</span>
      </button>
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
  return val >= 0 ? BLOCK_POS : BLOCK_NEG;
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

      {/* Chart with fixed Y axis */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>

        {/* Y axis — fixed, does not scroll */}
        {(function () {
          var YAXIS_W = 36;
          var tickPcts = [];
          for (var t = 5; t <= Math.ceil(maxAbs / 5) * 5; t += 5) tickPcts.push(t);
          return (
            <div style={{ width: YAXIS_W, flexShrink: 0, position: "relative", height: XAXIS_H + chartH + 4 }}>
              <div style={{ position: "absolute", right: 4, top: XAXIS_H + zeroY - 7, fontSize: 9, color: "#9ca3af", textAlign: "right" }}>0%</div>
              {tickPcts.map(function (pct) {
                var blocks = Math.round(pct / DEFICIT_BLOCK_PCT);
                var defY   = XAXIS_H + zeroY + blocks * CELL;
                var surY   = XAXIS_H + zeroY - blocks * CELL;
                return (
                  <React.Fragment key={pct}>
                    {defY < XAXIS_H + chartH && (
                      <div style={{ position: "absolute", right: 4, top: defY - 7, fontSize: 9, color: "#9ca3af", textAlign: "right" }}>-{pct}%</div>
                    )}
                    {surY > XAXIS_H && (
                      <div style={{ position: "absolute", right: 4, top: surY - 7, fontSize: 9, color: "#9ca3af", textAlign: "right" }}>+{pct}%</div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}

        {/* Scrollable chart */}
        <div style={{ overflowX: "auto", overflowY: "visible", flex: 1 }}>
        <div style={{ position: "relative", width: totalW, height: XAXIS_H + chartH + 4, flexShrink: 0 }}>

          {/* Grey gridlines */}
          {(function () {
            var lines = [];
            for (var pct = 5; pct <= Math.ceil(maxAbs / 5) * 5; pct += 5) {
              var blocks = Math.round(pct / DEFICIT_BLOCK_PCT);
              var defY   = XAXIS_H + zeroY + blocks * CELL;
              var surY   = XAXIS_H + zeroY - blocks * CELL;
              if (defY < XAXIS_H + chartH) lines.push({ y: defY, key: "d" + pct });
              if (surY > XAXIS_H)          lines.push({ y: surY, key: "s" + pct });
            }
            return lines.map(function (l) {
              return <div key={l.key} style={{ position: "absolute", left: 0, top: l.y, width: totalW, height: 1, background: "#e5e7eb", zIndex: 0 }} />;
            });
          })()}

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
      </div>

      {/* Color legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: BLOCK_POS, label: "Surplus" },
          
          { color: BLOCK_NEG, label: "Deficit" },
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
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>A History of Deficits</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        The United States has run a deficit in most years — but the size of those deficits relative to the economy has varied enormously. Wars, recessions, and policy choices have all left their mark on the fiscal record.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>Each block = 0.5% of GDP. Green columns rise above the line for surplus years; red columns fall below for deficits.</p>
      <Card style={{ borderLeft: "4px solid " + RED, overflowX: "auto" }}>
        {deficitData
          ? <DeficitHistoryViz data={deficitData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: <a href="https://fred.stlouisfed.org/series/FYFSGDA188S" target="_blank" rel="noreferrer" style={{ color: BLUE }}>FRED FYFSGDA188S</a> — Federal Surplus or Deficit as % of GDP, Office of Management and Budget.</p>
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
      // Surplus or Deficit: negative = deficit, positive = surplus
      // Add deficits, subtract surpluses from cumulative debt
      cumDebt += -def;
      if (cumDebt < 0) cumDebt = 0; // floor at zero
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
    // purple gradient: older = light violet, newer = deep purple
    var r = Math.round(220 - t * 80);
    var g = Math.round(80  - t * 60);
    var b = Math.round(80  - t * 60);
    return "rgb(" + r + "," + Math.max(10,g) + "," + Math.max(10,b) + ")";
  }

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>How Deficits Become Debt</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Our national debt has grown to over $39 trillion as of 2026, up from $35.23 trillion as of Fiscal Year (FY) 2024. Like regular loans, as the government runs a deficit for a longer period of time, interest payments increase as well, creating a compounding effect.
      </p>
      <p style={{ margin: "0 0 20px" }}><span style={{ fontSize: 15, color: "#c0392b", fontWeight: 700 }}>Drag the slider to see how the deficit and the debt have changed since 1970.</span>{" "}<span style={{ fontSize: 13, color: MUTED }}>Each block = $10B.</span></p>
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
            { label: "Revenue",            val: cur.receipts,         bg: "#eef6f0", color: BLUE },
            { label: "Spending",           val: cur.outlays,          bg: "#fef2f2", color: AMBER },
            { label: cur.deficit >= 0 ? "Surplus" : "Deficit", val: cur.deficit, bg: "#f0fdf4" , color: cur.deficit >= 0 ? BLUE : RED, prefix: cur.deficit >= 0 ? "+" : "−" },
            { label: "Gross Federal Debt", val: actualDebtThisYear,   bg: "#fef2f2", color: RED },
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
                return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: BLOCK_NEG, opacity: 0.9 }} />;
              })}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>▼ Added to the debt pile below</div>
          </div>
        )}
        {cur.deficit >= 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#eef6f0", borderRadius: 6, fontSize: 13, color: BLUE }}>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6, position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Debt Reconciliation — FY{cur.year}
            <InfoTip text={"The bottom-line gross federal debt is split into debt held by the public and debt that is borrowed from the government itself. Public debt includes all of the outstanding deficits along with smaller items, like short term debt the treasury issues to cover cash needs.\n\nIntragovernmental debt is borrowed from the surplus budget of trust funds, like those that fund social security. While it still needs to be repaid, it\u2019s not directly marketable to the public and doesn\u2019t compete for investment with the private sector."} />
          </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid " + BORDER, paddingTop: 4, marginTop: 4, fontWeight: 700, color: RED }}>
              <span>= Gross Federal Debt</span><span>{fmtAmt(actualDebtThisYear)}</span>
            </div>
          </div>
        </div>
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Sources: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables, FY2026 Budget</a> (Table 1.1 — surplus/deficit; Table 7.1 — gross federal debt).</p>
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

      {/* Chart with fixed Y axis */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>

        {/* Y axis — fixed, does not scroll */}
        {(function () {
          var YAXIS_W = 40;
          var tickPcts = [];
          for (var t = 0; t <= Math.ceil((maxRows * DEBT_YR_WIDE * DEBT_BLOCK_PCT) / 25) * 25; t += 25) tickPcts.push(t);
          return (
            <div style={{ width: YAXIS_W, flexShrink: 0, position: "relative", height: XAXIS_H + chartH + 4 }}>
              {tickPcts.map(function (pct) {
                var blocks = Math.round(pct / DEBT_BLOCK_PCT);
                var rowNum = Math.floor(blocks / DEBT_YR_WIDE);
                var y = XAXIS_H + rowNum * DEBT_CELL;
                if (y > XAXIS_H + chartH) return null;
                return (
                  <div key={pct} style={{ position: "absolute", right: 4, top: y - 6, fontSize: 9, color: "#9ca3af", textAlign: "right", lineHeight: 1 }}>
                    {pct}%
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Scrollable chart */}
        <div style={{ overflowX: "auto", overflowY: "visible", flex: 1 }}>
        <div style={{ position: "relative", width: totalW, height: XAXIS_H + chartH + 4, flexShrink: 0 }}>

          {/* Grey gridlines at every 25% */}
          {(function () {
            var lines = [];
            for (var pct = 25; pct <= maxRows * DEBT_YR_WIDE * DEBT_BLOCK_PCT; pct += 25) {
              var blocks = Math.round(pct / DEBT_BLOCK_PCT);
              var rowNum = Math.floor(blocks / DEBT_YR_WIDE);
              var y = XAXIS_H + rowNum * DEBT_CELL;
              if (y <= XAXIS_H + chartH) lines.push({ y: y, key: "g" + pct });
            }
            return lines.map(function (l) {
              return <div key={l.key} style={{ position: "absolute", left: 0, top: l.y, width: totalW, height: 1, background: "#e5e7eb", zIndex: 0 }} />;
            });
          })()}

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
                  var col = b % DEBT_YR_WIDE;
                  var row = Math.floor(b / DEBT_YR_WIDE);
                  return (
                    <div key={b} style={{
                      position: "absolute",
                      left: col * DEBT_CELL,
                      top:  row * DEBT_CELL,
                      width: DEBT_BLK_SZ, height: DEBT_BLK_SZ,
                      borderRadius: 1,
                      backgroundColor: "#dc2626",
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
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Debt Divided by National Income (in %)</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Federal debt held by the public has swung dramatically over the past 85 years. At the end of WWII it was 106% of national income, but it declined rapidly as the economy grew in the post-war years — down to just 22% by 1974. It went back to nearly 100% following the 2008 financial crisis and COVID-19 pandemic. At the end of 2025 that number was only slightly lower than the 2020 peak.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>Each block = 0.5% of national income. Columns grow downward. Move the scroll bar to the right to explore further back in time.</p>
      <Card style={{ borderLeft: "4px solid " + RED, overflowX: "auto" }}>
        {debtPctData
          ? <DebtToGDPViz data={debtPctData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: <a href="https://fred.stlouisfed.org/series/FYPUGDA188S" target="_blank" rel="noreferrer" style={{ color: BLUE }}>FRED FYPUGDA188S</a> — Gross Federal Debt Held by the Public as % of GDP.</p>
    </div>
  );
}

/* ── I.d  Crisis Deficit Decomposition ────── */

// Block constants for this viz
var STAB_BLOCK_PCT  = 0.5;   // 0.5% GDP per block
var STAB_BLK_SZ     = 18;    // px — square block face
var STAB_BLK_GAP    = 2;     // px gap
var STAB_CELL       = STAB_BLK_SZ + STAB_BLK_GAP;
var STAB_COLS_WIDE  = 2;     // blocks wide per year column
var STAB_COL_W      = STAB_COLS_WIDE * STAB_CELL - STAB_BLK_GAP;
var STAB_COL_GAP    = 14;    // px gap between year columns

// Colors
var C_STRUCTURAL   = "#374151";    // structural deficit (policy + demographics) — dark grey
var C_STABILIZER   = "#c8860a";    // automatic stabilizer component
var C_STIMULUS     = "#1e40af";    // discretionary stimulus (ARRA / CARES)

function AutoStabPanel({ data, stimulusByYear, yearStart, yearEnd, maxRows, label }) {
  var _hov = useState(null); var hovYear = _hov[0]; var setHovYear = _hov[1];

  var filtered = useMemo(function () {
    return data.filter(function (r) { return r.year >= yearStart && r.year <= yearEnd; });
  }, [data, yearStart, yearEnd]);

  var chartH = maxRows * STAB_CELL;
  var totalW = filtered.length * (STAB_COL_W + STAB_COL_GAP);
  var hovRow = hovYear != null ? filtered.find(function (r) { return r.year === hovYear; }) : null;
  var hovStim = hovYear != null ? (stimulusByYear[hovYear] || 0) : 0;

  return (
    <div style={{ flex: "1 1 300px", minWidth: 260 }}>
      {/* Panel label */}
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>

      {/* Hover callout */}
      <div style={{ minHeight: 48, marginBottom: 8 }}>
        {hovRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{hovRow.year}</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: C_STRUCTURAL }}>
                Structural: {hovRow.deficit_pct_without_stabilizers.toFixed(1)}%
              </span>
              {hovStim > 0 && (
                <span style={{ fontSize: 12, color: C_STIMULUS }}>
                  Stimulus: {hovStim.toFixed(1)}% of GDP
                </span>
              )}
              <span style={{ fontSize: 12, color: C_STABILIZER }}>
                Auto stabilizers: {hovRow.stabilizer_effect_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: MUTED }}>Hover any column for detail</span>
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
                <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{row.year}</span>
              </div>
            );
          })}

          {/* Zero line */}
          <div style={{
            position: "absolute", left: 0, top: XAXIS_H,
            width: totalW, height: 2, background: BORDER, zIndex: 1,
          }} />

          {/* Year columns */}
          {filtered.map(function (row, i) {
            var totalPct   = Math.abs(row.deficit_pct_with_stabilizers);
            var structPct  = Math.abs(row.deficit_pct_without_stabilizers);
            var gdp        = row.gdp_billions || 1;
            var stimPct    = stimulusByYear[row.year] || 0;

            var totalBlocks  = Math.round(totalPct  / STAB_BLOCK_PCT);
            var structBlocks = Math.round(structPct / STAB_BLOCK_PCT);
            var stimBlocks   = Math.min(Math.round(stimPct / STAB_BLOCK_PCT), structBlocks);

            var paddedTotal  = Math.ceil(totalBlocks / STAB_COLS_WIDE) * STAB_COLS_WIDE;

            var isHov = hovYear === row.year;
            var x     = i * (STAB_COL_W + STAB_COL_GAP);

            var blockList = [];
            for (var b = 0; b < paddedTotal; b++) {
              var bRow = Math.floor(b / STAB_COLS_WIDE);
              var bCol = b % STAB_COLS_WIDE;
              if (b >= totalBlocks) { blockList.push({ bRow: bRow, bCol: bCol, color: null }); continue; }
              var color;
              if (b < (structBlocks - stimBlocks))  color = C_STRUCTURAL;
              else if (b < structBlocks)             color = C_STIMULUS;
              else                                   color = C_STABILIZER;
              blockList.push({ bRow: bRow, bCol: bCol, color: color });
            }

            return (
              <div key={row.year}
                onMouseEnter={function () { setHovYear(row.year); }}
                onMouseLeave={function () { setHovYear(null); }}
                style={{ position: "absolute", left: x, top: XAXIS_H, width: STAB_COL_W, height: chartH, zIndex: 2, cursor: "default" }}>
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
    </div>
  );
}

function AutoStabViz({ data, stimulusData }) {
  // Calculate shared maxRows across both panels so heights match
  var maxAbs = useMemo(function () {
    var rows = data.filter(function (r) {
      return (r.year >= 2008 && r.year <= 2014) || (r.year >= 2018 && r.year <= 2022);
    });
    return Math.max.apply(null, rows.map(function (r) { return Math.abs(r.deficit_pct_with_stabilizers); }));
  }, [data]);
  var maxBlocks = Math.ceil(maxAbs / STAB_BLOCK_PCT);
  var maxRows   = Math.ceil(maxBlocks / STAB_COLS_WIDE);

  // Build {year: pct_gdp} lookup for stimulus — sum all categories per year
  var stimulusByYear = useMemo(function () {
    if (!stimulusData) return {};
    var out = {};
    stimulusData.filter(function (r) { return r.category === 'Total Direct Cost'; })
      .forEach(function (r) {
        out[r.fiscal_year] = (out[r.fiscal_year] || 0) + (r.pct_gdp || 0);
      });
    return out;
  }, [stimulusData]);

  return (
    <div>
      {/* Two panels side by side */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
        <AutoStabPanel data={data} stimulusByYear={stimulusByYear} yearStart={2008} yearEnd={2014} maxRows={maxRows} label="2008–2014: Financial Crisis + Obama" />
        <AutoStabPanel data={data} stimulusByYear={stimulusByYear} yearStart={2018} yearEnd={2022} maxRows={maxRows} label="2018–2022: COVID + Trump/Biden" />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: C_STIMULUS,   label: "Stimulus legislation (ARRA / CARES Act)" },
          { color: C_STRUCTURAL, label: "Structural deficit (policy + demographics)" },
          { color: C_STABILIZER, label: "Automatic stabilizers (recession-driven)" },
        ].map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: MUTED }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          );
        })}
        <span style={{ fontSize: 11, color: MUTED }}>· Each block = 0.5% of GDP</span>
      </div>
    </div>
  );
}

function ObamaEraPage({ stabilizersData, stimulusData }) {
  var tour = useTour(4);
  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Recession vs. Policy: Crisis Deficits</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 10px" }}>
        When a recession hits, the federal government runs larger deficits. Some of this is through new laws, like the CARES Act during COVID or the American Recovery and Reinvestment Act (ARRA) after the 2008 Financial Crisis. These try to stimulate the economy by borrowing money and spending it in sectors affected by the recession. That is the main reason the deficit jumps at the start of these crises.
      </p>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        The rest of the deficit comes from changes that took place through existing laws. Automatic stabilizers, shown in amber, are programs like unemployment insurance and food assistance that automatically pay out more when more people need them. As more people lost their jobs, they paid less in taxes — decreasing government revenue — and became eligible for government programs like food stamps, increasing government spending.
      </p>
      <Card style={{ borderLeft: "4px solid " + RED }}>
        {stabilizersData
          ? <AutoStabViz data={stabilizersData} stimulusData={stimulusData} />
          : <div style={{ color: MUTED, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
        }
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
        Sources: <a href="https://www.cbo.gov/publication/60662" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO, Effects of Automatic Stabilizers on the Federal Budget: 2024 to 2034 (pub. 60662)</a>;{" "}
        <a href="https://www.cbo.gov/publication/41762" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO, Estimated Impact of the American Recovery and Reinvestment Act on Employment and Economic Output (pub. 41762)</a>;{" "}
        <a href="https://www.cbo.gov/publication/56334" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO, Estimated Budgetary Effects of the CARES Act (pub. 56334)</a>.
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
  var tour = useTour(6);

  var computed = useMemo(function () {
    if (!spendingData || !receiptsData || !summaryData)
      return { revSources: [], spendSources: [], totalRev: 0, totalSpend: 0 };

    var revRows = receiptsData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var revSrc  = revRows.map(function (r) { return { label: r.category, amount: r.amount, color: REV_COLORS[r.category] || "#93c5fd" }; }).sort(function (a, b) { return b.amount - a.amount; });

    var spendRows = spendingData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var named = []; var otherTotal = 0;

    var MANDATORY_CATS = ["Social Security", "Medicare", "Health", "Income Security", "Net interest"];
    var DISCRETIONARY_CATS = ["National Defense", "Veterans Benefits and Services", "Education, Training, Employment, and Social Services"];

    spendRows.sort(function (a, b) { return b.amount - a.amount; }).forEach(function (r) {
      if (!SPEND_COLORS[r.category]) { otherTotal += r.amount; return; }
      var group = MANDATORY_CATS.includes(r.category) ? "Mandatory"
                : DISCRETIONARY_CATS.includes(r.category) ? "Discretionary"
                : "Discretionary";
      named.push({ label: SPEND_SHORT[r.category] || r.category, amount: r.amount, color: SPEND_COLORS[r.category], group: group });
    });
    named.push({ label: "All Other", amount: otherTotal, color: SPEND_OTHER_COLOR, group: "Discretionary" });

    // Sort: Mandatory first then Discretionary, descending by amount within each group
    // Pin Social Security → Medicare at top of Mandatory regardless of amount
    var MAND_PIN = ["Social Security", "Medicare"];
    named.sort(function (a, b) {
      if (a.group !== b.group) return a.group === "Mandatory" ? -1 : 1;
      if (a.group === "Mandatory") {
        var ai = MAND_PIN.indexOf(a.label), bi = MAND_PIN.indexOf(b.label);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
      }
      return b.amount - a.amount;
    });

    var sumRow = summaryData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var find   = function (cat) { var f = sumRow.find(function (r) { return r.category === cat; }); return f ? f.amount : 0; };
    return {
      revSources:   revSrc,
      spendSources: named,
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
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Revenue vs. Spending — FY{YEAR}</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        In Fiscal Year 2024, the federal government spent more than it collected in revenue — a gap of over $1.8 trillion.
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
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Source: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables, FY2026 Budget</a>.</p>
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
        In FY2024, the U.S. government ran a budget deficit of $1.83 trillion (that's roughly $5B a day!). Each year that the government runs on a deficit, it adds to our national debt.
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
            return <div key={i} style={{ width: SZ, height: SZ, borderRadius: 2, backgroundColor: BLOCK_NEG, opacity: 0.9 }} />;
          })}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Each block = $10B of borrowed money</div>
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables, FY2026 Budget</a> (Table 1.1 — summary of receipts, outlays, and surpluses or deficits).</p>
    </div>
  );
}

/* ── II.c  Projected Debt / Deficit ─────── */
// TODO: projected debt and deficit block visualization.
// Shows CBO 10-year projections as accumulating debt pile or annual deficit bars.
// Scenario toggle: with tariffs / without tariffs.
// Data: projections_deficit.csv, projections_summary.csv
function ProjectedDebtPage({ deficitProj, projSummary }) {
  var tour = useTour(8);
  var _scenario = useState("no_tariff_revenue");
  var scenario = _scenario[0]; var setScenario = _scenario[1];
  var _hovYear = useState(null); var hovYear = _hovYear[0]; var setHovYear = _hovYear[1];
  var _scrubYear = useState(2025); var scrubYear = _scrubYear[0]; var setScrubYear = _scrubYear[1];

  var YEARS = [2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];

  var gdpByYear = useMemo(function () {
    if (!projSummary) return {};
    var out = {};
    projSummary.forEach(function (r) {
      if (String(r.category).trim() === "GDP") {
        var val = Number(r.amount_billions || r.value || r.amount || 0);
        if (val > 0) out[Number(r.year)] = val;
      }
    });
    return out;
  }, [projSummary]);

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
  var YEAR_COLORS = ["#fecaca","#fca5a5","#f87171","#ef4444","#dc2626","#b91c1c",
                     "#991b1b","#7f1d1d","#ef4444","#dc2626","#b91c1c"];

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Projected Deficits & Debt (2025–2035)</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        The Congressional Budget Office projects the federal government will run deficits totaling over $20 trillion through 2035, pushing debt held by the public past $56 trillion. These added deficits will increase the debt to 118% of GDP in 2035. The scenario shown depends on whether current tariff revenues are maintained, but this depends on change due to recent Supreme Court ruling on tariff policy. We believe that the revenue from tariffs from now until 2034 will fall somewhere between completely zeroed tariff revenues and the CBO's projections (assuming the July 1st tariffs remain in place).
      </p>

      {/* Scenario toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 20px" }}>
        <span style={{ fontSize: 12, color: MUTED }}>Scenario:</span>
        {[
          { key: "no_tariff_revenue", label: "Tariffs Struck Down" },
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
        <div style={{ overflowX: "auto", overflowY: "visible" }}>
          <div style={{ position: "relative", width: barTotalW, height: XAXIS_H + barChartH + 4, flexShrink: 0, overflow: "visible" }}>
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
            {/* Bars — individual blocks with tooltip */}
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
                  style={{ position: "absolute", left: i * (BAR_COL_W + BAR_COL_GAP), top: XAXIS_H, width: BAR_COL_W, height: barChartH, zIndex: 2, cursor: "default", overflow: "visible" }}>
                  {/* Tooltip — above the bar, matching site style */}
                  {hovYear === y && (
                    <div style={{
                      position: "absolute", bottom: "100%", left: "50%",
                      transform: "translateX(-50%)", marginBottom: 6,
                      zIndex: 20, whiteSpace: "nowrap", fontSize: 11,
                      textAlign: "center", lineHeight: 1.6,
                      background: "#fff", border: "1px solid #e5e7eb",
                      borderRadius: 5, padding: "5px 9px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      pointerEvents: "none",
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{y}</div>
                      <div style={{ color: RED }}>Deficit: ${(deficit / 1000).toFixed(2)}T{gdpByYear[y] ? " (" + (deficit / gdpByYear[y] * 100).toFixed(1) + "% of GDP)" : ""}</div>
                    </div>
                  )}
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

      {/* Year scrubber — sits above the debt pile it controls */}
      <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Annual deficit</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${((activeSeries[scrubYear] || 0) / 1000).toFixed(2)}T</div>
        </div>
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Cumulative debt</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${(cumulativeByYear[scrubYear] / 1000).toFixed(1)}T</div>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Added since 2024</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${((cumulativeByYear[scrubYear] - ANCHOR_DEBT_B) / 1000).toFixed(1)}T</div>
        </div>
      </div>
      <div style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>Scrub year:</span>
        <input type="range" min={0} max={YEARS.length - 1} value={YEARS.indexOf(scrubYear) === -1 ? YEARS.length - 1 : YEARS.indexOf(scrubYear)}
          onChange={function (e) { setScrubYear(YEARS[Number(e.target.value)]); }}
          style={{ flex: 1, accentColor: RED }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, minWidth: 36 }}>{scrubYear}</span>
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
          Total projected debt by 2035: <strong style={{ color: RED }}>${(cumulativeByYear[2035] / 1000).toFixed(1)}T</strong>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: <a href="https://www.cbo.gov/publication/62105" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO February 2026 Budget Projections (pub. 62105)</a>.</p>
    </div>
  );
}

/* ── II.d  OBBBA ─────────────────────────── */
// Ported from App.jsx OBBBAPage.
// Extended to support 4 scenarios once tcja_extended_no_obbba CSV data is available.
// ProjBar and ProjectionPanel lifted verbatim from App.jsx for now.

function ProjBar({ nBaseline, nObbba, nNoTariff, maxRows, colW, blkSz }) {
  var CW = colW || PROJ_COL_W; var BS = blkSz || PROJ_SZ;
  var total      = nBaseline + nObbba + nNoTariff;
  var myRows     = Math.ceil(total / CW);
  var padRows    = maxRows - myRows;
  var totalCells = maxRows * CW;
  var emptyCells = padRows * CW;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + CW + ", " + BS + "px)", gap: PROJ_GAP + "px", width: CW * (BS + PROJ_GAP) - PROJ_GAP, alignSelf: "flex-end" }}>
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

function ProjectionPanel({ years, baselineSeries, obbbaWithTariffSeries, obbbaNoTariffSeries, gdpByYear, mode }) {
  var _hov = useState(null); var hoveredYear = _hov[0]; var setHoveredYear = _hov[1];
  var base    = baselineSeries       || {};
  var withTar = obbbaWithTariffSeries || {};
  var noTar   = obbbaNoTariffSeries  || {};
  var gdp     = gdpByYear || {};

  function fmt(v) { return v == null ? "—" : "$" + (v / 1000).toFixed(2) + "T"; }
  function fmtPct(v, yr) {
    var g = gdp[yr];
    if (!v || !g) return "";
    return " (" + (v / g * 100).toFixed(1) + "% GDP)";
  }

  // Nominal mode: $10B per block, 10 wide (original style)
  // Pct mode: 0.1% GDP per block, 5 wide
  var COL_W   = mode === "pct" ? 5  : 10;
  var BLK_SZ  = PROJ_SZ;   // same 7px block in both modes
  var BLK_PCT = 0.1;        // % GDP per block in pct mode
  var BLK_B   = 10;         // $B per block in nominal mode

  var maxRows = useMemo(function () {
    var m = 1;
    years.forEach(function (yr) {
      var n;
      if (mode === "pct") {
        var g = gdp[yr] || 1;
        n = Math.ceil(Math.round((noTar[yr] || 0) / g * 1000) / COL_W);
      } else {
        n = Math.ceil(Math.round((noTar[yr] || 0) / BLK_B) / COL_W);
      }
      if (n > m) m = n;
    });
    return m;
  }, [years, noTar, gdp, mode, COL_W]);

  var colPx  = COL_W * (BLK_SZ + PROJ_GAP) - PROJ_GAP + 4;
  var tenYr  = function (s) { return years.reduce(function (a, yr) { return a + ((s || {})[yr] || 0); }, 0); };

  var legendItems = [
    { color: C_JAN,      label: "Pre-OBBBA (Jan 2025 baseline)" },
    { color: C_OBBBA,    label: "OBBBA w/ tariffs" },
    { color: C_NOTARIFF, label: "OBBBA, Tariffs struck down" },
  ];

  var avgPctGDP = function (s) {
    var vals = years.map(function (yr) { var g = gdp[yr]; return g ? (s[yr] || 0) / g * 100 : null; }).filter(Boolean);
    return vals.length ? vals.reduce(function (a, v) { return a + v; }, 0) / vals.length : 0;
  };
  var summaryItems = [
    { color: C_JAN,      label: "Pre-OBBBA 10yr",   val: tenYr(base),    avg: avgPctGDP(base),    bg: "#f3f4f6" },
    { color: C_OBBBA,    label: "With tariffs 10yr", val: tenYr(withTar), avg: avgPctGDP(withTar), bg: "#fdf6e3" },
    { color: C_NOTARIFF, label: "Tariffs struck down 10yr",   val: tenYr(noTar),   avg: avgPctGDP(noTar),   bg: "#fef2f2" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        {legendItems.map(function (l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
              <div style={{ width: PROJ_SZ, height: PROJ_SZ, borderRadius: 1, backgroundColor: l.color }} />{l.label}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2 }}>
        {years.map(function (yr) {
          var baseline   = base[yr]    || 0;
          var withTariff = withTar[yr] || 0;
          var noTariff   = noTar[yr]   || 0;
          var nBaseline, nObbba, nNoTariff;
          if (mode === "pct") {
            var g = gdp[yr] || 1;
            nBaseline  = Math.round((baseline    || 0) / g * 1000);
            nObbba     = Math.max(Math.round((withTariff || 0) / g * 1000) - nBaseline, 0);
            nNoTariff  = Math.max(Math.round((noTariff   || 0) / g * 1000) - nBaseline - nObbba, 0);
          } else {
            nBaseline  = Math.round((baseline    || 0) / BLK_B);
            nObbba     = Math.max(Math.round((withTariff || 0) / BLK_B) - nBaseline, 0);
            nNoTariff  = Math.max(Math.round((noTariff   || 0) / BLK_B) - nBaseline - nObbba, 0);
          }
          var isHov      = hoveredYear === yr;
          return (
            <div key={yr}
              onMouseEnter={function () { setHoveredYear(yr); }}
              onMouseLeave={function () { setHoveredYear(null); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", position: "relative", overflow: "visible" }}>
              {isHov && (
                <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 6, zIndex: 10, whiteSpace: "nowrap", fontSize: 11, textAlign: "center", lineHeight: 1.6, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 5, padding: "5px 9px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{yr}</div>
                  <div style={{ color: C_JAN }}>Baseline: {fmt(baseline)}{fmtPct(baseline, yr)}</div>
                  <div style={{ color: C_OBBBA }}>w/ tariffs: {fmt(withTariff)}{fmtPct(withTariff, yr)}</div>
                  <div style={{ color: C_NOTARIFF }}>Tariffs struck down: {fmt(noTariff)}{fmtPct(noTariff, yr)}</div>
                </div>
              )}
              <ProjBar nBaseline={nBaseline} nObbba={nObbba} nNoTariff={nNoTariff} maxRows={maxRows} colW={COL_W} blkSz={BLK_SZ} />
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
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{mode === "pct" ? s.avg.toFixed(1) + "% avg" : fmt(s.val)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OBBBAPage({ deficitProj, niProj, projSummary }) {
  var tour = useTour(7);

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

  // GDP by year from projections_summary.csv (billions) — category "GDP", CBO Feb 2026
  var gdpByYear = useMemo(function () {
    if (!projSummary) return {};
    var out = {};
    projSummary.forEach(function (r) {
      if (String(r.category).trim() === "GDP") {
        var val = Number(r.amount_billions || r.value || r.amount || 0);
        if (val > 0) out[Number(r.year)] = val;
      }
    });
    return out;
  }, [projSummary]);

  var years   = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];
  var janDef  = deficitSeries["jan_2025_baseline"]     || {};
  var febDef  = deficitSeries["feb_2026_current_law"]  || {};
  var noTarDef = deficitSeries["no_tariff_revenue"]    || {};

  var janNI    = niSeries["jan_2025_baseline"]    || {};
  var febNI    = niSeries["feb_2026_current_law"] || {};
  var noTarNI  = niSeries["no_tariff_revenue"]    || {};

  var _mode = useState("pct"); var mode = _mode[0]; var setMode = _mode[1];

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The One Big Beautiful Bill Act</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        The One Big Beautiful Bill Act (OBBBA) was passed in July 2025 as President Trump's flagship budget bill. It adds trillions to our debt over the next ten years. The combination of extending tax cuts and massive increases in defense and border spending make it the most costly budget bill in history. The OBBBA locks in a federal deficit through 2035. Click on the tour to see how this is worsened by President Trump's proposed tariffs.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 20px", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
          CBO's current law baseline includes ~$3.45T in new tariff revenue offsetting OBBBA's gross $4.7T cost. Hover a column for detail.
        </p>
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
          {[["pct", "% of GDP"], ["nominal", "Nominal $"]].map(function (opt) {
            var active = mode === opt[0];
            return (
              <button key={opt[0]} onClick={function () { setMode(opt[0]); }} style={{
                fontSize: 12, fontWeight: active ? 600 : 400,
                padding: "5px 14px", borderRadius: 6, border: "none",
                background: active ? "#fff" : "transparent",
                color: active ? TEXT : MUTED,
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                cursor: "pointer", transition: "all 0.15s",
              }}>{opt[1]}</button>
            );
          })}
        </div>
      </div>
      <Card id="obbba-deficit-card" style={{ borderLeft: "4px solid " + AMBER, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Annual Deficits</h3>
        <ProjectionPanel years={years} baselineSeries={janDef} obbbaWithTariffSeries={febDef} obbbaNoTariffSeries={noTarDef} gdpByYear={gdpByYear} mode={mode} />
      </Card>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 20px" }}>
        Because so much debt is being added every year, the government will have to pay interest on a larger pile of debt every year. By 2035, our net interest payments will go up by 50% as a share of national income.
      </p>
      <Card id="obbba-ni-card" style={{ borderLeft: "4px solid " + RED }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Net Interest Payments</h3>
        <ProjectionPanel years={years} baselineSeries={janNI} obbbaWithTariffSeries={febNI} obbbaNoTariffSeries={noTarNI} gdpByYear={gdpByYear} mode={mode} />
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Sources: <a href="https://www.cbo.gov/publication/62105" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO February 2026 Budget Projections (pub. 62105)</a>; <a href="https://www.cbo.gov/publication/61570" target="_blank" rel="noreferrer" style={{ color: BLUE }}>CBO OBBBA cost estimate (pub. 61570)</a>.</p>
    </div>
  );
}

/* ── III.a  Crowding Out ─────────────────── */
function CrowdingOutPage({ spendingData, summaryData }) {
  var tour = useTour(9);
  var _hov = useState(null); var hovYear = _hov[0]; var setHovYear = _hov[1];

  var series = useMemo(function () {
    if (!spendingData || !summaryData) return [];
    var receipts = {};
    summaryData.filter(function (r) {
      return r.category === "Total Receipts" && !String(r.category).includes("Real");
    }).forEach(function (r) { receipts[r.year] = r.amount; });

    var interest = {};
    spendingData.filter(function (r) {
      return r.category === "Net interest" && r.year >= 1970 && r.year <= 2024;
    }).forEach(function (r) { interest[r.year] = r.amount; });

    var result = [];
    for (var y = 1970; y <= 2024; y++) {
      var ni = interest[y]; var rec = receipts[y];
      if (ni != null && rec != null && rec > 0) {
        result.push({ year: y, pct: (ni / rec) * 100, ni: ni, receipts: rec });
      }
    }
    return result;
  }, [spendingData, summaryData]);

  var latest  = series.length ? series[series.length - 1] : null;
  var hovRow  = hovYear != null ? series.find(function (r) { return r.year === hovYear; }) : null;
  var display = hovRow || latest;

  // 55 years, target ~900px wide → col = 900/55 ≈ 16px, gap 2px
  var BLK_SZ   = 14;
  var BLK_GAP  = 2;
  var BLK_CELL = BLK_SZ + BLK_GAP;
  var COL_GAP  = 2;
  var XAXIS_H  = 20;
  var MAX_CENTS = 22;

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Paying for the Past</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>

      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        Of every dollar the federal government collects in taxes, <strong style={{ color: RED }}>{display ? display.pct.toFixed(1) : "—"}¢</strong> goes straight to interest payments on our debt. Instead of spending for Americans in the present day on defense, housing, food, or education, we are spending almost 1/5 of our taxes on debt interest. You may notice that there was a large increase in the 1980s. This is partly due to Reagan administration policies that increased defense spending and decreased revenue (through tax cuts), and partly to very high interest rates set by the Federal Reserve to fight the inflation of the 1970s, making borrowing more expensive.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>
        {hovRow ? hovRow.year + " — " + hovRow.pct.toFixed(1) + "¢ per tax dollar" : "That's up from 7.5¢ in 1970. Hover any column to see that year."}
      </p>

      {/* Stat callout */}
      {display && (
        <div style={{ display: "flex", gap: 16, margin: "0 0 20px", flexWrap: "wrap" }}>
          <div style={{ background: "#fef2f2", borderRadius: 8, padding: "14px 20px", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              {hovRow ? hovRow.year : "FY" + latest.year} — per tax dollar
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, color: RED, lineHeight: 1 }}>
              {display.pct.toFixed(1)}¢
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>goes to interest</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, minWidth: 180 }}>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Net interest paid</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>${Math.round(display.ni / 1000)}B</div>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Total revenue</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>${Math.round(display.receipts / 1000)}B</div>
            </div>
          </div>
        </div>
      )}

      {/* Block bar chart */}
      <Card style={{ borderLeft: "4px solid " + RED, marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px" }}>Each block = 1¢ of every tax dollar going to interest. Hover a column for detail.</p>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: COL_GAP + "px", paddingBottom: XAXIS_H + "px", position: "relative" }}>
            {series.map(function (r) {
              var blocks   = Math.round(r.pct);
              var isHov    = hovYear === r.year;
              var showLabel = r.year % 5 === 0;
              return (
                <div key={r.year}
                  onMouseEnter={function () { setHovYear(r.year); }}
                  onMouseLeave={function () { setHovYear(null); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", position: "relative", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: BLK_GAP + "px" }}>
                    {Array.from({ length: blocks }).map(function (_, b) {
                      return (
                        <div key={b} style={{
                          width: BLK_SZ, height: BLK_SZ, borderRadius: 2,
                          backgroundColor: RED,
                          opacity: isHov ? 1 : 0.75,
                          transition: "opacity 0.1s",
                        }} />
                      );
                    })}
                  </div>
                  <div style={{
                    position: "absolute", bottom: -XAXIS_H,
                    fontSize: 9, color: isHov ? TEXT : MUTED,
                    fontWeight: isHov ? 700 : 400,
                    whiteSpace: "nowrap",
                    visibility: showLabel || isHov ? "visible" : "hidden",
                  }}>
                    {r.year}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        When the government borrows, it also competes with every other borrower in the economy, which pushes up interest rates. Higher rates mean more expensive mortgages, costlier business loans, and less private investment. The CBO estimates that for every dollar of deficit spending, private investment falls by about 33 cents.
      </p>

      <p style={{ fontSize: 12, color: MUTED }}>Sources: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables</a> (net interest, total receipts). CBO crowding-out estimate via <a href="https://www.pgpf.org/article/the-national-debt-can-crowd-out-investments-in-the-economy-heres-how/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>Peter G. Peterson Foundation</a>.</p>
    </div>
  );
}

/* ── III.a.ii  Japan Case Study ──────────── */
function CrowdingOutTextPage() {
  var _step = useState(0); var step = _step[0]; var setStep = _step[1];

  var POINTS = [
    {
      num: 1,
      heading: "Deficits and interest rates",
      body: "It is widely believed among economists that large deficits lead to higher interest rates. CBO estimates that each 1 percentage point increase in the debt-to-GDP ratio raises long-run interest rates by about 2 basis points (0.02%). With debt now at 100% of GDP and projected to hit 156% by 2055, that adds up.",
      source: "CBO, Effects of Federal Borrowing on Interest Rates and Treasury Markets (March 2025)",
      sourceUrl: "https://www.cbo.gov/system/files/2025-03/61230-Federal_Borrowing.pdf",
    },
    {
      num: 2,
      heading: "The Reagan evidence — and its limits",
      body: "The federal deficit peaked at 6% of GDP in 1983 under Reagan — up from 2.5% in 1981 — and the 10-year Treasury yield topped 15% in the early 1980s. But the Federal Reserve under Paul Volcker had deliberately raised rates to crush the inflation of the 1970s. It is impossible to separate the deficit effect from the monetary policy effect.",
      source: "Reaganomics — Econlib; AIER, The Federal Deficit and Debt: Trouble Ahead?",
      sourceUrl: "https://www.econlib.org/library/Enc/Reaganomics.html",
    },
    {
      num: 3,
      heading: "When deficits don't raise rates",
      body: "The deficit reached 9.8% of GDP in 2009 — the largest in 60 years — yet the 10-year Treasury yield fell from 4.6% in 2007 to 3.3% in 2009, and kept falling. In 2020, the deficit hit 15% of GDP while the 10-year yield dropped from 1.85% in January to under 1% by August. In both cases the Fed's emergency rate cuts overwhelmed any upward pressure from borrowing.",
      source: "PGPF, How Will Interest Rate Changes Affect Federal Debt and Deficits? (2021)",
      sourceUrl: "https://www.pgpf.org/article/how-will-interest-rate-changes-affect-federal-debt-and-deficits/",
    },
    {
      num: 4,
      heading: "The recession exception",
      body: "Economists largely treat recession-era deficits as a special case — when the economy is weak, investors flee to the safety of Treasury bonds, pushing yields down regardless of how much the government borrows. The more widely held view is that deficits run when the economy is at or near full employment do put upward pressure on interest rates.",
      source: "Bipartisan Policy Center, The Deficit in a Downturn (2025)",
      sourceUrl: "https://bipartisanpolicy.org/article/the-deficit-in-a-downturn-how-have-recessions-impacted-the-federal-budget/",
    },
    {
      num: 5,
      heading: "Crowding out investment",
      body: "CBO estimates that for every dollar the federal deficit increases, private investment falls by 33 cents — with a range of 15 to 50 cents depending on how much private saving and foreign capital offset the borrowing. Over 30 years, rising debt under current law could reduce average income growth by 16% relative to a debt-stable scenario.",
      source: "CBO, The Long-Run Effects of Federal Budget Deficits on National Saving and Private Domestic Investment, Working Paper 2014-02",
      sourceUrl: "https://www.cbo.gov/sites/default/files/cbofiles/attachments/45140-NSPDI_workingPaper.pdf",
    },
    {
      num: 6,
      heading: "Housing costs",
      body: "Higher interest rates have an outsized impact on housing construction. A 1 percentage point rise in mortgage rates reduces housing starts significantly, contributing directly to higher home prices. With the 30-year mortgage rate reaching 7–8% in 2023–24, housing starts fell sharply and home affordability hit historic lows.",
      source: "AAF, Examining the Consequences of a High and Rising National Debt (2025)",
      sourceUrl: "https://www.americanactionforum.org/insight/examining-the-consequences-of-a-high-and-rising-national-debt/",
    },
  ];

  var cur    = POINTS[step];
  var isLast = step === POINTS.length - 1;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: "0 0 16px" }}>Our Children</h2>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        Running government deficits can have mixed consequences for the economy, which is why some argue we are 'stealing from our children,' while others disagree. On one hand, persistent deficits can absorb a portion of national savings, leading to higher interest rates. As borrowing becomes more expensive, businesses may reduce investment in productive assets like factories and equipment, which can slow future economic growth, lower wages, and reduce tax revenues. Higher interest rates also directly affect households, particularly by making mortgages more costly, which can reduce housing construction and contribute to higher home prices.
      </p>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        On the other hand, these effects are often softened by global capital flows: when U.S. interest rates rise, foreign investors are attracted to invest in U.S. assets. While this helps keep interest rates from rising too sharply, it contributes to a trade deficit and increases the portion of U.S. debt held by foreign investors. This means that instead of owing money primarily within the country, the U.S. owes more to external creditors.
      </p>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 24px" }}>
        Overall, deficits can shift economic burdens into the future, but their actual impact depends on factors like economic conditions, global investment flows, and how borrowed funds are used.
      </p>

      {/* Crowding Out — stepped points */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center" }}>
        {POINTS.map(function (p, i) {
          return (
            <button key={i} onClick={function () { setStep(i); }} style={{
              width: i === step ? 10 : 7,
              height: i === step ? 10 : 7,
              borderRadius: "50%",
              border: "none", padding: 0, cursor: "pointer",
              background: i < step ? BLUE : i === step ? RED : BORDER,
              transition: "all 0.15s",
              flexShrink: 0,
            }} />
          );
        })}
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>{step + 1} of {POINTS.length}</span>
      </div>

      <Card style={{ borderLeft: "4px solid " + RED, marginBottom: 24, minHeight: 140 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Point {cur.num}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: "0 0 10px" }}>{cur.heading}</h3>
        <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 12px" }}>{cur.body}</p>
        {cur.source && (
          <div style={{ fontSize: 11, color: MUTED, borderTop: "1px solid " + BORDER, paddingTop: 8 }}>
            Source:{" "}
            <a href={cur.sourceUrl} target="_blank" rel="noopener noreferrer"
               style={{ color: MUTED, textDecoration: "underline" }}>
              {cur.source}
            </a>
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        {step > 0 && (
          <button onClick={function () { setStep(step - 1); }} style={{ padding: "10px 20px", fontSize: 13, borderRadius: 8, cursor: "pointer", border: "1px solid " + BORDER, background: SURFACE, color: TEXT }}>← Previous</button>
        )}
        {!isLast && (
          <button onClick={function () { setStep(step + 1); }} style={{ padding: "10px 20px", fontSize: 13, borderRadius: 8, cursor: "pointer", border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600 }}>Next →</button>
        )}
        {isLast && (
          <button onClick={function () { setStep(0); }} style={{ padding: "10px 20px", fontSize: 13, borderRadius: 8, cursor: "pointer", border: "1px solid " + BORDER, background: SURFACE, color: MUTED }}>↺ Start over</button>
        )}
      </div>
    </div>
  );
}

// Keep JapanPage defined but unused — remove if confirmed not needed
function JapanPage({ japanData }) {
  var _hov     = useState(null); var hovYear  = _hov[0];  var setHovYear  = _hov[1];
  var _eraStep = useState(0);    var eraStep  = _eraStep[0]; var setEraStep = _eraStep[1];
  var _tourOn  = useState(true);
  var tourOn   = _tourOn[0]; var setTourOn = _tourOn[1];

  function doneTour() { setTourOn(false); setEraStep(-1); }
  function reopenTour() { setTourOn(true); setEraStep(0); }

  // Era definitions
  var ERAS = [
    { id: "lost",    label: "Lost Decade",  years: [1991, 2002], color: "#fef2f2", border: "#dc2626",
      title: "The Lost Decade (1991–2002)",
      body: "After Japan's asset bubble burst in 1991, GDP growth collapsed and stayed near zero for over a decade. Debt began climbing rapidly as the government ran deficits in an effort to stimulate the economy. Despite the crisis, bond yields stayed relatively high." },
    { id: "zirp",    label: "ZIRP",         years: [2000, 2013], color: "#f0fdf4", border: "#2d6a4f",
      title: "Zero Interest Rate Policy (2000–2013)",
      body: "The Bank of Japan pioneered zero interest rate policy (ZIRP) to make borrowing easier, driving yields near zero. Debt continued rising through the 2008 financial crisis and the 2011 Tōhoku earthquake in efforts to stimulate the economy. The combination of near-zero rates and growing debt created the illusion of sustainability." },
    { id: "ycc",     label: "YCC",          years: [2013, 2024], color: "#fef2f2", border: "#dc2626",
      title: "Yield Curve Control / Abenomics (2013–2024)",
      body: "Under Prime Minister Abe, the Bank of Japan dramatically expanded bond purchases and eventually introduced Yield Curve Control, a policy capping 10-year yields at 0%. The government could borrow money for free, but only because the Bank of Japan purchased any outstanding debt. By 2023 the BoJ owned nearly half of all outstanding government bonds. Debt stabilized near 240% of GDP, but only because the central bank was absorbing all the supply." },
    { id: "now",     label: "Now",          years: [2024, 2025], color: "#e0f2fe", border: "#0369a1",
      title: "The Reckoning (2024–present)",
      body: "After COVID, Japan experienced inflation for the first time in decades and the BoJ ended YCC in March 2024. Interest rates surged to their highest levels since 1999. Japan's massive debt now carries a rising interest bill projected to double by 2030, crowding out healthcare, education, and defense spending. The consequences of decades of spending were deferred until now. The Japanese government must figure out how to foot the bill, and maintain programs for their aging population." },
  ];

  var activeEra = tourOn && eraStep >= 0 && eraStep < ERAS.length ? ERAS[eraStep] : null;

  var data = useMemo(function () {
    if (!japanData) return [];
    return japanData.filter(function (r) { return r.year >= 1990 && r.year <= 2025; });
  }, [japanData]);

  var hovRow = hovYear != null ? data.find(function (r) { return r.year === hovYear; }) : null;

  var CHART_W = 560;
  var CHART_H = 160;
  var PAD     = { top: 12, right: 20, bottom: 24, left: 44 };
  var plotW   = CHART_W - PAD.left - PAD.right;
  var plotH   = CHART_H - PAD.top  - PAD.bottom;

  function scaleX(year) {
    return PAD.left + ((year - 1990) / (2025 - 1990)) * plotW;
  }
  function scaleY(val, lo, hi) {
    return PAD.top + plotH - ((val - lo) / (hi - lo)) * plotH;
  }

  function LineChart({ series, color, yMin, yMax, yTicks, yLabel }) {
    var pts = series.filter(function (r) { return r.val != null && !isNaN(r.val); });
    var pathD = pts.map(function (r, i) {
      return (i === 0 ? "M" : "L") + scaleX(r.year).toFixed(1) + "," + scaleY(r.val, yMin, yMax).toFixed(1);
    }).join(" ");

    // Determine dim region: years outside active era
    var eraX1 = activeEra ? scaleX(activeEra.years[0]) : null;
    var eraX2 = activeEra ? scaleX(activeEra.years[1]) : null;

    return (
      <svg width="100%" viewBox={"0 0 " + CHART_W + " " + CHART_H} style={{ display: "block" }}>
        {/* Y gridlines */}
        {yTicks.map(function (t) {
          var y = scaleY(t, yMin, yMax);
          return (
            <React.Fragment key={t}>
              <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke={BORDER} strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="10" fill={MUTED}>{t}%</text>
            </React.Fragment>
          );
        })}
        {/* Zero line */}
        {yMin < 0 && yMax > 0 && (
          <line x1={PAD.left} y1={scaleY(0, yMin, yMax)} x2={PAD.left + plotW} y2={scaleY(0, yMin, yMax)}
            stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 2" />
        )}
        {/* X axis labels */}
        {[1990, 2000, 2010, 2020].map(function (yr) {
          return <text key={yr} x={scaleX(yr)} y={CHART_H - 4} textAnchor="middle" fontSize="10" fill={MUTED}>{yr}</text>;
        })}
        {/* Era highlight band */}
        {activeEra && (
          <rect x={eraX1} y={PAD.top} width={eraX2 - eraX1} height={plotH}
            fill={activeEra.color} opacity="0.7" />
        )}
        {/* Dim overlay outside era */}
        {activeEra && (
          <React.Fragment>
            <rect x={PAD.left} y={PAD.top} width={Math.max(0, eraX1 - PAD.left)} height={plotH}
              fill="white" opacity="0.55" />
            <rect x={eraX2} y={PAD.top} width={Math.max(0, PAD.left + plotW - eraX2)} height={plotH}
              fill="white" opacity="0.55" />
          </React.Fragment>
        )}
        {/* Data line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {/* Era border lines */}
        {activeEra && (
          <React.Fragment>
            <line x1={eraX1} y1={PAD.top} x2={eraX1} y2={PAD.top + plotH}
              stroke={activeEra.border} strokeWidth="1.5" strokeDasharray="4 2" />
            <line x1={eraX2} y1={PAD.top} x2={eraX2} y2={PAD.top + plotH}
              stroke={activeEra.border} strokeWidth="1.5" strokeDasharray="4 2" />
          </React.Fragment>
        )}
        {/* Hover dot */}
        {hovRow && !activeEra && (function () {
          var pt = pts.find(function (r) { return r.year === hovRow.year; });
          if (!pt) return null;
          return <circle cx={scaleX(pt.year)} cy={scaleY(pt.val, yMin, yMax)} r={5} fill={color} stroke="#fff" strokeWidth="1.5" />;
        })()}
        {/* Invisible hover targets (only when tour not active) */}
        {!activeEra && pts.map(function (r) {
          return (
            <rect key={r.year} x={scaleX(r.year) - 5} y={PAD.top} width="10" height={plotH}
              fill="transparent"
              onMouseEnter={function () { setHovYear(r.year); }}
              onMouseLeave={function () { setHovYear(null); }} />
          );
        })}
        <text x={8} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="10" fill={MUTED}
          transform={"rotate(-90," + 8 + "," + (PAD.top + plotH / 2) + ")"}>{yLabel}</text>
      </svg>
    );
  }

  var debtSeries  = data.map(function (r) { return { year: r.year, val: r.japan_debt_pct_gdp }; });
  var yieldSeries = data.map(function (r) { return { year: r.year, val: r.japan_10y_yield }; });
  var gdpSeries   = data.map(function (r) { return { year: r.year, val: r.japan_real_gdp_growth }; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>A Case Study: Japan</h2>
        <button onClick={reopenTour} style={{ background: "none", border: "1px solid " + BORDER, borderRadius: "50%", width: 26, height: 26, fontSize: 13, color: MUTED, cursor: "pointer", flexShrink: 0 }}>?</button>
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        Japan is often cited as proof that deficits don't cause high interest rates — its debt reached 260% of GDP while bond yields stayed near zero for three decades. But that stability had a hidden engine: the Bank of Japan bought nearly half of all outstanding government bonds, directly suppressing yields. When that ended in 2024, the bill came due.
      </p>

      {/* Era nav pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ERAS.map(function (era, i) {
          var active = tourOn && eraStep === i;
          return (
            <button key={era.id} onClick={function () { setTourOn(true); setEraStep(i); }} style={{
              padding: "4px 12px", fontSize: 12, borderRadius: 20, cursor: "pointer",
              border: "1.5px solid " + (active ? era.border : BORDER),
              background: active ? era.color : SURFACE,
              color: active ? "#111" : MUTED,
              fontWeight: active ? 600 : 400,
              transition: "all 0.15s",
            }}>{era.label}</button>
          );
        })}
        {tourOn && (
          <button onClick={doneTour} style={{
            padding: "4px 12px", fontSize: 12, borderRadius: 20, cursor: "pointer",
            border: "1px solid " + BORDER, background: SURFACE, color: MUTED,
          }}>Clear</button>
        )}
      </div>

      {/* Era annotation card */}
      {activeEra && (
        <div style={{
          background: activeEra.color, border: "1.5px solid " + activeEra.border,
          borderRadius: 8, padding: "12px 16px", marginBottom: 14,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{activeEra.title}</div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, margin: 0 }}>{activeEra.body}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {eraStep > 0 && (
              <button onClick={function () { setEraStep(eraStep - 1); }} style={{
                padding: "4px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                border: "1px solid " + BORDER, background: SURFACE, color: TEXT,
              }}>← Back</button>
            )}
            {eraStep < ERAS.length - 1 && (
              <button onClick={function () { setEraStep(eraStep + 1); }} style={{
                padding: "4px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600,
              }}>Next →</button>
            )}
            {eraStep === ERAS.length - 1 && (
              <button onClick={doneTour} style={{
                padding: "4px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600,
              }}>Done</button>
            )}
          </div>
        </div>
      )}

      {/* Hover callout (only when tour not active) */}
      {!activeEra && (
        <div style={{ minHeight: 28, marginBottom: 10 }}>
          {hovRow ? (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{hovRow.year}</span>
              {hovRow.japan_debt_pct_gdp != null && <span style={{ fontSize: 13, color: RED }}>Debt: {hovRow.japan_debt_pct_gdp.toFixed(0)}% of GDP</span>}
              {hovRow.japan_10y_yield != null && <span style={{ fontSize: 13, color: "#2d6a4f" }}>10yr yield: {hovRow.japan_10y_yield.toFixed(2)}%</span>}
              {hovRow.japan_real_gdp_growth != null && <span style={{ fontSize: 13, color: "#4a8b6f" }}>GDP growth: {hovRow.japan_real_gdp_growth.toFixed(1)}%</span>}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: MUTED }}>Hover any chart to see values for that year</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ borderLeft: "4px solid #4a0000", padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: RED, marginBottom: 6 }}>Government Debt (% of GDP)</div>
          <LineChart series={debtSeries} color="#4a0000" yMin={50} yMax={280} yTicks={[100,150,200,250]} yLabel="% GDP" />
        </Card>
        <Card style={{ borderLeft: "4px solid " + BLUE, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 6 }}>10-Year Government Bond Yield</div>
          <LineChart series={yieldSeries} color={"#2d6a4f"} yMin={-0.5} yMax={4} yTicks={[0,1,2,3]} yLabel="%" />
        </Card>
        <Card style={{ borderLeft: "4px solid #4a8b6f", padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4a8b6f", marginBottom: 6 }}>Real GDP Growth</div>
          <LineChart series={gdpSeries} color="#4a8b6f" yMin={-8} yMax={8} yTicks={[-4,0,4]} yLabel="%" />
        </Card>
      </div>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Sources: <a href="https://fred.stlouisfed.org/series/GGGDTAJPA188N" target="_blank" rel="noreferrer" style={{ color: BLUE }}>FRED GGGDTAJPA188N</a> / <a href="https://fred.stlouisfed.org/series/GGGDTPJPA188N" target="_blank" rel="noreferrer" style={{ color: BLUE }}>GGGDTPJPA188N</a> (IMF); <a href="https://fred.stlouisfed.org/series/IRLTLT01JPM156N" target="_blank" rel="noreferrer" style={{ color: BLUE }}>IRLTLT01JPM156N</a> (OECD); <a href="https://fred.stlouisfed.org/series/JPNRGDPEXP" target="_blank" rel="noreferrer" style={{ color: BLUE }}>JPNRGDPEXP</a> (Cabinet Office Japan). Debt 2024+ are IMF projections.</p>
    </div>
  );
}

/* ── III.b.i  Net Interest ───────────────── */
// Ported from App.jsx NetInterestPage, unchanged.
function NetInterestPage({ spendingData }) {
  var tour = useTour(11);

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
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The Rising Cost of Debt Service</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        As of FY2024, net interest payments have reached $880 billion on their own. This means interest payments alone are more costly than almost every major government program, including Medicare, national defense and education.
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
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 6, fontSize: 13, color: BLUE }}>
            In FY{cur.year}, {shortName} still exceeds net interest by {fmtAmt(compareAmt - interestAmt)}.
          </div>
        )}
      </Card>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Source: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables, FY2026 Budget</a> (Table 3.2 — outlays by function and subfunction, 1962–2030).</p>
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
function BudgetDilemmaPage({ spendingData, summaryData }) {
  var tour = useTour(12);
  var _hov = useState(null); var hovSlice = _hov[0]; var setHovSlice = _hov[1];

  var computed = useMemo(function () {
    if (!spendingData || !summaryData) return null;

    var spendRows = spendingData.filter(function (r) {
      return r.year === YEAR && !String(r.category).includes("Real");
    });

    var sumRow = summaryData.find(function (r) { return r.year === YEAR && r.category === "Total Outlays"; });
    var totalOutlays = sumRow ? sumRow.amount : 0;
    var defRow = summaryData.find(function (r) { return r.year === YEAR && r.category === "Surplus or Deficit"; });
    var deficit = defRow ? Math.abs(defRow.amount) : 0;
    var recRow = summaryData.find(function (r) { return r.year === YEAR && r.category === "Total Receipts"; });
    var totalReceipts = recRow ? recRow.amount : 0;

    // Build slices
    var SLICES = [
      { key: "Social Security", label: "Social Security", type: "mandatory",
        poll: "85% of Americans oppose cuts", pollSrc: "Navigator Research, 2025", pollUrl: "https://navigatorresearch.org/a-majority-of-americans-oppose-cuts-to-social-security-and-medicare/" },
      { key: "Medicare", label: "Medicare", type: "mandatory",
        poll: "79% of Americans oppose cuts", pollSrc: "KFF, April 2025", pollUrl: "https://www.kff.org/medicaid/poll-finding/kff-health-tracking-poll-april-2025-publics-view-on-major-cuts-to-federal-health-agencies/" },
      { key: "Health", label: "Medicaid & Health", type: "mandatory",
        poll: "75% of Americans oppose cuts", pollSrc: "KFF, April 2025", pollUrl: "https://www.kff.org/medicaid/poll-finding/kff-health-tracking-poll-april-2025-publics-view-on-major-cuts-to-federal-health-agencies/" },
      { key: "Income Security", label: "Income Security", type: "mandatory",
        poll: "SNAP and unemployment insurance — the two largest components — are broadly popular. 80% of Americans support SNAP; 68% support unemployment insurance.", pollSrc: "Pew Research, 2019", pollUrl: "https://www.pewresearch.org/politics/2019/04/11/little-public-support-for-reductions-in-federal-spending/" },
      { key: "National Defense", label: "National Defense", type: "discretionary",
        poll: "67% of Americans want to keep defense spending the same or increase it.", pollSrc: "Chicago Council on Global Affairs, 2024", pollUrl: "https://globalaffairs.org/research/public-opinion-survey/americans-prioritize-domestic-spending-over-foreign-aid" },
      { key: "Veterans Benefits and Services", label: "Veterans", type: "discretionary",
        poll: "84% of Americans oppose cuts to veterans healthcare", pollSrc: "Navigator Research, 2025", pollUrl: "https://navigatorresearch.org/a-majority-of-americans-oppose-cuts-to-social-security-and-medicare/" },
      { key: "Education, Training, Employment, and Social Services", label: "Education & Training", type: "discretionary",
        poll: null, pollSrc: null, pollUrl: null },
      { key: "Net interest", label: "Net Interest (Debt Service)", type: "interest",
        poll: "Cannot be cut — legal obligation to bondholders", pollSrc: null, pollUrl: null },
    ];

    var sliceData = [];
    var accounted = 0;
    SLICES.forEach(function (s) {
      var row = spendRows.find(function (r) { return r.category === s.key; });
      if (row) {
        sliceData.push(Object.assign({}, s, { amount: row.amount }));
        if (s.key !== "Net interest") accounted += row.amount;  // exclude interest from accounted so All Other is correct
      }
    });
    // Pull Net Interest out, insert All Other before it, then put it back at the end
    var niIdx = sliceData.findIndex(function (s) { return s.key === "Net interest"; });
    var niSlice = niIdx >= 0 ? sliceData.splice(niIdx, 1)[0] : null;
    var other = totalOutlays - accounted - (niSlice ? niSlice.amount : 0);
    if (other > 0) sliceData.push({ key: "other", label: "All Other Discretionary", type: "discretionary", amount: other, poll: null, pollSrc: null, pollUrl: null });
    if (niSlice) sliceData.push(niSlice);

    return { slices: sliceData, totalOutlays: totalOutlays, deficit: deficit, totalReceipts: totalReceipts };
  }, [spendingData, summaryData]);

  if (!computed) return null;

  var TYPE_COLORS = {
    interest:      "#1a1a2e",  // near-black — distinct from red mandatory
    mandatory:     "#dc2626",
    discretionary: "#166534",
  };
  var TYPE_LABELS = {
    interest:      "Debt Interest — legal obligation, cannot be cut",
    mandatory:     "Mandatory spending — entitlement by law, politically untouchable",
    discretionary: "Discretionary — theoretically cuttable",
  };

  // SVG donut chart
  var CX = 180; var CY = 180; var R_OUT = 155; var R_IN = 85;
  var total = computed.slices.reduce(function (s, c) { return s + c.amount; }, 0);
  var segments = [];
  var angle = -Math.PI / 2; // start at top
  computed.slices.forEach(function (slice) {
    var sweep = (slice.amount / total) * 2 * Math.PI;
    segments.push({ slice: slice, startAngle: angle, endAngle: angle + sweep });
    angle += sweep;
  });

  function polarToXY(cx, cy, r, a) {
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(seg, inflate) {
    var r = inflate ? R_OUT + 6 : R_OUT;
    var ri = inflate ? R_IN - 6 : R_IN;
    var midA = (seg.startAngle + seg.endAngle) / 2;
    var ox = inflate ? Math.cos(midA) * 6 : 0;
    var oy = inflate ? Math.sin(midA) * 6 : 0;
    var p1 = polarToXY(CX + ox, CY + oy, r,  seg.startAngle);
    var p2 = polarToXY(CX + ox, CY + oy, r,  seg.endAngle);
    var p3 = polarToXY(CX + ox, CY + oy, ri, seg.endAngle);
    var p4 = polarToXY(CX + ox, CY + oy, ri, seg.startAngle);
    var large = (seg.endAngle - seg.startAngle) > Math.PI ? 1 : 0;
    return [
      "M", p1.x.toFixed(2), p1.y.toFixed(2),
      "A", r, r, 0, large, 1, p2.x.toFixed(2), p2.y.toFixed(2),
      "L", p3.x.toFixed(2), p3.y.toFixed(2),
      "A", ri, ri, 0, large, 0, p4.x.toFixed(2), p4.y.toFixed(2),
      "Z"
    ].join(" ");
  }

  var hovSeg = hovSlice ? segments.find(function (s) { return s.slice.key === hovSlice; }) : null;
  var hovData = hovSeg ? hovSeg.slice : null;

  // Discretionary total
  var discretionary = computed.slices.filter(function (s) { return s.type === "discretionary"; })
    .reduce(function (a, s) { return a + s.amount; }, 0);

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>The Budget Dilemma</h2>
        <TourBtn onOpen={tour.reopen} />
      </div>

      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 10px" }}>
        To close the deficit, the government must cut spending or raise taxes. But most of the budget is untouchable: either a legal obligation that cannot be broken, or a program so popular that cutting it is political suicide.
      </p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
        {/* Donut chart */}
        <div style={{ flexShrink: 0 }}>
          <svg width="360" height="360" style={{ display: "block" }}>
            {segments.map(function (seg) {
              var isHov = hovSlice === seg.slice.key;
              var color = TYPE_COLORS[seg.slice.type];
              // Shade variants by slice within type
              return (
                <path key={seg.slice.key}
                  d={arcPath(seg, isHov)}
                  fill={color}
                  opacity={hovSlice ? (isHov ? 1 : 0.35) : 0.82}
                  stroke="#fff" strokeWidth="2"
                  style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                  onMouseEnter={function () { setHovSlice(seg.slice.key); }}
                  onMouseLeave={function () { setHovSlice(null); }}
                />
              );
            })}
            {/* Center label */}
            <text x={CX} y={CY - 14} textAnchor="middle" fontSize="13" fill={MUTED}>FY{YEAR} spending</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="22" fontWeight="800" fill={TEXT}>
              ${(computed.totalOutlays / 1e6).toFixed(1)}T
            </text>
            <text x={CX} y={CY + 30} textAnchor="middle" fontSize="12" fill={RED}>
              −{fmtAmt(computed.deficit)} deficit
            </text>
          </svg>
        </div>

        {/* Right panel — hover detail or legend */}
        <div style={{ flex: 1, minWidth: 220 }}>
          {hovData ? (
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "18px 20px", borderLeft: "4px solid " + TYPE_COLORS[hovData.type] }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TYPE_COLORS[hovData.type], marginBottom: 4 }}>{hovData.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 8 }}>{fmtAmt(hovData.amount)}</div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{((hovData.amount / computed.totalOutlays) * 100).toFixed(1)}% of total spending</div>
              {hovData.type === "interest" && (
                <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, margin: 0 }}>
                  Interest payments are a legal obligation — missing them would constitute a sovereign default, destroying the US credit rating and triggering a global financial crisis.
                </p>
              )}
              {hovData.type === "mandatory" && (
                <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, margin: 0 }}>
                  "Mandatory" means spending is set by statute — anyone who meets eligibility criteria is entitled to benefits by law. Congress would have to pass new legislation to cut it.
                  {hovData.poll && hovData.pollSrc && (
                    <span style={{ display: "block", marginTop: 8, color: RED, fontWeight: 600 }}>
                      {hovData.poll} —{" "}
                      {hovData.pollUrl
                        ? <a href={hovData.pollUrl} target="_blank" rel="noreferrer" style={{ color: RED }}>{hovData.pollSrc}</a>
                        : hovData.pollSrc}
                    </span>
                  )}
                </p>
              )}
              {hovData.type === "discretionary" && (
                <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, margin: 0 }}>
                  Discretionary spending is set annually by Congress and is theoretically cuttable. But eliminating all of it — defense, education, infrastructure, foreign aid — would still leave a large deficit.
                  {hovData.poll && hovData.pollSrc && (
                    <span style={{ display: "block", marginTop: 8, color: RED, fontWeight: 600 }}>
                      {hovData.poll} —{" "}
                      {hovData.pollUrl
                        ? <a href={hovData.pollUrl} target="_blank" rel="noreferrer" style={{ color: RED }}>{hovData.pollSrc}</a>
                        : hovData.pollSrc}
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(TYPE_LABELS).map(function (e) {
                return (
                  <div key={e[0]} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: TYPE_COLORS[e[0]], flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>{e[1]}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 8, padding: "12px 14px", background: "#fef2f2", borderRadius: 8, borderLeft: "3px solid " + RED }}>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>
                  To close the {fmtAmt(computed.deficit)} deficit through spending cuts alone,
                  you would need to eliminate every discretionary program entirely: all of defense, veterans benefits, education, housing, and foreign aid. That totals {fmtAmt(discretionary)}.
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Deficit</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: RED }}>−{fmtAmt(computed.deficit)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 16, color: MUTED }}>vs.</div>
                  <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>All discretionary</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#2d6a4f" }}>{fmtAmt(discretionary)}</div>
                  </div>
                </div>

              </div>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Hover a slice for details and polling data.</p>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 16px" }}>
        Why is "mandatory" spending actually mandatory? Programs like Social Security, Medicare, and Medicaid are set up so that anyone who meets the eligibility criteria is legally entitled to benefits. To protect the public, the government cannot simply decide to pay less one year. Cutting them requires passing new laws, which is politically nearly impossible: 85% of Americans oppose cuts to Social Security and 75% oppose cuts to Medicaid. However, with the debt growing quickly, the problem is only getting worse.
      </p>
      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 6px" }}>
        That leaves the tax side of the ledger to make up the difference.
      </p>

      <p style={{ fontSize: 12, color: MUTED }}>
        Sources: <a href="https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>OMB Historical Tables FY{YEAR}</a>.
        {" "}Polling: <a href="https://navigatorresearch.org/a-majority-of-americans-oppose-cuts-to-social-security-and-medicare/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>Navigator Research (Jan 2026)</a>;{" "}
        <a href="https://www.kff.org/medicaid/poll-finding/kff-health-tracking-poll-april-2025-publics-view-on-major-cuts-to-federal-health-agencies/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>KFF Health Tracking Poll (April 2025)</a>;{" "}
        <a href="https://globalaffairs.org/research/public-opinion-survey/americans-prioritize-domestic-spending-over-foreign-aid" target="_blank" rel="noreferrer" style={{ color: BLUE }}>Chicago Council on Global Affairs (2024)</a>;{" "}
        <a href="https://www.pewresearch.org/politics/2019/04/11/little-public-support-for-reductions-in-federal-spending/" target="_blank" rel="noreferrer" style={{ color: BLUE }}>Pew Research (2019)</a>.
      </p>
    </div>
  );
}

/* ── III.d  Tax Page ─────────────────────── */
function TaxPage({ taxData, spendingData, summaryData }) {
  var tour = useTour(13);

  // Parse CSV into lookup
  var brackets = useMemo(function () {
    if (!taxData) return [];
    return taxData;
  }, [taxData]);

  // FY2024 discretionary — identical to BudgetDilemmaPage:
  // totalOutlays - named mandatory categories - net interest
  var discretionaryB = useMemo(function () {
    if (!spendingData || !summaryData) return 1950;
    var MANDATORY_KEYS = ["Social Security", "Medicare", "Health", "Income Security"];
    var spendRows = spendingData.filter(function (r) { return r.year === YEAR && !String(r.category).includes("Real"); });
    var mandatory = MANDATORY_KEYS.reduce(function (s, k) {
      var row = spendRows.find(function (r) { return r.category === k; });
      return s + (row ? row.amount : 0);
    }, 0);
    var niRow = spendRows.find(function (r) { return r.category === "Net interest"; });
    var ni = niRow ? niRow.amount : 0;
    var sumRow = summaryData.find(function (r) { return r.year === YEAR && r.category === "Total Outlays"; });
    var totalOutlays = sumRow ? sumRow.amount : 0;
    return (totalOutlays - mandatory - ni) / 1000; // millions → billions
  }, [spendingData, summaryData]);

  // Spending cut slider state — 0 to 100% cut
  var _cutPct = useState(0); var cutPct = _cutPct[0]; var setCutPct = _cutPct[1];
  var spendingSavings = (cutPct / 100) * discretionaryB; // billions saved

  // Slider state: rate increase in pp per bucket (0-20)
  // State tracks absolute effective rate per bucket, initialized at current rate
  var _rates = useState(null);
  var ratesRaw = _rates[0]; var setRates = _rates[1];

  // Initialize from data once loaded
  var rates = useMemo(function () {
    if (ratesRaw) return ratesRaw;
    var init = {};
    brackets.forEach(function (b) { init[b.bucket] = b.effective_rate_pct; });
    return init;
  }, [ratesRaw, brackets]);

  function setRate(bucket, val) {
    setRates(function (prev) {
      var base = prev || {};
      if (!prev) { brackets.forEach(function (b) { base[b.bucket] = b.effective_rate_pct; }); }
      return Object.assign({}, base, { [bucket]: val });
    });
  }

  function resetRates() {
    setRates(null);
    setCutPct(0);
  }

  var isDirty = cutPct > 0 || brackets.some(function (b) {
    return rates[b.bucket] !== undefined && rates[b.bucket] !== b.effective_rate_pct;
  });

  var DEFICIT_B = 1695; // FY2023 deficit in billions — matches IRS Tax Year 2023 data

  // Additional revenue = delta from current rate * revenue_per_1pp
  var additionalRevenue = useMemo(function () {
    return brackets.reduce(function (sum, b) {
      var currentRate = rates[b.bucket] !== undefined ? rates[b.bucket] : b.effective_rate_pct;
      var delta = currentRate - b.effective_rate_pct;
      return sum + (b.revenue_per_1pp_b * delta);
    }, 0);
  }, [brackets, rates]);

  var totalClosed = additionalRevenue + spendingSavings; // billions
  var pctOfDeficit = Math.min(100, (totalClosed / DEFICIT_B) * 100);

  var BUCKET_COLORS = {
    "Under $25K":   "#4a8b6f",
    "$25K to $75K": "#3d7d60",
    "$75K to $200K":"#6b7a00",
    "$200K to $1M": "#dc2626",
    "Over $1M":     "#991b1b",
  };

  function setIncrease(bucket, val) {
    setIncreases(function (prev) {
      return Object.assign({}, prev, { [bucket]: val });
    });
  }

  var ORDER = ["Under $25K", "$25K to $75K", "$75K to $200K", "$200K to $1M", "Over $1M"];

  return (
    <div>
      {tour.show && <Tour steps={tour.steps} onDone={tour.done} />}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>Raising Taxes</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isDirty && (
            <button onClick={resetRates} style={{
              fontSize: 12, padding: "3px 12px", borderRadius: 6, cursor: "pointer",
              border: "1px solid " + BORDER, background: SURFACE, color: MUTED,
            }}>Reset</button>
          )}
          <TourBtn onOpen={tour.reopen} />
        </div>
      </div>

      <p style={{ fontSize: 15, color: TEXT, lineHeight: 1.75, margin: "0 0 10px" }}>
        The other lever is raising taxes. Use the sliders below to increase effective tax rates on each income group and see how much additional revenue it would generate against the FY2023 $1.70T deficit.
      </p>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px" }}>
        Note: these are static scores based on IRS Tax Year 2023 data, matched to the FY2023 deficit of $1.7T. Real revenue would be somewhat lower due to behavioral responses like tax avoidance, reduced hours, and income shifting.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: MUTED }}>Deficit closed</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: totalClosed >= DEFICIT_B ? BLOCK_POS : BLOCK_NEG }}>
            {totalClosed >= DEFICIT_B ? "Surplus +" + fmtAmt((totalClosed - DEFICIT_B) * 1000) : fmtAmt(totalClosed * 1000) + " of " + fmtAmt(DEFICIT_B * 1000)}
          </span>
        </div>
        <div style={{ height: 14, background: "#f3f4f6", borderRadius: 7, overflow: "hidden", display: "flex" }}>
          {/* Spending savings — green segment */}
          {spendingSavings > 0 && (
            <div style={{ height: "100%", width: Math.min(100, spendingSavings / DEFICIT_B * 100) + "%", background: BLOCK_POS, transition: "width 0.2s ease" }} />
          )}
          {/* Tax revenue — second segment */}
          {additionalRevenue > 0 && (
            <div style={{ height: "100%", width: Math.min(100 - Math.min(100, spendingSavings / DEFICIT_B * 100), additionalRevenue / DEFICIT_B * 100) + "%", background: "#166534", transition: "width 0.2s ease" }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {spendingSavings > 0 && <span style={{ fontSize: 11, color: BLOCK_POS }}>▪ Spending cuts: {fmtAmt(spendingSavings * 1000)}</span>}
            {additionalRevenue > 0 && <span style={{ fontSize: 11, color: "#166534" }}>▪ Tax revenue: {fmtAmt(additionalRevenue * 1000)}</span>}
          </div>
          <span style={{ fontSize: 11, color: MUTED }}>{fmtAmt(DEFICIT_B * 1000)} deficit</span>
        </div>
      </div>

      {/* Section I — Spending */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLOCK_POS, textTransform: "uppercase", letterSpacing: 1.5, whiteSpace: "nowrap" }}>Spending Cuts</div>
        <div style={{ flex: 1, height: 1, background: BLOCK_POS, opacity: 0.25 }} />
      </div>

      {/* Discretionary spending cut slider */}
      <Card style={{ borderLeft: "4px solid " + BLOCK_POS, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: BLOCK_POS }}>Discretionary Spending Cut</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              FY{YEAR} discretionary total: {fmtAmt(discretionaryB * 1000)} · Across-the-board cut to all discretionary programs
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Savings</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: spendingSavings > 0 ? BLOCK_POS : MUTED }}>
              {spendingSavings > 0 ? "+" + fmtAmt(spendingSavings * 1000) : "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>0%</span>
          <input type="range" min={0} max={100} step={1} value={cutPct}
            onChange={function (e) { setCutPct(Number(e.target.value)); }}
            style={{ flex: 1, accentColor: BLOCK_POS, cursor: "grab" }} />
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>100%</span>
          <div style={{ minWidth: 80, textAlign: "right" }}>
            {cutPct > 0
              ? <span style={{ fontSize: 13, fontWeight: 600, color: BLOCK_POS }}>{cutPct}% cut</span>
              : <span style={{ fontSize: 13, color: MUTED }}>No cut</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
          Includes defense, veterans, education, transportation, foreign aid, and other annual appropriations. Does not include Social Security, Medicare, Medicaid, or net interest.
        </div>
      </Card>

      {/* Section II — Tax Increases */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 1.5, whiteSpace: "nowrap" }}>Tax Increases</div>
        <div style={{ flex: 1, height: 1, background: RED, opacity: 0.25 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {ORDER.map(function (bucketName) {
          var b = brackets.find(function (x) { return x.bucket === bucketName; });
          if (!b) return null;
          var currentRate = rates[bucketName] !== undefined ? rates[bucketName] : b.effective_rate_pct;
          var delta  = currentRate - b.effective_rate_pct;
          var added  = b.revenue_per_1pp_b * delta;
          var color  = BUCKET_COLORS[bucketName];
          return (
            <Card key={bucketName} style={{ borderLeft: "4px solid " + color, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: color }}>{bucketName}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {b.num_returns_millions.toFixed(1)}M returns · ${(b.taxable_income_b / 1000).toFixed(2)}T taxable income · current effective rate {b.effective_rate_pct}%
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: MUTED }}>Additional revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: added > 0 ? color : added < 0 ? RED : MUTED }}>
                    {added > 0 ? "+" + fmtAmt(added * 1000) : added < 0 ? "-" + fmtAmt(Math.abs(added) * 1000) : "—"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>0%</span>
                <input type="range" min={0} max={100} step={0.5} value={currentRate}
                  onChange={function (e) { setRate(bucketName, Number(e.target.value)); }}
                  style={{ flex: 1, accentColor: delta === 0 ? MUTED : delta > 0 ? color : RED, cursor: "grab" }} />
                <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>100%</span>
                <div style={{ minWidth: 110, textAlign: "right" }}>
                  {delta !== 0 ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: delta > 0 ? color : RED }}>
                      {b.effective_rate_pct}% → {currentRate.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: MUTED }}>{b.effective_rate_pct}% (current)</span>
                  )}
                </div>
              </div>

              {/* Revenue per pp callout */}
              <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                Each percentage point raises ~${b.revenue_per_1pp_b.toFixed(1)}B/year
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary if anything selected */}
      {(additionalRevenue !== 0 || spendingSavings > 0) && (
        <div style={{ background: totalClosed >= DEFICIT_B ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "16px 20px", marginBottom: 20, borderLeft: "4px solid " + (totalClosed >= DEFICIT_B ? BLOCK_POS : BLOCK_NEG) }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: TEXT }}>
            {spendingSavings > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: BLOCK_POS }}>Discretionary cuts ({cutPct}%)</span>
                <span style={{ color: BLOCK_POS }}>+{fmtAmt(spendingSavings * 1000)}/yr</span>
              </div>
            )}
            {ORDER.map(function (bucketName) {
              var b   = brackets.find(function (x) { return x.bucket === bucketName; });
              var cr = rates[bucketName] !== undefined ? rates[bucketName] : b.effective_rate_pct;
              var d  = cr - b.effective_rate_pct;
              if (d === 0 || !b) return null;
              var rev = b.revenue_per_1pp_b * d;
              return (
                <div key={bucketName} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: BUCKET_COLORS[bucketName] }}>{bucketName}: {b.effective_rate_pct}% → {cr.toFixed(1)}%</span>
                  <span style={{ color: d > 0 ? BUCKET_COLORS[bucketName] : RED }}>{d > 0 ? "+" : ""}{fmtAmt(rev * 1000)}/yr</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid " + BORDER, paddingTop: 6, marginTop: 4, fontWeight: 700 }}>
              <span>Total deficit reduction</span>
              <span style={{ color: totalClosed >= DEFICIT_B ? BLOCK_POS : BLOCK_NEG }}>+{fmtAmt(totalClosed * 1000)}/yr</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Remaining deficit</span>
              <span style={{ color: totalClosed >= DEFICIT_B ? BLOCK_POS : BLOCK_NEG }}>
                {totalClosed >= DEFICIT_B
                  ? "Surplus +" + fmtAmt((totalClosed - DEFICIT_B) * 1000)
                  : fmtAmt((DEFICIT_B - totalClosed) * 1000) + " remaining"}
              </span>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: MUTED }}>
        Source: <a href="https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-returns-complete-report-publication-1304" target="_blank" rel="noreferrer" style={{ color: BLUE }}>IRS Statistics of Income, Publication 1304, Table 1.4, Tax Year 2023</a>.
        Static scoring only — does not account for behavioral responses or supply-side effects.
      </p>

      <div style={{ textAlign: "center", marginTop: 24, paddingTop: 20, borderTop: "1px solid " + BORDER }}>
        <a href="/obbba/" style={{
          display: "inline-block", padding: "10px 24px", background: BLUE, color: "#fff",
          borderRadius: 8, textDecoration: "none", fontSize: 15, fontWeight: 600,
        }}>← Back to the Impact Map</a>
      </div>
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
  var _menuOpen   = useState(false); var menuOpen   = _menuOpen[0];   var setMenuOpen   = _menuOpen[1];
  var _expanded   = useState({});    var expanded   = _expanded[0];   var setExpanded   = _expanded[1];
  var pendingPage = useRef(null);
  var menuRef     = useRef(null);

  var total    = PAGES.length;
  var pageMeta = PAGES[page] || PAGES[0];
  var section  = pageMeta.section != null ? SECTIONS[pageMeta.section] : null;

  function navigate(next) {
    if (next === page || next < 0 || next >= total) return;
    var d = next > page ? 1 : -1;
    pendingPage.current = { next: next, d: d };
    setDir(d);
    setVisible(false);
    setMenuOpen(false);
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

  // Close menu on outside click
  useEffect(function () {
    if (!menuOpen) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return function () { document.removeEventListener("mousedown", handler); };
  }, [menuOpen]);

  // Auto-expand the section containing the current page
  useEffect(function () {
    if (pageMeta.section != null) {
      setExpanded(function (prev) { return Object.assign({}, prev, { [pageMeta.section]: true }); });
    }
  }, [page]);

  var ty = visible ? "translateY(0)" : (dir > 0 ? "translateY(-40px)" : "translateY(40px)");

  // Build section→pages lookup
  var sectionGroups = SECTIONS.map(function (s) {
    var items = PAGES.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.section === s.id; });
    return { s: s, items: items };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, fontFamily: "'Segoe UI', system-ui, sans-serif", color: TEXT }}>

      {/* Nav bar */}
      <div style={{ background: "#1e3a5f", padding: "10px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, position: "relative", zIndex: 200 }}>
        {page > 0 && (
          <button onClick={function () { navigate(page - 1); }}
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>←</button>
        )}

        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3, color: "#fff", flexShrink: 0 }}>Visualize Policy</span>

        <div style={{ flex: 1 }} />

        {/* Current page label */}
        {pageMeta.title && (
          <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
            {pageMeta.title}
          </span>
        )}

        {/* Hamburger / menu button */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={function () { setMenuOpen(!menuOpen); }}
            style={{ background: menuOpen ? "rgba(255,255,255,0.12)" : "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, color: "#fff", cursor: "pointer", padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ width: 16, height: 2, background: "#fff", borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: "#fff", borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: "#fff", borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 12 }}>Menu</span>
          </button>

          {/* Dropdown panel */}
          {menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "#fff", borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              border: "1px solid " + BORDER,
              minWidth: 280, zIndex: 300,
              overflow: "hidden",
            }}>
              {/* Intro */}
              <button onClick={function () { navigate(0); }} style={{
                width: "100%", textAlign: "left", padding: "11px 16px",
                background: page === 0 ? "#f0f4ff" : "none",
                border: "none", borderBottom: "1px solid " + BORDER,
                fontSize: 13, fontWeight: page === 0 ? 600 : 400,
                color: page === 0 ? "#1e3a5f" : TEXT, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: page === 0 ? "#1e3a5f" : BORDER, flexShrink: 0 }} />
                Introduction
              </button>

              {/* Sections */}
              {sectionGroups.map(function (sg, si) {
                var firstIdx = sg.items[0] ? sg.items[0].i : 0;
                var lastIdx  = sg.items[sg.items.length - 1] ? sg.items[sg.items.length - 1].i : 0;
                var inSection = page >= firstIdx && page <= lastIdx;
                var isOpen   = expanded[sg.s.id] !== false && (inSection || expanded[sg.s.id]);

                return (
                  <div key={sg.s.id}>
                    {/* Section header — clickable to expand/jump */}
                    <button
                      onClick={function () { setExpanded(function (prev) { return Object.assign({}, prev, { [sg.s.id]: !isOpen }); }); }}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "10px 16px",
                        background: inSection ? "#f8f6ff" : "none",
                        border: "none",
                        borderBottom: isOpen ? "none" : "1px solid " + BORDER,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: sg.s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: sg.s.color, textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>
                        {sg.s.label}
                      </span>
                      <span style={{ fontSize: 11, color: MUTED, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
                    </button>

                    {/* Pages within section */}
                    {isOpen && (
                      <div style={{ borderBottom: "1px solid " + BORDER }}>
                        {sg.items.map(function (x) {
                          var isActive = page === x.i;
                          var isDone   = page > x.i;
                          return (
                            <button key={x.i} onClick={function () { navigate(x.i); }} style={{
                              width: "100%", textAlign: "left",
                              padding: "8px 16px 8px 36px",
                              background: isActive ? "#f0f4ff" : "none",
                              border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 8,
                              fontSize: 13,
                              color: isActive ? "#1e3a5f" : isDone ? MUTED : TEXT,
                              fontWeight: isActive ? 600 : 400,
                            }}>
                              <div style={{
                                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                background: isActive ? sg.s.color : isDone ? "#5a9a7a" : BORDER,
                              }} />
                              {x.p.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section entry banner */}
      {section && pageMeta.title && (
        <div style={{ background: section.color, padding: "6px 28px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1.5 }}>{section.label}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>·</span>
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{pageMeta.title}</span>
        </div>
      )}

      {/* Page content */}
      <div data-content-scroll="1" style={{
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
        {prompt && page > 0 && page < total - 1 && (
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
  var projSummary     = useCSV("projections_summary.csv");
  var deficitData     = useCSV("deficit_pct_gdp.csv");
  var debtPctData     = useCSV("debt_pct_gdp.csv");
  var stabilizersData = useCSV("automatic_stabilizers.csv");
  var stimulusData    = useCSV("stimulus_spending.csv");
  var crowdingData    = useCSV("crowding_out.csv");
  var japanData       = useCSV("japan_case_study.csv");
  var taxData         = useCSV("tax_brackets.csv");

  var _p = useState(0); var page = _p[0]; var setPage = _p[1];

  var loading = !spendingData || !receiptsData || !summaryData || !debtData || !deficitProj || !niProj || !deficitData || !debtPctData || !stabilizersData || !stimulusData || !crowdingData || !taxData;

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 16, color: MUTED }}>
        Loading…
      </div>
    );
  }

  // Page components indexed to match PAGES manifest
  var pages = [
    /* 0  */ <IntroPage onNavigate={setPage} />,
    /* 1  */ <DeficitHistoryPage deficitData={deficitData} />,
    /* 2  */ <DebtAccumulation   summaryData={summaryData} debtData={debtData} />,
    /* 3  */ <DebtToGDPPage      debtPctData={debtPctData} />,
    /* 4  */ <ObamaEraPage       stabilizersData={stabilizersData} stimulusData={stimulusData} />,
    /* 5  */ <DeficitPage        summaryData={summaryData} />,
    /* 6  */ <RevSpendPage       spendingData={spendingData} receiptsData={receiptsData} summaryData={summaryData} />,
    /* 7  */ <OBBBAPage          deficitProj={deficitProj} niProj={niProj} projSummary={projSummary} />,
    /* 8  */ <ProjectedDebtPage  deficitProj={deficitProj} projSummary={projSummary} />,
    /* 9  */ <CrowdingOutPage    spendingData={spendingData} summaryData={summaryData} />,
    /* 10 */ <CrowdingOutTextPage />,
    /* 11 */ <NetInterestPage    spendingData={spendingData} />,
    /* 12 */ <BudgetDilemmaPage  spendingData={spendingData} summaryData={summaryData} />,
    /* 13 */ <TaxPage taxData={taxData} deficitProj={deficitProj} spendingData={spendingData} summaryData={summaryData} />,
  ];

  return (
    <PageShell page={page} setPage={setPage} prompt={PAGES[page].prompt}>
      {pages[page]}
    </PageShell>
  );
}
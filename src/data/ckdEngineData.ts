// ─── Patient Profile ──────────────────────────────────────────────────────────
export const ckdPatient = {
  name: "Tony K.",
  age: 58,
  weight: "74 kg",
  stage: "CKD Stage 3b → 4",
  comorbidities: ["Type 2 Diabetes (12 yr)", "Hypertension (8 yr)", "Anaemia of CKD"],
  medications: ["Ramipril 5 mg OD", "Metformin 1000 mg BD", "Amlodipine 5 mg OD", "Erythropoietin 2000 IU/wk"],
};

// ─── 6-Month Lab Table ─────────────────────────────────────────────────────────
export const labMonths: string[] = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface LabRow {
  marker: string;
  unit: string;
  normal: string;
  values: number[];
  thresholds: { critical: number; warning: number };
  direction: "up" | "down";
}

export const labRows: LabRow[] = [
  {
    marker: "eGFR",
    unit: "mL/min",
    normal: "> 60",
    values: [42, 38, 35, 33, 30, 28],
    thresholds: { critical: 30, warning: 45 },
    direction: "down",
  },
  {
    marker: "Creatinine",
    unit: "mg/dL",
    normal: "0.7–1.3",
    values: [1.62, 1.78, 1.93, 2.05, 2.25, 2.41],
    thresholds: { critical: 2.0, warning: 1.5 },
    direction: "up",
  },
  {
    marker: "Potassium",
    unit: "mEq/L",
    normal: "3.5–5.0",
    values: [4.2, 4.5, 4.7, 4.9, 5.2, 5.4],
    thresholds: { critical: 5.5, warning: 5.0 },
    direction: "up",
  },
  {
    marker: "Bicarbonate",
    unit: "mEq/L",
    normal: "22–29",
    values: [22, 21, 20, 19, 18, 17],
    thresholds: { critical: 17, warning: 20 },
    direction: "down",
  },
  {
    marker: "Albumin",
    unit: "g/dL",
    normal: "3.5–5.0",
    values: [3.8, 3.6, 3.5, 3.4, 3.2, 3.1],
    thresholds: { critical: 3.0, warning: 3.5 },
    direction: "down",
  },
  {
    marker: "BUN",
    unit: "mg/dL",
    normal: "7–20",
    values: [28, 32, 36, 40, 45, 49],
    thresholds: { critical: 45, warning: 30 },
    direction: "up",
  },
  {
    marker: "Haemoglobin",
    unit: "g/dL",
    normal: "12–17",
    values: [11.2, 10.9, 10.7, 10.4, 10.2, 9.8],
    thresholds: { critical: 10.0, warning: 11.0 },
    direction: "down",
  },
];

// ─── Rule Engine Architecture ─────────────────────────────────────────────────
export const ruleCategories = [
  {
    id: "TR",
    name: "Trend Rules",
    icon: "TrendingDown",
    color: "blue",
    description: "Detect velocity and acceleration of change in each biomarker over time.",
    count: 14,
  },
  {
    id: "TH",
    name: "Threshold Rules",
    icon: "AlertTriangle",
    color: "amber",
    description: "Fire when an absolute value crosses a clinically defined safety boundary.",
    count: 22,
  },
  {
    id: "CX",
    name: "Cross-Marker Rules",
    icon: "Network",
    color: "purple",
    description: "Link multiple biomarker trajectories to surface compound clinical risk.",
    count: 5,
  },
  {
    id: "TG",
    name: "Therapy Gap Rules",
    icon: "Pill",
    color: "emerald",
    description: "Identify eligible treatments not yet prescribed and quantify expected benefit.",
    count: 3,
  },
  {
    id: "DO",
    name: "Drug–Organ Rules",
    icon: "ShieldAlert",
    color: "rose",
    description: "Flag pharmacological risks when declining organ function changes drug safety.",
    count: 8,
  },
];

// ─── Trend Rules ───────────────────────────────────────────────────────────────
export const trendRules = [
  {
    marker: "eGFR",
    velocity: "-2.2 mL/min/month",
    annualRate: "-26.4 mL/min/year",
    expectedRate: "-2 to -5 mL/min/year",
    multiplier: "5–13×",
    acceleration: "-0.3 mL/min/month²",
    accelerating: true,
    projection: "eGFR ~14 in 12 months (Stage 5 territory)",
    risk: "critical" as const,
  },
  {
    marker: "Creatinine",
    velocity: "+0.13 mg/dL/month",
    annualRate: "+1.56 mg/dL/year",
    expectedRate: "< +0.05/year",
    multiplier: "31×",
    acceleration: "+0.02 mg/dL/month²",
    accelerating: true,
    projection: "Creatinine ~3.0 mg/dL in 4 months",
    risk: "critical" as const,
  },
  {
    marker: "Potassium",
    velocity: "+0.20 mEq/L/month",
    annualRate: "+2.4 mEq/L/year",
    expectedRate: "Stable",
    multiplier: "—",
    acceleration: "+0.01 mEq/L/month²",
    accelerating: false,
    projection: "K⁺ reaches 6.0 mEq/L in ~5 months (cardiac risk)",
    risk: "high" as const,
  },
  {
    marker: "Bicarbonate",
    velocity: "-0.83 mEq/L/month",
    annualRate: "-10 mEq/L/year",
    expectedRate: "Stable",
    multiplier: "—",
    acceleration: "0",
    accelerating: false,
    projection: "HCO₃ reaches 12 in 6 months (severe acidosis)",
    risk: "high" as const,
  },
  {
    marker: "Albumin",
    velocity: "-0.12 g/dL/month",
    annualRate: "-1.44 g/dL/year",
    expectedRate: "Stable",
    multiplier: "—",
    acceleration: "0",
    accelerating: false,
    projection: "Albumin < 3.0 in 1 month (malnutrition threshold)",
    risk: "medium" as const,
  },
  {
    marker: "BUN",
    velocity: "+4.2 mg/dL/month",
    annualRate: "+50.4 mg/dL/year",
    expectedRate: "< +1/month",
    multiplier: "4.2×",
    acceleration: "+0.3 mg/dL/month²",
    accelerating: true,
    projection: "BUN reaches 70 mg/dL in 5 months",
    risk: "high" as const,
  },
  {
    marker: "Haemoglobin",
    velocity: "-0.23 g/dL/month",
    annualRate: "-2.76 g/dL/year",
    expectedRate: "Stable",
    multiplier: "—",
    acceleration: "0",
    accelerating: false,
    projection: "Hgb reaches 9.0 in 3 months (transfusion threshold)",
    risk: "medium" as const,
  },
];

// ─── Cross-Marker Linkage Rules ────────────────────────────────────────────────
export const crossMarkerRules = [
  {
    id: "CX-01",
    name: "eGFR Decline + K⁺ Rise + ACE Inhibitor → Hyperkalemia Cascade",
    risk: "critical" as const,
    ifCondition: [
      "eGFR_velocity < −1.5 mL/min/month",
      "K⁺_current > 5.0 mEq/L",
      "Patient on ACE inhibitor OR ARB",
    ],
    patientValues: {
      "eGFR velocity": "−2.2 mL/min/month ✓",
      "K⁺ (Dec)": "5.4 mEq/L ✓",
      "Medication": "Ramipril 5 mg OD ✓",
    },
    thenAction: "Hyperkalemia risk alert. K⁺ projected to reach 6.0 mEq/L in 5 months. Recommend: switch Ramipril → Finerenone or dose-reduce + dietary K⁺ restriction. Recheck K⁺ in 2 weeks.",
    recommendation: "Switch ACE-I; dietary K⁺ < 2 g/day; recheck in 2 weeks",
  },
  {
    id: "CX-02",
    name: "eGFR + Creatinine Concordance → True GFR Decline Confirmed",
    risk: "high" as const,
    ifCondition: [
      "eGFR_decline > 25% over 6 months",
      "Creatinine_rise > 30% concordant",
      "No acute illness or dehydration flag",
    ],
    patientValues: {
      "eGFR change": "42 → 28 = −33% ✓",
      "Creatinine change": "1.62 → 2.41 = +49% ✓",
      "Acute illness": "None flagged ✓",
    },
    thenAction: "Confirms true progressive GFR loss (not a muscle-wasting or haemoconcentration artifact). Activate nephrology referral pathway. Document rate of progression in clinical summary.",
    recommendation: "Nephrology referral; document CKD progression rate",
  },
  {
    id: "CX-03",
    name: "HCO₃ Drop + Albumin Loss + BUN Rise → Catabolic Cascade",
    risk: "high" as const,
    ifCondition: [
      "HCO₃ < 18 mEq/L",
      "Albumin_velocity < −0.10 g/dL/month",
      "BUN_velocity > +3.0 mg/dL/month",
    ],
    patientValues: {
      "HCO₃ (Dec)": "17 mEq/L ✓",
      "Albumin velocity": "−0.12 g/dL/month ✓",
      "BUN velocity": "+4.2 mg/dL/month ✓",
    },
    thenAction: "Catabolic cascade detected. Acidosis is driving muscle protein breakdown, worsening uraemia and hypoalbuminaemia. Start oral sodium bicarbonate 650 mg TID. Target HCO₃ > 22. Nutritional consult for protein-energy intake.",
    recommendation: "Oral NaHCO₃ 650 mg TID; dietitian referral; target HCO₃ > 22",
  },
  {
    id: "CX-04",
    name: "Hgb Decline + eGFR < 35 + No ESA Optimisation → CKD Anaemia",
    risk: "medium" as const,
    ifCondition: [
      "Hgb < 10.5 g/dL and declining",
      "eGFR < 35 mL/min",
      "No ferritin / TSAT on record in last 90 days",
    ],
    patientValues: {
      "Hgb (Dec)": "9.8 g/dL ✓",
      "eGFR (Dec)": "28 mL/min ✓",
      "Ferritin last check": "Missing — last > 90 days",
    },
    thenAction: "CKD anaemia likely EPO-deficiency pattern. Check ferritin and TSAT before increasing ESA dose. If ferritin < 200 or TSAT < 20%, start IV iron first. If iron replete, optimise Erythropoietin dosing.",
    recommendation: "Order ferritin + TSAT; consider IV iron; optimise ESA",
  },
  {
    id: "CX-05",
    name: "Low Albumin + High Creatinine + BUN:Cr Ratio > 20 → Proteinuria Proxy",
    risk: "medium" as const,
    ifCondition: [
      "Albumin < 3.2 g/dL",
      "Creatinine > 2.0 mg/dL",
      "BUN:Creatinine ratio > 20",
    ],
    patientValues: {
      "Albumin (Dec)": "3.1 g/dL ✓",
      "Creatinine (Dec)": "2.41 mg/dL ✓",
      "BUN:Cr ratio": "49 / 2.41 = 20.3 ✓",
    },
    thenAction: "Pattern consistent with significant proteinuria or nephrotic-range loss. Order 24-hour urine protein or spot urine PCR. Escalate to nephrology if PCR > 300 mg/mmol.",
    recommendation: "24-hr urine protein or spot PCR; nephrology if PCR > 300",
  },
];

// ─── Therapy Gap Rules ─────────────────────────────────────────────────────────
export const therapyGapRules = [
  {
    id: "TG-01",
    name: "SGLT2 Inhibitor Gap",
    drug: "Dapagliflozin 10 mg",
    status: "ELIGIBLE — Not Prescribed",
    statusColor: "amber" as const,
    eligibility: ["eGFR > 20 mL/min ✓ (28)", "Diagnosed CKD + T2DM ✓", "No prior DKA ✓"],
    contraindications: ["T1DM — No ✓", "Recurrent UTI — None flagged ✓", "eGFR < 20 — No ✓"],
    interactions: "No significant interaction with Ramipril or Amlodipine. Monitor for mild diuretic effect.",
    trialData: "DAPA-CKD: 44% ↓ in CKD progression; 39% ↓ cardiovascular events vs. placebo",
    action: "Initiate Dapagliflozin 10 mg OD today",
  },
  {
    id: "TG-02",
    name: "GLP-1 Receptor Agonist Gap",
    drug: "Semaglutide 0.5 mg SC/wk",
    status: "ELIGIBLE — Consider",
    statusColor: "blue" as const,
    eligibility: ["T2DM with high CV risk ✓", "eGFR > 15 (Semaglutide safe) ✓", "BMI benefit applicable ✓"],
    contraindications: ["Pancreatitis history — None ✓", "MTC history — None ✓", "Gastroparesis — Not documented"],
    interactions: "Slows gastric emptying — may affect Metformin absorption (being discontinued anyway).",
    trialData: "FLOW trial: 24% ↓ kidney failure events; LEADER: 20% ↓ CV mortality",
    action: "Discuss with patient after Metformin discontinuation; start Week 2",
  },
  {
    id: "TG-03",
    name: "Metformin Dose Adjustment",
    drug: "Metformin 1000 mg BD (current)",
    status: "URGENT — Contraindicated",
    statusColor: "rose" as const,
    eligibility: ["eGFR 30–45: dose reduce to 500 mg OD", "eGFR < 30: STOP immediately"],
    contraindications: ["eGFR 28 — CONTRAINDICATED ✗", "Lactic acidosis risk at this eGFR ✗"],
    interactions: "At eGFR < 30, Metformin accumulates → lactic acidosis risk (mortality ~50% if develops).",
    trialData: "FDA / EMA: Contraindicated when eGFR < 30. Risk: 1 in 100,000 patient-years but fatal.",
    action: "Discontinue Metformin immediately. Bridge with short-acting insulin or Gliclazide MR 30 mg.",
  },
];

// ─── Dashboard Panels ─────────────────────────────────────────────────────────
export const dashboardAlerts = [
  { rank: 1, level: "Critical", label: "eGFR 28 — Stage 4 threshold crossed", color: "rose" as const },
  { rank: 2, level: "Urgent", label: "Metformin contraindicated at eGFR 28 — stop immediately", color: "rose" as const },
  { rank: 3, level: "High", label: "K⁺ 5.4 — projected 6.0 in 5 months on ACE inhibitor", color: "amber" as const },
  { rank: 4, level: "High", label: "SGLT2i gap — Dapagliflozin eligible, not prescribed", color: "amber" as const },
  { rank: 5, level: "Medium", label: "HCO₃ 17 — metabolic acidosis; catabolic cascade active", color: "amber" as const },
  { rank: 6, level: "Medium", label: "Albumin 3.1 — malnutrition threshold in 1 month", color: "slate" as const },
  { rank: 7, level: "Low", label: "Hgb 9.8 — anaemia worsening; ferritin check overdue", color: "slate" as const },
];

export const therapyRoadmap = [
  { phase: "Today", actions: ["Stop Metformin; start Gliclazide MR 30 mg", "Order K⁺ recheck + ferritin/TSAT", "Nephrology referral letter"] },
  { phase: "Week 2", actions: ["Start Dapagliflozin 10 mg OD", "Start NaHCO₃ 650 mg TID", "Dietary K⁺ counselling < 2 g/day"] },
  { phase: "Week 4", actions: ["Repeat eGFR, K⁺, HCO₃, albumin", "Assess Semaglutide eligibility", "Titrate ESA if ferritin adequate"] },
  { phase: "Month 2", actions: ["24-hr urine protein if K⁺ stable", "Review Dapagliflozin response", "HbA1c if not done"] },
  { phase: "Month 3", actions: ["Reassess CKD staging", "Full metabolic panel", "Consider finerenone if K⁺ controlled"] },
];

export const confidenceReport = {
  score: 82,
  available: ["eGFR (6 months)", "Creatinine (6 months)", "K⁺ (6 months)", "HCO₃ (6 months)", "Albumin (6 months)", "BUN (6 months)", "Hgb (6 months)", "Current medications"],
  missing: ["HbA1c (last result > 8 months)", "Ferritin / TSAT", "Urine PCR / 24-hr protein", "BP trend data", "Medication adherence logs", "Body weight trend"],
};

// ─── Biomarker Linkage Matrix ──────────────────────────────────────────────────
export const biomarkers: string[] = ["eGFR", "Creat.", "K⁺", "HCO₃", "Albumin", "BUN", "Hgb"];

export const correlationMatrix: string[][] = [
  ["—",  "-",  "-",  "+",  "+",  "-",  "+"],
  ["-",  "—",  "+",  "-",  "-",  "+",  "-"],
  ["-",  "+",  "—",  "-",  "-",  "+",  "-"],
  ["+",  "-",  "-",  "—",  "+",  "-",  "+"],
  ["+",  "-",  "-",  "+",  "—",  "-",  "+"],
  ["-",  "+",  "+",  "-",  "-",  "—",  "-"],
  ["+",  "-",  "-",  "+",  "+",  "-",  "—"],
];

export const causalChains = [
  { chain: "eGFR ↓ → K⁺ ↑ → Arrhythmia risk", driver: "Reduced urinary K⁺ excretion" },
  { chain: "eGFR ↓ → HCO₃ ↓ → Albumin ↓ → BUN ↑", driver: "Metabolic acidosis → catabolic cascade" },
  { chain: "eGFR ↓ → Hgb ↓ → CV & fatigue risk", driver: "Reduced EPO synthesis" },
  { chain: "ACE-I + eGFR ↓ → K⁺ ↑ (amplified)", driver: "Drug-organ interaction" },
  { chain: "HCO₃ ↓ → muscle catabolism → Creatinine ↑ (artifact)", driver: "Non-renal creatinine rise risk" },
];

// ─── Value Delta Table ─────────────────────────────────────────────────────────
export const valueDeltaRows = [
  {
    dimension: "Time to clinical insight",
    without: "45–60 min chart review per patient",
    with: "90-second decision snapshot",
    gain: "40× faster",
  },
  {
    dimension: "Risk detection timing",
    without: "After threshold breach (reactive)",
    with: "3–5 months before crisis (proactive)",
    gain: "Months earlier",
  },
  {
    dimension: "Therapy gap identification",
    without: "Missed until specialist review",
    with: "Flagged at every encounter with trial evidence",
    gain: "Every visit",
  },
  {
    dimension: "Drug safety checks",
    without: "Manual cross-reference; often skipped",
    with: "Automated real-time (e.g. Metformin flag)",
    gain: "Zero misses",
  },
  {
    dimension: "Referral timing",
    without: "Reactive — emergency or late-stage",
    with: "Proactive — pre-crisis nephrology path",
    gain: "Prevents hospitalisation",
  },
  {
    dimension: "Documentation burden",
    without: "Manual notes; variable completeness",
    with: "Auto-generated summary with provenance links",
    gain: "Saves 15 min/patient",
  },
];

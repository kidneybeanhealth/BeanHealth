import { buildReferenceMap, buildComboMap } from './indianDrugDatabase';

/**
 * Renal Dose Safety Database
 *
 * Each entry covers one drug or drug class. Matching runs against both the
 * typed prescription string (for generics) and resolved ingredient names from
 * the Indian drug brand database (for brand names like GLYCOMET, VOVERAN).
 *
 * eGFR bands follow KDIGO 2024 / Aronoff Drug Prescribing in Renal Failure (5th ed):
 *   G1-G2  ≥ 60   mL/min/1.73 m²  — near-normal
 *   G3a    45–59
 *   G3b    30–44
 *   G4     15–29
 *   G5     < 15  (includes dialysis considerations)
 *
 * severity:
 *   'ok'      — standard dose, no adjustment needed
 *   'caution' — monitor closely, may need dose reduction
 *   'reduce'  — explicit dose/frequency adjustment required
 *   'avoid'   — contraindicated; hard stop shown in UI
 */

export type RenalAlertSeverity = 'ok' | 'caution' | 'reduce' | 'avoid';

export interface EgfrBand {
    egfr_min: number;   // inclusive lower bound (use 0 for G5)
    egfr_max: number;   // exclusive upper bound (use 999 for ≥60)
    severity: RenalAlertSeverity;
    recommendation: string;
}

export interface RenalDoseRule {
    /** Drug / class label shown in the alert */
    label: string;
    /** Keywords — if ANY of these appear in the normalised drug string, this rule matches */
    keywords: string[];
    /** eGFR-specific bands, ordered from lowest eGFR upward */
    bands: EgfrBand[];
    /**
     * Shown when eGFR is unavailable (patient app not activated / no recent labs).
     * Should be actionable and non-alarming for stable patients.
     */
    generic_alert: string;
    /** KDIGO / Aronoff citation shown alongside the alert */
    source: string;
    /** When true the UI renders an interruptive blocking alert, not just an inline badge */
    hard_stop?: boolean;
}

// ---------------------------------------------------------------------------
// Drug class constants (reused across multiple rules)
// ---------------------------------------------------------------------------

const MONITOR_K_RENAL = 'Monitor serum K⁺ and creatinine. Dose reduction may be needed in advanced CKD.';

// ---------------------------------------------------------------------------
// THE DATABASE
// ---------------------------------------------------------------------------

export const RENAL_DOSE_RULES: RenalDoseRule[] = [

    // ── ANTI-DIABETIC ────────────────────────────────────────────────────────

    {
        label: 'Metformin',
        keywords: ['metformin'],
        hard_stop: true,
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose. Monitor renal function every 3–6 months.' },
            { egfr_min: 30, egfr_max: 45,  severity: 'reduce',  recommendation: 'Reduce dose by 50%. Monitor closely. Check creatinine before each prescription.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'CONTRAINDICATED — eGFR < 30. Risk of lactic acidosis. Discontinue.' },
        ],
        generic_alert: 'Renal function unknown. Metformin is contraindicated when eGFR < 30 mL/min. Check serum creatinine before prescribing.',
        source: 'KDIGO 2024 §4.3; Aronoff 5th ed.',
    },

    {
        label: 'Sitagliptin (DPP-4i)',
        keywords: ['sitagliptin'],
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose 100 mg once daily.' },
            { egfr_min: 30, egfr_max: 45,  severity: 'reduce', recommendation: 'Reduce to 50 mg once daily (eGFR 30–45).' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce to 25 mg once daily (eGFR < 30). Use with caution.' },
        ],
        generic_alert: 'Renal function unknown. Sitagliptin requires dose reduction when eGFR < 45 mL/min. Check creatinine.',
        source: 'KDIGO 2024 §4.4; Aronoff 5th ed.',
    },

    {
        label: 'Vildagliptin (DPP-4i)',
        keywords: ['vildagliptin'],
        bands: [
            { egfr_min: 50, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose 50 mg twice daily.' },
            { egfr_min: 0,  egfr_max: 50,  severity: 'reduce', recommendation: 'Reduce to 50 mg once daily (eGFR < 50). Monitor closely.' },
        ],
        generic_alert: 'Renal function unknown. Vildagliptin requires dose reduction when eGFR < 50 mL/min. Check creatinine.',
        source: 'Aronoff 5th ed.; EMA SmPC.',
    },

    {
        label: 'Saxagliptin (DPP-4i)',
        keywords: ['saxagliptin'],
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose 5 mg once daily.' },
            { egfr_min: 0,  egfr_max: 45,  severity: 'reduce', recommendation: 'Reduce to 2.5 mg once daily (eGFR < 45). Not recommended on dialysis.' },
        ],
        generic_alert: 'Renal function unknown. Saxagliptin requires dose halving when eGFR < 45 mL/min. Check creatinine.',
        source: 'Aronoff 5th ed.; FDA label.',
    },

    {
        label: 'Teneligliptin (DPP-4i)',
        keywords: ['teneligliptin'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose 20 mg once daily. Caution below eGFR 60.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'caution', recommendation: 'Limited data for eGFR < 30. Use with caution; monitor closely.' },
        ],
        generic_alert: 'Renal function unknown. Teneligliptin has limited data in advanced CKD. Check creatinine before prescribing.',
        source: 'Indian prescribing information; limited CKD trial data.',
    },

    {
        label: 'Alogliptin (DPP-4i)',
        keywords: ['alogliptin'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose 25 mg once daily.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce', recommendation: 'Reduce to 12.5 mg once daily (eGFR 30–60).' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce to 6.25 mg once daily (eGFR < 30 or dialysis).' },
        ],
        generic_alert: 'Renal function unknown. Alogliptin requires stepwise dose reduction in CKD. Check creatinine.',
        source: 'Aronoff 5th ed.; FDA label.',
    },

    {
        label: 'Empagliflozin (SGLT2i)',
        keywords: ['empagliflozin'],
        bands: [
            { egfr_min: 20, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose. Glycaemic benefit reduced below eGFR 45, but cardiorenal benefit persists (KDIGO 2024).' },
            { egfr_min: 0,  egfr_max: 20,  severity: 'avoid',   recommendation: 'Glycaemic benefit minimal below eGFR 20. Cardiorenal indication (HF/CKD) may still apply — discuss with specialist.' },
        ],
        generic_alert: 'Renal function unknown. Empagliflozin efficacy for glycaemic control is reduced in CKD. Check creatinine; dose may need review.',
        source: 'KDIGO 2024 Rec 3.7.1; EMPA-KIDNEY trial.',
    },

    {
        label: 'Dapagliflozin (SGLT2i)',
        keywords: ['dapagliflozin'],
        bands: [
            { egfr_min: 25, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose. Glycaemic benefit attenuated below eGFR 45; cardiorenal benefit demonstrated to eGFR 25 (DAPA-CKD).' },
            { egfr_min: 0,  egfr_max: 25,  severity: 'avoid',   recommendation: 'Not recommended for glycaemic control below eGFR 25. Cardiorenal use — consult specialist.' },
        ],
        generic_alert: 'Renal function unknown. Dapagliflozin effectiveness depends on eGFR. Check creatinine before prescribing.',
        source: 'KDIGO 2024 Rec 3.7.1; DAPA-CKD trial.',
    },

    {
        label: 'Canagliflozin (SGLT2i)',
        keywords: ['canagliflozin'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose. Glycaemic benefit reduced below eGFR 45; cardiorenal benefit to eGFR 30 (CREDENCE).' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'Not recommended below eGFR 30 for glycaemic control.' },
        ],
        generic_alert: 'Renal function unknown. Canagliflozin requires eGFR ≥ 30 for cardiorenal use. Check creatinine.',
        source: 'KDIGO 2024; CREDENCE trial.',
    },

    {
        label: 'Glibenclamide (Sulphonylurea)',
        keywords: ['glibenclamide', 'glyburide'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'ok',      recommendation: 'Use with caution; monitor for hypoglycaemia.' },
            { egfr_min: 0,  egfr_max: 60,  severity: 'avoid',   recommendation: 'AVOID — active metabolites accumulate in CKD, prolonged hypoglycaemia risk. Use shorter-acting SU (gliclazide) instead.' },
        ],
        generic_alert: 'Renal function unknown. Glibenclamide accumulates in CKD and causes prolonged hypoglycaemia. Prefer gliclazide. Check creatinine.',
        source: 'Aronoff 5th ed.; KDIGO 2024 §4.4.',
        hard_stop: true,
    },

    // ── NSAIDs ───────────────────────────────────────────────────────────────

    {
        label: 'NSAIDs',
        keywords: ['diclofenac', 'ibuprofen', 'naproxen', 'aceclofenac', 'nimesulide', 'ketorolac', 'meloxicam', 'piroxicam', 'indomethacin', 'etoricoxib', 'celecoxib', 'ketoprofen', 'mefenamic'],
        hard_stop: true,
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'caution', recommendation: 'Use lowest effective dose for shortest duration. Avoid if patient also on ACEi/ARB or diuretic (triple whammy risk).' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce',  recommendation: 'Significant risk of AKI and eGFR decline. Use paracetamol instead. If unavoidable, lowest dose, ≤3 days, monitor creatinine after.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'CONTRAINDICATED — high risk of AKI, fluid retention, and hyperkalemia. Use paracetamol only.' },
        ],
        generic_alert: 'Renal function unknown. NSAIDs reduce GFR and can precipitate AKI in CKD. Check creatinine. Prefer paracetamol if renal function is impaired.',
        source: 'KDIGO 2024 §3.1.4; Aronoff 5th ed.',
    },

    // ── ACE INHIBITORS ───────────────────────────────────────────────────────

    {
        label: 'ACE Inhibitor',
        keywords: ['ramipril', 'enalapril', 'lisinopril', 'perindopril', 'captopril', 'benazepril', 'fosinopril', 'quinapril', 'trandolapril'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'First-line in CKD with proteinuria. Check K⁺ and creatinine 1–2 weeks after starting or dose change. Acceptable creatinine rise ≤ 30%.' },
            { egfr_min: 15, egfr_max: 30,  severity: 'caution', recommendation: MONITOR_K_RENAL + ' Start low. Acceptable creatinine rise ≤ 30%. Avoid in bilateral RAS.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'caution', recommendation: 'Use with specialist supervision. High hyperkalemia risk (eGFR < 15). Daily monitoring may be needed.' },
        ],
        generic_alert: 'Renal function unknown. ACE inhibitors can cause acute creatinine rise and hyperkalemia in CKD. Check K⁺ and creatinine 1–2 weeks after starting.',
        source: 'KDIGO 2024 §3.1.1; Aronoff 5th ed.',
    },

    // ── ARBs ─────────────────────────────────────────────────────────────────

    {
        label: 'ARB (Angiotensin Receptor Blocker)',
        keywords: ['telmisartan', 'losartan', 'valsartan', 'olmesartan', 'irbesartan', 'candesartan', 'azilsartan', 'fimasartan'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'First-line in CKD with proteinuria. Check K⁺ and creatinine 1–2 weeks after starting or dose change.' },
            { egfr_min: 15, egfr_max: 30,  severity: 'caution', recommendation: MONITOR_K_RENAL + ' Acceptable creatinine rise ≤ 30%.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'caution', recommendation: 'Use with specialist supervision in eGFR < 15. Very high hyperkalemia risk.' },
        ],
        generic_alert: 'Renal function unknown. ARBs can cause creatinine rise and hyperkalemia in CKD. Check K⁺ and creatinine 1–2 weeks after starting.',
        source: 'KDIGO 2024 §3.1.1; Aronoff 5th ed.',
    },

    // ── MRAs ─────────────────────────────────────────────────────────────────

    {
        label: 'Spironolactone (MRA)',
        keywords: ['spironolactone'],
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'ok',      recommendation: 'Check baseline K⁺. Recheck K⁺ in 1 week, then 1 month.' },
            { egfr_min: 30, egfr_max: 45,  severity: 'caution', recommendation: 'High hyperkalemia risk. Reduce dose, check K⁺ within 5–7 days. Avoid if K⁺ > 5.0 at baseline.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID — severe hyperkalemia risk in eGFR < 30. Consider finerenone (safer K⁺ profile) if MRA is clinically needed.' },
        ],
        generic_alert: 'Renal function unknown. Spironolactone causes significant hyperkalemia in CKD. Check K⁺ and creatinine before prescribing.',
        source: 'KDIGO 2024 §3.1.3; Aronoff 5th ed.',
        hard_stop: true,
    },

    {
        label: 'Eplerenone (MRA)',
        keywords: ['eplerenone'],
        bands: [
            { egfr_min: 50, egfr_max: 999, severity: 'ok',      recommendation: 'Monitor K⁺ closely. Check at 1 week and 1 month after initiation.' },
            { egfr_min: 30, egfr_max: 50,  severity: 'caution', recommendation: 'Significant hyperkalemia risk. Consider dose reduction. Check K⁺ within 5–7 days.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID — contraindicated in eGFR < 30 per most guidelines due to hyperkalemia risk.' },
        ],
        generic_alert: 'Renal function unknown. Eplerenone has significant hyperkalemia risk in CKD. Check K⁺ and creatinine before prescribing.',
        source: 'Aronoff 5th ed.; FDA label.',
        hard_stop: true,
    },

    // ── DIURETICS ────────────────────────────────────────────────────────────

    {
        label: 'Thiazide Diuretic',
        keywords: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'hctz', 'metolazone'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'Effective. Monitor electrolytes and creatinine. Metolazone can be used in lower eGFR for synergy.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'caution', recommendation: 'Thiazides are largely ineffective as antihypertensives below eGFR 30. Consider loop diuretic instead.' },
        ],
        generic_alert: 'Renal function unknown. Thiazides lose efficacy at low eGFR. Check renal function to guide diuretic choice.',
        source: 'KDIGO 2024; Aronoff 5th ed.',
    },

    // ── ANTIBIOTICS ──────────────────────────────────────────────────────────

    {
        label: 'Nitrofurantoin',
        keywords: ['nitrofurantoin'],
        hard_stop: true,
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose. Effective for UTI.' },
            { egfr_min: 30, egfr_max: 45,  severity: 'caution', recommendation: 'Reduced efficacy and increased risk of peripheral neuropathy. Prefer alternative UTI antibiotic.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'CONTRAINDICATED — drug does not achieve therapeutic urinary concentrations; increased systemic toxicity risk.' },
        ],
        generic_alert: 'Renal function unknown. Nitrofurantoin is contraindicated in significant renal impairment (eGFR < 30). Check creatinine.',
        source: 'KDIGO 2024 §3.1.4; Aronoff 5th ed.',
    },

    {
        label: 'Cotrimoxazole / TMP-SMX',
        keywords: ['trimethoprim', 'sulfamethoxazole', 'cotrimoxazole', 'tmp-smx', 'bactrim', 'septran'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose. Trimethoprim inhibits creatinine secretion — expect 10–15% rise in creatinine (not true GFR decline).' },
            { egfr_min: 15, egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce dose by 50% (eGFR 15–30). Monitor K⁺ — trimethoprim blocks ENaC like amiloride, raises K⁺.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'avoid',  recommendation: 'Avoid or use only with specialist guidance. High risk of hyperkalemia and accumulation.' },
        ],
        generic_alert: 'Renal function unknown. Trimethoprim raises serum creatinine and potassium independent of true GFR. Check creatinine and K⁺.',
        source: 'Aronoff 5th ed.; KDIGO 2024.',
    },

    {
        label: 'Ciprofloxacin',
        keywords: ['ciprofloxacin'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce to 250–500 mg every 18–24 hours. Avoid prolonged courses.' },
        ],
        generic_alert: 'Renal function unknown. Ciprofloxacin requires dose reduction in significant renal impairment. Check creatinine.',
        source: 'Aronoff 5th ed.',
    },

    {
        label: 'Levofloxacin',
        keywords: ['levofloxacin'],
        bands: [
            { egfr_min: 50, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose 500 mg OD.' },
            { egfr_min: 20, egfr_max: 50,  severity: 'reduce', recommendation: 'Load 500 mg, then 250 mg every 24 hours (eGFR 20–50).' },
            { egfr_min: 0,  egfr_max: 20,  severity: 'reduce', recommendation: 'Load 500 mg, then 125 mg every 24 hours. Monitor for CNS toxicity.' },
        ],
        generic_alert: 'Renal function unknown. Levofloxacin requires dose reduction in renal impairment. Check creatinine.',
        source: 'Aronoff 5th ed.',
    },

    {
        label: 'Amoxicillin',
        keywords: ['amoxicillin'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose.' },
            { egfr_min: 10, egfr_max: 30,  severity: 'reduce', recommendation: 'Extend dosing interval to every 12 hours (eGFR 10–30).' },
            { egfr_min: 0,  egfr_max: 10,  severity: 'reduce', recommendation: 'Extend to every 24 hours; consider dose reduction. Requires monitoring.' },
        ],
        generic_alert: 'Renal function unknown. Amoxicillin may require dosing interval extension in significant CKD. Check creatinine.',
        source: 'Aronoff 5th ed.',
    },

    {
        label: 'Gentamicin (Aminoglycoside)',
        keywords: ['gentamicin', 'tobramycin', 'amikacin', 'streptomycin', 'aminoglycoside'],
        hard_stop: true,
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'caution', recommendation: 'Use with TDM (trough levels). Nephrotoxic — avoid concurrent nephrotoxins. Keep course ≤ 5–7 days.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce',  recommendation: 'Extend dosing interval based on TDM. Every 36–48 hours if eGFR 30–60. Monitor creatinine daily.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID unless no alternative. If essential: once-daily regimen, TDM mandatory, creatinine every 12–24 hours.' },
        ],
        generic_alert: 'Renal function unknown. Aminoglycosides (gentamicin) are nephrotoxic. Require therapeutic drug monitoring (TDM) and dose adjustment in CKD. Check creatinine urgently.',
        source: 'KDIGO 2024 §3.1.4; Aronoff 5th ed.',
    },

    // ── ANTIVIRALS ───────────────────────────────────────────────────────────

    {
        label: 'Acyclovir / Valacyclovir',
        keywords: ['acyclovir', 'aciclovir', 'valacyclovir', 'valaciclovir'],
        bands: [
            { egfr_min: 50, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose. Ensure adequate hydration.' },
            { egfr_min: 25, egfr_max: 50,  severity: 'reduce', recommendation: 'Reduce dose by 50% or extend interval. Maintain hydration.' },
            { egfr_min: 10, egfr_max: 25,  severity: 'reduce', recommendation: 'Reduce to 50% and extend to every 24 hours.' },
            { egfr_min: 0,  egfr_max: 10,  severity: 'reduce', recommendation: 'Reduce to 50% every 48 hours. Dialysis patients — dose after session.' },
        ],
        generic_alert: 'Renal function unknown. Acyclovir/valacyclovir accumulates in CKD and can cause crystalluria and neurotoxicity. Check creatinine and ensure hydration.',
        source: 'Aronoff 5th ed.',
    },

    // ── GOUT ─────────────────────────────────────────────────────────────────

    {
        label: 'Allopurinol',
        keywords: ['allopurinol'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose. Titrate to target urate < 6 mg/dL.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce', recommendation: 'Start at 50 mg/day; titrate slowly. Maximum 100 mg/day at eGFR 30–60. Risk of allopurinol hypersensitivity syndrome (AHS) is higher.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'reduce', recommendation: 'Start at 50 mg every other day; titrate very cautiously. Oxipurinol accumulates. Use febuxostat if available.' },
        ],
        generic_alert: 'Renal function unknown. Allopurinol active metabolite accumulates in CKD — higher risk of severe hypersensitivity syndrome (Stevens-Johnson). Start at lowest dose. Check creatinine.',
        source: 'Aronoff 5th ed.; KDIGO 2024.',
    },

    {
        label: 'Colchicine',
        keywords: ['colchicine'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose for acute gout (0.5 mg BD). Avoid prolonged use in CKD.' },
            { egfr_min: 15, egfr_max: 30,  severity: 'caution', recommendation: 'Reduce to 0.5 mg once daily. Avoid courses > 3 days. Myotoxicity risk.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'reduce', recommendation: 'Use with extreme caution; reduce dose further. Monitor for myopathy. Many guidelines recommend avoiding.' },
        ],
        generic_alert: 'Renal function unknown. Colchicine accumulates in CKD and causes neuromuscular toxicity. Check creatinine before prescribing.',
        source: 'Aronoff 5th ed.',
    },

    {
        label: 'Febuxostat',
        keywords: ['febuxostat'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'ok',      recommendation: 'Standard dose 40–80 mg. Safe in mild–moderate CKD. Preferred over allopurinol when eGFR < 60.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'caution', recommendation: 'Limited data below eGFR 30; use cautiously. Titrate from 40 mg.' },
        ],
        generic_alert: 'Renal function unknown. Febuxostat is generally safer than allopurinol in CKD. No dose adjustment needed for mild–moderate CKD, but check creatinine.',
        source: 'Aronoff 5th ed.; KDIGO 2024.',
    },

    // ── NEUROPATHIC PAIN ─────────────────────────────────────────────────────

    {
        label: 'Gabapentin',
        keywords: ['gabapentin'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce', recommendation: 'Reduce daily dose by 50%. Titrate slowly (eGFR 30–60).' },
            { egfr_min: 15, egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce daily dose by 75%. Maximum 700 mg/day in divided doses.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'reduce', recommendation: 'Maximum 300 mg/day. Supplement dose after dialysis if applicable. Risk of excessive sedation.' },
        ],
        generic_alert: 'Renal function unknown. Gabapentin accumulates in CKD causing oversedation and encephalopathy. Check creatinine before prescribing.',
        source: 'Aronoff 5th ed.',
    },

    {
        label: 'Pregabalin',
        keywords: ['pregabalin'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce', recommendation: 'Reduce dose by 50%. Titrate slowly.' },
            { egfr_min: 15, egfr_max: 30,  severity: 'reduce', recommendation: 'Reduce by 75%. Maximum 150 mg/day.' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'reduce', recommendation: 'Maximum 75 mg/day. Supplement after dialysis.' },
        ],
        generic_alert: 'Renal function unknown. Pregabalin accumulates in CKD — risk of excessive sedation and dizziness. Check creatinine.',
        source: 'Aronoff 5th ed.',
    },

    // ── CARDIAC ──────────────────────────────────────────────────────────────

    {
        label: 'Digoxin',
        keywords: ['digoxin'],
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'caution', recommendation: 'Use with caution. Check digoxin levels. Narrow therapeutic index.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce',  recommendation: 'Reduce dose by 25–50%. Target trough 0.5–0.9 ng/mL. Check levels and K⁺ regularly.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID — accumulates markedly in CKD; toxicity risk high. If essential, halve dose, check levels every 3–5 days.' },
        ],
        generic_alert: 'Renal function unknown. Digoxin has a very narrow therapeutic index and accumulates in CKD. Check creatinine and K⁺ before prescribing.',
        source: 'Aronoff 5th ed.',
        hard_stop: true,
    },

    {
        label: 'Atenolol',
        keywords: ['atenolol'],
        bands: [
            { egfr_min: 35, egfr_max: 999, severity: 'ok',     recommendation: 'Standard dose.' },
            { egfr_min: 15, egfr_max: 35,  severity: 'reduce', recommendation: 'Reduce to 50 mg every 48 hours (eGFR 15–35).' },
            { egfr_min: 0,  egfr_max: 15,  severity: 'reduce', recommendation: 'Reduce to 25 mg every 48 hours or consider alternative beta-blocker (carvedilol/bisoprolol).' },
        ],
        generic_alert: 'Renal function unknown. Atenolol is renally cleared and accumulates in CKD — bradycardia risk. Check creatinine.',
        source: 'Aronoff 5th ed.',
    },

    // ── ANALGESICS ───────────────────────────────────────────────────────────

    {
        label: 'Tramadol',
        keywords: ['tramadol'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'caution', recommendation: 'Use lowest effective dose. Risk of seizures at higher doses. Extend dosing interval to every 12 hours.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID — active metabolites accumulate severely in CKD; seizure and serotonin syndrome risk. Use paracetamol.' },
        ],
        generic_alert: 'Renal function unknown. Tramadol metabolites accumulate in CKD causing seizures. Check creatinine; prefer paracetamol.',
        source: 'Aronoff 5th ed.',
        hard_stop: true,
    },

    {
        label: 'Morphine / Codeine',
        keywords: ['morphine', 'codeine'],
        bands: [
            { egfr_min: 30, egfr_max: 999, severity: 'caution', recommendation: 'Reduce dose by 25–50%; extend dosing intervals. Monitor sedation and respiratory rate.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'AVOID — active metabolites (morphine-6-glucuronide) accumulate; risk of profound sedation and respiratory depression.' },
        ],
        generic_alert: 'Renal function unknown. Morphine/codeine accumulate in CKD. Check creatinine; use fentanyl or buprenorphine instead for severe CKD.',
        source: 'Aronoff 5th ed.',
        hard_stop: true,
    },

    // ── IMMUNOSUPPRESSANTS ───────────────────────────────────────────────────

    {
        label: 'Methotrexate',
        keywords: ['methotrexate'],
        hard_stop: true,
        bands: [
            { egfr_min: 60, egfr_max: 999, severity: 'caution', recommendation: 'Monitor closely. Check creatinine before each dose. Folic acid supplementation mandatory.' },
            { egfr_min: 30, egfr_max: 60,  severity: 'reduce',  recommendation: 'Reduce dose by 50%. Very frequent monitoring required. High risk of toxicity.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'CONTRAINDICATED — severe accumulation; life-threatening mucositis, pancytopenia, nephrotoxicity.' },
        ],
        generic_alert: 'Renal function unknown. Methotrexate is contraindicated in significant renal impairment. Check creatinine urgently before prescribing.',
        source: 'Aronoff 5th ed.; KDIGO 2024.',
    },

    // ── PHOSPHATE BINDERS ────────────────────────────────────────────────────

    {
        label: 'Sevelamer',
        keywords: ['sevelamer'],
        bands: [
            { egfr_min: 0, egfr_max: 999, severity: 'ok', recommendation: 'Non-absorbed phosphate binder. No renal dose adjustment needed. Monitor serum phosphate, calcium, and bicarbonate.' },
        ],
        generic_alert: 'Sevelamer is a non-absorbed phosphate binder. No dose adjustment required for eGFR. Monitor phosphate and bicarbonate levels.',
        source: 'KDIGO MBD 2017.',
    },

    // ── CONTRAST ─────────────────────────────────────────────────────────────

    {
        label: 'IV Contrast / Contrast Media',
        keywords: ['contrast', 'iohexol', 'iodixanol', 'iopamidol', 'ioversol'],
        hard_stop: true,
        bands: [
            { egfr_min: 45, egfr_max: 999, severity: 'caution', recommendation: 'Hold nephrotoxic drugs (NSAIDs, metformin) 24–48 hours before and after. Ensure adequate hydration.' },
            { egfr_min: 30, egfr_max: 45,  severity: 'reduce',  recommendation: 'High CI-AKI risk. IV hydration with isotonic saline before and after. Use minimum contrast volume. Consider iso-osmolar contrast.' },
            { egfr_min: 0,  egfr_max: 30,  severity: 'avoid',   recommendation: 'Very high CI-AKI risk. Consider MRI or ultrasound instead. If unavoidable: nephrologist co-sign, prophylaxis mandatory, SCr at 48–72h post-procedure.' },
        ],
        generic_alert: 'Renal function unknown. IV contrast can cause contrast-induced AKI. Check creatinine before use; hold metformin 48 hours if proceeding.',
        source: 'KDIGO 2024; ACR contrast committee guidelines.',
    },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a drug name string to a lowercase keyword list for matching.
 * Strips TAB./CAP./INJ./SYP. prefixes, brand suffixes, and common noise.
 */
export function normaliseDrugString(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\b(tab|cap|inj|syp|syr|oint|gel|drop|susp|soln?|cr|sr|mr|er|xr|la|od|bd|tds|qid)\b\.?/g, '')
        .replace(/[^a-z0-9\s\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ---------------------------------------------------------------------------
// Brand → generic resolution (uses the same local lookup maps as BeanHealth AI,
// but synchronously — no async pipeline needed here)
// ---------------------------------------------------------------------------

let _refMap: ReturnType<typeof buildReferenceMap> | null = null;
let _comboMap: ReturnType<typeof buildComboMap> | null = null;
function getRefMap() { return (_refMap ??= buildReferenceMap()); }
function getComboMap() { return (_comboMap ??= buildComboMap()); }

/**
 * Convert a raw prescription string to a brand slug that matches the keys
 * in INDIAN_DRUG_DATABASE / COMBO_DRUG_TABLE (uppercase, underscore-separated,
 * no form/strength/modifier tokens).
 */
function toBrandSlug(raw: string): string {
    return raw
        .toUpperCase()
        // Strip form prefixes
        .replace(/^(TABLET|TABS?|TAB|CAPSULE|CAPS?|CAP|INJECTION|INJECT|INJ|SYRUP|SYP|SYR|SUSPENSION|SUSP|CREAM|CRM|OINTMENT|OINT|GEL|DROPS?|SOLN?|SACHET|INHALER|INH)\s*\.?\s*/i, '')
        // Strip strength  (12.5 MG, 500 MG/5ML, etc.)
        .replace(/\b\d+(?:\.\d+)?\s*(MG\/ML|MCG\/ML|MG\/5ML|MG|MCG|GM?|ML|IU|MEQ|UNITS?|%)\b/g, '')
        // Strip bare ratio like 40/5
        .replace(/\b\d+(?:\.\d+)?\/\d+(?:\.\d+)?\b/g, '')
        // Strip bare numbers
        .replace(/\b\d+(?:\.\d+)?\b/g, '')
        // Strip modifier tokens
        .replace(/\b(SR|ER|XR|CR|MR|XL|LA|OD|BD|TDS|QID|FORTE|PLUS|DS|MD|ODT|DT)\b/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_+$/g, '');
}

/**
 * Resolve a prescription string to its generic ingredient names using the
 * local Indian drug brand database. Returns empty array when unknown.
 * "TAB. GLYCOMET SR 500" → ["metformin"]
 * "TELMA-AM 40/5"        → ["telmisartan", "amlodipine"]
 */
function resolveBrandToGenerics(raw: string): string[] {
    const slug = toBrandSlug(raw);
    if (!slug) return [];

    // 1. Combo map (e.g. TELMA_AM, LOSARTAN_H)
    const combo = getComboMap().get(slug);
    if (combo) return combo.ingredients.map(i => i.name.toLowerCase());

    // 2. Reference map — exact slug
    const refMap = getRefMap();
    let ref = refMap.get(slug);
    if (ref) return ref.components.map(c => c.toLowerCase());

    // 3. Prefix relaxation: try progressively shorter slug heads
    //    (handles "GLYCOMET_SR" where the stored key is "GLYCOMET")
    const parts = slug.split('_');
    for (let len = parts.length - 1; len >= 1; len--) {
        const shorter = parts.slice(0, len).join('_');
        ref = refMap.get(shorter);
        if (ref) return ref.components.map(c => c.toLowerCase());
    }

    return [];
}

/**
 * Find all rules that match a given drug name string.
 * Checks the typed text (works for generic names) AND the resolved brand
 * ingredient names (works for Indian brand names like GLYCOMET, VOVERAN).
 */
export function findMatchingRules(drugName: string): RenalDoseRule[] {
    const normalised = normaliseDrugString(drugName);

    // Brand resolution: "GLYCOMET SR 500" → ["metformin"]
    const resolvedGenerics = resolveBrandToGenerics(drugName);
    const resolvedStr = resolvedGenerics.join(' ');

    return RENAL_DOSE_RULES.filter(rule =>
        rule.keywords.some(kw =>
            normalised.includes(kw) || (resolvedStr && resolvedStr.includes(kw))
        )
    );
}

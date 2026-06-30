import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Network,
  Pill,
  ShieldAlert,
  TrendingDown,
  TriangleAlert,
  Zap,
} from "lucide-react";
import {
  biomarkers,
  causalChains,
  ckdPatient,
  confidenceReport,
  correlationMatrix,
  crossMarkerRules,
  dashboardAlerts,
  labMonths,
  labRows,
  type LabRow,
  ruleCategories,
  therapyGapRules,
  therapyRoadmap,
  trendRules,
  valueDeltaRows,
} from "@/data/ckdEngineData";

const TABS = [
  { id: "profile", label: "Patient Profile", icon: FlaskConical },
  { id: "trend", label: "Trend Rules", icon: TrendingDown },
  { id: "cross", label: "Cross-Marker Rules", icon: Network },
  { id: "therapy", label: "Therapy Gaps", icon: Pill },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "linkage", label: "Linkage Map", icon: Brain },
  { id: "delta", label: "Value Delta", icon: Zap },
];

const riskBadge: Record<string, string> = {
  critical: "bg-rose-50 text-rose-700 border border-rose-200",
  high: "bg-amber-50 text-amber-700 border border-amber-200",
  medium: "bg-[#F0F9E6] text-[#5FA01F] border border-[#C2E29A]",
  low: "bg-slate-100 text-slate-600 border border-slate-200",
};

function cellColor(val: number | string, row: LabRow): string {
  if (val === "—" || val === null) return "";
  const v = parseFloat(String(val));
  const { thresholds, direction } = row;
  const isBad = direction === "up"
    ? v >= thresholds.critical
    : v <= thresholds.critical;
  const isWarn = direction === "up"
    ? v >= thresholds.warning && v < thresholds.critical
    : v <= thresholds.warning && v > thresholds.critical;
  if (isBad) return "bg-rose-50 text-rose-700 font-semibold";
  if (isWarn) return "bg-amber-50 text-amber-700 font-medium";
  return "text-slate-700";
}

// ─── Tab: Patient Profile ──────────────────────────────────────────────────────
function PatientProfileTab() {
  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Reference Patient</p>
            <h3 className="mt-1.5 text-2xl font-semibold text-slate-950">{ckdPatient.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{ckdPatient.age} yr · {ckdPatient.weight}</p>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            {ckdPatient.stage}
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Comorbidities</p>
            <div className="flex flex-wrap gap-2">
              {ckdPatient.comorbidities.map((c) => (
                <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{c}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Current Medications</p>
            <div className="flex flex-wrap gap-2">
              {ckdPatient.medications.map((m) => (
                <span key={m} className="rounded-full bg-[#F0F9E6] px-3 py-1 text-xs font-medium text-[#5FA01F]">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">6-Month Biomarker Trend Table</p>
          <p className="mt-0.5 text-xs text-slate-500">Colour-coded: <span className="font-medium text-rose-600">critical</span> · <span className="font-medium text-amber-600">warning</span> · normal</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Biomarker</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Normal</th>
                {labMonths.map((m) => (
                  <th key={m} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labRows.map((row, ri) => (
                <tr key={row.marker} className={`border-b border-slate-100/80 ${ri % 2 === 0 ? "bg-white/60" : "bg-slate-50/40"}`}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{row.marker}</p>
                    <p className="text-xs text-slate-400">{row.unit}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.normal}</td>
                  {row.values.map((v, vi) => (
                    <td key={vi} className={`px-4 py-3 text-center text-sm rounded-lg ${cellColor(v, row)}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-4 text-sm font-semibold text-slate-700">5-Category Rule Engine Architecture</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ruleCategories.map((cat) => {
            const colors: Record<string, { bg: string; text: string; count: string }> = {
              blue: { bg: "bg-[#F0F9E6]", text: "text-[#5FA01F]", count: "bg-[#73BA27]" },
              amber: { bg: "bg-amber-50", text: "text-amber-700", count: "bg-amber-500" },
              purple: { bg: "bg-violet-50", text: "text-violet-700", count: "bg-violet-600" },
              emerald: { bg: "bg-emerald-50", text: "text-emerald-700", count: "bg-emerald-600" },
              rose: { bg: "bg-rose-50", text: "text-rose-700", count: "bg-rose-500" },
            };
            const c = colors[cat.color];
            return (
              <div key={cat.id} className="glass-panel rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${c.bg} ${c.text}`}>{cat.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${c.count}`}>{cat.count}</span>
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-900">{cat.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{cat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Trend Rules ──────────────────────────────────────────────────────────
function TrendRulesTab() {
  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-sm font-semibold text-slate-800">How velocity & acceleration are calculated</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Velocity (v)", formula: "v = ΔBiomarker / ΔTime (per month)", note: "Linear regression over 6 data points" },
            { label: "Acceleration (a)", formula: "a = Δv / ΔTime (per month²)", note: "Second derivative — is decline speeding up?" },
            { label: "Projection", formula: "Value_t = Current + v·t + ½·a·t²", note: "Quadratic forward projection to threshold" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className="mt-1.5 font-mono text-xs text-[#5FA01F]">{item.formula}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1.8fr] gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Biomarker</span><span>Velocity/mo</span><span>Annual Rate</span><span>Acceleration</span><span>Projection</span>
          </div>
        </div>
        {trendRules.map((rule, i) => (
          <div key={rule.marker} className={`border-b border-slate-100/80 px-5 py-4 ${i % 2 === 0 ? "bg-white/60" : "bg-slate-50/30"}`}>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1.8fr] items-start gap-2 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{rule.marker}</p>
                {rule.accelerating && (
                  <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600">
                    <TrendingDown className="h-3 w-3" /> accelerating
                  </span>
                )}
              </div>
              <p className={`font-mono text-sm font-semibold ${rule.risk === "critical" ? "text-rose-600" : rule.risk === "high" ? "text-amber-600" : "text-slate-700"}`}>
                {rule.velocity}
              </p>
              <div>
                <p className="text-xs text-slate-700">{rule.annualRate}</p>
                {rule.multiplier !== "—" && (
                  <p className="text-[10px] text-rose-500">({rule.multiplier} expected)</p>
                )}
              </div>
              <p className="font-mono text-xs text-slate-600">{rule.acceleration}</p>
              <div className={`rounded-lg px-2 py-1.5 text-xs leading-5 ${riskBadge[rule.risk]}`}>
                {rule.projection}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50">
            <TriangleAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-700">Key Finding: eGFR declining at 26.4 mL/min/year</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Normal expected loss is 2–5 mL/min/year with age. Tony's rate is <strong>5–13× above expected</strong> and the decline is <strong>accelerating</strong> (−0.3 mL/min/month²). Without intervention, Stage 5 is projected within 12 months.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Cross-Marker Rules ───────────────────────────────────────────────────
function CrossMarkerTab() {
  const [open, setOpen] = useState<number>(0);
  return (
    <div className="space-y-3">
      <div className="glass-panel rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-800">Core IP: 5 cross-marker linkage rules that surface compound clinical risk invisible to single-biomarker monitoring.</p>
      </div>
      {crossMarkerRules.map((rule, i) => (
        <div key={rule.id} className="glass-panel overflow-hidden rounded-2xl">
          <button
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            onClick={() => setOpen(open === i ? -1 : i)}
          >
            <div className="flex items-center gap-3">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${riskBadge[rule.risk]}`}>{rule.id}</span>
              <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open === i ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">IF Condition</p>
                      <ul className="space-y-1.5">
                        {rule.ifCondition.map((c) => (
                          <li key={c} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#73BA27]" />
                            <span className="font-mono">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-[#F0F9E6]/60 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#73BA27]">Tony's Values</p>
                      <ul className="space-y-1.5">
                        {Object.entries(rule.patientValues).map(([k, v]) => (
                          <li key={k} className="text-xs leading-5 text-slate-700">
                            <span className="font-semibold text-slate-900">{k}:</span> {v}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-emerald-50/60 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">THEN → Action</p>
                      <p className="text-xs leading-5 text-slate-700">{rule.thenAction}</p>
                      <div className="mt-3 rounded-lg bg-emerald-100/80 px-3 py-2">
                        <p className="text-[11px] font-semibold text-emerald-800">{rule.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Therapy Gaps ─────────────────────────────────────────────────────────
function TherapyGapsTab() {
  const statusStyle: Record<string, { badge: string; dot: string }> = {
    amber: { badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-400" },
    blue: { badge: "bg-[#F0F9E6] text-[#5FA01F] ring-1 ring-[#C2E29A]", dot: "bg-[#8FC94F]" },
    rose: { badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", dot: "bg-rose-500" },
  };
  return (
    <div className="space-y-5">
      {therapyGapRules.map((rule) => {
        const s = statusStyle[rule.statusColor];
        return (
          <div key={rule.id} className="glass-panel overflow-hidden rounded-[2rem]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">{rule.id}</span>
                  <h4 className="text-base font-semibold text-slate-950">{rule.name}</h4>
                </div>
                <p className="mt-1 text-sm text-[#5FA01F]">{rule.drug}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${s.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {rule.status}
              </span>
            </div>
            <div className="grid gap-0 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-slate-100/80">
              <div className="p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-600">Eligibility Criteria</p>
                <ul className="space-y-2">
                  {rule.eligibility.map((e) => (
                    <li key={e} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-rose-600">Contraindication Check</p>
                <ul className="space-y-2">
                  {rule.contraindications.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {c}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-xl bg-[#F0F9E6]/60 p-3">
                  <p className="text-[11px] font-semibold text-[#73BA27]">Interaction Analysis</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-600">{rule.interactions}</p>
                </div>
              </div>
              <div className="p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-600">Trial Evidence</p>
                <p className="text-xs leading-5 text-slate-700">{rule.trialData}</p>
                <div className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white">
                  → {rule.action}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Dashboard ────────────────────────────────────────────────────────────
function DashboardTab() {
  const alertColor: Record<string, string> = { rose: "text-rose-600 bg-rose-50", amber: "text-amber-600 bg-amber-50", slate: "text-slate-600 bg-slate-100" };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="glass-panel rounded-[2rem] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Panel 1 · CKM Risk Summary</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "CKD Stage", value: "3b → 4", color: "text-rose-700" },
            { label: "CV Risk", value: "High", color: "text-amber-700" },
            { label: "Metabolic Syndrome", value: "Active", color: "text-amber-700" },
            { label: "Overall Risk Score", value: "78 / 100", color: "text-rose-700" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`mt-1 text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Panel 2 · Priority-Ranked Alerts</p>
        <div className="mt-4 space-y-2">
          {dashboardAlerts.map((alert) => {
            const cls = alertColor[alert.color] ?? alertColor.slate;
            return (
              <div key={alert.rank} className="glass-panel flex items-start gap-3 rounded-xl px-3 py-2.5">
                <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{alert.rank}</span>
                <div>
                  <span className={`text-[10px] font-bold uppercase ${cls.split(" ")[0]}`}>{alert.level}</span>
                  <p className="mt-0.5 text-xs leading-4 text-slate-700">{alert.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Panel 3 · Therapy Optimisation Roadmap</p>
        <div className="mt-4 space-y-3">
          {therapyRoadmap.map((phase, i) => (
            <div key={phase.phase} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-rose-500" : "bg-[#73BA27]"}`}>{i + 1}</div>
                {i < therapyRoadmap.length - 1 && <div className="mt-1 h-full w-px bg-slate-200" />}
              </div>
              <div className="pb-3">
                <p className="text-sm font-semibold text-slate-900">{phase.phase}</p>
                <ul className="mt-1 space-y-0.5">
                  {phase.actions.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-xs leading-5 text-slate-600">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Panel 4 · Confidence & Uncertainty Report</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3B82F6" strokeWidth="3"
                strokeDasharray={`${confidenceReport.score} ${100 - confidenceReport.score}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold text-slate-950">{confidenceReport.score}%</p>
              <p className="text-[9px] text-slate-500">confidence</p>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-emerald-700">Available data</p>
              <div className="flex flex-wrap gap-1.5">
                {confidenceReport.available.map((d) => (
                  <span key={d} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{d}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-amber-700">Missing — reduces confidence</p>
              <div className="flex flex-wrap gap-1.5">
                {confidenceReport.missing.map((d) => (
                  <span key={d} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Linkage Map ──────────────────────────────────────────────────────────
function LinkageMapTab() {
  const matrixColor = (val: string) => {
    if (val === "—") return "bg-slate-100 text-slate-400 font-medium";
    if (val === "+") return "bg-[#F0F9E6] text-[#5FA01F] font-semibold";
    if (val === "-") return "bg-rose-50 text-rose-600 font-semibold";
    return "bg-slate-50 text-slate-400";
  };
  return (
    <div className="space-y-5">
      <div className="glass-panel rounded-[2rem] p-6">
        <p className="mb-4 text-sm font-semibold text-slate-800">5 Causal Chains</p>
        <div className="space-y-3">
          {causalChains.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#73BA27] text-xs font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-mono text-sm font-semibold text-slate-900">{c.chain}</p>
                <p className="mt-0.5 text-xs text-slate-500">Driver: {c.driver}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem] p-6">
        <p className="mb-1 text-sm font-semibold text-slate-800">Biomarker Cross-Reference Matrix</p>
        <div className="mb-4 flex gap-4 text-xs text-slate-500">
          <span><span className="font-semibold text-[#73BA27]">+</span> = positive correlation</span>
          <span><span className="font-semibold text-rose-600">−</span> = inverse correlation</span>
          <span><span className="font-semibold text-slate-400">—</span> = self</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr>
                <th className="w-20 px-2 py-2 text-left text-xs text-slate-400"></th>
                {biomarkers.map((b) => (
                  <th key={b} className="px-2 py-2 text-xs font-semibold text-slate-600">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationMatrix.map((row, ri) => (
                <tr key={ri}>
                  <td className="py-1.5 pr-2 text-left text-xs font-semibold text-slate-700">{biomarkers[ri]}</td>
                  {row.map((val, ci) => (
                    <td key={ci} className="px-1 py-1">
                      <span className={`mx-auto flex h-8 w-10 items-center justify-center rounded-lg text-xs ${matrixColor(val)}`}>
                        {val}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Value Delta ──────────────────────────────────────────────────────────
function ValueDeltaTab() {
  return (
    <div className="glass-panel overflow-hidden rounded-[2rem]">
      <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4">
        <div className="grid grid-cols-[1.2fr_1.8fr_1.8fr_0.8fr] gap-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Dimension</span>
          <span className="text-slate-400">Without BeanHealth</span>
          <span className="text-[#5FA01F]">With BeanHealth</span>
          <span className="text-emerald-700">Gain</span>
        </div>
      </div>
      {valueDeltaRows.map((row, i) => (
        <div key={row.dimension} className={`border-b border-slate-100/80 px-6 py-4 ${i % 2 === 0 ? "bg-white/60" : "bg-slate-50/30"}`}>
          <div className="grid grid-cols-[1.2fr_1.8fr_1.8fr_0.8fr] gap-4 text-sm">
            <p className="font-semibold text-slate-900">{row.dimension}</p>
            <p className="text-slate-500">{row.without}</p>
            <p className="text-slate-800">{row.with}</p>
            <span className="inline-block self-start rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {row.gain}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function CKDEngineSection() {
  const [activeTab, setActiveTab] = useState<number>(0);

  const tabContent = [
    <PatientProfileTab key="profile" />,
    <TrendRulesTab key="trend" />,
    <CrossMarkerTab key="cross" />,
    <TherapyGapsTab key="therapy" />,
    <DashboardTab key="dashboard" />,
    <LinkageMapTab key="linkage" />,
    <ValueDeltaTab key="delta" />,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7 }}
      className="mt-16"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F0F9E6] px-4 py-1.5 text-xs font-semibold text-[#5FA01F]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#73BA27]" />
            Beta · In Active Development
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">
            CKD Risk Intelligence Engine
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            A full walkthrough of the engine architecture — from raw biomarker ingestion through rule evaluation to ranked clinical recommendations.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(i)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === i
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {tabContent[activeTab]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import WheelPicker from "../components/WheelPicker";
import { useAuth, apiCall } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Button } from "../components/ui/button";
import { Activity, Scale, Droplet, FlaskConical, Check, ChevronRight, Pill } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Value arrays ───────────────────────────────────────────────────────────
const SYS_VALS  = Array.from({ length: 141 }, (_, i) => i + 60);
const DIA_VALS  = Array.from({ length: 91  }, (_, i) => i + 40);
const WT_VALS   = Array.from({ length: 241 }, (_, i) => parseFloat((30 + i * 0.5).toFixed(1)));
const GLU_VALS  = Array.from({ length: 351 }, (_, i) => i + 50);
const URN_VALS  = Array.from({ length: 81  }, (_, i) => i * 50);

const findNearest = (arr, v) => arr.reduce((p, c) => Math.abs(c - v) < Math.abs(p - v) ? c : p);

const VITAL_META = {
  bp:      { labelKey: "bloodPressure", Icon: Activity,     unit: "mmHg",    color: "#1e3a2f" },
  weight:  { labelKey: "bodyWeight",    Icon: Scale,        unit: "kg",      color: "#1e3a2f" },
  glucose: { labelKey: "bloodGlucose",  Icon: Droplet,      unit: "mg/dL",   color: "#1e3a2f" },
  urine:   { labelKey: "urineOutput",   Icon: FlaskConical, unit: "mL/24h",  color: "#1e3a2f" },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getMedSlots(frequency) {
  const f = (frequency || "").toLowerCase();
  if (f.includes("lunch") || f.includes("after lunch") || f.includes("afternoon") || f.includes("midday")) return ["afternoon"];
  if (f.includes("night") || f.includes("evening") || f.includes("dinner") || f.includes("before bed") || f.includes("bedtime")) return ["night"];
  if (f.includes("twice daily") || f.includes("twice a day") || f.includes(" bd") || f.includes("b.d.")) return ["morning", "night"];
  if (f.includes("three times") || f.includes("thrice") || f.includes("tds") || f.includes("t.d.s.")) return ["morning", "afternoon", "night"];
  return ["morning"];
}

function CircularProgress({ taken, total }) {
  const pct = total > 0 ? taken / total : 0;
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <svg width={68} height={68} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="white" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="32" y="36" textAnchor="middle" fill="white" fontSize="11" fontWeight="700"
        style={{ fontFamily: "Outfit, sans-serif" }}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

// ── Vital Summary Card ─────────────────────────────────────────────────────
function VitalSummaryCard({ type, todayVital, yesterdayVital, onTap }) {
  const { t } = useLang();
  const meta = VITAL_META[type];
  const Icon = meta.Icon;
  const isRecorded = !!todayVital;

  const getDisplay = () => {
    if (!todayVital) return { val: "—", unit: "" };
    if (type === "bp") return { val: `${todayVital.systolic}/${todayVital.diastolic}`, unit: meta.unit };
    return { val: `${todayVital.value}`, unit: meta.unit };
  };

  const getDelta = () => {
    if (!todayVital || !yesterdayVital) return null;
    let delta;
    if (type === "bp") delta = todayVital.systolic - yesterdayVital.systolic;
    else delta = todayVital.value - yesterdayVital.value;
    const abs = type === "weight" ? Math.abs(parseFloat(delta.toFixed(1))) : Math.abs(Math.round(delta));
    const up = delta > 0;
    // Arrow: up = ↗ red, down = ↘ teal, zero = grey
    if (delta === 0) return { text: `0 ${t.vsYesterday}`, color: "text-muted-foreground", arrow: "" };
    return {
      text: `${abs} ${t.vsYesterday}`,
      arrow: up ? "↗" : "↘",
      color: up ? "text-red-500" : "text-emerald-600",
    };
  };

  const { val, unit } = getDisplay();
  const delta = getDelta();

  return (
    <button
      className="bg-white rounded-2xl p-4 text-left w-full border border-gray-100 active:scale-[0.97] transition-transform"
      style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
      onClick={() => onTap(type)}
      data-testid={`vital-summary-card-${type}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#6b7280" }} />
          <span className="text-xs text-gray-500 font-medium leading-tight">{t[meta.labelKey]}</span>
        </div>
        {isRecorded && (
          <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 ml-1">
            <Check className="w-3 h-3 text-emerald-600" />
          </div>
        )}
      </div>

      {/* Value */}
      {isRecorded ? (
        <>
          <div className="mb-1 flex items-baseline gap-1">
            <span className="font-bold text-foreground leading-none" style={{ fontFamily: "Outfit, sans-serif", fontSize: "clamp(24px, 6vw, 32px)" }}>
              {val}
            </span>
            <span className="text-xs text-gray-400">{unit}</span>
          </div>
          {delta && (
            <div className={`text-xs font-medium flex items-center gap-0.5 ${delta.color}`}>
              {delta.arrow && <span>{delta.arrow}</span>}
              <span>{delta.text}</span>
            </div>
          )}
        </>
      ) : (
        <div className="py-1">
          <span className="text-2xl font-light text-gray-300" style={{ fontFamily: "Outfit, sans-serif" }}>—</span>
          <p className="text-xs text-gray-400 mt-1">{t.tapToRecord}</p>
        </div>
      )}
    </button>
  );
}

// ── Medication Item ────────────────────────────────────────────────────────
function MedItem({ med, prescriptionId, onToggle }) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border transition-colors ${med.taken ? "border-emerald-100" : "border-gray-100"}`}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
        <Pill className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-base leading-tight ${med.taken ? "text-muted-foreground line-through" : "text-foreground"}`}
          style={{ fontFamily: "Outfit, sans-serif" }}>
          {med.medication_name}
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{med.dosage} • {med.notes || med.frequency}</p>
      </div>
      {/* Circular toggle */}
      <button
        data-testid={`med-toggle-${med.medication_name.replace(/\s/g, "-")}`}
        onClick={() => onToggle(med, !med.taken)}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
          med.taken ? "bg-primary border-primary" : "bg-white border-gray-300"
        }`}
      >
        {med.taken && <Check className="w-3.5 h-3.5 text-white" />}
      </button>
    </div>
  );
}

// ── Record Sheet ───────────────────────────────────────────────────────────
function RecordSheet({ initialType, onClose, onSaved }) {
  const { t } = useLang();
  const types = ["bp", "weight", "glucose", "urine"];
  const [activeType, setActiveType] = useState(initialType || "bp");
  const [vals, setVals] = useState({ bp: { sys: 120, dia: 80 }, weight: { value: 70 }, glucose: { value: 100 }, urine: { value: 1500 } });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const meta = VITAL_META[activeType];
      const payload = { vital_type: activeType, unit: meta.unit, notes: "" };
      if (activeType === "bp") { payload.systolic = vals.bp.sys; payload.diastolic = vals.bp.dia; }
      else payload.value = vals[activeType].value;
      await apiCall("post", "/vitals", payload);
      onSaved(activeType);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const up = (type, field, v) => setVals(p => ({ ...p, [type]: { ...p[type], [field]: v } }));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden animate-slideUp" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {/* Handle */}
        <div className="py-3 flex justify-center"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <p className="text-center text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>{t.recordVital}</p>

        {/* Vital type tabs */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-0.5">
          {types.map((tp) => {
            const meta = VITAL_META[tp];
            const Icon = meta.Icon;
            const active = activeType === tp;
            return (
              <button key={tp} onClick={() => setActiveType(tp)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                <Icon className="w-3.5 h-3.5" />
                {t[meta.labelKey]}
              </button>
            );
          })}
        </div>

        {/* Pickers */}
        <div className="px-6 py-2">
          {activeType === "bp" ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{t.systolic}</p>
                <WheelPicker values={SYS_VALS} value={vals.bp.sys} onChange={(v) => up("bp", "sys", v)} />
              </div>
              <span className="text-3xl text-gray-200 font-light" style={{ fontFamily: "Outfit, sans-serif" }}>/</span>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{t.diastolic}</p>
                <WheelPicker values={DIA_VALS} value={vals.bp.dia} onChange={(v) => up("bp", "dia", v)} />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{VITAL_META[activeType].unit}</p>
              <WheelPicker
                values={activeType === "weight" ? WT_VALS : activeType === "glucose" ? GLU_VALS : URN_VALS}
                value={vals[activeType].value}
                onChange={(v) => up(activeType, "value", v)}
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-6 pt-4 flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose}>{t.cancel}</Button>
          <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}
            data-testid="record-sheet-save">
            {saving ? "…" : t.record}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const [todayVitals, setTodayVitals] = useState([]);
  const [yesterdayVitals, setYesterdayVitals] = useState([]);
  const [medData, setMedData] = useState({ prescription: null, checklist: [] });
  const [loadingMed, setLoadingMed] = useState(true);
  const [sheetType, setSheetType] = useState(null); // open record sheet

  const fetchVitals = useCallback(async () => {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const { data } = await apiCall("get", `/vitals?from_date=${twoDaysAgo.toISOString().split("T")[0]}&limit=50`);
      const todayStr = new Date().toISOString().split("T")[0];
      const yestStr  = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      setTodayVitals(data.filter(v => v.recorded_at.startsWith(todayStr)));
      setYesterdayVitals(data.filter(v => v.recorded_at.startsWith(yestStr)));
    } catch {}
  }, []);

  const fetchMed = useCallback(async () => {
    setLoadingMed(true);
    try {
      const { data } = await apiCall("get", "/medication/today");
      setMedData(data);
    } catch {} finally { setLoadingMed(false); }
  }, []);

  useEffect(() => { fetchVitals(); fetchMed(); }, [fetchVitals, fetchMed]);

  const getVital = (type, arr) => arr.find(v => v.vital_type === type) || null;

  const handleMedToggle = async (med, checked) => {
    setMedData(prev => ({ ...prev, checklist: prev.checklist.map(m => m.medication_name === med.medication_name ? { ...m, taken: checked } : m) }));
    try { await apiCall("post", "/medication/check", { prescription_id: medData.prescription?.id, medication_name: med.medication_name, date: med.date, taken: checked }); } catch {}
  };

  const handleSheetSaved = (type) => {
    setSheetType(null);
    fetchVitals();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.goodMorning;
    if (h < 17) return t.goodAfternoon;
    return t.goodEvening;
  };

  // Build grouped medication list
  const buildMedGroups = () => {
    const groups = { morning: [], afternoon: [], night: [] };
    medData.checklist.forEach(med => {
      const slots = getMedSlots(med.frequency);
      slots.forEach(slot => { if (groups[slot]) groups[slot].push({ ...med }); });
    });
    return groups;
  };

  const medGroups = buildMedGroups();
  const uniqueTaken = medData.checklist.filter(m => m.taken).length;
  const uniqueTotal = medData.checklist.length;

  const slotLabels = [
    { key: "morning",   label: t.morning },
    { key: "afternoon", label: t.afternoon },
    { key: "night",     label: t.night },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F2" }}>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-5 pb-32">

        {/* Greeting */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Adherence Hero Card */}
        <div className="rounded-2xl bg-primary px-5 py-4 mb-5 flex items-center justify-between"
          style={{ boxShadow: "0 4px 20px hsl(151 22% 31% / 0.35)" }}
          data-testid="adherence-hero-card">
          <div>
            <p className="text-4xl font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
              {uniqueTaken} <span className="text-2xl font-semibold text-white/70">of {uniqueTotal}</span>
            </p>
            <p className="text-white/75 text-sm mt-1">{t.takenToday}</p>
          </div>
          <CircularProgress taken={uniqueTaken} total={uniqueTotal} />
        </div>

        {/* Vital Summary Cards 2×2 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Object.keys(VITAL_META).map((type) => (
            <VitalSummaryCard
              key={type}
              type={type}
              todayVital={getVital(type, todayVitals)}
              yesterdayVital={getVital(type, yesterdayVitals)}
              onTap={(tp) => setSheetType(tp)}
            />
          ))}
        </div>

        {/* Medications */}
        {!loadingMed && medData.prescription && (
          <div>
            {slotLabels.map(({ key, label }) => {
              const meds = medGroups[key];
              if (!meds || meds.length === 0) return null;
              return (
                <div key={key} className="mb-4">
                  <p className="text-xs font-bold text-gray-400 tracking-widest mb-2 uppercase"
                    style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
                    {label}
                  </p>
                  <div className="space-y-2.5">
                    {meds.map((med, i) => (
                      <MedItem
                        key={`${med.medication_name}-${key}-${i}`}
                        med={med}
                        prescriptionId={medData.prescription?.id}
                        onToggle={handleMedToggle}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* View history button */}
            <button
              onClick={() => navigate("/vitals-history")}
              data-testid="view-history-btn"
              className="w-full bg-gray-100 hover:bg-gray-200 transition-colors rounded-2xl px-5 py-4 flex items-center justify-between mt-2"
            >
              <span className="text-base font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                {t.viewHistory}
              </span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {loadingMed && (
          <div className="space-y-2.5">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white/60 animate-pulse rounded-2xl" />)}
          </div>
        )}
      </main>

      <BottomNav onFabClick={() => setSheetType("bp")} />

      {/* Record Sheet */}
      {sheetType && (
        <RecordSheet
          initialType={sheetType}
          onClose={() => setSheetType(null)}
          onSaved={handleSheetSaved}
        />
      )}
    </div>
  );
}

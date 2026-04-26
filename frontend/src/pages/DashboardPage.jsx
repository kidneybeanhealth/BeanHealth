import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import WheelPicker from "../components/WheelPicker";
import { useAuth, apiCall } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { Heart, Scale, Droplets, FlaskConical, CheckCircle2 } from "lucide-react";

// ── Picker value arrays ────────────────────────────────────────────────────
const SYS_VALS = Array.from({ length: 141 }, (_, i) => i + 60);
const DIA_VALS = Array.from({ length: 91 }, (_, i) => i + 40);
const WEIGHT_VALS = Array.from({ length: 241 }, (_, i) =>
  parseFloat((30 + i * 0.5).toFixed(1))
);
const GLUCOSE_VALS = Array.from({ length: 351 }, (_, i) => i + 50);
const URINE_VALS = Array.from({ length: 81 }, (_, i) => i * 50);

const findNearest = (arr, target) =>
  arr.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );

const VITAL_META = {
  bp: { label: "bloodPressure", Icon: Heart, color: "#e11d48", bg: "bg-rose-50", border: "border-rose-100", unit: "mmHg" },
  weight: { label: "bodyWeight", Icon: Scale, color: "#2563eb", bg: "bg-blue-50", border: "border-blue-100", unit: "kg" },
  glucose: { label: "bloodGlucose", Icon: FlaskConical, color: "#d97706", bg: "bg-amber-50", border: "border-amber-100", unit: "mg/dL" },
  urine: { label: "urineOutput", Icon: Droplets, color: "#0d9488", bg: "bg-teal-50", border: "border-teal-100", unit: "mL/24h" },
};

function VitalCard({ type, todayVital, onSave }) {
  const { t } = useLang();
  const meta = VITAL_META[type];
  const Icon = meta.Icon;

  const initPicker = () => {
    if (type === "bp") {
      return {
        sys: todayVital ? todayVital.systolic : 120,
        dia: todayVital ? todayVital.diastolic : 80,
      };
    }
    const defMap = { weight: 70, glucose: 100, urine: 1500 };
    const arr = type === "weight" ? WEIGHT_VALS : type === "glucose" ? GLUCOSE_VALS : URINE_VALS;
    const raw = todayVital ? todayVital.value : defMap[type];
    return { value: findNearest(arr, raw) };
  };

  const [picker, setPicker] = useState(initPicker);
  const [confirmed, setConfirmed] = useState(!!todayVital);
  const [saving, setSaving] = useState(false);

  // Sync if today's vital loaded after mount
  useEffect(() => {
    if (todayVital) {
      if (type === "bp") {
        setPicker({ sys: todayVital.systolic, dia: todayVital.diastolic });
      } else {
        const arr = type === "weight" ? WEIGHT_VALS : type === "glucose" ? GLUCOSE_VALS : URINE_VALS;
        setPicker({ value: findNearest(arr, todayVital.value) });
      }
      setConfirmed(true);
    }
  }, [todayVital, type]);

  const handleRecord = async () => {
    setSaving(true);
    try {
      const payload = { vital_type: type, unit: meta.unit, notes: "" };
      if (type === "bp") {
        payload.systolic = picker.sys;
        payload.diastolic = picker.dia;
      } else {
        payload.value = picker.value;
      }
      await apiCall("post", "/vitals", payload);
      setConfirmed(true);
      onSave();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const displayVal =
    type === "bp"
      ? `${picker.sys} / ${picker.dia}`
      : `${picker.value}`;

  return (
    <Card
      className={`border ${meta.border} vital-card overflow-hidden animate-fadeInUp`}
      data-testid={`vital-card-${type}`}
    >
      {/* Card header */}
      <div className={`${meta.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/70 rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4" style={{ color: meta.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t[meta.label]}</p>
            <p className="text-xs text-muted-foreground">{meta.unit}</p>
          </div>
        </div>
        {confirmed && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">{displayVal}</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
        )}
      </div>

      {/* Picker area */}
      <div className={`px-3 py-2 transition-colors duration-300 ${confirmed ? "bg-muted/30" : "bg-white"}`}>
        {type === "bp" ? (
          <div className="flex items-center gap-1">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">{t.systolic}</p>
              <WheelPicker
                values={SYS_VALS}
                value={picker.sys}
                onChange={(v) => setPicker((p) => ({ ...p, sys: v }))}
                disabled={confirmed}
              />
            </div>
            <div className="flex flex-col items-center gap-1 px-1">
              <span className="text-2xl text-muted-foreground/40 font-light" style={{ fontFamily: "Outfit, sans-serif" }}>/</span>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">{t.diastolic}</p>
              <WheelPicker
                values={DIA_VALS}
                value={picker.dia}
                onChange={(v) => setPicker((p) => ({ ...p, dia: v }))}
                disabled={confirmed}
              />
            </div>
          </div>
        ) : (
          <WheelPicker
            values={type === "weight" ? WEIGHT_VALS : type === "glucose" ? GLUCOSE_VALS : URINE_VALS}
            value={picker.value}
            onChange={(v) => setPicker({ value: v })}
            disabled={confirmed}
          />
        )}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4">
        {confirmed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm border-border hover:border-primary hover:text-primary transition-all"
            onClick={() => setConfirmed(false)}
            data-testid={`edit-vital-btn-${type}`}
          >
            {t.edit}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full h-9 text-sm bg-primary hover:bg-primary/90 text-white"
            onClick={handleRecord}
            disabled={saving}
            data-testid={`record-vital-btn-${type}`}
          >
            {saving ? "…" : t.record}
          </Button>
        )}
      </div>
    </Card>
  );
}

function MedChecklist({ checklist, prescription, onToggle }) {
  const { t } = useLang();
  if (!prescription) return null;
  const taken = checklist.filter((m) => m.taken).length;
  return (
    <Card className="p-5 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{t.todayMeds}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {prescription.doctor_name} · {taken}/{checklist.length} {t.taken}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary" style={{ fontFamily: "Outfit, sans-serif" }}>
            {Math.round((taken / Math.max(checklist.length, 1)) * 100)}%
          </span>
          <p className="text-xs text-muted-foreground">{t.adherence}</p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-4">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(taken / Math.max(checklist.length, 1)) * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {checklist.map((med, i) => (
          <div
            key={i}
            data-testid={`med-item-${i}`}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
              med.taken ? "bg-green-50 border-green-100" : "bg-white border-border"
            }`}
          >
            <Checkbox
              id={`med-${i}`}
              data-testid={`med-checkbox-${i}`}
              checked={med.taken}
              onCheckedChange={(checked) => onToggle(med, checked)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <label
                htmlFor={`med-${i}`}
                className={`text-sm font-medium cursor-pointer transition-colors ${
                  med.taken ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {med.medication_name}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {med.dosage} · {med.frequency}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [todayVitals, setTodayVitals] = useState([]);
  const [medData, setMedData] = useState({ prescription: null, checklist: [] });
  const [loadingMed, setLoadingMed] = useState(true);

  const fetchTodayVitals = useCallback(async () => {
    try {
      const { data } = await apiCall("get", "/vitals/today");
      setTodayVitals(data);
    } catch {}
  }, []);

  const fetchMedication = useCallback(async () => {
    setLoadingMed(true);
    try {
      const { data } = await apiCall("get", "/medication/today");
      setMedData(data);
    } catch {} finally { setLoadingMed(false); }
  }, []);

  useEffect(() => { fetchTodayVitals(); fetchMedication(); }, [fetchTodayVitals, fetchMedication]);

  const getVital = (type) => todayVitals.find((v) => v.vital_type === type) || null;

  const handleMedToggle = async (med, checked) => {
    setMedData((prev) => ({
      ...prev,
      checklist: prev.checklist.map((m) =>
        m.medication_name === med.medication_name ? { ...m, taken: checked } : m
      ),
    }));
    try {
      await apiCall("post", "/medication/check", {
        prescription_id: medData.prescription?.id,
        medication_name: med.medication_name,
        date: med.date,
        taken: checked,
      });
    } catch {}
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.goodMorning;
    if (h < 17) return t.goodAfternoon;
    return t.goodEvening;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-32">
        {/* Greeting */}
        <div className="mb-6 animate-fadeInUp">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Vitals section label */}
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full inline-block" />
          {t.recordVitals}
        </h2>

        {/* 2×2 Vital cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Object.keys(VITAL_META).map((type, i) => (
            <div key={type} className={`stagger-${i + 1}`}>
              <VitalCard type={type} todayVital={getVital(type)} onSave={fetchTodayVitals} />
            </div>
          ))}
        </div>

        {/* Medications */}
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full inline-block" />
          {t.todayMeds}
        </h2>

        {loadingMed ? (
          <Card className="p-5 border border-border">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />)}
            </div>
          </Card>
        ) : medData.prescription ? (
          <MedChecklist
            checklist={medData.checklist}
            prescription={medData.prescription}
            onToggle={handleMedToggle}
          />
        ) : (
          <Card className="p-8 text-center border border-border">
            <p className="text-sm text-muted-foreground">{t.noMedications}</p>
          </Card>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import { useAuth, apiCall } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Heart, Scale, Droplets, FlaskConical, Save, CheckCircle2 } from "lucide-react";

const VITAL_CONFIG = {
  bp: {
    label: "Blood Pressure",
    icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
    unit: "mmHg",
  },
  weight: {
    label: "Body Weight",
    icon: Scale,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    unit: "kg",
  },
  glucose: {
    label: "Blood Glucose",
    icon: FlaskConical,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    unit: "mg/dL",
  },
  urine: {
    label: "Urine Output",
    icon: Droplets,
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
    unit: "mL/24h",
  },
};

function VitalCard({ type, latestVital, onSave }) {
  const config = VITAL_CONFIG[type];
  const Icon = config.icon;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState(
    type === "bp" ? { systolic: "", diastolic: "", notes: "" } : { value: "", notes: "" }
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        vital_type: type,
        unit: config.unit,
        notes: form.notes,
        ...(type === "bp"
          ? { systolic: parseFloat(form.systolic), diastolic: parseFloat(form.diastolic) }
          : { value: parseFloat(form.value) }),
      };
      await apiCall("post", "/vitals", payload);
      setSaved(true);
      setForm(type === "bp" ? { systolic: "", diastolic: "", notes: "" } : { value: "", notes: "" });
      onSave();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const displayValue = latestVital
    ? type === "bp"
      ? `${latestVital.systolic}/${latestVital.diastolic}`
      : latestVital.value
    : null;

  return (
    <Card className={`p-5 border ${config.border} vital-card animate-fadeInUp`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 ${config.bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.unit}</p>
          </div>
        </div>
        {saved && <CheckCircle2 className="w-5 h-5 text-green-600 animate-fadeInUp" />}
      </div>

      {displayValue && (
        <div className="mb-3 p-2.5 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-0.5">Last recorded</p>
          <p className={`text-2xl font-semibold ${config.color}`} style={{ fontFamily: "Outfit, sans-serif" }}>
            {displayValue}
            <span className="text-xs text-muted-foreground font-normal ml-1">{config.unit}</span>
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-2">
        {type === "bp" ? (
          <div className="flex gap-2">
            <Input
              data-testid={`vital-bp-systolic`}
              type="number" placeholder="Systolic"
              value={form.systolic}
              onChange={(e) => setForm({ ...form, systolic: e.target.value })}
              required className="h-10 text-sm"
            />
            <Input
              data-testid={`vital-bp-diastolic`}
              type="number" placeholder="Diastolic"
              value={form.diastolic}
              onChange={(e) => setForm({ ...form, diastolic: e.target.value })}
              required className="h-10 text-sm"
            />
          </div>
        ) : (
          <Input
            data-testid={`vital-${type}-value`}
            type="number" step="0.1"
            placeholder={`Enter ${config.label.toLowerCase()}`}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required className="h-10 text-sm"
          />
        )}
        <Button
          type="submit"
          data-testid={`save-vital-${type}`}
          disabled={saving}
          size="sm"
          className="w-full bg-primary hover:bg-primary/90 text-white h-9"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Saving…" : "Record"}
        </Button>
      </form>
    </Card>
  );
}

function MedicationChecklist({ checklist, prescription, onToggle }) {
  if (!prescription) return null;
  const taken = checklist.filter((m) => m.taken).length;
  return (
    <Card className="p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">Today's Medications</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prescribed by {prescription.doctor_name} · {taken}/{checklist.length} taken
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-semibold text-primary" style={{ fontFamily: "Outfit, sans-serif" }}>
            {Math.round((taken / Math.max(checklist.length, 1)) * 100)}%
          </span>
          <p className="text-xs text-muted-foreground">adherence</p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(taken / Math.max(checklist.length, 1)) * 100}%` }}
        />
      </div>
      <div className="space-y-2.5">
        {checklist.map((med, i) => (
          <div
            key={i}
            data-testid={`med-item-${i}`}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 ${
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
    } catch {} finally {
      setLoadingMed(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayVitals();
    fetchMedication();
  }, [fetchTodayVitals, fetchMedication]);

  const getLatestVital = (type) => todayVitals.find((v) => v.vital_type === type) || null;

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
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Greeting */}
        <div className="mb-8 animate-fadeInUp">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">{dateStr}</p>
        </div>

        {/* Vitals Grid */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full inline-block" />
            Record Today's Vitals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.keys(VITAL_CONFIG).map((type, i) => (
              <div key={type} className={`stagger-${i + 1}`}>
                <VitalCard type={type} latestVital={getLatestVital(type)} onSave={fetchTodayVitals} />
              </div>
            ))}
          </div>
        </section>

        {/* Medication Checklist */}
        <section className="animate-fadeInUp stagger-5">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full inline-block" />
            Medication Checklist
          </h2>
          {loadingMed ? (
            <Card className="p-6 border border-border">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            </Card>
          ) : medData.prescription ? (
            <MedicationChecklist
              checklist={medData.checklist}
              prescription={medData.prescription}
              onToggle={handleMedToggle}
            />
          ) : (
            <Card className="p-8 border border-border text-center">
              <p className="text-muted-foreground text-sm">No prescription found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your doctor will add your prescription to the system.
              </p>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

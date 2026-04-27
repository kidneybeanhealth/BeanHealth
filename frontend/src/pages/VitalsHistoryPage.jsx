import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { apiCall } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Pencil, Trash2, Heart, Scale, FlaskConical, Droplets, Check, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const VITAL_META = {
  bp:      { labelKey: "bloodPressure", icon: Heart,        color: "#e11d48", unit: "mmHg" },
  weight:  { labelKey: "bodyWeight",    icon: Scale,        color: "#2563eb", unit: "kg" },
  glucose: { labelKey: "bloodGlucose",  icon: FlaskConical, color: "#d97706", unit: "mg/dL" },
  urine:   { labelKey: "urineOutput",   icon: Droplets,     color: "#0d9488", unit: "mL" },
};
const VITAL_ORDER = ["bp", "weight", "glucose", "urine"];

const formatDateLong = (str) =>
  new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatChartDate = (str) =>
  new Date(str).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const getValStr = (v) =>
  v.vital_type === "bp" ? `${v.systolic}/${v.diastolic}` : `${v.value}`;

// ── Vital tile inside date card ────────────────────────────────────────────
function VitalTile({ type, vital, t }) {
  const meta = VITAL_META[type];
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground font-medium mb-1" style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
        {t[meta.labelKey]}
      </p>
      {vital ? (
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-bold text-foreground leading-none tracking-tight"
            style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(22px, 5.5vw, 28px)" }}>
            {getValStr(vital)}
          </span>
          <span className="text-sm text-muted-foreground">{vital.unit}</span>
        </div>
      ) : (
        <span className="text-lg font-light text-gray-300" style={{ fontFamily: "Fraunces, serif" }}>—</span>
      )}
    </div>
  );
}

// ── Edit-day dialog ────────────────────────────────────────────────────────
function EditDayDialog({ open, dateKey, group, onClose, onChanged, t }) {
  const [rows, setRows] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!open || !group) return;
    const initial = {};
    VITAL_ORDER.forEach((type) => {
      const v = group[type];
      if (v) {
        initial[type] = v.vital_type === "bp"
          ? { systolic: String(v.systolic ?? ""), diastolic: String(v.diastolic ?? "") }
          : { value: String(v.value ?? "") };
      }
    });
    setRows(initial);
  }, [open, group]);

  if (!group) return null;

  const handleSave = async (type) => {
    const v = group[type];
    if (!v) return;
    setSavingId(v.id);
    try {
      const payload = type === "bp"
        ? { systolic: parseFloat(rows.bp?.systolic), diastolic: parseFloat(rows.bp?.diastolic) }
        : { value: parseFloat(rows[type]?.value) };
      await apiCall("put", `/vitals/${v.id}`, payload);
      onChanged();
    } catch {} finally { setSavingId(null); }
  };

  const handleDelete = async (type) => {
    const v = group[type];
    if (!v) return;
    setDeletingId(v.id);
    try {
      await apiCall("delete", `/vitals/${v.id}`);
      onChanged();
    } catch {} finally { setDeletingId(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="edit-day-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Fraunces, serif", fontSize: "22px", fontWeight: 600 }}>
            {t.editEntriesFor}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {dateKey && formatDateLong(dateKey)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {VITAL_ORDER.map((type) => {
            const meta = VITAL_META[type];
            const v = group[type];
            if (!v) {
              return (
                <div key={type} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40">
                  <span className="text-sm text-muted-foreground">{t[meta.labelKey]}</span>
                  <span className="text-xs text-gray-400 italic">{t.notRecorded}</span>
                </div>
              );
            }
            const row = rows[type] || {};
            return (
              <div key={type} className="rounded-xl border border-border p-3" data-testid={`edit-row-${type}`}>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-foreground">{t[meta.labelKey]}</Label>
                  <span className="text-xs text-muted-foreground">{v.unit}</span>
                </div>
                {type === "bp" ? (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Input type="number" className="h-11 text-base" value={row.systolic ?? ""}
                      onChange={(e) => setRows({ ...rows, bp: { ...rows.bp, systolic: e.target.value } })}
                      placeholder="SYS" data-testid={`edit-input-bp-sys`} />
                    <Input type="number" className="h-11 text-base" value={row.diastolic ?? ""}
                      onChange={(e) => setRows({ ...rows, bp: { ...rows.bp, diastolic: e.target.value } })}
                      placeholder="DIA" data-testid={`edit-input-bp-dia`} />
                  </div>
                ) : (
                  <Input type="number" step="0.1" className="h-11 text-base mb-2" value={row.value ?? ""}
                    onChange={(e) => setRows({ ...rows, [type]: { value: e.target.value } })}
                    data-testid={`edit-input-${type}`} />
                )}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(type)} disabled={deletingId === v.id}
                    data-testid={`edit-delete-${type}`}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> {t.deleteVital}
                  </Button>
                  <Button size="sm" className="h-9 bg-primary hover:bg-primary/90"
                    onClick={() => handleSave(type)} disabled={savingId === v.id}
                    data-testid={`edit-save-${type}`}>
                    <Check className="w-3.5 h-3.5 mr-1" /> {savingId === v.id ? "…" : t.saveChanges}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="edit-day-close">{t.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete-day confirm ─────────────────────────────────────────────────────
function DeleteDayDialog({ open, dateKey, count, onClose, onConfirm, t }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="delete-day-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 600 }}>
            {t.deleteDayTitle}
          </DialogTitle>
          <DialogDescription>
            {t.deleteDayDesc} <strong>{dateKey && formatDateLong(dateKey)}</strong> ({count}).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>{t.cancel}</Button>
          <Button variant="destructive" onClick={handle} disabled={loading} data-testid="delete-day-confirm">
            {loading ? "…" : t.deleteConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function VitalsHistoryPage() {
  const { t } = useLang();
  const [vitals, setVitals] = useState([]);
  const [range, setRange] = useState("30");
  const [tab, setTab] = useState("list");
  const [loading, setLoading] = useState(true);
  const [editDateKey, setEditDateKey] = useState(null);
  const [deleteDateKey, setDeleteDateKey] = useState(null);

  const fetchVitals = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(range));
      const params = new URLSearchParams({ from_date: from.toISOString().split("T")[0], limit: "500" });
      const { data } = await apiCall("get", `/vitals?${params}`);
      setVitals(data);
    } catch {} finally { setLoading(false); }
  }, [range]);

  useEffect(() => { fetchVitals(); }, [fetchVitals]);

  // Group by YYYY-MM-DD → { [date]: { bp, weight, glucose, urine } }
  const grouped = useMemo(() => {
    const map = {};
    vitals.forEach((v) => {
      const d = v.recorded_at.split("T")[0];
      if (!map[d]) map[d] = {};
      // If multiple entries same day, keep the most recent per type
      const existing = map[d][v.vital_type];
      if (!existing || v.recorded_at > existing.recorded_at) {
        map[d][v.vital_type] = v;
      }
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [vitals]);

  const buildChart = (type) =>
    vitals.filter((v) => v.vital_type === type)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((v) => ({ date: formatChartDate(v.recorded_at), systolic: v.systolic, diastolic: v.diastolic, value: v.value }));

  const currentEditGroup = editDateKey ? (grouped.find(([d]) => d === editDateKey)?.[1] || null) : null;
  const currentDeleteGroup = deleteDateKey ? (grouped.find(([d]) => d === deleteDateKey)?.[1] || null) : null;
  const currentDeleteCount = currentDeleteGroup ? Object.keys(currentDeleteGroup).length : 0;

  const confirmDeleteDay = async () => {
    if (!currentDeleteGroup) return;
    const ids = Object.values(currentDeleteGroup).map((v) => v.id);
    await Promise.all(ids.map((id) => apiCall("delete", `/vitals/${id}`)));
    setDeleteDateKey(null);
    fetchVitals();
  };

  const ranges = [
    { v: "7", label: t.range7 },
    { v: "30", label: t.range30 },
    { v: "90", label: t.range90 },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F2" }}>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-5 pb-32">
        {/* Title */}
        <h1 className="mb-4"
          style={{ fontFamily: "Fraunces, serif", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.01em", color: "#1A1C1A" }}
          data-testid="history-title">
          {t.historyTitle}
        </h1>

        {/* List / Trends pill tabs */}
        <div className="bg-muted rounded-full p-1 flex mb-5" role="tablist" data-testid="history-tabs">
          {[
            { v: "list", label: t.list },
            { v: "trends", label: t.trends },
          ].map(({ v, label }) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              data-testid={`history-tab-${v}`}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                tab === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Range chips */}
        <div className="flex gap-2 mb-5">
          {ranges.map((r) => (
            <button
              key={r.v}
              onClick={() => setRange(r.v)}
              data-testid={`range-${r.v}`}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                range === r.v ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "list" ? (
          loading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-40 bg-white/60 animate-pulse rounded-2xl" />)}
            </div>
          ) : grouped.length === 0 ? (
            <Card className="p-8 text-center border border-border" data-testid="no-vitals">
              <p className="text-muted-foreground text-sm">{t.noVitals}</p>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="vitals-date-list">
              {grouped.map(([dateKey, group]) => (
                <div
                  key={dateKey}
                  data-testid={`date-card-${dateKey}`}
                  className="bg-white rounded-2xl border border-gray-200 p-5 transition-shadow hover:shadow-sm"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <button
                      onClick={() => setEditDateKey(dateKey)}
                      className="text-left flex-1"
                      data-testid={`date-header-${dateKey}`}
                      style={{
                        fontFamily: "Fraunces, serif",
                        fontSize: "22px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: "#1A1C1A",
                      }}
                    >
                      {formatDateLong(dateKey)}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditDateKey(dateKey)}
                        data-testid={`edit-day-${dateKey}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteDateKey(dateKey)}
                        data-testid={`delete-day-${dateKey}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 2x2 vital grid */}
                  <button
                    onClick={() => setEditDateKey(dateKey)}
                    className="grid grid-cols-2 gap-y-4 gap-x-4 pt-4 w-full text-left"
                    data-testid={`date-body-${dateKey}`}
                  >
                    {VITAL_ORDER.map((type) => (
                      <VitalTile key={type} type={type} vital={group[type]} t={t} />
                    ))}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {[
              { type: "bp", icon: Heart, lines: [{ key: "systolic", color: "#e11d48", name: "Systolic" }, { key: "diastolic", color: "#fb7185", name: "Diastolic", dash: "4 2" }] },
              { type: "weight", icon: Scale, lines: [{ key: "value", color: "#2563eb", name: "Weight (kg)" }] },
              { type: "glucose", icon: FlaskConical, lines: [{ key: "value", color: "#d97706", name: "Glucose (mg/dL)" }] },
              { type: "urine", icon: Droplets, lines: [{ key: "value", color: "#0d9488", name: "Urine (mL)" }] },
            ].map(({ type, icon: Icon, lines }) => (
              <Card key={type} className="p-5 border border-gray-200 rounded-2xl" data-testid={`chart-${type}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4" style={{ color: VITAL_META[type].color }} />
                  <h3 className="text-sm font-semibold text-foreground">{t[VITAL_META[type].labelKey]}</h3>
                  <span className="text-xs text-muted-foreground">({VITAL_META[type].unit})</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={buildChart(type)} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {lines.map((l) => (
                      <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} name={l.name} strokeDasharray={l.dash} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <EditDayDialog
        open={!!editDateKey}
        dateKey={editDateKey}
        group={currentEditGroup}
        onClose={() => setEditDateKey(null)}
        onChanged={fetchVitals}
        t={t}
      />
      <DeleteDayDialog
        open={!!deleteDateKey}
        dateKey={deleteDateKey}
        count={currentDeleteCount}
        onClose={() => setDeleteDateKey(null)}
        onConfirm={confirmDeleteDay}
        t={t}
      />
    </div>
  );
}

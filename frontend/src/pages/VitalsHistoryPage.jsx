import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { apiCall } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Pencil, Trash2, Heart, Scale, FlaskConical, Droplets } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const VITAL_META = {
  bp: { labelKey: "bloodPressure", icon: Heart, color: "#e11d48", unit: "mmHg" },
  weight: { labelKey: "bodyWeight", icon: Scale, color: "#2563eb", unit: "kg" },
  glucose: { labelKey: "bloodGlucose", icon: FlaskConical, color: "#d97706", unit: "mg/dL" },
  urine: { labelKey: "urineOutput", icon: Droplets, color: "#0d9488", unit: "mL/24h" },
};

function formatDate(str) {
  return new Date(str).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatChartDate(str) {
  return new Date(str).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function VitalBadge({ type, t }) {
  const meta = VITAL_META[type] || {};
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      {Icon && <Icon className="w-3 h-3" style={{ color: meta.color }} />}
      {t[meta.labelKey]}
    </span>
  );
}

export default function VitalsHistoryPage() {
  const { t } = useLang();
  const [vitals, setVitals] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [range, setRange] = useState("14");
  const [loading, setLoading] = useState(true);
  const [editVital, setEditVital] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchVitals = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(range));
      const params = new URLSearchParams({ from_date: from.toISOString().split("T")[0], limit: "200" });
      if (filterType !== "all") params.append("vital_type", filterType);
      const { data } = await apiCall("get", `/vitals?${params}`);
      setVitals(data);
    } catch {} finally { setLoading(false); }
  }, [filterType, range]);

  useEffect(() => { fetchVitals(); }, [fetchVitals]);

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {};
      if (editVital.vital_type === "bp") {
        payload.systolic = parseFloat(editForm.systolic);
        payload.diastolic = parseFloat(editForm.diastolic);
      } else {
        payload.value = parseFloat(editForm.value);
      }
      if (editForm.notes !== undefined) payload.notes = editForm.notes;
      await apiCall("put", `/vitals/${editVital.id}`, payload);
      setEditVital(null); fetchVitals();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await apiCall("delete", `/vitals/${id}`);
      setVitals((prev) => prev.filter((v) => v.id !== id));
    } catch {} finally { setDeleting(null); }
  };

  const buildChart = (type) =>
    vitals.filter((v) => v.vital_type === type)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((v) => ({ date: formatChartDate(v.recorded_at), systolic: v.systolic, diastolic: v.diastolic, value: v.value }));

  const displayed = filterType === "all" ? vitals : vitals.filter((v) => v.vital_type === filterType);
  const getValStr = (v) =>
    v.vital_type === "bp" ? `${v.systolic}/${v.diastolic} ${v.unit}` : `${v.value} ${v.unit}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="mb-5 animate-fadeInUp">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {t.vitalsHistory}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.trackTrends}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 animate-fadeInUp stagger-1">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44 h-9 text-sm" data-testid="filter-vital-type-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allVitals}</SelectItem>
              {Object.entries(VITAL_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t[v.labelKey]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36 h-9 text-sm" data-testid="filter-date-range-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t.last7}</SelectItem>
              <SelectItem value="14">{t.last14}</SelectItem>
              <SelectItem value="30">{t.last30}</SelectItem>
              <SelectItem value="90">{t.last90}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="list" className="animate-fadeInUp stagger-2">
          <TabsList className="mb-4">
            <TabsTrigger value="list" data-testid="tab-list-view">{t.listView}</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends-view">{t.trends}</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : displayed.length === 0 ? (
              <Card className="p-8 text-center border border-border"><p className="text-muted-foreground text-sm">{t.noVitals}</p></Card>
            ) : (
              <div className="space-y-2" data-testid="vitals-list">
                {displayed.map((v, i) => (
                  <Card key={v.id} data-testid={`vital-row-${i}`} className="px-4 py-3 border border-border flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <VitalBadge type={v.vital_type} t={t} />
                      <div>
                        <p className="font-semibold text-foreground text-base" style={{ fontFamily: "Outfit, sans-serif" }}>{getValStr(v)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(v.recorded_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-primary" onClick={() => { setEditVital(v); setEditForm({ systolic: v.systolic || "", diastolic: v.diastolic || "", value: v.value || "", notes: v.notes || "" }); }} data-testid={`edit-vital-${v.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v.id)} disabled={deleting === v.id} data-testid={`delete-vital-${v.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[
                { type: "bp", icon: Heart, lines: [{ key: "systolic", color: "#e11d48", name: "Systolic" }, { key: "diastolic", color: "#fb7185", name: "Diastolic", dash: "4 2" }] },
                { type: "weight", icon: Scale, lines: [{ key: "value", color: "#2563eb", name: "Weight (kg)" }] },
                { type: "glucose", icon: FlaskConical, lines: [{ key: "value", color: "#d97706", name: "Glucose (mg/dL)" }] },
                { type: "urine", icon: Droplets, lines: [{ key: "value", color: "#0d9488", name: "Urine (mL)" }] },
              ].map(({ type, icon: Icon, lines }) => (
                <Card key={type} className="p-5 border border-border" data-testid={`chart-${type}`}>
                  <div className="flex items-center gap-2 mb-4">
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
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editVital} onOpenChange={(o) => !o && setEditVital(null)}>
          <DialogContent data-testid="edit-vital-dialog">
            <DialogHeader>
              <DialogTitle>{t.editVital}</DialogTitle>
            </DialogHeader>
            {editVital && (
              <form onSubmit={handleEdit} className="space-y-4">
                {editVital.vital_type === "bp" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Systolic</Label>
                      <Input type="number" value={editForm.systolic} onChange={(e) => setEditForm({ ...editForm, systolic: e.target.value })} data-testid="edit-systolic" required className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Diastolic</Label>
                      <Input type="number" value={editForm.diastolic} onChange={(e) => setEditForm({ ...editForm, diastolic: e.target.value })} data-testid="edit-diastolic" required className="h-11" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Value ({VITAL_META[editVital.vital_type]?.unit})</Label>
                    <Input type="number" step="0.1" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} data-testid="edit-value" required className="h-11" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} data-testid="edit-notes" className="h-11" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditVital(null)}>{t.cancel}</Button>
                  <Button type="submit" disabled={saving} data-testid="save-edit-vital" className="bg-primary hover:bg-primary/90">
                    {saving ? "…" : t.saveChanges}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <BottomNav />
    </div>
  );
}

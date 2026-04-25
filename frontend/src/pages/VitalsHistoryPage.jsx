import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import { apiCall } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Pencil, Trash2, Heart, Scale, FlaskConical, Droplets } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const VITAL_META = {
  bp: { label: "Blood Pressure", icon: Heart, color: "#e11d48", unit: "mmHg" },
  weight: { label: "Body Weight", icon: Scale, color: "#2563eb", unit: "kg" },
  glucose: { label: "Blood Glucose", icon: FlaskConical, color: "#d97706", unit: "mg/dL" },
  urine: { label: "Urine Output", icon: Droplets, color: "#0d9488", unit: "mL/24h" },
};

function formatDate(str) {
  return new Date(str).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatChartDate(str) {
  return new Date(str).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function VitalBadge({ type }) {
  const meta = VITAL_META[type] || {};
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      {Icon && <Icon className="w-3 h-3" style={{ color: meta.color }} />}
      {meta.label}
    </span>
  );
}

export default function VitalsHistoryPage() {
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
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(range));
      const params = new URLSearchParams({ from_date: fromDate.toISOString().split("T")[0], limit: "200" });
      if (filterType !== "all") params.append("vital_type", filterType);
      const { data } = await apiCall("get", `/vitals?${params}`);
      setVitals(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [filterType, range]);

  useEffect(() => { fetchVitals(); }, [fetchVitals]);

  const openEdit = (v) => {
    setEditVital(v);
    setEditForm({
      systolic: v.systolic || "",
      diastolic: v.diastolic || "",
      value: v.value || "",
      notes: v.notes || "",
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
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
      setEditVital(null);
      fetchVitals();
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await apiCall("delete", `/vitals/${id}`);
      setVitals((prev) => prev.filter((v) => v.id !== id));
    } catch {} finally {
      setDeleting(null);
    }
  };

  // Build chart data per type
  const buildChartData = (type) => {
    const filtered = vitals
      .filter((v) => v.vital_type === type)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    return filtered.map((v) => ({
      date: formatChartDate(v.recorded_at),
      systolic: v.systolic,
      diastolic: v.diastolic,
      value: v.value,
    }));
  };

  const displayVitals = filterType === "all" ? vitals : vitals.filter((v) => v.vital_type === filterType);

  const getValueDisplay = (v) =>
    v.vital_type === "bp"
      ? `${v.systolic}/${v.diastolic} ${v.unit}`
      : `${v.value} ${v.unit}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 animate-fadeInUp">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Vitals History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and review your health trends</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 animate-fadeInUp stagger-1">
          <Select value={filterType} onValueChange={setFilterType} data-testid="filter-vital-type">
            <SelectTrigger className="w-48 h-10" data-testid="filter-vital-type-trigger">
              <SelectValue placeholder="All Vitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vitals</SelectItem>
              {Object.entries(VITAL_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange} data-testid="filter-date-range">
            <SelectTrigger className="w-40 h-10" data-testid="filter-date-range-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="list" className="animate-fadeInUp stagger-2">
          <TabsList className="mb-4">
            <TabsTrigger value="list" data-testid="tab-list-view">List View</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends-view">Trends</TabsTrigger>
          </TabsList>

          {/* List View */}
          <TabsContent value="list">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : displayVitals.length === 0 ? (
              <Card className="p-8 text-center border border-border">
                <p className="text-muted-foreground">No vitals recorded for this period.</p>
              </Card>
            ) : (
              <div className="space-y-2" data-testid="vitals-list">
                {displayVitals.map((v, i) => (
                  <Card
                    key={v.id}
                    data-testid={`vital-row-${i}`}
                    className="px-4 py-3.5 border border-border flex items-center justify-between hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <VitalBadge type={v.vital_type} />
                      <div>
                        <p className="font-semibold text-foreground text-base" style={{ fontFamily: "Outfit, sans-serif" }}>
                          {getValueDisplay(v)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(v.recorded_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(v)}
                        data-testid={`edit-vital-${v.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(v.id)}
                        disabled={deleting === v.id}
                        data-testid={`delete-vital-${v.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Trends View */}
          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BP Chart */}
              <Card className="p-5 border border-border" data-testid="chart-bp">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-semibold text-foreground">Blood Pressure</h3>
                  <span className="text-xs text-muted-foreground">(mmHg)</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={buildChartData("bp")} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="systolic" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Weight Chart */}
              <Card className="p-5 border border-border" data-testid="chart-weight">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-foreground">Body Weight</h3>
                  <span className="text-xs text-muted-foreground">(kg)</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={buildChartData("weight")} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Glucose Chart */}
              <Card className="p-5 border border-border" data-testid="chart-glucose">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-foreground">Blood Glucose</h3>
                  <span className="text-xs text-muted-foreground">(mg/dL)</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={buildChartData("glucose")} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Glucose (mg/dL)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Urine Chart */}
              <Card className="p-5 border border-border" data-testid="chart-urine">
                <div className="flex items-center gap-2 mb-4">
                  <Droplets className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-semibold text-foreground">Urine Output</h3>
                  <span className="text-xs text-muted-foreground">(mL/24h)</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={buildChartData("urine")} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name="Urine Output (mL)" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editVital} onOpenChange={(open) => !open && setEditVital(null)}>
          <DialogContent data-testid="edit-vital-dialog">
            <DialogHeader>
              <DialogTitle>Edit {editVital ? VITAL_META[editVital.vital_type]?.label : ""}</DialogTitle>
            </DialogHeader>
            {editVital && (
              <form onSubmit={handleEdit} className="space-y-4">
                {editVital.vital_type === "bp" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Systolic</Label>
                      <Input
                        type="number" value={editForm.systolic}
                        onChange={(e) => setEditForm({ ...editForm, systolic: e.target.value })}
                        data-testid="edit-systolic" required className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Diastolic</Label>
                      <Input
                        type="number" value={editForm.diastolic}
                        onChange={(e) => setEditForm({ ...editForm, diastolic: e.target.value })}
                        data-testid="edit-diastolic" required className="h-11"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Value ({VITAL_META[editVital.vital_type]?.unit})</Label>
                    <Input
                      type="number" step="0.1" value={editForm.value}
                      onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                      data-testid="edit-value" required className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    data-testid="edit-notes" className="h-11"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditVital(null)}>Cancel</Button>
                  <Button type="submit" disabled={saving} data-testid="save-edit-vital" className="bg-primary hover:bg-primary/90">
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import Header from "../components/Header";
import { apiCall } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Stethoscope, Pill, Calendar, ChevronDown, ChevronUp } from "lucide-react";

function formatDate(str) {
  return new Date(str).toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function PrescriptionCard({ prescription, isLatest }) {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <Card
      className="border border-border overflow-hidden animate-fadeInUp"
      data-testid={`prescription-card-${prescription.id}`}
    >
      {/* Card Header */}
      <button
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`prescription-toggle-${prescription.id}`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
                {prescription.doctor_name}
              </span>
              {isLatest && (
                <Badge className="bg-primary/10 text-primary border-none text-xs font-medium">
                  Latest
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Calendar className="w-3 h-3" />
              {formatDate(prescription.date)}
              <span className="mx-1">·</span>
              <Pill className="w-3 h-3" />
              {prescription.medications?.length || 0} medications
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-border">
          {/* Medications Table */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Medications
            </h4>
            <div className="space-y-2">
              {prescription.medications?.map((med, i) => (
                <div
                  key={i}
                  data-testid={`med-row-${prescription.id}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40"
                >
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{med.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {med.dosage} · {med.frequency}
                    </p>
                    {med.notes && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{med.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor notes */}
          {prescription.notes && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                Doctor's Notes
              </p>
              <p className="text-sm text-amber-800">{prescription.notes}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiCall("get", "/prescriptions");
        setPrescriptions(data);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 animate-fadeInUp">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Prescriptions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prescription history from your doctor
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : prescriptions.length === 0 ? (
          <Card className="p-12 text-center border border-border animate-fadeInUp">
            <Stethoscope className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No prescriptions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your doctor will add prescriptions once connected.
            </p>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="prescriptions-list">
            {prescriptions.map((p, i) => (
              <PrescriptionCard key={p.id} prescription={p} isLatest={i === 0} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

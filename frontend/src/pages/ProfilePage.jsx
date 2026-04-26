import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Hash, Calendar, Activity, User, UserRound } from "lucide-react";

function calcAge(dob) {
  if (!dob) return "N/A";
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDob(dob) {
  if (!dob) return "N/A";
  return new Date(dob).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function InfoRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p
          className={`mt-1 font-medium text-foreground break-words ${highlight ? "text-xl" : "text-base"}`}
          style={highlight ? { fontFamily: "Outfit, sans-serif" } : {}}
          data-testid={`profile-${label.toLowerCase().replace(/\s/g, "-")}`}
        >
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLang();

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "N/A";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="mb-5 animate-fadeInUp">
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {t.patientProfile}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.personalClinical}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Summary card */}
          <Card className="p-6 border border-border text-center animate-fadeInUp">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserRound className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{user?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user?.father_name ? `S/O ${user.father_name}` : ""}</p>
            <div className="mt-3">
              <Badge className="bg-primary/10 text-primary border-none font-mono text-sm px-3 py-1">{user?.mr_id}</Badge>
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{calcAge(user?.dob)}</p>
                <p className="text-xs text-muted-foreground">{t.yearsOld}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.registered}</p>
                <p className="text-xs text-foreground mt-0.5">{joinedDate}</p>
              </div>
            </div>
          </Card>

          {/* Details */}
          <Card className="p-6 border border-border lg:col-span-2 animate-fadeInUp stagger-1">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t.medicalInfo}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t.personalClinical}</p>
            <InfoRow icon={Hash} label={t.mrIdLabel} value={user?.mr_id} highlight />
            <InfoRow icon={User} label={t.fullName} value={user?.name} />
            <InfoRow icon={UserRound} label={t.fatherNameLabel} value={user?.father_name} />
            <InfoRow icon={Calendar} label={t.dobLabel} value={formatDob(user?.dob)} />
            <InfoRow icon={Calendar} label={t.ageLabel} value={`${calcAge(user?.dob)} ${t.yearsOld}`} />
            <InfoRow icon={Activity} label={t.diagnosisLabel} value={user?.diagnosis} />
            {user?.doctor_name && <InfoRow icon={User} label={t.treatingDoctor} value={user.doctor_name} />}
          </Card>
        </div>

        {/* Doctor connection */}
        <Card className="mt-5 p-5 border border-border animate-fadeInUp stagger-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.doctorConnection}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.doctor_id ? `Connected to ${user.doctor_name || "your doctor"}` : "Your doctor will link your account."}
              </p>
            </div>
            <Badge
              className={user?.doctor_id ? "bg-green-100 text-green-700 border-none" : "bg-amber-100 text-amber-700 border-none"}
              data-testid="doctor-connection-status"
            >
              {user?.doctor_id ? t.connected : t.pending}
            </Badge>
          </div>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}

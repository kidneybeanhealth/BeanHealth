import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Activity, Eye, EyeOff } from "lucide-react";

function formatError(detail) {
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function LoginPage() {
  const [tab, setTab] = useState("login");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({ mr_id: "", password: "" });
  const [regForm, setRegForm] = useState({
    mr_id: "", name: "", father_name: "", dob: "", diagnosis: "", password: "", confirm: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(loginForm.mr_id, loginForm.password);
      navigate("/");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (regForm.password !== regForm.confirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      const { confirm, ...payload } = regForm;
      await register(payload);
      navigate("/");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(https://images.unsplash.com/photo-1743046813915-94cf6d5e6942?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85)`,
        backgroundSize: "cover", backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md animate-fadeInUp">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  NephroTrack
                </h1>
                <p className="text-xs text-muted-foreground">Patient Portal</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Kidney Transplant &amp; ESRD Patient Management
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {["login", "register"].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                data-testid={`tab-${t}`}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div className="px-8 py-6">
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg" data-testid="auth-error">
                {error}
              </div>
            )}

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mr_id">MR ID</Label>
                  <Input
                    id="mr_id"
                    data-testid="login-mr-id"
                    placeholder="e.g. MR001"
                    value={loginForm.mr_id}
                    onChange={(e) => setLoginForm({ ...loginForm, mr_id: e.target.value })}
                    required
                    className="h-12 text-base uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      data-testid="login-password"
                      type={showPwd ? "text" : "password"}
                      placeholder="Enter password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      className="h-12 text-base pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  data-testid="login-submit-button"
                  disabled={loading}
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 btn-primary"
                >
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Demo account: <strong>MR001</strong> / <strong>demo123</strong>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg_mr_id">MR ID</Label>
                    <Input
                      id="reg_mr_id"
                      data-testid="register-mr-id"
                      placeholder="e.g. MR002"
                      value={regForm.mr_id}
                      onChange={(e) => setRegForm({ ...regForm, mr_id: e.target.value })}
                      required className="h-11 uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg_dob">Date of Birth</Label>
                    <Input
                      id="reg_dob"
                      data-testid="register-dob"
                      type="date"
                      value={regForm.dob}
                      onChange={(e) => setRegForm({ ...regForm, dob: e.target.value })}
                      required className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg_name">Full Name</Label>
                  <Input
                    id="reg_name" data-testid="register-name"
                    placeholder="Patient's full name"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    required className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg_father">Father's Name</Label>
                  <Input
                    id="reg_father" data-testid="register-father-name"
                    placeholder="Father's full name"
                    value={regForm.father_name}
                    onChange={(e) => setRegForm({ ...regForm, father_name: e.target.value })}
                    required className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg_diagnosis">Diagnosis</Label>
                  <Input
                    id="reg_diagnosis" data-testid="register-diagnosis"
                    placeholder="Primary diagnosis"
                    value={regForm.diagnosis}
                    onChange={(e) => setRegForm({ ...regForm, diagnosis: e.target.value })}
                    required className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg_pwd">Password</Label>
                    <Input
                      id="reg_pwd" data-testid="register-password"
                      type="password" placeholder="Set password"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      required className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg_confirm">Confirm</Label>
                    <Input
                      id="reg_confirm" data-testid="register-confirm-password"
                      type="password" placeholder="Confirm"
                      value={regForm.confirm}
                      onChange={(e) => setRegForm({ ...regForm, confirm: e.target.value })}
                      required className="h-11"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  data-testid="register-submit-button"
                  disabled={loading}
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 btn-primary mt-2"
                >
                  {loading ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { Activity } from "lucide-react";

export default function Header() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { lang, t, toggleLang } = useLang();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          className="flex items-center gap-2"
          onClick={() => navigate("/")}
          data-testid="header-logo"
        >
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {t.appName}
          </span>
        </button>

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            data-testid="lang-toggle"
            className="flex items-center bg-muted rounded-full p-1 gap-0.5"
            aria-label="Switch language"
          >
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200"
              style={{
                background: lang === "en" ? "hsl(151 22% 31%)" : "transparent",
                color: lang === "en" ? "#fff" : "hsl(120 2% 45%)",
              }}
            >
              EN
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200"
              style={{
                background: lang === "ta" ? "hsl(151 22% 31%)" : "transparent",
                color: lang === "ta" ? "#fff" : "hsl(120 2% 45%)",
                fontFamily: "'Noto Sans Tamil', sans-serif",
              }}
            >
              தமிழ்
            </span>
          </button>

          {/* Logout (desktop) */}
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors font-medium px-2 py-1.5 rounded-lg hover:bg-muted"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </header>
  );
}

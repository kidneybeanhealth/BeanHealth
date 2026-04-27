import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../contexts/LangContext";
import { Activity, TrendingUp, Pill, User, Plus } from "lucide-react";

const NAV = [
  { path: "/", key: "vitals", Icon: Activity },
  { path: "/vitals-history", key: "history", Icon: TrendingUp },
  null, // FAB placeholder
  { path: "/prescriptions", key: "prescriptions", Icon: Pill },
  { path: "/profile", key: "profile", Icon: User },
];

export default function BottomNav({ onFabClick }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLang();

  const handleFab = () => {
    if (onFabClick) onFabClick();
    else navigate("/");
  };

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
      style={{ boxShadow: "0 -1px 12px rgba(0,0,0,0.06)" }}
    >
      <div className="max-w-5xl mx-auto flex items-end justify-around px-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        {NAV.map((item, idx) => {
          if (!item) {
            // Center FAB
            return (
              <div key="fab" className="flex flex-col items-center" style={{ marginTop: -20 }}>
                <button
                  onClick={handleFab}
                  data-testid="bottom-nav-fab"
                  className="w-14 h-14 bg-primary rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ boxShadow: "0 4px 20px hsl(151 22% 31% / 0.45)" }}
                >
                  <Plus className="w-7 h-7 text-white" />
                </button>
              </div>
            );
          }
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              data-testid={`bottom-nav-${item.key}`}
              className="flex flex-col items-center pt-2 pb-1 min-w-[52px] focus:outline-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Active indicator — thin line above icon */}
              <div
                className="rounded-full transition-all duration-200 mb-1.5"
                style={{
                  height: 2,
                  width: isActive ? 24 : 0,
                  background: "hsl(151 22% 31%)",
                  opacity: isActive ? 1 : 0,
                }}
              />
              <item.Icon
                className="transition-colors duration-200"
                style={{
                  width: 20,
                  height: 20,
                  color: isActive ? "hsl(151 22% 31%)" : "hsl(120 2% 55%)",
                }}
              />
              <span
                className="text-xs mt-0.5 font-medium transition-colors duration-200 whitespace-nowrap"
                style={{
                  color: isActive ? "hsl(151 22% 31%)" : "hsl(120 2% 55%)",
                  fontSize: "10px",
                }}
              >
                {t[item.key]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../contexts/LangContext";
import { Home, Activity, FileText, User } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", key: "dashboard", Icon: Home },
  { path: "/vitals-history", key: "history", Icon: Activity },
  { path: "/prescriptions", key: "prescriptions", Icon: FileText },
  { path: "/profile", key: "profile", Icon: User },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLang();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-border"
      style={{ boxShadow: "0 -2px 20px rgba(0,0,0,0.06)" }}
    >
      <div className="max-w-5xl mx-auto px-2 pb-2 pt-1 flex items-end justify-around">
        {NAV_ITEMS.map(({ path, key, Icon }) => {
          const isActive = pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              data-testid={`bottom-nav-${key}`}
              className="flex flex-col items-center min-w-[64px] py-1 focus:outline-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Floating pill container */}
              <div
                className="transition-all duration-300 ease-out flex flex-col items-center"
                style={{
                  transform: isActive ? "translateY(-6px)" : "translateY(0)",
                }}
              >
                <div
                  className="transition-all duration-300 ease-out flex items-center justify-center rounded-2xl"
                  style={{
                    width: 48,
                    height: 48,
                    background: isActive ? "hsl(151 22% 31%)" : "transparent",
                    boxShadow: isActive ? "0 4px 16px hsl(151 22% 31% / 0.35)" : "none",
                  }}
                >
                  <Icon
                    className="transition-colors duration-300"
                    style={{
                      width: 20,
                      height: 20,
                      color: isActive ? "#ffffff" : "hsl(120 2% 45%)",
                    }}
                  />
                </div>
                <span
                  className="text-xs mt-0.5 font-medium transition-colors duration-300 whitespace-nowrap"
                  style={{
                    color: isActive ? "hsl(151 22% 31%)" : "hsl(120 2% 55%)",
                    fontSize: "11px",
                  }}
                >
                  {t[key]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

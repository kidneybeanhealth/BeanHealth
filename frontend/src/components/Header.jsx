import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Activity, FileText, User, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/vitals-history", label: "Vitals History", icon: Activity },
  { path: "/prescriptions", label: "Prescriptions", icon: FileText },
  { path: "/profile", label: "Profile", icon: User },
];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
          data-testid="header-logo"
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            NephroTrack
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-full font-medium">
                {user.mr_id}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-button"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </Button>
            </div>
          )}
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="mobile-menu-button"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-border px-4 py-3 space-y-1">
          {navLinks.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => { navigate(path); setMenuOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
          {user && (
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground font-medium">{user.mr_id} — {user.name}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive text-xs">
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

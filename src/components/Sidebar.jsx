import React, { useMemo } from "react";
import { LayoutDashboard, Clock, Target, CreditCard, Settings2 } from "lucide-react";
import { getAppNavigation } from "../lib/navigation";
import { useI18n } from "./I18nProvider";

const ICON_MAP = {
  home:     <LayoutDashboard size={18} strokeWidth={2} />,
  history:  <Clock          size={18} strokeWidth={2} />,
  goals:    <Target         size={18} strokeWidth={2} />,
  payments: <CreditCard     size={18} strokeWidth={2} />,
  settings: <Settings2      size={18} strokeWidth={2} />,
};

// Inactive icon accent colors per route
const ICON_COLOR = {
  home:     "var(--brand)",
  history:  "#8b5cf6",
  goals:    "#f59e0b",
  payments: "#a855f7",
  settings: "var(--ink-muted)",
};

export default function Sidebar({ activePath, onNavigate }) {
  const { t } = useI18n();
  const menu = useMemo(() => getAppNavigation(t), [t]);

  const handleNavigate = (path) => {
    onNavigate(path);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div
          className="sidebar-suite-head"
          role="button"
          tabIndex={0}
          onClick={() => handleNavigate("/")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleNavigate("/");
            }
          }}
        >
          <div className="sidebar-suite-mark">FT</div>
          <div className="sidebar-suite-copy">
            <div className="sidebar-suite-title">Finance Track</div>
            <div className="sidebar-suite-sub">Meet AI</div>
          </div>
        </div>
      </div>
      <div className="sidebar-section-title">Workspace</div>
      <nav className="sidebar-nav">
        {menu.map((item) => (
          <button
            key={item.path}
            style={activePath !== item.path ? { "--icon-color": ICON_COLOR[item.icon] } : {}}
          className={`sidebar-item sidebar-${item.icon} ${activePath === item.path ? "active" : ""}`}
            onClick={() => handleNavigate(item.path)}
            type="button"
          >
            <span className="sidebar-icon">{ICON_MAP[item.icon]}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

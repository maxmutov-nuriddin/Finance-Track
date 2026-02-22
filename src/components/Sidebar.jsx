import React, { useMemo } from "react";
import { useI18n } from "./I18nProvider";

export default function Sidebar({ activePath, onNavigate }) {
  const { t } = useI18n();
  const menu = useMemo(
    () => [
      { label: t("navHome"), path: "/", icon: "home" },
      { label: t("navHistory"), path: "/history", icon: "history" },
      { label: t("navGoals"), path: "/goals", icon: "goals" },
      { label: t("navPayments"), path: "/payments", icon: "payments" },
      { label: t("navSettings"), path: "/settings", icon: "settings" }
    ],
    [t]
  );

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
            className={`sidebar-item sidebar-${item.icon} ${activePath === item.path ? "active" : ""}`}
            onClick={() => handleNavigate(item.path)}
            type="button"
          >
            <span className="sidebar-icon" />
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

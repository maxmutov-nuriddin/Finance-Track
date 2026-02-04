import React, { useMemo, useState } from "react";
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
  const [open, setOpen] = useState(false);

  const handleNavigate = (path) => {
    onNavigate(path);
    setOpen(false);
  };

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">»</div>
        <div>
          <div className="sidebar-title">Finance Track</div>
          <div className="sidebar-sub">{t("sidebarSub")}</div>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={t("openMenu")}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? (
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M6 6 L18 18 M18 6 L6 18' stroke='%23cfd6ff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"
              alt=""
              aria-hidden="true"
            />
          ) : (
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Crect x='3' y='6' width='18' height='2' rx='1' fill='%23cfd6ff'/%3E%3Crect x='3' y='11' width='18' height='2' rx='1' fill='%23cfd6ff'/%3E%3Crect x='3' y='16' width='18' height='2' rx='1' fill='%23cfd6ff'/%3E%3C/svg%3E"
              alt=""
              aria-hidden="true"
            />
          )}
        </button>
      </div>
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

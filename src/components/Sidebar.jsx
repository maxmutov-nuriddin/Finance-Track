import React, { useState } from "react";
const menu = [
  { label: "Главная", path: "/" },
  { label: "История", path: "/history" },
  { label: "Цели", path: "/goals" },
  { label: "Платежи", path: "/payments" },
  { label: "Настройки", path: "/settings" }
];

export default function Sidebar({ activePath, onNavigate }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (path) => {
    onNavigate(path);
    setOpen(false);
  };

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">FT</div>
        <div>
          <div className="sidebar-title">Finance Track</div>
          <div className="sidebar-sub">Без AI • правила</div>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label="Открыть меню"
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
            className={`sidebar-item ${activePath === item.path ? "active" : ""}`}
            onClick={() => handleNavigate(item.path)}
            type="button"
          >
            <span className="dot" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="helper-text">Быстрый ввод сверху</div>
      </div>
    </aside>
  );
}

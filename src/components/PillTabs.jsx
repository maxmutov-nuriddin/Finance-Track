import React from "react";

export default function PillTabs({ options, value, onChange }) {
  return (
    <div className="pill-tabs">
      {options.map((option) => (
        <button
          key={option.value}
          className={`pill-tab ${value === option.value ? "pill-tab-active" : ""}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import React, { useMemo } from "react";
import { LayoutDashboard, Clock, Target, CreditCard, Settings2 } from "lucide-react";
import { getAppNavigation } from "../lib/navigation";
import { useI18n } from "./I18nProvider";

const ICON_MAP = {
  home: LayoutDashboard,
  history: Clock,
  goals: Target,
  payments: CreditCard,
  settings: Settings2
};

export default function MobileNav({ activePath, onNavigate }) {
  const { t } = useI18n();
  const menu = useMemo(() => getAppNavigation(t), [t]);

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {menu.map((item) => {
        const Icon = ICON_MAP[item.icon];
        const isActive = activePath === item.path;

        return (
          <button
            key={item.path}
            type="button"
            className={`mobile-nav-item ${isActive ? "active" : ""}`}
            onClick={() => onNavigate(item.path)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
          >
            <span className="mobile-nav-icon">
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className="mobile-nav-label">{item.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}

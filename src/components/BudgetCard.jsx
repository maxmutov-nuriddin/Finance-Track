import React from "react";
import GlassButton from "./GlassButton";
import { computeBudgetProgress } from "../lib/budget";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";
import { Settings, ChevronRight, TrendingUp, Wallet, Banknote, PiggyBank } from "lucide-react";

export default function BudgetCard({
  monthlyIncome,
  monthlyMandatory,
  recommendedMaxSpend,
  currentMonthExpense,
  budgetMode,
  planSpend,
  warning,
  onOpenSettings
}) {
  const { t } = useI18n();
  const { progress, overspent } = computeBudgetProgress(
    currentMonthExpense,
    recommendedMaxSpend
  );
  const remaining = Math.round(recommendedMaxSpend - currentMonthExpense);
  const warningText = warning
    ? warning === "Добавь доход (зп), чтобы мы рассчитали бюджет."
      ? t("budgetWarnNoIncome")
      : warning === "Не удалось рассчитать бюджет. Проверь данные."
        ? t("budgetWarnInvalid")
        : warning ===
          "С текущим доходом и обязательными платежами цель в выбранный срок недостижима."
          ? t("budgetWarnNegative")
          : warning
    : "";

  // Calculate circle progress
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = Math.min(100, Math.round((currentMonthExpense / recommendedMaxSpend) * 100));
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="budget-card">
      <div className="budget-card-header">
        <h2 className="budget-card-title">{t("budgetTitle")}</h2>
        <button
          onClick={onOpenSettings}
          className="budget-card-settings-btn"
        >
          <Settings size={14} />
          <span>{t("configure")}</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {warningText ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          {warningText}
        </div>
      ) : (
        <>
          <div className="budget-card-panel">
            <div className="budget-card-glow" />

            <div className="budget-card-panel-inner">
              <div className="budget-card-ring-wrapper">
                <svg className="budget-card-ring-svg" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke={overspent ? "#ef4444" : "url(#budgetGradient)"}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="budget-ring-progress"
                  />
                  <defs>
                    <linearGradient id="budgetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2f6bff" />
                      <stop offset="100%" stopColor="#5b8cff" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="budget-card-ring-content">
                  <TrendingUp size={16} className={overspent ? "overspent" : ""} />
                  <span className="percent">{progressPercent}%</span>
                </div>
              </div>

              <div className="budget-card-info">
                <div className="budget-card-label">{t("remainingSpendLabel")}</div>
                <div className={`budget-card-amount ${remaining < 0 ? "value-negative" : ""}`}>
                  {formatAmount(remaining)}
                </div>
                <div className="budget-card-helper">{t("budgetHelper")}</div>
              </div>

              <div className="budget-card-badge-icon">
                <PiggyBank size={48} strokeWidth={1} />
              </div>
            </div>
          </div>

          <div className="plan-summary">
            <div className="plan-item">
              <div className="plan-icon-small green"><Banknote size={16} /></div>
              <div className="plan-details">
                <span className="muted">{t("income")}</span>
                <span className="stat-value">{formatAmount(Math.round(monthlyIncome))}</span>
              </div>
            </div>
            <div className="plan-item">
              <div className="plan-icon-small orange"><Wallet size={16} /></div>
              <div className="plan-details">
                <span className="muted">{t("mandatory")}</span>
                <span className="stat-value">{formatAmount(Math.round(monthlyMandatory))}</span>
              </div>
            </div>
            <div className="plan-item">
              <div className="plan-icon-small blue"><TrendingUp size={16} /></div>
              <div className="plan-details">
                <span className="muted">{t("canSpend")}</span>
                <span className="stat-value">{formatAmount(Math.round(planSpend))}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

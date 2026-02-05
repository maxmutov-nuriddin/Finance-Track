import React from "react";
import GlassButton from "./GlassButton";
import { computeBudgetProgress } from "../lib/budget";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

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
  const remaining = Math.max(0, Math.round(recommendedMaxSpend - currentMonthExpense));
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
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = Math.min(100, Math.round((currentMonthExpense / recommendedMaxSpend) * 100));
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="budget-card">
      <div className="budget-card-header">
        <h2 className="budget-card-title">{t("budgetTitle")}</h2>
        <button
          onClick={onOpenSettings}
          className="budget-card-settings"
        >
          <span>{t("configure")}</span>
          <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {warningText ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          {warningText}
        </div>
      ) : (
        <>
          <div className="budget-card-panel">
            {/* Diagonal Pattern Background */}
            <div className="budget-card-pattern">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="budget-card-pattern-line"
                  style={{ left: `${i * 5}%` }}
                />
              ))}
            </div>

            <div className="budget-card-panel-inner">
              <div className="budget-card-panel-left">
                {/* Circular Progress */}
                <div className="budget-card-ring">
                  <svg className="budget-card-ring-svg">
                    <circle
                      cx="64"
                      cy="64"
                      r={radius}
                      fill="none"
                      stroke="#3a4556"
                      strokeWidth="12"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r={radius}
                      fill="none"
                      stroke={overspent ? "#ef4444" : "url(#gradient)"}
                      strokeWidth="12"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4b7bff" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="budget-card-ring-center">
                    <div className="budget-card-ring-percent">
                      <svg style={{ width: "12px", height: "12px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={overspent ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
                      </svg>
                      <span>{progressPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Balance Info */}
                <div className="budget-card-info">
                  <div className="budget-card-label">{t("remainingSpendLabel")}</div>
                  <div className="budget-card-amount">{formatAmount(remaining)}</div>
                  <div className="budget-card-helper">{t("budgetHelper")}</div>
                </div>
              </div>

              {/* Logo */}
              <div className="budget-card-logo">»</div>
            </div>
          </div>

          <div className="plan-summary">
            <div className="plan-item">
              <span className="muted">{t("income")}</span>
              <span className="stat-value">{formatAmount(Math.round(monthlyIncome))}</span>
            </div>
            <div className="plan-item">
              <span className="muted">{t("mandatory")}</span>
              <span className="stat-value">{formatAmount(Math.round(monthlyMandatory))}</span>
            </div>
            <div className="plan-item">
              <span className="muted">{t("canSpend")}</span>
              <span className="stat-value">{formatAmount(Math.round(planSpend))}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

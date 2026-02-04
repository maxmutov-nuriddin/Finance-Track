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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0, color: "#1f2937" }}>
          {t("budgetTitle")}
        </h2>
        <button
          onClick={onOpenSettings}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.875rem",
            color: "#6b7280",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: "8px",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#1f2937"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
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
          <div style={{
            background: "#2b2d3a",
            borderRadius: "20px",
            padding: "32px",
            position: "relative",
            overflow: "hidden",
            marginBottom: "20px"
          }}>
            {/* Diagonal Pattern Background */}
            <div style={{
              position: "absolute",
              inset: 0,
              opacity: 0.1,
              pointerEvents: "none"
            }}>
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    height: "100%",
                    width: "1px",
                    background: "white",
                    transform: "rotate(45deg)",
                    left: `${i * 5}%`
                  }}
                />
              ))}
            </div>

            <div style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
                {/* Circular Progress */}
                <div style={{ position: "relative", width: "128px", height: "128px" }}>
                  <svg style={{ width: "128px", height: "128px", transform: "rotate(-90deg)" }}>
                    <circle
                      cx="64"
                      cy="64"
                      r={radius}
                      fill="none"
                      stroke="#374151"
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
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        color: "white",
                        fontSize: "0.875rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        <svg style={{ width: "12px", height: "12px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={overspent ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
                        </svg>
                        <span style={{ fontWeight: "700" }}>{progressPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Info */}
                <div style={{ color: "white" }}>
                  <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "4px" }}>
                    {t("remainingSpendLabel")}
                  </div>
                  <div style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "8px" }}>
                    {formatAmount(remaining)}
                  </div>
                  <div style={{
                    fontSize: "0.875rem",
                    color: "#9ca3af"
                  }}>
                    {t("budgetHelper")}
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div style={{
                color: "white",
                fontSize: "3rem",
                fontWeight: "700",
                opacity: 0.5
              }}>
                »
              </div>
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


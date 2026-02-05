import React from "react";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function EarningsCard({
   balance,
   progress = 13,
   showDetails = true
}) {
   const { t } = useI18n();

   // Calculate circle progress
   const radius = 56;
   const circumference = 2 * Math.PI * radius;
   const offset = circumference - (progress / 100) * circumference;

   return (
      <div>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0, color: "#ffffff" }}>
               {t("budgetTitle")}
            </h2>
         </div>

         <div style={{
            background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
            border: "1px solid #404854",
            borderRadius: "20px",
            padding: "32px",
            position: "relative",
            overflow: "hidden"
         }}>
            {/* Diagonal Pattern Background */}
            <div style={{
               position: "absolute",
               inset: 0,
               opacity: 0.08,
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
                           stroke="#3a4556"
                           strokeWidth="12"
                        />
                        <circle
                           cx="64"
                           cy="64"
                           r={radius}
                           fill="none"
                           stroke="url(#gradient)"
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
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                              <span style={{ fontWeight: "700" }}>{progress}%</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Balance Info */}
                  <div style={{ color: "white" }}>
                     <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "4px" }}>
                        {t("remainingSpendLabel")}
                     </div>
                     <div style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "8px" }}>
                        {formatAmount(balance)}
                     </div>
                     {showDetails && (
                        <button style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           fontSize: "0.875rem",
                           color: "#a0aec0",
                           background: "none",
                           border: "none",
                           cursor: "pointer",
                           padding: 0
                        }}>
                           <span>{t("budgetHelper")}</span>
                           <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                           </svg>
                        </button>
                     )}
                  </div>
               </div>

               {/* Logo */}
               <div style={{
                  color: "white",
                  fontSize: "3rem",
                  fontWeight: "700",
                  opacity: 0.3
               }}>
                  »
               </div>
            </div>
         </div>
      </div>
   );
}

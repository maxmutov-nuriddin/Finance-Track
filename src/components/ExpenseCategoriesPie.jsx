export default function ExpenseCategoriesPie({ transactions = [] }) {
   return (
      <div style={{
         background: "#ffffff",
         borderRadius: "20px",
         padding: "24px",
         marginTop: "16px",
         border: "2px solid #ff0000" // Красная граница для видимости
      }}>
         <h3 style={{ fontSize: "1.125rem", fontWeight: "600", margin: 0, color: "#1f2937" }}>
            Current result - TEST
         </h3>
         <p style={{ marginTop: "16px", color: "#6b7280" }}>
            Компонент загружен! Транзакций: {transactions.length}
         </p>
         <div style={{
            marginTop: "16px",
            padding: "20px",
            background: "#f3f4f6",
            borderRadius: "12px",
            textAlign: "center"
         }}>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
               51%
            </div>
            <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "8px" }}>
               Тестовая диаграмма
            </div>
         </div>
         <div style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px"
         }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
               <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1f2937" }}></div>
               <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>High</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
               <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#bfdbfe" }}></div>
               <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Low</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
               <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d1d5db" }}></div>
               <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Medium</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
               <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fef3c7" }}></div>
               <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Other</span>
            </div>
         </div>
      </div>
   );
}

import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import GlassButton from "../components/GlassButton";
import TransactionList from "../components/TransactionList";
import { useI18n } from "../components/I18nProvider";
import { deleteTransaction, watchTransactions } from "../lib/store";
import { useUser } from "../lib/user";

function escapeCsvValue(value, delimiter = ";") {
  const text = String(value ?? "");
  if (text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function History() {
  const user = useUser();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);

  const stats = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const expense = transactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    return { income, expense, total: transactions.length };
  }, [transactions]);

  const exportRows = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.occurredAtISO || 0).getTime() - new Date(a.occurredAtISO || 0).getTime())
      .map((tx) => ({
        date: tx?.occurredAtISO || "",
        type: tx?.type || "",
        category: tx?.category || "",
        amount: Math.round(Number(tx?.amount || 0)),
        description: tx?.description || "",
        raw: tx?.raw || "",
        recurring: tx?.isRecurring ? "yes" : "no",
        debtMode: tx?.meta?.kind === "debt" ? tx?.meta?.mode || "none" : "none"
      }));
  }, [transactions]);

  const handleExportCsv = () => {
    if (!exportRows.length) return;
    const delimiter = ";";

    const headers = [
      t("exportDateCol"),
      t("exportTypeCol"),
      t("exportCategoryCol"),
      t("exportAmountCol"),
      t("exportDescriptionCol"),
      t("exportRawCol"),
      t("exportRecurringCol"),
      t("exportDebtModeCol")
    ];
    const buildCsvLine = (values) => values.map((value) => escapeCsvValue(value, delimiter)).join(delimiter);

    const lines = exportRows.map((row) =>
      [
        row.date,
        row.type,
        row.category,
        row.amount,
        row.description,
        row.raw,
        row.recurring,
        row.debtMode
      ]
        .map((value) => escapeCsvValue(value, delimiter))
        .join(delimiter)
    );

    const content = `\uFEFFsep=${delimiter}\r\n${buildCsvLine(headers)}\r\n${lines.join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `finance-track-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportExcel = () => {
    if (!exportRows.length) return;

    const headers = [
      t("exportDateCol"),
      t("exportTypeCol"),
      t("exportCategoryCol"),
      t("exportAmountCol"),
      t("exportDescriptionCol"),
      t("exportRawCol"),
      t("exportRecurringCol"),
      t("exportDebtModeCol")
    ];

    const rowsHtml = exportRows
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.amount)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.raw)}</td>
          <td>${escapeHtml(row.recurring)}</td>
          <td>${escapeHtml(row.debtMode)}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;

    const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
    downloadBlob(blob, `finance-track-${new Date().toISOString().slice(0, 10)}.xls`);
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <div>
          <h1 className="history-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <HistoryIcon size={28} strokeWidth={2.5} /> {t("historyTitle")}
          </h1>
          <p className="history-subtitle">{t("historyHelp")}</p>
        </div>
        <div className="history-actions">
          <GlassButton variant="ghost" onClick={handleExportCsv} disabled={!exportRows.length}>
            {t("exportCsv")}
          </GlassButton>
          <GlassButton variant="secondary" onClick={handleExportExcel} disabled={!exportRows.length}>
            {t("exportExcel")}
          </GlassButton>
        </div>
      </div>

      <div className="history-stats">
        <div className="stat-card income-card">
          <div className="stat-card-label">{t("typeIncome")}</div>
          <div className="stat-card-value" style={{ color: "#22c55e" }}>
            +{(stats.income || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card expense-card">
          <div className="stat-card-label">{t("typeExpense")}</div>
          <div className="stat-card-value" style={{ color: "#ef4444" }}>
            -{(stats.expense || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card total-card">
          <div className="stat-card-label">{t("allRecords")}</div>
          <div className="stat-card-value" style={{ color: "#3b82f6" }}>
            {stats.total}
          </div>
        </div>
      </div>

      <TransactionList items={transactions} onDelete={(id) => deleteTransaction(user.uid, id)} />
    </div>
  );
}

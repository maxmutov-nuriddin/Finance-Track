import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import GlassButton from "../components/GlassButton";
import TransactionList from "../components/TransactionList";
import { useI18n } from "../components/I18nProvider";
import { deleteTransaction, watchTransactions } from "../lib/store";
import { useUser } from "../lib/user";

const SALARY_WORDS = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];
const BORROW_DEBT_WORDS = ["взял", "взяла", "занял", "заняла", "borrow", "qarz ol", "одолжил у"];
const COLLECT_DEBT_WORDS = ["забрал", "забрала", "вернули", "возврат", "collect", "undird", "qaytarib old"];
const LEND_DEBT_WORDS = ["дал в долг", "дала в долг", "одолжил", "одолжила", "lend", "loaned", "qarz ber"];

function isSalaryOrBorrowIncome(tx) {
  if (tx?.type !== "income") return false;

  if (tx?.meta?.kind === "transfer") return false;

  if (tx?.meta?.kind === "debt") {
    return tx?.meta?.mode === "borrow";
  }

  if (tx?.category === "debt") {
    const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
    const isCollect = COLLECT_DEBT_WORDS.some((word) => text.includes(word));
    const isBorrow = BORROW_DEBT_WORDS.some((word) => text.includes(word));
    return isBorrow && !isCollect;
  }

  const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
  return tx?.incomePeriod === "monthly" || SALARY_WORDS.some((word) => text.includes(word));
}

function isTrackableExpense(tx) {
  if (tx?.type !== "expense") return false;
  if (tx?.meta?.kind === "transfer") return false;
  if (tx?.meta?.kind === "debt" && tx?.meta?.mode === "lend") return false;
  if (tx?.category === "debt") {
    const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
    if (LEND_DEBT_WORDS.some((word) => text.includes(word))) return false;
  }
  return true;
}

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

function createUtf16LeBlob(text, mimeType) {
  const content = String(text ?? "");
  const bytes = new Uint8Array(2 + content.length * 2);
  // UTF-16 LE BOM
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return new Blob([bytes], { type: mimeType });
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
      .filter((tx) => isSalaryOrBorrowIncome(tx))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const expense = transactions
      .filter((tx) => isTrackableExpense(tx))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
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

    const content = `sep=${delimiter}\r\n${buildCsvLine(headers)}\r\n${lines.join("\r\n")}`;
    const blob = createUtf16LeBlob(content, "text/csv;charset=utf-16le;");
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

      <TransactionList
        items={transactions}
        onDelete={async (id) => {
          if (!user) return;
          const confirmed = window.confirm(t("deleteConfirm"));
          if (!confirmed) return;
          await deleteTransaction(user.uid, id);
        }}
      />
    </div>
  );
}

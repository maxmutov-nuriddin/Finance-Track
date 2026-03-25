const CATEGORY_LABELS_RU = {
  cafe: "Кафе", groceries: "Продукты", food: "Еда", transport: "Транспорт",
  clothes: "Одежда", beauty: "Красота", kids: "Дети", gifts: "Подарки",
  pets: "Питомцы", travel: "Путешествия", home: "Дом", subscriptions: "Подписки",
  taxes: "Налоги", entertainment: "Развлечения", shopping: "Покупки",
  utilities: "Коммуналка", health: "Здоровье", education: "Образование",
  personal: "Личное", debt: "Долг", credit: "Кредит", rent: "Аренда",
  income: "Доход", carryover: "Перенос", other: "Прочее"
};

function escapeCsv(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function exportTransactionsCSV(transactions) {
  if (!transactions?.length) return;

  const headers = ["Дата", "Тип", "Категория", "Сумма", "Описание", "Повторяющийся", "Исходный ввод"];

  const rows = transactions.map((tx) => {
    const type = tx.type === "income" ? "Доход" : "Расход";
    const category = CATEGORY_LABELS_RU[tx.category] || tx.category || "Прочее";
    const amount = Number(tx.amount || 0).toString();
    const date = formatDate(tx.occurredAtISO);
    const desc = tx.description || "";
    const recurring = tx.isRecurring ? "Да" : "Нет";
    const raw = tx.raw || "";

    return [date, type, category, amount, desc, recurring, raw].map(escapeCsv).join(",");
  });

  const csv = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const fileName = `finance-track-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

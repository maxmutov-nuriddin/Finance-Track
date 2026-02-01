export function computeStats(transactions) {
  return transactions.reduce(
    (acc, item) => {
      if (item.type === "income") {
        acc.income += Number(item.amount || 0);
      } else {
        acc.expense += Number(item.amount || 0);
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
}

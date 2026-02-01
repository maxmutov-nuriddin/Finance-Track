import { useEffect, useMemo, useState } from "react";
import BudgetCard from "../components/BudgetCard";
import GlassCard from "../components/GlassCard";
import PaymentsOverview from "../components/PaymentsOverview";
import StatsCard from "../components/StatsCard";
import { useUser } from "../lib/user";
import {
  watchGoals,
  watchPayments,
  watchTransactions,
  watchSettings,
  saveSettings
} from "../lib/store";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import { useNavigate } from "react-router-dom";
import { computeBudgetStatus } from "../lib/budget";
import { filterByOccurredAtISO, getMonthKey, getMonthRange, getMonthRangeFor } from "../lib/utils";
import { computeStats } from "../lib/calcs";
import { formatAmount } from "../lib/format";
import { useI18n } from "../components/I18nProvider";
import {
  computeMandatoryMonthly,
  computeMonthExpense,
  computeMonthlyExpense,
  computeMonthlyIncome,
  computeRecommendedSpend,
  computeRequiredMonthlySavings,
  getActiveGoal
} from "../lib/budgetCalc";

function buildSeries(transactions, range) {
  const days = range.days;
  const base = makeTashkentDate(getTzParts(range.end));
  const dates = Array.from({ length: days }).map((_, index) => {
    const parts = addDaysInTz(base, -days + 1 + index);
    return formatDateISO(parts);
  });
  const map = new Map(dates.map((d) => [d, 0]));
  transactions.forEach((item) => {
    if (!item.occurredAtISO) return;
    const dateKey = item.occurredAtISO.slice(0, 10);
    if (!map.has(dateKey)) return;
    const delta = item.type === "income" ? Number(item.amount || 0) : -Number(item.amount || 0);
    map.set(dateKey, map.get(dateKey) + delta);
  });
  return dates.map((dateKey) => ({ date: dateKey, value: map.get(dateKey) || 0 }));
}

export default function Dashboard() {
  const user = useUser();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [goals, setGoals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [walletNotice, setWalletNotice] = useState("");
  const [monthTick, setMonthTick] = useState(getMonthKey(new Date()));

  useEffect(() => {
    if (!user) return;
    const unsubGoals = watchGoals(user.uid, setGoals);
    const unsubPayments = watchPayments(user.uid, setPayments);
    const unsubAll = watchTransactions(user.uid, setAllTransactions);
    const unsubSettings = watchSettings(user.uid, setSettings);
    return () => {
      unsubGoals();
      unsubPayments();
      unsubAll();
      unsubSettings();
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextKey = getMonthKey(new Date());
      setMonthTick((prev) => (prev === nextKey ? prev : nextKey));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const periodRange = useMemo(() => getMonthRange(), [allTransactions.length, monthTick]);
  const statsTransactions = useMemo(
    () => filterByOccurredAtISO(allTransactions, periodRange.start, periodRange.end),
    [allTransactions, periodRange]
  );

  const stats = useMemo(() => computeStats(statsTransactions), [statsTransactions]);
  const periodDays = periodRange.days;
  const monthlyIncome = useMemo(
    () => computeMonthlyIncome(statsTransactions, periodDays),
    [statsTransactions, periodDays]
  );
  const monthlyExpense = useMemo(
    () => computeMonthlyExpense(statsTransactions, periodDays),
    [statsTransactions, periodDays]
  );
  const monthlyMandatory = useMemo(
    () => computeMandatoryMonthly(payments, new Date()),
    [payments]
  );

  const activeGoal = useMemo(() => getActiveGoal(goals, settings), [goals, settings]);

  const plannedMonthlySavings = useMemo(() => {
    return computeRequiredMonthlySavings(activeGoal, stats.net, settings);
  }, [activeGoal, settings, stats.net]);

  const recommendedMaxSpend = useMemo(() => {
    return computeRecommendedSpend({
      monthlyIncome,
      monthlyMandatory,
      plannedMonthlySavings,
      settings
    });
  }, [monthlyIncome, monthlyMandatory, plannedMonthlySavings, settings]);

  const safeRecommendedSpend = useMemo(
    () => (recommendedMaxSpend < 0 ? 0 : recommendedMaxSpend || 0),
    [recommendedMaxSpend]
  );

  const planSpend = useMemo(() => {
    const value = monthlyIncome - monthlyMandatory - plannedMonthlySavings;
    return value < 0 ? 0 : value;
  }, [monthlyIncome, monthlyMandatory, plannedMonthlySavings]);

  const plannedMonthlyNet = useMemo(() => {
    if (!Number.isFinite(safeRecommendedSpend)) return 0;
    return monthlyIncome - monthlyMandatory - safeRecommendedSpend;
  }, [monthlyIncome, monthlyMandatory, safeRecommendedSpend]);

  const dailyNet = useMemo(() => plannedMonthlyNet / 30, [plannedMonthlyNet]);
  const factMonthlyNet = useMemo(() => stats.net, [stats.net]);

  const status = useMemo(
    () =>
      computeBudgetStatus({
        monthlyIncome,
        monthlyMandatory,
        recommendedMaxSpend
      }),
    [monthlyIncome, monthlyMandatory, recommendedMaxSpend]
  );

  const currentMonthExpense = useMemo(
    () => computeMonthExpense(allTransactions),
    [allTransactions]
  );

  const remainingToSpend = useMemo(
    () => Math.max(0, safeRecommendedSpend - currentMonthExpense),
    [safeRecommendedSpend, currentMonthExpense]
  );

  const chartSeries = useMemo(
    () => buildSeries(statsTransactions, periodRange),
    [statsTransactions, periodRange]
  );

  const upcomingOneTime = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return payments
      .filter((p) => (p.recurrence || "oneTime") !== "monthly")
      .filter((p) => !p.payDateISO || p.payDateISO >= todayISO)
      .sort((a, b) => (a.payDateISO || "").localeCompare(b.payDateISO || ""))
      .slice(0, 3);
  }, [payments]);

  const periodTransactions = useMemo(
    () => filterByOccurredAtISO(allTransactions, periodRange.start, periodRange.end),
    [allTransactions, periodRange]
  );

  const walletBalance = Number(settings?.walletBalance || 0);
  const walletMonthKey = settings?.walletMonthKey || "";

  useEffect(() => {
    if (!user || !settings) return;
    const currentMonthKey = getMonthKey(new Date());
    if (walletMonthKey === currentMonthKey) return;

    const prevMonthDate = new Date(periodRange.start.getTime() - 24 * 60 * 60 * 1000);
    const prevRange = getMonthRangeFor(prevMonthDate);
    const prevTransactions = filterByOccurredAtISO(allTransactions, prevRange.start, prevRange.end);
    const prevStats = computeStats(prevTransactions);
    const prevMonthlyIncome = computeMonthlyIncome(prevTransactions, prevRange.days);
    const prevMonthlyExpense = computeMonthlyExpense(prevTransactions, prevRange.days);
    const prevMandatory = computeMandatoryMonthly(payments, prevRange.end);
    const prevPlannedSavings = computeRequiredMonthlySavings(activeGoal, prevStats.net, settings);
    const prevRecommendedSpend = computeRecommendedSpend({
      monthlyIncome: prevMonthlyIncome,
      monthlyMandatory: prevMandatory,
      plannedMonthlySavings: prevPlannedSavings,
      settings
    });
    const prevUnused = Math.max(0, (prevRecommendedSpend || 0) - prevMonthlyExpense);

    const nextBalance = walletBalance + prevUnused;
    saveSettings(user.uid, {
      walletBalance: nextBalance,
      walletMonthKey: currentMonthKey,
      walletLastCarryover: prevUnused,
      walletLastCarryoverMonth: getMonthKey(prevMonthDate)
    });

    if (prevUnused > 0) {
      setWalletNotice(t("walletCarry", { amount: formatAmount(prevUnused) }));
      setTimeout(() => setWalletNotice(""), 4000);
    }
  }, [
    user,
    settings,
    walletMonthKey,
    walletBalance,
    periodRange.start,
    allTransactions,
    payments,
    activeGoal
  ]);

  return (
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <div className="dashboard-tiles">
          <div className="stat-tile tile-green">
            <div className="tile-label">{t("status")}</div>
            <div className="tile-value">{status.message ? t("statusWarn") : t("statusOk")}</div>
            <div className="tile-sub">{t("monthBalance")}</div>
          </div>
          <div className="stat-tile tile-blue">
            <div className="tile-label">{t("toGoal")}</div>
            <div className="tile-value">{formatAmount(Math.round(plannedMonthlySavings))}</div>
            <div className="tile-sub">{t("planSavings")}</div>
          </div>
          <div className="stat-tile tile-emerald">
            <div className="tile-label">{t("wallet")}</div>
            <div className="tile-value">{formatAmount(walletBalance)}</div>
            <div className="tile-sub">{t("walletSub")}</div>
          </div>
          <div className="stat-tile tile-orange">
            <div className="tile-label">{t("canSpend")}</div>
            <div className="tile-value">{formatAmount(Math.round(remainingToSpend))}</div>
            <div className="tile-sub">{t("remainingMonth")}</div>
          </div>
          <div className="stat-tile tile-red">
            <div className="tile-label">{t("mandatory")}</div>
            <div className="tile-value">{formatAmount(Math.round(monthlyMandatory))}</div>
            <div className="tile-sub">{t("monthlyPayments")}</div>
          </div>
        </div>
        <BudgetCard
          monthlyIncome={monthlyIncome}
          monthlyMandatory={monthlyMandatory}
          recommendedMaxSpend={safeRecommendedSpend}
          currentMonthExpense={currentMonthExpense}
          budgetMode={settings?.budgetMode || "auto"}
          planSpend={planSpend}
          warning={status.message}
          onOpenSettings={() => navigate("/settings")}
        />
      <StatsCard
        stats={stats}
        periodLabel={t("periodMonth")}
        monthlyNet={factMonthlyNet}
        series={chartSeries}
      />
      </div>
      <div className="dashboard-side">
        <PaymentsOverview payments={payments} />
        {import.meta.env.DEV && (
          <details className="glass-card">
            <summary className="card-title dev-summary">Проверка расчётов (dev)</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <div>
                Период (месяц): {periodRange.startISO} → {periodRange.endISO}
              </div>
              <div>Транзакции в периоде: {periodTransactions.length}</div>
              <div>Факт: пришло {formatAmount(stats.income)}, потрачено {formatAmount(stats.expense)}, остаётся {formatAmount(stats.net)}</div>
              <div>Месячный доход: {formatAmount(monthlyIncome)}</div>
              <div>Месячный расход: {formatAmount(monthlyExpense)}</div>
              <div>Ежемесячные обязательные: {formatAmount(monthlyMandatory)}</div>
              <div>План накоплений: {formatAmount(plannedMonthlySavings)}</div>
              <div>Рекомендовано тратить: {formatAmount(recommendedMaxSpend)}</div>
              <div>Плановый остаток (на цели): {formatAmount(plannedMonthlyNet)}</div>
              <div>Проверка: обязательные + накопления + можно тратить = {formatAmount(monthlyMandatory + plannedMonthlySavings + planSpend)}</div>
              <div>Настройки бюджета: {settings?.budgetMode || "auto"}</div>
              <div>Ручной бюджет: {formatAmount(settings?.manualMonthlyBudget || 0)}</div>
              <div>Режим накоплений: {settings?.targetSavingsMode || "goal_based"}</div>
              <div>Фикс накоплений: {formatAmount(settings?.fixedMonthlySavings || 0)}</div>
              <div>Активная цель: {activeGoal?.title || "-"}</div>
              <div className="stack" style={{ marginTop: 8 }}>
                <strong>Ежемесячные платежи:</strong>
                {payments
                  .filter((p) => (p.recurrence || "oneTime") === "monthly")
                  .map((p) => (
                    <div key={p.id}>
                      {p.title} • {formatAmount(p.amount)}
                    </div>
                  ))}
                {!payments.some((p) => (p.recurrence || "oneTime") === "monthly") && (
                  <div className="muted">Нет ежемесячных платежей.</div>
                )}
              </div>
              <div className="stack" style={{ marginTop: 8 }}>
                <strong>Транзакции в периоде:</strong>
                {periodTransactions.map((tx) => (
                  <div key={tx.id}>
                    {tx.occurredAtISO} • {tx.type} • {formatAmount(tx.amount)} • {tx.raw}
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

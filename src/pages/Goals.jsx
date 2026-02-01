import { useEffect, useMemo, useState } from "react";
import GoalPanel from "../components/GoalPanel";
import StatsCard from "../components/StatsCard";
import { useUser } from "../lib/user";
import {
  addGoal,
  addGoalContribution,
  completeGoal,
  deleteGoal,
  saveSettings,
  watchGoals,
  watchPayments,
  watchSettings,
  watchTransactions
} from "../lib/store";
import { computeStats } from "../lib/calcs";
import {
  computeMandatoryMonthly,
  computeMonthlyExpense,
  computeMonthlyIncome,
  computeRequiredMonthlySavings,
  getActiveGoal
} from "../lib/budgetCalc";
import { filterByOccurredAtISO, getMonthKey, getMonthRange } from "../lib/utils";
import { useI18n } from "../components/I18nProvider";

export default function Goals() {
  const user = useUser();
  const { t } = useI18n();
  const [goals, setGoals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [monthTick, setMonthTick] = useState(getMonthKey(new Date()));
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    return watchGoals(user.uid, setGoals);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchPayments(user.uid, setPayments);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchSettings(user.uid, setSettings);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setAllTransactions);
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
  const activeGoalId = useMemo(
    () => settings?.activeGoalId || (goals[0]?.id || ""),
    [settings, goals]
  );
  const plannedMonthlySavings = useMemo(
    () => computeRequiredMonthlySavings(activeGoal, stats.net, settings),
    [activeGoal, settings, stats.net]
  );
  const plannedMonthlyNet = useMemo(
    () => monthlyIncome - monthlyMandatory - plannedMonthlySavings,
    [monthlyIncome, monthlyMandatory, plannedMonthlySavings]
  );
  const dailyNet = useMemo(() => plannedMonthlyNet / 30, [plannedMonthlyNet]);
  const factMonthlyNet = useMemo(() => stats.net, [stats.net]);

  return (
    <div className="stack">
      <div>
        <div className="card-title">{t("goalsTitle")}</div>
        <div className="helper-text">{t("goalsHelp")}</div>
      </div>
      {deleteMessage && <div className="toast">{deleteMessage}</div>}
      <GoalPanel
        goals={goals}
        monthlyNet={plannedMonthlyNet}
        dailyNet={dailyNet}
        plannedMonthlySavings={plannedMonthlySavings}
        activeGoalId={activeGoalId}
        targetSavingsMode={settings?.targetSavingsMode || "goal_based"}
        fixedMonthlySavings={settings?.fixedMonthlySavings || 0}
        deletingIds={deletingIds}
        onAdd={(payload) => addGoal(user.uid, payload)}
        onDelete={async (id) => {
          if (deletingIds.has(id)) return;
          setDeletingIds((prev) => new Set(prev).add(id));
          try {
            const goal = goals.find((item) => item.id === id);
            const refund = Math.max(0, Number(goal?.currentAmount || 0));
            await deleteGoal(user.uid, id);
            if (refund > 0) {
              const nextBalance = Math.max(0, Number(settings?.walletBalance || 0)) + refund;
              await saveSettings(user.uid, { walletBalance: nextBalance });
            }
            setDeleteMessage(t("deleted"));
          } catch (error) {
            setDeleteMessage(t("deleteFailed"));
          } finally {
            setDeletingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setTimeout(() => setDeleteMessage(""), 2000);
          }
        }}
        onContribute={(goal) =>
          addGoalContribution(user.uid, goal.id, plannedMonthlySavings, goal.title)
        }
        onComplete={(goal) => completeGoal(user.uid, goal.id)}
      />
      <StatsCard
        stats={stats}
        periodLabel={t("periodMonth")}
        monthlyNet={factMonthlyNet}
        series={[]}
      />
    </div>
  );
}

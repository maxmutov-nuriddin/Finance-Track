import { useEffect, useMemo, useState } from "react";
import GoalPanel from "../components/GoalPanel";
import StatsCard from "../components/StatsCard";
import { useUser } from "../lib/user";
import { addGoal, deleteGoal, watchGoals, watchPayments, watchSettings, watchTransactions } from "../lib/store";
import { computeStats } from "../lib/calcs";
import {
  computeMandatoryMonthly,
  computeMonthlyExpense,
  computeMonthlyIncome,
  computeRequiredMonthlySavings,
  getActiveGoal
} from "../lib/budgetCalc";
import { filterByOccurredAtISO, getMonthKey, getMonthRange } from "../lib/utils";

export default function Goals() {
  const user = useUser();
  const [goals, setGoals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [monthTick, setMonthTick] = useState(getMonthKey(new Date()));

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
        <div className="card-title">Твои цели</div>
        <div className="helper-text">
          Добавляй цели, а мы покажем темп и срок.
        </div>
      </div>
      <GoalPanel
        goals={goals}
        monthlyNet={plannedMonthlyNet}
        dailyNet={dailyNet}
        plannedMonthlySavings={plannedMonthlySavings}
        activeGoalId={settings?.activeGoalId || ""}
        targetSavingsMode={settings?.targetSavingsMode || "goal_based"}
        fixedMonthlySavings={settings?.fixedMonthlySavings || 0}
        onAdd={(payload) => addGoal(user.uid, payload)}
        onDelete={(id) => deleteGoal(user.uid, id)}
      />
      <StatsCard
        stats={stats}
        periodLabel="За текущий месяц"
        monthlyNet={factMonthlyNet}
        series={[]}
      />
    </div>
  );
}

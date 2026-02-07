import { useEffect, useMemo, useState } from "react";
import GoalPanel from "../components/GoalPanel";
import { useUser } from "../lib/user";
import {
  addGoalContribution,
  completeGoal,
  deleteGoalWithRefund,
  withdrawGoalAmount,
  watchDebts,
  watchGoals,
  watchPayments,
  watchSettings,
  watchTransactions
} from "../lib/store";
import { buildMonthlyPlan, computeGoalPlan } from "../lib/budgetPlan";
import { formatDateISO, getTzParts, nowInTashkent } from "../lib/timezone";
import { useI18n } from "../components/I18nProvider";
import { Target } from "lucide-react";
import { formatAmount } from "../lib/format";

export default function Goals() {
  const user = useUser();
  const { t } = useI18n();
  const [goals, setGoals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [debts, setDebts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [dayTick, setDayTick] = useState(() => formatDateISO(getTzParts(nowInTashkent())));
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
    return watchDebts(user.uid, setDebts);
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
      const nextKey = formatDateISO(getTzParts(nowInTashkent()));
      setDayTick((prev) => (prev === nextKey ? prev : nextKey));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const plan = useMemo(
    () =>
      buildMonthlyPlan({
        wallet: Number(settings?.walletBalance || 0),
        transactions: allTransactions,
        payments,
        debts,
        settings,
        now: nowInTashkent()
      }),
    [allTransactions, payments, debts, settings, dayTick]
  );

  const computedGoals = useMemo(
    () => goals.map((goal) => ({ ...goal, ...computeGoalPlan(goal, plan, settings) })),
    [goals, plan, settings]
  );

  const activeGoalId = useMemo(
    () => settings?.activeGoalId || (goals[0]?.id || ""),
    [settings, goals]
  );

  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + Number(g.currentAmount || 0), 0),
    [goals]
  );

  return (
    <div className="goals-container">
      <div className="goals-header">
        <div>
          <h1 className="goals-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Target size={28} strokeWidth={2.5} /> {t("goalsTitle")}
          </h1>
          <p className="goals-subtitle">{t("goalsHelp")}</p>
        </div>
      </div>

      {deleteMessage && <div className="toast" style={{ marginBottom: 16 }}>{deleteMessage}</div>}

      <div className="goals-stats">
        <div className="stat-card">
          <div className="stat-card-label">{t("totalGoals")}</div>
          <div className="stat-card-value" style={{ color: "#3b82f6" }}>
            {goals.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t("goalCompleted")}</div>
          <div className="stat-card-value" style={{ color: "#22c55e" }}>
            {goals.filter((g) => g.isCompleted || g.completedAt).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t("totalSaved")}</div>
          <div className="stat-card-value" style={{ color: "#a855f7" }}>
            {formatAmount(totalSaved)}
          </div>
        </div>
      </div>

      <GoalPanel
        goals={computedGoals}
        activeGoalId={activeGoalId}
        deletingIds={deletingIds}
        onDelete={async (id) => {
          if (deletingIds.has(id)) return;
          const confirmed = window.confirm(t("deleteConfirm"));
          if (!confirmed) return;
          setDeletingIds((prev) => new Set(prev).add(id));
          try {
            const goal = goals.find((item) => item.id === id);
            const refund = Math.max(0, Number(goal?.currentAmount || 0));
            await deleteGoalWithRefund(user.uid, id, refund);
            setDeleteMessage(t("deleted"));
          } catch {
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
        onContribute={(goal) => {
          if (!user) return;
          const amount = Math.max(0, Math.round(Number(goal.recommendedMonthly || 0)));
          const title = goal.title || goal.name || goal.goalTitle || t("goalDefaultTitle");
          return addGoalContribution(user.uid, goal.id, amount, title);
        }}
        onWithdraw={(goal, amount) => {
          if (!user) return;
          return withdrawGoalAmount(user.uid, goal.id, amount);
        }}
        onComplete={(goal) => completeGoal(user.uid, goal.id)}
      />
    </div>
  );
}


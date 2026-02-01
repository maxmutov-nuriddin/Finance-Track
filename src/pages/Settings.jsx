import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import GlassInput from "../components/GlassInput";
import { useUser } from "../lib/user";
import { saveSettings, watchGoals, watchSettings } from "../lib/store";
import { formatAmount } from "../lib/format";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";

const savingsModes = [
  { value: "goal_based", label: "По цели" },
  { value: "fixed", label: "Фикс" }
];

export default function Settings() {
  const user = useUser();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);

  const [budgetMode, setBudgetMode] = useState("auto");
  const [manualMonthlyBudget, setManualMonthlyBudget] = useState("");
  const [targetSavingsMode, setTargetSavingsMode] = useState("goal_based");
  const [fixedMonthlySavings, setFixedMonthlySavings] = useState("");
  const [activeGoalId, setActiveGoalId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsubSettings = watchSettings(user.uid, (data) => {
      setBudgetMode(data?.budgetMode || "auto");
      setManualMonthlyBudget(data?.manualMonthlyBudget ? String(data.manualMonthlyBudget) : "");
      setTargetSavingsMode(data?.targetSavingsMode || "goal_based");
      setFixedMonthlySavings(data?.fixedMonthlySavings ? String(data.fixedMonthlySavings) : "");
      setActiveGoalId(data?.activeGoalId || "");
    });
    const unsubGoals = watchGoals(user.uid, setGoals);
    return () => {
      unsubSettings();
      unsubGoals();
    };
  }, [user]);

  const handleSave = async () => {
    await saveSettings(user.uid, {
      budgetMode,
      manualMonthlyBudget: manualMonthlyBudget ? Number(manualMonthlyBudget) : null,
      targetSavingsMode,
      fixedMonthlySavings: fixedMonthlySavings ? Number(fixedMonthlySavings) : null,
      activeGoalId: activeGoalId || null
    });
    setSavedMessage("Сохранено");
    setTimeout(() => setSavedMessage(""), 2000);
  };

  return (
    <div className="stack">
      <div>
        <div className="card-title">Настройки бюджета</div>
        <div className="helper-text">
          Все параметры, влияющие на расчет “сколько можно тратить”.
        </div>
      </div>

      <div className="grid-2">
        <GlassCard>
          <div className="card-title">Режим бюджета</div>
          <div className="helper-text">AUTO — считаем по цели, MANUAL — задаешь сам.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <GlassButton
              variant={budgetMode === "auto" ? "secondary" : "ghost"}
              onClick={() => setBudgetMode("auto")}
            >
              AUTO
            </GlassButton>
            <GlassButton
              variant={budgetMode === "manual" ? "secondary" : "ghost"}
              onClick={() => setBudgetMode("manual")}
            >
              MANUAL
            </GlassButton>
          </div>
          {budgetMode === "manual" && (
            <div style={{ marginTop: 12 }}>
              <GlassInput
                placeholder="Месячный бюджет (цифрами)"
                type="number"
                value={manualMonthlyBudget}
                onChange={(event) => setManualMonthlyBudget(event.target.value)}
              />
              {manualMonthlyBudget && (
                <div className="helper-text" style={{ marginTop: 6 }}>
                  {formatAmount(manualMonthlyBudget)}
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="card-title">Активная цель</div>
          <div className="helper-text">Эта цель влияет на авто‑бюджет.</div>
          <div style={{ marginTop: 12 }}>
            <select value={activeGoalId} onChange={(event) => setActiveGoalId(event.target.value)}>
              <option value="">Выбери цель</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="card-title">Как копить</div>
        <div className="row" style={{ marginTop: 10 }}>
          {savingsModes.map((mode) => (
            <GlassButton
              key={mode.value}
              variant={targetSavingsMode === mode.value ? "secondary" : "ghost"}
              onClick={() => setTargetSavingsMode(mode.value)}
            >
              {mode.label}
            </GlassButton>
          ))}
        </div>
        {targetSavingsMode === "fixed" && (
          <div style={{ marginTop: 12 }}>
            <GlassInput
              placeholder="Фиксировано откладывать в месяц"
              type="number"
              value={fixedMonthlySavings}
              onChange={(event) => setFixedMonthlySavings(event.target.value)}
            />
            {fixedMonthlySavings && (
              <div className="helper-text" style={{ marginTop: 6 }}>
                {formatAmount(fixedMonthlySavings)}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="card-title">Сохранить изменения</div>
        <div className="helper-text">Все расчеты обновятся автоматически.</div>
        <div className="row" style={{ marginTop: 12 }}>
          <GlassButton onClick={handleSave}>Сохранить</GlassButton>
          {savedMessage && <span className="badge">{savedMessage}</span>}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="card-title">Аккаунт</div>
        <div className="helper-text">Выйти из приложения.</div>
        <GlassButton
          variant="ghost"
          onClick={() => signOut(auth).then(() => navigate("/", { replace: true }))}
          style={{ marginTop: 12 }}
        >
          Выйти
        </GlassButton>
      </GlassCard>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Coffee, ShoppingCart, Utensils, Car, Shirt, Sparkles, Baby, Gift,
  PawPrint, Plane, Home, Smartphone, FileText, Tv2, ShoppingBag,
  Zap, Pill, GraduationCap, User, Handshake, CreditCard, Building2,
  Banknote, Tag, Pencil, X, CornerDownLeft, Plus, Loader2
} from "lucide-react";
import { parseInput } from "../lib/parse";
import { formatISOWithOffset, getTzParts, nowInTashkent } from "../lib/timezone";
import { useUser } from "../lib/user";
import { addTransaction, deleteTransaction } from "../lib/store";
import { formatAmount } from "../lib/format";
import { showSiteToast } from "../lib/siteToast";
import { useI18n } from "./I18nProvider";

const CATEGORY_ICON_MAP = {
  cafe: Coffee, groceries: ShoppingCart, food: Utensils, transport: Car,
  clothes: Shirt, beauty: Sparkles, kids: Baby, gifts: Gift,
  pets: PawPrint, travel: Plane, home: Home, subscriptions: Smartphone,
  taxes: FileText, entertainment: Tv2, shopping: ShoppingBag,
  utilities: Zap, health: Pill, education: GraduationCap, personal: User,
  debt: Handshake, credit: CreditCard, rent: Building2,
  income: Banknote, other: Tag
};

const CATEGORY_LABELS = {
  cafe: "Кафе", groceries: "Продукты", food: "Еда", transport: "Транспорт",
  clothes: "Одежда", beauty: "Красота", kids: "Дети", gifts: "Подарки",
  pets: "Питомцы", travel: "Путешествия", home: "Дом", subscriptions: "Подписки",
  taxes: "Налоги", entertainment: "Развлечения", shopping: "Покупки",
  utilities: "Коммуналка", health: "Здоровье", education: "Образование",
  personal: "Личное", debt: "Долг", credit: "Кредит", rent: "Аренда",
  income: "Доход", other: "Прочее"
};

function CategoryIcon({ category, size = 15, className = "" }) {
  const Icon = CATEGORY_ICON_MAP[category] || Tag;
  return <Icon size={size} strokeWidth={2} className={className} />;
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SmartInputBar({ onOpenAdvanced }) {
  const user = useUser();
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  const debouncedRaw = useDebounce(raw, 120);

  useEffect(() => {
    if (!debouncedRaw.trim()) { setPreview(null); return; }
    setPreview(parseInput(debouncedRaw, nowInTashkent()));
  }, [debouncedRaw]);

  const isComplex = preview && (
    preview.debtMode || preview.type === "goal" ||
    preview.warnings?.includes("amount_not_found")
  );
  const canSubmit = preview && preview.amount > 0 && !isComplex && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user) return;

    const effectiveType = preview.type || "expense";
    const effectiveCategory = effectiveType === "income"
      ? "income"
      : preview.categoryDetected ? preview.category : "other";

    const now = nowInTashkent();
    const occurredAtISO = preview.occurredAtISO || formatISOWithOffset(getTzParts(now));
    const occurredAt = preview.occurredAtDate || now;

    setIsSubmitting(true);
    let savedId = null;

    try {
      const docRef = await addTransaction(user.uid, {
        amount: preview.amount,
        occurredAt,
        occurredAtISO,
        category: effectiveCategory,
        type: effectiveType,
        incomePeriod: effectiveType === "income" ? preview.incomePeriod || null : null,
        description: preview.description || "",
        isRecurring: false,
        raw: debouncedRaw
      });
      savedId = docRef?.id;
      setRaw("");
      setPreview(null);

      const label = effectiveType === "income"
        ? `${t("typeIncome")}: +${formatAmount(preview.amount)}`
        : `${CATEGORY_LABELS[effectiveCategory] || "Расход"}: −${formatAmount(preview.amount)}`;

      showSiteToast(label, effectiveType === "income" ? "success" : "info", {
        duration: 4000,
        action: savedId ? {
          label: t("undoAction") || "Отменить",
          onClick: async () => {
            try {
              await deleteTransaction(user.uid, savedId);
              showSiteToast(t("undoDone") || "Отменено", "info", { duration: 2000 });
            } catch {
              showSiteToast("Ошибка отмены", "error", { duration: 2000 });
            }
          }
        } : null
      });

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      showSiteToast(t("saveFailed") || "Ошибка сохранения", "error", { duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, user, preview, debouncedRaw, t]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isComplex && onOpenAdvanced) { onOpenAdvanced(raw); return; }
      handleSubmit();
    }
    if (e.key === "Escape") {
      setRaw(""); setPreview(null); inputRef.current?.blur();
    }
  };

  const previewCategory = preview?.categoryDetected
    ? preview.category
    : (preview?.type === "income" ? "income" : "other");
  const previewTypeClass = preview?.type === "income" ? "smart-preview--income" : "smart-preview--expense";
  const hasAmount = preview && preview.amount > 0;

  return (
    <div className={`smart-input-bar ${focused ? "smart-input-bar--focused" : ""}`}>
      <div className="smart-input-wrap">
        <span className="smart-input-icon">
          {preview && hasAmount
            ? <CategoryIcon category={previewCategory} size={16} />
            : <Pencil size={15} strokeWidth={2} />
          }
        </span>
        <input
          ref={inputRef}
          type="text"
          className="smart-input-field"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={t("smartInputPlaceholder") || "кофе 250, зп 2млн, такси 15тыс..."}
          autoComplete="off"
          spellCheck={false}
          disabled={isSubmitting}
        />

        {raw && (
          <button
            type="button"
            className="smart-input-clear"
            onClick={() => { setRaw(""); setPreview(null); inputRef.current?.focus(); }}
            tabIndex={-1}
            aria-label="Очистить"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}

        {canSubmit && (
          <button
            type="button"
            className="smart-input-submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-label="Добавить"
          >
            {isSubmitting
              ? <Loader2 size={14} strokeWidth={2.5} className="spin" />
              : <CornerDownLeft size={14} strokeWidth={2.5} />
            }
          </button>
        )}

        {isComplex && raw && (
          <button
            type="button"
            className="smart-input-advanced"
            onClick={() => onOpenAdvanced?.(raw)}
            title="Открыть расширенный ввод"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {preview && hasAmount && focused && (
        <div className={`smart-preview ${previewTypeClass}`}>
          <span className="smart-preview-icon">
            <CategoryIcon category={previewCategory} size={14} />
          </span>
          <span className="smart-preview-desc">
            {preview.description || CATEGORY_LABELS[previewCategory] || "Прочее"}
          </span>
          <span className="smart-preview-amount">
            {preview.type === "income" ? "+" : "−"}{formatAmount(preview.amount)}
          </span>
          {isComplex && (
            <span className="smart-preview-hint">
              {preview.debtMode ? "Долг — расш. ввод" : "Нет суммы"}
            </span>
          )}
          {canSubmit && (
            <span className="smart-preview-enter">
              <CornerDownLeft size={11} strokeWidth={2} /> Enter
            </span>
          )}
        </div>
      )}
    </div>
  );
}

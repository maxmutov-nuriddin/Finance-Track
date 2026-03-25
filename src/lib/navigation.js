export function getAppNavigation(t) {
  return [
    { label: t("navHome"), shortLabel: t("navHomeShort"), path: "/", icon: "home" },
    { label: t("navHistory"), shortLabel: t("navHistoryShort"), path: "/history", icon: "history" },
    { label: t("navGoals"), shortLabel: t("navGoalsShort"), path: "/goals", icon: "goals" },
    { label: t("navPayments"), shortLabel: t("navPaymentsShort"), path: "/payments", icon: "payments" },
    { label: t("navSettings"), shortLabel: t("navSettingsShort"), path: "/settings", icon: "settings" }
  ];
}

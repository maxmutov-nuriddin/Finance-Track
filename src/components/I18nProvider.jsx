import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { t as translate } from "../lib/i18n";
import { useUser } from "../lib/user";
import { saveSettings, watchSettings } from "../lib/store";

const I18nContext = createContext({
  lang: "ru",
  t: (key, vars) => translate("ru", key, vars),
  setLang: () => {}
});

export function I18nProvider({ children }) {
  const user = useUser();
  const [lang, setLangState] = useState("ru");

  useEffect(() => {
    if (!user) return;
    return watchSettings(user.uid, (data) => {
      setLangState(data?.language || "ru");
    });
  }, [user]);

  const setLang = async (next) => {
    setLangState(next);
    if (user) {
      await saveSettings(user.uid, { language: next });
    }
  };

  const value = useMemo(
    () => ({ lang, t: (key, vars) => translate(lang, key, vars), setLang }),
    [lang, user]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
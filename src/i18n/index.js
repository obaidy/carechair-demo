import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar.json";
import en from "./en.json";
import cs from "./cs.json";
import ru from "./ru.json";

export const SUPPORTED_LANGS = ["ar", "en", "cs", "ru"];
export const RTL_LANGS = new Set(["ar"]);

export function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "en";
  if (SUPPORTED_LANGS.includes(raw)) return raw;
  const short = raw.split("-")[0];
  return SUPPORTED_LANGS.includes(short) ? short : "en";
}

export function isRtlLang(lang) {
  return RTL_LANGS.has(normalizeLang(lang));
}

function pickInitialLang() {
  if (typeof window === "undefined") return "en";
  const fromStorage = normalizeLang(window.localStorage.getItem("carechair_lang"));
  if (fromStorage) return fromStorage;
  return normalizeLang(window.navigator.language || "en");
}

function applyDocumentLang(lang) {
  if (typeof document === "undefined") return;
  const normalized = normalizeLang(lang);
  document.documentElement.lang = normalized;
  document.documentElement.dir = isRtlLang(normalized) ? "rtl" : "ltr";
}

const initialLanguage = pickInitialLang();

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      cs: { translation: cs },
      ru: { translation: ru }
    },
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

applyDocumentLang(initialLanguage);

i18n.on("languageChanged", (lang) => {
  const normalized = normalizeLang(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("carechair_lang", normalized);
  }
  applyDocumentLang(normalized);
});

export default i18n;

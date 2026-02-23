import React from "react";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGS } from "../i18n";

const LABELS = {
  ar: "العربية",
  en: "English",
  cs: "Čeština",
  ru: "Русский"
};

export default function LanguageSwitcher({ className = "", onLanguageChange }) {
  const { i18n: i18nInstance } = useTranslation();
  const value = i18nInstance.language?.split("-")?.[0] || "en";

  async function handleChange(event) {
    const lang = event.target.value;
    await i18n.changeLanguage(lang);
    if (typeof onLanguageChange === "function") onLanguageChange(lang);
  }

  return (
    <label className={`lang-switcher ${className}`.trim()}>
      <span>🌐</span>
      <select value={value} onChange={handleChange}>
        {SUPPORTED_LANGS.map((lang) => (
          <option value={lang} key={lang}>
            {LABELS[lang] || lang}
          </option>
        ))}
      </select>
    </label>
  );
}

import {createContext, useContext, useMemo, type ReactNode} from 'react';
import {I18nManager} from 'react-native';
import {strings} from './strings';
import {useUiStore} from '../state/uiStore';
import type {LocaleCode} from '../types/models';

type I18nContextValue = {
  locale: LocaleCode;
  isRTL: boolean;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'ar',
  isRTL: true,
  setLocale: () => undefined,
  t: (key) => key
});

function interpolate(value: string, params?: Record<string, string | number>) {
  if (!params) return value;
  return Object.entries(params).reduce((acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v)), value);
}

export function I18nProvider({children}: {children: ReactNode}) {
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);

  const value = useMemo<I18nContextValue>(() => {
    const isRTL = locale === 'ar';
    const dictionary = strings[locale] || strings.en;

    if (I18nManager.isRTL !== isRTL) {
      // Runtime RTL styling is handled in components. Full native flip can be enabled with app reload later.
    }

    return {
      locale,
      isRTL,
      setLocale,
      t: (key, params) => interpolate(dictionary[key] || strings.en[key] || key, params)
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

import {create} from 'zustand';
import type {CalendarViewMode, LocaleCode, ThemeMode} from '../types/models';

type UiState = {
  locale: LocaleCode;
  themeMode: ThemeMode;
  calendarView: CalendarViewMode;
  selectedDateIso: string;
  setLocale: (locale: LocaleCode) => void;
  toggleTheme: () => void;
  setCalendarView: (view: CalendarViewMode) => void;
  setSelectedDateIso: (iso: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  locale: 'ar',
  themeMode: 'light',
  calendarView: 'day',
  selectedDateIso: new Date().toISOString(),
  setLocale: (locale) => set({locale}),
  toggleTheme: () => set((state) => ({themeMode: state.themeMode === 'light' ? 'dark' : 'light'})),
  setCalendarView: (calendarView) => set({calendarView}),
  setSelectedDateIso: (selectedDateIso) => set({selectedDateIso})
}));

import React from "react";
import SalonCalendar from "../../components/calendar/SalonCalendar";

export default function CalendarPage({ salon, writeLocked, t, showToast, onChanged }) {
  return <SalonCalendar salon={salon} writeLocked={writeLocked} t={t} showToast={showToast} onChanged={onChanged} />;
}

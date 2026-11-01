import { useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useApp } from "./store";
import { today } from "../domain/dates";
import { dueReminders } from "../domain/reminders";
export function useForegroundReminders() {
  const { records } = useApp();
  useEffect(() => {
    const check = () => {
      if (!("Notification" in window) || Notification.permission !== "granted")
        return;
      const date = today(),
        time = formatInTimeZone(new Date(), "America/New_York", "HH:mm");
      const settings = records.find((r) => r.id === "preferences");
      for (const reminder of dueReminders(
        records,
        date,
        time,
        settings?.data,
      )) {
        const key = `lock-in-reminder-${reminder.id}`;
        if (sessionStorage.getItem(key)) continue;
        try {
          const notification = new Notification(
            `THE LOCK-IN · ${reminder.title}`,
            { body: reminder.body, tag: reminder.id },
          );
          notification.onclick = () => {
            window.focus();
            location.hash = `#${reminder.route}`;
            notification.close();
          };
          sessionStorage.setItem(key, "shown");
        } catch {
          /* Platforms without foreground Notification support keep in-app reminders. */
        }
      }
    };
    check();
    const timer = window.setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [records]);
}

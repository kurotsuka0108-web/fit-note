// 週カレンダー用の日付ユーティリティ（ローカルタイム基準）。

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYmd(): string {
  return ymd(new Date());
}

export type WeekDay = { date: string; dow: string; day: number; isToday: boolean };

/** 今週（月曜始まり）の7日を返す。NOTE の週カレンダー用。 */
export function currentWeek(now: Date = new Date()): WeekDay[] {
  const mondayOffset = (now.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0 ...
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - mondayOffset);

  const labels = ["月", "火", "水", "木", "金", "土", "日"];
  const today = ymd(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const s = ymd(d);
    return { date: s, dow: labels[i], day: d.getDate(), isToday: s === today };
  });
}

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

// ── 月間カレンダー（DATA の筋トレ履歴用、月曜始まり） ───────────────────────
export type MonthCell = { date: string; day: number; inMonth: boolean; isToday: boolean };

/** year・month0(0-11) の月を、月曜始まりの週配列で返す。月外の日は inMonth=false。 */
export function monthMatrix(year: number, month0: number, now: Date = new Date()): MonthCell[][] {
  const first = new Date(year, month0, 1);
  const startOffset = (first.getDay() + 6) % 7; // 月曜始まりの先頭空白
  const gridStart = new Date(year, month0, 1 - startOffset);
  const today = ymd(now);
  const weeks: MonthCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart);
      cur.setDate(gridStart.getDate() + w * 7 + d);
      const s = ymd(cur);
      row.push({ date: s, day: cur.getDate(), inMonth: cur.getMonth() === month0, isToday: s === today });
    }
    // 全日が月外の行（末尾の余り週）は省く
    if (row.some((c) => c.inMonth)) weeks.push(row);
  }
  return weeks;
}

/** "YYYY-MM" 文字列（getWorkoutDates 用） */
export function ymStr(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

/** 月曜始まりの曜日ラベル */
export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

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

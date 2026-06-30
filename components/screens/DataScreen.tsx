"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { BODY_PARTS, getNoteRepo, type WorkoutLog } from "@/lib/db";
import { monthMatrix, todayYmd, WEEKDAY_LABELS, ymStr } from "@/lib/date";

// フィルタ: 全て + 部位別（胸の日 等）
const FILTERS = ["全て", ...BODY_PARTS] as const;

/* 画面③: DATA（筋トレ履歴カレンダー）— 過去のトレ内容を年月単位・部位別で振り返る。無料機能。 */
export function DataScreen() {
  const C = useC();
  const repo = useMemo(() => getNoteRepo(), []);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [monthParts, setMonthParts] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState<string>("全て"); // "全て" or 部位名
  const [selected, setSelected] = useState<string>(todayYmd());
  const [dayLogs, setDayLogs] = useState<WorkoutLog[] | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  // 表示中の月の「日付→部位一覧」を取得
  useEffect(() => {
    let alive = true;
    repo.getMonthParts(ymStr(year, month0)).then((m) => alive && setMonthParts(m)).catch(() => {});
    return () => { alive = false; };
  }, [repo, year, month0]);

  // フィルタ適用後の「マークする日付」集合
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const [d, parts] of Object.entries(monthParts)) {
      if (filter === "全て" || parts.includes(filter)) set.add(d);
    }
    return set;
  }, [monthParts, filter]);

  // 選択日の詳細を取得
  useEffect(() => {
    let alive = true;
    setLoadingDay(true);
    repo.getLogs(selected).then((ls) => alive && setDayLogs(ls)).catch(() => alive && setDayLogs([])).finally(() => { if (alive) setLoadingDay(false); });
    return () => { alive = false; };
  }, [repo, selected]);

  const weeks = monthMatrix(year, month0);
  const go = (delta: number) => {
    let m = month0 + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setMonth0(m);
    setYear(y);
  };

  const selLabel = (() => {
    const d = new Date(`${selected}T00:00:00`);
    const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日(${wd})`;
  })();

  // 部位フィルタ中は、その日の中でも対象部位の種目だけ表示する
  const shownLogs = dayLogs ? (filter === "全て" ? dayLogs : dayLogs.filter((l) => l.part === filter)) : null;

  return (
    <div className="px-5 pt-4 pb-8">
      {/* 月ナビ */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => go(-1)} aria-label="前の月"
          className="rounded-lg flex items-center justify-center"
          style={{ width: 36, height: 36, background: C.surface, color: C.mid, border: `1px solid ${C.border}` }}>
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: C.accent }} />
          <span style={{ color: C.hi, fontSize: 17, fontWeight: 800 }}>{year}年{month0 + 1}月</span>
        </div>
        <button onClick={() => go(1)} aria-label="次の月"
          className="rounded-lg flex items-center justify-center"
          style={{ width: 36, height: 36, background: C.surface, color: C.mid, border: `1px solid ${C.border}` }}>
          <ChevronRight size={18} />
        </button>
      </div>
      <p style={{ color: C.lo, fontSize: 11, textAlign: "center", marginBottom: 10 }}>
        {filter === "全て" ? "この月のトレーニング" : `${filter}の日`} <span style={{ color: C.accent, fontWeight: 800 }}>{dates.size}</span> 日
      </p>

      {/* 部位フィルタ（全て / 胸 / 背中 …） */}
      <div className="flex gap-2 overflow-x-auto fn-scroll mb-3" style={{ paddingBottom: 2 }}>
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-3"
              style={{
                flexShrink: 0,
                height: 32,
                fontSize: 12,
                fontWeight: 800,
                background: on ? C.accent : C.surface,
                color: on ? ON_GOLD : C.mid,
                border: `1px solid ${on ? C.accent : C.border}`,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid mb-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i >= 5 ? C.mid : C.lo }}>{w}</div>
        ))}
      </div>

      {/* 日グリッド */}
      <div className="flex flex-col gap-1">
        {weeks.map((row, wi) => (
          <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {row.map((cell) => {
              const has = dates.has(cell.date);
              const isSel = selected === cell.date;
              return (
                <button
                  key={cell.date}
                  onClick={() => setSelected(cell.date)}
                  disabled={!cell.inMonth}
                  className="relative rounded-xl flex flex-col items-center justify-center"
                  style={{
                    height: 44,
                    background: isSel ? C.accent : has ? "rgba(234,179,8,.10)" : "transparent",
                    border: cell.isToday && !isSel ? `1px solid ${C.accent}` : `1px solid ${isSel ? C.accent : "transparent"}`,
                    color: isSel ? ON_GOLD : cell.inMonth ? C.hi : C.lo,
                    opacity: cell.inMonth ? 1 : 0.35,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: cell.isToday || has ? 800 : 500 }}>{cell.day}</span>
                  {/* 記録ありドット */}
                  {has && !isSel && (
                    <span className="absolute rounded-full" style={{ width: 5, height: 5, background: C.accent, bottom: 5 }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 選択日の詳細 */}
      <div className="mt-5 rounded-2xl px-4 py-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: C.hi, fontSize: 14, fontWeight: 800 }}>{selLabel}</span>
          {shownLogs && shownLogs.length > 0 && (
            <span style={{ color: C.lo, fontSize: 11, fontWeight: 700 }}>{shownLogs.length}種目</span>
          )}
        </div>

        {loadingDay ? (
          <div className="flex justify-center py-6" style={{ color: C.accent }}><Loader2 size={20} className="fn-spin" /></div>
        ) : !shownLogs || shownLogs.length === 0 ? (
          <p style={{ color: C.lo, fontSize: 12, textAlign: "center", padding: "14px 0" }}>
            {filter === "全て" ? "この日は記録がありません" : `この日に${filter}の記録はありません`}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {shownLogs.map((log) => (
              <ExerciseRow key={log.id} log={log} C={C} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* トップセット（最大重量のセット）の表示テキストを作る。 */
function formatTopSet(log: WorkoutLog): string | null {
  if (!log.sets.length) return null;
  const top = log.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
  if (log.unit === "sec") return `${top.reps}秒`; // 秒数種目は reps に秒を持つ
  const load = top.bodyweight ? (top.weight > 0 ? `自重+${top.weight}kg` : "自重") : `${top.weight}kg`;
  return `${load} × ${top.reps}`;
}

/* 履歴の1種目（部位バッジ・種目名・セット数・トップセット）。 */
function ExerciseRow({ log, C }: { log: WorkoutLog; C: ReturnType<typeof useC> }) {
  const topText = formatTopSet(log);
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: C.tactical }}>
      <span className="rounded-md px-2 py-0.5" style={{ fontSize: 10, fontWeight: 800, color: C.mid, background: C.surface, border: `1px solid ${C.border}` }}>
        {log.part}
      </span>
      <span style={{ flex: 1, minWidth: 0, color: C.hi, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {log.name}
      </span>
      <span style={{ color: C.lo, fontSize: 11, fontWeight: 700 }}>{log.sets.length}セット</span>
      {topText && <span style={{ color: C.accent, fontSize: 11, fontWeight: 800 }}>{topText}</span>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { currentWeek, todayYmd } from "@/lib/date";
import {
  getNoteRepo,
  type LastSession,
  type Library,
  type SetStage,
  type WorkoutLog,
} from "@/lib/db";
import { ExerciseCard } from "./ExerciseCard";
import { AddExerciseSheet } from "./AddExerciseSheet";

// drops = 確定前のドロップ段（トップセット側）。完了時に現在値が最終段として連結される。
type Draft = { weight: number; reps: number; bodyweight: boolean; drops: SetStage[] };

const round1 = (n: number) => Math.round(n * 10) / 10;
const NEW_DRAFT: Draft = { weight: 20, reps: 10, bodyweight: false, drops: [] };

// ログの初期ドラフト（記録中の重量・レップ・自重フラグ）。最新セットがあればそれを引き継ぐ。
function draftFor(log: WorkoutLog): Draft {
  const last = log.sets[log.sets.length - 1];
  return last
    ? { weight: last.weight, reps: last.reps, bodyweight: last.bodyweight, drops: [] }
    : { ...NEW_DRAFT };
}

export function NoteScreen() {
  const C = useC();
  const repo = useMemo(() => getNoteRepo(), []);
  const week = useMemo(() => currentWeek(), []);

  const [active, setActive] = useState<string>(todayYmd());
  const [library, setLibrary] = useState<Library>({});
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [lasts, setLasts] = useState<Record<string, LastSession>>({});
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fail = (e: unknown) => {
    console.error("[NoteScreen]", e);
    setErr(e instanceof Error ? e.message : "保存に失敗しました");
  };

  // 種目ライブラリの初期ロード
  useEffect(() => {
    repo.getLibrary().then(setLibrary).catch(fail);
  }, [repo]);

  // 選択日のログ・ドラフト・前回実績をロード
  const loadDay = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const dayLogs = await repo.getLogs(date);
        const d: Record<string, Draft> = {};
        for (const l of dayLogs) d[l.id] = draftFor(l);
        setLogs(dayLogs);
        setDrafts(d);
        // 前回実績は種目ごとに取得
        const entries = await Promise.all(
          dayLogs.map(async (l) => [l.id, await repo.getLastSession(date, l.name)] as const),
        );
        setLasts(Object.fromEntries(entries));
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    },
    [repo],
  );

  useEffect(() => {
    loadDay(active);
  }, [active, loadDay]);

  /* ── ドラフト（記録中の値）操作: ローカルのみ ── */
  const stepW = (id: string, dir: 1 | -1) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], weight: Math.max(0, round1(p[id].weight + dir * 2.5)) } }));
  const setW = (id: string, v: number) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], weight: round1(Math.max(0, v)) } }));
  const stepR = (id: string, dir: 1 | -1) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], reps: Math.max(0, p[id].reps + dir) } }));
  const setR = (id: string, v: number) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], reps: Math.max(0, Math.round(v)) } }));
  const toggleBW = (id: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], bodyweight: !p[id].bodyweight } }));
  // 現在の重量・レップを1段として確定し、次の（より軽い）段の入力に移る
  const addDrop = (id: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], drops: [...p[id].drops, { weight: p[id].weight, reps: p[id].reps }] } }));
  const clearDrops = (id: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], drops: [] } }));
  const presetLast = (id: string) => {
    const l = lasts[id];
    if (l) setDrafts((p) => ({ ...p, [id]: { weight: l.w, reps: l.r, bodyweight: l.bw, drops: [] } }));
  };

  /* ── 永続化操作 ── */
  const completeSet = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    // 連鎖 = これまでのドロップ段 + 現在入力中の値（最終段）。先頭がトップセット。
    const stages = [...d.drops, { weight: d.weight, reps: d.reps }];
    const [top, ...rest] = stages;
    try {
      const set = await repo.addSet(id, { weight: top.weight, reps: top.reps, bodyweight: d.bodyweight, drops: rest });
      setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, sets: [...l.sets, set] } : l)));
      // 連鎖はリセット（重量・レップ・自重は次セットへ継続）
      setDrafts((p) => ({ ...p, [id]: { ...p[id], drops: [] } }));
    } catch (e) {
      fail(e);
    }
  };

  const removeSet = async (id: string, setId: string) => {
    try {
      await repo.removeSet(id, setId);
      setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, sets: l.sets.filter((s) => s.id !== setId) } : l)));
    } catch (e) {
      fail(e);
    }
  };

  const removeLog = async (id: string) => {
    try {
      await repo.removeLog(id);
      setLogs((ls) => ls.filter((l) => l.id !== id));
      setDrafts((p) => { const n = { ...p }; delete n[id]; return n; });
      setLasts((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch (e) {
      fail(e);
    }
  };

  const addToday = async (name: string, part: string) => {
    setAdding(false);
    try {
      const log = await repo.addLog(active, name, part);
      const last = await repo.getLastSession(active, name);
      setLogs((ls) => [...ls, log]);
      setDrafts((p) => ({ ...p, [log.id]: { ...NEW_DRAFT } }));
      setLasts((p) => ({ ...p, [log.id]: last }));
    } catch (e) {
      fail(e);
    }
  };

  const addCustom = async (part: string, name: string) => {
    try {
      await repo.addCustomExercise(part, name);
      setLibrary(await repo.getLibrary());
    } catch (e) {
      fail(e);
    }
    await addToday(name, part);
  };

  const todayNames = logs.map((l) => l.name);

  return (
    // min-height: 100% でボディ領域いっぱいに広げ、AddExerciseSheet（absolute inset-0）の
    // 下端が常に下部ナビ直上にアンカーされるようにする。
    <div className="px-5 pt-3 pb-2 relative" style={{ minHeight: "100%" }}>
      {/* 週カレンダー */}
      <div className="flex justify-between mb-5">
        {week.map((day) => {
          const on = day.date === active;
          return (
            <button key={day.date} onClick={() => setActive(day.date)}
              className="flex flex-col items-center rounded-xl py-2"
              style={{
                width: 44,
                background: on ? C.accent : "transparent",
                color: on ? ON_GOLD : C.mid,
                fontWeight: on ? 800 : 600,
                border: on ? "none" : `1px solid ${C.border}`,
              }}>
              <span style={{ fontSize: 11 }}>{day.dow}</span>
              <span style={{ fontSize: 15 }}>{day.day}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p style={{ color: C.lo, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>TODAY&apos;S LOG</p>
        <span style={{ color: C.lo, fontSize: 11 }}>{logs.length}種目</span>
      </div>

      {err && (
        <p className="mb-3 rounded-md px-2 py-1 text-center" style={{ color: "#fb7185", fontSize: 11, background: "rgba(251,113,133,.10)" }}>
          {err}
        </p>
      )}

      <div className="space-y-3">
        {logs.map((l, i) => (
          <ExerciseCard
            key={l.id} index={i + 1} log={l}
            draftWeight={drafts[l.id]?.weight ?? NEW_DRAFT.weight}
            draftReps={drafts[l.id]?.reps ?? NEW_DRAFT.reps}
            bodyweight={drafts[l.id]?.bodyweight ?? false}
            drops={drafts[l.id]?.drops ?? []}
            last={lasts[l.id] ?? null}
            onStepW={(d) => stepW(l.id, d)} onSetW={(v) => setW(l.id, v)}
            onStepR={(d) => stepR(l.id, d)} onSetR={(v) => setR(l.id, v)}
            onToggleBW={() => toggleBW(l.id)}
            onAddDrop={() => addDrop(l.id)} onClearDrops={() => clearDrops(l.id)}
            onComplete={() => completeSet(l.id)} onRemoveSet={(sid) => removeSet(l.id, sid)}
            onPreset={() => presetLast(l.id)} onRemove={() => removeLog(l.id)}
          />
        ))}
        {!loading && logs.length === 0 && (
          <div className="rounded-2xl p-6 text-center" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.7 }}>まだ種目がありません。<br />下のボタンから追加しましょう。</p>
          </div>
        )}
        {loading && logs.length === 0 && (
          <div className="rounded-2xl p-6 text-center" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <p style={{ color: C.lo, fontSize: 12 }}>読み込み中…</p>
          </div>
        )}
      </div>

      <button onClick={() => setAdding(true)}
        className="w-full rounded-xl flex items-center justify-center gap-2 mt-3"
        style={{ minHeight: 56, background: C.tactical, color: C.accent, fontWeight: 800, fontSize: 16, border: `1px solid ${C.border}` }}>
        <Plus size={20} /> 種目を追加
      </button>

      {adding && (
        <AddExerciseSheet
          library={library} todayNames={todayNames}
          onPick={addToday} onAddCustom={addCustom} onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

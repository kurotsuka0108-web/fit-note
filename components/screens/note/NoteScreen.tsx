"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Link2, Plus, Unlink, X } from "lucide-react";
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

// 描画用ブロック: 単独種目 or スーパーセット（出現順にクラスタリング）
type Block =
  | { kind: "single"; log: WorkoutLog; num: number }
  | { kind: "group"; groupId: string; label: string; items: { log: WorkoutLog; num: number }[] };

// ログ配列を、groupId が初出した位置にグループを束ねたブロック列へ変換する。
// カード番号(num)は画面の見た目の並び順に振り直す。
function toBlocks(logs: WorkoutLog[]): Block[] {
  const blocks: Block[] = [];
  const byGroup = new Map<string, Extract<Block, { kind: "group" }>>();
  let num = 0;
  let letter = 0;
  for (const log of logs) {
    num += 1;
    if (log.groupId) {
      let b = byGroup.get(log.groupId);
      if (!b) {
        b = { kind: "group", groupId: log.groupId, label: String.fromCharCode(65 + letter++), items: [] };
        byGroup.set(log.groupId, b);
        blocks.push(b);
      }
      b.items.push({ log, num });
    } else {
      blocks.push({ kind: "single", log, num });
    }
  }
  return blocks;
}

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
  const [selecting, setSelecting] = useState(false); // スーパーセット選択モード
  const [picked, setPicked] = useState<string[]>([]); // 選択中の種目ID
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
  // 1種目分のセット記録（ドロップ連鎖を連結して保存し、ローカル状態を更新）。
  const recordSet = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    // 連鎖 = これまでのドロップ段 + 現在入力中の値（最終段）。先頭がトップセット。
    const stages = [...d.drops, { weight: d.weight, reps: d.reps }];
    const [top, ...rest] = stages;
    const set = await repo.addSet(id, { weight: top.weight, reps: top.reps, bodyweight: d.bodyweight, drops: rest });
    setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, sets: [...l.sets, set] } : l)));
    // 連鎖はリセット（重量・レップ・自重は次セットへ継続）
    setDrafts((p) => ({ ...p, [id]: { ...p[id], drops: [] } }));
  };

  const completeSet = async (id: string) => {
    try {
      await recordSet(id);
    } catch (e) {
      fail(e);
    }
  };

  // スーパーセットのまとめて記録: グループ内の全種目を現在の入力値で1セットずつ記録（1ラウンド）。
  const completeGroup = async (groupId: string) => {
    try {
      for (const m of logs.filter((l) => l.groupId === groupId)) await recordSet(m.id);
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
    const removed = logs.find((l) => l.id === id);
    try {
      await repo.removeLog(id);
      let next = logs.filter((l) => l.id !== id);
      // グループのメンバーが1つだけになったらスーパーセットを解散する
      if (removed?.groupId) {
        const left = next.filter((l) => l.groupId === removed.groupId);
        if (left.length < 2) {
          await repo.ungroup(removed.groupId);
          next = next.map((l) => (l.groupId === removed.groupId ? { ...l, groupId: null } : l));
        }
      }
      setLogs(next);
      setDrafts((p) => { const n = { ...p }; delete n[id]; return n; });
      setLasts((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch (e) {
      fail(e);
    }
  };

  /* ── スーパーセット（種目のグループ化） ── */
  const startSelecting = () => { setPicked([]); setSelecting(true); };
  const cancelSelecting = () => { setSelecting(false); setPicked([]); };
  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // 選択中の種目を1つのスーパーセットにまとめる（2種目以上で確定）
  const confirmGroup = async () => {
    if (picked.length < 2) return;
    const ids = picked;
    setSelecting(false);
    setPicked([]);
    try {
      const groupId = await repo.createGroup(ids);
      setLogs((ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, groupId } : l)));
    } catch (e) {
      fail(e);
    }
  };

  const dissolveGroup = async (groupId: string) => {
    try {
      await repo.ungroup(groupId);
      setLogs((ls) => ls.map((l) => (l.groupId === groupId ? { ...l, groupId: null } : l)));
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
  const blocks = toBlocks(logs);

  // 1種目分のカード（単独・グループ内で共通）
  const renderCard = (l: WorkoutLog, num: number) => {
    const card = (
      <ExerciseCard
        index={num} log={l}
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
    );
    if (!selecting) return <div key={l.id}>{card}</div>;

    // 選択モード: カード全体を覆うオーバーレイでタップ選択。グループ済みは選択不可。
    const canSelect = !l.groupId;
    const sel = picked.includes(l.id);
    return (
      <div key={l.id} style={{ position: "relative" }}>
        {card}
        <button
          onClick={() => canSelect && togglePick(l.id)}
          aria-label={canSelect ? `${l.name}を選択` : `${l.name}はグループ済み`}
          aria-pressed={sel}
          style={{
            position: "absolute", inset: 0, borderRadius: 16,
            display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 10,
            cursor: canSelect ? "pointer" : "not-allowed",
            background: sel ? "rgba(234,179,8,.16)" : canSelect ? "transparent" : "rgba(5,7,12,.55)",
            border: `2px solid ${sel ? C.accent : "transparent"}`,
          }}>
          {canSelect ? (
            <span className="rounded-full flex items-center justify-center"
              style={{
                width: 28, height: 28, flexShrink: 0,
                background: sel ? C.accent : C.surface,
                border: `2px solid ${sel ? C.accent : C.border}`,
              }}>
              {sel && <Check size={18} color={ON_GOLD} />}
            </span>
          ) : (
            <span className="rounded px-1.5 py-0.5" style={{ background: C.surface, color: C.lo, fontSize: 10, fontWeight: 800 }}>グループ済み</span>
          )}
        </button>
      </div>
    );
  };

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

      {/* スーパーセット操作（リスト上部）。種目が2つ以上で表示。 */}
      {logs.length >= 2 && !selecting && (
        <button onClick={startSelecting}
          className="w-full rounded-xl flex items-center justify-center gap-2 mb-3"
          style={{ minHeight: 48, background: "transparent", color: C.mid, fontWeight: 700, fontSize: 14, border: `1px dashed ${C.border}` }}>
          <Link2 size={18} /> スーパーセットを組む
        </button>
      )}
      {selecting && (
        <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2"
          style={{ background: "rgba(234,179,8,.10)", border: `1px solid ${C.accent}` }}>
          <span style={{ color: C.hi, fontSize: 12, fontWeight: 700 }}>
            束ねる種目をタップ <span style={{ color: C.accent, fontWeight: 800 }}>（{picked.length}）</span>
          </span>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <button onClick={cancelSelecting} className="rounded-lg px-3 flex items-center gap-1"
              style={{ minHeight: 36, background: C.tactical, color: C.mid, fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}` }}>
              <X size={14} /> キャンセル
            </button>
            <button onClick={confirmGroup} disabled={picked.length < 2}
              className="rounded-lg px-3 flex items-center gap-1"
              style={{
                minHeight: 36, fontSize: 12, fontWeight: 800,
                background: picked.length >= 2 ? C.accent : C.tactical,
                color: picked.length >= 2 ? ON_GOLD : C.lo,
                border: picked.length >= 2 ? "none" : `1px solid ${C.border}`,
              }}>
              <Link2 size={14} /> グループ化
            </button>
          </div>
        </div>
      )}

      {err && (
        <p className="mb-3 rounded-md px-2 py-1 text-center" style={{ color: "#fb7185", fontSize: 11, background: "rgba(251,113,133,.10)" }}>
          {err}
        </p>
      )}

      <div className="space-y-3">
        {blocks.map((b) =>
          b.kind === "single" ? (
            renderCard(b.log, b.num)
          ) : (
            <div key={b.groupId} className="rounded-2xl p-2"
              style={{ background: "rgba(234,179,8,.06)", border: `1px solid ${C.accent}` }}>
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <span className="flex items-center gap-1.5" style={{ color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
                  <Link2 size={14} /> SUPERSET {b.label} · {b.items.length}種目
                </span>
                {!selecting && (
                  <button onClick={() => dissolveGroup(b.groupId)} className="flex items-center gap-1" style={{ color: C.lo, fontSize: 11, fontWeight: 700 }}>
                    <Unlink size={13} /> 解除
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {b.items.map((it) => renderCard(it.log, it.num))}
              </div>
              {/* スーパーセットを1ラウンド = 全種目を現在値でまとめて記録 */}
              {!selecting && (
                <button onClick={() => completeGroup(b.groupId)}
                  className="w-full rounded-xl flex items-center justify-center gap-2 mt-2"
                  style={{ minHeight: 52, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 15 }}>
                  <Check size={18} /> まとめてセット完了（{b.items.length}種目）
                </button>
              )}
            </div>
          ),
        )}
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

      {/* 選択モード中は種目追加を隠す（タップ選択に集中させる） */}
      {!selecting && (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-xl flex items-center justify-center gap-2 mt-3"
          style={{ minHeight: 56, background: C.tactical, color: C.accent, fontWeight: 800, fontSize: 16, border: `1px solid ${C.border}` }}>
          <Plus size={20} /> 種目を追加
        </button>
      )}

      {adding && (
        <AddExerciseSheet
          library={library} todayNames={todayNames}
          onPick={addToday} onAddCustom={addCustom} onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

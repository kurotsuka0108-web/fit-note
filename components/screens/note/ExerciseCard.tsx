"use client";

import { Fragment, useEffect, useRef } from "react";
import { Check, ChevronsDown, Trash2, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import type { LastSession, WorkoutLog } from "@/lib/db";
import { Counter } from "./Counter";

// 重量の表示テキスト（自重 / 自重+Xkg / Xkg）
const wText = (w: number, bw: boolean) => (bw ? (w === 0 ? "自重" : `自重+${w}kg`) : `${w}kg`);

/* 種目カード（仕様 §3.2）。横並びセット・Tactical Counter・前回プリセットを内包。 */
export function ExerciseCard({
  index, log, draftWeight, draftReps, bodyweight, drops, last,
  onStepW, onSetW, onStepR, onSetR, onToggleBW, onAddDrop, onClearDrops,
  onComplete, onRemoveSet, onPreset, onRemove,
}: {
  index: number;
  log: WorkoutLog;
  draftWeight: number;
  draftReps: number;
  bodyweight: boolean;
  drops: { weight: number; reps: number }[];
  last: LastSession;
  onStepW: (dir: 1 | -1) => void;
  onSetW: (v: number) => void;
  onStepR: (dir: 1 | -1) => void;
  onSetR: (v: number) => void;
  onToggleBW: () => void;
  onAddDrop: () => void;
  onClearDrops: () => void;
  onComplete: () => void;
  onRemoveSet: (setId: string) => void;
  onPreset: () => void;
  onRemove: () => void;
}) {
  const C = useC();
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextSet = log.sets.length + 1;

  // セット完了時、横スクロールを末尾（最新セット）まで移動
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [log.sets.length]);

  return (
    <div className="rounded-2xl p-4" style={{ background: C.surface, borderLeft: `3px solid ${C.accent}`, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="rounded px-1.5 py-0.5" style={{ background: C.tactical, color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{log.part}</span>
          <h3 style={{ color: C.hi, fontSize: 18, fontWeight: 800, marginTop: 5 }}>{index}. {log.name}</h3>
        </div>
        <button onClick={onRemove} className="flex items-center gap-1" style={{ color: C.lo, fontSize: 12 }}>
          <Trash2 size={13} /> 削除
        </button>
      </div>

      {last && (
        <>
          <p style={{ color: C.mid, fontSize: 12 }} className="mb-1">
            前回実績: {last.bw ? (last.w === 0 ? "自重" : `自重+${last.w}kg`) : `${last.w}kg`} × {last.r}reps × {last.s}sets
          </p>
          <button onClick={onPreset} className="mb-3 rounded-md px-2 py-1"
            style={{ color: C.accent, fontSize: 11, fontWeight: 700, background: "rgba(234,179,8,.10)" }}>
            ↺ 前回と同じ値をプリセット
          </button>
        </>
      )}

      {/* 記録済みセット（横並び・完了でスライドイン） */}
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>SETS</p>
        <span style={{ color: C.lo, fontSize: 11 }}>{log.sets.length}セット完了</span>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto fn-scroll pb-1 mb-4" style={{ scrollBehavior: "smooth" }}>
        {log.sets.length === 0 && (
          <div className="rounded-xl px-3 flex items-center" style={{ minHeight: 56, border: `1px dashed ${C.border}`, color: C.lo, fontSize: 11 }}>
            セットを記録するとここに横並びで追加されます
          </div>
        )}
        {log.sets.map((s, i) => {
          const stages = [{ weight: s.weight, reps: s.reps }, ...s.drops];
          return (
            <div key={s.id} className="fn-set-in flex-shrink-0 rounded-xl px-3 flex items-center gap-2"
              style={{ minHeight: 56, minWidth: 104, background: C.tactical, border: `1px solid ${C.border}` }}>
              <div>
                <p style={{ color: C.lo, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>
                  SET {i + 1}
                  {s.drops.length > 0 && <span style={{ color: C.accent }}> · DROP</span>}
                </p>
                <p style={{ color: C.hi, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {stages.map((st, idx) => (
                    <Fragment key={idx}>
                      {idx > 0 && <span style={{ color: C.mid, margin: "0 3px" }}>⤵</span>}
                      {wText(st.weight, s.bodyweight)}<span style={{ color: C.mid, fontSize: 11, fontWeight: 600 }}>×{st.reps}</span>
                    </Fragment>
                  ))}
                </p>
              </div>
              <button onClick={() => onRemoveSet(s.id)} aria-label="セット削除" style={{ color: C.lo, marginLeft: "auto" }}>
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 記録中（次セット）の入力 */}
      <div className="flex items-center justify-between mb-1 ml-1">
        <p style={{ color: C.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>SET {nextSet} を記録中</p>
        <span style={{ color: C.lo, fontSize: 9 }}>数字をタップで直接入力</span>
      </div>
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1 ml-1">
            <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>WEIGHT</p>
            <button onClick={onToggleBW} aria-pressed={bodyweight}
              className="rounded-full px-2.5"
              style={{
                minHeight: 32, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                background: bodyweight ? C.accent : C.tactical,
                color: bodyweight ? ON_GOLD : C.mid,
                border: bodyweight ? "none" : `1px solid ${C.border}`,
              }}>
              自重 {bodyweight ? "ON" : "OFF"}
            </button>
          </div>
          <Counter value={draftWeight} unit="kg" onStep={onStepW} onSet={onSetW} bodyweight={bodyweight} />
        </div>
        <div>
          <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }} className="mb-1 ml-1">REPS</p>
          <Counter value={draftReps} unit="reps" onStep={onStepR} onSet={onSetR} />
        </div>
      </div>

      {/* ドロップ連鎖の途中プレビュー */}
      {drops.length > 0 && (
        <div className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2"
          style={{ background: "rgba(234,179,8,.10)", border: `1px solid ${C.border}` }}>
          <span style={{ color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: 1, flexShrink: 0 }}>DROP</span>
          <span style={{ color: C.hi, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflowX: "auto" }} className="fn-scroll">
            {drops.map((d, i) => (
              <Fragment key={i}>
                {i > 0 && <span style={{ color: C.mid, margin: "0 3px" }}>⤵</span>}
                {wText(d.weight, bodyweight)}×{d.reps}
              </Fragment>
            ))}
            <span style={{ color: C.mid, margin: "0 3px" }}>⤵</span>
            <span style={{ color: C.mid }}>入力中 {wText(draftWeight, bodyweight)}×{draftReps}</span>
          </span>
          <button onClick={onClearDrops} aria-label="ドロップをクリア" style={{ color: C.lo, marginLeft: "auto", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onAddDrop}
          className="rounded-xl flex items-center justify-center gap-1 px-3"
          style={{ minHeight: 56, background: C.tactical, color: C.accent, fontWeight: 800, fontSize: 14, border: `1px solid ${C.border}`, flexShrink: 0 }}>
          <ChevronsDown size={18} /> ドロップ
        </button>
        <button onClick={onComplete}
          className="flex-1 rounded-xl flex items-center justify-center gap-2"
          style={{ minHeight: 56, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          <Check size={18} /> SET {nextSet} 完了{drops.length > 0 ? `（${drops.length + 1}段）` : ""}
        </button>
      </div>
    </div>
  );
}

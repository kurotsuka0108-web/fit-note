"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import type { NewSet, Unit } from "@/lib/db";
import { Counter } from "./Counter";
import { FramePortal } from "./FramePortal";

type Stage = { weight: number; reps: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/* セットの編集／作成パネル。
   - 完了セットのチップタップ → 編集（既存セットを上書き）
   - 「ドロップ」ボタン → 新規ドロップセットの作成
   トップセット + 各ドロップ段の重量・レップ・自重を編集し、段の追加/削除もできる。 */
export function SetEditor({
  title, unit, initialBodyweight, initialStages, onSave, onClose,
}: {
  title: string;
  unit: Unit;
  initialBodyweight: boolean;
  initialStages: Stage[];
  onSave: (patch: NewSet) => void;
  onClose: () => void;
}) {
  const C = useC();
  const [bodyweight, setBodyweight] = useState(initialBodyweight);
  const [stages, setStages] = useState<Stage[]>(initialStages);

  const patch = (i: number, p: Partial<Stage>) =>
    setStages((arr) => arr.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const stepW = (i: number, dir: 1 | -1) =>
    patch(i, { weight: Math.max(0, round1(stages[i].weight + dir * 2.5)) });
  const stepR = (i: number, dir: 1 | -1) =>
    patch(i, { reps: Math.max(0, stages[i].reps + dir * (unit === "sec" ? 5 : 1)) });
  const addStage = () =>
    setStages((arr) => [...arr, { weight: arr[arr.length - 1]?.weight ?? 0, reps: 0 }]);
  const removeStage = (i: number) => setStages((arr) => arr.filter((_, j) => j !== i));

  const save = () => {
    if (stages.length === 0) return;
    const [top, ...rest] = stages;
    onSave({ weight: top.weight, reps: top.reps, bodyweight, drops: rest });
  };

  return (
    <FramePortal>
      <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 40 }} onClick={onClose}>
        <div className="w-full rounded-t-3xl flex flex-col"
          style={{ background: C.bg, border: `1px solid ${C.border}`, maxHeight: "92%" }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ flexShrink: 0 }}>
            <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>{title}</h3>
            <button onClick={onClose} style={{ color: C.mid }}><X size={20} /></button>
          </div>

          <div className="px-5" style={{ flexShrink: 0 }}>
            <button onClick={() => setBodyweight((b) => !b)} aria-pressed={bodyweight}
              className="rounded-full px-3 mb-2"
              style={{
                minHeight: 34, fontSize: 12, fontWeight: 800,
                background: bodyweight ? C.accent : C.tactical,
                color: bodyweight ? ON_GOLD : C.mid,
                border: bodyweight ? "none" : `1px solid ${C.border}`,
              }}>
              自重 {bodyweight ? "ON" : "OFF"}
            </button>
          </div>

          <div className="overflow-y-auto px-5 fn-scroll" style={{ flex: 1 }}>
            {stages.map((s, i) => (
              <div key={i} className="rounded-2xl p-3 mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: i === 0 ? C.hi : C.accent, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
                    {i === 0 ? "トップセット" : `ドロップ ${i}`}
                  </span>
                  {i > 0 && (
                    <button onClick={() => removeStage(i)} className="flex items-center gap-1" style={{ color: C.lo, fontSize: 11, fontWeight: 700 }}>
                      <Trash2 size={13} /> 段を削除
                    </button>
                  )}
                </div>
                <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }} className="mb-1 ml-1">WEIGHT</p>
                <div className="mb-2">
                  <Counter value={s.weight} unit="kg" bodyweight={bodyweight}
                    onStep={(d) => stepW(i, d)} onSet={(v) => patch(i, { weight: round1(Math.max(0, v)) })} />
                </div>
                <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }} className="mb-1 ml-1">{unit === "sec" ? "TIME（秒）" : "REPS"}</p>
                <Counter value={s.reps} unit={unit === "sec" ? "秒" : "reps"}
                  onStep={(d) => stepR(i, d)} onSet={(v) => patch(i, { reps: Math.max(0, Math.round(v)) })} />
              </div>
            ))}
            <button onClick={addStage}
              className="w-full rounded-xl flex items-center justify-center gap-2 mb-3"
              style={{ minHeight: 48, background: "transparent", color: C.accent, fontWeight: 800, fontSize: 14, border: `1px dashed ${C.accent}` }}>
              <Plus size={18} /> ドロップ段を追加
            </button>
          </div>

          <div className="p-4 flex gap-2" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
            <button onClick={onClose} className="rounded-xl px-4"
              style={{ minHeight: 52, background: C.tactical, color: C.mid, fontWeight: 700, fontSize: 15 }}>キャンセル</button>
            <button onClick={save}
              className="flex-1 rounded-xl flex items-center justify-center gap-2"
              style={{ minHeight: 52, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 15 }}>
              <Check size={18} /> 保存
            </button>
          </div>
        </div>
      </div>
    </FramePortal>
  );
}

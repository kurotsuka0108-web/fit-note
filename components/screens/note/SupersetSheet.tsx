"use client";

import { useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import type { WorkoutLog } from "@/lib/db";

/* スーパーセット作成シート。当日の種目から2つ以上を選んで束ねる（仕様: ドロップセットと同思想）。
   既にグループ済みの種目は対象外（先に解除してから組み直す）。 */
export function SupersetSheet({
  logs, onConfirm, onClose,
}: {
  logs: WorkoutLog[];
  onConfirm: (logIds: string[]) => void;
  onClose: () => void;
}) {
  const C = useC();
  const [picked, setPicked] = useState<string[]>([]);

  const selectable = logs.filter((l) => !l.groupId);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ready = picked.length >= 2;
  const submit = () => {
    if (ready) onConfirm(picked);
  };

  return (
    <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 30 }} onClick={onClose}>
      <div className="w-full rounded-t-3xl flex flex-col"
        style={{ background: C.bg, border: `1px solid ${C.border}`, maxHeight: "82%" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-1" style={{ flexShrink: 0 }}>
          <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>スーパーセットを作成</h3>
          <button onClick={onClose} style={{ color: C.mid }}><X size={20} /></button>
        </div>
        <p className="px-5 pb-3" style={{ color: C.lo, fontSize: 11, lineHeight: 1.6, flexShrink: 0 }}>
          交互に実施する種目を<b style={{ color: C.mid }}>2つ以上</b>選んでください。記録は種目ごとに行います。
        </p>

        <div className="overflow-y-auto px-5 fn-scroll" style={{ flex: 1 }}>
          {selectable.length === 0 ? (
            <div className="rounded-xl p-5 text-center mb-2" style={{ border: `1px dashed ${C.border}`, color: C.lo, fontSize: 12, lineHeight: 1.7 }}>
              束ねられる種目がありません。<br />先に種目を2つ以上追加してください。
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {selectable.map((l) => {
                const on = picked.includes(l.id);
                const seq = on ? picked.indexOf(l.id) + 1 : 0;
                return (
                  <button key={l.id} onClick={() => toggle(l.id)}
                    className="w-full rounded-xl px-3 flex items-center gap-3"
                    style={{
                      minHeight: 56, background: on ? "rgba(234,179,8,.10)" : C.tactical,
                      border: `1px solid ${on ? C.accent : C.border}`, textAlign: "left",
                    }}>
                    <span className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 26, height: 26, fontSize: 12, fontWeight: 800,
                        background: on ? C.accent : "transparent",
                        color: on ? ON_GOLD : C.lo,
                        border: on ? "none" : `1px solid ${C.border}`,
                      }}>
                      {on ? seq : ""}
                    </span>
                    <span className="flex-1" style={{ minWidth: 0 }}>
                      <span style={{ color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{l.part}</span>
                      <span style={{ color: C.hi, fontSize: 15, fontWeight: 700, display: "block" }}>{l.name}</span>
                    </span>
                    {on && <Check size={18} color={C.accent} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
          <button onClick={submit} disabled={!ready}
            className="w-full rounded-xl flex items-center justify-center gap-2"
            style={{
              minHeight: 56, fontWeight: 800, fontSize: 16,
              background: ready ? C.accent : C.tactical,
              color: ready ? ON_GOLD : C.mid,
              border: ready ? "none" : `1px solid ${C.border}`,
            }}>
            <Link2 size={18} /> {picked.length >= 2 ? `${picked.length}種目をグループ化` : "2種目以上を選択"}
          </button>
        </div>
      </div>
    </div>
  );
}

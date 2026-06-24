"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { useC } from "@/lib/use-tokens";

/* インターバル秒の編集（±10 と数字タップ直接入力）。0=タイマー無し。
   種目カード・スーパーセット枠の両方で使う。 */
export function IntervalEditor({ value, onSet }: { value: number; onSet: (v: number) => void }) {
  const C = useC();
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState("");
  const commit = () => {
    const n = parseInt(tmp, 10);
    if (Number.isFinite(n)) onSet(Math.max(0, n));
    setEditing(false);
  };
  const step = (d: number) => onSet(Math.max(0, value + d));
  return (
    <div className="flex items-center gap-2 mb-2 ml-1">
      <Timer size={14} style={{ color: C.lo }} />
      <span style={{ color: C.lo, fontSize: 11, fontWeight: 700 }}>休憩</span>
      <button onClick={() => step(-10)} aria-label="休憩-10秒"
        className="rounded-md" style={{ width: 26, height: 26, background: C.tactical, color: C.mid, border: `1px solid ${C.border}`, fontWeight: 800 }}>−</button>
      {editing ? (
        <input autoFocus type="number" inputMode="numeric" value={tmp}
          onChange={(e) => setTmp(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ width: 44, textAlign: "center", background: "transparent", color: C.accent, fontSize: 13, fontWeight: 800, outline: "none", borderBottom: `1px solid ${C.accent}` }} />
      ) : (
        <button onClick={() => { setTmp(String(value)); setEditing(true); }}
          style={{ color: value > 0 ? C.hi : C.lo, fontSize: 13, fontWeight: 800, borderBottom: `1px dashed ${C.lo}`, minWidth: 44, textAlign: "center" }}>
          {value > 0 ? `${value}秒` : "なし"}
        </button>
      )}
      <button onClick={() => step(10)} aria-label="休憩+10秒"
        className="rounded-md" style={{ width: 26, height: 26, background: C.tactical, color: C.mid, border: `1px solid ${C.border}`, fontWeight: 800 }}>＋</button>
    </div>
  );
}

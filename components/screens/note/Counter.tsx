"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { useHold } from "./useHold";

/**
 * Tactical Counter（仕様 §3.2）— 縦64pxの巨大タップターゲット。
 * −/+ は長押しで加速増減、中央の数字タップで直接入力モードに切替。
 */
export function Counter({
  value,
  unit,
  onStep,
  onSet,
  bodyweight,
}: {
  value: number;
  unit: string;
  onStep: (dir: 1 | -1) => void;
  onSet: (v: number) => void;
  // true のとき value を「加重量」として扱い、0=「自重」/ >0=「自重+Xkg」と表示する
  bodyweight?: boolean;
}) {
  const C = useC();
  const dec = useHold(() => onStep(-1));
  const inc = useHold(() => onStep(1));
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState("");

  const btn: React.CSSProperties = {
    width: 64, minHeight: 64,
    color: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", cursor: "pointer", flexShrink: 0,
  };

  const startEdit = () => { setTmp(String(value)); setEditing(true); };
  const commit = () => {
    const n = parseFloat(tmp);
    if (Number.isFinite(n)) onSet(Math.max(0, n));
    setEditing(false);
  };

  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden"
      style={{ background: C.tactical, border: `1px solid ${C.border}` }}>
      <button aria-label="減らす" {...dec} style={btn}><Minus size={26} /></button>
      <div className="flex-1 flex flex-col items-center justify-center py-2 leading-none">
        {editing ? (
          <input
            autoFocus type="number" inputMode="decimal" value={tmp}
            onChange={(e) => setTmp(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-full text-center"
            style={{ background: "transparent", color: C.accent, fontSize: 30, fontWeight: 800, outline: "none", fontVariantNumeric: "tabular-nums" }}
          />
        ) : (
          <button onClick={startEdit} aria-label={`${unit}を直接入力`} style={{ background: "transparent", cursor: "text" }}>
            {bodyweight ? (
              <span style={{ color: C.hi, fontSize: value === 0 ? 26 : 22, fontWeight: 800, borderBottom: `1px dashed ${C.lo}`, paddingBottom: 1 }}>
                {value === 0 ? (
                  "自重"
                ) : (
                  <>
                    自重+<span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
                    <span style={{ color: C.mid, fontSize: 13, fontWeight: 600, marginLeft: 2 }}>kg</span>
                  </>
                )}
              </span>
            ) : (
              <span style={{ color: C.hi, fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums", borderBottom: `1px dashed ${C.lo}`, paddingBottom: 1 }}>
                {value}
                <span style={{ color: C.mid, fontSize: 14, fontWeight: 600, marginLeft: 4 }}>{unit}</span>
              </span>
            )}
          </button>
        )}
      </div>
      <button aria-label="増やす" {...inc} style={btn}><Plus size={26} /></button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { BODY_PARTS, type Library } from "@/lib/db";

/* 種目追加シート（仕様 §3.2）。部位別テンプレ閲覧 / オリジナル種目追加の2モード。 */
export function AddExerciseSheet({
  library, todayNames, onPick, onAddCustom, onClose,
}: {
  library: Library;
  todayNames: string[];
  onPick: (name: string, part: string) => void;
  onAddCustom: (part: string, name: string) => void;
  onClose: () => void;
}) {
  const C = useC();
  const [mode, setMode] = useState<"browse" | "custom">("browse");
  const [part, setPart] = useState<string>(BODY_PARTS[0]);
  const [name, setName] = useState("");

  const submit = () => {
    const n = name.trim();
    if (n) onAddCustom(part, n);
  };

  return (
    <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 30 }} onClick={onClose}>
      <div className="w-full rounded-t-3xl flex flex-col"
        style={{
          background: C.bg, border: `1px solid ${C.border}`,
          // browse はボディいっぱい（テンプレ一覧を広く・ボタンを最下部固定）、custom は内容に応じた高さ
          ...(mode === "browse" ? { height: "94%", maxHeight: "94%" } : { maxHeight: "82%" }),
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ flexShrink: 0 }}>
          <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>{mode === "browse" ? "種目を追加" : "オリジナル種目"}</h3>
          <button onClick={onClose} style={{ color: C.mid }}><X size={20} /></button>
        </div>

        {mode === "browse" ? (
          <>
            <div className="overflow-y-auto px-5 fn-scroll" style={{ flex: 1 }}>
              {BODY_PARTS.map((bp) => (
                <div key={bp} className="mb-4">
                  <p style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1 }} className="mb-2">{bp}</p>
                  <div className="flex flex-wrap gap-2">
                    {(library[bp] || []).map((ex) => {
                      const added = todayNames.includes(ex);
                      return (
                        <button key={ex} onClick={() => onPick(ex, bp)}
                          className="rounded-full px-3 flex items-center gap-1"
                          style={{ minHeight: 40, background: C.tactical, color: C.hi, fontSize: 13, fontWeight: 600, border: `1px solid ${added ? C.accent : C.border}` }}>
                          {added && <Check size={13} color={C.accent} />}{ex}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setMode("custom")}
                className="w-full rounded-xl flex items-center justify-center gap-2"
                style={{ minHeight: 52, background: "transparent", color: C.accent, fontWeight: 800, fontSize: 15, border: `1px dashed ${C.accent}` }}>
                <Plus size={18} /> オリジナル種目を追加
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 pb-5" style={{ overflowY: "auto" }}>
            <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }} className="mb-2">部位</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {BODY_PARTS.map((bp) => {
                const on = bp === part;
                return (
                  <button key={bp} onClick={() => setPart(bp)} className="rounded-full px-4"
                    style={{ minHeight: 40, background: on ? C.accent : C.tactical, color: on ? ON_GOLD : C.mid, fontSize: 13, fontWeight: 700, border: on ? "none" : `1px solid ${C.border}` }}>
                    {bp}
                  </button>
                );
              })}
            </div>
            <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }} className="mb-2">種目名</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: インクラインダンベルカール"
              className="w-full rounded-xl px-3 mb-2"
              style={{ minHeight: 48, background: C.tactical, color: C.hi, fontSize: 15, border: `1px solid ${C.border}`, outline: "none" }} />
            <p style={{ color: C.lo, fontSize: 11 }} className="mb-4">
              追加すると<b style={{ color: C.mid }}>ライブラリに保存</b>され、次回から「{part}」のリストから選べます。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setMode("browse")} className="rounded-xl px-4"
                style={{ minHeight: 52, background: C.tactical, color: C.mid, fontWeight: 700, fontSize: 15 }}>戻る</button>
              <button onClick={submit} disabled={!name.trim()}
                className="flex-1 rounded-xl flex items-center justify-center gap-2"
                style={{ minHeight: 52, background: name.trim() ? C.accent : C.tactical, color: name.trim() ? ON_GOLD : C.mid, fontWeight: 800, fontSize: 15 }}>
                <Plus size={18} /> 追加して記録
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

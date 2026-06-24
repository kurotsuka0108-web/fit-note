"use client";

import { useState } from "react";
import { Check, Link2, Plus, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { BODY_PARTS, type Library } from "@/lib/db";
import { FramePortal } from "./FramePortal";

type Picked = { name: string; part: string };

/* 種目追加シート（仕様 §3.2）。部位別テンプレ閲覧 / オリジナル種目追加の2モード。
   さらに「スーパーセットを組む」をONにすると、テンプレから複数種目を選んで一括グループ追加できる。 */
export function AddExerciseSheet({
  library, todayNames, onPick, onAddCustom, onAddSuperset, onClose,
}: {
  library: Library;
  todayNames: string[];
  onPick: (name: string, part: string) => void;
  onAddCustom: (part: string, name: string) => void;
  onAddSuperset: (items: Picked[]) => void;
  onClose: () => void;
}) {
  const C = useC();
  const [mode, setMode] = useState<"browse" | "custom">("browse");
  const [part, setPart] = useState<string>(BODY_PARTS[0]);
  const [name, setName] = useState("");
  const [superMode, setSuperMode] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);

  const submit = () => {
    const n = name.trim();
    if (n) onAddCustom(part, n);
  };

  // スーパーセット選択
  const pickedIndex = (ex: string, p: string) => picked.findIndex((x) => x.name === ex && x.part === p);
  const togglePick = (ex: string, p: string) =>
    setPicked((arr) => {
      const i = arr.findIndex((x) => x.name === ex && x.part === p);
      return i >= 0 ? arr.filter((_, j) => j !== i) : [...arr, { name: ex, part: p }];
    });
  const exitSuper = () => { setSuperMode(false); setPicked([]); };
  const confirmSuper = () => { if (picked.length >= 2) onAddSuperset(picked); };

  return (
    <FramePortal>
    <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 30 }} onClick={onClose}>
      <div className="w-full rounded-t-3xl flex flex-col"
        style={{
          background: C.bg, border: `1px solid ${C.border}`,
          // browse はボディいっぱい（テンプレ一覧を広く・ボタンを最下部固定）、custom は内容に応じた高さ
          ...(mode === "browse" ? { height: "94%", maxHeight: "94%" } : { maxHeight: "82%" }),
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ flexShrink: 0 }}>
          <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>
            {mode === "custom" ? "オリジナル種目" : superMode ? "スーパーセットの種目を選択" : "種目を追加"}
          </h3>
          <button onClick={onClose} style={{ color: C.mid }}><X size={20} /></button>
        </div>

        {mode === "browse" ? (
          <>
            {/* スーパーセット操作（リスト上部） */}
            <div className="px-5 pb-3" style={{ flexShrink: 0 }}>
              {!superMode ? (
                <button onClick={() => setSuperMode(true)}
                  className="w-full rounded-xl flex items-center justify-center gap-2"
                  style={{ minHeight: 44, background: "transparent", color: C.accent, fontWeight: 800, fontSize: 14, border: `1px dashed ${C.accent}` }}>
                  <Link2 size={18} /> スーパーセットを組む
                </button>
              ) : (
                <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                  style={{ background: "rgba(234,179,8,.10)", border: `1px solid ${C.accent}` }}>
                  <span style={{ color: C.hi, fontSize: 12, fontWeight: 700 }}>
                    種目をタップして選択 <span style={{ color: C.accent, fontWeight: 800 }}>（{picked.length}）</span>
                  </span>
                  <button onClick={exitSuper} className="rounded-lg px-3 flex items-center gap-1"
                    style={{ minHeight: 34, background: C.tactical, color: C.mid, fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}` }}>
                    <X size={14} /> やめる
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-y-auto px-5 fn-scroll" style={{ flex: 1 }}>
              {BODY_PARTS.map((bp) => (
                <div key={bp} className="mb-4">
                  <p style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1 }} className="mb-2">{bp}</p>
                  <div className="flex flex-wrap gap-2">
                    {(library[bp] || []).map((ex) => {
                      if (superMode) {
                        const idx = pickedIndex(ex, bp);
                        const on = idx >= 0;
                        return (
                          <button key={ex} onClick={() => togglePick(ex, bp)}
                            className="rounded-full px-3 flex items-center gap-1"
                            style={{ minHeight: 40, background: on ? C.accent : C.tactical, color: on ? ON_GOLD : C.hi, fontSize: 13, fontWeight: on ? 800 : 600, border: `1px solid ${on ? C.accent : C.border}` }}>
                            {on && <span style={{ fontWeight: 800 }}>{idx + 1}.</span>}{ex}
                          </button>
                        );
                      }
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
              {superMode ? (
                <button onClick={confirmSuper} disabled={picked.length < 2}
                  className="w-full rounded-xl flex items-center justify-center gap-2"
                  style={{
                    minHeight: 52, fontWeight: 800, fontSize: 15,
                    background: picked.length >= 2 ? C.accent : C.tactical,
                    color: picked.length >= 2 ? ON_GOLD : C.lo,
                    border: picked.length >= 2 ? "none" : `1px solid ${C.border}`,
                  }}>
                  <Link2 size={18} /> {picked.length >= 2 ? `${picked.length}種目でスーパーセット作成` : "2種目以上を選択"}
                </button>
              ) : (
                <button onClick={() => setMode("custom")}
                  className="w-full rounded-xl flex items-center justify-center gap-2"
                  style={{ minHeight: 52, background: "transparent", color: C.accent, fontWeight: 800, fontSize: 15, border: `1px dashed ${C.accent}` }}>
                  <Plus size={18} /> オリジナル種目を追加
                </button>
              )}
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
    </FramePortal>
  );
}

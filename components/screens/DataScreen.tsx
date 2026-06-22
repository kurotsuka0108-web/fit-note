"use client";

import { Lock } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";

/* 画面③: DATA（プレミアム解放ティザー）— 仕様 §3.4。静的表示。 */
export function DataScreen() {
  const C = useC();
  return (
    <div className="px-5 pt-3 flex flex-col items-center justify-center" style={{ minHeight: 380 }}>
      <div className="rounded-full flex items-center justify-center mb-4"
        style={{ width: 64, height: 64, background: C.surface, border: `1px solid ${C.border}` }}>
        <Lock size={26} color={C.accent} />
      </div>
      <h3 style={{ color: C.hi, fontSize: 18, fontWeight: 800 }} className="mb-2">重量推移グラフ</h3>
      <p style={{ color: C.mid, fontSize: 13, textAlign: "center", lineHeight: 1.6 }} className="mb-5">
        過去の筋トレ重量の自動グラフ化は<br />プレミアムプランで解放されます。
      </p>
      <button className="rounded-xl px-6" style={{ minHeight: 48, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 14 }}>
        プレミアムにする（¥580/月）
      </button>
    </div>
  );
}

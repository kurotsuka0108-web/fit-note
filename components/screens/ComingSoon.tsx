"use client";

import { useC } from "@/lib/use-tokens";

/** フェーズ0スケルトン用のプレースホルダ（NOTE/SHOKUJI は後続フェーズで実装）。 */
export function ComingSoon({ title, note }: { title: string; note: string }) {
  const C = useC();
  return (
    <div className="px-5 pt-3 flex flex-col items-center justify-center" style={{ minHeight: 380 }}>
      <h3 style={{ color: C.hi, fontSize: 18, fontWeight: 800 }} className="mb-2">{title}</h3>
      <p style={{ color: C.mid, fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>{note}</p>
    </div>
  );
}

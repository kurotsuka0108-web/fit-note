"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 子要素を端末フレーム(#fn-frame)直下へ portal する。
 * オーバーレイ(absolute inset-0)をスクロールするボディの外側に置くことで、
 * ページのスクロール位置に関係なく常にビューポート全体を覆えるようにする。
 */
export function FramePortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById("fn-frame"));
  }, []);
  if (!host) return null;
  return createPortal(children, host);
}

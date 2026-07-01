"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

let cachedHost: HTMLElement | null = null;

function getHost(): HTMLElement | null {
  if (!cachedHost || !document.contains(cachedHost)) {
    cachedHost = document.getElementById("fn-frame");
  }
  return cachedHost;
}

// #fn-frame は AppShell がマウント時に描画する端末フレーム。まだ DOM に反映されて
// いない最初のコミット直後だけ MutationObserver で出現を待ち、見つかったら購読解除する。
function subscribe(onChange: () => void): () => void {
  if (getHost()) return () => {};
  const observer = new MutationObserver(() => {
    if (getHost()) {
      onChange();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

const getServerSnapshot = () => null;

/**
 * 子要素を端末フレーム(#fn-frame)直下へ portal する。
 * オーバーレイ(absolute inset-0)をスクロールするボディの外側に置くことで、
 * ページのスクロール位置に関係なく常にビューポート全体を覆えるようにする。
 */
export function FramePortal({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribe, getHost, getServerSnapshot);
  if (!host) return null;
  return createPortal(children, host);
}

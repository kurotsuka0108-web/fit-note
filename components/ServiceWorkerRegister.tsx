"use client";

import { useEffect } from "react";

/**
 * Service Worker 登録（フェーズ4-B: オフライン対応）。
 * 本番ビルドのみ登録する。dev（Turbopack + HMR）でキャッシュSWを動かすと
 * 更新が stale になりリロード不整合を招くため、開発時は登録しない。
 * 既存の登録があれば dev では解除しておく（過去に本番を見た端末対策）。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // 開発時は登録解除（キャッシュ由来の不具合を防ぐ）
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("SW registration failed:", err));
    };
    // すでに load 済みなら即登録（useEffect 時点で load が終わっていることが多い）
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

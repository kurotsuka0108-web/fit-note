"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * SSR / 初回クライアントレンダーは false、マウント後は true を返す。
 * ハイドレーション不整合を避けるための定番パターンを useSyncExternalStore で実装したもの
 * （setState をエフェクト内で直接呼ぶ旧パターンの代替）。
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

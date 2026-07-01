"use client";

import { useTheme } from "next-themes";
import { THEMES, type Tokens } from "@/lib/theme";
import { useHasMounted } from "@/lib/use-mounted";

/**
 * 現在のテーマのデザイントークンを返すフック。
 *
 * プロトタイプの `useC()` を next-themes 駆動に置き換えたもの。
 * SSR と初回クライアントレンダーは必ず dark を返し（= 一致するのでハイドレーション不整合なし）、
 * マウント後に実際の解決済みテーマへ更新する。テーマ自体のチラつきは
 * next-themes が <html> の class を先行注入することで防ぐ。
 */
export function useC(): Tokens {
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  return THEMES[mounted && resolvedTheme === "light" ? "light" : "dark"];
}

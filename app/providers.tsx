"use client";

import { ThemeProvider } from "next-themes";

/**
 * アプリ全体のクライアントプロバイダ。
 * テーマは next-themes に委譲（OS設定同期・FOUC対策。仕様 §2）。
 * attribute="class" で <html> に "dark"/"light" を付与し、globals.css の
 * CSS変数（--fn-page 等）を切り替える。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      themes={["dark", "light"]}
    >
      {children}
    </ThemeProvider>
  );
}

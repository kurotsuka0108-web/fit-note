"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

/**
 * アプリ全体のクライアントプロバイダ。
 * テーマは next-themes に委譲（OS設定同期・FOUC対策。仕様 §2）。
 * attribute="class" で <html> に "dark"/"light" を付与し、globals.css の
 * CSS変数（--fn-page 等）を切り替える。
 * 認証状態（フェーズ2）は AuthProvider が供給する。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      themes={["dark", "light"]}
    >
      <AuthProvider>{children}</AuthProvider>
      <ServiceWorkerRegister />
    </ThemeProvider>
  );
}

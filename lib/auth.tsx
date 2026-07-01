"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

// 認証状態の集約（仕様 §3 / フェーズ2）。
// Supabase 構成時はログイン必須。未構成（localStorage モード）は authed=true で素通し。

type Result = { error?: string };

type AuthValue = {
  ready: boolean; // 初期化（セッション復元）完了
  supabase: boolean; // Supabase 構成済みか
  authed: boolean; // アプリを利用可能か（local もしくはセッション有）
  email: string | null; // ログイン中のメール（ゲストは null）
  isAnonymous: boolean; // ゲスト（匿名）ログインか
  signInGuest: () => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthValue | null>(null);

// Supabase のエラー文を日本語の簡潔なメッセージへ。
function humanize(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "メールアドレスかパスワードが違います。";
  if (m.includes("already registered") || m.includes("already been registered")) return "このメールアドレスは登録済みです。ログインしてください。";
  if (m.includes("password should be at least")) return "パスワードは6文字以上にしてください。";
  if (m.includes("anonymous sign-ins are disabled")) return "ゲストログインが無効です（Supabaseで Anonymous sign-ins を有効化してください）。";
  if (m.includes("email logins are disabled") || m.includes("signups not allowed")) return "メール登録が無効です（Supabaseで Email を有効化してください）。";
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sb = useMemo(() => getBrowserSupabase(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(() => !sb); // local モードはログイン不要のため初期値から ready

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const signInGuest = useCallback(async (): Promise<Result> => {
    if (!sb) return {};
    const { error } = await sb.auth.signInAnonymously();
    return error ? { error: humanize(error.message) } : {};
  }, [sb]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!sb) return {};
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { error: humanize(error.message) } : {};
    },
    [sb],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!sb) return {};
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return { error: humanize(error.message) };
      // メール確認が有効な構成だとセッションがまだ張られない。
      if (!data.session) return { error: "確認メールを送信しました。メール内のリンクを開いてから、ログインしてください。" };
      return {};
    },
    [sb],
  );

  const signOut = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
  }, [sb]);

  const value: AuthValue = {
    ready,
    supabase: Boolean(sb),
    authed: !sb || Boolean(user),
    email: user?.email ?? null,
    isAnonymous: user?.is_anonymous ?? false,
    signInGuest,
    signIn,
    signUp,
    signOut,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth は AuthProvider の内側で使用してください");
  return ctx;
}

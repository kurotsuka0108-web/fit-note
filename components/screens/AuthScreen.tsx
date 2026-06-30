"use client";

import { useState } from "react";
import { LogIn, Mail, UserCircle2 } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

// ログイン画面（仕様 §3 / フェーズ2）。
// ・「ゲストとして始める」= 匿名サインイン（ワンクリック。採用担当が即操作開始できる導線）
// ・メール＋パスワードのログイン / 新規登録
export function AuthScreen() {
  const C = useC();
  const { signInGuest, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const run = async (fn: () => Promise<{ error?: string }>, infoOnEmpty?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await fn();
      if (error) setMsg({ kind: error.includes("確認メール") ? "info" : "error", text: error });
      else if (infoOnEmpty) setMsg({ kind: "info", text: infoOnEmpty });
    } finally {
      setBusy(false);
    }
  };

  const onGuest = () => run(signInGuest);
  const onEmail = () => {
    if (!email.trim() || !password) {
      setMsg({ kind: "error", text: "メールアドレスとパスワードを入力してください。" });
      return;
    }
    run(() => (mode === "signin" ? signIn(email.trim(), password) : signUp(email.trim(), password)));
  };

  const input = {
    minHeight: 48,
    background: C.tactical,
    color: C.hi,
    fontSize: 15,
    border: `1px solid ${C.border}`,
    outline: "none",
  } as const;

  return (
    <div className="px-6 pt-6 pb-8 flex flex-col" style={{ minHeight: "100%" }}>
      {/* ロゴ */}
      <div className="flex flex-col items-center mb-8 mt-4">
        <h1 style={{ color: C.hi, fontSize: 30, fontWeight: 900, letterSpacing: 0.5 }}>
          FIT<span style={{ color: C.accent }}>·</span>NOTE
        </h1>
        <p style={{ color: C.mid, fontSize: 12, marginTop: 6, letterSpacing: 1 }}>
          AI食事解析 × 筋トレノート
        </p>
      </div>

      {/* ゲスト（匿名）導線 */}
      <button
        onClick={onGuest}
        disabled={busy}
        className="w-full rounded-2xl flex items-center justify-center gap-2 mb-3"
        style={{ minHeight: 54, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16, opacity: busy ? 0.6 : 1 }}
      >
        <UserCircle2 size={18} /> ゲストとして始める
      </button>
      <p style={{ color: C.lo, fontSize: 11, textAlign: "center", marginBottom: 18 }}>
        登録なしで今すぐ試せます（データはこのゲストアカウントに保存）
      </p>

      {/* 区切り */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ color: C.lo, fontSize: 11 }}>または メールで</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* メール＋パスワード */}
      <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>メールアドレス</label>
      <input
        type="email"
        inputMode="email"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-xl px-3 mt-1 mb-3"
        style={input}
      />
      <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>パスワード</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="6文字以上"
        className="w-full rounded-xl px-3 mt-1 mb-4"
        style={input}
      />

      {msg && (
        <p
          className="mb-3 rounded-md px-3 py-2"
          style={{
            fontSize: 12,
            color: msg.kind === "error" ? "#fb7185" : C.accent,
            background: msg.kind === "error" ? "rgba(251,113,133,.10)" : "rgba(234,179,8,.10)",
          }}
        >
          {msg.text}
        </p>
      )}

      <button
        onClick={onEmail}
        disabled={busy}
        className="w-full rounded-xl flex items-center justify-center gap-2 mb-3"
        style={{ minHeight: 52, background: C.surfaceHi, color: C.hi, fontWeight: 800, fontSize: 15, border: `1px solid ${C.border}`, opacity: busy ? 0.6 : 1 }}
      >
        {mode === "signin" ? <LogIn size={17} /> : <Mail size={17} />}
        {mode === "signin" ? "ログイン" : "新規登録"}
      </button>

      <button
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setMsg(null);
        }}
        className="w-full"
        style={{ color: C.mid, fontSize: 13, fontWeight: 600 }}
      >
        {mode === "signin" ? "アカウントが無い → 新規登録" : "アカウントがある → ログイン"}
      </button>
    </div>
  );
}

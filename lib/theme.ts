// FIT·NOTE デザイントークン（仕様 §2 に準拠）。
// dark / light の2テーマ。ブランドのゴールド #EAB308 は両テーマ共通でアイデンティティを保つ。
// プロトタイプ（docs/prototype/FitNote.tsx）の THEMES をそのまま正規化したもの。
export const THEMES = {
  dark: {
    page: "#05070C", bg: "#090D16", surface: "#0F172A", surfaceHi: "#111c33",
    accent: "#EAB308", tactical: "#1E293B", border: "#1E293B",
    hi: "#F1F5F9", mid: "#94A3B8", lo: "#5B6B82",
    scrim: "rgba(0,0,0,.6)", frame: "#0c1424", shadow: "0 30px 80px rgba(0,0,0,.6)",
  },
  light: {
    page: "#DBE2EA", bg: "#F4F6FB", surface: "#FFFFFF", surfaceHi: "#EEF2F7",
    accent: "#EAB308", tactical: "#EEF2F7", border: "#E2E8F0",
    hi: "#0F172A", mid: "#475569", lo: "#94A3B8",
    scrim: "rgba(15,23,42,.4)", frame: "#D5DCE6", shadow: "0 30px 80px rgba(15,23,42,.18)",
  },
} as const;

export type ThemeName = keyof typeof THEMES;
export type Tokens = (typeof THEMES)[ThemeName];

// ゴールド上の濃色テキスト（両テーマ共通）
export const ON_GOLD = "#1a1303";

// PFC ダッシュボードの初期目標値（フェーズ2で AI 算出値に置換）
export const TARGET = { kcal: 2200, p: 160, f: 60, c: 250 } as const;

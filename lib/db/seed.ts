import type { Library, Unit } from "./types";

// 部位（仕様 §3.2）
export const BODY_PARTS = ["胸", "背中", "肩", "腕", "脚", "体幹"] as const;

// 部位別の種目テンプレ（名前のみ）。ユーザー追加分はこれにマージされる。
const SEED_NAMES: Record<string, string[]> = {
  "胸": ["ベンチプレス", "ダンベルプレス", "インクラインプレス", "チェストフライ", "ディップス"],
  "背中": ["デッドリフト", "ラットプルダウン", "ベントオーバーロウ", "懸垂", "シーテッドロウ"],
  "肩": ["ショルダープレス", "サイドレイズ", "フロントレイズ", "リアレイズ"],
  "腕": ["バーベルカール", "ダンベルカール", "トライセプスプレスダウン", "ハンマーカール"],
  "脚": ["スクワット", "レッグプレス", "レッグエクステンション", "レッグカール", "カーフレイズ"],
  "体幹": ["プランク", "クランチ", "レッグレイズ", "アブローラー"],
};

// 新規ログの既定インターバル（休憩秒）。
export const DEFAULT_INTERVAL_SEC = 60;

// 既定で秒数記録にする種目（時間種目）。
export const SEC_EXERCISES = new Set<string>(["プランク"]);

// 種目名から既定の記録単位を返す。
export const defaultUnit = (name: string): Unit => (SEC_EXERCISES.has(name) ? "sec" : "reps");

// 単位付きのシードライブラリ。
export const EXERCISE_LIBRARY_SEED: Library = Object.fromEntries(
  Object.entries(SEED_NAMES).map(([part, names]) => [
    part,
    names.map((name) => ({ name, unit: defaultUnit(name) })),
  ]),
);

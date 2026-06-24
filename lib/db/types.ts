// NOTE（筋トレノート）のドメイン型。UI と各リポジトリ実装が共有する。

// 記録単位: reps=回数 / sec=秒数（プランク等の時間種目）。
export type Unit = "reps" | "sec";

// 種目ライブラリの1エントリ（名前 + 記録単位）。
export type ExerciseDef = { name: string; unit: Unit };

export type Library = Record<string, ExerciseDef[]>; // { 部位: [{name, unit}, ...] }

// ドロップセットの1段（重量×レップ）。bodyweight はセット単位なので段には持たせない。
export type SetStage = { weight: number; reps: number };

export type WorkoutSet = {
  id: string;
  weight: number; // 先頭段(トップセット)の重量。bodyweight=true のときは加重量(0=純粋な自重)
  reps: number; // 先頭段のレップ
  bodyweight: boolean; // 自重種目か（true なら weight/各段は加重量）
  drops: SetStage[]; // 2段目以降（ドロップ）。通常セットは空配列
};

// 新規セット追加時のペイロード（ドロップ段を含む）
export type NewSet = { weight: number; reps: number; bodyweight: boolean; drops: SetStage[] };

export type WorkoutLog = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // 種目名
  part: string; // 部位
  order: number;
  // 同一 groupId のログはスーパーセット（交互に実施する種目の束）。null=単独種目。
  groupId: string | null;
  unit: Unit; // 記録単位（回数 / 秒数）
  intervalSec: number; // セット間インターバル（休憩）秒。0=タイマー無し
  sets: WorkoutSet[];
};

// 前回セッションの実績（プリセット用）。w=重量(加重量), r=レップ, s=セット数, bw=自重か
export type LastSession = { w: number; r: number; s: number; bw: boolean } | null;

/**
 * NOTE のデータアクセス契約。Supabase 実装と localStorage 実装が共通で満たす。
 * すべて非同期（Supabase に合わせる。local 実装も Promise を返す）。
 */
export interface NoteRepo {
  /** 種目ライブラリ（共通テンプレ + ユーザー追加）を部位別に返す */
  getLibrary(): Promise<Library>;
  /** オリジナル種目をライブラリへ永続化（重複は無視）。unit で記録単位を指定 */
  addCustomExercise(part: string, name: string, unit: Unit): Promise<void>;

  /** 指定日の種目ログ（セット込み）を order 昇順で返す */
  getLogs(date: string): Promise<WorkoutLog[]>;
  /** 当日ログに種目を追加して、作成したログを返す */
  addLog(date: string, name: string, part: string, unit: Unit): Promise<WorkoutLog>;
  /** 種目ログを削除（セットも連動削除） */
  removeLog(logId: string): Promise<void>;
  /** セット間インターバル（休憩秒）を更新 */
  setLogInterval(logId: string, intervalSec: number): Promise<void>;

  /** 指定ログ群を1つのスーパーセットにまとめ、割り当てた groupId を返す */
  createGroup(logIds: string[]): Promise<string>;
  /** スーパーセットを解除（対象 groupId のログを単独に戻す） */
  ungroup(groupId: string): Promise<void>;

  /** ログにセットを1件追加して、作成したセットを返す（ドロップ段を含む） */
  addSet(logId: string, set: NewSet): Promise<WorkoutSet>;
  /** 既存セットを上書き更新して、更新後のセットを返す（重量・レップ・ドロップ段の編集） */
  updateSet(logId: string, setId: string, set: NewSet): Promise<WorkoutSet>;
  /** セットを1件削除 */
  removeSet(logId: string, setId: string): Promise<void>;

  /** 指定日より前の最新セッションの実績を返す（無ければ null） */
  getLastSession(date: string, name: string): Promise<LastSession>;
}

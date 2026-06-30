# FIT-NOTE 実装仕様書（Claude Code 引き継ぎ用）

AI食事解析 × 極限シンプル筋トレノート。フロントエンドエンジニア転職のポートフォリオ用プロダクト。

## 0. このドキュメントの使い方

このファイルは Claude Code に実装を依頼するための仕様書です。以下を一緒にリポジトリへ置くと精度が上がります。

- `FitNote.jsx` … 動作確認済みの高忠実度プロトタイプ（React + Tailwind 単一ファイル）。**UI・状態遷移・インタラクションの正本**。各画面コンポーネントはほぼそのまま `app/` 配下のクライアントコンポーネントへ移植可能。
- `route.ts` … GPT-4o で食事写真を解析する Next.js Route Handler の雛形（`app/api/analyze-meal/route.ts` に配置）。
- `test-analyze.mjs` … 上記ルートの単体テストスクリプト（`scripts/` に配置）。

実装の指針: **プロトタイプの見た目と挙動を忠実に再現しつつ、状態をすべて Supabase 永続化に置き換える**。プロトタイプは状態をセッション内 React state で持っているだけなので、そこを実DBに差し替えるのが主タスク。

---

## 1. プロダクト概要

- **コンセプト**: 「引き算の美学 × AIによる自動化」。多機能で複雑な既存アプリへのアンチテーゼ。ジムでの手動記録の快適さ（手袋前提のUI）と、食事のAI写真解析による入力自動化の2軸に絞る。
- **技術スタック**: Next.js (App Router) / TypeScript / Tailwind CSS / Supabase（Auth・DB・Storage）/ OpenAI API (GPT-4o)。
- **対象画面幅**: 390〜430px のモバイルファースト。PWA 対応（ホーム画面追加・全画面起動）。

---

## 2. デザインシステム

ダーク／ライトの2テーマ。**ブランドのゴールド `#EAB308` は両テーマ共通**でアイデンティティを保つ。プロトタイプでは Tailwind のコアユーティリティ + インラインstyle（正確なトークン値の保証）で実装。本番では Tailwind の theme 拡張や CSS 変数に落としてよい。

| トークン | dark | light | 用途 |
|---|---|---|---|
| page | `#05070C` | `#DBE2EA` | 端末外の背景 |
| bg | `#090D16` | `#F4F6FB` | アプリ背景（深黒） |
| surface | `#0F172A` | `#FFFFFF` | カード基調 |
| accent | `#EAB308` | `#EAB308` | ゴールド（CTA・強調） |
| tactical | `#1E293B` | `#EEF2F7` | 巨大ボタン・入力欄・カウンター |
| border | `#1E293B` | `#E2E8F0` | 境界線 |
| hi | `#F1F5F9` | `#0F172A` | 主要テキスト |
| mid | `#94A3B8` | `#475569` | 副次テキスト |
| lo | `#5B6B82` | `#94A3B8` | ラベル・補助 |

- ゴールド上の濃色テキストは `#1a1303`。
- 数値表示は `font-variant-numeric: tabular-nums`。
- **タップターゲットは縦56〜64px以上**（手袋・パワーグリップ着用を想定）。
- テーマは本番では `next-themes` 推奨（OS設定同期・FOUC対策）。
- `prefers-reduced-motion` でアニメーション無効化。

---

## 3. 画面仕様

### 3.1 共通シェル

- 上部にステータスバー風（9:41 / 5G）は装飾。本番では不要なら省略可。
- ヘッダー: ロゴ `FIT·NOTE`、テーマ切替ボタン（月/太陽）、画面別バッジ（NOTE=「GYM MODE」/ SHOKUJI=「FREE PLAN (残/3)」/ DATA=「PREMIUM」）。
- 永続グローバルナビ: NOTE / SHOKUJI / DATA。
- PWA: manifest、`next/image`、ホーム画面追加対応。

### 3.2 NOTE（筋トレノート）

**週カレンダー**: 日付選択UI。デフォルト今日、過去日の閲覧・編集可。

**種目ライブラリ（部位別テンプレ + ユーザー追加）**
- 「種目を追加」→ 部位別（胸／背中／肩／腕／脚／体幹）にテンプレが並ぶシート。チップをタップで当日ログに追加。当日追加済みはチェック表示。
- 「オリジナル種目を追加」→ 部位選択 + 名前入力 →「追加して記録」。**ライブラリに保存され、次回から同部位のリストに並ぶ**（＝再入力不要）。同時に当日ログにも追加。
- seed データ（初期テンプレ）:

```ts
const BODY_PARTS = ["胸","背中","肩","腕","脚","体幹"];
const EXERCISE_LIBRARY_SEED = {
  "胸":   ["ベンチプレス","ダンベルプレス","インクラインプレス","チェストフライ","ディップス"],
  "背中": ["デッドリフト","ラットプルダウン","ベントオーバーロウ","懸垂","シーテッドロウ"],
  "肩":   ["ショルダープレス","サイドレイズ","フロントレイズ","リアレイズ"],
  "腕":   ["バーベルカール","ダンベルカール","トライセプスプレスダウン","ハンマーカール"],
  "脚":   ["スクワット","レッグプレス","レッグエクステンション","レッグカール","カーフレイズ"],
  "体幹": ["プランク","クランチ","レッグレイズ","アブローラー"],
};
```

**種目カード（CRUD）**
- カードごとに番号・部位バッジ・種目名・削除。
- 当日トレを複数カードで一覧表示。

**Tactical Counter（重量 / レップ数）**
- `−` / `+` ボタン。通常タップに加え、**長押しで加速増減**（重量2.5kg刻み、レップ1刻み）。実装は pointer イベント（`onPointerDown`/`Up`）で touch・mouse 両対応。350ms 押下後に約70ms間隔で連打。
- **数字部分をタップすると直接入力モード**に切替（キーボード入力、Enterまたはフォーカス外で確定）。タップ可能の合図として点線下線。

**横並びセット管理**
- カード内に記録済みセットを**横スクロールのチップ**で表示（`SET 1 / 82.5kg × 10`）。各チップ個別削除可。
- 「SET n 完了」ボタンで現在の重量・レップを**新しいセットとして配列に追加**。チップが**右からスライドイン**し、行を末尾まで自動スクロール。
- 完了後も入力部はそのまま残り、**同じ種目で次セットの重量・レップを連続記録**できる（直前値が残るので同値なら即完了）。
- セット数の上限は固定しない。

**前回実績プリセット**: 前回セッション値を表示し、「前回と同じ値をプリセット」で重量・レップを一括反映（0タップ完了の導線）。

### 3.3 SHOKUJI（AI食事ダッシュボード）

**PFCダッシュボード**: 目標カロリー・PFC（初期登録時にAI算出した値）と実摂取量の進捗をプログレスバーで可視化。当日食事をタイムライン表示（料理名・PFC・サムネイル）。

**SNAP YOUR MEAL（マルチモーダル導線）**
- タップで「写真を撮る／アルバムから選択」のシートを表示。
  - カメラ: `<input type="file" accept="image/*" capture="environment">`
  - アルバム: `<input type="file" accept="image/*">`（`capture` を**付けない**ことがライブラリを開く条件）
- 取得画像は **`createImageBitmap` でデコード → canvas で最大1024pxにリサイズ → JPEG(base64)** に正規化（HEIC・巨大画像・サンドボックス制限対策。下記「実装ノート」参照）。

**AI解析 → ハイブリッド編集 → 確定**
- 正規化した画像を `/api/analyze-meal` に POST → `{ dish, kcal, p, f, c }` を受領。
- 受領値を編集フォームにプリセット。**AIの誤認識を想定し、ユーザーが手で数値修正してから確定**（信頼性の高いUX）。カメラ不可時は最初から手入力のみでも登録可。
- 確定で当日履歴に追加、ダッシュボード更新。

**無料プラン制限**: AI写真解析は**1日3回まで**。ヘッダーに残回数バッジ。3回使い切ると解析ボタン無効。**本番ではサーバー側で日次カウントを強制**（クライアントのカウントは表示用）。

### 3.4 DATA（プレミアム解放ティザー）

重量推移グラフ等はプレミアム（月額¥580想定）で解放。ロック表示 + アップグレード導線。

---

## 4. AI 食事解析アーキテクチャ

**方針**: クライアントで画像を縮小 → 自前のサーバールート（`/api/analyze-meal`）→ GPT-4o を呼ぶ。**APIキーはサーバー側（`.env.local`）に隠す**。通信量とコストの両方を削減。

- ルート実装は `route.ts` を参照。要点:
  - `response_format: { type: "json_object" }` で**常に妥当なJSONを強制**（パース不安定を根本解消）。
  - モデルは環境変数 `OPENAI_MODEL`（既定 `gpt-4o`、安価運用は `gpt-4.1-mini`）。
  - 出力を検証・正規化（負値・欠損を0に）。
- **コスト感**: 食事写真1枚の解析は概ね **1円未満（約0.3〜0.5円）**。`$5` 無料クレジットでデモ十分。

**特化API比較の結論**（検討記録）
- fatsecret は日本語DBが魅力だが、画像認識はアドオン（14日トライアル＋要問い合わせ）、日本語データは有料Premier（要問い合わせ）で**個人での入手性が最も低い**。
- Passio はトークン課金のセルフサーブ（月$25〜）。LogMeal は30日無料トライアルあり（その後カード課金、正式料金は要問い合わせ）。和食精度は要検証。
- **結論**: ポートフォリオでは「即発行・最安・和食に強い・営業不要」の **GPT-4o（または gpt-4.1-mini）を本番採用**。精度アピールが必要なら LogMeal/Passio のトライアルでデモを別途用意。
- アプリ側の流れ（クライアント縮小 → サーバールート → JSON → フォームにプリセット → 人間が補正）は API を問わず共通。**差し替えはルートの中身だけ**。

**プロトタイプの DEMO_MODE**
- `FitNote.jsx` には `DEMO_MODE = true` があり、プレビュー環境（外部API不可のサンドボックス）でもUXを通すためサンプル値を返す。
- **本番では `DEMO_MODE = false`** にすると `analyzeMeal()` が自動で `/api/analyze-meal` を呼ぶ。フロントの分岐は `analyzeMeal()` 一箇所に集約済み。

---

## 5. データモデル（Supabase 提案スキーマ）

すべて `user_id` で RLS（行レベルセキュリティ）を有効化し、本人のみ参照・更新可とする。

- **profiles**: `id (uuid, auth.users参照)`, `height`, `weight`, `age`, `sex`, `activity_level`, `goal (増量/減量/維持)`, `target_kcal`, `target_p`, `target_f`, `target_c`。初期登録時に身体情報をAIに送り目標値を算出して保存。
- **exercises**（種目ライブラリ）: `id`, `user_id (null=共通テンプレ)`, `body_part`, `name`, `is_custom`。seed の共通テンプレ + ユーザー追加分。
- **workout_logs**（当日の種目）: `id`, `user_id`, `date`, `exercise_id`, `order`。
- **workout_sets**（セット）: `id`, `workout_log_id`, `set_index`, `weight`, `reps`。横並びセットの1チップ=1行。
- **meals**: `id`, `user_id`, `date`, `dish`, `kcal`, `p`, `f`, `c`, `image_path (Supabase Storage)`, `source (ai/manual)`。
- **ai_usage**（無料プラン制限）: `user_id`, `date`, `count`。1日3回をサーバー側で判定・インクリメント。

---

## 6. 実装ノート（ハマりどころ・確定済みの知見）

- **画像デコード**: `<img>` + blob URL は HEIC や CSP 制限でデコード失敗することがある。**`createImageBitmap(file)` で File を直接デコード** → canvas → JPEG 化が堅牢。本番サーバー側で確実に変換したい場合は `sharp`。
- **AI応答のパース**: 必ず `response_format: { type: "json_object" }`（OpenAI）を使う。プロンプトに「JSON」の語を含めること。前置きやマークダウン混入によるパース失敗を防げる。
- **APIキー**: クライアントに出さない。必ずサーバールート経由。
- **永続化**: プロトタイプは種目ライブラリ・当日ログ・食事・残回数をすべて React state で保持しているだけ。**リロードで消える**。本番は §5 のテーブルに置換。
- **認証**: 選考時に採用担当が1秒で触れるよう、**パスワード不要のデモログイン／ワンクリックサインイン**を用意（PRD要件）。
- **画像最適化**: `next/image` + Supabase Storage で通信量削減。

---

## 7. 開発ロードマップ（フェーズ）

0. 環境構築（Next.js + TS + GitHub + Vercel 自動デプロイ）
1. 筋トレノート画面の CRUD（Supabase連携、Tactical Counter、横並びセット、種目ライブラリ）
2. ユーザー登録・パーソナルAI（初期PFC算出）
3. 食事管理 + GPT-4o マルチモーダル連携（写真解析・手動リライト・3回/日制限）
4. PWA化・デザインブラッシュアップ・README整備

---

## 8. 受け入れ基準（チェックリスト）

- [ ] NOTE: 部位別テンプレから種目を追加できる
- [ ] NOTE: オリジナル種目を部位+名前で追加でき、ライブラリに永続化され次回も選べる
- [ ] NOTE: Counter が長押し加速・数字タップ直接入力の両方で動く
- [ ] NOTE: 「SET n 完了」でセットが横並びにスライドインし、同種目で次セットを連続記録できる
- [ ] NOTE: セット・種目・ログが Supabase に保存され、リロード後も残る
- [ ] SHOKUJI: カメラ／アルバムの両方から画像を取得できる
- [ ] SHOKUJI: 画像が GPT-4o で解析され、PFC がフォームにプリセットされる
- [ ] SHOKUJI: ユーザーが数値を修正して確定でき、ダッシュボードが更新される
- [ ] SHOKUJI: 無料解析がサーバー側で1日3回に制限される
- [ ] 全体: ダーク／ライト切替が機能し、トークンが §2 と一致する
- [ ] 全体: PWA としてホーム画面追加・全画面起動できる
- [ ] 認証: デモログインで即操作開始できる

---

## 9. 実装進捗・引き継ぎメモ（最終更新: 2026-06-24）

> 次に作業する人が「どこまで出来ているか」を把握するための生きたメモ。新機能を足したら追記すること。

### 9.1 フェーズ進捗

| フェーズ | 状態 | 補足 |
|---|---|---|
| 0 環境構築 | ✅ 完了 | Next.js 16 + TS + Tailwind v4 + next-themes + PWA manifest |
| 1 NOTE (CRUD) | ✅ 完了 + 拡張 | 下記 9.2 の追加機能まで実装済み |
| 2 ユーザー登録・PFC算出 | ✅ 完了 | 認証（9.8）＋ 身体情報からAIが目標PFCを算出（9.9） |
| 3 SHOKUJI (GPT-4o) | ✅ 完了 | 画面・画像正規化・解析→編集→確定・日次3回制限（サーバー側）まで実装。下記 9.7 |
| 4 PWA仕上げ・README | ⬜ 一部のみ | manifest 済 |

### 9.2 NOTE 画面の追加実装（仕様 §3.2 を超える部分）

- **スーパーセット（種目グループ化）**
  - 作成は **「種目を追加」シート内**で行う: シート上部の「スーパーセットを組む」をON → テンプレ種目を複数タップ（選択順を番号表示）→「N種目でスーパーセット作成」で当日ログへ一括追加しグループ化。
  - 表示: 同一 `groupId` のカードを「SUPERSET A/B…」枠で束ね、枠下に **「まとめてセット完了」**（全種目を現在値で1ラウンド記録）と **「解除」** を表示。
  - 種目削除でメンバーが1つになったグループは自動解散。
- **ドロップセット（SetEditor で組む）**
  - 種目カードの **「ドロップ」ボタン → `SetEditor` が開く**。現在の入力値をトップ段に、各段の**重量・レップ・自重・ドロップ段の追加/削除**を編集して保存すると新規セットとして記録される（`repo.addSet`）。
  - **直近のドロップ構成を種目ごとに記憶**（`lastDrop`）。2セット目以降は前回の段構成が初期値で開くので組み直し不要。
- **自重トグル**: 自重をONにすると重量は **0kg スタート**（純粋な自重）。秒数種目の初期値も自重ON・0kg。
- **長押し対策**: 全ボタンに `-webkit-touch-callout/user-select: none`（globals.css）。+/- は `useHold` の `touchAction: pan-y` と併用。
  - 記録中の単発入力（Counter）には多段を持たせない。「SET n 完了」は単発セットを記録するのみ。
  - 保存形: 先頭=トップセット、`drops[]`=2段目以降。完了チップ表示は `⤵` で連結。
- **完了セットの編集**: 横並びセットのチップを**タップすると `SetEditor`** が開く（新規ドロップ作成と同じパネル）。各段の重量・レップ・自重を修正、ドロップ段の追加/削除も可。保存で `repo.updateSet`。
  - `SetEditor` は `title` / `initialBodyweight` / `initialStages` を受け取り、**編集（既存上書き）と新規作成（ドロップ）を兼用**。
- **Tactical Counter の誤作動修正**: +/- は押下即時ではなく**指を離した時**に1ステップ。移動しきい値超え/`pointercancel`（スクロール開始）は反応しない（`useHold` + `touchAction: pan-y`）。
- **追加後スクロール**: 種目を追加すると**その新しいカードへスクロール**（`cardRefs` + `pendingScroll`）。
- **時間種目（秒数記録）**: 種目は記録単位 `unit`（`reps`=回数 / `sec`=秒数）を持つ。
  - シードの **プランクは既定で秒数**（`SEC_EXERCISES`）。オリジナル種目追加時に**回数/秒数を選択**でき、ライブラリに単位ごと記憶される。
  - 秒数種目はカードの入力欄が「TIME（秒）」、増減は **5刻み**、初期値 自重ON・30秒。完了チップ/前回実績/編集パネルも「◯秒」表示。
  - 種目チップには `秒`（Timer アイコン）バッジを表示。
- **タイマー（`TimerOverlay`、全画面カウントダウン）**
  - **実施タイマー（work）**: 秒数種目はカードのボタンが「**スタート**」に変化。押すと設定秒数のカウントダウン → 完了で**実施秒数を記録** → 休憩へ。スキップ時は経過秒数を記録。
  - **インターバル（rest）**: セット記録後に休憩タイマーを表示（回数種目は「完了」後、秒数種目は実施後、スーパーセットは「まとめてセット完了」後）。`WorkoutLog.intervalSec`（既定60、0=無し）で**種目ごとに編集可**（カード/グループ枠の「休憩 −/＋/数字タップ」）。
  - **インターバルは種目ごとに記憶**: 変更すると `repo.setExerciseInterval(name)` で既定として保存され、次回同じ種目を追加したとき復元される（local は `intervalByName`、supabase は `exercises.interval_sec`／共通テンプレは RLS で更新不可）。`ExerciseDef.intervalSec` がライブラリ経由で `addLog` に渡る。
  - タイマー画面は ±10秒・一時停止/再開・スキップ・やめる、完了時に振動（`navigator.vibrate`）。
- **スーパーセットの一括操作**: グループ内のカードは**個別の完了/スタート・ドロップ・休憩UIを出さない**。グループ枠に**1つの「まとめてセット完了」**＋**共通の休憩設定**を表示し、完了で全種目を記録→休憩タイマー。休憩変更はグループ全員の既定に反映。
- **モーダルのスクロール対策**: シート/編集パネルは `FramePortal` で端末枠 `#fn-frame` 直下へ portal。ページのスクロール位置に依存せず常にビューポートを覆う（以前は一番下スクロール状態で開く不具合があった）。

### 9.3 データモデルの追加点

- `WorkoutLog.groupId: string | null`（スーパーセット）/ `WorkoutLog.unit: "reps"|"sec"`（記録単位）/ `WorkoutLog.intervalSec: number`（休憩秒、既定60）。
- `Library` は `Record<部位, { name, unit, intervalSec }[]>`（種目ごとに単位・既定休憩を保持）。`ExerciseDef` 型。
- `NoteRepo` に `createGroup` / `ungroup` / `updateSet` / `setLogInterval` / `setExerciseInterval` を追加。`addLog` は `unit, intervalSec`、`addCustomExercise` は `unit` を取る。local / supabase 両実装済み。
- マイグレーション: `0002_superset.sql`（`group_id`）/ `0003_unit.sql`（`exercises.unit`・`workout_logs.unit`、プランクを sec に）/ `0004_interval.sql`（`workout_logs.interval_sec`）/ `0005_exercise_interval.sql`（`exercises.interval_sec`）。
- localStorage 旧データ互換: `custom`(旧 string[]) と `unit`/`intervalSec` 未設定ログを読み込み時に正規化。種目別休憩は `intervalByName` に保存。

### 9.4 主要ファイル

- 画面: `components/screens/note/NoteScreen.tsx`（状態の中枢）
- 種目カード: `ExerciseCard.tsx` / カウンター: `Counter.tsx` + `useHold.ts`
- シート類: `AddExerciseSheet.tsx`（種目追加＋スーパーセット作成）/ `SetEditor.tsx`（完了セット編集）/ `FramePortal.tsx`
- データ層: `lib/db/`（`types.ts` 契約 / `local-repo.ts` / `supabase-repo.ts` / `index.ts` でフォールバック切替）

### 9.5 既知の注意点

- Supabase env 未設定時は **localStorage 永続化**で動作（キー `fitnote.note.v1`）。Vercel プレビューもこのモード。
- `eslint` は React 19 の厳格ルールで既存ファイル含め数件 error（`set-state-in-effect` / refs）。**`next build` は eslint を通さず通過**するためデプロイは可能。気になるなら別途整理。
- スーパーセット作成は当日ログへ追加するフロー。既に追加済みの単独種目を後から束ねるUIは現状なし（必要なら追加検討）。

### 9.6 次の一手の候補

1. フェーズ2（ユーザー登録・初期PFC算出。SHOKUJI の目標値は profiles から読むので、AI算出値を保存すれば自動で反映される）
2. SHOKUJI 仕上げ（画像の Supabase Storage 保存・日付切替で過去の食事閲覧・週/月集計）
3. NOTE 仕上げ（前回実績プリセットの精度、スーパーセットの並び替え等）

### 9.7 SHOKUJI 画面の実装（フェーズ3、仕様 §3.3 / §4）

- **画面本体**: `components/screens/meal/MealScreen.tsx`。ナビの ComingSoon を置換。
  - PFCダッシュボード（CALORIES + P/F/C プログレスバー、`Bar` はローカル実装）。目標値は `MealRepo.getTarget()`（supabase=profiles / local=`lib/theme.ts` の `TARGET` 既定）。
  - 当日食事タイムライン（料理名・PFC・サムネイル・AIバッジ・削除）。空状態の表示あり。
  - 「SNAP YOUR MEAL」→ 取得元シート（写真を撮る= `capture="environment"` / アルバム= `capture` 無し）。シート/確定フォームは `FramePortal` 経由でフレーム直下に portal。
- **画像正規化**: `lib/image.ts` の `processImage`（`createImageBitmap` → canvas で最大1024px → JPEG base64）。プロトタイプの処理をそのまま移植。
- **解析→編集→確定**: 正規化画像を `/api/analyze-meal` に POST → `{dish,kcal,p,f,c}` を下書きにプリセット → ユーザーが手修正して確定。解析失敗・上限到達時は画像を添えて手入力フォームへフォールバック（記録は継続可）。「手入力で追加」から最初から手入力のみでも登録可。
- **ヒント入力**: SNAP ボタン上の任意テキスト欄（例「吉野家 牛丼 大盛り」）。解析時に `hint` としてルートへ送り、ブランド商品の特定・分量精度を上げる。
- **記録の編集**: タイムラインの食事をタップすると確定フォームが編集モードで開き、`MealRepo.updateMeal` で上書き保存できる（削除はゴミ箱アイコン）。
- **精度向上（route.ts）**: OpenAI **Responses API** + **`web_search` ツール**でチェーン店・コンビニ・メーカー商品の公式栄養値を照合。画像は `detail:"high"`、`temperature:0.2`、強化システムプロンプト（複数品目の合算・分量見積り・ヒント最優先）。出力 JSON は本文から頑健に抽出。`OPENAI_WEB_SEARCH=0` で検索無効化、検索経由で失敗した場合は検索なしで自動リトライ。
- **データ層**: `MealRepo`（`lib/db/meal-types.ts`）を NOTE と同じく local / supabase の両実装で用意（`local-meal-repo.ts` / `supabase-meal-repo.ts`、`getMealRepo()` でフォールバック切替）。`meals` テーブルに永続化。
- **無料プラン 1日3回制限**:
  - **判定の正本はサーバー側**。`app/api/analyze-meal/route.ts` が Supabase 構成時に `ai_usage` を読み、`DAILY_AI_LIMIT`(=3) 到達なら 429 を返し、成功時に count を +1（upsert）する。リクエストに `date`（クライアントのローカル日）を含めて当日基準で判定。
  - **表示**: ヘッダーの「FREE PLAN 残/3」バッジ。`lib/meal-usage.tsx`（`MealUsageProvider` / `useMealUsage`）で AppShell ヘッダーと MealScreen が残回数を共有。
  - **local モード**（Supabase env 未設定）はサーバーで永続化できないため、`MealRepo.incrementUsage` が localStorage に表示用カウントを保持（supabase 実装は no-op）。
- **マイグレーション**: `0006_meals.sql`（`meals` / `ai_usage` テーブルと RLS デモポリシー）。
- **注意点**: サムネイルは現状 data URL を直接保存（local も supabase も `meals.image_path` に格納）。画像の Supabase Storage 保存はフェーズ4で対応予定。`route.ts` は `getServerSupabase`（cookies 参照）を使うためビルドで動的(ƒ)ルートになる。

---

## 10. 将来のリリース構想・運用メモ

> 当面はポートフォリオ用だが、**将来的には一般公開（リリース）したい**意向あり。
> その段階で必要になる検討事項を記録しておく（実装は未着手）。

### 10.1 リリース時にやること（チェックリスト）

- [ ] **本格認証**（フェーズ2）: 現状は固定デモユーザー。Supabase Auth で本人ごとの RLS（`auth.uid()`）に差し替える。
- [ ] **Supabase 本番接続**: 全ユーザーのデータをクラウド保存（現状 env 未設定だと localStorage で端末内のみ）。
- [ ] **画像の Supabase Storage 保存**（フェーズ4）: 現状サムネイルは data URL を直接 DB 保存しているため、Storage + 署名URL に移行して通信量・DB肥大を抑える。
- [ ] **APIキーの保護**: クライアントに出さずサーバールート経由（現状の設計を維持）。本番は Vercel の環境変数に `OPENAI_API_KEY` を登録。
- [ ] **コスト暴走対策**: OpenAI Billing の Usage limits で月額上限を設定。AI解析の日次制限（現 1日3回・サーバー側強制）を維持/調整。
- [ ] **OpenAI 利用ポリシー順守**: エンドユーザー提供時の表記・データ取り扱いを確認。
- [ ] **課金区分**: 個人公開のうちは OpenAI「自分用」でよい。法人化・事業売上計上・インボイスが必要になったら「ビジネス用」へ切替（機能・料金は同じ、請求まわりのみ差異）。
- [ ] **PWA 仕上げ**（フェーズ4）: ホーム画面追加・全画面起動・アイコン整備。
- [ ] **収益化**（任意）: DATA 画面のプレミアム解放（月額¥580想定）を実装する場合は決済（Stripe 等）を追加。

### 10.2 OpenAI 課金の運用方針（決定事項）

- **自動充電（Auto-recharge）はオフ**で運用する。残高分で打ち止めになり、想定外請求・キー漏洩時の被害を防げる。
  - 写真1枚あたり概ね1円未満のため、少額（$5 程度）チャージで当面足りる。
  - 不特定多数が常時利用する本番規模になり「デモ中に止まると困る」段階で初めて自動充電オンを検討する（最低 $10 単位）。

### 9.8 認証の実装（フェーズ2前半、仕様 §3 / §5）

- **方式**: Supabase Auth。ログインは2種類 —「ゲストとして始める」（匿名サインイン＝ワンクリック。採用担当が即操作できる PRD 要件）と、メール＋パスワード。
- **状態管理**: `lib/auth.tsx`（`AuthProvider` / `useAuth`）。`app/providers.tsx` で全体をラップ。Supabase 未構成（local モード）は `authed=true` で素通し、構成時のみログイン必須。
- **画面**: `components/screens/AuthScreen.tsx`（ログイン/新規登録）。`components/AppShell.tsx` が `useAuth()` でゲートし、未ログインは AuthScreen、ログイン後はタブUI。ヘッダーにログアウト。
- **セッション維持**: Next.js 16 の **`proxy.ts`**（旧 middleware。`@supabase/ssr` のトークンを毎リクエスト更新）。
- **RLS**: `0007_auth.sql` で全テーブルのポリシーを `auth.uid()` ベースへ差し替え、`user_id` 列に `default auth.uid()` を付与。これにより各リポジトリは `user_id` を明示しなくなり（挿入は default、参照は RLS が自動で本人に絞る）、`DEMO_USER_ID` 依存をコードから除去した。新規ユーザー作成時に profiles 行を作るトリガ `handle_new_user` も追加。
- **サーバールート**: `app/api/analyze-meal/route.ts` は `auth.getUser()` で本人を特定し、`ai_usage` を本人IDで判定・加算（未ログインは 401）。
- **要ダッシュボード設定**: Authentication で **Email**（"Confirm email" OFF 推奨）と **Anonymous sign-ins** を有効化。既存DBには `0007_auth.sql` の実行が必要。
- **注意**: RLS 切替後、旧デモユーザー所有の既存データは新ユーザーから不可視（各自のアカウントで新規記録）。
- **残タスク（フェーズ2後半）**: 身体情報入力 → AIが目標PFCを算出して profiles に保存（現状は既定値 2200/160/60/250。SHOKUJI ダッシュボードは profiles を読むので、保存すれば自動反映）。

### 9.9 AI目標PFC算出（フェーズ2後半、仕様 §3.3 / §5）

- **入力UI**: SHOKUJI ダッシュボードの「CALORIES」横のスライダーアイコンから `ProfileSheet`（`components/screens/meal/ProfileSheet.tsx`）を開く。身長・体重・年齢・性別・活動量（低/ふつう/高）・目標（減量/維持/増量）を入力。
- **算出ルート**: `app/api/compute-targets/route.ts`。GPT に Mifflin-St Jeor 式＋活動係数（low1.4/mid1.55/high1.725）＋目標補正（増量+15%/維持±0/減量-20%）＋PFC配分（P=体重×2.0g、F=総kcalの25%、C=残り）で算出させ JSON 受領。**APIキー未設定・GPT失敗・極端値のときはサーバー側の決定論的計算（同式）にフォールバック**して必ず返す（`source: "ai" | "formula"`）。
- **永続化**: `MealRepo.getProfile` / `saveProfile` を local / supabase に実装。supabase は profiles 行を `upsert`（id=auth.uid()）。保存すると `getTarget` が新目標を返し、ダッシュボードのバー基準が即更新される。
- **DBマイグレーション不要**: profiles の身体情報・target_* 列は 0001 で作成済み。RLS は 0007 の `profiles_auth` がカバー。ダッシュボード追加設定は不要。
- **残**: フェーズ4（PWA仕上げ・画像のStorage保存・DATA画面のプレミアム実装など）。

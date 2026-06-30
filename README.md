# FIT·NOTE

AI食事解析 × 極限シンプル筋トレノート。フロントエンドエンジニア転職のポートフォリオ用プロダクト。

「引き算の美学 × AIによる自動化」をコンセプトに、ジムでの手動記録の快適さ（手袋前提のUI）と、
食事のAI写真解析による入力自動化の2軸に絞ったモバイルファースト Web アプリ。PWA としてホーム画面に追加でき、オフラインでも起動する。

## 技術スタック

- **Next.js 16**（App Router・Turbopack）/ **TypeScript**
- **Tailwind CSS v4**（CSS-first 設定）
- **next-themes**（dark / light・OS設定同期・FOUC対策）
- **Supabase**（Auth・DB・Storage）※未設定でも localStorage フォールバックで動作
- **OpenAI API (GPT-4o)**（食事写真の栄養解析）
- **PWA**（manifest・Service Worker によるオフライン対応・ホーム画面追加）

## 主な機能

- **NOTE（筋トレノート）** — 週カレンダー、部位別の種目ライブラリ＋オリジナル種目、Tactical Counter（長押し加速・数字タップ直接入力）、横並びセット、スーパーセット、ドロップセット、秒数種目、インターバル（休憩）タイマー。
- **SHOKUJI（AI食事ダッシュボード）** — 写真を GPT-4o で解析して PFC を自動入力 → 手修正して確定。当日PFCの進捗バー、無料プランは1日3回（サーバー側で強制）。写真は Supabase Storage に保存し署名URLで表示。
- **DATA（筋トレ履歴カレンダー）** — 過去のトレを年月カレンダーで振り返り。記録日にマーク、部位別フィルタ（「胸の日」等）、日付タップでその日の種目・セット・トップセットを表示。
- **設定** — ヘッダーの歯車から、ナイトモード／自動インターバルタイマー／バイブレーション／ログアウト。
- **認証** — ゲスト（匿名）ワンクリック or メール＋パスワード。本人ごとに RLS でデータ分離。

## セットアップ

```bash
npm install
cp .env.local.example .env.local   # 必要に応じて値を記入（未記入でも起動可）
npm run dev                        # http://localhost:3000
```

> Turbopack のキャッシュが壊れて変更が反映されない場合は `rm -rf .next node_modules/.cache` してから再起動する。

環境変数（詳細は `.env.local.example`）:

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | データ永続化（DB・Storage・Auth） | localStorage に保存 |
| `OPENAI_API_KEY` | 食事写真の AI 解析 | 解析APIは 500 を返す |
| `OPENAI_WEB_SEARCH` | ブランド商品の公式栄養値を Web 検索で照合（`0` で無効） | `1`（有効） |

## Supabase 本番接続（クラウド保存）

未設定でも localStorage で動くが、端末間同期・AI解析の日次3回制限のサーバー強制・写真の Storage 保存を
有効にするには Supabase を接続する。

1. **プロジェクト作成** — [supabase.com](https://supabase.com) で New project（Region は Tokyo 推奨、DB パスワードは控える）。
2. **スキーマ適用** — ダッシュボードの **SQL Editor → New query** に [`supabase/setup.sql`](supabase/setup.sql) の全文を貼り付けて **Run**（0001〜0008 を1つにまとめた冪等SQL。`drop policy` を含むため「破壊的操作」警告が出るが、空DBなので実行してよい）。`Table Editor` に `profiles / exercises / workout_logs / workout_sets / meals / ai_usage` が、`Storage` に `meal-images` バケットが並べば成功。
3. **接続情報取得** — **Settings → API** で Project URL と `anon` `public` キーをコピー（`service_role` は使わない）。
4. **環境変数設定** — ローカルは `.env.local`、本番は Vercel の Environment Variables に次を登録し再デプロイ:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public キー

> 接続を切替えると保存先が変わるため、それまで localStorage に入れていたデータは引き継がれない。

### 認証

ログインした本人ごとにデータを分離する（RLS は `auth.uid()` ベース）。Supabase 構成時はログイン必須、未構成のローカルはログイン不要。

1. **スキーマ更新** — 既存DBには `supabase/migrations/0007_auth.sql` を SQL Editor で実行（新規DBは `setup.sql` に同梱済み）。RLS を `auth.uid()` に切替え、`user_id` 列へ `default auth.uid()` を付与、新規ユーザーに profiles 行を自動生成するトリガを作成する。
2. **プロバイダ有効化** — Supabase の **Authentication → Sign In / Providers** で:
   - **Email**（メール＋パスワード）。デモを滑らかにするなら "Confirm email" を OFF 推奨。
   - **Anonymous sign-ins**（「ゲストとして始める」ワンクリック用）。
3. ログイン方法は「ゲストとして始める（匿名）」とメール＋パスワードの2種類。設定（歯車）のログアウトでサインアウト。

> RLS 切替後、旧「デモユーザー」所有の既存データは新しいログインユーザーからは見えなくなる（各自のアカウントで新規に記録する）。

## PWA（ホーム画面追加・オフライン）

- **ホーム画面追加** — iOS Safari は共有 →「ホーム画面に追加」、Android Chrome はメニュー →「アプリをインストール」。`display: standalone` で全画面起動。
- **オフライン対応** — `public/sw.js`（Service Worker）がアプリシェルと静的アセットをキャッシュし、ネット断でも起動する。`/api/*` は介入せず常にネットワーク。**登録は本番ビルドのみ**（dev では HMR との競合を避けるため登録しない）。
- **アイコン** — `scripts/generate-icons.mjs` がマスター画像 `scripts/icon-source.png` から各サイズ（192/512・maskable・apple-touch・favicon）を生成する。

## ディレクトリ構成

```
app/                     App Router
  layout.tsx             ルートレイアウト（メタデータ・アイコン）
  providers.tsx          Theme / Auth / Settings / SW 登録の配線
  page.tsx               エントリ（AppShell）
  manifest.ts            PWA マニフェスト
  api/analyze-meal/      GPT-4o 食事解析ルート（日次制限のサーバー判定）
  api/compute-targets/   身体情報から目標PFCを算出するルート
components/
  AppShell.tsx           共通シェル（ヘッダー・ナビ・ステータスバー）
  SettingsSheet.tsx      設定（ナイトモード/タイマー/振動/ログアウト）
  ServiceWorkerRegister.tsx  本番のみ SW を登録
  screens/               各画面（note / meal / DataScreen / AuthScreen）
lib/
  theme.ts               デザイントークン（仕様 §2）
  use-tokens.tsx         useC() — 現テーマのトークンを供給
  settings.tsx           アプリ設定ストア（localStorage 永続化）
  auth.tsx               認証状態プロバイダ
  date.ts                日付ユーティリティ（週・月カレンダー）
  env.ts                 環境変数の集約・存在判定
  image.ts               画像の正規化（createImageBitmap → JPEG）
  supabase/              Supabase クライアント（client / server）
  db/                    リポジトリ層（local / supabase の二実装＋フォールバック）
public/
  sw.js                  Service Worker（オフライン）
  icon-*.png             PWA アイコン一式
supabase/                DB マイグレーション SQL（0001〜0008・setup.sql）
scripts/                 アイコン生成・食事解析ルートのテスト
docs/                    仕様書・プロトタイプ（実装の正本）
```

## 開発ロードマップ

- [x] **フェーズ0** 環境構築（Next.js + TS + Tailwind + テーマ基盤 + Supabase/OpenAI 配線）
- [x] **フェーズ1** 筋トレノート CRUD（Supabase 連携・Tactical Counter・横並びセット・種目ライブラリ）
- [x] **フェーズ2** ユーザー登録・パーソナルAI（認証・身体情報からの初期PFC算出）
- [x] **フェーズ3** 食事管理 + GPT-4o マルチモーダル連携（写真解析・手動リライト・3回/日制限）
- [x] **フェーズ4** PWA化（アイコン・オフライン）・写真のStorage保存・設定画面・履歴カレンダー・デザイン仕上げ

## デプロイ（GitHub → Vercel）

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

Vercel でリポジトリを import し、上記の環境変数を設定すると自動デプロイされます。

---

実装仕様の正本は [`docs/FIT-NOTE-spec.md`](docs/FIT-NOTE-spec.md)、UI の正本は
[`docs/prototype/FitNote.tsx`](docs/prototype/FitNote.tsx) です。

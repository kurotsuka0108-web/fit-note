# FIT·NOTE

AI食事解析 × 極限シンプル筋トレノート。フロントエンドエンジニア転職のポートフォリオ用プロダクト。

「引き算の美学 × AIによる自動化」をコンセプトに、ジムでの手動記録の快適さ（手袋前提のUI）と、
食事のAI写真解析による入力自動化の2軸に絞ったモバイルファースト Web アプリ。

## 技術スタック

- **Next.js 16**（App Router）/ **TypeScript**
- **Tailwind CSS v4**（CSS-first 設定）
- **next-themes**（dark / light・OS設定同期・FOUC対策）
- **Supabase**（Auth・DB・Storage）※未設定でも localStorage フォールバックで動作
- **OpenAI API (GPT-4o)**（食事写真の栄養解析）

## セットアップ

```bash
npm install
cp .env.local.example .env.local   # 必要に応じて値を記入（未記入でも起動可）
npm run dev                        # http://localhost:3000
```

環境変数（詳細は `.env.local.example`）:

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | データ永続化 | localStorage に保存 |
| `OPENAI_API_KEY` | 食事写真の AI 解析（フェーズ3） | 解析APIは 500 を返す |

## ディレクトリ構成

```
app/                     App Router
  layout.tsx             ルートレイアウト（Providers 配線）
  providers.tsx          next-themes プロバイダ
  page.tsx               エントリ（AppShell）
  manifest.ts            PWA マニフェスト
  api/analyze-meal/      GPT-4o 食事解析ルート（フェーズ3）
components/
  AppShell.tsx           共通シェル（ヘッダー・ナビ・テーマ切替）
  screens/               各画面コンポーネント
lib/
  theme.ts               デザイントークン（仕様 §2）
  use-tokens.tsx         useC() — 現テーマのトークンを供給
  env.ts                 環境変数の集約・存在判定
  supabase/              Supabase クライアント（client / server）
supabase/                DB マイグレーション SQL（フェーズ1）
scripts/test-analyze.mjs 食事解析ルートの単体テスト
docs/                    仕様書・プロトタイプ（実装の正本）
```

## 開発ロードマップ

- [x] **フェーズ0** 環境構築（Next.js + TS + Tailwind + テーマ基盤 + Supabase/OpenAI 配線）
- [ ] **フェーズ1** 筋トレノート CRUD（Supabase 連携・Tactical Counter・横並びセット・種目ライブラリ）
- [ ] **フェーズ2** ユーザー登録・パーソナルAI（初期PFC算出）
- [ ] **フェーズ3** 食事管理 + GPT-4o マルチモーダル連携（写真解析・手動リライト・3回/日制限）
- [ ] **フェーズ4** PWA化・デザインブラッシュアップ・README整備

## デプロイ（GitHub → Vercel）

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

Vercel でリポジトリを import し、上記の環境変数を設定すると自動デプロイされます。

---

実装仕様の正本は [`docs/FIT-NOTE-spec.md`](docs/FIT-NOTE-spec.md)、UI の正本は
[`docs/prototype/FitNote.tsx`](docs/prototype/FitNote.tsx) です。

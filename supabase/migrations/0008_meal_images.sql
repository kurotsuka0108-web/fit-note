-- ============================================================================
-- FIT·NOTE  フェーズ4 マイグレーション: 食事写真の Supabase Storage 保存
--
-- これまで meals.image_path に data URL を直接保存していたのを、Storage の
-- private バケット meal-images にアップロードし、image_path にはオブジェクトの
-- パス（<uid>/<uuid>.jpg）を保存する方式へ移行する。表示時は署名URLを発行。
--
-- オブジェクトはユーザーIDのフォルダ配下に置き、RLS で本人のみ read/write 可。
-- 既存の data URL 行はそのまま表示できる（リポジトリ側が後方互換で処理）。
-- ============================================================================

-- ── private バケット作成 ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', false)
on conflict (id) do nothing;

-- ── RLS（storage.objects は既定で RLS 有効。本人フォルダのみ許可） ─────────────
-- パスの先頭フォルダ = auth.uid() を本人判定に使う（<uid>/<uuid>.jpg）。
drop policy if exists meal_images_select on storage.objects;
create policy meal_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists meal_images_insert on storage.objects;
create policy meal_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists meal_images_update on storage.objects;
create policy meal_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists meal_images_delete on storage.objects;
create policy meal_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

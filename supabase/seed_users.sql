-- =========================================================================
-- DR Resources - User Seeding Script (LEGACY - via SQL)
-- NOTE: If login fails with "email atau password salah", gunakan API route
--       POST /api/seed-users  (lebih reliable karena pakai Admin API).
--       Tambahkan SUPABASE_SERVICE_ROLE_KEY ke .env.local terlebih dahulu.
-- =========================================================================

-- ==========================================
-- 1. ADMIN USERS (Role: admin)
-- ==========================================

-- Admin 1: Hasyim
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'hasyim@dr-resources.com', crypt('hasyim123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Hasyim", "role": "admin"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- Admin 2: Irzaldi
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'irzaldi@dr-resources.com', crypt('irzaldi123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Irzaldi", "role": "admin"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- Admin 3: Daabison
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'daabison@dr-resources.com', crypt('daabison123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Daabison", "role": "admin"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;


-- ==========================================
-- 2. REGULAR USERS (Role: user)
-- ==========================================

-- User 1: Bernardo
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'bernardo@dr-resources.com', crypt('bernardo123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Bernardo", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 2: Chris
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'chris@dr-resources.com', crypt('chris123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Chris", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 3: Falih
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'falih@dr-resources.com', crypt('falih123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Falih", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 4: Jemis
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'jemis@dr-resources.com', crypt('jemis123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Jemis", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 5: Rafif
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'rafif@dr-resources.com', crypt('rafif123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Rafif", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 6: Rakha
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'rakha@dr-resources.com', crypt('rakha123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Rakha", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 7: Yovan
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'yovan@dr-resources.com', crypt('yovan123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Yovan", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 8: Landhung
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'landhung@dr-resources.com', crypt('landhung123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Landhung", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

-- User 9: Iqbal
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'iqbal@dr-resources.com', crypt('iqbal123', gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Iqbal", "role": "user"}'::jsonb,
  now(), now(), '', ''
) ON CONFLICT DO NOTHING;

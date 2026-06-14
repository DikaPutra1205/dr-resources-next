import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SEED_USERS = [
  { email: 'hasyim@dr-resources.com', password: 'hasyim123', name: 'Hasyim', role: 'admin' },
  { email: 'irzaldi@dr-resources.com', password: 'irzaldi123', name: 'Irzaldi', role: 'admin' },
  { email: 'daabison@dr-resources.com', password: 'daabison123', name: 'Daabison', role: 'admin' },
  { email: 'bernardo@dr-resources.com', password: 'bernardo123', name: 'Bernardo', role: 'user' },
  { email: 'chris@dr-resources.com', password: 'chris123', name: 'Chris', role: 'user' },
  { email: 'falih@dr-resources.com', password: 'falih123', name: 'Falih', role: 'user' },
  { email: 'jemis@dr-resources.com', password: 'jemis123', name: 'Jemis', role: 'user' },
  { email: 'rafif@dr-resources.com', password: 'rafif123', name: 'Rafif', role: 'user' },
  { email: 'rakha@dr-resources.com', password: 'rakha123', name: 'Rakha', role: 'user' },
  { email: 'yovan@dr-resources.com', password: 'yovan123', name: 'Yovan', role: 'user' },
  { email: 'landhung@dr-resources.com', password: 'landhung123', name: 'Landhung', role: 'user' },
  { email: 'iqbal@dr-resources.com', password: 'iqbal123', name: 'Iqbal', role: 'user' },
];

export async function GET() {
  return handleSeed();
}

export async function POST() {
  return handleSeed();
}

async function handleSeed() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not set in .env.local' },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: { email: string; created: boolean; error?: string }[] = [];

  for (const u of SEED_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });

    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        results.push({ email: u.email, created: false, error: 'already exists' });
      } else {
        results.push({ email: u.email, created: false, error: error.message });
      }
    } else if (data.user) {
      await supabase
        .from('profiles')
        .update({ role: u.role, name: u.name })
        .eq('id', data.user.id);

      results.push({ email: u.email, created: true });
    }
  }

  return NextResponse.json({ results });
}

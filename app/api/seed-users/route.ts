import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SEED_USERS = [
  { email: 'hasyim@dr-resources.com', password: 'hasyim123', name: 'Hasyim', role: 'admin' },
  { email: 'irzaldi@dr-resources.com', password: 'irzaldi123', name: 'Irzaldi', role: 'admin' },
  { email: 'daabison@dr-resources.com', password: 'daabison123', name: 'Daabison', role: 'admin' },
  { email: 'bernardo@dr-resources.com', password: 'kontolodon1', name: 'Bernardo', role: 'user' },
  { email: 'chris@dr-resources.com', password: 'chris123', name: 'Chris', role: 'user' },
  { email: 'falih@dr-resources.com', password: 'falih123', name: 'Falih', role: 'user' },
  { email: 'jemis@dr-resources.com', password: 'jemis123', name: 'Jemis', role: 'user' },
  { email: 'rafif@dr-resources.com', password: 'rafif123', name: 'Rafif', role: 'user' },
  { email: 'rakha@dr-resources.com', password: 'rakha123', name: 'Rakha', role: 'user' },
  { email: 'yovan@dr-resources.com', password: 'yovan123', name: 'Yovan', role: 'user' },
  { email: 'landhung@dr-resources.com', password: 'landhung123', name: 'Landhung', role: 'user' },
  { email: 'iqbal@dr-resources.com', password: 'iqbal123', name: 'Iqbal', role: 'user' },
  { email: 'fidel@dr-resources.com', password: 'fidel123', name: 'Fidel', role: 'user' },
  { email: 'dika@dr-resources.com', password: 'dika123', name: 'Dika', role: 'admin' },
];

const GAME_ACCOUNTS_SEED = [
  // Owner: Bernardo
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Daiy', tp: 17, sh: 16 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Max S1', tp: 16, sh: 12 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Max S1', tp: 16, sh: 12 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Max F1', tp: 16, sh: 12 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Max W1', tp: 16, sh: 12 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Max W1', tp: 16, sh: 12 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Plerrr', tp: 17, sh: 16 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Plerrr2', tp: 17, sh: 16 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Plerrr3', tp: 17, sh: 16 },
  { ownerEmail: 'bernardo@dr-resources.com', name: 'Plerrr4', tp: 17, sh: 16 },

  // Owner: Fidel
  { ownerEmail: 'fidel@dr-resources.com', name: 'Albedo a baddie', tp: 16, sh: 11 },
  { ownerEmail: 'fidel@dr-resources.com', name: 'MomongaTheGoat', tp: 16, sh: 11 },
  { ownerEmail: 'fidel@dr-resources.com', name: 'AlbedoABadBihh', tp: 16, sh: 11 },
  { ownerEmail: 'fidel@dr-resources.com', name: 'ninenine Albedo', tp: 16, sh: 11 },
  { ownerEmail: 'fidel@dr-resources.com', name: 'Ados nu 11111', tp: 17, sh: 12 },
  { ownerEmail: 'fidel@dr-resources.com', name: 'Ados nu 2222', tp: 17, sh: 12 },

  // Owner: Dika
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPerenang', tp: 16, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPengurus', tp: 16, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'kaskus3', tp: 16, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'goodluckW', tp: 16, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPembunuh', tp: 17, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPemain', tp: 17, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPelaut', tp: 16, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPemerkosa', tp: 16, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPetani', tp: 14, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'hitamPelari', tp: 14, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPemacul', tp: 16, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'HitamPerokok', tp: 16, sh: 11 },
  { ownerEmail: 'dika@dr-resources.com', name: 'Ijat', tp: 17, sh: 12 },
  { ownerEmail: 'dika@dr-resources.com', name: 'Jul', tp: 17, sh: 12 },

  // Owner: Yovan
  { ownerEmail: 'yovan@dr-resources.com', name: 'Genkakuu', tp: 17, sh: 17 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'auraka guy', tp: 17, sh: 17 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'kim un jong', tp: 17, sh: 14 },
  { ownerEmail: 'yovan@dr-resources.com', name: '1noturbina', tp: 17, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'FluZ Guy', tp: 17, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'Madon 01', tp: 17, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'Makan Nasi', tp: 17, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'Wadimor', tp: 16, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'ipin02', tp: 17, sh: 11 },
  { ownerEmail: 'yovan@dr-resources.com', name: 'upin10', tp: 17, sh: 11 }
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

  // Seed Users
  for (const u of SEED_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });

    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        // If user already exists, update their password and metadata to be sure!
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existingUser = userList?.users.find(usr => usr.email?.toLowerCase() === u.email.toLowerCase());
        if (existingUser) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
            password: u.password,
            user_metadata: { name: u.name, role: u.role }
          });
          
          // Force update profile table as well
          await supabase
            .from('profiles')
            .upsert({ id: existingUser.id, email: u.email, name: u.name, role: u.role });

          if (updateErr) {
            results.push({ email: u.email, created: false, error: `exists, password update error: ${updateErr.message}` });
          } else {
            results.push({ email: u.email, created: false, error: `already exists (updated password & profile)` });
          }
        } else {
          results.push({ email: u.email, created: false, error: 'already exists' });
        }
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

  // Get Profiles to Map Emails to IDs
  const { data: profiles } = await supabase.from('profiles').select('id, email');
  const profileMap = new Map(profiles?.map(p => [p.email.toLowerCase(), p.id]) || []);

  // Seed Kingdom
  let kingdomId: number | null = null;
  const { data: existingKingdom } = await supabase
    .from('kingdoms')
    .select('id')
    .eq('name', 'KD 4101')
    .maybeSingle();

  if (existingKingdom) {
    kingdomId = existingKingdom.id;
  } else {
    const { data: newKingdom, error: kErr } = await supabase
      .from('kingdoms')
      .insert({ name: 'KD 4101', color_hex: '#2BB673' })
      .select('id')
      .single();
    
    if (kErr) {
      console.error('Error creating kingdom:', kErr);
    } else if (newKingdom) {
      kingdomId = newKingdom.id;
    }
  }

  const accountResults: { name: string; success: boolean; error?: string }[] = [];
  
  if (kingdomId) {
    // Delete existing game accounts for the seeded users under this kingdom to refresh
    const targetEmails = ['bernardo@dr-resources.com', 'fidel@dr-resources.com', 'dika@dr-resources.com', 'yovan@dr-resources.com'];
    const ownerIds = targetEmails
      .map(e => profileMap.get(e.toLowerCase()))
      .filter((id): id is string => !!id);

    if (ownerIds.length > 0) {
      await supabase
        .from('game_accounts')
        .delete()
        .eq('kingdom_id', kingdomId)
        .in('user_id', ownerIds);
    }

    // Insert Game Accounts & Resource Stocks
    for (const acc of GAME_ACCOUNTS_SEED) {
      const userId = profileMap.get(acc.ownerEmail.toLowerCase());
      if (!userId) {
        accountResults.push({ name: acc.name, success: false, error: `Owner ${acc.ownerEmail} profile not found` });
        continue;
      }

      const { data: newAcc, error: accErr } = await supabase
        .from('game_accounts')
        .insert({
          user_id: userId,
          kingdom_id: kingdomId,
          name: acc.name,
          type: 'main',
          trading_post_level: acc.tp,
          storehouse_level: acc.sh,
        })
        .select('id')
        .single();

      if (accErr) {
        accountResults.push({ name: acc.name, success: false, error: accErr.message });
      } else if (newAcc) {
        const { error: stockErr } = await supabase
          .from('resource_stocks')
          .insert({ game_account_id: newAcc.id });
        
        if (stockErr) {
          accountResults.push({ name: acc.name, success: true, error: `Stock error: ${stockErr.message}` });
        } else {
          accountResults.push({ name: acc.name, success: true });
        }
      }
    }
  }

  return NextResponse.json({
    users: results,
    kingdomId,
    accounts: {
      total: GAME_ACCOUNTS_SEED.length,
      results: accountResults
    }
  });
}

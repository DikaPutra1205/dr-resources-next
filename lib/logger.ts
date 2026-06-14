import { createClient } from './supabase/client';

export async function log(action: string, details?: Record<string, any>, userId?: string) {
  try {
    const supabase = createClient();
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase.from('activity_logs').insert({
      user_id: uid,
      action,
      details: details || null,
    });
  } catch {
    // silent fail — logging should never break the app
  }
}

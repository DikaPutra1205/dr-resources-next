import { createClient } from './supabase/client';

export async function log(action: string, details?: Record<string, unknown>, userId?: string) {
  try {
    const supabase = createClient();
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) {
      console.warn(`[activity-log] Skipping "${action}" — no user ID`);
      return;
    }
    const { error } = await supabase.from('activity_logs').insert({
      user_id: uid,
      action,
      details: details || null,
    });
    if (error) {
      console.warn(`[activity-log] Failed to log "${action}":`, error.message);
    }
  } catch (err) {
    console.warn(`[activity-log] Error logging "${action}":`, err);
  }
}

import { createClient } from './supabase/client';

export async function log(action: string, details?: Record<string, any>) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      details: details || null,
    });
  } catch {
    // silent fail — logging should never break the app
  }
}

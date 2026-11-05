import { supabase } from '@/lib/supabase';

export const MAX_DISPLAY_NAME_LENGTH = 40;

/** Your display name: what others see on pages and in groups. */
export async function getMyDisplayName(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single<{ display_name: string }>();
  if (error) throw error;
  return data.display_name;
}

/**
 * Changes your display name, and your name on any page rows still showing
 * the old one (names an admin changed on a page are kept).
 */
export async function setDisplayName(name: string) {
  const { error } = await supabase.rpc('set_display_name', { new_name: name });
  if (error) throw error;
}

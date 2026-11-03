import { supabase } from '@/lib/supabase';

export type Role = 'admin' | 'member';

export type Group = {
  id: string;
  name: string;
  invite_code: string;
};

export type MyGroup = Group & { role: Role };

export type Member = {
  user_id: string;
  role: Role;
  display_name: string;
};

/** Groups the signed-in user belongs to, newest first. */
export async function listMyGroups(userId: string): Promise<MyGroup[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, joined_at, groups (id, name, invite_code)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .overrideTypes<{ role: Role; groups: Group }[], { merge: false }>();
  if (error) throw error;
  return data.map(({ role, groups }) => ({ ...groups, role }));
}

export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .single<Group>();
  if (error) throw error;
  return data;
}

/** Members of a group with their display names, admins first. */
export async function listMembers(groupId: string): Promise<Member[]> {
  const { data: members, error } = await supabase
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', groupId)
    .order('joined_at')
    .overrideTypes<{ user_id: string; role: Role }[], { merge: false }>();
  if (error) throw error;

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in(
      'id',
      members.map((m) => m.user_id),
    )
    .overrideTypes<{ id: string; display_name: string }[], { merge: false }>();
  if (profilesError) throw profilesError;

  const names = new Map(profiles.map((p) => [p.id, p.display_name]));
  return members
    .map((m) => ({ ...m, display_name: names.get(m.user_id) || 'Unnamed' }))
    .sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin'));
}

/** Creates a group with the caller as admin. */
export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase
    .rpc('create_group', { group_name: name })
    .single<Group>();
  if (error) throw error;
  return data;
}

/** Joins the group with this invite code. Joining twice is harmless. */
export async function joinGroup(code: string): Promise<Group> {
  const { data, error } = await supabase.rpc('join_group', { code }).single<Group>();
  if (error) throw error;
  return data;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Deletes the group and everything in it. Admins only. */
export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

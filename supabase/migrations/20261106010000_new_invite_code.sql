-- Let admins replace a group's invite code, e.g. if it was shared too
-- widely. The old code (and invite links using it) stops working at once.
-- People already in the group stay in it.
create function public.new_invite_code(gid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_group_admin(gid) then
    raise exception 'Only admins can make a new invite code';
  end if;

  -- Same format as new groups get. Try again in the unlikely case the
  -- random code is already another group's.
  for attempt in 1..5 loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      update public.groups set invite_code = code where id = gid;
      return code;
    exception when unique_violation then
      -- Pick another.
    end;
  end loop;
  raise exception 'Couldn''t make a new code. Please try again.';
end;
$$;

revoke execute on function public.new_invite_code(uuid) from public, anon;
grant execute on function public.new_invite_code(uuid) to authenticated;

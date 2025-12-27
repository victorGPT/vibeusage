-- Link code exchange RPC (atomic claim + device/token issuance)
-- Change: 2025-12-27-add-link-code-init

create or replace function public.vibescore_exchange_link_code(
  p_code_hash text,
  p_device_id uuid,
  p_device_name text,
  p_platform text,
  p_token_id uuid,
  p_token_hash text
)
returns table (
  user_id uuid,
  device_id uuid,
  used_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_used_at timestamptz := now();
begin
  update public.vibescore_tracker_link_codes
    set used_at = v_used_at,
        device_id = p_device_id
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > v_used_at
  returning user_id into v_user_id;

  if v_user_id is null then
    return;
  end if;

  insert into public.vibescore_tracker_devices (id, user_id, device_name, platform)
  values (p_device_id, v_user_id, p_device_name, p_platform);

  insert into public.vibescore_tracker_device_tokens (id, user_id, device_id, token_hash)
  values (p_token_id, v_user_id, p_device_id, p_token_hash);

  return query
  select v_user_id, p_device_id, v_used_at;
end;
$$;

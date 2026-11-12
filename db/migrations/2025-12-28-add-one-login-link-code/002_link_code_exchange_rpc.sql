-- VibeScore link code exchange RPC
-- Change: 2025-12-28-add-one-login-link-code

create or replace function public.vibescore_exchange_link_code(
  p_code_hash text,
  p_request_id text,
  p_device_name text,
  p_platform text,
  p_token_hash text
)
returns table (
  user_id uuid,
  device_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_device_id uuid;
begin
  if p_code_hash is null or length(trim(p_code_hash)) = 0 then
    raise exception 'missing code_hash';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception 'missing request_id';
  end if;
  if p_token_hash is null or length(trim(p_token_hash)) = 0 then
    raise exception 'missing token_hash';
  end if;

  select * into v_row
  from public.vibescore_link_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    raise exception 'invalid link code';
  end if;

  if v_row.used_at is not null then
    if v_row.request_id = p_request_id then
      return query select v_row.user_id, v_row.device_id;
    end if;
    raise exception 'link code already used';
  end if;

  if v_row.expires_at < now() then
    raise exception 'link code expired';
  end if;

  v_device_id := gen_random_uuid();

  insert into public.vibescore_tracker_devices (id, user_id, device_name, platform)
  values (
    v_device_id,
    v_row.user_id,
    coalesce(nullif(trim(p_device_name), ''), 'VibeScore CLI'),
    coalesce(nullif(trim(p_platform), ''), 'macos')
  );

  insert into public.vibescore_tracker_device_tokens (id, user_id, device_id, token_hash)
  values (gen_random_uuid(), v_row.user_id, v_device_id, p_token_hash);

  update public.vibescore_link_codes
  set used_at = now(), request_id = p_request_id, device_id = v_device_id
  where id = v_row.id;

  return query select v_row.user_id, v_device_id;
end;
$$;

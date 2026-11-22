-- REVIEW ONLY. Execute separately in each company's project after staging review.
-- Requires a private birch_internal.posted_checkouts mapping table with:
-- checkout_id text PK, request_hash text, sale_id uuid or bigint.
-- Do NOT deploy this as-is: Feasterville mapping table and both posting RPCs
-- must first be finalized. This function is deliberately service-role only.
-- Important: functions in public are in the exposed API schema; revoke PUBLIC
-- execute and grant only service_role. Caller must be trusted backend.
create or replace function public.birch_lookup_posted_checkout(p_checkout_id text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v record;
begin
 if p_checkout_id is null or p_checkout_id !~ '^[-a-zA-Z0-9_]{8,100}$' then
  raise exception 'Invalid checkout ID';
 end if;
 select checkout_id,request_hash,sale_id into v
 from birch_internal.posted_checkouts where checkout_id=p_checkout_id;
 if not found then return null; end if;
 return jsonb_build_object(
  'checkout_id',v.checkout_id,
  'request_hash',v.request_hash,
  'sale_reference',v.sale_id::text
 );
end;
$$;
revoke all on function public.birch_lookup_posted_checkout(text) from public,anon,authenticated;
grant execute on function public.birch_lookup_posted_checkout(text) to service_role;
-- Grant SELECT on private mapping only to service_role, with RLS reviewed.
-- Verify anon/authenticated EXECUTE denied in staging before deployment.

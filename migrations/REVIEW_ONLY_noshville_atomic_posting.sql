-- REVIEW-ONLY. Noshville project only. DO NOT DEPLOY without staging tests.
-- Private schema, service-role backend only; never expose this RPC to the browser.
create schema if not exists birch_internal;
revoke all on schema birch_internal from public, anon, authenticated;
grant usage on schema birch_internal to service_role;

create table if not exists birch_internal.posted_checkouts (
 checkout_id text primary key,
 sale_id uuid not null unique references public.sales(id),
 request_hash text not null,
 payment_reference text not null,
 cashier_identity uuid not null,
 expected_company_total numeric(14,2) not null,
 created_at timestamptz not null default now()
);
revoke all on birch_internal.posted_checkouts from public, anon, authenticated;
grant select,insert on birch_internal.posted_checkouts to service_role;

-- IMPORTANT: DO NOT DEPLOY YET. Parameters below are caller assertions, NOT proof
-- of external payment or authorization. Coordinator payment verification, immutable
-- request payload hashing, verified tender allocation and cashier identity mapping
-- are not integrated. This SQL alone is NOT safe for live payments.
-- p_lines is a backend-validated immutable snapshot. All prices are re-read from
-- Noshville products. Do not accept price/cost from the client.
create or replace function birch_internal.post_noshville_sale(
 p_checkout_id text,
 p_request_hash text,
 p_lines jsonb,
 p_expected_company_total numeric,
 p_payment_reference text,
 p_cashier_identity uuid,
 p_payment_method public.payment_method default 'other'
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
 v_prior record;
 v_sale_id uuid;
 v_total numeric(14,2);
 v_expected numeric(14,2);
 v_line jsonb;
 v_product record;
 v_required record;
begin
 if p_expected_company_total is null or p_expected_company_total<=0
    or p_expected_company_total<>round(p_expected_company_total,2)
    or nullif(trim(p_payment_reference),'') is null
    or p_cashier_identity is null then
  raise exception 'Missing verified company amount, payment reference or cashier';
 end if;
 if p_checkout_id is null or p_checkout_id !~ '^[-a-zA-Z0-9_]{8,100}$' or coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid checkout identity';
 end if;
 if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then
  raise exception 'Missing Noshville lines';
 end if;
 -- Serializes concurrent retries for the same checkout ID.
 perform pg_advisory_xact_lock(hashtextextended(p_checkout_id, 981247));
 select * into v_prior from birch_internal.posted_checkouts where checkout_id=p_checkout_id;
 if found then
  if v_prior.request_hash <> p_request_hash or v_prior.payment_reference <> p_payment_reference or v_prior.cashier_identity <> p_cashier_identity or v_prior.expected_company_total <> p_expected_company_total then raise exception 'Checkout identity conflict'; end if;
  return jsonb_build_object('sale_reference',v_prior.sale_id::text,'already_posted',true);
 end if;
 -- Aggregate and lock ALL required parent/child stock rows in stable order.
 -- Fail closed if products are inactive, missing or insufficient.
 if exists (
  select 1 from jsonb_array_elements(p_lines) x
  where (x->>'product_id') is null or
        (x->>'quantity') !~ '^[1-9][0-9]*$' or
        (x->>'quantity')::numeric > 10000 or
        (x->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 ) then raise exception 'Invalid sale lines'; end if;
 -- Lock every referenced product and its parent. SELECT FOR UPDATE with ORDER BY
 -- is performed in a subquery to ensure stable locking sequence.
 perform 1 from public.products p
 where p.id in (
  select (x->>'product_id')::uuid from jsonb_array_elements(p_lines) x
  union
  select stock_parent_product_id from public.products where id in
   (select (x->>'product_id')::uuid from jsonb_array_elements(p_lines) x)
 ) order by p.id for update;
 if (select count(distinct p.id) from public.products p where p.id in
     (select (x->>'product_id')::uuid from jsonb_array_elements(p_lines) x))
   <> (select count(distinct (x->>'product_id')::uuid) from jsonb_array_elements(p_lines) x)
 then raise exception 'Unknown product'; end if;
 if exists (
  select 1 from public.products p
  join (select distinct (x->>'product_id')::uuid id from jsonb_array_elements(p_lines) x) s on s.id=p.id
  where p.is_active is not true or p.sellable_active is not true
 ) then raise exception 'Product unavailable'; end if;
 -- Include linked pack/loose products and aggregate stock requirements.
 for v_required in
  select coalesce(p.stock_parent_product_id,
         case when p.track_stock then p.id else null end) stock_id,
         sum((x->>'quantity')::numeric *
           case when p.stock_parent_product_id is not null then p.stock_multiplier else 1 end) qty
  from jsonb_array_elements(p_lines) x
  join public.products p on p.id=(x->>'product_id')::uuid
  group by 1
 loop
  if v_required.stock_id is not null then
   if v_required.qty is null or v_required.qty<=0 or not exists (
    select 1 from public.products p
    where p.id=v_required.stock_id and p.stock_qty>=v_required.qty
   ) then raise exception 'Insufficient stock'; end if;
  end if;
 end loop;
 select sum(round(p.selling_price * (x->>'quantity')::numeric,2))
 into v_total from jsonb_array_elements(p_lines) x
 join public.products p on p.id=(x->>'product_id')::uuid;
 if v_total is null or v_total<=0 or v_total<>p_expected_company_total then raise exception 'Company total mismatch'; end if;
 -- Uses the existing Noshville sequence, not MAX(order_no)+1.
 insert into public.sales(order_no,cashier_id,payment_method,subtotal,total_amount,status)
 values (nextval('public.sales_order_no_seq'),p_cashier_identity,p_payment_method,v_total,v_total,'completed')
 returning id into v_sale_id;
 -- Existing trg_sale_item_stock handles BOTH stock deduction and movement ledger.
 insert into public.sale_items(sale_id,product_id,description,quantity,unit_cost,unit_price,line_total,line_cost)
 select v_sale_id,p.id,p.name,(x->>'quantity')::numeric,p.cost_price,p.selling_price,
        round(p.selling_price*(x->>'quantity')::numeric,2),
        round(p.cost_price*(x->>'quantity')::numeric,2)
 from jsonb_array_elements(p_lines) x
 join public.products p on p.id=(x->>'product_id')::uuid;
 insert into birch_internal.posted_checkouts(checkout_id,sale_id,request_hash,payment_reference,cashier_identity,expected_company_total)
 values(p_checkout_id,v_sale_id,p_request_hash,p_payment_reference,p_cashier_identity,p_expected_company_total);
 return jsonb_build_object('sale_reference',v_sale_id::text,'already_posted',false);
end $$;
revoke all on function birch_internal.post_noshville_sale(text,text,jsonb,numeric,text,uuid,public.payment_method) from public,anon,authenticated;
grant execute on function birch_internal.post_noshville_sale(text,text,jsonb,numeric,text,uuid,public.payment_method) to service_role;
-- SECURITY GATE: function is intentionally in an unexposed schema. Backend must
-- call it via a reviewed server-only DB channel; public PostgREST RPC cannot reach it.
-- Verify stock-parent trigger behavior, sequence permissions, and accounting mapping
-- in staging before running this migration. No card capture is performed here.

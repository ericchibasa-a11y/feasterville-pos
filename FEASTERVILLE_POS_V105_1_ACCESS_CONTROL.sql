-- FEASTERVILLE POS V105.1 — Inventory Controller Production Input write access
-- Apply only if the live database does not already have these policies.

drop policy if exists store_inputs_inventory_control_insert on public.pos_store_production_inputs;
create policy store_inputs_inventory_control_insert
on public.pos_store_production_inputs
for insert to authenticated
with check (
  exists (
    select 1 from public.pos_profiles p
    where p.user_id=(select auth.uid())
      and p.role='inventory_control'
      and coalesce(p.active,true)
      and p.store_code=pos_store_production_inputs.store_code
  )
);

drop policy if exists store_inputs_inventory_control_update on public.pos_store_production_inputs;
create policy store_inputs_inventory_control_update
on public.pos_store_production_inputs
for update to authenticated
using (
  exists (
    select 1 from public.pos_profiles p
    where p.user_id=(select auth.uid())
      and p.role='inventory_control'
      and coalesce(p.active,true)
      and p.store_code=pos_store_production_inputs.store_code
  )
)
with check (
  exists (
    select 1 from public.pos_profiles p
    where p.user_id=(select auth.uid())
      and p.role='inventory_control'
      and coalesce(p.active,true)
      and p.store_code=pos_store_production_inputs.store_code
  )
);

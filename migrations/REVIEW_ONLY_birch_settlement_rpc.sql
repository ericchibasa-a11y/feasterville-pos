-- REVIEW ONLY — DO NOT DEPLOY. Requires coordinator and transfer tables in isolated staging.
-- Called ONLY by a trusted server after independent Feasterville manager authentication.
-- Recording a transfer is an accounting entry, NOT an instruction to send money.
-- Recheck accountant/card-merchant approval and test concurrent requests before launch.
create or replace function public.birch_record_manual_transfer(
 p_amount numeric, p_bank_reference text, p_transfer_date date, p_manager_id uuid
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
 v_due numeric(14,2);
 v_paid numeric(14,2);
 v_id uuid;
begin
 if p_manager_id is null or p_amount is null or p_amount <= 0 or
    p_amount <> round(p_amount,2) or p_transfer_date is null or
    p_bank_reference is null or length(trim(p_bank_reference)) not between 1 and 120 then
   raise exception 'Invalid manual transfer details';
 end if;
 -- One lock per Birch Acres settlement ledger. Every writer must use this RPC.
 perform pg_advisory_xact_lock(2142026, 1);
 -- Cash is allocated first to Feasterville, then to Noshville.
 -- Noshville card proceeds collected by Feasterville create the payable.
 select coalesce(sum(least(noshville_amount,card_amount)),0)
 into v_due
 from public.birch_checkout_jobs
 where store_code='BIRCH_ACRES' and state='completed'
   and (feasterville_amount=0 or feasterville_sale_reference is not null)
   and (noshville_amount=0 or noshville_sale_reference is not null);
 select coalesce(sum(amount),0) into v_paid
 from public.birch_intercompany_transfers
 where store_code='BIRCH_ACRES' and from_company='feasterville' and to_company='noshville';
 if v_paid + p_amount > v_due then
   raise exception 'Manual transfer exceeds outstanding payable';
 end if;
 insert into public.birch_intercompany_transfers
 (amount,bank_reference,transfer_date,recorded_by)
 values (p_amount,trim(p_bank_reference),p_transfer_date,p_manager_id)
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.birch_record_manual_transfer(numeric,text,date,uuid) from public,anon,authenticated;
-- No direct authenticated/browser grant. Server-only role permissions require
-- explicit review; trusted server must verify manager and bank evidence.

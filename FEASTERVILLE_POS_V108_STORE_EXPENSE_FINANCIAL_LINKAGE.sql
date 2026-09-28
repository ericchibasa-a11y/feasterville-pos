-- V108/V109/V110 consolidated source-control migration
-- Links pos_store_operating_expenses to P&L, GL/TB, bank book, and cash-up controls.

alter table public.pos_store_operating_expenses
  add column if not exists bank_account_id bigint references public.pos_bank_accounts(id) on delete set null;

alter table public.pos_store_expenses
  add column if not exists source_operating_expense_id bigint;

create unique index if not exists uq_pos_store_expenses_source_operating_expense
  on public.pos_store_expenses(source_operating_expense_id)
  where source_operating_expense_id is not null;

insert into public.acc_accounts(code,name,account_type,normal_balance,statement_section,active,system_account)
select '1060','Outside Cash / Petty Cash','ASSET','DEBIT','Current Assets',true,true
where not exists (select 1 from public.acc_accounts where code='1060');

insert into public.acc_accounts(code,name,account_type,normal_balance,statement_section,active,system_account)
select '2210','Owner Funds Payable','LIABILITY','CREDIT','Liabilities',true,true
where not exists (select 1 from public.acc_accounts where code='2210');

create or replace function public.acc_expense_credit_code(p_payment text)
returns text language sql immutable as $$
  select case
    when upper(trim(coalesce(p_payment,''))) in ('CASH','CASH DRAWER') then '1000'
    when upper(trim(coalesce(p_payment,''))) in ('OUTSIDE CASH','PETTY CASH') then '1060'
    when upper(trim(coalesce(p_payment,''))) in ('OWNER/PERSONAL FUNDS','OWNER FUNDS','PERSONAL FUNDS') then '2210'
    when upper(trim(coalesce(p_payment,''))) in ('CARD','BANK','BUSINESS BANK/CARD','BUSINESS BANK','BANK CARD') then '1010'
    else '1010'
  end;
$$;

create or replace function public.sync_operating_expense_to_legacy()
returns trigger language plpgsql security definer set search_path='public' as $$
declare
  v_payment text;
  v_bank_account_id bigint;
  v_active_bank_count integer;
begin
  v_payment := case
    when new.payment_method='Business Bank/Card' then 'Bank'
    when new.payment_method='Cash Drawer' then 'Cash'
    else new.payment_method
  end;

  insert into public.pos_store_expenses(
    store_code,expense_date,category,supplier,description,payment_method,amount,reference,created_by,source_operating_expense_id
  ) values (
    new.store_code,new.expense_date,new.category,new.supplier_payee,
    coalesce(nullif(new.notes,''),new.category),v_payment,new.amount,new.reference,new.created_by,new.id
  )
  on conflict (source_operating_expense_id) where source_operating_expense_id is not null
  do update set
    store_code=excluded.store_code,expense_date=excluded.expense_date,category=excluded.category,
    supplier=excluded.supplier,description=excluded.description,payment_method=excluded.payment_method,
    amount=excluded.amount,reference=excluded.reference;

  if new.payment_method='Business Bank/Card' then
    v_bank_account_id := new.bank_account_id;
    if v_bank_account_id is null then
      select count(*), min(id) into v_active_bank_count, v_bank_account_id
      from public.pos_bank_accounts where active=true;
      if v_active_bank_count <> 1 then v_bank_account_id := null; end if;
    end if;
    if v_bank_account_id is not null then
      insert into public.pos_bank_book_entries(
        bank_account_id,store_code,transaction_date,category,description,reference,debit,credit,notes,created_by,
        counter_account_code,acc_counter_account_code
      )
      select v_bank_account_id,new.store_code,new.expense_date,new.category,
             coalesce(new.supplier_payee,new.category),new.reference,new.amount,0,
             'Auto-created from Store Operating Expense #'||new.id,new.created_by,
             public.acc_expense_debit_code(new.category,new.notes),public.acc_expense_debit_code(new.category,new.notes)
      where not exists (
        select 1 from public.pos_bank_book_entries b
        where b.notes='Auto-created from Store Operating Expense #'||new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_operating_expense_to_legacy on public.pos_store_operating_expenses;
create trigger trg_sync_operating_expense_to_legacy
after insert or update on public.pos_store_operating_expenses
for each row execute function public.sync_operating_expense_to_legacy();

create or replace function public.post_operating_expense_to_gl()
returns trigger language plpgsql security definer set search_path='public' as $$
declare
  v_exp public.pos_store_expenses%rowtype;
  v_journal_id bigint;
  v_debit_code text;
  v_credit_code text;
begin
  select * into v_exp from public.pos_store_expenses where source_operating_expense_id=new.id limit 1;
  if v_exp.id is null then return new; end if;
  if exists(select 1 from public.acc_journals j where j.source_type='STORE_EXPENSE' and j.source_id=v_exp.id::text) then return new; end if;
  v_debit_code:=public.acc_expense_debit_code(v_exp.category,v_exp.description);
  v_credit_code:=public.acc_expense_credit_code(new.payment_method);
  insert into public.acc_journals(journal_date,description,reference,source_type,source_id,store_code,status,created_by,posted_by)
  values(v_exp.expense_date,coalesce(v_exp.description,v_exp.category,'Store expense'),v_exp.reference,'STORE_EXPENSE',v_exp.id::text,v_exp.store_code,'DRAFT',new.created_by,new.created_by)
  returning id into v_journal_id;
  insert into public.acc_journal_lines(journal_id,line_no,account_id,description,debit,credit,store_code,source_ref) values
    (v_journal_id,1,public.acc_account_id(v_debit_code),coalesce(v_exp.category,'Expense'),round(v_exp.amount,2),0,v_exp.store_code,'pos_store_expenses:'||v_exp.id),
    (v_journal_id,2,public.acc_account_id(v_credit_code),'Payment - '||coalesce(new.payment_method,'Other'),0,round(v_exp.amount,2),v_exp.store_code,'pos_store_expenses:'||v_exp.id);
  update public.acc_journals set status='POSTED',posted_at=now(),updated_at=now() where id=v_journal_id;
  return new;
end;
$$;

drop trigger if exists trg_post_operating_expense_to_gl on public.pos_store_operating_expenses;
create trigger trg_post_operating_expense_to_gl
after insert or update on public.pos_store_operating_expenses
for each row execute function public.post_operating_expense_to_gl();

create or replace function public.apply_operating_cash_drawer_expenses_to_cashup()
returns trigger language plpgsql security definer set search_path='public' as $$
declare
  v_existing numeric:=0;
  v_modal_expenses numeric:=0;
begin
  select coalesce(sum(amount),0) into v_existing
  from public.pos_store_operating_expenses
  where store_code=new.store_code and expense_date=new.cashup_date and payment_method='Cash Drawer';
  v_modal_expenses:=greatest(0,coalesce(new.cash_sales,0)+coalesce(new.opening_float,0)-coalesce(new.expected_cash,0));
  new.expected_cash:=coalesce(new.cash_sales,0)+coalesce(new.opening_float,0)-v_modal_expenses-v_existing;
  new.variance:=coalesce(new.actual_cash,0)-new.expected_cash;
  return new;
end;
$$;

drop trigger if exists trg_apply_operating_cash_drawer_expenses_to_cashup on public.pos_daily_cashups;
create trigger trg_apply_operating_cash_drawer_expenses_to_cashup
before insert on public.pos_daily_cashups
for each row execute function public.apply_operating_cash_drawer_expenses_to_cashup();

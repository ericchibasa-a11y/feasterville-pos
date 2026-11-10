-- Read-only financial reconciliation preview. Do not replace posted accounting journals.
-- Run as a SELECT query first. Fixed commitments are deliberately excluded until posted/verified.
WITH pos AS (
 SELECT date_trunc('month', sale_date)::date AS month_start, store_code,
        count(*) AS sale_count, round(sum(total),2) AS pos_revenue
 FROM public.pos_sales
 GROUP BY 1,2
), cashups AS (
 SELECT date_trunc('month', cashup_date)::date AS month_start, store_code,
        count(*) AS cashup_count, round(sum(total_sales),2) AS cashup_revenue
 FROM public.pos_daily_cashups
 GROUP BY 1,2
), accounting AS (
 SELECT month_start,store_code,revenue AS posted_revenue,cost_of_sales,
        operating_expenses AS posted_operating_expenses,missing_cost_inputs
 FROM public.acc_v_financial_profit_loss_monthly
), keys AS (
 SELECT month_start,store_code FROM pos
 UNION SELECT month_start,store_code FROM cashups
 UNION SELECT month_start,store_code FROM accounting
)
SELECT k.month_start,k.store_code,
       coalesce(p.sale_count,0) AS sale_count,
       coalesce(p.pos_revenue,0) AS pos_revenue,
       coalesce(c.cashup_count,0) AS cashup_count,
       coalesce(c.cashup_revenue,0) AS cashup_revenue,
       round(coalesce(p.pos_revenue,0)-coalesce(c.cashup_revenue,0),2) AS pos_vs_cashup_difference,
       coalesce(a.posted_revenue,0) AS posted_revenue,
       round(coalesce(p.pos_revenue,0)-coalesce(a.posted_revenue,0),2) AS unposted_or_unmatched_revenue,
       coalesce(a.cost_of_sales,0) AS estimated_cost_of_sales,
       coalesce(a.posted_operating_expenses,0) AS posted_operating_expenses,
       coalesce(a.missing_cost_inputs,0) AS missing_cost_inputs,
       round(coalesce(p.pos_revenue,0)-coalesce(a.cost_of_sales,0)-coalesce(a.posted_operating_expenses,0),2) AS provisional_contribution,
       CASE WHEN p.sale_count IS NULL THEN 'NO_POS_SALES'
            WHEN coalesce(a.missing_cost_inputs,0)>0 THEN 'INCOMPLETE_COSTS'
            WHEN coalesce(p.pos_revenue,0)<>coalesce(c.cashup_revenue,0) THEN 'CASHUP_MISMATCH'
            WHEN coalesce(p.pos_revenue,0)<>coalesce(a.posted_revenue,0) THEN 'JOURNAL_MISMATCH'
            ELSE 'REVIEW_EXPENSE_COMPLETENESS' END AS review_status
FROM keys k
LEFT JOIN pos p USING(month_start,store_code)
LEFT JOIN cashups c USING(month_start,store_code)
LEFT JOIN accounting a USING(month_start,store_code)
ORDER BY k.month_start,k.store_code;

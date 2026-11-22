# Birch Acres Unified Checkout — Safe Integration Specification

Status: DESIGN ONLY. No production checkout or database changes.

## Verified baseline (22 November 2026)
- Feasterville repository: ericchibasa-a11y/feasterville-pos; Supabase Point Of Sale (sflyjcgbxbcwspfuzone).
- Noshville repository: ericchibasa-a11y/noshville-pos; Supabase Noshville POS (gknaqtvkqjwqwkovmajg).
- Both databases have RLS enabled on their public tables.
- Noshville app.js completeSale currently inserts sales header and sale_items separately; item failure can leave a header.
- Noshville profiles currently has zero rows and sales has zero rows in this project. Verify actual deployment/project identity and authentication before integration.
- Feasterville contains existing sales, sale items, store products, cash-ups, and settlements.
- Existing Noshville B2B catalogue must remain independent of customer retail checkout.

## Non-negotiable requirements
1. No merging databases, historical records, stock ownership, company books or legal entities.
2. Birch Acres only. Ndayini and Sivana remain unaffected.
3. One staff-facing interface, combined basket and customer payment; company allocations must reconcile to actual tender.
4. No frontend service-role secrets. Backend validates staff permissions, store and product ownership.
5. Keep current POS production untouched until reconciliation tests pass.

## Proposed architecture
- New backend checkout coordinator with durable order ID, immutable request hash, state machine, append-only event log and per-company postings.
- Server-side authenticated APIs to each Supabase project; do not rely on shared browser sessions between projects.
- State machine: DRAFT -> RESERVED -> PAYMENT_PENDING -> PAYMENT_CONFIRMED -> POSTING -> COMPLETED; failures -> NEEDS_RECONCILIATION / REFUND_PENDING. No claim of atomic transactions across independent databases.
- Each company posting must be idempotent on checkout_id + company_id, using unique constraints and server-side transaction/RPC for sale header + items + stock effects.
- Do not mark paid until verified by the payment provider, or recorded as collected for cash with cashier attribution.
- If one posting succeeds and another fails, persist exception, lock duplicate attempts, retry safely; do not silently refund or reverse without manager authorization.
- Discount and VAT/tax treatment allocated per item and validated against each company's configuration.
- Capture gross tender, change, fees, net settlement, settlement recipient, and intercompany payable/receivable; reconcile by tender and business day.
- Generate one customer summary plus separate company fiscal transaction references; confirm receipt/legal invoicing requirements with accountant.
- Returns, voids, partial refunds, connectivity loss and split tender require explicit workflows.
- RLS on all new exposed tables; no security-definer shortcuts; authorization from trusted server-side role assignments.

## Gate before code implementation
- Confirm Feasterville checkout path, existing sale IDs and inventory deduction semantics.
- Confirm Noshville deployment points to inspected project and investigate zero profile/sales counts.
- Identify actual payment terminal / bank settlement owner and whether one merchant can collect for both entities.
- Review RLS and cash-up schemas and existing card+cash handling.
- Confirm both systems' receipt/tax requirements.
- Back up both projects and establish a test environment with sanitized records.

## Acceptance tests
1. Feasterville-only basket and Noshville-only basket post correctly.
2. Mixed basket: R40 Feasterville + R26 Noshville = R66 gross, with separate sale records and exact allocations.
3. Duplicate checkout request produces exactly one posting per company.
4. Payment succeeds but one company write fails: no duplicate charge; exception appears for manager.
5. Network timeout during checkout: status inquiry and safe resume, no second payment.
6. Refund, partial refund, void and discount preserve audit trail.
7. Cash and card, including mixed tender, reconcile to actual settlement and intercompany balances.
8. Stock, recipes, cost of sales, cash-up and P&L match each company independently.
9. Staff access limited to Birch Acres, management sees both, other stores unaffected.
10. Existing historical transaction counts and totals unchanged after rollout.

## Rollout
Design review -> isolated prototype -> test DBs -> parallel shadow testing -> manager signoff -> limited Birch Acres pilot -> reconciled release. Feature flag OFF by default and rollback to existing separate POS screens.


## Confirmed Birch Acres card settlement arrangement (22 November 2026)
- One physical card terminal is used for the combined premises.
- The card terminal settles **all card payments into Feasterville's bank account**, including card sales of Noshville products.
- A mixed-card sale must therefore create Feasterville card clearing / bank settlement for the full collected amount, but recognize only Feasterville's own sale as Feasterville revenue.
- Noshville recognizes its own retail sale and an intercompany receivable from Feasterville. Feasterville recognizes the matching intercompany payable to Noshville.
- Example: R100 card sale comprising R40 Feasterville and R60 Noshville: Feasterville revenue R40, Noshville revenue R60, intercompany payable/receivable R60 before agreed fees. On actual transfer to Noshville, clear the payable and receivable; do not post a second sale.
- Track terminal batch ID, payment provider transaction reference, gross amount, processing fees, net bank deposit, allocation per company, and transfer settlement reference.
- Confirm accountant-approved fee allocation and merchant/acquirer permission to process both entities through one terminal **before live rollout**.
- Cash collection ownership and physical cash-up arrangements still require confirmation; do not assume cash follows the card settlement rule.


## Confirmed Birch Acres physical cash custody (22 November 2026)
- Birch Acres has **one shared physical cash till box**, held/controlled operationally by Feasterville, as well as one card terminal that settles to Feasterville's bank.
- A single end-of-day physical cash count reconciles total cash tender, cash change, opening float, permitted cash movements, and actual cash on hand.
- Every cash transaction still has two independent company sale allocations. The Noshville portion is **not Feasterville sales revenue**; it is Feasterville's intercompany payable and Noshville's matching receivable.
- Track separate payment types and split tender, company shares, cash float, cash expenses, withdrawals, refunds, cashier, and daily settlement. Avoid double counting Noshville cash in Feasterville revenue or Feasterville inventory.
- Record intercompany transfers only when actually paid and confirmed; show outstanding balance by day and cumulatively.
- Require manager authorization for till adjustments, reversals, manual allocations and settlement reconciliation.
- Confirm accountant-approved custody/agency accounting, tax invoice responsibilities, and cash-control policy before enabling production.

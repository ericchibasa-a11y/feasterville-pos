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


## Manager-only daily cash-up and new-store performance dashboards (22 November 2026)
Confirmed owner requirement: management must see distinct Feasterville and Noshville daily sales and comprehensive performance dashboards, especially for new stores.

### Manager dashboard tabs
1. Feasterville: Birch Acres, Ndayini, Sivana and consolidated sales/P&L; existing reports preserved.
2. Noshville: standalone sales, stock, gross margin, expenses and performance.
3. Birch Acres Combined: company sales side by side; combined sales only as an operational total, never a third legal entity's revenue.
4. Daily Cash-Up: one physical cash drawer and card terminal, with separate Feasterville/Noshville sales allocations; tender, change, opening float, withdrawals, actual cash count, variance, cash/card settlement and cashier.
5. Intercompany Settlement: daily Noshville receivable / Feasterville payable, transfers paid, outstanding cumulative balance, card fees and reconciliation exceptions.

### KPI requirements
- Daily, 7-day, month-to-date, prior-period comparison, targets and trends per company and per Feasterville store.
- Sales count, basket size, tender breakdown, discounts, refunds, gross sales and net sales.
- Product rankings, non-moving items, category performance, stock consumption, recipe-based COGS, gross profit, gross margin, expenses and operating profit when cost data is complete.
- Variances: expected versus actual till, unposted/failed orders, inventory differences, unsettled card receipts and unbalanced intercompany entries.
- Explicit data completeness/health indicators; missing costs or incomplete posting must never be shown as confirmed profit.

### Access
- Manager: all company dashboards, store comparisons, reconciliation and adjustments.
- Salesperson: checkout, tender capture, physical cash count and limited own-shift summary; hide expected till, variance, costs, margins and company-wide dashboards unless explicitly authorized.
- Inventory controller: permitted stock receipt/count tasks only.
- All access enforced server-side, not merely hidden UI.

### Daily close and reporting
- One shared Birch Acres physical cash-up per day with immutable reference and allocations to each company.
- Manager may review company-level daily reports independently of whether the physical drawer is shared.
- Maintain audit trail for edits/reopenings and provide exportable daily/weekly/monthly reports.
- No double counting of Noshville sales as Feasterville revenue or in consolidated views.


## Backend security inspection — 22 November 2026
Inspected deployed Supabase Edge Function inventories (read-only):
- Feasterville functions: feasterville-pos (verify_jwt=false), pos-product-admin (true), feasterville-publish (false), paystack-webhook (false), pos-user-admin (true).
- Noshville: manage-staff (verify_jwt=false).
- A function with verify_jwt=false is not necessarily unauthenticated: webhook handlers may validate provider signatures, and other functions may perform explicit checks. Inspect implementation before drawing conclusions.
- Do **not** reuse any existing function for manager financial reporting or cross-company checkout until its token validation, trusted role authorization, origin checks and input validation have been reviewed.
- Establish a single trusted Birch Acres manager identity mapping; never assume Feasterville JWT grants access to Noshville, or vice versa.
- New integration must authenticate callers and authorize manager/store scope server-side; keep privileged keys in backend-only secrets.
- Security review and end-to-end test execution are release blockers. Draft PR #6 must not be merged until complete.


## Verified live readiness findings (22 November 2026)
Read-only queries against the actual connected Supabase projects:
- Feasterville `pos_stores` has ACTIVE `BIRCH_ACRES`, `NDAYENI`, `SIVANA`; legacy `ENDAYINI` is inactive. Use `BIRCH_ACRES` as exact scope; never guess `BIRCH`.
- Feasterville `pos_sales` contains recent NDAYENI and SIVANA sales; no BIRCH_ACRES sales in the last-seven-day query. This does not prove the store has had no trading outside that range or via another deployment.
- Noshville `public.sales` currently has zero rows, while `public.profiles` has five rows. Before activation confirm that the actual Noshville trading application writes to this project and table. Otherwise financial reports could incorrectly show zero sales.
- User confirmed that their working Feasterville browser address is `https://pos.feasterville.co.za` despite repository name `feasterville-pos`. Do not change a working production domain based solely on the repository name.
- Deployed Feasterville `feasterville-pos` Edge Function was inspected: it serves a separate HTML POS and uses a Supabase user access token; the Noshville `manage-staff` function checks auth token and active manager profile. These are distinct identities and need a deliberate trusted identity bridge.

### Blocking acceptance gates
1. Confirm actual live Noshville sales write destination and Birch Acres inventory/product data.
2. Establish trusted staff identity mapping and server-side authorization, including cashier and manager scopes.
3. Build atomic, idempotent per-company sales and stock posting, durable coordinator and retry queue.
4. Verify shared cash/card settlement and legal merchant agreement; prohibit double recognition of revenue.
5. End-to-end test mixed basket, single-company basket, duplicate requests, partial failure, refunds, and offline/interrupted sessions.
6. Validate both companies' daily reports against known real sales and physical cash-up; only then pilot with feature flag and rollback.
No live deployment or financial DB writes have been performed.

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

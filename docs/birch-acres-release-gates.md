# Birch Acres production release blockers (22 November 2026)

**NO-GO — do not deploy mixed-company checkout.** The passing Node tests use mocks, not the two live Supabase databases.

## Verified source review
- `migrations/REVIEW_ONLY_noshville_atomic_posting.sql` has been deduplicated and passes static structural checks. It has **not** been executed or validated against a staging database; do not apply it to production.
- `src/birch-acres-company-posting.js` invokes `public.birch_post_noshville_sale` and `public.birch_post_feasterville_sale`; neither RPC has been confirmed deployed. The Noshville SQL draft instead defines `birch_internal.post_noshville_sale`, which is not reachable by the default PostgREST RPC endpoint.
- `migrations/REVIEW_ONLY_birch_recovery_lookup.sql` assumes a private mapping table with `sale_id`. The Feasterville mapping table has not been implemented; Noshville's draft mapping uses a UUID sale ID, whereas Feasterville uses bigint.
- `src/birch-acres-recovery-lookups.js` calls `public.birch_lookup_posted_checkout`, but that function is review-only and not deployed.
- The checkout coordinator requires persisted basket lines and atomic compare-and-swap state transitions; neither server persistence adapter nor real payment verifier is connected.
- Noshville's existing sale-item trigger already deducts tracked stock; additional stock deductions would double-count.
- The current Noshville draft uses payment method `other` for mixed-tender posting and does not itself record verified cash/card allocation or a Feasterville-to-Noshville settlement liability.

## Mandatory release gates
1. Repair and validate both company-specific SQL posting functions in **staging**; enforce immutable checkout ID/hash, verified payment, company total, and stock under locks.
2. Align RPC signatures, schema exposure, permissions and private mapping tables. Confirm anonymous/authenticated users cannot execute privileged posting or lookup functions.
3. Build the server-side authenticated checkout endpoint, persisted coordinator, payment verification and idempotent company posting; no service-role keys in browser.
4. Build the Birch Acres cashier UI and a manager-only reconciliation report. Leave Ndayini and Sivana untouched.
5. Test cash-only, card-only, mixed tenders, one-company baskets, mixed baskets, insufficient stock, stale prices, concurrent retries, lost responses, and recovery after one-company success.
6. Owner confirmed on 22 November 2026: use one card machine, record company revenue separately, and settle Noshville's share through manual intercompany transfers. Implement a manager-only settlement register with due/paid balances, transfer reference, date and amount. Obtain card-terminal merchant-provider permission and accountant approval before live cross-company card collections.
7. Owner approved staging-only testing on 22 November 2026; this does NOT authorize live migration or deployment. Obtain separate explicit launch approval after a documented staging test report and rollback plan.

**Production status:** No changes made to production sales, inventory or auth in this development branch.

## Live read-only verification — 22 November 2026
- Connected Supabase projects are Feasterville (`sflyjcgbxbcwspfuzone`), Noshville (`gknaqtvkqjwqwkovmajg`), and an inactive Bookkeeping System. **No dedicated staging project was identified.**
- Read-only `information_schema.tables` checks in both active POS databases returned **zero** `public.birch_%` tables. This confirms the proposed coordinator and transfer tables are not installed in either live database.
- Do not use either active production project for staging. Provision isolated test projects/copies, with synthetic data and separate test credentials, before executing the review-only migrations or testing posting.
- A successful GitHub mock/static workflow is not proof of staging integration, manager-only authorization, payment verification, or live readiness.

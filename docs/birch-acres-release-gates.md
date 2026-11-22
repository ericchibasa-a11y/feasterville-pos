# Birch Acres production release blockers (22 November 2026)

**NO-GO — do not deploy mixed-company checkout.** The passing Node tests use mocks, not the two live Supabase databases.

## Verified source review
- `migrations/REVIEW_ONLY_noshville_atomic_posting.sql` currently contains **duplicate SQL appended after the function and grants**, plus literal `\\n` escape sequences inside SQL. This draft is **not executable as a trusted migration**. Do not apply it.
- `src/birch-acres-company-posting.js` invokes `public.birch_post_noshville_sale` and `public.birch_post_feasterville_sale`; neither RPC is deployed. The Noshville SQL draft instead defines `birch_internal.post_noshville_sale`, which is not reachable by the default PostgREST RPC endpoint.
- `migrations/REVIEW_ONLY_birch_recovery_lookup.sql` assumes a private mapping table with `sale_id`. The Feasterville mapping table has not been implemented; Noshville's draft mapping uses a UUID sale ID, whereas Feasterville uses bigint.
- `src/birch-acres-recovery-lookups.js` calls `public.birch_lookup_posted_checkout`, but that function is review-only and not deployed.
- The checkout coordinator requires persisted basket lines and atomic compare-and-swap state transitions; neither server persistence adapter nor real payment verifier is connected.
- Noshville's existing sale-item trigger already deducts tracked stock; additional stock deductions would double-count.
- The current Noshville draft cannot be relied upon to record mixed cash/card allocations or a Feasterville-to-Noshville settlement liability.

## Mandatory release gates
1. Repair and validate both company-specific SQL posting functions in **staging**; enforce immutable checkout ID/hash, verified payment, company total, and stock under locks.
2. Align RPC signatures, schema exposure, permissions and private mapping tables. Confirm anonymous/authenticated users cannot execute privileged posting or lookup functions.
3. Build the server-side authenticated checkout endpoint, persisted coordinator, payment verification and idempotent company posting; no service-role keys in browser.
4. Build the Birch Acres cashier UI and a manager-only reconciliation report. Leave Ndayini and Sivana untouched.
5. Test cash-only, card-only, mixed tenders, one-company baskets, mixed baskets, insufficient stock, stale prices, concurrent retries, lost responses, and recovery after one-company success.
6. Verify card-terminal merchant agreement and accountant-approved intercompany settlements before taking card payments for both companies.
7. Obtain explicit launch approval after a documented staging test report and rollback plan.

**Production status:** No changes made to production sales, inventory or auth in this development branch.

# Birch Acres — Noshville atomic posting integration

**Status: implementation specification, not deployed.** Based on read-only inspection of Noshville production schema on 22 Nov 2026.

## Critical existing behavior
- `public.sale_items` has an INSERT trigger `trg_sale_item_stock` invoking `public.record_sale_item()`.
- That trigger automatically deducts `products.stock_qty` and writes a `stock_movements` row for tracked products. It supports `stock_parent_product_id` and `stock_multiplier` for loose/pack variants.
- **Never separately update stock_qty or insert stock_movements from unified checkout**; that would double deduct.
- The existing trigger does not appear to reject insufficient stock; the posting RPC must validate parent/variant stock under locks before inserting sale items.
- `sales.order_no` is mandatory bigint without a column default. Verify the current order-number allocator and avoid `max(order_no)+1` without a locking mechanism.
- `sales.payment_method` accepts only `cash`, `card`, `eft`, `other`. Mixed tender requires an independently reconciled tender allocation; do not mislabel mixed payments as cash.
- `sales.cashier_id` belongs to Noshville identity; a Feasterville auth user UUID must not be written there unless explicitly mapped to a Noshville account.
- No cross-database atomic commit is available between independent Supabase projects. Each company's local posting must be atomic and idempotent, with durable coordinator recovery.

## Noshville server-side RPC transaction requirements
1. Callable only through an authenticated, authorized backend. Do not expose a privileged function directly to browser users.
2. Accept checkout ID and a **server-stored immutable Noshville sale snapshot**, never prices or quantities supplied by the client at posting time.
3. Create a unique `checkout_id -> sale_id` mapping **before** sale inserts, in the same Postgres transaction. Repeated calls return the original sale ID, with no new sale or stock movement.
4. Lock product/parent stock rows in deterministic UUID order. Re-read current prices and enforce the approved price policy. Check active/sellable and available stock (including stock multiplier and aggregated requirements).
5. Allocate `order_no` with the existing production allocator or a reviewed sequence.
6. Insert one `sales` row and corresponding `sale_items` rows in the same database transaction. The existing `trg_sale_item_stock` performs stock deduction and movement logging automatically.
7. On any error, roll back sale, mapping, items and triggered stock changes together.
8. Return `{sale_reference: sale_id::text}` for the coordinator contract.
9. Record Noshville's portion of cash/card/combined tender in a separate immutable settlement ledger. Feasterville card proceeds attributable to Noshville create an intercompany payable/receivable, not Feasterville revenue.
10. Test repeated posting, concurrent calls, insufficient stock, linked pack variants, network interruption after commit, and reconciliation of Noshville sale items against stock movements.

## Feasterville implementation gate
Feasterville uses `pos_store_products` scoped by `store_code='BIRCH_ACRES'`, `pos_sales`, `pos_sale_items`, and recipe-based production inputs. **Do not reuse Noshville stock logic for Feasterville**. Inspect and preserve existing recipe-consumption/cash-up logic before writing its posting RPC.

## Rollout
Keep the coordinator and company RPCs feature-flagged off; run transaction tests against isolated fixtures or staging copies; review permissions/RLS; then pilot one cashier and manager-approved reconciliation. No existing production data should be altered during design review.

-- Applied 18 Sep 2026 (migration stock_items_regular_delivery).
-- Items that arrive on a regular delivery (the bakes), shown as fixed buttons on Goods In.
alter table public.stock_items add column if not exists regular_delivery boolean not null default false;
update public.stock_items set regular_delivery = true
where active and (category = 'Treats' or name in ('Croissant', 'Pain au Chocolat'));

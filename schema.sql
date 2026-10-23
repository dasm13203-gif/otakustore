-- شغّل الملف ده في Supabase > SQL Editor
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, brand text, price numeric not null, image_url text,
  active boolean default true, created_at timestamptz default now()
);
create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products on delete cascade,
  size text not null, color text default '', stock int not null default 0 check (stock >= 0),
  unique (product_id, size, color)
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text, phone text, address text, city text,
  total numeric not null, status text not null default 'new',
  source text not null default 'online', created_at timestamptz default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders on delete cascade,
  variant_id uuid references variants, name text, size text, qty int not null, price numeric not null
);
create table admins (user_id uuid primary key references auth.users on delete cascade);

create function is_admin() returns boolean language sql security definer stable as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

alter table products enable row level security;
alter table variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table admins enable row level security;

create policy "read products" on products for select using (true);
create policy "read variants" on variants for select using (true);
create policy "admin products" on products for all using (is_admin()) with check (is_admin());
create policy "admin variants" on variants for all using (is_admin()) with check (is_admin());
create policy "admin orders" on orders for all using (is_admin()) with check (is_admin());
create policy "admin items" on order_items for all using (is_admin()) with check (is_admin());

-- إنشاء الطلب وخصم المخزون في خطوة واحدة (بيمنع بيع نفس المقاس مرتين)
create function place_order(p_name text, p_phone text, p_address text, p_city text,
                            p_items jsonb, p_source text default 'online')
returns uuid language plpgsql security definer as $$
declare oid uuid; it jsonb; v record; v_total numeric := 0;
begin
  if p_source = 'store' and not is_admin() then raise exception 'not_allowed'; end if;
  insert into orders (customer_name, phone, address, city, total, source)
    values (p_name, p_phone, p_address, p_city, 0, p_source) returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    update variants set stock = stock - (it->>'qty')::int
      where id = (it->>'variant_id')::uuid and stock >= (it->>'qty')::int;
    if not found then raise exception 'out_of_stock'; end if;
    select p.name, p.price, vr.size, vr.id as vid into v
      from variants vr join products p on p.id = vr.product_id
      where vr.id = (it->>'variant_id')::uuid;
    insert into order_items (order_id, variant_id, name, size, qty, price)
      values (oid, v.vid, v.name, v.size, (it->>'qty')::int, v.price);
    v_total := v_total + v.price * (it->>'qty')::int;
  end loop;
  update orders set total = v_total where id = oid;
  return oid;
end $$;
grant execute on function place_order to anon, authenticated;

-- بعد ما تعمل حساب من Authentication > Users، ضيف نفسك أدمن:
-- insert into admins (user_id) select id from auth.users where email = 'your@email.com';

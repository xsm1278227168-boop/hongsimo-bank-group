-- 洪撕膜之银行集团 — 初始 schema
--
-- 设计要点：
--   * 账本 append-only。transactions 只有 select / insert 策略，数据库层根本
--     不存在 update / delete 策略。改错 = 冲销记录 + 新记录。
--   * 余额、结算金额、月度汇总一律由 view / function 计算，前端只渲染。
--   * 每条记录以付款人视角表达：
--       付款人对另一方的应收 = direction * amount * (1 - payer_share)
--     结算就是 payer_share = 0 的记录，套同一个公式，无需特殊处理。
--
-- 在 Supabase SQL Editor 中整段运行。可重复运行。

-- ========== 扩展 ==========
create extension if not exists pgcrypto;

-- ========== 表 ==========
create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'CNY',
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at  timestamptz not null default now()
);

-- 两位成员的名字是固定的：Zod（男）和 Sylvia（女）。
-- 想换名字：改下面这一条 check 约束，并同步改 src/lib/members.ts 里的常量。
create table if not exists members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint members_fixed_names check (display_name in ('Zod', 'Sylvia'))
);

-- v1：一个用户只能属于一个 household
create unique index if not exists members_one_household_per_user on members(user_id);

-- 同一个账本里两个人不可能同名
create unique index if not exists members_unique_name on members(household_id, display_name);

create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 0,
  archived     boolean not null default false,
  unique (household_id, name)
);

create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type         text not null check (type in ('expense', 'settlement')),
  occurred_on  date not null default current_date,
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null,
  payer_id     uuid not null references auth.users(id),
  payer_share  numeric(5,4) not null check (payer_share >= 0 and payer_share <= 1),
  category     text,
  note         text,
  direction    smallint not null default 1 check (direction in (1, -1)),
  reverses_id  uuid references transactions(id),
  created_by   uuid not null references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  -- 结算记录必须是 payer_share = 0
  constraint settlement_share check (type <> 'settlement' or payer_share = 0),
  -- 冲销记录与 reverses_id 必须同时出现
  constraint reversal_consistency check ((direction = -1) = (reverses_id is not null))
);

-- 一条记录最多被冲销一次
create unique index if not exists transactions_reverse_once
  on transactions(reverses_id) where reverses_id is not null;
create index if not exists transactions_household_date
  on transactions(household_id, occurred_on desc);

-- ========== RLS 辅助函数（security definer 避免 members 自引用递归） ==========
create or replace function is_member(p_hid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where household_id = p_hid and user_id = auth.uid());
$$;

-- ========== RLS ==========
alter table households   enable row level security;
alter table members      enable row level security;
alter table categories   enable row level security;
alter table transactions enable row level security;

-- households：成员可读；创建/加入只能通过 RPC（无直接 insert 策略）
drop policy if exists households_select on households;
create policy households_select on households for select to authenticated
  using (is_member(id));

-- members：同 household 成员可读；写入只能通过 RPC
drop policy if exists members_select on members;
create policy members_select on members for select to authenticated
  using (is_member(household_id));

-- members：没有 update 策略。名字是固定的两个，改不了，所以也不需要给
-- 客户端开一条写路径。（早期版本为了"改昵称"开过 update 策略 + 列级触发器，
-- 名字固定之后两者都是死代码，一并删掉。）
drop policy if exists members_update_self on members;
drop trigger if exists members_display_name_only_trg on members;
drop function if exists members_display_name_only();

-- categories：成员可读、可增、可改（改名/归档/排序）
drop policy if exists categories_select on categories;
create policy categories_select on categories for select to authenticated
  using (is_member(household_id));

drop policy if exists categories_insert on categories;
create policy categories_insert on categories for insert to authenticated
  with check (is_member(household_id));

drop policy if exists categories_update on categories;
create policy categories_update on categories for update to authenticated
  using (is_member(household_id)) with check (is_member(household_id));

-- transactions：成员可读、可增；**没有 update / delete 策略**
drop policy if exists transactions_select on transactions;
create policy transactions_select on transactions for select to authenticated
  using (is_member(household_id));

drop policy if exists transactions_insert on transactions;
create policy transactions_insert on transactions for insert to authenticated
  with check (
    is_member(household_id)
    and created_by = auth.uid()
    and direction = 1                       -- 冲销只能通过 RPC
    and type = 'expense'                    -- 结算只能通过 RPC
    and exists (select 1 from members m
                where m.household_id = transactions.household_id
                  and m.user_id = transactions.payer_id)
    and currency = (select currency from households h where h.id = transactions.household_id)
  );

-- ========== RPC ==========
-- 创建 household 并把当前用户加为第一个成员；插入默认类别
create or replace function create_household(p_name text, p_currency text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_display_name not in ('Zod', 'Sylvia') then
    raise exception 'invalid member name';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  insert into households(name, currency) values (p_name, p_currency) returning id into v_hid;
  insert into members(household_id, user_id, display_name) values (v_hid, auth.uid(), p_display_name);
  insert into categories(household_id, name, sort_order) values
    (v_hid, '餐饮', 1), (v_hid, '日用', 2), (v_hid, '交通', 3), (v_hid, '住房', 4),
    (v_hid, '娱乐', 5), (v_hid, '旅行', 6), (v_hid, '礼物', 7), (v_hid, '医疗', 8), (v_hid, '其他', 99);
  return v_hid;
end $$;

-- 用邀请码加入；上限 2 人。
-- 名字不用填：账本里剩下的那个就是你。加入者本来也读不到对方已经占了哪个名字
-- （RLS 挡着），让数据库来分配既省一步输入，也不会撞名。
create or replace function join_household(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_hid uuid; v_cnt int; v_taken text; v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  select id into v_hid from households where invite_code = p_code;
  if v_hid is null then raise exception 'invalid invite code'; end if;
  select count(*) into v_cnt from members where household_id = v_hid;
  if v_cnt >= 2 then raise exception 'household is full'; end if;

  select display_name into v_taken from members where household_id = v_hid limit 1;
  v_name := case when v_taken = 'Zod' then 'Sylvia' else 'Zod' end;

  insert into members(household_id, user_id, display_name) values (v_hid, auth.uid(), v_name);
  return v_hid;
end $$;

-- 旧的两参数版本会和上面的单参数版本共存（Postgres 允许重载），留着会让
-- PostgREST 无法决定调用哪一个，直接删掉。
drop function if exists join_household(text, text);

-- 冲销：复制原记录、direction = -1
create or replace function reverse_transaction(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_orig transactions%rowtype; v_new uuid;
begin
  select * into v_orig from transactions where id = p_id;
  if v_orig.id is null then raise exception 'not found'; end if;
  if not is_member(v_orig.household_id) then raise exception 'forbidden'; end if;
  if v_orig.direction = -1 then raise exception 'cannot reverse a reversal'; end if;
  if exists (select 1 from transactions where reverses_id = p_id) then
    raise exception 'already reversed';
  end if;
  insert into transactions(household_id, type, occurred_on, amount, currency, payer_id, payer_share,
                           category, note, direction, reverses_id, created_by)
  values (v_orig.household_id, v_orig.type, current_date, v_orig.amount, v_orig.currency, v_orig.payer_id,
          v_orig.payer_share, v_orig.category, coalesce('冲销: ' || v_orig.note, '冲销'), -1, p_id, auth.uid())
  returning id into v_new;
  return v_new;
end $$;

-- 每位成员的应收合计
create or replace view member_receivables with (security_invoker = true) as
select
  m.household_id,
  m.user_id,
  m.display_name,
  coalesce(sum(t.direction * t.amount * (1 - t.payer_share)), 0)::numeric(12,2) as receivable
from members m
left join transactions t on t.household_id = m.household_id and t.payer_id = m.user_id
group by m.household_id, m.user_id, m.display_name;

-- 净余额：谁欠谁多少（amount = 0 时 creditor/debtor 任意）
create or replace function household_net(p_hid uuid)
returns table (creditor uuid, debtor uuid, amount numeric)
language sql security invoker stable set search_path = public as $$
  with r as (
    select user_id, receivable from member_receivables where household_id = p_hid
  ),
  ranked as (
    select user_id, receivable,
           row_number() over (order by receivable desc, user_id) as rn
    from r
  )
  select
    (select user_id from ranked where rn = 1) as creditor,
    (select user_id from ranked where rn = 2) as debtor,
    round(coalesce((select receivable from ranked where rn = 1), 0)
        - coalesce((select receivable from ranked where rn = 2), 0), 2) as amount;
$$;

-- 一键结算：由债务人向债权人插入一条 settlement
create or replace function settle_up(p_hid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_creditor uuid; v_debtor uuid; v_amount numeric; v_cur text; v_id uuid;
begin
  if not is_member(p_hid) then raise exception 'forbidden'; end if;
  select creditor, debtor, amount into v_creditor, v_debtor, v_amount from household_net(p_hid);
  -- 只有一个成员时 debtor 为 null；给出可读错误而不是 not-null 违规
  if v_debtor is null then raise exception 'household needs two members to settle'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'nothing to settle'; end if;
  select currency into v_cur from households where id = p_hid;
  insert into transactions(household_id, type, amount, currency, payer_id, payer_share, category, note, created_by)
  values (p_hid, 'settlement', v_amount, v_cur, v_debtor, 0, null, '结算', auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- 月度类别汇总（只统计 expense；冲销自动抵消）
create or replace view monthly_category_totals with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(category, '未分类') as category,
  sum(direction * amount)::numeric(12,2) as total
from transactions
where type = 'expense'
group by household_id, date_trunc('month', occurred_on), coalesce(category, '未分类');

-- 月度每人：实付 vs 实担
create or replace view monthly_person_totals with (security_invoker = true) as
select
  m.household_id,
  date_trunc('month', t.occurred_on)::date as month,
  m.user_id,
  m.display_name,
  sum(case when t.payer_id = m.user_id then t.direction * t.amount else 0 end)::numeric(12,2) as paid,
  sum(case when t.payer_id = m.user_id
           then t.direction * t.amount * t.payer_share
           else t.direction * t.amount * (1 - t.payer_share) end)::numeric(12,2) as borne
from members m
join transactions t on t.household_id = m.household_id and t.type = 'expense'
group by m.household_id, date_trunc('month', t.occurred_on), m.user_id, m.display_name;

-- ========== Realtime ==========
-- 幂等：重复运行整个 migration 时不会因为表已在 publication 里而报错。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table transactions;
  end if;
exception
  when undefined_object then
    raise notice 'publication supabase_realtime 不存在，跳过（非 Supabase 环境）';
end $$;

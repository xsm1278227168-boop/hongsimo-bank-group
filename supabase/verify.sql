-- 洪撕膜之银行集团 — 记账语义验证脚本
--
-- 用法：
--   1. 在 Supabase Dashboard → Authentication → Users 里准备两个用户，复制
--      它们的 uuid（用你们自己的两个真实账号也可以，见下面第 3 点）。
--   2. 把下面 v_a / v_b 两行的 uuid 换掉。
--   3. 在 SQL Editor 里整段运行。脚本以 rollback 结尾，**不会留下任何数据**，
--      也不会动到你们已有的 household —— 脚本开头临时清掉这两个 uuid 的
--      membership，只是为了让 create_household / join_household 能跑通，
--      这一步同样在 rollback 里被撤销。
--   4. 全部通过时最后一行输出 “验证通过”。任何一条不符会直接抛异常并中止。
--
-- 脚本以 role = authenticated 运行并伪造 JWT claims，所以 RLS 是**生效**的：
-- 除了记账算术，它同时验证了 transactions 的 insert 策略和 append-only 约束。

begin;

-- 切换“当前登录用户”的小工具。随事务一起回滚。
create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

do $$
declare
  ---------------------------------------------------------------- 改这两行
  v_a uuid := '00000000-0000-0000-0000-0000000000aa';  -- 测试用户 A
  v_b uuid := '00000000-0000-0000-0000-0000000000bb';  -- 测试用户 B
  ----------------------------------------------------------------
  v_c         uuid;   -- 附加 10 用的“第三人”，可能不存在
  v_hid       uuid;
  v_code      text;
  v_t1        uuid;   -- 步骤 1 的记录
  v_t3        uuid;   -- 步骤 3 产生的冲销记录
  v_creditor  uuid;
  v_debtor    uuid;
  v_amount    numeric;
  v_err       text;
  v_rows      int;
begin
  ---------------------------------------------------------------------------
  -- 前置检查（此时还是 postgres 身份）
  ---------------------------------------------------------------------------
  if v_a = v_b then
    raise exception '前置检查失败: v_a 和 v_b 必须是两个不同的用户';
  end if;
  if not exists (select 1 from auth.users where id = v_a) then
    raise exception '前置检查失败: auth.users 里没有 % —— 请把脚本顶部的 v_a 换成真实用户 uuid', v_a;
  end if;
  if not exists (select 1 from auth.users where id = v_b) then
    raise exception '前置检查失败: auth.users 里没有 % —— 请把脚本顶部的 v_b 换成真实用户 uuid', v_b;
  end if;

  -- 临时腾出两个 uuid 的 membership（rollback 时恢复）
  delete from members where user_id in (v_a, v_b);

  ---------------------------------------------------------------------------
  -- 建 household：A 创建，B 用邀请码加入
  ---------------------------------------------------------------------------
  perform pg_temp.act_as(v_a);
  v_hid := create_household('验证用账本', 'CNY', '甲');

  select invite_code into v_code from households where id = v_hid;
  if v_code is null then
    raise exception '建账失败: A 读不到自己 household 的邀请码（households_select 策略有问题？）';
  end if;

  perform pg_temp.act_as(v_b);
  perform join_household(v_code, '乙');

  if (select count(*) from members where household_id = v_hid) <> 2 then
    raise exception '建账失败: household 应该有 2 个成员';
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 1：A 付 100，平摊  →  B 欠 A 50.00
  ---------------------------------------------------------------------------
  perform pg_temp.act_as(v_a);
  insert into transactions(household_id, type, occurred_on, amount, currency,
                           payer_id, payer_share, category, note)
  values (v_hid, 'expense', current_date, 100, 'CNY', v_a, 0.5, '餐饮', '步骤1 A付100平摊')
  returning id into v_t1;

  select creditor, debtor, amount into v_creditor, v_debtor, v_amount from household_net(v_hid);
  if v_creditor <> v_a or v_debtor <> v_b or v_amount <> 50.00 then
    raise exception '步骤 1 失败: 期望 B 欠 A 50.00，实际 creditor=% debtor=% amount=%',
      v_creditor, v_debtor, v_amount;
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 2：B 付 30，全归对方（垫付给 A）  →  B 欠 A 20.00
  ---------------------------------------------------------------------------
  perform pg_temp.act_as(v_b);
  insert into transactions(household_id, type, occurred_on, amount, currency,
                           payer_id, payer_share, category, note)
  values (v_hid, 'expense', current_date, 30, 'CNY', v_b, 0, '日用', '步骤2 B垫付30');

  select creditor, debtor, amount into v_creditor, v_debtor, v_amount from household_net(v_hid);
  if v_creditor <> v_a or v_debtor <> v_b or v_amount <> 20.00 then
    raise exception '步骤 2 失败: 期望 B 欠 A 20.00，实际 creditor=% debtor=% amount=%',
      v_creditor, v_debtor, v_amount;
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 3：冲销步骤 1  →  A 欠 B 30.00
  ---------------------------------------------------------------------------
  perform pg_temp.act_as(v_a);
  v_t3 := reverse_transaction(v_t1);

  select creditor, debtor, amount into v_creditor, v_debtor, v_amount from household_net(v_hid);
  if v_creditor <> v_b or v_debtor <> v_a or v_amount <> 30.00 then
    raise exception '步骤 3 失败: 期望 A 欠 B 30.00，实际 creditor=% debtor=% amount=%',
      v_creditor, v_debtor, v_amount;
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 4：settle_up  →  0.00
  ---------------------------------------------------------------------------
  perform settle_up(v_hid);

  select amount into v_amount from household_net(v_hid);
  if v_amount <> 0 then
    raise exception '步骤 4 失败: 结算后期望 0.00，实际 %', v_amount;
  end if;

  -- 结算记录必须由债务人（A）出账、payer_share = 0
  if not exists (select 1 from transactions
                 where household_id = v_hid and type = 'settlement'
                   and payer_id = v_a and payer_share = 0 and amount = 30.00) then
    raise exception '步骤 4 失败: 结算记录应为 A 付 30.00 且 payer_share = 0';
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 5：再次 settle_up  →  nothing to settle
  ---------------------------------------------------------------------------
  v_err := null;
  begin
    perform settle_up(v_hid);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null or v_err not like '%nothing to settle%' then
    raise exception '步骤 5 失败: 期望 nothing to settle，实际 %', coalesce(v_err, '(没有抛出异常)');
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 6：再次冲销步骤 1  →  already reversed
  ---------------------------------------------------------------------------
  v_err := null;
  begin
    perform reverse_transaction(v_t1);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null or v_err not like '%already reversed%' then
    raise exception '步骤 6 失败: 期望 already reversed，实际 %', coalesce(v_err, '(没有抛出异常)');
  end if;

  ---------------------------------------------------------------------------
  -- 步骤 7：冲销那条冲销记录  →  cannot reverse a reversal
  ---------------------------------------------------------------------------
  v_err := null;
  begin
    perform reverse_transaction(v_t3);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null or v_err not like '%cannot reverse a reversal%' then
    raise exception '步骤 7 失败: 期望 cannot reverse a reversal，实际 %', coalesce(v_err, '(没有抛出异常)');
  end if;

  ---------------------------------------------------------------------------
  -- 附加 8：账本 append-only —— update / delete 必须影响 0 行
  ---------------------------------------------------------------------------
  update transactions set amount = 1 where id = v_t1;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception '附加 8 失败: transactions 被 UPDATE 影响了 % 行，账本不是 append-only', v_rows;
  end if;

  delete from transactions where id = v_t1;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception '附加 8 失败: transactions 被 DELETE 影响了 % 行，账本不是 append-only', v_rows;
  end if;

  if (select amount from transactions where id = v_t1) <> 100.00 then
    raise exception '附加 8 失败: 原记录金额被改动了';
  end if;

  ---------------------------------------------------------------------------
  -- 附加 9：insert 策略挡住伪造的 direction / type / payer / created_by
  ---------------------------------------------------------------------------
  v_err := null;
  begin
    insert into transactions(household_id, type, amount, currency, payer_id, payer_share, direction)
    values (v_hid, 'settlement', 10, 'CNY', v_a, 0, 1);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception '附加 9 失败: 直接 insert settlement 本应被 RLS 拒绝';
  end if;

  v_err := null;
  begin
    insert into transactions(household_id, type, amount, currency, payer_id, payer_share, created_by)
    values (v_hid, 'expense', 10, 'CNY', v_a, 0.5, v_b);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception '附加 9 失败: created_by 冒充他人本应被 RLS 拒绝';
  end if;

  v_err := null;
  begin
    insert into transactions(household_id, type, amount, currency, payer_id, payer_share)
    values (v_hid, 'expense', 10, 'USD', v_a, 0.5);
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception '附加 9 失败: 币种与 household 不符本应被 RLS 拒绝';
  end if;

  ---------------------------------------------------------------------------
  -- 附加 10：第三人加入满员的 household  →  household is full
  ---------------------------------------------------------------------------
  perform set_config('role', 'none', true);   -- 查 auth.users 需要 postgres 身份
  select id into v_c from auth.users where id <> v_a and id <> v_b limit 1;

  if v_c is null then
    raise notice '附加 10 跳过: auth.users 里没有第三个用户，无法测试 household is full';
  else
    delete from members where user_id = v_c;   -- rollback 时恢复
    perform pg_temp.act_as(v_c);
    v_err := null;
    begin
      perform join_household(v_code, '丙');
    exception when others then
      v_err := sqlerrm;
    end;
    if v_err is null or v_err not like '%household is full%' then
      raise exception '附加 10 失败: 期望 household is full，实际 %', coalesce(v_err, '(没有抛出异常)');
    end if;
  end if;

  perform set_config('role', 'none', true);
  raise notice '';
  raise notice '  ✅ 验证通过 —— 第 7 节 7 个场景 + 4 项附加检查全部符合预期';
  raise notice '';
end $$;

rollback;

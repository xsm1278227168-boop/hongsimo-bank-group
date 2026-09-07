# 洪撕膜之银行集团

两个人的共享记账 PWA。静态前端 + Supabase，没有自写服务端，运行期不调用任何 LLM / AI。

- 账本 **append-only**：`transactions` 表只有 `select` / `insert` 策略，数据库层**不存在** `update` / `delete` 策略。记错了就冲销 + 重记，历史永远留痕。
- 余额、结算金额、月度汇总**全部由数据库的 view / function 计算**，前端只负责渲染。
- 一个 household 恰好 2 人，各自登录、共享同一账本。

---

## 目录

1. [记账语义](#记账语义)
2. [创建 Supabase 项目](#1-创建-supabase-项目)
3. [运行 migration](#2-运行-migration)
4. [配置 Auth](#3-配置-auth)
5. [本地开发](#4-本地开发)
6. [部署到 GitHub Pages](#5-部署到-github-pages)
7. [手机安装](#6-手机安装)
8. [验证](#7-验证)
9. [常见问题](#常见问题)
10. [实现说明](#实现说明)

---

## 记账语义

每条记录以**付款人视角**表达：

| 字段 | 含义 |
|---|---|
| `amount` | 付款总额（> 0） |
| `payer_id` | 谁付的钱 |
| `payer_share` | 付款人自己承担的比例，∈ [0, 1] |
| `direction` | `1` 正常记录，`-1` 冲销记录（必须带 `reverses_id`） |

> 付款人对另一方的应收 = `direction × amount × (1 − payer_share)`

**结算**就是一条 `payer_share = 0` 的记录（债务人把钱全额付给债权人），套的是同一个公式，没有任何特殊处理。

净余额 = 一方应收合计 − 另一方应收合计。

拆分预设：

| UI 标签 | `payer_share` | 什么时候用 |
|---|---|---|
| 平摊 | `0.5` | 一起吃饭、房租 |
| 全归付款人 | `1.0` | 自己的个人消费，只是记一笔 |
| 全归对方 | `0.0` | 帮对方垫付 |
| 自定义 | 输入的百分比 / 100 | 其它比例 |

---

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com>，注册后新建一个项目（免费层即可）。
2. 记下项目的 **Region**（选离你们近的，比如 Singapore / Tokyo）和数据库密码。
3. 项目创建好后，进入 **Project Settings → API**，复制这两个值备用：
   - **Project URL** → 之后的 `VITE_SUPABASE_URL`
   - **anon / public key** → 之后的 `VITE_SUPABASE_ANON_KEY`

> anon key 按设计就是公开的，它会被打进前端 bundle。真正的安全边界全部由 RLS 策略提供 —— 这也是为什么 `transactions` 干脆没有 update / delete 策略。
>
> **不要**把 `service_role` key 放进前端，它会绕过所有 RLS。

## 2. 运行 migration

进入 **SQL Editor → New query**，把 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 全文粘贴进去，点 **Run**。

脚本是幂等的，重复运行不会报错。看到 `Success. No rows returned` 就对了。

它会建好：表、索引、约束、RLS 策略、4 个 RPC（`create_household` / `join_household` / `reverse_transaction` / `settle_up`）、3 个 view、并把 `transactions` 加进 Realtime publication。

## 3. 配置 Auth

**Authentication → URL Configuration**

| 字段 | 填什么 |
|---|---|
| Site URL | `https://<你的用户名>.github.io/hongsimo-bank-group/` |
| Redirect URLs | 同上，再加一行 `http://localhost:5173/hongsimo-bank-group/` |

**Authentication → Providers → Email**

- 打开 Email provider。
- 不需要密码登录，magic link 就够。

**（推荐）让邮件同时带上 6 位验证码**

**Authentication → Email Templates → Magic Link**，在模板里加一行：

```html
<p>如果链接打不开，也可以直接输入验证码：<strong>{{ .Token }}</strong></p>
```

原因见[常见问题](#点了邮件里的链接却没登录上)。

## 4. 本地开发

需要 Node 20 以上。

```bash
npm install
```

复制 `.env.example` 为 `.env.local` 并填上第 1 步拿到的两个值：

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

```bash
npm run dev
```

打开 <http://localhost:5173/hongsimo-bank-group/>（注意有 base 路径）。

其它命令：

```bash
npm run check     # svelte-check 类型检查
npm run build     # 产出 dist/
npm run preview   # 预览 dist/
```

## 5. 部署到 GitHub Pages

1. 新建一个名为 **`hongsimo-bank-group`** 的 GitHub 仓库并推上去。

   > 仓库名必须和 `vite.config.ts` 里的 `REPO_NAME` 一致，因为 GitHub Pages 把站点放在 `/<仓库名>/` 下。想换名字：改 `vite.config.ts` 顶部那一个常量，然后同步改 Supabase 的 Redirect URLs。
   >
   > GitHub 仓库名只接受 ASCII 字母、数字、`-`、`_`、`.`，所以中文名只能出现在应用标题和 PWA 名称里（已经是「洪撕膜之银行集团」了），不能作为仓库名。

2. **Settings → Secrets and variables → Actions → New repository secret**，加两条：

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | 第 1 步的 Project URL |
   | `VITE_SUPABASE_ANON_KEY` | 第 1 步的 anon key |

3. **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

4. push 到 `main` 就会自动构建部署。缺任何一个 secret 都会让 workflow 直接失败 —— 这是故意的，否则会部署出一个所有人都看到「缺少配置」的站点。

## 6. 手机安装

装到主屏幕之后是独立窗口，跟原生 App 一样一点就开，不用每次翻浏览器。

**iPhone / iPad（必须用 Safari）**

1. Safari 打开站点地址。
2. 点底部中间的**分享**按钮（方框往上的箭头）。
3. 往下滑，选 **「添加到主屏幕」**。
4. 右上角**添加**。

> 用微信、Chrome 等 App 内置浏览器打开是装不了的，一定要在 Safari 里操作。

**Android（Chrome / Edge）**

应用内会直接弹出「安装」按钮，点一下即可；也可以用右上角菜单里的**「安装应用」／「添加到主屏幕」**。

装好之后长按图标，还能直接跳到「记一笔 / 流水 / 汇总」。

## 7. 验证

### 数据库层

把 [`supabase/verify.sql`](supabase/verify.sql) 粘进 SQL Editor，按文件开头的说明把 `v_a` / `v_b` 换成两个真实用户的 uuid（**Authentication → Users** 里能看到），然后 Run。

脚本以 `role = authenticated` 运行并伪造 JWT claims，所以 **RLS 是生效的**。它覆盖：

| # | 场景 | 期望 |
|---|---|---|
| 1 | A 付 100，平摊 | B 欠 A 50.00 |
| 2 | B 付 30，全归对方 | B 欠 A 20.00 |
| 3 | 冲销步骤 1 | A 欠 B 30.00 |
| 4 | `settle_up` | 0.00 |
| 5 | 再次 `settle_up` | `nothing to settle` |
| 6 | 再次冲销步骤 1 | `already reversed` |
| 7 | 冲销那条冲销记录 | `cannot reverse a reversal` |
| 8 | `UPDATE` / `DELETE` transactions | 影响 0 行 |
| 9 | 伪造 direction / type / created_by / currency | 全部被 RLS 拒绝 |
| 10 | 第三人加入满员 household | `household is full` |

全部通过会输出 `✅ 验证通过`。脚本以 `rollback` 结尾，**不会留下任何数据**，也不会动到你们已有的 household。

### 应用层（两台手机）

- [ ] 两个账号分别登录；A 创建 household，B 用邀请码加入；第三个账号加入被拒。
- [ ] A 记一笔，B 的手机 2 秒内出现该记录且余额更新。
- [ ] 上表 7 个场景在 UI 上逐一复现。
- [ ] 用 REST（带 A 的 JWT）直接 `PATCH` / `DELETE` `transactions`：返回 0 行或 401/403。
- [ ] 第三个非成员账号 `GET transactions`：返回空。
- [ ] 导出 CSV，用 `SUMPRODUCT(direction × amount × (1 − payer_share))` 按付款人重算，与 `member_receivables` 一致。
- [ ] iOS 与 Android 都能添加到主屏幕并独立打开；断网后应用壳仍能打开并显示离线横幅。
- [ ] 快速录入：从打开应用到提交一笔平摊支出 ≤ 10 秒。

---

## 常见问题

### 点了邮件里的链接却没登录上

登录用的是 PKCE 流程，code verifier 存在**发起登录那个浏览器**的存储里。如果邮件是在微信 / QQ / Gmail 等 App 的内置浏览器里打开的，那是另一个存储环境，链接就换不到 session。

所以登录页在发送之后还会显示一个**「6 位验证码」**输入框 —— 验证码没有这个跨浏览器的问题。前提是按[第 3 步](#3-配置-auth)在邮件模板里加了 `{{ .Token }}`。

### 提示「实时同步未连接」

说明 WebSocket 没连上，对方新记的账不会自动出现（切回前台时仍会重新拉取）。依次检查：

1. **Database → Replication**（或 Publications）里 `supabase_realtime` 是否包含 `transactions` 表。migration 会自动加，但如果项目是先建后跑的 migration，值得确认一下。
2. 网络是否屏蔽了 `wss://`（部分公司网络或校园网会）。
3. 免费层项目长时间无访问会被暂停，打开 Dashboard 唤醒即可。

### 记错了怎么办

账本是 append-only，改不了也删不掉。在「流水」里点开那条记录：

- **冲销** —— 新增一条金额相同、方向相反的记录把它抵消掉。
- **修改** —— 冲销原记录 + 新增一条改好的。两条都会留在流水里。

### 换了昵称，历史记录会变吗

会显示新昵称（`transactions` 存的是 `payer_id`）。但类别存的是**名称文本**，所以改类别名或归档类别都不影响历史记录。

### 离线能记账吗

不能。v1 只缓存应用壳：离线时能打开、能看已经载入的数据，顶部会显示离线横幅，记账按钮禁用。离线写入队列不在 v1 范围内。

### 想换币种

v1 是单币种账本，币种在创建时决定，之后不改（`transactions` 的 RLS 会强制币种与 household 一致）。`currency` 字段保留着，以后要扩展多币种时再用。

---

## 实现说明

### 目录

```
src/
  lib/
    supabase.ts          Supabase client（PKCE）
    session.svelte.ts    登录态
    household.svelte.ts  household / members / categories
    ledger.svelte.ts     流水、余额、Realtime、乐观更新
    router.svelte.ts     hash 路由
    install.svelte.ts    添加到主屏幕
    format.ts            金额 / 日期 / 拆分标签
    errors.ts            Postgres / GoTrue 报错 → 中文
    csv.ts               CSV 导出
  components/            可复用 UI
  routes/                页面
supabase/
  migrations/0001_init.sql
  verify.sql
```

### 几个刻意的决定

**hash 路由。** GitHub Pages 没有 rewrite，hash 路由不需要 `404.html` 兜底。它同时决定了登录必须走 PKCE：implicit 流程会把 session 放在 URL fragment 里，正好和路由打架。

**「修改」推迟到提交时才冲销。** Brief 原本写的是点「修改」先调 `reverse_transaction`、再打开预填表单。那样一来，用户误点「修改」又关掉，原记录就已经被冲销了，留下一条没有替代品的作废记录。现在改成提交时才 `reverse` + `insert`（`ledger.replace`）：成功路径完全一样，只有「点开又放弃」这种情况不会再弄脏账本。抽屉里也写明了「提交后会先冲销原记录」。

**`members` 的列级限制靠触发器。** 设置页要改昵称，就需要一条 `members` 的 update 策略。但 RLS 只能限制「哪一行」，限制不了「哪一列」，所以 migration 里额外加了一个 before-update 触发器，钉死 `household_id` / `user_id` / `joined_at`。两者合起来才等于「仅限自己、且只能改 display_name」。

**汇总图表的坐标轴锚在 0。** `reverse_transaction` 把冲销记录的日期记成当天，所以「这个月冲销上个月的支出」会让本月某个类别变成负数。坐标轴固定从 0 起算，负数就画在 0 的左边，而不是被当成一个很小的正数。

**乐观更新按 id 对账。** Realtime 有可能比 insert 的响应更早把我们自己那条记录送回来，所以成功之后是「删掉占位行 + 按真实 id upsert」，而不是直接替换占位行。

**CSV 带 BOM。** 不带 BOM 的话 Excel 会按本地代码页解析，中文备注全是乱码。

### 明确不做（v1）

多币种换算、预算、周期性支出、小票照片、推送通知、离线写入队列、任何 LLM / AI 功能、超过 2 人的 household。

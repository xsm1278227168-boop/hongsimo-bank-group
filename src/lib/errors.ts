/**
 * Postgres raises in English from the RPCs; RLS rejections arrive as opaque
 * 42501s. Nothing may fail silently, so everything that reaches the user goes
 * through here first.
 */
const MAP: [RegExp, string][] = [
  [/already in a household/i, '你已经在一个账本里了。'],
  [/invalid invite code/i, '邀请码不对，请再确认一次。'],
  [/household is full/i, '这个账本已经有两个人了。'],
  [/needs two members to settle/i, '还没有第二个人加入，暂时不能结算。'],
  [/nothing to settle/i, '当前已经结清，没有要结算的金额。'],
  [/already reversed/i, '这条记录已经冲销过了。'],
  [/cannot reverse a reversal/i, '冲销记录不能再被冲销。'],
  [/only display_name may be updated/i, '只能修改昵称。'],
  [/display_name must not be empty/i, '昵称不能为空。'],
  [/not authenticated/i, '登录状态已失效，请重新登录。'],
  [/forbidden/i, '没有权限执行这个操作。'],
  [/row-level security/i, '这条记录不被账本规则允许（RLS 拒绝）。'],
  [/duplicate key.*categories_household_id_name_key/i, '已经有同名类别了。'],
  [/violates check constraint "amount"|amount > 0/i, '金额必须大于 0。'],
  [/Failed to fetch|NetworkError|network/i, '网络连接失败，请检查网络后重试。'],
  [/Token has expired|invalid.*token|otp_expired/i, '验证码或登录链接已过期，请重新获取。'],
  [/over_email_send_rate_limit|rate limit/i, '发送太频繁了，请过一会儿再试。']
];

export function humanError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);

  for (const [re, msg] of MAP) if (re.test(raw)) return msg;
  return raw || '出错了，请重试。';
}

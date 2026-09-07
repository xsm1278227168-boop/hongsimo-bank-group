<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { session } from '../lib/session.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { exportCsv, triggerDownload } from '../lib/csv';
  import InviteCode from '../components/InviteCode.svelte';
  import Confirm from '../components/Confirm.svelte';
  import InstallPrompt from '../components/InstallPrompt.svelte';
  import { install } from '../lib/install.svelte';
  import { MEMBER_NAMES } from '../lib/members';
  import type { Category } from '../lib/types';

  let newCategory = $state('');
  let addingCategory = $state(false);
  let editingId = $state<string | null>(null);
  let editingName = $state('');
  let showArchived = $state(false);
  let busyCategory = $state<string | null>(null);

  let exporting = $state(false);
  let confirmSignOut = $state(false);

  const archived = $derived(household.categories.filter((c) => c.archived));
  const alone = $derived(household.members.length < 2);

  async function addCategory() {
    const name = newCategory.trim();
    if (!name || addingCategory) return;
    addingCategory = true;
    try {
      await household.addCategory(name);
      newCategory = '';
      toasts.ok('已添加类别');
    } catch (err) {
      toasts.error(err);
    } finally {
      addingCategory = false;
    }
  }

  function startRename(c: Category) {
    editingId = c.id;
    editingName = c.name;
  }

  async function commitRename() {
    const id = editingId;
    const name = editingName.trim();
    if (!id) return;
    const current = household.categories.find((c) => c.id === id);
    editingId = null;
    if (!name || !current || name === current.name) return;
    busyCategory = id;
    try {
      await household.renameCategory(id, name);
      toasts.ok('已改名');
    } catch (err) {
      toasts.error(err);
    } finally {
      busyCategory = null;
    }
  }

  async function run(id: string, fn: () => Promise<void>) {
    busyCategory = id;
    try {
      await fn();
    } catch (err) {
      toasts.error(err);
    } finally {
      busyCategory = null;
    }
  }

  async function doExport() {
    exporting = true;
    try {
      const { filename, blob } = await exportCsv();
      triggerDownload(filename, blob);
      toasts.ok('已导出 CSV');
    } catch (err) {
      toasts.error(err);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="page">
  <header class="page-head">
    <h1>设置</h1>
    <p>{session.user?.email}</p>
  </header>

  <!-- 账本 -->
  <span class="section-title">账本</span>
  <div class="card">
    <dl>
      <div><dt>名称</dt><dd>{household.household?.name}</dd></div>
      <div><dt>币种</dt><dd>{household.currency}</dd></div>
      <div><dt>我是</dt><dd>{household.me?.display_name ?? '—'}</dd></div>
      <div>
        <dt>对方</dt>
        <dd>{household.partner?.display_name ?? '还没加入'}</dd>
      </div>
    </dl>
    <p class="hint">名字固定为 {MEMBER_NAMES.join(' 和 ')}，不能修改。</p>
    {#if alone && household.household}
      <div class="invite">
        <InviteCode code={household.household.invite_code} />
        <p class="hint">把邀请码发给对方，TA 在「加入账本」里填这个码。</p>
      </div>
    {/if}
  </div>

  <!-- 类别 -->
  <span class="section-title">类别</span>
  <div class="card">
    <div class="inline">
      <input
        class="input"
        placeholder="新类别名称"
        maxlength="12"
        bind:value={newCategory}
        onkeydown={(e) => e.key === 'Enter' && addCategory()}
        aria-label="新类别名称"
      />
      <button class="btn" onclick={addCategory} disabled={!newCategory.trim() || addingCategory}>
        添加
      </button>
    </div>

    <ul class="cats">
      {#each household.activeCategories as c, i (c.id)}
        <li class:busy={busyCategory === c.id}>
          {#if editingId === c.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="input rename"
              bind:value={editingName}
              maxlength="12"
              autofocus
              onblur={commitRename}
              onkeydown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') editingId = null;
              }}
              aria-label="类别名称"
            />
          {:else}
            <button class="cat-name" onclick={() => startRename(c)}>{c.name}</button>
          {/if}
          <div class="cat-actions">
            <button
              class="icon"
              aria-label="上移"
              disabled={i === 0 || !!busyCategory}
              onclick={() => run(c.id, () => household.moveCategory(c.id, -1))}>↑</button
            >
            <button
              class="icon"
              aria-label="下移"
              disabled={i === household.activeCategories.length - 1 || !!busyCategory}
              onclick={() => run(c.id, () => household.moveCategory(c.id, 1))}>↓</button
            >
            <button
              class="icon"
              aria-label="归档"
              disabled={!!busyCategory}
              onclick={() => run(c.id, () => household.setArchived(c.id, true))}>归档</button
            >
          </div>
        </li>
      {/each}
    </ul>

    {#if archived.length}
      <button class="toggle" onclick={() => (showArchived = !showArchived)}>
        {showArchived ? '隐藏' : '显示'}已归档（{archived.length}）
      </button>
      {#if showArchived}
        <ul class="cats archived-list">
          {#each archived as c (c.id)}
            <li>
              <span class="cat-name muted">{c.name}</span>
              <div class="cat-actions">
                <button
                  class="icon"
                  disabled={!!busyCategory}
                  onclick={() => run(c.id, () => household.setArchived(c.id, false))}>恢复</button
                >
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <p class="hint">
      已有记录保存的是类别名称，改名或归档都不会改动历史记录。
    </p>
  </div>

  <!-- 安装 -->
  {#if install.available}
    <span class="section-title">安装</span>
    <InstallPrompt />
  {/if}

  <!-- 数据 -->
  <span class="section-title">数据</span>
  <div class="card">
    <button class="btn btn-block" onclick={doExport} disabled={exporting}>
      {exporting ? '导出中…' : '导出 CSV'}
    </button>
    <p class="hint">
      导出全部流水，UTF-8 带 BOM，Excel 和 Numbers 都能直接打开中文。
    </p>
  </div>

  <button class="btn btn-block signout" onclick={() => (confirmSignOut = true)}>退出登录</button>
</div>

<Confirm
  open={confirmSignOut}
  title="退出登录？"
  confirmText="退出"
  danger
  onconfirm={() => session.signOut()}
  oncancel={() => (confirmSignOut = false)}
>
  账本数据保存在云端，下次用同一个邮箱登录就能回来。
</Confirm>

<style>
  .inline {
    display: flex;
    gap: 8px;
  }

  .inline > .input {
    flex: 1;
    min-width: 0;
  }

  .inline > .btn {
    flex: 0 0 auto;
  }

  dl {
    margin: 0;
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 9px 0;
  }

  dl > div + div {
    border-top: 1px solid var(--border);
  }

  dt {
    font-size: 13px;
    color: var(--text-dim);
  }

  dd {
    margin: 0;
    font-size: 14px;
    text-align: right;
  }

  .invite {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .cats {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
  }

  .cats li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    min-height: 46px;
  }

  .cats li.busy {
    opacity: 0.5;
  }

  .cat-name {
    flex: 1;
    min-width: 0;
    text-align: left;
    border: 0;
    background: none;
    font-size: 15px;
    padding: 6px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename {
    flex: 1;
    min-width: 0;
    min-height: 38px;
  }

  .cat-actions {
    display: flex;
    gap: 4px;
    flex: 0 0 auto;
  }

  .icon {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
    min-width: 38px;
    height: 34px;
    padding: 0 8px;
    font-size: 13px;
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }

  .icon:disabled {
    opacity: 0.3;
  }

  .toggle {
    border: 0;
    background: none;
    color: var(--text-dim);
    font-size: 13px;
    padding: 12px 0 4px;
    text-decoration: underline;
  }

  .archived-list li:first-child {
    border-top: 1px solid var(--border);
  }

  .hint {
    margin: 12px 2px 0;
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--text-faint);
  }

  .signout {
    margin-top: 6px;
    color: var(--negative);
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/users";
  import { pageTitle } from "$lib/stores/ui";
  import { dbService } from "$lib/services/database";
  import { showToast } from "$lib/services/toast";
  import { encryptPassword } from "$lib/utils/crypto";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { ADMIN_IDS } from "$lib/constants";
  import { toLocalDateString } from "$lib/utils/date";

  let users: any[] = [];
  let searchQuery = "";
  let isLoading = true;

  let isResetConfirmOpen = false;
  let targetUser: any = null;

  function checkAdminAccess(user: any): boolean {
    if (!user) return false;
    if (user.id && ADMIN_IDS.includes(user.id))
      return true;
    if (!Array.isArray(user.role)) return false;

    const todayStr = toLocalDateString();

    const adminRole = user.role.find((r: any) => r?.ROLE_CD === "COM_ADM_MOB");
    if (!adminRole) return false;
    return adminRole.VALID_PERIOD_END_DT >= todayStr;
  }

  onMount(async () => {
    // 1. 페이지 타이틀 설정
    pageTitle.set($t.usersTitle);

    // 2. 권한 검사
    if (!$auth.isLoggedIn || !checkAdminAccess($auth.user)) {
      showToast($t.usersAccessDenied);
      goto("/");
      return;
    }

    await loadUsers();
  });

  // 언어 변경에 따른 페이지 타이틀 실시간 반응성 확보
  $: {
    pageTitle.set($t.usersTitle);
  }

  async function loadUsers() {
    isLoading = true;
    try {
      const res = await dbService.query(
        "SELECT * FROM tb_mob_set020 ORDER BY mob_user_nm ASC",
      );
      users = res.values || [];
    } catch (err) {
      console.error("[Users Page] Failed to query users from SQLite:", err);
      showToast($t.usersLoadFailed);
    } finally {
      isLoading = false;
    }
  }

  function openResetConfirm(user: any) {
    targetUser = user;
    isResetConfirmOpen = true;
  }

  async function handleResetPassword() {
    if (!targetUser) return;
    isResetConfirmOpen = false;

    try {
      // 초기 비밀번호 = 사용자 ID (사번)
      const initialPwEncrypted = encryptPassword(targetUser.mob_user_id);

      await dbService.run(
        "UPDATE tb_mob_set020 SET mob_user_pw = ? WHERE mob_user_id = ?",
        [initialPwEncrypted, targetUser.mob_user_id],
      );

      showToast(
        $t.usersResetSuccess
          .replace('{name}', targetUser.mob_user_nm)
      );
    } catch (err) {
      console.error("[Users Page] Failed to reset password:", err);
      showToast($t.usersResetFailed);
    }
  }

  function parseRoles(rolesJsonStr: string, currentLang: 'ko' | 'es'): string {
    if (!rolesJsonStr) return t[currentLang].usersNoRole;
    try {
      const roles = JSON.parse(rolesJsonStr);
      if (!Array.isArray(roles)) return t[currentLang].usersNoRole;
      
      const mapped = roles.map((r: any) => {
        const code = r?.ROLE_CD || "";
        if (code === "COM_ADM_MOB") return t[currentLang].usersRoleAdmin;
        if (code === "COM_EAM_MOB") return t[currentLang].usersRoleInspector;
        return code;
      });
      return mapped.filter(Boolean).join(", ");
    } catch (e) {
      console.warn("Failed to parse roles_json:", e);
      return t[currentLang].usersNoRole;
    }
  }

  function parseProcess(code: string, currentLang: 'ko' | 'es'): string {
    const clean = (code || '').trim().toUpperCase();
    if (clean === 'U') return t[currentLang].processUpper || '상공정';
    if (clean === 'L') return t[currentLang].processLower || '하공정';
    if (clean === 'C') return t[currentLang].processCP2 || 'CP2';
    return code || 'N/A';
  }

  $: filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const roleStr = parseRoles(user.roles_json, $lang).toLowerCase();
    const processStr = parseProcess(user.uplo_proc_gbn, $lang).toLowerCase();
    return (
      (user.mob_user_id || "").toLowerCase().includes(q) ||
      (user.mob_user_nm || "").toLowerCase().includes(q) ||
      roleStr.includes(q) ||
      processStr.includes(q)
    );
  });
</script>

<div class="max-w-4xl mx-auto w-full p-4 space-y-6 font-sans">
  <!-- 상단 검색바 및 요약 정보 -->
  <div
    class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 md:p-6 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center"
  >
    <div class="w-full sm:w-auto space-y-1">
      <h2
        class="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight"
      >
        {$t.usersOfflineTitle}
      </h2>
      <p
        class="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider"
      >
        {$t.usersFoundCount.replace('{count}', String(filteredUsers.length))}
      </p>
    </div>

    <!-- 검색 입력창 -->
    <div class="relative w-full sm:w-72">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={$t.usersSearchPlaceholder}
        class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
      />
      <div
        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      {#if searchQuery}
        <button
          type="button"
          on:click={() => (searchQuery = "")}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 border-none bg-transparent cursor-pointer"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>

  <!-- 사용자 리스트 카드 영역 -->
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-20 space-y-3">
      <svg
        class="animate-spin w-8 h-8 text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">
        {$t.usersLoadingText}
      </span>
    </div>
  {:else if filteredUsers.length === 0}
    <div
      class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl py-16 text-center shadow-xs"
    >
      <span class="text-3xl block mb-2">🔍</span>
      <span
        class="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block"
      >
        {$t.usersNoResults}
      </span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each filteredUsers as user}
        <div
          class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs flex justify-between items-center hover:border-blue-500/50 transition-all duration-200 relative overflow-hidden group"
        >
          <!-- 내부 텍스트 세부사항 -->
          <div class="space-y-1.5 min-w-0 flex-1 mr-4 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            <!-- ID (사번) -->
            <div class="flex items-center gap-1">
              <span class="font-black text-slate-400 dark:text-zinc-500 w-12 shrink-0">ID:</span>
              <span class="font-mono font-bold text-slate-800 dark:text-zinc-200">{user.mob_user_id}</span>
            </div>

            <!-- 이름 -->
            <div class="flex items-center gap-1">
              <span class="font-black text-slate-400 dark:text-zinc-500 w-12 shrink-0">
                {$t.usersLabelName}
              </span>
              <span class="font-black text-slate-800 dark:text-zinc-200">
                {user.mob_user_nm || user.mob_user_name || "N/A"}
              </span>
            </div>

            <!-- 권한 -->
            <div class="flex items-center gap-1">
              <span class="font-black text-slate-400 dark:text-zinc-500 w-12 shrink-0">
                {$t.usersLabelRole}
              </span>
              <span class="font-black text-blue-600 dark:text-blue-400">
                {parseRoles(user.roles_json, $lang)}
              </span>
            </div>

            <!-- 공정 -->
            <div class="flex items-center gap-1">
              <span class="font-black text-slate-400 dark:text-zinc-500 w-12 shrink-0">
                {$t.usersLabelProcess || '공정:'}
              </span>
              <span class="font-black text-slate-850 dark:text-zinc-200">
                {parseProcess(user.uplo_proc_gbn, $lang)}
              </span>
            </div>
          </div>

          <!-- 작업 액션 버튼 -->
          <div class="shrink-0">
            <button
              type="button"
              on:click={() => openResetConfirm(user)}
              class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-xs font-black text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 transition-all duration-200 border border-slate-200 dark:border-zinc-700/60 group-hover:border-amber-500/40 cursor-pointer"
            >
              {$t.usersBtnReset}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- 비밀번호 초기화 컨펌 모달 -->
<ConfirmModal
  isOpen={isResetConfirmOpen}
  title={$t.usersResetConfirmTitle}
  message={$t.usersResetConfirmMsg
    .replace('{name}', targetUser?.mob_user_nm || '')
    .replace('{id}', targetUser?.mob_user_id || '')}
  type="confirm"
  on:confirm={handleResetPassword}
  on:cancel={() => (isResetConfirmOpen = false)}
/>

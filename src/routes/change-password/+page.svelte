<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { pageTitle } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
  import { t } from "$lib/locales/changePassword";
  import { dbService } from "$lib/services/database";
  import { showToast } from "$lib/services/toast";
  import { encryptPassword } from "$lib/utils/crypto";

  let currentPassword = "";
  let newPassword = "";
  let confirmPassword = "";

  let showCurrentPassword = false;
  let showNewPassword = false;
  let showConfirmPassword = false;

  let errorMsg = "";
  let isSaving = false;

  onMount(() => {
    // 1. 페이지 타이틀 설정
    pageTitle.set($t.pwTitle);

    // 2. 권한 검증: 온라인 계정, 시스템 하드코딩 계정이거나 로그인이 안 되어 있으면 메인으로
    if (!$auth.isLoggedIn) {
      goto("/");
    } else if ($auth.user?.id === "admin" || $auth.user?.id === "dev") {
      // 시스템 관리자/개발자 하드코딩 계정은 비밀번호 변경 불가
      showToast($t.pwSystemNotAllowed);
      goto("/");
    } else if ($auth.user?.accToken || $auth.user?.rfToken) {
      // 온라인 로그인은 비밀번호 변경 불가
      showToast($t.pwOnlineNotAllowed);
      goto("/");
    }
  });

  // 언어 실시간 변경 시 상단 헤더 타이틀 갱신성 부여
  $: {
    pageTitle.set($t.pwTitle);
  }

  async function handlePasswordChange() {
    errorMsg = "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      errorMsg = $t.pwFillAllFields;
      return;
    }

    if (newPassword !== confirmPassword) {
      errorMsg = $t.pwMismatch;
      return;
    }

    if (newPassword.length < 4) {
      errorMsg = $t.pwTooShort;
      return;
    }

    isSaving = true;

    try {
      const empId = $auth.user?.id;
      const encryptedCurrent = encryptPassword(currentPassword);

      // 1. 현재 비밀번호 대조 검증
      const userCheck = await dbService.query(
        "SELECT * FROM tb_mob_set020 WHERE mob_user_id = ? AND mob_user_pw = ?",
        [empId, encryptedCurrent],
      );

      if (!userCheck.values || userCheck.values.length === 0) {
        errorMsg = $t.pwCurrentIncorrect;
        isSaving = false;
        return;
      }

      // 2. 비밀번호 업데이트 실행
      const encryptedNew = encryptPassword(newPassword);
      await dbService.run(
        "UPDATE tb_mob_set020 SET mob_user_pw = ? WHERE mob_user_id = ?",
        [encryptedNew, empId],
      );

      await showToast($t.pwSaveSuccess);

      // 성공 후 변경 확인을 위해 안전하게 로그아웃 처리하고 메인(로그인 화면)으로 이동
      await auth.logout();
      goto("/");
    } catch (err) {
      console.error(
        "[Change Password] Error updating password in SQLite:",
        err,
      );
      errorMsg = $t.pwSaveFailed;
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="max-w-md mx-auto w-full p-6 space-y-8 font-sans">
  <div
    class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 md:p-8 shadow-sm text-slate-800 dark:text-zinc-100 space-y-6"
  >
    <div class="space-y-1.5 text-center">
      <h2 class="text-lg font-black tracking-tight uppercase">
        {$t.pwHeaderTitle}
      </h2>
      <p
        class="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest"
      >
        {$t.pwHeaderSubtitle}
      </p>
    </div>

    <form on:submit|preventDefault={handlePasswordChange} class="space-y-4">
      <!-- 1. 현재 비밀번호 -->
      <div>
        <label
          class="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
          for="curr_pw"
        >
          {$t.pwLabelCurrent}
        </label>
        <div class="relative w-full">
          <input
            type={showCurrentPassword ? "text" : "password"}
            id="curr_pw"
            bind:value={currentPassword}
            required
            class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm shadow-inner"
          />
          <button
            type="button"
            on:click={() => (showCurrentPassword = !showCurrentPassword)}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350 border-none bg-transparent cursor-pointer p-1 focus:outline-none flex items-center justify-center"
            aria-label={showCurrentPassword
              ? $t.pwHidePassword
              : $t.pwShowPassword}
          >
            {#if showCurrentPassword}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            {:else}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <defs>
                  <mask id="eye-off-mask-1">
                    <rect x="0" y="0" width="24" height="24" fill="white" />
                    <line
                      x1="3"
                      y1="21"
                      x2="21"
                      y2="3"
                      stroke="black"
                      stroke-width="4.5"
                      stroke-linecap="round"
                    />
                  </mask>
                </defs>
                <g mask="url(#eye-off-mask-1)">
                  <path
                    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </g>
                <line x1="5" y1="19" x2="19" y2="5" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <!-- 2. 새 비밀번호 -->
      <div>
        <label
          class="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
          for="new_pw"
        >
          {$t.pwLabelNew}
        </label>
        <div class="relative w-full">
          <input
            type={showNewPassword ? "text" : "password"}
            id="new_pw"
            bind:value={newPassword}
            required
            class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm shadow-inner"
          />
          <button
            type="button"
            on:click={() => (showNewPassword = !showNewPassword)}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350 border-none bg-transparent cursor-pointer p-1 focus:outline-none flex items-center justify-center"
            aria-label={showNewPassword
              ? $t.pwHidePassword
              : $t.pwShowPassword}
          >
            {#if showNewPassword}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            {:else}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <defs>
                  <mask id="eye-off-mask-2">
                    <rect x="0" y="0" width="24" height="24" fill="white" />
                    <line
                      x1="3"
                      y1="21"
                      x2="21"
                      y2="3"
                      stroke="black"
                      stroke-width="4.5"
                      stroke-linecap="round"
                    />
                  </mask>
                </defs>
                <g mask="url(#eye-off-mask-2)">
                  <path
                    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </g>
                <line x1="5" y1="19" x2="19" y2="5" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <!-- 3. 새 비밀번호 확인 -->
      <div>
        <label
          class="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
          for="conf_pw"
        >
          {$t.pwLabelConfirm}
        </label>
        <div class="relative w-full">
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="conf_pw"
            bind:value={confirmPassword}
            required
            class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm shadow-inner"
          />
          <button
            type="button"
            on:click={() => (showConfirmPassword = !showConfirmPassword)}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350 border-none bg-transparent cursor-pointer p-1 focus:outline-none flex items-center justify-center"
            aria-label={showConfirmPassword
              ? $t.pwHidePassword
              : $t.pwShowPassword}
          >
            {#if showConfirmPassword}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            {:else}
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <defs>
                  <mask id="eye-off-mask-3">
                    <rect x="0" y="0" width="24" height="24" fill="white" />
                    <line
                      x1="3"
                      y1="21"
                      x2="21"
                      y2="3"
                      stroke="black"
                      stroke-width="4.5"
                      stroke-linecap="round"
                    />
                  </mask>
                </defs>
                <g mask="url(#eye-off-mask-3)">
                  <path
                    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </g>
                <line x1="5" y1="19" x2="19" y2="5" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <!-- 에러 배너 -->
      {#if errorMsg}
        <div
          class="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200/40 dark:border-rose-900/30 flex items-center gap-2"
        >
          <svg
            class="w-4.5 h-4.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- 하단 액션 버튼 그룹 -->
      <div class="flex gap-3 pt-2">
        <button
          type="button"
          on:click={() => goto("/")}
          class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider text-xs border border-slate-200/50 dark:border-zinc-700/50 cursor-pointer"
        >
          {$t.pwBtnCancel}
        </button>
        <button
          type="submit"
          disabled={isSaving || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
          class="flex-2 w-[65%] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] uppercase tracking-wider text-xs cursor-pointer border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {isSaving ? $t.pwBtnSaving : $t.pwBtnSave}
        </button>
      </div>
    </form>
  </div>
</div>

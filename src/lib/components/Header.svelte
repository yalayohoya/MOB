<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/header";
  import { idleTimeLeft } from "$lib/stores/activity";
  import { theme } from "$lib/stores/ui";
  import { isOnline } from "$lib/stores/network";
  import { fly } from "svelte/transition";
  import { ADMIN_IDS } from "$lib/constants";
  import { toLocalDateString } from "$lib/utils/date";

  export let title: string = "";

  let showDropdown = false;

  $: isMainPage = $page.url.pathname === "/";

  function handleLogout() {
    auth.logout();
    goto("/", { replaceState: true });
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function checkAdminAccess(user: any): boolean {
    if (!user) return false;
    if (user.id && ADMIN_IDS.includes(user.id)) return true;
    if (!Array.isArray(user.role)) return false;

    const todayStr = toLocalDateString();

    const adminRole = user.role.find((r: any) => r?.ROLE_CD === "COM_ADM_MOB");
    if (!adminRole) return false;
    return adminRole.VALID_PERIOD_END_DT >= todayStr;
  }

  function getUserRoles(user: any, currentLang: 'ko' | 'es'): string {
    if (!user) return t[currentLang].noRole;
    const roles = user.role;
    if (!Array.isArray(roles)) return t[currentLang].noRole;

    const mapped = roles.map((r: any) => {
      const code = r?.ROLE_CD || "";
      if (code === "COM_ADM_MOB") return t[currentLang].adminRole;
      if (code === "COM_EAM_MOB") return t[currentLang].inspectorRole;
      return code;
    });
    return mapped.filter(Boolean).join(", ");
  }

  $: userRoleStr = getUserRoles($auth.user, $lang);
  $: mins = Math.floor($idleTimeLeft / 60);
  $: secs = $idleTimeLeft % 60;
  $: hasAdminAccess = $auth.isLoggedIn && checkAdminAccess($auth.user);
</script>


{#if showDropdown}
  <!-- 바디 영역 차단용 백드롭 (헤더 바깥에 위치하여 body 전체를 차단) -->
  <button
    type="button"
    class="fixed inset-0 bg-black/5 dark:bg-black/10 backdrop-blur-[0.5px] z-40 cursor-default border-none outline-none w-full h-full p-0 bg-transparent block"
    on:click|stopPropagation={() => (showDropdown = false)}
    aria-label={$t.dateClose}
  ></button>
{/if}

<!-- 2. 메인 헤더 (상태바 영역 아래에 고정) -->
<header
  class="flex items-center {isMainPage
    ? 'pl-4 pr-1'
    : 'pl-0 pr-1'} glass sticky top-0 z-50 border-b border-slate-200/60 dark:border-zinc-800/60 opacity-100 transition-colors duration-300 shadow-sm shadow-slate-200/60 dark:shadow-none"
  style="min-height: var(--app-header-h);"
>
  <div class="max-w-7xl mx-auto w-full flex items-center justify-between">
    <div class="flex items-center">
      {#if !isMainPage}
        <!-- 서브 페이지: 뒤로가기 + 브래드크럼 -->
        <button
          on:click={() => history.back()}
          class="w-10 h-10 p-2 flex items-center justify-center"
          aria-label={$t.back}
        >
          <svg
            class="w-6 h-6 text-slate-600 dark:text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div class="flex flex-col">
          <h1
            class="text-md font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tighter leading-none"
          >
            {title}
          </h1>
        </div>
      {:else}
        <!-- 메인 페이지: 로고 이미지 적용 (경로: /img/logo.png) -->
        <div class="flex items-center gap-2">
          <img
            src="/img/logo.png"
            alt="SecureScan Ops"
            class="h-6 w-auto object-contain"
          />
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      {#if $auth.isLoggedIn}
        <!-- 실시간 자동 로그아웃 대기 시간 (MM:SS) - !hidden 제거 시 기존 flex 레이아웃으로 즉시 복원됨 -->
        <div
          class="!hidden text-[11px] font-black text-amber-500 dark:text-yellow-400 tabular-nums flex items-center gap-1 select-none mr-1"
          title={$t.headerAutoLogoutTooltip}
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="flex items-center">
            <span>{String(mins).padStart(2, "0")}</span>
            <span class="animate-blink mx-[1px] inline-block">:</span>
            <span>{String(secs).padStart(2, "0")}</span>
          </span>
        </div>
      {/if}

      {#if $auth.isLoggedIn}
        <!-- 사용자 메뉴 드롭다운 -->
        <div class="relative">
          <button
            on:click={() => (showDropdown = !showDropdown)}
            class="bg-transparent border-none p-1 flex items-center justify-center cursor-pointer outline-none transition-transform active:scale-95 relative"
            aria-label={$t.headerUserMenuLabel}
          >
            <!-- 회색으로 찬 사람 상반신 아이콘 -->
            <svg
              class="w-6 h-6 text-slate-400 dark:text-zinc-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clip-rule="evenodd"
              />
            </svg>
            <!-- 온라인/오프라인 상태 표시 도트 (우하단 배치) -->
            <span
              class="absolute bottom-[2px] right-[2px] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-950 transition-colors duration-300 {$isOnline
                ? 'bg-emerald-500'
                : 'bg-amber-500'}"
            ></span>
          </button>

          {#if showDropdown}
            <!-- 헤더 영역 내 다른 버튼 클릭 차단용 백드롭 (헤더의 filter 범위 내에서 차단) -->
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default border-none outline-none w-full h-full p-0 bg-transparent block"
              on:click|stopPropagation={() => (showDropdown = false)}
              aria-label={$t.dateClose}
            ></button>

            <div
              transition:fly={{ y: -6, duration: 180 }}
              class="absolute right-0 mt-2 w-44 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 z-50 flex flex-col font-sans"
            >
              <!-- 사용자 정보 영역 -->
              {#if $auth.user}
                <div class="px-4 py-2 border-b border-slate-100 dark:border-zinc-800/60 select-none">
                  <div class="text-xs font-black text-slate-800 dark:text-zinc-100 truncate">
                    {$auth.user.id || ''}
                  </div>
                  <div class="text-[10px] text-slate-400 dark:text-zinc-500 font-bold mt-0.5 truncate">
                    {userRoleStr}
                  </div>
                </div>
              {/if}

              <!-- 설정 그룹 (테마 + 언어) - 다크모드 대응 및 시각적 그룹화 -->
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="m-1.5 p-2 bg-slate-50 dark:bg-zinc-800/40 rounded-xl space-y-2.5 border border-slate-100 dark:border-zinc-800/60"
                on:click|stopPropagation
              >
                <!-- 테마 설정 행 -->
                <div class="flex items-center justify-between">
                  <span
                    class="text-[10px] font-extrabold text-slate-600 dark:text-zinc-300"
                  >
                    {$t.themeLabel}
                  </span>
                  <button
                    type="button"
                    on:click={() =>
                      theme.set($theme === "light" ? "dark" : "light")}
                    class="relative inline-flex items-center h-6 w-[76px] bg-slate-200 dark:bg-zinc-700 rounded-full p-0.5 border border-slate-300/40 dark:border-zinc-600/40 overflow-hidden select-none cursor-pointer outline-none focus:outline-none"
                  >
                    <div
                      class="absolute top-[1px] bottom-[1px] w-[34px] bg-blue-600 dark:bg-blue-500 rounded-full transition-transform duration-300 ease-out shadow-sm"
                      style="transform: translateX({$theme === 'light'
                        ? '1px'
                        : '37px'});"
                    ></div>

                    <div
                      class="relative z-10 flex-1 text-[8px] font-black text-center flex items-center justify-center h-full transition-colors duration-300 {$theme ===
                      'light'
                        ? 'text-white'
                        : 'text-slate-500 dark:text-zinc-400'}"
                    >
                      LGT
                    </div>
                    <div
                      class="relative z-10 flex-1 text-[8px] font-black text-center flex items-center justify-center h-full transition-colors duration-300 {$theme ===
                      'dark'
                        ? 'text-white'
                        : 'text-slate-500 dark:text-zinc-400'}"
                    >
                      DRK
                    </div>
                  </button>
                </div>

                <!-- 언어 설정 행 -->
                <div class="flex items-center justify-between">
                  <span
                    class="text-[10px] font-extrabold text-slate-600 dark:text-zinc-300"
                  >
                    {$t.langLabel}
                  </span>
                  <button
                    type="button"
                    on:click={() => lang.set($lang === "ko" ? "es" : "ko")}
                    class="relative inline-flex items-center h-6 w-[76px] bg-slate-200 dark:bg-zinc-700 rounded-full p-0.5 border border-slate-300/40 dark:border-zinc-600/40 overflow-hidden select-none cursor-pointer outline-none focus:outline-none"
                  >
                    <div
                      class="absolute top-[1px] bottom-[1px] w-[34px] bg-blue-600 dark:bg-blue-500 rounded-full transition-transform duration-300 ease-out shadow-sm"
                      style="transform: translateX({$lang === 'ko'
                        ? '1px'
                        : '37px'});"
                    ></div>

                    <div
                      class="relative z-10 flex-1 text-[8px] font-black text-center flex items-center justify-center h-full transition-colors duration-300 {$lang ===
                      'ko'
                        ? 'text-white'
                        : 'text-slate-500 dark:text-zinc-400'}"
                    >
                      KOR
                    </div>
                    <div
                      class="relative z-10 flex-1 text-[8px] font-black text-center flex items-center justify-center h-full transition-colors duration-300 {$lang ===
                      'es'
                        ? 'text-white'
                        : 'text-slate-500 dark:text-zinc-400'}"
                    >
                      ESP
                    </div>
                  </button>
                </div>
              </div>

              <!-- 관리자/개발자/슈퍼어드민 전용 사용자 관리 메뉴 -->
              {#if hasAdminAccess}
                <button
                  on:click={() => {
                    showDropdown = false;
                    goto("/users", { replaceState: !isMainPage });
                  }}
                  class="w-full text-left px-4 py-2.5 text-xs font-black text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-none outline-none flex items-center gap-2"
                >
                  <svg
                    class="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{$t.userManagement}</span>
                </button>
              {/if}

              <!-- 오프라인 로그인 시에만 비밀번호 변경 표시 (accToken, rfToken이 없을 때, 단 admin/dev 하드코딩 계정은 제외) -->
              {#if (!$auth.user?.accToken || !$auth.user?.rfToken) && $auth.user?.id !== 'admin' && $auth.user?.id !== 'dev'}
                <button
                  on:click={() => {
                    showDropdown = false;
                    goto("/change-password", { replaceState: !isMainPage });
                  }}
                  class="w-full text-left px-4 py-2.5 text-xs font-black text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-none outline-none flex items-center gap-2"
                >
                  <svg
                    class="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>{$t.changePassword}</span>
                </button>
              {/if}

              <!-- 관리자/개발자/슈퍼어드민 전용 환경설정 메뉴 -->
              {#if hasAdminAccess}
                <button
                  on:click={() => {
                    showDropdown = false;
                    goto("/settings", { replaceState: !isMainPage });
                  }}
                  class="w-full text-left px-4 py-2.5 text-xs font-black text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-none outline-none flex items-center gap-2"
                >
                  <svg
                    class="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{$t.systemSettings}</span>
                </button>
              {/if}

              <!-- 이용자 메뉴얼 메뉴 -->
              <button
                on:click={() => {
                  showDropdown = false;
                  goto("/manual", { replaceState: !isMainPage });
                }}
                class="w-full text-left px-4 py-2.5 text-xs font-black text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-none outline-none flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span>{$t.userManual}</span>
              </button>

              <button
                on:click={() => {
                  showDropdown = false;
                  handleLogout();
                }}
                class="w-full text-left px-4 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/25 transition-colors cursor-pointer border-none outline-none flex items-center gap-2"
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
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>{$t.logout}</span>
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</header>

<style>
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .animate-blink {
    animation: blink 1s step-start infinite;
  }
</style>

<script lang="ts">
  import { Dialog } from "@capacitor/dialog";
  import { showToast } from "$lib/services/toast";
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { dbService } from "$lib/services/database";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/login";
  import ModalSlideUp from "./ModalSlideUp.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import { settings } from "$lib/stores/settings";
  import { isOnline } from "$lib/stores/network";
  import { syncStore } from "$lib/stores/sync";
  import { getBackendErrorMessage } from "$lib/services/authService";
  import { theme } from "$lib/stores/ui";

  const { isSyncing, isExcelPickerOpen, excelFiles, selectedExcelFilename, triggerSync, applySelectedExcel } = syncStore;

  let isConfirmOpen = false;
  let loginEmpId = "";
  let loginPassword = "";
  let loginError = "";
  let lastErrorType = "";
  let customErrorMsg: { ko: string; es: string } | null = null;
  let isLoggingIn = false;
  let showPassword = false;
  let loginAbortController: AbortController | null = null;
  let isDbErrorModalOpen = false;
  let isCancelCooldown = false;
  let isDuplicateLoginConfirmOpen = false;
  let cachedEmpId = "";
  let cachedPassword = "";

  // $lang 언어 전환 시 로그인 에러 메시지도 실시간으로 자동 현지화 번역하는 반응형 블록
  $: {
    if (lastErrorType === "inputError") {
      loginError = $t.inputError;
    } else if (lastErrorType === "missingUrl") {
      loginError = $t.missingUrl;
    } else if (lastErrorType === "invalidCredentials") {
      loginError = $t.invalidCredentials;
    } else if (lastErrorType === "loginTimeout") {
      loginError = $t.loginTimeout;
    } else if (lastErrorType === "requestTimeout") {
      loginError = $t.requestTimeout;
    } else if (lastErrorType === "loginFailed") {
      loginError = $t.loginFailed;
    } else if (lastErrorType === "loginCancelled") {
      loginError = "";
    } else if (lastErrorType === "connectionError") {
      loginError = $t.connectionError;
    } else if (lastErrorType) {
      // R101, R201, R203 등 구체적인 백엔드 결과 코드가 오면 번역 함수 호출
      const specificMsg = customErrorMsg ? customErrorMsg[$lang] : "";
      const backendMsg = getBackendErrorMessage(lastErrorType, specificMsg, $lang);
      // 만약 정의되지 않은 코드가 넘어와서 기본 에러메시지가 반환된 경우, loginscreen에서 안전한 기본 메시지나 공통 메시지로 처리
      if (backendMsg.includes("로그인 인증에 실패했습니다") || backendMsg.includes("Error de autenticación")) {
        loginError = $t.invalidCredentials;
      } else {
        loginError = backendMsg;
      }
    } else {
      loginError = "";
    }
  }

  /**
   * 로그인 처리 함수: 입력된 정보를 로컬 DB의 사용자 정보와 대조함
   */
  async function handleLogin() {
    if (isLoggingIn) {
      if (loginAbortController) {
        loginAbortController.abort();
      }
      isLoggingIn = false;
      loginAbortController = null;
      lastErrorType = "loginCancelled";

      // Cooldown (연타 방지 - B안)
      isCancelCooldown = true;
      setTimeout(() => {
        isCancelCooldown = false;
      }, 1000);
      return;
    }

    loginEmpId = loginEmpId.trim().toUpperCase();
    const trimmedEmpId = loginEmpId;
    const trimmedPassword = loginPassword.trim();

    if (!trimmedEmpId || !trimmedPassword) {
      lastErrorType = "inputError";
      return;
    }

    try {
      isLoggingIn = true;
      lastErrorType = "";
      customErrorMsg = null;
      loginAbortController = new AbortController();

      const result = await auth.login(trimmedEmpId, trimmedPassword, loginAbortController.signal);

      // 이미 사용자가 취소했다면 결과 처리는 완전히 버림
      if (loginAbortController === null) {
        return;
      }

      if (!result.success) {
        if (String(result.errorType) === "-5") {
          cachedEmpId = trimmedEmpId;
          cachedPassword = trimmedPassword;
          isDuplicateLoginConfirmOpen = true;
        } else {
          lastErrorType = result.errorType || "loginFailed";
          customErrorMsg = result.errorMsg || null;
        }
      }
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.name === "AbortError") {
        lastErrorType = "loginCancelled";
      } else {
        const msg = (e as Error).message;
        if (msg === t.ko.loginTimeout || msg === t.es.loginTimeout || msg === "timeout") {
          lastErrorType = "requestTimeout";
        } else {
          lastErrorType = "loginFailed";
        }
      }
    } finally {
      isLoggingIn = false;
      loginAbortController = null;
    }
  }

  /**
   * 중복 로그인 동의 시 FORCE_FLAG="Y"로 재요청하는 강제 로그인 함수
   */
  async function handleForceLogin() {
    isDuplicateLoginConfirmOpen = false;
    if (!cachedEmpId || !cachedPassword) return;

    try {
      isLoggingIn = true;
      lastErrorType = "";
      customErrorMsg = null;
      loginAbortController = new AbortController();

      const result = await auth.login(cachedEmpId, cachedPassword, loginAbortController.signal, "Y");

      if (loginAbortController === null) {
        return;
      }

      if (!result.success) {
        lastErrorType = result.errorType || "loginFailed";
        customErrorMsg = result.errorMsg || null;
      }
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.name === "AbortError") {
        lastErrorType = "loginCancelled";
      } else {
        const msg = (e as Error).message;
        if (msg === t.ko.loginTimeout || msg === t.es.loginTimeout || msg === "timeout") {
          lastErrorType = "requestTimeout";
        } else {
          lastErrorType = "loginFailed";
        }
      }
    } finally {
      isLoggingIn = false;
      loginAbortController = null;
      // 인증 완료 시 캐시 클리어
      cachedEmpId = "";
      cachedPassword = "";
    }
  }

  onMount(() => {
    const init = async () => {
      try {
        await dbService.init();
      } catch (e) {
        console.error("DB init failed in login component:", e);
        isDbErrorModalOpen = true;
      }
    };
    init();
  });
</script>

<div class="relative h-screen min-h-175 z-100 bg-[#0054a6] dark:bg-linear-to-br dark:from-slate-950 dark:via-zinc-900 dark:to-slate-950 flex items-center justify-center p-6 pt-18 pb-10 ">
  <!-- 좌측 상단 화면테마 선택 토글 (LIGHT / DARK) -->
  <div class="absolute top-4 left-6 z-10">
    <button
      type="button"
      on:click={() => theme.set($theme === "light" ? "dark" : "light")}
      class="relative inline-flex h-7 w-27 backdrop-blur-md rounded-full p-0.5 border overflow-hidden font-sans select-none shadow-lg cursor-pointer outline-none focus:outline-none {$theme ===
      'dark'
        ? 'bg-black/35 border-white/10'
        : 'bg-white/20 border-white/20'}">
      <div
        class="absolute top-0.5 bottom-0.5 w-12.5 rounded-full transition-transform duration-300 ease-out shadow-sm {$theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}"
        style="transform: translateX({$theme === 'light' ? '0px' : '52px'});">
      </div>

      <div class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {$theme === 'light' ? 'text-[#0054a6]' : 'text-zinc-500'}">
        LIGHT
      </div>

      <div class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {$theme === 'dark' ? 'text-zinc-100' : 'text-white/70'}">
        DARK
      </div>
    </button>
  </div>

  <!-- 우측 상단 언어 선택 토글 (KOR / ESP) -->
  <div class="absolute top-4 right-6 z-10">
    <button
      type="button"
      on:click={() => lang.set($lang === "ko" ? "es" : "ko")}
      class="relative inline-flex h-7 w-24 backdrop-blur-md rounded-full p-0.5 border overflow-hidden font-sans select-none shadow-lg cursor-pointer outline-none focus:outline-none {$theme ===
      'dark'
        ? 'bg-black/35 border-white/10'
        : 'bg-white/20 border-white/20'}">
      <div
        class="absolute top-0.5 bottom-0.5 w-11 rounded-full transition-transform duration-300 ease-out shadow-sm {$theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}"
        style="transform: translateX({$lang === 'ko' ? '0px' : '46px'});">
      </div>

      <div
        class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {$lang === 'ko'
          ? $theme === 'dark'
            ? 'text-zinc-100'
            : 'text-[#0054a6]'
          : $theme === 'dark'
            ? 'text-zinc-500'
            : 'text-white/70'}">
        KOR
      </div>

      <div
        class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {$lang === 'es'
          ? $theme === 'dark'
            ? 'text-zinc-100'
            : 'text-[#0054a6]'
          : $theme === 'dark'
            ? 'text-zinc-500'
            : 'text-white/70'}">
        ESP
      </div>
    </button>
  </div>

  <div
    class="w-full max-w-md flex flex-col items-center justify-center bg-white dark:bg-zinc-900/60 dark:backdrop-blur-2xl min-h-125 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-zinc-800/80 transition-all duration-300">
    <!-- 상단 로고 및 슬로건: SecureScan Ops 로고와 서비스 지향점을 표시 -->
    <div class="text-center mb-6 flex flex-col items-center gap-5">
      <img src="/img/logo.png" alt="SecureScan Ops" class="h-12 w-auto object-contain" />

      <!-- 공장 및 공정명 다국어 표시 (POSCO 아르헨티나 테마에 맞춘 블루 타이틀) -->
      <h2 class="text-[#0054a6] dark:text-blue-400 text-md font-extrabold tracking-tight">
        {$lang === "ko" ? `${$settings.plantName} ${$settings.processName}` : `${$settings.plantNameEs} ${$settings.processNameEs}`}
      </h2>
    </div>

    <!-- 로그인 입력 폼: 사원번호와 이름을 입력받아 로컬 인증을 수행함 -->
    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      <div>
        <label for="emp_id" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
          {$t.id}
          <span class={$isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400 animate-blink"}>
            ({$isOnline ? $t.online : $t.offline})
          </span>
        </label>
        <input
          type="text"
          id="emp_id"
          bind:value={loginEmpId}
          placeholder={$t.idPlaceholder}
          autocomplete="off"
          spellcheck="false"
          class="w-full bg-slate-50 dark:bg-zinc-950/65 border border-slate-200 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-slate-800 dark:text-zinc-100 font-bold focus:outline-none focus:border-blue-500 dark:focus:border-indigo-550 focus:ring-1 focus:ring-blue-500 dark:focus:ring-indigo-550 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-550 placeholder:font-normal uppercase" />
      </div>
      <div>
        <label for="username" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{$t.password}</label>
        <div class="relative w-full">
          <input
            type={showPassword ? "text" : "password"}
            id="username"
            bind:value={loginPassword}
            placeholder={$t.passwordPlaceholder}
            autocomplete="off"
            spellcheck="false"
            class="w-full bg-slate-50 dark:bg-zinc-950/65 border border-slate-200 dark:border-zinc-800/80 rounded-xl pl-4 pr-12 py-3 text-slate-800 dark:text-zinc-100 font-bold focus:outline-none focus:border-blue-500 dark:focus:border-indigo-550 focus:ring-1 focus:ring-blue-500 dark:focus:ring-indigo-550 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-550 placeholder:font-normal" />
          <button
            type="button"
            on:click={() => (showPassword = !showPassword)}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350 border-none bg-transparent cursor-pointer p-1 focus:outline-none flex items-center justify-center"
            aria-label={showPassword ? $t.pwHidePassword : $t.pwShowPassword}>
            {#if showPassword}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <defs>
                  <mask id="eye-off-mask">
                    <rect x="0" y="0" width="24" height="24" fill="white" />
                    <line x1="3" y1="21" x2="21" y2="3" stroke="black" stroke-width="4.5" stroke-linecap="round" />
                  </mask>
                </defs>
                <g mask="url(#eye-off-mask)">
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                  <circle cx="12" cy="12" r="3" />
                </g>
                <line x1="5" y1="19" x2="19" y2="5" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      {#if loginError}
        <div class="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg font-medium animate-pulse">
          {loginError}
        </div>
      {/if}

      <button
        type="submit"
        disabled={$isSyncing || isCancelCooldown || (!isLoggingIn && (!loginEmpId.trim() || !loginPassword.trim()))}
        class="w-full bg-blue-600 dark:bg-indigo-650 text-white font-bold py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none {isLoggingIn
          ? 'opacity-50 cursor-pointer'
          : 'hover:bg-blue-500 dark:hover:bg-indigo-650 active:scale-[0.98]'}">
        <div class="flex items-center justify-center gap-2">
          {#if isLoggingIn}
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{$t.loginCancel}</span>
          {:else}
            <span>{$t.login}</span>
          {/if}
        </div>
      </button>
    </form>

    <!-- 하단 안내 영역: 동기화 정보 및 네트워크 연결 상태 실시간 표시 -->
    <div class="mt-6 space-y-4 text-center border-t border-slate-100 dark:border-zinc-800 pt-6">
      <div>
        <p class="text-[11px] text-slate-400 leading-relaxed mb-3">
          {$t.syncGuideDetail}
        </p>
      </div>

      <!-- 네트워크 상태 표시기 (글로벌 스토어 연동) -->
      {#if !$isOnline}
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-200 dark:border-amber-800/50">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {$t.offline}
        </div>
      {:else}
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-100 dark:border-emerald-800/30">
          <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          {$t.online}
        </div>
      {/if}

      <div class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium pt-1">
        {$t.version}
        {$settings.appVersion}
      </div>
    </div>
  </div>
</div>

<!-- 엑셀 파일 선택용 바텀 시트 슬라이드 모달 (오프라인 동기화용) -->
<ModalSlideUp isOpen={$isExcelPickerOpen} title={$t.updateInspectorsTitle} subTitle={$t.applyLatestExcel} on:close={() => isExcelPickerOpen.set(false)}>
  <div class="space-y-4 py-4 font-sans text-slate-800 dark:text-zinc-100 flex flex-col h-full max-h-[60vh]">
    <p class="text-xs text-slate-400 dark:text-zinc-500 font-medium leading-relaxed">
      {$t.excelPickerDescription}
    </p>

    <!-- 파일 리스트 영역 -->
    <div class="flex-1 overflow-y-auto space-y-2 max-h-[40vh] pr-1">
      {#each $excelFiles as file}
        <button
          type="button"
          on:click={() => selectedExcelFilename.set(file.filename)}
          class="w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between {$selectedExcelFilename === file.filename
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 bg-slate-50/30 dark:bg-zinc-900/30'}">
          <div class="flex flex-col gap-1 min-w-0 flex-1 mr-4">
            <span class="text-xs font-black truncate text-slate-700 dark:text-zinc-200">
              {file.filename}
            </span>
            <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              📅 {file.formattedDate}
            </span>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span class="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-1 rounded font-bold">
              {(file.size / 1024).toFixed(1)} KB
            </span>

            <div
              class="w-5 h-5 rounded-full flex items-center justify-center border {$selectedExcelFilename === file.filename
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-slate-300 dark:border-zinc-600'}">
              {#if $selectedExcelFilename === file.filename}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>

    <!-- 버튼 영역 -->
    <div class="flex gap-3 mt-4 shrink-0">
      <button
        type="button"
        on:click={() => isExcelPickerOpen.set(false)}
        class="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm">
        {$t.cancel}
      </button>
      <button
        type="button"
        on:click={applySelectedExcel}
        disabled={!$selectedExcelFilename}
        class="flex-2 w-[65%] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed">
        {$t.apply}
      </button>
    </div>
  </div>
</ModalSlideUp>

<!-- 최종 동기화 재컨펌 모달 연동 -->
<ConfirmModal
  isOpen={isConfirmOpen}
  title={$t.syncConfirmTitle}
  message={$t.syncConfirmMessage}
  on:confirm={() => {
    isConfirmOpen = false;
    triggerSync(true);
  }}
  on:cancel={() => (isConfirmOpen = false)} />

<!-- DB 연결 실패 시 수동 복구 안내 경고 모달 -->
<ConfirmModal
  bind:isOpen={isDbErrorModalOpen}
  title={$t.dbInitErrorTitle}
  message={$t.dbInitErrorMsg}
  confirmText={$t.confirm}
  type="error"
  on:confirm={() => {
    isDbErrorModalOpen = false;
  }} />

<!-- 중복 로그인 감지 시 연결 해제 선택 컨펌 모달 -->
<ConfirmModal
  bind:isOpen={isDuplicateLoginConfirmOpen}
  title={$t.duplicateLoginTitle}
  message={$t.duplicateLoginMessage}
  confirmText={$t.confirm}
  cancelText={$t.cancel}
  type="confirm"
  on:confirm={handleForceLogin}
  on:cancel={() => (isDuplicateLoginConfirmOpen = false)} />

<style>
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
  .animate-blink {
    animation: blink 1.2s infinite;
  }

  /* 자동완성(Autofill) 시 발생하는 브라우저 기본 하늘색/노란색 배경 강제 오버라이드 방지 */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
    box-shadow: 0 0 0 1000px #f8fafc inset !important;
    -webkit-text-fill-color: #1e293b !important;
  }

  :global(.dark) input:-webkit-autofill,
  :global(.dark) input:-webkit-autofill:hover,
  :global(.dark) input:-webkit-autofill:focus,
  :global(.dark) input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #09090b inset !important;
    box-shadow: 0 0 0 1000px #09090b inset !important;
    -webkit-text-fill-color: #f4f4f5 !important;
  }
</style>

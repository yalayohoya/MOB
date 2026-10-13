<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { pageTitle, theme } from "$lib/stores/ui";
  import { showToast } from "$lib/services/toast";
  import { settings, defaultSettings } from "$lib/stores/settings";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/settings";
  import { dbService } from "$lib/services/database";
  import { checkForUpdate } from "$lib/services/update";
  import { PUBLIC_APP_VERSION } from "$lib/constants";

  let localLang: "ko" | "es" = "ko";
  let localRadioSelection = "1공장 LP";
  let localPlant = "";
  let localPlantEs = "";
  let localProcess = "";
  let localProcessEs = "";
  let localBaseUrl = "";
  let localUserApi = "";
  let localStd01Api = "";
  let localStd02Api = "";
  let localStd03Api = "";
  let localRst01Api = "";
  let localAccessTokenApi = "";
  let localRefreshTokenApi = "";
  let localVersionApi = "";
  let localAutoSendYn = "N";
  let isCheckingUpdate = false;

  async function handleCheckForUpdate() {
    if (isCheckingUpdate) return;
    isCheckingUpdate = true;
    try {
      await checkForUpdate(true);
    } finally {
      isCheckingUpdate = false;
    }
  }

  const plantOptions = [
    { value: "1공장 LP", label: "1공장 LP", labelEs: "Planta 1 LP", plantKo: "1공장", plantEs: "Planta 1", processKo: "LP", processEs: "LP" },
    { value: "1공장 LH", label: "1공장 LH", labelEs: "Planta 1 LH", plantKo: "1공장", plantEs: "Planta 1", processKo: "LH", processEs: "LH" },
    { value: "2공장 LC", label: "2공장 LC", labelEs: "Planta 2 LC", plantKo: "2공장", plantEs: "Planta 2", processKo: "LC", processEs: "LC" }
  ];

  function selectPlant(optValue: string) {
    const opt = plantOptions.find(o => o.value === optValue);
    if (opt) {
      localRadioSelection = opt.value;
      localPlant = opt.plantKo;
      localPlantEs = opt.plantEs;
      localProcess = opt.processKo;
      localProcessEs = opt.processEs;
    }
  }

  onMount(async () => {
    // 1. Set dynamic page title
    pageTitle.set($t.settingsTitle);

    // 2. DB에서 최신 설정값 조회하여 스토어 및 로컬 폼 상태 동기화
    let currentConfig = await dbService.getConfig();
    if (currentConfig) {
      settings.set(currentConfig);
    } else {
      currentConfig = $settings;
    }

    localLang = currentConfig.defaultLang || 'ko';
    localPlant = currentConfig.plantName || '1공장';
    localPlantEs = currentConfig.plantNameEs || 'Planta 1';
    localProcess = currentConfig.processName || 'LP';
    localProcessEs = currentConfig.processNameEs || 'LP';
    localBaseUrl = currentConfig.baseUrl || '';
    localUserApi = currentConfig.userApi || '';
    localStd01Api = currentConfig.std01Api || '';
    localStd02Api = currentConfig.std02Api || '';
    localStd03Api = currentConfig.std03Api || '';
    localRst01Api = currentConfig.rst01Api || '';
    localAccessTokenApi = currentConfig.accessTokenApi || '';
    localRefreshTokenApi = currentConfig.refreshTokenApi || '';
    localVersionApi = currentConfig.versionApi || '/EAM/mob/version';
    localAutoSendYn = currentConfig.autoSendYn || 'N';

    // Detect matching radio selection
    const matchingOption = plantOptions.find(
      opt => opt.plantKo === localPlant && opt.processKo === localProcess
    );
    if (matchingOption) {
      localRadioSelection = matchingOption.value;
    } else {
      // Fallback to "1공장 LP" if not matched
      localRadioSelection = "1공장 LP";
      localPlant = "1공장";
      localPlantEs = "Planta 1";
      localProcess = "LP";
      localProcessEs = "LP";
    }
  });

  // 3. Reactively update title on language change
  $: {
    pageTitle.set($t.settingsTitle);
  }

  async function handleResetSettings() {
    if (!confirm($t.settingsConfirmReset)) {
      return;
    }

    settings.set(defaultSettings);
    await dbService.saveConfig(defaultSettings);
    lang.set(defaultSettings.defaultLang);
    theme.set("light");

     // Reset local values
    localLang = defaultSettings.defaultLang;
    localPlant = defaultSettings.plantName;
    localPlantEs = defaultSettings.plantNameEs;
    localProcess = defaultSettings.processName;
    localProcessEs = defaultSettings.processNameEs;
    localBaseUrl = defaultSettings.baseUrl;
    localUserApi = defaultSettings.userApi;
    localStd01Api = defaultSettings.std01Api;
    localStd02Api = defaultSettings.std02Api;
    localStd03Api = defaultSettings.std03Api;
    localRst01Api = defaultSettings.rst01Api;
    localAccessTokenApi = defaultSettings.accessTokenApi;
    localRefreshTokenApi = defaultSettings.refreshTokenApi;
    localVersionApi = defaultSettings.versionApi;
    localAutoSendYn = defaultSettings.autoSendYn;

    localRadioSelection = "1공장 LP";

    await showToast($t.settingsResetMsg);
  }

  async function handleSaveSettings() {
    const newSettings = {
      defaultLang: localLang,
      plantName: localPlant.trim(),
      plantNameEs: localPlantEs.trim(),
      processName: localProcess.trim(),
      processNameEs: localProcessEs.trim(),
      baseUrl: localBaseUrl.trim(),
      userApi: localUserApi.trim(),
      std01Api: localStd01Api.trim(),
      std02Api: localStd02Api.trim(),
      std03Api: localStd03Api.trim(),
      rst01Api: localRst01Api.trim(),
      accessTokenApi: localAccessTokenApi.trim(),
      refreshTokenApi: localRefreshTokenApi.trim(),
      versionApi: localVersionApi.trim(),
      appVersion: $settings.appVersion,
      autoSendYn: localAutoSendYn,
    };

    settings.set(newSettings);
    
    // SQLite DB에 환경설정 즉각 비동기 보존
    await dbService.saveConfig(newSettings);

    // Update global language store immediately
    lang.set(localLang);

    await showToast($t.settingsSavedMsg);
  }
</script>

<div class="max-w-7xl mx-auto p-6 space-y-8 w-full font-sans">
  <!-- 설정 입력 폼 필드 그룹 -->
  <form
    on:submit|preventDefault={handleSaveSettings}
    class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 text-slate-800 dark:text-zinc-100 relative overflow-hidden max-w-4xl mx-auto"
  >

    <!-- 공장 선택 (Premium Radio Card Group) -->
    <div class="space-y-2.5">
      <span class="block text-[11px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
        {$t.plantName}
      </span>
      <div class="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-slate-200/30 dark:border-zinc-700/30">
        {#each plantOptions as opt}
          <button
            type="button"
            on:click={() => selectPlant(opt.value)}
            class="flex items-center justify-center py-3 px-2 rounded-xl transition-all cursor-pointer select-none text-center active:scale-95 duration-200 border-none outline-none focus:outline-none
              {localRadioSelection === opt.value
                ? 'bg-blue-600 text-white font-black shadow-md'
                : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 font-bold'}"
          >
            <span class="text-xs sm:text-sm whitespace-nowrap uppercase tracking-tight">
              {$lang === 'es' ? opt.labelEs : opt.label}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- 기본 URL 주소 -->
    <div>
      <label
        class="block text-xs font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
        for="base_url"
      >
        {$t.baseUrl}
      </label>
      <input
        type="text"
        id="base_url"
        bind:value={localBaseUrl}
        required
        placeholder="http://172.16.1.100/"
        class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-4 py-3.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm shadow-inner"
      />
    </div>

    <!-- 점검 저장 시 자동 실적 전송 (Y/N) 토글 카드 -->
    <div class="bg-slate-50/70 dark:bg-zinc-800/40 p-4.5 rounded-2xl border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between gap-4">
      <div class="space-y-0.5">
        <span class="block text-xs font-black text-slate-800 dark:text-zinc-200">
          {$t.autoSendYnLabel}
        </span>
        <span class="block text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          {$t.autoSendYnDesc}
        </span>
      </div>

      <!-- 슬라이딩 토글 버튼 스위치 -->
      <button
        type="button"
        on:click={() => (localAutoSendYn = localAutoSendYn === "Y" ? "N" : "Y")}
        class="relative inline-flex h-7 w-12 shrink-0 p-0.5 items-center cursor-pointer rounded-full transition-colors duration-300 ease-in-out focus:outline-none select-none active:scale-95 border-none outline-none
          {localAutoSendYn === 'Y' ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'}"
        role="switch"
        aria-checked={localAutoSendYn === 'Y'}
      >
        <span class="sr-only">{$t.autoSendYnLabel}</span>
        <span
          class="pointer-events-none inline-flex h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-300 ease-in-out items-center justify-center text-[11px] font-black leading-none
            {localAutoSendYn === 'Y' ? 'translate-x-5 text-blue-600' : 'translate-x-0 text-slate-500'}"
        >
          {localAutoSendYn}
        </span>
      </button>
    </div>

    <!-- API 경로 목록 바인딩 정보 카드 -->
    <div 
      class="space-y-4 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl p-5 border border-slate-100 dark:border-zinc-800/50 hidden"
    >
      <h4 class="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 pb-2">
        {$t.settingsApiEndpointConfig}
      </h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 점검자 수신 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="user_api"
          >
            {$t.userApi}
          </label>
          <input
            type="text"
            id="user_api"
            bind:value={localUserApi}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>

        <!-- 점검기준정보 수신 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="std01_api"
          >
            {$t.std01Api}
          </label>
          <input
            type="text"
            id="std01_api"
            bind:value={localStd01Api}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>

        <!-- 설비사양정보 수신 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="std02_api"
          >
            {$t.std02Api}
          </label>
          <input
            type="text"
            id="std02_api"
            bind:value={localStd02Api}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>

        <!-- 설비점검계획 수신 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="std03_api"
          >
            {$t.std03Api}
          </label>
          <input
            type="text"
            id="std03_api"
            bind:value={localStd03Api}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>
      </div>

      <!-- 설비점검실적 송신 API (전체 폭) -->
      <div>
        <label
          class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
          for="rst01_api"
        >
          {$t.rst01Api}
        </label>
        <input
          type="text"
          id="rst01_api"
          bind:value={localRst01Api}
          required
          class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
        />
      </div>

      <!-- 토큰 인증 API (2열 그리드) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 엑세스토큰 인증 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="access_token_api"
          >
            {$t.accessTokenApi}
          </label>
          <input
            type="text"
            id="access_token_api"
            bind:value={localAccessTokenApi}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>

        <!-- 리프레시토큰 인증 API -->
        <div>
          <label
            class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
            for="refresh_token_api"
          >
            {$t.refreshTokenApi}
          </label>
          <input
            type="text"
            id="refresh_token_api"
            bind:value={localRefreshTokenApi}
            required
            class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
          />
        </div>
      </div>

      <!-- 앱 버전 확인 API (전체 폭) -->
      <div>
        <label
          class="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1"
          for="version_api"
        >
          {$t.versionApi}
        </label>
        <input
          type="text"
          id="version_api"
          bind:value={localVersionApi}
          required
          class="w-full bg-white dark:bg-black/25 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
        />
      </div>
    </div>

    <!-- 수동 버전 확인 버튼 -->
    <div class="pt-2">
      <button
        type="button"
        on:click={handleCheckForUpdate}
        disabled={isCheckingUpdate}
        class="w-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-zinc-200 font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer"
      >
        {#if isCheckingUpdate}
          <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          버전 확인 중...
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          앱 업데이트 버전 확인 (현재: {PUBLIC_APP_VERSION || '1.0'})
        {/if}
      </button>
    </div>

    <!-- 하단 조작 컨트롤 버튼 그룹 -->
    <div class="flex gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800/50">
      <button
        type="button"
        on:click={handleResetSettings}
        class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider text-xs border border-slate-200/50 dark:border-zinc-700/50 cursor-pointer"
      >
        {$t.resetBtn}
      </button>
      <button
        type="submit"
        class="flex-2 w-[65%] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] uppercase tracking-wider text-xs cursor-pointer border-none outline-none"
      >
        {$t.saveBtn}
      </button>
    </div>
  </form>
</div>

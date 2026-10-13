<script lang="ts">
  import { showToast } from "$lib/services/toast";
  import { settings, defaultSettings } from "$lib/stores/settings";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/settings";
  import ModalSlideUp from "./ModalSlideUp.svelte";
  import { dbService } from "$lib/services/database";

  export let isOpen = false;

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
  let localVersionApi = "";

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

  // Sync local variables when modal opens
  $: {
    if (isOpen) {
      localLang = $settings.defaultLang;
      localPlant = $settings.plantName;
      localPlantEs = $settings.plantNameEs;
      localProcess = $settings.processName;
      localProcessEs = $settings.processNameEs;
      localBaseUrl = $settings.baseUrl;
      localUserApi = $settings.userApi;
      localStd01Api = $settings.std01Api;
      localStd02Api = $settings.std02Api;
      localStd03Api = $settings.std03Api;
      localRst01Api = $settings.rst01Api;
      localVersionApi = $settings.versionApi || '/EAM/mob/version';

      // Detect matching radio selection
      const matchingOption = plantOptions.find(
        opt => opt.plantKo === localPlant && opt.processKo === localProcess
      );
      if (matchingOption) {
        localRadioSelection = matchingOption.value;
      } else {
        // Fallback
        localRadioSelection = "1공장 LP";
        localPlant = "1공장";
        localPlantEs = "Planta 1";
        localProcess = "LP";
        localProcessEs = "LP";
      }
    }
  }

  async function handleResetSettings() {
    if (!confirm($t.settingsConfirmReset)) {
      return;
    }

    // Write back default values to settings store and SQLite
    settings.set(defaultSettings);
    await dbService.saveConfig(defaultSettings);

    // Sync global language store back to default language
    lang.set(defaultSettings.defaultLang);

    localRadioSelection = "1공장 LP";

    isOpen = false;

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
      versionApi: localVersionApi.trim(),
      accessTokenApi: $settings.accessTokenApi,
      refreshTokenApi: $settings.refreshTokenApi,
      appVersion: $settings.appVersion,
      autoSendYn: $settings.autoSendYn || 'N',
    };

    settings.set(newSettings);

    // SQLite DB에 환경설정 즉각 비동기 보존
    await dbService.saveConfig(newSettings);

    // Update lang store immediately
    lang.set(localLang);

    isOpen = false;

    await showToast($t.settingsSavedMsg);
  }
</script>

<!-- 환경설정 바텀 시트 슬라이드 모달 -->
<ModalSlideUp
  {isOpen}
  title={$t.settingsTitle}
  subTitle={$t.settingsSubtitle}
  on:close={() => (isOpen = false)}
>
  <form
    on:submit|preventDefault={handleSaveSettings}
    class="space-y-4 py-4 font-sans text-slate-800 dark:text-zinc-100"
  >
    <!-- 기본언어 -->
    <div
      class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3"
    >
      <span
        class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
      >
        {$t.defaultLangLabel}
      </span>
      <button
        type="button"
        on:click={() => (localLang = localLang === "ko" ? "es" : "ko")}
        class="relative inline-flex h-7 w-[96px] bg-slate-100 dark:bg-zinc-800 rounded-full p-0.5 border border-slate-200/50 dark:border-zinc-700/50 overflow-hidden select-none cursor-pointer outline-none focus:outline-none"
      >
        <!-- 슬라이딩 썸 (원형 인디케이터) -->
        <div
          class="absolute top-[2px] bottom-[2px] w-[44px] bg-blue-600 rounded-full transition-transform duration-300 ease-out shadow-sm"
          style="transform: translateX({localLang === 'ko' ? '0px' : '46px'});"
        ></div>

        <div
          class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {localLang ===
          'ko'
            ? 'text-white'
            : 'text-slate-500 dark:text-zinc-400'}"
        >
          KOR
        </div>
        <div
          class="relative z-10 flex-1 text-[10px] font-black text-center flex items-center justify-center transition-colors duration-300 {localLang ===
          'es'
            ? 'text-white'
            : 'text-slate-500 dark:text-zinc-400'}"
        >
          ESP
        </div>
      </button>
    </div>

    <!-- 공장 선택 (Premium Segmented Control) -->
    <div class="space-y-2">
      <span class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
        {$t.plantName}
      </span>
      <div class="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-850 p-1.5 rounded-2xl border border-slate-200/30 dark:border-zinc-700/30">
        {#each plantOptions as opt}
          <button
            type="button"
            on:click={() => selectPlant(opt.value)}
            class="flex items-center justify-center py-2.5 px-1 rounded-xl transition-all cursor-pointer select-none text-center active:scale-95 duration-200 border-none outline-none focus:outline-none
              {localRadioSelection === opt.value
                ? 'bg-blue-600 text-white font-bold shadow-md'
                : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 font-medium'}"
          >
            <span class="text-xs whitespace-nowrap tracking-tight">
              {$lang === 'es' ? opt.labelEs : opt.label}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- 기본 URL -->
    <div>
      <label
        class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1"
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
        class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
      />
    </div>

    <!-- API Paths List -->
    <div
      class="space-y-3 bg-slate-50/50 dark:bg-zinc-800/20 rounded-xl p-3 border border-slate-100 dark:border-zinc-800/40"
    >
      <!-- 점검자 수신 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="user_api"
        >
          {$t.userApi}
        </label>
        <input
          type="text"
          id="user_api"
          bind:value={localUserApi}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <!-- 점검기준정보 수신 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="std01_api"
        >
          {$t.std01Api}
        </label>
        <input
          type="text"
          id="std01_api"
          bind:value={localStd01Api}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <!-- 설비사양정보 수신 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="std02_api"
        >
          {$t.std02Api}
        </label>
        <input
          type="text"
          id="std02_api"
          bind:value={localStd02Api}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <!-- 설비점검계획 수신 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="std03_api"
        >
          {$t.std03Api}
        </label>
        <input
          type="text"
          id="std03_api"
          bind:value={localStd03Api}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <!-- 설비점검실적 송신 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="rst01_api"
        >
          {$t.rst01Api}
        </label>
        <input
          type="text"
          id="rst01_api"
          bind:value={localRst01Api}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <!-- 앱 버전 확인 API -->
      <div>
        <label
          class="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5"
          for="modal_version_api"
        >
          {$t.versionApi}
        </label>
        <input
          type="text"
          id="modal_version_api"
          bind:value={localVersionApi}
          required
          class="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
        />
      </div>
    </div>

    <!-- Save & Reset Buttons (Side-by-Side) -->
    <div class="flex gap-3 mt-6 mb-6">
      <button
        type="button"
        on:click={handleResetSettings}
        class="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm"
      >
        {$t.resetBtn}
      </button>
      <button
        type="submit"
        class="flex-2 w-[65%] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-sm"
      >
        {$t.saveBtn}
      </button>
    </div>
  </form>
</ModalSlideUp>

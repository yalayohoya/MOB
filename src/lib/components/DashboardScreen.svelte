<script lang="ts">
  import { goto } from "$app/navigation";
  import { t } from "$lib/locales/dashboard";
  import { isOnline } from "$lib/stores/network";
  import { syncStore } from "$lib/stores/sync";
  import ModalSlideUp from "./ModalSlideUp.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";

  const { isSyncing, isTransmitting, isExcelPickerOpen, excelFiles, selectedExcelFilename, triggerSync, transmitResults, applySelectedExcel, syncStepText, syncAbortController } = syncStore;

  let isConfirmOpen = false;
  let isCancelConfirmOpen = false;
  let isCancelCooldown = false;

  function promptCancelSync() {
    isCancelConfirmOpen = true;
  }

  function handleCancelSync() {
    isCancelConfirmOpen = false;
    if ($syncAbortController) {
      $syncAbortController.abort();
    }
    isCancelCooldown = true;
    setTimeout(() => {
      isCancelCooldown = false;
    }, 1500);
  }
</script>

<div class="max-w-7xl mx-auto flex-1 flex flex-col w-full">
  <!-- 대시보드 헤더 섹션 (다국어 완벽 지원, 세로 수직 중앙 배치) -->
  <section class="bg-slate-900 text-white p-10 h-[180px] shadow-xl relative overflow-hidden shrink-0 flex flex-col justify-center">
    <div class="relative z-10">
      <h2 class="text-3xl font-black mb-4 tracking-tighter uppercase leading-tight">
        {$t.dashboardTitle}
      </h2>
      <p class="text-slate-400 text-sm font-medium">
        {$t.dashboardSubtitle}
      </p>
    </div>
  </section>

  <!-- 메인 액션 버튼 그룹 (CSS Grid를 적용하여 모든 버튼의 높이를 소수점 단위까지 완벽히 일치시킴) -->
  <div class="grid grid-cols-2 auto-rows-fr flex-1 px-6 pt-6 pb-10 gap-3 min-h-0">
    <!-- 1. 점검 시작 버튼 (대시보드의 주인공: Hero Gradient Card - 블록형) -->
    <button
      on:click={() => goto("/maintenance")}
      class="col-span-2 flex flex-row items-center p-3 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 border border-blue-500/20 rounded-2xl shadow-sm hover:brightness-[1.04] hover:scale-[1.005] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 group text-left w-full relative overflow-hidden">
      <!-- 배경 Radial 조명 데코레이션 -->
      <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-lg group-hover:scale-125 transition-transform duration-500"></div>

      <div class="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center text-white shrink-0 backdrop-blur-md shadow-inner mr-2">
        <svg class="w-5.5 h-5.5 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12h10" class="animate-pulse" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke-width="2" />
        </svg>
      </div>
      <div class="flex flex-col justify-center min-w-0 z-10">
        <h3 class="font-black text-[23px] leading-tight text-white tracking-tight break-keep">
          {$t.startInspection}
        </h3>
        <p class="text-[16px] text-blue-100/90 mt-0.5 uppercase font-bold tracking-wider opacity-85">QR Scan</p>
      </div>
    </button>

    <!-- 2. 점검 이력 버튼 (글래스모피즘 + 에메랄드 마이크로 글로우 - 블록형) -->
    <button
      on:click={() => goto("/history")}
      class="col-span-2 flex flex-row items-center p-3 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-900 dark:to-zinc-900/60 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl shadow-xs hover:border-emerald-500/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 hover:scale-[1.005] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group text-left w-full relative overflow-hidden">
      <div
        class="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mr-2 group-hover:scale-105 transition-transform">
        <svg class="w-5.5 h-5.5 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      </div>
      <div class="flex flex-col justify-center min-w-0">
        <h3 class="font-extrabold text-[23px] leading-tight text-slate-800 dark:text-zinc-100 tracking-tight break-keep">
          {$t.inspectionLogs}
        </h3>
        <p class="text-[16px] text-slate-400 dark:text-zinc-500 mt-0.5 uppercase font-bold tracking-wider">Inspection Logs</p>
      </div>
    </button>

    <!-- 3. 데이터 수신 버튼 -->
    <button
      on:click={() => triggerSync()}
      disabled={$isSyncing || $isTransmitting}
      class="col-span-1 flex flex-row items-center p-3 pr-1 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-900 dark:to-zinc-900/60 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl shadow-xs hover:border-indigo-500/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 hover:scale-[1.005] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group text-left relative overflow-hidden disabled:opacity-75">
      <div
        class="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-2 group-hover:scale-105 transition-transform">
        {#if $isSyncing}
          <svg class="animate-spin w-5.5 h-5.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else if $isOnline}
          <svg class="w-5.5 h-5.5 group-hover:translate-y-1 transition-transform duration-350 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V14" />
          </svg>
        {:else}
          <svg class="w-5.5 h-5.5 group-hover:translate-y-1 transition-transform duration-350 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 2v6h6" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 11h3m-3 3h3m-3 3h3" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14.5 11v6m-2.5-2.5l2.5 2.5 2.5-2.5" />
          </svg>
        {/if}
      </div>
      <div class="flex flex-col justify-center min-w-0 flex-1">
        <h3 class="font-extrabold text-[18px] leading-tight text-slate-800 dark:text-zinc-100 tracking-tight break-keep">
          {$t.dataReceive}
        </h3>
        <p class="text-[14px] mt-0.5 uppercase font-bold tracking-wider flex items-center">
          {#if $isSyncing}
            <span class="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-bold">
              🔄 {$t.syncingText}
            </span>
          {:else if $isOnline}
            <span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              {$t.sincApi}
            </span>
          {:else}
            <span class="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              {$t.sincExcel}
            </span>
          {/if}
        </p>
      </div>
      {#if $isSyncing}
        <div class="absolute bottom-0 left-0 h-[3px] bg-indigo-500 animate-[loading_1.5s_ease-in-out_infinite] w-full"></div>
      {/if}
    </button>

    <!-- 4. 실적 송신 버튼 -->
    <button
      on:click={() => transmitResults()}
      disabled={$isSyncing || $isTransmitting}
      class="col-span-1 flex flex-row items-center p-3 pr-1 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-900 dark:to-zinc-900/60 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl shadow-xs hover:border-indigo-500/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 hover:scale-[1.005] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group text-left relative overflow-hidden disabled:opacity-75">
      <div
        class="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-2 group-hover:scale-105 transition-transform">
        {#if $isTransmitting}
          <svg class="animate-spin w-5.5 h-5.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else if $isOnline}
          <svg class="w-5.5 h-5.5 group-hover:-translate-y-1 transition-transform duration-350 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8" />
          </svg>
        {:else}
          <svg class="w-5.5 h-5.5 group-hover:-translate-y-1 transition-transform duration-350 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 2v6h6" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 11h3m-3 3h3m-3 3h3" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14.5 11v6m-2.5-2.5l2.5-2.5 2.5 2.5" />
          </svg>
        {/if}
      </div>
      <div class="flex flex-col justify-center min-w-0 flex-1">
        <h3 class="font-extrabold text-[18px] leading-tight text-slate-800 dark:text-zinc-100 tracking-tight break-keep">
          {$t.dataTransmit}
        </h3>
        <p class="text-[14px] mt-0.5 uppercase font-bold tracking-wider flex items-center">
          {#if $isTransmitting}
            <span class="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-bold">
              🔄 {$t.transmittingText}
            </span>
          {:else if $isOnline}
            <span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              {$t.transApi}
            </span>
          {:else}
            <span class="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
              {$t.transExcel}
            </span>
          {/if}
        </p>
      </div>
      {#if $isTransmitting}
        <div class="absolute bottom-0 left-0 h-[3px] bg-indigo-500 animate-[loading_1.5s_ease-in-out_infinite] w-full"></div>
      {/if}
    </button>

    <!-- 5. 설비 사양 조회 버튼 (글래스모피즘 + 퍼플 마이크로 글로우 - 블록형) -->
    <button
      on:click={() => goto("/specs")}
      class="col-span-2 flex flex-row items-center p-3 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-900 dark:to-zinc-900/60 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl shadow-xs hover:border-purple-500/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 hover:scale-[1.005] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group text-left w-full relative overflow-hidden">
      <div
        class="w-11 h-11 bg-purple-50 dark:bg-purple-950/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mr-2 group-hover:scale-105 transition-transform">
        <svg class="w-5.5 h-5.5 group-hover:-rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.2"
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <div class="flex flex-col justify-center min-w-0">
        <h3 class="font-extrabold text-[23px] leading-tight text-slate-800 dark:text-zinc-100 font-sans tracking-tight break-keep">
          {$t.specsTitle}
        </h3>
        <p class="text-[16px] text-slate-400 dark:text-zinc-500 mt-0.5 uppercase font-bold tracking-wider">Equipment Specs</p>
      </div>
    </button>
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
  type="warning"
  showCancel={true}
  on:confirm={() => {
    isConfirmOpen = false;
    triggerSync();
  }}
  on:cancel={() => (isConfirmOpen = false)} />

<!-- 동기화 취소 확인용 경고 모달 -->
<ConfirmModal
  isOpen={isCancelConfirmOpen}
  title={$t.cancelConfirmTitle}
  message={$t.cancelConfirmMessage}
  confirmText={$t.confirm}
  cancelText={$t.cancel}
  type="confirm"
  on:confirm={handleCancelSync}
  on:cancel={() => (isCancelConfirmOpen = false)} />

<!-- 화면 전체를 덮는 프리미엄 동기화/송신 로딩 화면 -->
{#if $isSyncing || $isTransmitting}
  <div class="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center">
    <!-- 스피너 -->
    <div class="mb-6 relative flex items-center justify-center">
      <svg class="animate-spin h-16 w-16 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <div class="absolute text-[10px] font-black text-blue-400 tracking-wider">
        {#if $isSyncing}SYNC{:else}SEND{/if}
      </div>
    </div>

    <!-- 타이틀 -->
    <h3 class="text-base font-extrabold mb-1 tracking-tight">
      {#if $isSyncing}
        {$t.syncingText}
      {:else}
        {$t.transmittingText}
      {/if}
    </h3>

    <!-- 진행 단계 정보 -->
    <p class="text-xs text-slate-400 font-medium max-w-xs mb-8 whitespace-pre-line animate-pulse">
      {$syncStepText || "요청을 처리하는 중입니다..."}
    </p>

    <!-- 취소 버튼 -->
    <button
      type="button"
      on:click={promptCancelSync}
      disabled={isCancelCooldown}
      class="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold transition-all active:scale-[0.98] tracking-wider text-xs uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
      {#if isCancelCooldown}
        {$t.cancel}...
      {:else}
        {$t.cancel}
      {/if}
    </button>
  </div>
{/if}

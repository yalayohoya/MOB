<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import ModalSlideUp from "$lib/components/ModalSlideUp.svelte";
  import QRScannerOverlay from "$lib/components/QRScannerOverlay.svelte";
  import { dbService } from "$lib/services/database";
  import { APP_CONFIG } from "$lib/constants";
  import { pageTitle, isScanning as isScanningStore } from "$lib/stores/ui";
  import { t } from "$lib/locales/scanner";
  import { Capacitor } from "@capacitor/core";
  import { Dialog } from "@capacitor/dialog";

  // --- 타입 정의 ---
  interface Equipment {
    id: string;
    name: string;
    location: string;
    type: string;
    is_active: number;
    last_checked: string | null;
  }

  // --- 상태 관리 ---
  let isScanning = false;
  let isInitializing = true;
  let errorMessage = "";

  /**
   * 스캔된 결과값을 처리하는 공통 함수
   */
  async function handleScanResult(rawValue: string) {
    isScanning = false;

    let targetId = "";

    // A. 우리 앱 전용 딥링크인 경우 ID 추출
    if (rawValue.startsWith(APP_CONFIG.APP_SCHEME)) {
      const parts = rawValue.split("/");
      targetId = parts[parts.length - 1];
    }
    // B. 일반 텍스트인 경우 그대로 사용
    else {
      targetId = rawValue;
    }

    // DB 존재 여부 확인 (실물 tb_mob_std120 기준)
    try {
      const result = await dbService.query(
        "SELECT asset_nm FROM tb_mob_std120 WHERE asset_id = ? LIMIT 1",
        [targetId],
      );

      if (result && result.values && result.values.length > 0) {
        // DB에 존재하는 설비인 경우 -> 성공 UI로 전환
        scannedValue = targetId;
      } else {
        // DB에 없는 설비인 경우 -> 에러 상태로 처리 (재스캔 버튼 유도)
        scannedValue = "";
        errorMessage = $t.maintenanceNotRegisteredEquip.replace("{id}", targetId);
      }
    } catch (err) {
      console.error("DB 검증 중 오류:", err);
      errorMessage = $t.maintenanceDbError;
    }
  }

  // 설비 검색 관련 상태
  let isSearchModalOpen = false;
  let searchKeyword = "";
  let searchResults: Equipment[] = [];
  let isSearching = false;
  let searchInputRef: HTMLInputElement;

  // 무한 스크롤 상태
  let page = 0;
  let hasMore = true;
  const LIMIT = 20;
  let isLoadingMore = false;
  let scrollContainer: HTMLDivElement;
  let scannedValue = ""; // 스캔된 결과값 저장
  async function searchEquipment(isLoadMore: boolean = false) {
    if (isLoadMore) {
      if (!hasMore || isLoadingMore) return;
      isLoadingMore = true;
    } else {
      isSearching = true;
      page = 0;
      hasMore = true;
      searchResults = [];
    }

    try {
      const offset = isLoadMore ? page * LIMIT : 0;

      // 중앙 공용 설비 쿼리 API 연동 (다중 검색 필터 및 페이징 전격 이식!)
      const newItemsRaw = await dbService.getEquipmentSpecs({
        keyword: searchKeyword,
        limit: LIMIT,
        offset: offset,
      });

      // 기존 UI 타입 호환을 위한 명품 초경량 매핑 어댑터 가동
      const newItems: Equipment[] = newItemsRaw.map((item) => ({
        id: item.asset_id,
        name: item.asset_nm,
        location: item.install_loc,
        type: item.asset_tp || "Normal",
        is_active: 1,
        last_checked: null,
      }));

      if (newItems.length < LIMIT) {
        hasMore = false;
      }

      if (isLoadMore) {
        searchResults = [...searchResults, ...newItems];
        page++;
      } else {
        searchResults = newItems;
        page = 1;
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      isSearching = false;
      isLoadingMore = false;
    }
  }

  /**
   * 스크롤 핸들러 (무한 스크롤)
   */
  function handleScroll(e: any) {
    const target = e.target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    // 스크롤이 바닥에서 50px 이내로 접근하면 다음 페이지 로드
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      searchEquipment(true);
    }
  }

  /**
   * 검색 모달 열기
   */
  async function openSearch() {
    isSearchModalOpen = true;
    searchKeyword = "";
    // 모달이 렌더링된 후 데이터를 로드하기 위해 약간의 지연
    setTimeout(() => {
      searchEquipment(false);
      searchInputRef?.focus();
    }, 100);
  }

  $: {
    pageTitle.set($t.scannerTitle);
  }

  onMount(() => {
    isScanning = true;
    isInitializing = false;
  });
</script>

<svelte:head>
  <title>QR 스캔 - SecureScan Ops</title>
</svelte:head>

<div
  class="relative min-h-(--app-body-h) flex flex-col {isScanning
    ? 'bg-transparent'
    : 'bg-app-bg'}"
>
  {#if isScanning}
    <QRScannerOverlay
      on:scan={(e) => handleScanResult(e.detail.value)}
      on:close={() => isScanning = false}
    >
      <!-- 하단 정보 패널 (자동 높이 조절) -->
      <div
        class="relative bg-white dark:bg-zinc-900 shadow-[0_-20px_40px_rgba(0,0,0,0.2)] p-6 z-20"
      >
        <div class="w-full space-y-4">
          {#if !scannedValue}
            <div class="text-center space-y-1">
              <h3
                class="text-lg font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight"
              >
                {$t.scannerReadyTitle}
              </h3>
              <p class="text-[11px] text-slate-400 font-bold tracking-wider">
                {$t.scannerReadyDesc}
              </p>
            </div>
          {:else}
            <div
              class="text-center space-y-1 animate-in fade-in zoom-in duration-300"
            >
              <h3
                class="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight"
              >
                {$t.scannerSuccessTitle}
              </h3>
              <p class="text-sm text-slate-600 dark:text-zinc-300 font-bold">
                {$t.scannerSuccessDesc.replace("{id}", scannedValue)}
              </p>
            </div>
          {/if}

          <div class="flex gap-3 mt-4 w-full">
            {#if !scannedValue}
              <!-- 스캔 전: 검색 버튼이 넓게 -->
              <button
                on:click={openSearch}
                class="flex-1 py-4 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-2xl font-bold text-sm border border-slate-200/60 dark:border-zinc-700 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <svg
                  class="w-5 h-5 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  /></svg
                >
                <span>{$t.maintenanceSelectEquipment}</span>
              </button>
            {:else}
              <!-- 스캔 후: 다시 스캔 / 점검 시작 (1:1 비율) -->
              <button
                on:click={() => {
                  scannedValue = "";
                  isScanning = true;
                }}
                class="flex-1 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-sm border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  /></svg
                >
                {$t.scannerRescan}
              </button>

              <button
                on:click={() => goto(`/maintenance/${encodeURIComponent(scannedValue)}?workGbn=MOB`)}
                class="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-[0.95]"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M5 13l4 4L19 7"
                  /></svg
                >
                {$t.scannerStart}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </QRScannerOverlay>
  {:else if !isInitializing}
    <main
      class="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden z-20"
    >
      <div class="text-center space-y-6 w-full max-w-sm" transition:fade>
        <!-- 상태 아이콘 -->
        <div
          class="w-24 h-24 {scannedValue
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'} rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-zinc-700 shadow-sm"
        >
          {#if scannedValue}
            <svg
              class="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          {:else}
            <svg
              class="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          {/if}
        </div>

        <!-- 메시지 영역 -->
        <div class="space-y-2">
          <h2 class="text-2xl font-black text-slate-800 dark:text-zinc-100">
            {scannedValue ? $t.scannerSuccessTitle : $t.scannerWaitTitle}
          </h2>

          {#if scannedValue}
            <div
              class="p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/30"
            >
              <p
                class="text-xs uppercase tracking-widest font-black opacity-60 mb-1"
              >
                Scanned ID
              </p>
              <p class="text-lg font-black tracking-tight">{scannedValue}</p>
            </div>
            <p
              class="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed"
            >
              {$t.scannerConfirmStart}
            </p>
          {:else}
            <div
              class="p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/30"
            >
              <p class="text-sm font-bold tracking-tight">
                {errorMessage || $t.scannerNotFound}
              </p>
            </div>
            <p
              class="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed"
            >
              {$t.scannerPermissionOrDamage}
            </p>
          {/if}
        </div>

        <!-- 버튼 액션 그룹 -->
        <div class="flex flex-col gap-3 pt-4 w-full">
          {#if scannedValue}
            <!-- 성공 시 3버튼 -->
            <button
              on:click={() => goto(`/maintenance/${encodeURIComponent(scannedValue)}?workGbn=MOB`)}
              class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.95] flex items-center justify-center gap-2"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              {$t.scannerStart}
            </button>

            <div class="grid grid-cols-2 gap-3">
              <button
                on:click={() => {
                  scannedValue = "";
                  errorMessage = "";
                  isScanning = true;
                }}
                class="py-4 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {$t.scannerRescan}
              </button>
              <button
                on:click={openSearch}
                class="py-4 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold hover:border-blue-500 transition-all flex items-center justify-center gap-2"
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
                    stroke-width="2.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {$t.maintenanceSelectEquipment}
              </button>
            </div>
          {:else}
            <!-- 실패 시 2버튼 -->
            <button
              on:click={() => {
                errorMessage = "";
                isScanning = true;
              }}
              class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {$t.scannerRescan}
            </button>

            <button
              on:click={openSearch}
              class="w-full py-4 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold shadow-sm hover:border-blue-500 transition-all flex items-center justify-center gap-2"
            >
              <svg
                class="w-5 h-5 text-slate-400"
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
              {$t.maintenanceManualSelect}
            </button>
          {/if}
        </div>
      </div>
    </main>
  {/if}

  <!-- 설비 검색 모달 (바텀 시트 스타일 컴포넌트 사용) -->
  <ModalSlideUp
    bind:isOpen={isSearchModalOpen}
    title={$t.maintenanceSelectEquipment}
    subTitle={$t.maintenanceManualEquipmentSearch}
  >
    <div class="pb-6 pt-2 flex-1 flex flex-col min-h-0">
      <!-- 검색 입력 영역 (상단 여백 유지) -->
      <div
        class="relative shrink-0 mb-4 border-b border-slate-100 dark:border-zinc-800 pb-4 focus-within:border-blue-500 transition-colors"
      >
        <div class="flex items-center gap-3">
          <svg
            class="h-5 w-5 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            bind:this={searchInputRef}
            bind:value={searchKeyword}
            on:input={() => searchEquipment(false)}
            type="text"
            placeholder={$t.scannerSearchPlaceholder}
            class="block w-full py-2 bg-transparent focus:outline-none text-sm font-bold text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-600 border-none outline-none"
          />
          {#if searchKeyword}
            <button
              on:click={() => {
                searchKeyword = "";
                searchEquipment(false);
              }}
              aria-label={$t.maintenanceClearSearch}
              class="text-slate-300 hover:text-blue-500 transition-colors border-none bg-transparent cursor-pointer"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          {/if}
        </div>
      </div>

      <!-- 리스트 영역 -->
      <div class="flex-1 overflow-hidden flex flex-col min-h-0">
        {#if isSearching}
          <div class="flex-1 flex flex-col items-center justify-center">
            <div
              class="w-8 h-8 border-3 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"
            ></div>
          </div>
        {:else if searchResults.length > 0}
          <section
            class="flex-1 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
          >
            <!-- 리스트 헤더 (로그창 스타일 차용) -->
            <div
              class="shrink-0 hidden md:grid grid-cols-12 bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-y border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 tracking-widest"
            >
              <div class="col-span-2 text-center">{$t.scannerAssetIdLabel}</div>
              <div class="col-span-5">{$t.maintenanceEquipInfo}</div>
              <div class="col-span-3 text-center">{$t.maintenanceLocation}</div>
              <div class="col-span-2 text-right">{$t.maintenanceInspectLabel}</div>
            </div>

            <!-- 리스트 바디 (스크롤 가능) -->
            <div
              on:scroll={handleScroll}
              class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800"
            >
              {#each searchResults as equip}
                <button
                  on:click={() => goto(`/maintenance/${encodeURIComponent(equip.id)}?workGbn=MOB`)}
                  class="w-full text-left px-4 py-5 md:grid md:grid-cols-12 items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group border-none bg-transparent"
                >
                  <!-- 자산 번호 -->
                  <div
                    class="col-span-2 flex flex-col md:items-center mb-2 md:mb-0"
                  >
                    <span
                      class="text-[10px] font-black bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider inline-block md:hidden mb-1 w-fit"
                      >{equip.type}</span
                    >
                    <p
                      class="text-[10px] font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-widest"
                    >
                      {equip.id}
                    </p>
                  </div>

                  <!-- 설비 정보 -->
                  <div class="col-span-5 flex items-start gap-2">
                    <div>
                      <p
                        class="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight"
                      >
                        {equip.name}
                      </p>
                      <div class="flex items-center gap-2 mt-0.5 md:hidden">
                        <span
                          class="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full"
                          >{equip.location}</span
                        >
                      </div>
                      <p
                        class="text-[10px] text-slate-400 font-bold mt-1 hidden md:block"
                      >
                        {equip.type}
                      </p>
                    </div>
                  </div>

                  <!-- 위치 (데스크탑) -->
                  <div class="col-span-3 hidden md:block text-center">
                    <span
                      class="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full"
                      >{equip.location}</span
                    >
                  </div>

                  <!-- 액션 -->
                  <div
                    class="col-span-2 text-right flex items-center justify-end"
                  >
                    <div
                      class="text-[10px] font-black text-slate-300 group-hover:text-blue-600 transition-all uppercase tracking-widest flex items-center gap-1"
                    >
                      <span class="hidden md:inline">{$t.maintenanceInspectLabel}</span>
                      <svg
                        class="w-4 h-4 md:w-3 md:h-3 transform group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M9 5l7 7-7 7"
                        /></svg
                      >
                    </div>
                  </div>
                </button>
              {/each}

              {#if isLoadingMore}
                <div class="py-4 flex justify-center w-full">
                  <div
                    class="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
                  ></div>
                </div>
              {/if}
            </div>
          </section>
        {:else if searchKeyword}
          <div
            class="flex-1 flex flex-col items-center justify-center text-center"
          >
            <p class="text-sm text-slate-400 font-bold italic">
              {$t.maintenanceInfoNoResults.replace("{query}", searchKeyword)}
            </p>
          </div>
        {:else}
          <div
            class="flex-1 flex flex-col items-center justify-center text-center"
          >
            <p
              class="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]"
            >
              {$t.maintenanceInfoNotFound}
            </p>
          </div>
        {/if}
      </div>
    </div>
  </ModalSlideUp>
</div>


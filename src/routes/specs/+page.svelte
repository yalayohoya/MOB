<script lang="ts">
  import { onMount } from "svelte";
  import { dbService } from "$lib/services/database";
  import { pageTitle } from "$lib/stores/ui";
  import { t } from "$lib/locales/specs";
  import QRScannerOverlay from "$lib/components/QRScannerOverlay.svelte";
  import { Capacitor } from "@capacitor/core";
  import { APP_CONFIG } from "$lib/constants";
  import { debounce } from "$lib/utils/debounce";

  let isScanning = false;

  function handleScan(rawValue: string) {
    let targetId = "";
    if (rawValue.startsWith(APP_CONFIG.APP_SCHEME)) {
      const parts = rawValue.split("/");
      targetId = parts[parts.length - 1];
    } else {
      targetId = rawValue;
    }
    searchQuery = targetId;
    isScanning = false;
  }

  // 설계서 기준 tb_mob_std120에 완전히 부합하는 설비 사양 인터페이스 수립
  interface EquipmentSpec {
    fac_gbn: string;
    uplo_proc_gbn: string;
    uplo_proc_gbn_nm: string;
    asset_id: string;
    asset_nm: string;
    asset_csf_cd: string;
    large_csf_cd: string;
    midd_csf_cd: string;
    sml_csf_cd: string;
    proc_asset_cd: string;
    parent_asset_id: string;
    parent_asset_nm: string;
    proc_cd: string;
    proc_nm: string;
    install_loc: string;
    strct_fmt: string;
    asset_imp_dgr: string; // 설비중요도 (A/B/C)
    dtl_spec: string; // 상세사양
    spec: string; // 규격
    vol: string; // 용량
    asset_tp: string; // 설비유형
    tag_id: string; // TAG ID
  }

  let equipmentList: EquipmentSpec[] = [];
  let searchQuery = "";
  let isLoading = true;
  let isLoadingMore = false;
  let hasMore = true;

  onMount(() => {
    // 1. 페이지 타이틀 동적 설정
    pageTitle.set($t.specsTitle);
  });

  // 2. 언어 토글에 대응하여 페이지 타이틀 실시간 연동
  $: {
    pageTitle.set($t.specsTitle);
  }

  // 3. 설비 사양 비동기 조회 (더 보기 & 검색 통합 지원)
  async function searchSpecs(isLoadMore = false) {
    if (isLoadingMore) return;
    if (isLoadMore) {
      isLoadingMore = true;
    } else {
      isLoading = true;
    }

    try {
      const limit = 30;
      const offset = isLoadMore ? equipmentList.length : 0;
      const res = await dbService.getEquipmentSpecs({
        keyword: searchQuery,
        limit,
        offset,
        searchBy: 'all'
      });
      
      if (isLoadMore) {
        equipmentList = [...equipmentList, ...res];
      } else {
        equipmentList = res;
      }
      hasMore = res.length === limit;
    } catch (e) {
      console.error(
        "[Specs Page] Failed to fetch equipment specs via getEquipmentSpecs:",
        e,
      );
    } finally {
      isLoading = false;
      isLoadingMore = false;
    }
  }

  // 4. 새로운 검색어가 입력되면 딜레이를 감지하여 DB 검색 수행 (공용 디바운스 유틸 적용)
  const debouncedSearch = debounce(() => {
    searchSpecs(false);
  }, 300);

  $: {
    searchQuery;
    if (searchQuery === "") {
      searchSpecs(false); // 검색어를 지웠을 때는 즉시 조회
    } else {
      debouncedSearch(); // 텍스트 입력 중일 때는 300ms 딜레이 감지 후 조회
    }
  }
</script>

<div class="relative w-full shadow-sm">
  <div
    class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
  >
    <svg
      class="h-5 w-5 text-slate-400 dark:text-zinc-500"
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
  </div>
  <input
    type="text"
    bind:value={searchQuery}
    placeholder={$t.searchPlaceholder}
    class="block w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 transition-all font-sans text-sm font-medium"
  />
  <button
    type="button"
    on:click={() => isScanning = true}
    class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-500 transition-colors border-none bg-transparent cursor-pointer"
    title={$t.specsQrSearchTitle}
  >
    <svg
      class="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2.5"
        d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M7 12h10"
        class="animate-pulse"
      />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke-width="2" />
    </svg>
  </button>
</div>

{#if isScanning}
  <QRScannerOverlay
    on:scan={(e) => handleScan(e.detail.value)}
    on:close={() => isScanning = false}
  />
{/if}

<div class="max-w-7xl mx-auto p-6 space-y-8 w-full">
  <!-- 검색 컨트롤 바 (고성능 디자인 필터) -->

  <!-- 설비 카드 그리드 -->
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-20 space-y-4">
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"
      ></div>
      <p
        class="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse"
      >
        {$t.specsLoadingSpecs}
      </p>
    </div>
  {:else if equipmentList.length === 0}
    <!-- 한국어 주석: 검색 결과가 없을 때 (점검 이력 화면의 디자인 패밀리룩과 완벽 통일) -->
    <div
      class="py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 transition-all text-center w-full"
    >
      <div
        class="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6"
      >
        <svg
          class="w-8 h-8 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3
        class="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-widest mb-1"
      >
        {$t.noSearchResultsTitle}
      </h3>
      <p class="text-[11px] text-slate-400 px-4">
        {$t.noSearchResultsDesc.replace(
          "{query}",
          searchQuery,
        )}
      </p>
      <button
        type="button"
        on:click={() => (searchQuery = "")}
        class="mt-8 px-8 py-3 bg-slate-900 dark:bg-zinc-800 text-white rounded-lg font-black text-[10px] uppercase tracking-[0.2em] transform transition active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none cursor-pointer border-none outline-none"
      >
        {$t.resetSearch}
      </button>
    </div>
  {:else}
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each equipmentList as eq (eq.asset_id)}
          <div
            class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-emerald-500/80 transition-all flex flex-col justify-between group relative overflow-hidden"
          >
            <div class="space-y-4">
              <!-- 설비 헤더 (설비 ID를 메인 타이틀로 강조 & 중요도 배지) -->
              <div class="flex items-start justify-between gap-3">
                <h3
                  class="font-mono font-black text-base text-slate-800 dark:text-zinc-100 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors leading-snug tracking-tight"
                >
                  {eq.asset_id}
                </h3>

                <!-- 중요도 등급(A/B/C)에 대응하는 세련된 3색 배지 연쇄 할당 -->
                <span
                  class="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tight shrink-0 uppercase border {eq.asset_imp_dgr ===
                  'A'
                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                    : eq.asset_imp_dgr === 'B'
                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                      : 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/30'}"
                >
                  {$t.specsImportance}
                  {eq.asset_imp_dgr || "C"}
                </span>
              </div>

              <!-- 세부 사양 정보 리스트 (설비 ID 타이틀 하단 지정 레이아웃 매칭) -->
              <div
                class="space-y-2.5 text-xs border-t border-slate-100 dark:border-zinc-800/50 pt-4"
              >
                <!-- 1. 설비명 -->
                <div class="flex justify-between items-center gap-4">
                  <span class="text-slate-400 font-semibold"
                    >{$t.specsEquipName}</span
                  >
                  <span class="text-slate-800 dark:text-zinc-300 font-extrabold text-right"
                    >{eq.asset_nm || "-"}</span
                  >
                </div>

                <!-- 2. 사양 (상세사양) -->
                {#if eq.dtl_spec}
                  <div class="flex flex-col gap-1 border-y border-slate-50 dark:border-zinc-800/30 py-2">
                    <span class="text-slate-400 font-semibold"
                      >{$t.specsDetailSpec}</span
                    >
                    <p class="text-[11px] text-slate-600 dark:text-zinc-400 font-medium leading-relaxed bg-slate-50/50 dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100/50 dark:border-zinc-900/30 whitespace-pre-wrap max-h-20 overflow-y-auto font-mono">
                      {eq.dtl_spec}
                    </p>
                  </div>
                {/if}

                <!-- 3. 수리공정 -->
                <div class="flex justify-between items-center gap-4">
                  <span class="text-slate-400 font-semibold"
                    >{$t.specsProcess}</span
                  >
                  <span class="text-slate-700 dark:text-zinc-300 font-extrabold"
                    >{eq.proc_nm || "-"}</span
                  >
                </div>

                <!-- 4. 규격 -->
                <div class="flex justify-between items-center gap-4">
                  <span class="text-slate-400 font-semibold"
                    >{$t.specsSpec}</span
                  >
                  <span class="text-slate-700 dark:text-zinc-300 font-extrabold text-right break-all"
                    >{eq.spec || "-"}</span
                  >
                </div>

                <!-- 5. 용량 -->
                <div class="flex justify-between items-center gap-4">
                  <span class="text-slate-400 font-semibold"
                    >{$t.specsCapacity}</span
                  >
                  <span class="text-slate-700 dark:text-zinc-300 font-extrabold"
                    >{eq.vol || "-"}</span
                  >
                </div>

                <!-- 6. TAG ID -->
                <div class="flex justify-between items-center gap-4">
                  <span class="text-slate-400 font-semibold"
                    >TAG ID</span
                  >
                  <span class="text-slate-700 dark:text-zinc-300 font-extrabold font-mono"
                    >{eq.tag_id || "-"}</span
                  >
                </div>
              </div>
            </div>

            <!-- 호버 가속 효과용 에메랄드 장식 라인 -->
            <div
              class="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full bg-emerald-500 transition-all duration-300"
            ></div>
          </div>
        {/each}
      </div>

      <!-- [고성능 지연 로더 더 보기 버튼 마크업] -->
      {#if hasMore}
        <div class="flex justify-center pt-4">
          <button
            type="button"
            on:click={() => searchSpecs(true)}
            disabled={isLoadingMore}
            class="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl transition-all active:scale-[0.97] text-xs uppercase tracking-wider border border-slate-200/50 dark:border-zinc-700/50 cursor-pointer flex items-center gap-3 shadow-xs select-none disabled:opacity-50"
          >
            <span>{isLoadingMore ? $t.maintenanceLoadingMore : $t.specsLoadMore}</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

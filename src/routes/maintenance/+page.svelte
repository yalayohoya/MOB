<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import DateAdjuster from "$lib/components/DateAdjuster.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { dbService } from "$lib/services/database";
  import { pageTitle, isInitialized } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/maintenance";
  import QRScannerOverlay from "$lib/components/QRScannerOverlay.svelte";
  import { APP_CONFIG } from "$lib/constants";
  import ModalSlideUp from "$lib/components/ModalSlideUp.svelte";
  import { toLocalDateString } from "$lib/utils/date";

  let tasks = $state<any[]>([]);
  let isLoading = $state(true);
  let isScanning = $state(false);
  let errorMessage = $state("");
  let lastScannedValue = $state("");
  let isTransitioning = $state(false);

  // URL 쿼리 파라미터 date 바인딩 (e.g. ?date=YYYY-MM-DD 또는 YYYYMMDD)
  const dateParam = $derived($page.url.searchParams.get("date"));

  // 로그인 정보 공통 바인딩 (Svelte 5 반응형 파생 상태)
  const empId = $derived($auth.user?.id || "");
  const uploProcGbn = $derived($auth.user?.uploProcGbn || "");

  let selectedDate = $state(toLocalDateString());

  let lastSyncedParam = "";

  // URL date 파라미터가 외부/뒤로가기 등으로 새로 변경되면 selectedDate 자동 동기화
  $effect(() => {
    const p = dateParam;
    if (p && p !== lastSyncedParam) {
      lastSyncedParam = p;
      let formattedDate = p;
      if (p.length === 8 && !p.includes("-")) {
        formattedDate = `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}`;
      }
      untrack(() => {
        selectedDate = formattedDate;
      });
    }
  });

  // selectedDate가 사용자에 의해 변경될 때 히스토리를 새로 추가하지 않고 현재 URL 쿼리만 replaceState로 업데이트
  $effect(() => {
    const curDate = selectedDate;
    if (curDate) {
      untrack(() => {
        const p = dateParam;
        const normalizedParam = p ? (p.length === 8 && !p.includes("-") ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}` : p) : "";
        if (curDate !== normalizedParam) {
          lastSyncedParam = curDate;
          goto(`?date=${curDate}`, { replaceState: true, keepFocus: true, noScroll: true });
        }
      });
    }
  });

  interface Equipment {
    id: string;
    name: string;
    location: string;
    type: string;
    is_active: number;
    last_checked: string | null;
  }

  // 설비 검색 관련 상태 (Svelte 5)
  let isSearchModalOpen = $state(false);
  let searchKeyword = $state("");
  let searchResults = $state<Equipment[]>([]);
  let isSearching = $state(false);
  let isLoadingMore = $state(false);
  let hasMore = $state(true);
  let searchInputRef = $state<HTMLInputElement | null>(null);

  function navigateAfterPops(url: string) {
    isScanning = false;
    isSearchModalOpen = false;
    isTransitioning = true;
    goto(url);
  }

  async function searchEquipment(isLoadMore: boolean = false) {
    if (isSearching || isLoadingMore) return;
    if (isLoadMore) {
      isLoadingMore = true;
    } else {
      isSearching = true;
    }
    try {
      const limit = 30;
      const offset = isLoadMore ? searchResults.length : 0;
      const resRaw = await dbService.getEquipmentSpecs({
        keyword: searchKeyword,
        limit,
        offset,
        searchBy: "all",
      });
      console.log("[searchEquipment] searchKeyword:", searchKeyword, "resRaw count:", resRaw?.length, "resRaw:", resRaw);
      const newItems = resRaw.map((item) => {
        const typeVal = item.asset_imp_dgr || item.ASSET_IMP_DGR || "C";
        return {
          id: item.asset_id || item.ASSET_ID || "",
          name: item.asset_nm || item.ASSET_NM || "",
          location: item.install_loc || item.INSTALL_LOC || "",
          type: typeVal,
          is_active: 1,
          last_checked: null,
        };
      });
      if (isLoadMore) {
        searchResults = [...searchResults, ...newItems];
      } else {
        searchResults = newItems;
      }
      hasMore = newItems.length === limit;
    } catch (err) {
      console.error("Failed to search equipment:", err);
    } finally {
      isSearching = false;
      isLoadingMore = false;
    }
  }

  // 모달이 열려있고 검색어가 변경될 때 검색 실행
  $effect(() => {
    if (isSearchModalOpen) {
      const keyword = searchKeyword; // 반응형 추적 등록
      untrack(() => {
        searchEquipment(false);
      });
    }
  });

  async function openSearch() {
    isSearchModalOpen = true;
    searchKeyword = "";
    searchResults = [];
    hasMore = true;

    setTimeout(() => {
      searchInputRef?.focus();
    }, 100);
  }

  async function handleQRScan(rawValue: string) {
    if (!rawValue || rawValue.trim() === "" || rawValue === lastScannedValue) {
      return;
    }
    lastScannedValue = rawValue;
    errorMessage = "";
    let targetId = "";

    if (rawValue.startsWith(APP_CONFIG.APP_SCHEME)) {
      const parts = rawValue.split("/");
      targetId = parts[parts.length - 1];
    } else {
      targetId = rawValue;
    }

    try {
      const planDay = selectedDate.replace(/-/g, "");
      // 컴포넌트 레벨의 empId, uploProcGbn 상태 활용

      // 1. 선택한 날짜에 해당하는 점검 계획이 있는지 조회
      const taskResult = await dbService.query(
        `SELECT asset_id, chk_action_no, chk_ordinal, chk_serno 
         FROM tb_mob_std130 
         WHERE chk_plan_day = ? AND asset_id = ? AND directnm_emp_no = ? AND uplo_proc_gbn = ?
         LIMIT 1`,
        [planDay, targetId, empId, uploProcGbn]
      );

      console.log([planDay, targetId, empId, uploProcGbn]);

      if (taskResult && taskResult.values && taskResult.values.length > 0) {
        const task = taskResult.values[0];
        errorMessage = "";
        navigateAfterPops(`/maintenance/${encodeURIComponent(task.asset_id)}?date=${selectedDate}&workGbn=MOB`);
      } else {
        // 2. 만약 해당 날짜에 계획이 없다면, 설비 마스터 테이블(tb_mob_std120)에 존재하는지 검증
        const assetResult = await dbService.query("SELECT asset_id FROM tb_mob_std120 WHERE asset_id = ? LIMIT 1", [targetId]);

        if (assetResult && assetResult.values && assetResult.values.length > 0) {
          errorMessage = $t.maintenanceNoPlanError.replace("{id}", targetId).replace("{date}", selectedDate);
        } else {
          errorMessage = $t.maintenanceNotRegisteredEquip.replace("{id}", targetId);
        }
      }
    } catch (err) {
      console.error("QR 스캔 처리 중 오류:", err);
      errorMessage = $t.maintenanceDbError;
    }
  }

  /**
   * 사용자의 세션 정보 및 로컬 SQLite DDL 정보 기반
   * 오늘 날짜의 점검 계획 설비 목록을 로딩합니다.
   */
  async function loadTasks() {
    isLoading = true;
    try {
      const planDay = selectedDate.replace(/-/g, "");
      // 컴포넌트 레벨의 empId, uploProcGbn 상태 활용

      // 설비별 총 점검 계획 수 및 실적 수 조회 (DB 서비스 메서드로 캡슐화)
      tasks = await dbService.getInspectionTasksByDate(planDay, empId, uploProcGbn, $lang);
    } catch (err) {
      console.error("점검 대상 설비 로드 실패:", err);
    } finally {
      isLoading = false;
    }
  }

  // 완료 항목 숨기기 필터 상태 (Svelte 5)
  let hideCompleted = $state(false);

  // 필터링 및 검색 바인딩 (Svelte 5 룬 사용)
  let filteredTasks = $derived.by(() => {
    if (!hideCompleted) return tasks;
    return tasks.filter((t) => !t.chk_rslt || t.chk_rslt.trim() === "");
  });

  // chk_action_no 그룹화 바인딩
  let groupedTasks = $derived.by(() => {
    const groups: {
      chk_action_no: string;
      chk_action_nm: string;
      tasks: any[];
    }[] = [];
    for (const task of filteredTasks) {
      const actionNo = task.chk_action_no || "N/A";
      const actionNm = task.chk_action_nm || $t.maintenanceActionDefaultName.replace("{no}", actionNo);

      let group = groups.find((g) => g.chk_action_no === actionNo);
      if (!group) {
        group = {
          chk_action_no: actionNo,
          chk_action_nm: actionNm,
          tasks: [],
        };
        groups.push(group);
      }
      group.tasks.push(task);
    }
    return groups;
  });

  // 날짜, 언어 및 앱 초기화 상태($isInitialized), 로그인 세션($auth) 상태가 변경될 때마다 loadTasks()를 안전하게 호출
  $effect(() => {
    if (!$isInitialized) return;

    // Svelte 5 reactive tracking context registration
    const userState = $auth;
    selectedDate;
    $lang;

    loadTasks();
  });

  // 스캐너가 닫히면 이전 스캔 기록 초기화
  $effect(() => {
    if (!isScanning) {
      lastScannedValue = "";
    }
  });

  // 헤더 타이틀 반응형 바인딩
  $effect(() => {
    pageTitle.set($t.maintenanceListTitle);
  });
</script>

<svelte:head>
  <title>{$t.maintenanceListTitle} - SecureScan Ops</title>
</svelte:head>

<div class="flex-1 bg-slate-50 dark:bg-zinc-950 font-sans pb-12 flex flex-col w-full">
  <main class="max-w-4xl mx-auto p-6 space-y-3 w-full flex-1 flex flex-col">
    <!-- 1. 날짜 조정 전용 분할 위젯 -->
    <DateAdjuster bind:selectedDate />

    <!-- 2. QR 코드 스캔 이동 버튼 -->
    <button
      onclick={() => {
        isScanning = true;
        errorMessage = "";
      }}
      class="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl transition-all shadow-sm active:scale-[0.98] select-none cursor-pointer flex items-center justify-center gap-2 border-none outline-none group">
      <span>{$t.maintenanceQrButton}</span>
    </button>

    <!-- 3. 필터링 컨트롤 바 (모던 토글 스위치) -->
    <div class="flex items-center justify-between px-1 py-1 text-xs select-none">
      <span class="text-slate-500 dark:text-zinc-400 font-bold">
        {$t.maintenanceTotalCount.replace("{count}", String(filteredTasks.length))}
      </span>

      <!-- iOS/안드로이드 스타일 토글 스위치 -->
      <label class="flex items-center gap-2.5 cursor-pointer">
        <span class="text-xs font-bold text-slate-600 dark:text-zinc-300">
          {$t.maintenanceHideCompleted}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={hideCompleted}
          aria-label={$t.maintenanceHideCompleted}
          onclick={() => (hideCompleted = !hideCompleted)}
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {hideCompleted
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-slate-200 dark:bg-zinc-700'}">
          <span
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out {hideCompleted ? 'translate-x-4' : 'translate-x-0'}"
          ></span>
        </button>
      </label>
    </div>

    <!-- 설비 리스트 섹션 -->
    <section class="flex-1 flex flex-col min-h-0">
      {#if isLoading}
        <div class="py-20 flex flex-col items-center justify-center flex-1">
          <div class="w-8 h-8 border-3 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="mt-3 text-xs font-bold text-slate-400 dark:text-zinc-500">
            {$t.maintenanceLoading}
          </p>
        </div>
      {:else if groupedTasks.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each groupedTasks as group}
            <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-xs p-5 flex flex-col justify-between">
              <div>
                <!-- 카드 타이틀 (점검활동 번호 및 이름) -->
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-blue-600 dark:text-blue-400 font-mono uppercase tracking-wide">
                      {$t.maintenanceActionNoLabel}{group.chk_action_no}
                    </span>
                  </div>
                  <span class="px-2 py-0.5 text-xs font-black bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-md font-mono shrink-0">
                    {group.tasks.length}
                    {$t.maintenanceItems}
                  </span>
                </div>

                <!-- 점검목록 (점검순서 | 설비 ID) -->
                <div class="divide-y divide-slate-100 dark:divide-zinc-800/50">
                  {#each group.tasks as task}
                    <button
                      onclick={() => goto(`/maintenance/${encodeURIComponent(task.asset_id)}?date=${selectedDate}&uploProcGbn=${uploProcGbn}&workGbn=MOS`)}
                      class="w-full text-left py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group/item hover:bg-slate-50 dark:hover:bg-zinc-800/30 px-2 -mx-2 rounded-xl transition-all cursor-pointer border-none outline-none">
                      <div class="flex items-center gap-3 min-w-0">
                        <!-- 점검순서 (chk_serno) -->
                        <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-bold font-mono shrink-0">
                          {task.chk_serno}{$t.maintenanceNumSuffix}
                        </span>

                        <!-- 설비 ID 및 설비명 -->
                        <div class="flex flex-col min-w-0">
                          <span class="text-xs font-mono font-black text-slate-800 dark:text-zinc-100 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors truncate">
                            {task.asset_id}
                          </span>
                          {#if task.asset_nm || task.chk_item}
                            <span class="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-50">
                              {task.chk_gbn_nm || task.chk_gbn} - {task.cycle_gbn_nm || task.cycle_gbn} ({task.chk_item_nm || task.chk_item || task.chk_dtl})
                            </span>
                          {/if}
                        </div>
                      </div>

                      <!-- 점검여부 표기 -->
                      <div class="flex items-center gap-2 shrink-0">
                        <!-- 점검여부 -->
                        {#if task.chk_rslt && task.chk_rslt.trim() !== ""}
                          <span class="px-2.5 py-0.5 text-[10px] font-black bg-emerald-55/90 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-md">
                            {$t.maintenanceCompletedStatus}
                          </span>
                        {:else}
                          <span class="px-2.5 py-0.5 text-[10px] font-black bg-rose-55/90 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-md">
                            {$t.maintenanceIncompleteStatus}
                          </span>
                        {/if}
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="py-20 flex flex-col items-center justify-center flex-1 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
          <span class="text-3xl mb-3 opacity-60">📋</span>
          <p class="text-slate-400 dark:text-zinc-500 text-xs font-bold text-center">
            {$t.maintenanceNoTasks}
          </p>
        </div>
      {/if}
    </section>
  </main>
</div>

{#if isScanning}
  <QRScannerOverlay
    bind:errorMessage
    on:scan={(e) => handleQRScan(e.detail.value)}
    on:close={() => {
      isScanning = false;
      errorMessage = "";
    }}>
    <!-- 하단 모달 수동 조작 바텀바 구성 -->
    <div class="relative bg-white dark:bg-zinc-900 p-5 z-20 border-t border-slate-100 dark:border-zinc-800">
      <div class="flex flex-col gap-3">
        <button
          onclick={() => {
            openSearch();
          }}
          class="w-full py-3.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border-none cursor-pointer">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {$t.maintenanceManualSelect}
        </button>
      </div>
    </div>
  </QRScannerOverlay>
{/if}

<ModalSlideUp bind:isOpen={isSearchModalOpen} title={$t.maintenanceSelectEquipment} subTitle={$t.maintenanceManualEquipmentSearch} zIndex="100000">
  <div class="pb-6 pt-2 flex-1 flex flex-col min-h-0">
    <!-- 검색 입력 영역 -->
    <div class="relative shrink-0 mb-4 border-b border-slate-100 dark:border-zinc-800 pb-4 focus-within:border-blue-500 transition-colors">
      <div class="flex items-center gap-3">
        <svg class="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          bind:this={searchInputRef}
          bind:value={searchKeyword}
          type="text"
          placeholder={$t.maintenanceEnterEquipmentId}
          class="block w-full py-2 bg-transparent focus:outline-none text-sm font-bold text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-655 border-none outline-none" />
        {#if searchKeyword}
          <button
            onclick={() => {
              searchKeyword = "";
            }}
            aria-label={$t.maintenanceClearSearch}
            class="text-slate-300 hover:text-blue-500 transition-colors border-none bg-transparent cursor-pointer">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <!-- 리스트 영역 -->
    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      {#if isSearching}
        <div class="flex-1 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-3 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      {:else if searchResults.length > 0}
        <section class="flex-1 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
          <!-- 리스트 헤더 -->
          <div
            class="shrink-0 hidden md:grid grid-cols-12 bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-y border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <div class="col-span-7">{$t.maintenanceEquipInfo}</div>
            <div class="col-span-3 text-center">
              {$t.maintenanceLocation}
            </div>
            <div class="col-span-2 text-right">상세</div>
          </div>

          <!-- 리스트 바디 (스크롤 가능) -->
          <div class="flex-1 overflow-y-auto">
            {#each searchResults as equip}
              <button
                onclick={() => {
                  navigateAfterPops(`/maintenance/${encodeURIComponent(equip.id)}?date=${selectedDate}&workGbn=MOB`);
                }}
                class="relative w-full text-left px-4 py-5 flex justify-between md:grid md:grid-cols-12 items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group border-none bg-transparent after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-slate-200 dark:after:bg-zinc-800 after:content-[''] last:after:hidden">
                <!-- 설비 정보 (중요도 배지 -> ID 메인 -> 설비명 서브) -->
                <div class="col-span-7 flex items-start gap-2">
                  <div class="flex flex-col gap-1.5 items-start">
                    <!-- 중요도 배지 (설비 사양 조회 페이지 스타일 매칭) -->
                    {#if (equip.type || "").trim()}
                      <span
                        class="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tight shrink-0 uppercase border {(equip.type || '').trim().toUpperCase() === 'A'
                          ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                          : (equip.type || '').trim().toUpperCase() === 'B'
                            ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                            : 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/30'}">
                        {$t.maintenanceImportancePrefix}
                        {(equip.type || "C").trim().toUpperCase()}
                      </span>
                    {/if}

                    <!-- 설비 ID (메인) -->
                    <p class="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider group-hover:text-blue-600 transition-colors font-mono">
                      {equip.id}
                    </p>

                    <!-- 설비명 (서브) -->
                    <p class="text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                      {equip.name}
                    </p>

                    <!-- 모바일용 위치 표시 -->
                    <div class="flex items-center gap-2 mt-0.5 md:hidden">
                      <span class="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        {equip.location}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 위치 (데스크탑) -->
                <div class="col-span-3 hidden md:block text-center">
                  <span class="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                    {equip.location}
                  </span>
                </div>

                <!-- 액션 -->
                <div class="col-span-2 text-right flex items-center justify-end">
                  <div class="text-[10px] font-black text-slate-300 group-hover:text-blue-600 transition-all uppercase tracking-widest flex items-center gap-1">
                    <span class="hidden md:inline">{$t.maintenanceInspectLabel}</span>
                    <svg class="w-4 h-4 md:w-3 md:h-3 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            {/each}

            <!-- 더 보기 버튼 마크업 -->
            {#if hasMore}
              <div class="flex justify-center py-4 border-t border-slate-100 dark:border-zinc-850">
                <button
                  type="button"
                  onclick={() => searchEquipment(true)}
                  disabled={isLoadingMore}
                  class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl transition-all active:scale-[0.97] text-[11px] uppercase tracking-wider border border-slate-200/50 dark:border-zinc-700/50 cursor-pointer flex items-center gap-2.5 shadow-xs select-none disabled:opacity-50">
                  <span>{isLoadingMore ? $t.maintenanceLoadingMore : $t.maintenanceLoadMore}</span>
                </button>
              </div>
            {/if}
          </div>
        </section>
      {:else if searchKeyword}
        <div class="flex-1 flex flex-col items-center justify-center text-center">
          <p class="text-sm text-slate-400 font-bold italic">
            {$t.maintenanceInfoNoResults.replace("{query}", searchKeyword)}
          </p>
        </div>
      {:else}
        <div class="flex-1 flex flex-col items-center justify-center text-center">
          <p class="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">
            {$t.maintenanceInfoNotFound}
          </p>
        </div>
      {/if}
    </div>
  </div>
</ModalSlideUp>

{#if isTransitioning}
  <div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-md z-99999 flex flex-col items-center justify-center">
    <div class="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    <span class="mt-4 text-xs font-black text-slate-200 tracking-widest uppercase animate-pulse">
      {$t.detailLoading}
    </span>
  </div>
{/if}

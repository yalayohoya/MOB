<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { fade, slide } from "svelte/transition";
  import { dbService } from "$lib/services/database";
  import { pageTitle } from "$lib/stores/ui";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/history";
  import { auth } from "$lib/stores/auth";
  import ModalSlideUp from "$lib/components/ModalSlideUp.svelte";
  import { debounce } from "$lib/utils/debounce";
  import { toLocalDateString } from "$lib/utils/date";

  // --- 타입 정의 ---
  interface Log {
    id: string; // chk_action_no || '_' || chk_plan_day
    chk_action_no: string;
    asset_id: string;
    equipment_id: string;
    chk_plan_day: string;
    status: string;
    timestamp: string;
    memo: string | null;
    synced: number;
    equipment_name: string | null;
    location: string | null;
    is_active: number;
    completed_count?: number;
    total_count?: number;
  }

  interface GroupedLog {
    label: string;
    items: Log[];
  }

  // --- 상태 관리 ---
  let logs = $state<Log[]>([]);
  let isLoading = $state(true);
  let selectedLog = $state<Log | null>(null);
  let searchQuery = $state("");
  let debouncedQuery = $state("");
  let debounceTimer: ReturnType<typeof setTimeout>;

  // 로그인 정보 공통 바인딩 (Svelte 5 반응형 파생 상태)
  const empId = $derived($auth.user?.id || "");
  const uploProcGbn = $derived($auth.user?.uploProcGbn || "");

  // 필터 상태 관리 (사용자 요구사항 반영: 기본 전체/한달 조회)
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1);

  let isFilterModalOpen = $state(false);
  let filters = $state({
    status: "all", // 점검 상태는 전체를 기본으로
    period: "all", // 조회 기간 전체가 기본
    startDate: "",
    endDate: "",
  });

  async function loadLogs(query: string = "") {
    isLoading = true;
    try {
      const rawLogs = await dbService.getInspectionHistory(query, {
        ...filters,
        empId,
        uploProcGbn,
      });

      // 자바스크립트 단에서 데이터 매핑
      const formattedLogs = rawLogs.map((log) => {
        const total = log.total_count || 0;
        const completed = log.completed_count || 0;
        // 5개 항목 중 1개라도 빠지면 fail(미흡), 다 채워져있으면 pass(완료)
        const status = completed < total ? "fail" : "pass";
        const synced = log.raw_send_flag === "Y" ? 1 : 0;

        let timestamp = log.raw_timestamp || "";
        if (timestamp.length >= 14) {
          timestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`;
        }

        return {
          ...log,
          status,
          synced,
          timestamp,
        };
      });

      // 점검상태(완료/미흡) 및 보고 여부(동기화 여부) 필터링을 JS 레벨에서 수행
      logs = formattedLogs.filter((log) => {
        if (filters.status !== "all" && log.status !== filters.status) {
          return false;
        }
        return true;
      });
    } catch (err) {
      console.error("Logs load failed:", err);
    } finally {
      isLoading = false;
    }
  }

  /**
   * 날짜 포맷 변환 (ISO -> YYYY-MM-DD HH:mm)
   */
  function formatDate(isoString: string | undefined): string {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  /**
   * 계획일자 포맷 변환 (YYYYMMDD -> YYYY-MM-DD)
   */
  function formatPlanDay(day: string): string {
    if (!day || day.length !== 8) return day;
    return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
  }

  /**
   * 퀵 기간 설정
   */
  function setQuickPeriod(type: string) {
    filters.period = type;
    if (type === "all") {
      filters.startDate = "";
      filters.endDate = "";
      return;
    }
    const end = new Date();
    let start = new Date();

    if (type === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (type === "week") {
      start.setDate(end.getDate() - 7);
    } else if (type === "month") {
      start.setMonth(end.getMonth() - 1);
    }

    filters.startDate = toLocalDateString(start);
    filters.endDate = toLocalDateString(end);
  }

  /**
   * 수동 날짜 변경 핸들러 (모두 지워지면 "전체"로 전환)
   */
  function handleDateChange() {
    if (!filters.startDate && !filters.endDate) {
      filters.period = "all";
    } else {
      filters.period = "custom";
    }
  }

  /**
   * 필터 적용
   */
  function applyFilters() {
    isFilterModalOpen = false;
    loadLogs(searchQuery);
  }

  /**
   * 필터 초기화 (기본값으로 복구)
   */
  function resetFilters() {
    filters = {
      status: "all",
      period: "all",
      startDate: "",
      endDate: "",
    };
  }

  /**
   * 계획일자(YYYYMMDD)를 사람이 읽기 편한 그룹명으로 변환
   */
  function getPlanDayGroupLabel(planDay: string): string {
    if (!planDay || planDay.length !== 8) return planDay;
    const year = Number(planDay.slice(0, 4));
    const month = Number(planDay.slice(4, 6)) - 1;
    const day = Number(planDay.slice(6, 8));
    const d = new Date(year, month, day);

    if ($lang === "es") {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      const datePart = d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const weekdayPart = d.toLocaleDateString("ko-KR", { weekday: "long" });
      return `${datePart} (${weekdayPart})`;
    }
  }

  // searchQuery가 바뀔 때마다 DB에서 다시 로드 (공용 디바운스 유틸 적용)
  const debouncedSearch = debounce((query: string) => {
    debouncedQuery = query;
    loadLogs(query);
  }, 300);

  $effect(() => {
    if (searchQuery === "") {
      debouncedQuery = "";
      loadLogs(""); // 즉시 로드
    } else {
      debouncedSearch(searchQuery);
    }
  });

  const isFilterActive = $derived(
    filters.status !== "all" || filters.period !== "all",
  );

  $effect(() => {
    pageTitle.set($t.historyTitle);
  });

  // 그룹화 로직 (이미 필터링된 logs를 그룹화만 수행)
  const groupedLogs = $derived.by(() => {
    // capture $lang for reactivity
    const _ = $lang;
    return logs.reduce((groups: GroupedLog[], log: Log) => {
      const label = getPlanDayGroupLabel(log.chk_plan_day);
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(log);
      } else {
        groups.push({ label, items: [log] });
      }
      return groups;
    }, []);
  });

  onMount(() => {
    loadLogs();
  });
</script>

<div class="flex-1 bg-app-bg pb-20">
  <!-- 검색 & 필터 영역 (설비사양조회 검색 바와 완전히 동등한 스타일로 통일) -->
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
      placeholder={$t.history.searchPlaceholder}
      class="block w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 transition-all font-sans text-sm font-medium"
    />
    <button
      type="button"
      onclick={() => (isFilterModalOpen = true)}
      class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors border-none bg-transparent cursor-pointer"
      title="필터"
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
          stroke-width="2"
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
      {#if isFilterActive}
        <!-- 필터 활성화 인디케이터 배지 조율 (top-3.5 right-3.5로 최적화) -->
        <span
          class="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-600 border border-white dark:border-zinc-900"
        ></span>
      {/if}
    </button>
  </div>

  <main class="max-w-7xl mx-auto p-6 space-y-6">
    {#if !isLoading && logs.length > 0}
      <div
        class="px-1 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] opacity-80"
      >
        {$t.history.resultCount.replace("{count}", String(logs.length))}
      </div>
    {/if}

    {#if isLoading}
      <div class="py-20 flex flex-col items-center justify-center">
        <div
          class="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"
        ></div>
      </div>
    {:else if logs.length === 0 && !debouncedQuery}
      <!-- 전체 데이터가 없을 때 -->
      <div
        class="py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 shadow-sm transition-all"
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
              d="M9 5H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3
          class="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-widest mb-2"
        >
          {$t.history.noDataTitle}
        </h3>
        <p
          class="text-[11px] text-slate-400 text-center max-w-xs leading-relaxed mb-8"
        >
          {$t.history.noDataDesc}
        </p>
        <button
          onclick={() => goto("/maintenance")}
          class="px-8 py-3 bg-slate-900 dark:bg-zinc-800 text-white rounded-lg font-black text-[10px] uppercase tracking-[0.2em] transform transition active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
        >
          {$t.history.startNewInspection}
        </button>
      </div>
    {:else if logs.length === 0 && debouncedQuery}
      <!-- 검색 결과가 없을 때 -->
      <div
        class="py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 transition-all"
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
          {$t.history.noSearchResultsTitle}
        </h3>
        <p class="text-[11px] text-slate-400">
          {$t.history.noSearchResultsDesc.replace(
            "{query}",
            debouncedQuery,
          )}
        </p>
        <button
          onclick={() => (searchQuery = "")}
          class="mt-8 px-8 py-3 bg-slate-900 dark:bg-zinc-800 text-white rounded-lg font-black text-[10px] uppercase tracking-[0.2em] transform transition active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
        >
          {$t.history.resetSearch}
        </button>
      </div>
    {:else}
      <!-- 리포트 스타일 테이블/리스트 (날짜별 그룹화) -->
      <div class="space-y-8 pb-10">
        {#each groupedLogs as group (group.label)}
          <div class="space-y-3">
            <div class="flex items-center gap-4 px-2">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap"
                >{group.label}</span
              >
              <div
                class="h-px w-full bg-slate-200/50 dark:bg-zinc-800/50"
              ></div>
            </div>

            <div class="flex flex-col gap-3">
              {#each group.items as log (log.id)}
                <button
                  type="button"
                  onclick={() =>
                    goto(
                      `/maintenance?date=${formatPlanDay(log.chk_plan_day)}&chkActionNo=${log.chk_action_no}`,
                    )}
                  class="w-full text-left px-5 py-2 flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:shadow-md hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-all cursor-pointer group"
                >
                  <!-- Left: Equipment Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono uppercase tracking-tight truncate"
                      >
                        {log.chk_action_no}
                      </span>
                    </div>
                  </div>

                  <!-- Right: Time & Status Badge + Progress (n/n) -->
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <div
                      class="text-[11px] font-mono font-extrabold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200/40"
                    >
                      {log.completed_count} / {log.total_count}
                    </div>
                    <div
                      class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight
                      {log.status === 'pass'
                        ? 'bg-emerald-55/90 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-55/90 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'}"
                    >
                      <span
                        class="w-1.5 h-1.5 rounded-full mr-1.5
                        {log.status === 'pass'
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'}"
                      ></span>
                      {#if log.status === "pass"}
                        {$t.history.completed}
                      {:else}
                        {$t.history.incomplete}
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <style>
      /* 레이아웃 밀림 방지를 위한 그리드 중첩 스타일 */
      .grid-in-place {
        grid-area: 1 / 1 / 2 / 2;
      }
    </style>
  </main>

  <!-- 필터 모달 (Bottom Sheet 스타일) -->
  <!-- 필터 모달 (Bottom Sheet 스타일 컴포넌트 사용) -->
  <ModalSlideUp
    bind:isOpen={isFilterModalOpen}
    title={$t.history.filterTitle}
    subTitle="Config History Filter"
  >
    <div class="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
      <!-- 점검 상태 필터 -->
      <div class="space-y-3">
        <h4
          class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
        >
          {$t.history.filterStatus}
        </h4>
        <div class="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
          {#each [["all", $t.history.statusAll], ["pass", $t.history.statusPass], ["fail", $t.history.statusFail]] as [val, label]}
            <button
              onclick={() => (filters.status = val)}
              class="whitespace-nowrap py-2 px-5 rounded-full border text-[11px] font-bold transition-all
                {filters.status === val
                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-500 hover:border-blue-500'}"
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <!-- 조회 기간 필터 -->
      <div class="space-y-4">
        <h4
          class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
        >
          {$t.history.filterPeriod}
        </h4>
        <div class="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
          {#each [["all", $t.history.periodAll], ["today", $t.history.periodToday], ["week", $t.history.periodWeek], ["month", $t.history.periodMonth]] as [val, label]}
            <button
              onclick={() => setQuickPeriod(val)}
              class="whitespace-nowrap py-2 px-5 rounded-full border text-[11px] font-bold transition-all
                {filters.period === val
                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-500 hover:border-blue-500'}"
            >
              {label}
            </button>
          {/each}
        </div>

        <!-- 날짜 직접 입력 (상시 노출) -->
        <div class="grid grid-cols-2 gap-3 pt-1">
          <div class="group">
            <label
              for="startDate"
              class="text-[9px] font-black text-slate-400 ml-1 uppercase transition-colors"
              >{$t.history.startDate}</label
            >
            <input
              type="date"
              id="startDate"
              bind:value={filters.startDate}
              onchange={handleDateChange}
              class="w-full mt-1.5 p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none focus:bg-slate-100 dark:focus:bg-zinc-800 transition-all"
            />
          </div>
          <div class="group">
            <label
              for="endDate"
              class="text-[9px] font-black text-slate-400 ml-1 uppercase transition-colors"
              >{$t.history.endDate}</label
            >
            <input
              type="date"
              id="endDate"
              bind:value={filters.endDate}
              onchange={handleDateChange}
              class="w-full mt-1.5 p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none focus:bg-slate-100 dark:focus:bg-zinc-800 transition-all"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 하단 고정 버튼 영역 -->
    <div class="p-6 flex gap-3 border-t border-slate-100 dark:border-zinc-800">
      <button
        onclick={resetFilters}
        class="flex-1 py-4 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-zinc-700"
      >
        {$t.history.resetBtn}
      </button>
      <button
        onclick={applyFilters}
        class="flex-2 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
      >
        {$t.history.applyBtn}
      </button>
    </div>
  </ModalSlideUp>
</div>

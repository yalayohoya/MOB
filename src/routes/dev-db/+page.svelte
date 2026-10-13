<script lang="ts">
  import { onMount } from "svelte";
  import { dbService } from "$lib/services/database";
  import { fade, slide } from "svelte/transition";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { tableDescriptions, columnDescriptions } from "./dbMetadata";
  import { pageTitle, isInitialized } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
import { syncStore } from "$lib/stores/sync";
  import { DEV_IDS } from "$lib/constants";

  // [초강력 보안 가드] 운영 환경 빌드(Production) 시 이 페이지 진입 원천 봉쇄
  // 단, 개발자 계정('dev')으로 로그인한 경우 운영 빌드에서도 허용
  let isDev = false;
  $: isDev = $auth.isLoggedIn && !!$auth.user?.id && DEV_IDS.includes($auth.user.id);

  // 상태 관리
  let tables: string[] = [];
  let selectedTable = "";
  let columns: string[] = [];
  let rows: any[] = [];
  let rowCount = 0;
  let isLoading = false;
  let queryError = "";

  // PK 메타데이터 상태 관리
  let pkMap: Record<string, boolean> = {};
  let pkOrder: Record<string, number> = {};
  let pkSummary = "";

  // 커스텀 SQL 실행 제어
  let customQuery = "";
  let lastExecutedQuery = "";
  let activeTab: "table" | "sql" = "table";

  // 실시간 클라이언트 사이드 검색 및 정렬 제어
  let searchTerm = "";
  let sortKey = "";
  let sortDirection: "asc" | "desc" = "asc";

  // Svelte 반응성(Reactive) 선언문으로 실시간 정렬 및 검색 필터링된 행 데이터 가공
  $: processedRows = (() => {
    let result = [...rows];

    // 1. 검색어 필터링
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((row) => {
        return Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(term);
        });
      });
    }

    // 2. 컬럼 정렬
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        // 숫자 타입인 경우 숫자로 비교 시도
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "") {
          return sortDirection === "asc" ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  })();

  // 컬럼 헤더 토글 정렬 핸들러
  function toggleSort(col: string) {
    if (sortKey === col) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = col;
      sortDirection = "asc";
    }
  }

  // 테이블 전환 시 검색 및 정렬 초기화
  function resetSearchAndSort() {
    searchTerm = "";
    sortKey = "";
    sortDirection = "asc";
  }

  let tablesLoaded = false;

  $: {
    if (browser && $isInitialized) {
      if (!isDev) {
        console.warn(
          "[Security Guard] Unauthorized production access to /dev-db blocked! Redirecting to home...",
        );
        goto("/");
      } else if (!tablesLoaded) {
        tablesLoaded = true;
        pageTitle.set("SQLite DB");
        loadTables();
      }
    }
  }

  /**
   * 데이터베이스 내부의 모든 활성 물리 테이블 목록 조회
   */
  async function loadTables() {
    try {
      isLoading = true;
      queryError = "";
      const res = await dbService.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
          AND name NOT LIKE 'sqlite_%' 
          AND name NOT LIKE 'jeep_%'
        ORDER BY name
      `);
      tables = res.values ? res.values.map((r: any) => r.name) : [];

      if (tables.length > 0) {
        selectedTable = tables[0];
        await loadTableData(selectedTable);
      }
    } catch (err: any) {
      queryError = err.message || err.toString();
    } finally {
      isLoading = false;
    }
  }

  /**
   * 선택된 테이블의 상세 메타데이터(컬럼 정보) 및 데이터 로드
   */
  async function loadTableData(tableName: string) {
    if (!tableName) return;
    selectedTable = tableName;
    isLoading = true;
    queryError = "";
    activeTab = "table";
    resetSearchAndSort();
    try {
      // 1. 테이블 스키마 칼럼 정보 수집 및 PK 분석
      const infoRes = await dbService.query(`PRAGMA table_info(${tableName})`);
      columns = infoRes.values ? infoRes.values.map((c: any) => c.name) : [];
      
      pkMap = {};
      pkOrder = {};
      pkSummary = "";
      if (infoRes.values) {
        infoRes.values.forEach((c: any) => {
          if (c.pk > 0) {
            pkMap[c.name] = true;
            pkOrder[c.name] = c.pk;
          }
        });
        const pks = infoRes.values
          .filter((c: any) => c.pk > 0)
          .sort((a: any, b: any) => a.pk - b.pk)
          .map((c: any) => c.name);
        pkSummary = pks.length > 0 ? pks.join(" + ") : "";
      }

      // 2. 전체 행 개수 파악
      const countRes = await dbService.query(
        `SELECT COUNT(*) as cnt FROM ${tableName}`,
      );
      rowCount = countRes.values?.[0]?.cnt ?? 0;

      // 3. 최근 데이터 행 로드 (250개 한정)
      const dataRes = await dbService.query(
        `SELECT * FROM ${tableName} LIMIT 250`,
      );
      rows = dataRes.values || [];
      lastExecutedQuery = `SELECT * FROM ${tableName} LIMIT 250`;
    } catch (err: any) {
      queryError = err.message || err.toString();
      columns = [];
      rows = [];
      rowCount = 0;
    } finally {
      isLoading = false;
    }
  }

  /**
   * 개발자가 직접 작성한 임의의 SQL 쿼리 실시간 기동
   */
  async function executeCustomQuery() {
    if (!customQuery.trim()) return;
    isLoading = true;
    queryError = "";
    activeTab = "sql";
    resetSearchAndSort();
    try {
      pkMap = {};
      pkOrder = {};
      pkSummary = "";
      const trimmed = customQuery.trim();
      const isSelect =
        trimmed.toUpperCase().startsWith("SELECT") ||
        trimmed.toUpperCase().startsWith("PRAGMA");

      if (isSelect) {
        const res = await dbService.query(trimmed);
        rows = res.values || [];
        rowCount = rows.length;
        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        } else {
          columns = [];
        }
        lastExecutedQuery = trimmed;
      } else {
        const res = await dbService.run(trimmed);
        queryError = `[성공] 쿼리가 성공적으로 작동했습니다. 적용된 행 개수: ${res.changes ?? 0}개`;
        columns = [];
        rows = [];
        rowCount = 0;
        lastExecutedQuery = trimmed;
        setTimeout(loadTables, 800);
      }
    } catch (err: any) {
      queryError = err.message || err.toString();
      rows = [];
      columns = [];
      rowCount = 0;
    } finally {
      isLoading = false;
    }
  }

  /**
   * 특정 테이블 강제 비우기 (DELETE)
   */
  async function clearTable(tableName: string) {
    if (
      !confirm(
        `[경고] 테이블 '${tableName}'의 모든 데이터를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      )
    )
      return;
    try {
      isLoading = true;
      await dbService.run(`DELETE FROM ${tableName}`);
      alert(`테이블 '${tableName}'이 깨끗하게 초기화되었습니다.`);
      await loadTableData(tableName);
    } catch (err: any) {
      alert(`초기화 실패: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

  /**
   * API 호출 결과만 콘솔에 출력하는 디버그 액션
   */
  async function debugApis() {
    await syncStore.debugSyncApis();
  }

  let apiResult = "";

  async function checkAccessToken() {
    isLoading = true;
    apiResult = "";
    try {
      const res = await auth.validateAccessToken();
      apiResult = `[Access Token Check Result]\nSuccess: ${res}\n\n* Check the browser console log for detailed request execution details.`;
    } catch (err: any) {
      apiResult = `Error calling Access Token check API:\n${err.message || err.toString()}`;
    } finally {
      isLoading = false;
    }
  }

  async function checkRefreshToken() {
    isLoading = true;
    apiResult = "";
    try {
      const res = await auth.refreshSession();
      const displayData = res.data || res;
      apiResult = `[Refresh Token Check Result]\nSuccess: ${res.success}\nError: ${res.error || "None"}\n\nRaw Response Detail:\n${JSON.stringify(displayData, null, 2)}`;
    } catch (err: any) {
      apiResult = `Error calling Refresh Token check API:\n${err.message || err.toString()}`;
    } finally {
      isLoading = false;
    }
  }
</script>

{#if isDev}
  <div
    class="w-full min-h-screen bg-slate-50 text-slate-800 font-sans p-6 overflow-x-hidden flex flex-col gap-6 select-text"
  >
    <!-- 상단 스마트 대시보드 헤더 -->
    <header
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-200 text-lg shadow-sm"
        >
          🔍
        </div>
        <div>
          <h1 class="text-lg font-black tracking-wide text-slate-900">
            SecureScan Live SQLite Web Explorer
          </h1>
          <p
            class="text-[11px] font-bold text-slate-400 tracking-wider uppercase mt-0.5"
          >
            실시간 가상 IndexedDB SQLite 웹 터미널 콘솔
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="/"
          class="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer no-underline shadow-sm"
        >
          <span>🏠</span>
          <span>메인 대시보드로 복귀</span>
        </a>
        <button
          on:click={debugApis}
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-purple-500/15"
        >
          <span>⚡</span>
          <span>API 리턴값 콘솔 출력</span>
        </button>
        <button
          on:click={loadTables}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-blue-500/15"
        >
          <span>🔄</span>
          <span>DB 목록 갱신</span>
        </button>
      </div>
    </header>

    <!-- 메인 2분할 레이아웃 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
      <!-- 좌측 사이드바: 테이블 선택 가젯 -->
      <aside class="lg:col-span-3 flex flex-col gap-4">
        <div
          class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm"
        >
          <div
            class="flex items-center justify-between pb-2 border-b border-slate-100"
          >
            <span
              class="text-xs font-black text-slate-400 tracking-widest uppercase"
              >물리 테이블 목록</span
            >
            <span
              class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-mono font-bold"
              >{tables.length} EA</span
            >
          </div>

          {#if tables.length === 0}
            <div class="text-center py-8 text-slate-400 text-xs font-medium">
              감지된 활성 테이블이 없습니다.
            </div>
          {:else}
            <div
              class="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1"
            >
              {#each tables as table}
                <button
                  type="button"
                  on:click={() => loadTableData(table)}
                  class="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none flex items-center justify-between cursor-pointer group select-none {selectedTable ===
                  table
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800'}"
                >
                  <div class="flex flex-col gap-0.5 pr-1 truncate">
                    <span class="truncate">📊 {table}</span>
                    {#if tableDescriptions[table]}
                      <span
                        class="text-[9px] font-semibold truncate pl-5 block {selectedTable ===
                        table
                          ? 'text-blue-200'
                          : 'text-slate-400 group-hover:text-slate-600'}"
                      >
                        {tableDescriptions[table]}
                      </span>
                    {/if}
                  </div>
                  {#if selectedTable === table}
                    <span
                      class="text-[9px] bg-blue-700/80 text-blue-100 px-1.5 py-0.5 rounded font-bold font-mono"
                      >ACTIVE</span
                    >
                  {/if}
                </button>
              {/each}
            </div>
          {/if}

          {#if selectedTable}
            <div class="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <span
                class="text-[10px] font-black text-slate-400 tracking-wider uppercase"
                >위험구역 테이블 초기화</span
              >
              <button
                on:click={() => clearTable(selectedTable)}
                class="w-full px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🗑️</span>
                <span>데이터 전부 비우기</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- 도움말 카드 -->
        <div
          class="bg-slate-100/60 border border-slate-200/60 rounded-2xl p-4 text-[11px] text-slate-500 flex flex-col gap-2 leading-relaxed"
        >
          <span class="font-bold text-slate-700 text-xs"
            >💡 프로 팁(Pro-Tip)</span
          >
          <p>
            1. 이 뷰어는 메모리 DB 상태 및 IndexedDB에 저장된 실제 상태를 실시간
            동기 조회합니다.
          </p>
          <p>
            2. 테이블 쿼리는 성능 과부하 방지를 위해 기본 250개 행만 잘라서
            가져옵니다.
          </p>
          <p>
            3. 우측 SQL 터미널에서 `INSERT`, `UPDATE`, `DELETE` 명령어도
            자유롭게 구사할 수 있습니다.
          </p>
        </div>
      </aside>

      <!-- 우측 본문: 데이터 뷰어 및 커스텀 SQL 터미널 -->
      <main class="lg:col-span-9 flex flex-col gap-6">
        <!-- SQL 터미널 입력기 -->
        <section
          class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
        >
          <div
            class="flex items-center justify-between pb-2 border-b border-slate-100"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-xs">💻</span>
              <span
                class="text-xs font-black text-slate-600 tracking-widest uppercase"
                >실시간 대화형 SQL 터미널</span
              >
            </div>
            <span
              class="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tight"
              >Interactive Mode</span
            >
          </div>

          <div class="flex flex-col gap-2">
            <textarea
              bind:value={customQuery}
              placeholder="실행할 커스텀 SQL을 마음껏 입력해 보세요.&#10;예시 1) SELECT * FROM tb_mob_rst130 ORDER BY chk_end_dtm DESC&#10;예시 2) UPDATE tb_mob_rst130 SET send_flag = 'Y' WHERE asset_id = 'A001'"
              class="w-full h-24 bg-slate-50 text-slate-800 font-mono text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none resize-none placeholder-slate-400 leading-normal"
            ></textarea>

            <div class="flex justify-between items-center mt-1">
              <div class="flex gap-2">
                <button
                  on:click={() =>
                    (customQuery =
                      "SELECT * FROM tb_mob_rst130 ORDER BY chk_end_dtm DESC")}
                  class="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  실적 조회 SQL
                </button>
                <button
                  on:click={() =>
                    (customQuery = "SELECT * FROM tb_mob_std130 LIMIT 50")}
                  class="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  계획 조회 SQL
                </button>
              </div>

              <button
                on:click={executeCustomQuery}
                disabled={isLoading || !customQuery.trim()}
                class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-blue-500/10"
              >
                <span>⚡</span>
                <span>SQL 실행하기 (Run Query)</span>
              </button>
            </div>
          </div>

          {#if queryError}
            <div
              transition:slide
              class="p-3 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono rounded-xl flex flex-col gap-1"
            >
              <span class="font-bold text-slate-800"
                >⚠️ [실행 상태/오류 로그]</span
              >
              <p class="whitespace-pre-wrap">{queryError}</p>
            </div>
          {/if}
        </section>

        <!-- Token API 검증 영역 -->
        <section
          class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
        >
          <div
            class="flex items-center justify-between pb-2 border-b border-slate-100"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-xs">🔑</span>
              <span
                class="text-xs font-black text-slate-600 tracking-widest uppercase"
                >Token API 실시간 검증 가젯</span
              >
            </div>
            <span
              class="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tight"
              >Security Check</span
            >
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              on:click={checkAccessToken}
              disabled={isLoading}
              class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-emerald-500/15"
            >
              <span>🔑</span>
              <span>Access Token 검증 (validateAccessToken)</span>
            </button>
            <button
              on:click={checkRefreshToken}
              disabled={isLoading}
              class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-amber-500/15"
            >
              <span>🔄</span>
              <span>Refresh Token 세션 연장 (refreshSession)</span>
            </button>
          </div>

          {#if apiResult}
            <div
              transition:slide
              class="p-3.5 bg-slate-900 text-slate-200 text-xs font-mono rounded-xl flex flex-col gap-2 border border-slate-800"
            >
              <div class="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1.5 mb-1 select-none">
                <span class="font-bold text-slate-300">🖥️ [API 응답 결과 수신 패널]</span>
                <button
                  type="button"
                  on:click={() => (apiResult = "")}
                  class="text-[10px] text-slate-500 hover:text-slate-300 bg-transparent border-none cursor-pointer"
                >
                  지우기
                </button>
              </div>
              <pre class="whitespace-pre-wrap leading-relaxed select-text font-mono text-emerald-400">{apiResult}</pre>
            </div>
          {/if}
        </section>

        <!-- 데이터 렌더링 그리드 영역 -->
        <section
          class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 min-h-[400px]"
        >
          <!-- 상태 헤더 바 -->
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100"
          >
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"
              ></span>
              <span
                class="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5 flex-wrap"
              >
                {#if activeTab === "table"}
                  <span>테이블 뷰어:</span>
                  <span class="text-blue-600 font-black">{selectedTable}</span>
                  {#if tableDescriptions[selectedTable]}
                    <span
                      class="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md border border-slate-200 uppercase tracking-normal"
                    >
                      {tableDescriptions[selectedTable]}
                    </span>
                  {/if}
                  {#if pkSummary}
                    <span
                      class="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                    >
                      🔑 PK 조합: {pkSummary}
                    </span>
                  {/if}
                {:else}
                  터미널 쿼리 결과
                {/if}
              </span>
            </div>

            <div
              class="flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200"
            >
              <span>Query:</span>
              <span
                class="text-blue-600 font-bold truncate max-w-[280px]"
                title={lastExecutedQuery}
              >
                {lastExecutedQuery || "없음"}
              </span>
              <span class="text-slate-300">|</span>
              <span>Count:</span>
              <span class="text-emerald-600 font-bold">{rowCount} rows</span>
            </div>
          </div>

          <!-- 실시간 로컬 검색 및 정렬 제어 툴바 -->
          {#if columns.length > 0 && rows.length > 0}
            <div
              class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60"
            >
              <div class="relative flex-1 max-w-md">
                <span
                  class="absolute left-3 top-2 text-xs text-slate-400 select-none"
                  >🔍</span
                >
                <input
                  type="text"
                  bind:value={searchTerm}
                  placeholder="전체 열(Column) 실시간 검색 및 필터링..."
                  class="w-full text-xs pl-8 pr-8 py-1.5 bg-white rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none placeholder-slate-400 font-medium transition-all shadow-sm"
                />
                {#if searchTerm}
                  <button
                    type="button"
                    on:click={() => (searchTerm = "")}
                    class="absolute right-3 top-2 bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 text-[10px] select-none"
                  >
                    ✕
                  </button>
                {/if}
              </div>

              <div
                class="flex items-center justify-end gap-2 text-[10px] text-slate-500 font-medium font-sans"
              >
                <span>필터링 결과:</span>
                <span
                  class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black font-mono"
                >
                  {processedRows.length} / {rows.length} 건
                </span>
                {#if sortKey}
                  <span class="text-slate-300">|</span>
                  <span>정렬:</span>
                  <span
                    class="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black font-mono uppercase"
                  >
                    {sortKey} ({sortDirection === "asc"
                      ? "오름차순"
                      : "내림차순"})
                  </span>
                  <button
                    type="button"
                    on:click={() => {
                      sortKey = "";
                      sortDirection = "asc";
                    }}
                    class="text-[9px] text-rose-500 hover:text-rose-700 bg-rose-50 border-none px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all active:scale-95"
                  >
                    초기화
                  </button>
                {/if}
              </div>
            </div>
          {/if}

          <!-- 실체 데이터 테이블 구조 -->
          <div
            class="flex-1 overflow-auto max-h-[500px] border border-slate-200 rounded-xl relative bg-white"
          >
            {#if isLoading}
              <div
                class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3 z-10"
                transition:fade
              >
                <div
                  class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                ></div>
                <span class="text-xs font-bold text-slate-500 animate-pulse"
                  >SQLite 엔진 데이터 수집 중...</span
                >
              </div>
            {/if}

            {#if columns.length === 0 || rows.length === 0}
              <div
                class="text-center py-20 text-slate-400 text-xs font-medium flex flex-col items-center gap-2"
              >
                <span class="text-2xl">📦</span>
                <span>행 데이터가 비어 있거나 컬럼을 표시할 수 없습니다.</span>
              </div>
            {:else}
              <table class="w-full text-left border-collapse text-xs">
                <thead
                  class="sticky top-0 bg-slate-50 border-b border-slate-200 z-20"
                >
                  <tr>
                    <th
                      class="p-3 text-slate-500 font-bold border-r border-slate-200 text-center w-12 bg-slate-50 select-none"
                      >#</th
                    >
                    {#each columns as col}
                      <th
                        on:click={() => toggleSort(col)}
                        class="p-3 text-slate-700 font-bold border-r border-slate-200 uppercase min-w-[120px] bg-slate-50 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group relative"
                        title="클릭하여 오름차순/내림차순 정렬"
                      >
                        <div class="flex flex-col gap-0.5 justify-center">
                          <div
                            class="flex items-center justify-between gap-1.5"
                          >
                            <div class="flex items-center gap-1.5 pr-1 truncate">
                              <span class="truncate select-all">{col}</span>
                              {#if pkMap[col]}
                                <span
                                  class="text-[8px] bg-amber-100 text-amber-800 border border-amber-300 font-black px-1 py-0.2 rounded-sm flex items-center shrink-0 select-none"
                                  title="기본 키 (PK 순서: {pkOrder[col]})"
                                >
                                  🔑 PK{pkOrder[col]}
                                </span>
                              {/if}
                            </div>
                            <span
                              class="text-[10px] text-slate-400 font-mono flex items-center select-none"
                            >
                              {#if sortKey === col}
                                {sortDirection === "asc" ? "🔼" : "🔽"}
                              {:else}
                                <span
                                  class="opacity-0 group-hover:opacity-40 transition-opacity"
                                  >⇅</span
                                >
                              {/if}
                            </span>
                          </div>
                          {#if columnDescriptions[col]}
                            <span
                              class="text-[9px] font-semibold text-slate-400 normal-case truncate"
                            >
                              {columnDescriptions[col]}
                            </span>
                          {/if}
                        </div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#if processedRows.length === 0}
                    <tr>
                      <td
                        colspan={columns.length + 1}
                        class="p-12 text-center text-slate-400 text-xs font-medium"
                      >
                        🔍 입력하신 검색어 "<strong>{searchTerm}</strong>"에
                        매칭되는 데이터가 없습니다.
                      </td>
                    </tr>
                  {:else}
                    {#each processedRows as row, index}
                      <tr
                        class="hover:bg-blue-50/40 transition-colors border-b border-slate-100 {index %
                          2 ===
                        1
                          ? 'bg-slate-50/40'
                          : ''}"
                      >
                        <td
                          class="p-3 text-center border-r border-slate-200 text-slate-400 font-mono font-medium bg-slate-50/30 select-none"
                        >
                          {index + 1}
                        </td>
                        {#each columns as col}
                          <td
                            class="p-3 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] select-all"
                            title={row[col]}
                          >
                            {#if row[col] === null}
                              <span class="text-slate-300 italic">null</span>
                            {:else if row[col] === ""}
                              <span class="text-slate-300 italic">empty</span>
                            {:else}
                              {row[col]}
                            {/if}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            {/if}
          </div>
        </section>
      </main>
    </div>
  </div>
{:else}
  <div
    class="w-full min-h-screen bg-slate-50 text-slate-400 font-sans flex flex-col items-center justify-center gap-2 select-none"
  >
    <span class="text-3xl animate-bounce">⚠️</span>
    <span class="text-xs font-black tracking-wider uppercase text-slate-500"
      >접근 권한이 없습니다. (Unauthorized Production Access)</span
    >
  </div>
{/if}

<style>
  /* 미려한 크롬 스크롤바 코스메틱 디자인 */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #3b82f6;
  }
</style>

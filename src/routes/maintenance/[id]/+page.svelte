<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { dbService } from "$lib/services/database";
  import { pageTitle, isInitialized } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
  import { settings } from "$lib/stores/settings";
  import { syncStore } from "$lib/stores/sync";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/maintenance"; // 전역 언어 스토어 및 번역 객체 임포트
  import DateAdjuster from "$lib/components/DateAdjuster.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import ModalSlideUp from "$lib/components/ModalSlideUp.svelte";
  import { toLocalDateString } from "$lib/utils/date";

  // YYYYMMDDHHMMSS 포맷 날짜 구하기 헬퍼 함수
  const getFormattedDtm = (date = new Date()) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
  };

  // 수치 입력값 정제 헬퍼 함수 (음수, 소수점, 0.자동붙임, 최대 10자 제한)
  const formatNumericInput = (value: string): string => {
    let val = value.replace(/[^0-9.-]/g, "");

    // 마이너스(-) 기호는 맨 앞에만 허용
    const isNegative = val.startsWith("-");
    val = val.replace(/-/g, "");
    if (isNegative) val = "-" + val;

    // 소수점(.)은 첫 번째 1개만 허용
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }

    // 최대 10자 제한
    if (val.length > 10) val = val.slice(0, 10);

    return val;
  };

  // 페이지 진입 일시 (시작일시)
  const startTime = getFormattedDtm();

  // 한국어 주석: URL 파라미터 또는 해시 뒤에 붙은 쿼리 파라미터(?date= 등)를 안전하게 조회하는 헬퍼 함수
  /**
   * 쿼리스트링 또는 해시 내 쿼리 파라미터 값을 취득합니다.
   * @param {string} key 쿼리 파라미터 키
   * @returns {string | null} 취득된 파라미터 값
   */
  const getQueryOrHashParam = (key: string): string | null => {
    const searchVal = $page.url.searchParams.get(key);
    if (searchVal) return searchVal;

    const rawHash = $page.url.hash || (typeof window !== "undefined" ? window.location.hash : "");
    if (rawHash && rawHash.includes("?")) {
      const queryString = rawHash.split("?")[1];
      const params = new URLSearchParams(queryString);
      return params.get(key);
    }
    return null;
  };

  // 한국어 주석: URL 인코딩된 파라미터 및 해시(#1 등)를 안전하게 병합하여 원본 설비 ID 복원
  const id = $derived.by(() => {
    let rawId = $page.params.id ? decodeURIComponent($page.params.id).replace(/\/$/, "") : "";
    const rawHash = $page.url.hash || (typeof window !== "undefined" ? window.location.hash : "");

    // URL에 해시(#1 등)가 남아있고 rawId에 #이 없는 경우 자동 결합
    if (rawHash && !rawId.includes("#")) {
      const cleanHash = rawHash.replace(/^#/, "");
      const [hashId] = cleanHash.split("?");
      if (hashId) {
        rawId = `${rawId}#${hashId}`;
      }
    }
    return rawId;
  });

  const dateParam = $derived(getQueryOrHashParam("date"));
  const empIdParam = $derived(getQueryOrHashParam("empId"));
  const workGbnParam = $derived(
    getQueryOrHashParam("workGbn") ||
      (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("workGbn") : null)
  );

  // 로그인 정보 공통 바인딩 (Svelte 5 반응형 파생 상태)
  const activeEmpId = $derived(empIdParam || $auth.user?.id || "");
  const uploProcGbn = $derived(getQueryOrHashParam("uploProcGbn") || $auth.user?.uploProcGbn || "");

  let equipment = $state<any>(null);
  let plans = $state<any[]>([]);
  let isLoading = $state(true);

  // 컨펌 모달용 상태 관리
  let confirmModalOpen = $state(false);
  let confirmModalTitle = $state("");
  let confirmModalMessage = $state("");
  let confirmModalType = $state<"confirm" | "success" | "error">("confirm");
  let confirmModalConfirmText = $state("");
  let confirmModalCancelText = $state("");
  let confirmModalShowCancel = $state(false);
  let confirmAction = $state<() => void | Promise<void>>();

  // 이력 그래프 모달용 상태 관리
  let historyModalOpen = $state(false);
  let historyItemName = $state("");
  let historyItemId = $state("");
  let historyData = $state<any[]>([]);
  let numericHistoryData = $state<any[]>([]);
  let isHistoryLoading = $state(false);

  // 한국어 주석: 현재 이력 모달에 열린 점검 항목의 인덱스를 plans 배열 기준으로 실시간 계산합니다.
  let currentHistoryIndex = $derived(plans.findIndex((p) => p.chk_item === historyItemId));

  /**
   * 이전 또는 다음 점검 항목으로 이력 모달의 대상을 전환합니다.
   * @param {number} direction -1 이면 이전 항목, 1 이면 다음 항목
   */
  function navigateHistory(direction: number) {
    // 한국어 주석: 이동할 인덱스를 계산하고 유효 범위를 체크합니다.
    const nextIndex = currentHistoryIndex + direction;
    if (nextIndex >= 0 && nextIndex < plans.length) {
      const nextItem = plans[nextIndex];
      // 한국어 주석: 모달을 열 때 사용하는 캐싱 연동 메서드를 재이용하여 대상을 전환합니다.
      openHistoryModal(nextItem.chk_item_nm || nextItem.chk_item || $t.detailDefaultItemName, nextItem.chk_item);
    }
  }

  let isNumericHistory = $derived(numericHistoryData.length > 0);

  let numericValues = $derived(numericHistoryData.map((d) => Number(d.mea_val)));
  let maxVal = $derived(numericValues.length > 0 ? Math.max(...numericValues) : 100);
  let minVal = $derived(numericValues.length > 0 ? Math.min(...numericValues) : 0);
  let valRange = $derived(maxVal - minVal === 0 ? 10 : maxVal - minVal);

  // 한국어 주석: SVG 꺾은선 차트의 채우기 영역(d) 경로를 계산합니다.
  let chartPathD = $derived.by(() => {
    if (numericHistoryData.length === 0) return "";
    let path = `M 40 120`;
    numericHistoryData.forEach((d, i) => {
      const val = isNaN(Number(d.mea_val)) ? 0 : Number(d.mea_val);
      const y = 120 - ((val - minVal) / valRange) * 90;
      path += ` L ${40 + i * 55} ${y}`;
    });
    path += ` L ${40 + (numericHistoryData.length - 1) * 55} 120 Z`;
    return path;
  });

  // 한국어 주석: SVG 꺾은선 차트의 상단 라인(d) 경로를 계산합니다.
  let linePathD = $derived.by(() => {
    if (numericHistoryData.length === 0) return "";
    let path = "";
    numericHistoryData.forEach((d, i) => {
      const val = isNaN(Number(d.mea_val)) ? 0 : Number(d.mea_val);
      const y = 120 - ((val - minVal) / valRange) * 90;
      if (i === 0) {
        path = `M 40 ${y}`;
      } else {
        path += ` L ${40 + i * 55} ${y}`;
      }
    });
    return path;
  });

  // 한국어 주석: 가동여부 계단식 그래프의 SVG 경로 d 값을 계산합니다. (정상: 1, 비가동: 0, 이상: -1)
  let stepPathD = $derived.by(() => {
    if (historyData.length === 0) return "";
    let path = "";
    historyData.forEach((d, i) => {
      const statusVal = d.chk_rslt === "S" ? 1 : d.chk_rslt === "N" ? 0 : -1;
      const x = 40 + i * 55;
      const y = 75 - statusVal * 45; // 1 -> 30, 0 -> 75, -1 -> 120
      if (i === 0) {
        path = `M ${x} ${y}`;
      } else {
        const prevStatusVal = historyData[i - 1].chk_rslt === "S" ? 1 : historyData[i - 1].chk_rslt === "N" ? 0 : -1;
        const prevY = 75 - prevStatusVal * 45;
        path += ` H ${x} V ${y}`;
      }
    });
    return path;
  });

  // 한국어 주석: 점검 항목별로 과거 이력 조회 결과를 임시 캐싱해둘 메모리 공간 객체
  let historyCache: Record<string, { historyData: any[]; numericHistoryData: any[] }> = {};

  /**
   * 특정 점검 항목의 최근 5건 점검 이력을 조회하여 이력 모달을 엽니다. (메모리 캐싱 연동)
   * @param itemNm 점검 항목명
   * @param itemCd 점검 항목 코드
   */
  async function openHistoryModal(itemNm: string, itemCd: string) {
    historyItemName = itemNm;
    historyItemId = itemCd;
    historyModalOpen = true;

    // 한국어 주석: 이미 캐싱된 데이터가 있을 경우 추가 DB 쿼리 없이 캐시 바인딩
    if (historyCache[itemCd]) {
      historyData = historyCache[itemCd].historyData;
      numericHistoryData = historyCache[itemCd].numericHistoryData;
      return;
    }

    isHistoryLoading = true;
    try {
      const data = await dbService.getItemHistory(id || "", itemCd);

      // 1. 상태 이력: 최근 5개 행만 추출 후 과거 순서대로 반전(reverse)
      const statusHistory = [...data].slice(0, 5).reverse();

      // 2. 수치 이력: 소수점/음수까지 지원하는 숫자 필터링 후 최근 5개 행 추출 및 과거 순서대로 반전(reverse)
      const numericHistory = [...data]
        .filter(
          (d) =>
            d.mea_val !== null &&
            d.mea_val !== undefined &&
            !isNaN(Number(d.mea_val)) &&
            String(d.mea_val).trim() !== ""
        )
        .slice(0, 5)
        .reverse();

      historyData = statusHistory;
      numericHistoryData = numericHistory;

      // 한국어 주석: 조회 완료된 데이터를 해당 항목 코드를 키값으로 메모리 캐시에 적재
      historyCache[itemCd] = {
        historyData: statusHistory,
        numericHistoryData: numericHistory,
      };
    } catch (err) {
      console.error("이력 데이터 로드 실패:", err);
    } finally {
      isHistoryLoading = false;
    }
  }

  function showModal(title: string, message: string, type: "success" | "error" = "success") {
    confirmModalTitle = title;
    confirmModalMessage = message;
    confirmModalType = type;
    confirmModalConfirmText = "";
    confirmModalCancelText = "";
    confirmModalShowCancel = false;
    confirmAction = undefined;
    confirmModalOpen = true;
  }

  function showConfirmModal(
    title: string,
    message: string,
    confirmTxt: string,
    cancelTxt: string,
    action: () => void | Promise<void>
  ) {
    confirmModalTitle = title;
    confirmModalMessage = message;
    confirmModalType = "confirm";
    confirmModalConfirmText = confirmTxt;
    confirmModalCancelText = cancelTxt;
    confirmModalShowCancel = true;
    confirmAction = action;
    confirmModalOpen = true;
  }

  function handleModalConfirm() {
    confirmModalOpen = false;
    if (confirmAction) {
      confirmAction();
      confirmAction = undefined;
    } else if (confirmModalType === "success") {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      } else {
        goto("/maintenance");
      }
    }
  }

  // 오늘 날짜 및 미래일 판별 파생 상태 (미래일일 경우 조회 전용 모드)
  const todayStr = toLocalDateString();
  let inspectionDate = $state(toLocalDateString());
  $effect(() => {
    if (dateParam) {
      inspectionDate = dateParam;
    }
  });

  let isFutureDate = $derived(inspectionDate > todayStr);

  let isSaving = $state(false);

  // 점검구분 & 주기구분 조합 기준 그룹화 바인딩
  let groupedPlans = $derived.by(() => {
    const groups: {
      key: string;
      chk_gbn: string;
      chk_gbn_nm: string;
      cycle_gbn: string;
      cycle_gbn_nm: string;
      items: any[];
    }[] = [];

    for (const plan of plans) {
      const gbn = plan.chk_gbn || "";
      const cycle = plan.cycle_gbn || "";
      const key = `${gbn}_${cycle}`;

      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = {
          key,
          chk_gbn: gbn,
          chk_gbn_nm: plan.chk_gbn_nm || gbn,
          cycle_gbn: cycle,
          cycle_gbn_nm: plan.cycle_gbn_nm || cycle,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(plan);
    }
    return groups;
  });

  async function loadData() {
    isLoading = true;
    // 한국어 주석: 날짜나 설비 변경으로 신규 데이터를 로드할 시 캐시 초기화
    historyCache = {};
    try {
      const planDay = inspectionDate.replace(/-/g, ""); // 하이픈 제거하여 순수 숫자로 포맷 (예: 20260602)

      // 두 쿼리를 병렬로 동시에 구동하여 로딩 속도 최적화 (Promise.all)
      const [eqRes, planValues] = await Promise.all([
        dbService.query("SELECT * FROM tb_mob_std120 WHERE asset_id = ? LIMIT 1", [id]),
        dbService.getInspectionPlans(id || "", planDay, activeEmpId, uploProcGbn, $lang),
      ]);

      // 1. 설비 스펙 바인딩
      if (eqRes?.values && eqRes.values.length > 0) {
        equipment = eqRes.values[0];
      }
      console.log("설비", equipment);

      // 2. 선택한 주기에 특화된 점검 계획 바인딩
      if (planValues) {
        plans = planValues.map((p: any) => {
          const hasSavedRecord = p.saved_chk_rslt !== undefined && p.saved_chk_rslt !== null;
          const chk_rslt = hasSavedRecord ? p.saved_chk_rslt : p.chk_rslt || "";

          const isNumeric = p.chk_unit === "M" || p.chk_unit === "T";

          const mea_val = hasSavedRecord
            ? p.saved_mea_val !== undefined && p.saved_mea_val !== null
              ? p.saved_mea_val
              : ""
            : p.chk_rslt
              ? p.mea_val || ""
              : isNumeric
                ? ""
                : null;
          const special_note = p.saved_special_note || p.special_note || "";

          return {
            ...p,
            chk_rslt,
            mea_val,
            special_note,
            showNote: !!special_note,
            original_chk_rslt: chk_rslt,
            original_mea_val: mea_val,
            original_special_note: special_note,
          };
        });
      }
      console.log("점검 계획 로드 완료", plans);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      isLoading = false;
    }
  }

  async function executeSave() {
    isSaving = true;
    try {
      console.log("[DEBUG] [handleSave] Start saving. workGbnParam:", workGbnParam);

      // Filter only modified items
      const modifiedPlans = plans.filter((p) => {
        const hasMeaValChanged = String(p.mea_val || "") !== String(p.original_mea_val || "");
        const hasRsltChanged = (p.chk_rslt || "") !== (p.original_chk_rslt || "");
        const hasNoteChanged = (p.special_note || "") !== (p.original_special_note || "");
        return hasMeaValChanged || hasRsltChanged || hasNoteChanged;
      });

      if (modifiedPlans.length === 0) {
        showModal($t.detailNoChangesTitle, $t.detailNoChangesMsg, "success");
        return;
      }

      const endTime = getFormattedDtm();
      const checks = modifiedPlans.map((p) => {
        let rsl = p.chk_rslt;
        const targetWorkGbn = workGbnParam || p.chk_work_gbn || "MOS";
        console.log(
          `[DEBUG] [handleSave] Item [${p.chk_item}] -> p.chk_work_gbn: "${p.chk_work_gbn}", workGbnParam: "${workGbnParam}", Final to save: "${targetWorkGbn}"`
        );

        // Truncate values to fit DB column constraints
        const rawMeaVal = p.mea_val !== undefined && p.mea_val !== null ? String(p.mea_val) : "";
        const truncatedMeaVal = rawMeaVal.slice(0, 10);
        const finalMeaVal = p.mea_val !== undefined && p.mea_val !== null ? truncatedMeaVal : null;

        const rawSpecialNote = p.special_note || "";
        const truncatedSpecialNote = rawSpecialNote.slice(0, 400);

        const rsltNm = rsl === "S" ? "정상" : rsl === "N" ? "비가동" : rsl === "F" ? "이상" : "";

        return {
          ...p,
          mea_val: finalMeaVal,
          special_note: truncatedSpecialNote,
          chk_rslt: rsl,
          chk_rslt_nm: rsltNm,
          chk_work_gbn: targetWorkGbn,
          note: truncatedSpecialNote,
          status: rsl === "S" ? "pass" : rsl === "N" ? "stop" : rsl === "F" ? "fail" : "pending",
          chk_item_raw: p.chk_item,
          chk_dtl_raw: p.chk_dtl,
          photo_url: "",
          label: p.chk_dtl || p.chk_item,
          chk_sta_dtm: startTime,
          chk_end_dtm: endTime,
        };
      });

      const hasAbnormal = checks.some((c) => c.chk_rslt === "F");
      const allInactive = checks.every((c) => c.chk_rslt === "N");
      const overallStatus = hasAbnormal ? "fail" : allInactive ? "stop" : "pass";

      const timestamp = new Date();
      const data = {
        equipmentId: id,
        status: overallStatus,
        memo: "",
        checks,
        timestamp,
      };

      await dbService.saveInspection(data);
      // 한국어 주석: 새 실적이 저장되어 데이터베이스 상태가 갱신되었으므로 메모리 캐시 초기화
      historyCache = {};

      // 조건(온라인 모드 & autoSendYn === 'Y') 충족 시 실적 자동 송신 비동기 실행
      syncStore.autoTransmitResultsSilent().catch((autoErr) => {
        console.warn("[Auto Transmit] Automatic submission skipped/failed:", autoErr);
      });
      showModal($t.detailSaveTitle, $t.detailSaveSuccess, "success");
    } catch (err) {
      console.error("저장 실패:", err);
      showModal($t.detailSaveTitleError, `${$t.detailSaveFailed}\n(${(err as Error).message})`, "error");
    } finally {
      isSaving = false;
    }
  }

  async function handleSave() {
    if (plans.length === 0) return;

    // 미입력 항목 리스트 수집
    const unenteredResults: string[] = [];
    const unenteredMeaVals: string[] = [];

    for (const p of plans) {
      const isNumeric = p.chk_unit === "M" || p.chk_unit === "T";

      // 점검결과(정상/이상/비가동) 미선택 여부
      const isRsltEmpty = p.chk_rslt === undefined || p.chk_rslt === null || String(p.chk_rslt).trim() === "";

      // 측정값 미입력 여부 (단, 점검결과가 '비가동'인 경우에는 측정값 입력을 강제하지 않음)
      const isMeaValEmpty =
        isNumeric &&
        p.chk_rslt !== "N" &&
        (p.mea_val === undefined || p.mea_val === null || String(p.mea_val).trim() === "");

      if (isRsltEmpty) {
        unenteredResults.push(p.chk_item_nm || p.chk_item || $t.detailDefaultItemName);
      }
      if (isMeaValEmpty) {
        unenteredMeaVals.push(p.chk_item_nm || p.chk_item || $t.detailDefaultItemName);
      }
    }

    if (unenteredResults.length > 0 || unenteredMeaVals.length > 0) {
      const title = $t.detailUnenteredTitle;
      const confirmTxt = $t.detailConfirmSave;
      const cancelTxt = $t.detailContinueInput;

      // 텍스트 변환 헬퍼 (최대 3개 항목 + 외 N건)
      const getFormattedItemsStr = (items: string[]) => {
        return items.length > 3
          ? `${items.slice(0, 3).join(", ")}${$t.detailOthersFormat.replace("{count}", String(items.length - 3))}`
          : items.join(", ");
      };

      const itemsResultStr = getFormattedItemsStr(unenteredResults);
      const itemsValStr = getFormattedItemsStr(unenteredMeaVals);

      let msg = "";
      if (unenteredResults.length > 0 && unenteredMeaVals.length > 0) {
        msg = $t.detailUnenteredMsgBoth
          .replace("{itemsResult}", itemsResultStr)
          .replace("{itemsVal}", itemsValStr);
      } else if (unenteredResults.length > 0) {
        msg = $t.detailUnenteredMsgResult.replace("{itemsResult}", itemsResultStr);
      } else {
        msg = $t.detailUnenteredMsgMea.replace("{itemsVal}", itemsValStr);
      }

      showConfirmModal(title, msg, confirmTxt, cancelTxt, executeSave);
    } else {
      await executeSave();
    }
  }

  // inspectionDate 상태가 바뀔 때마다 loadData()를 즉각 자동 호출 (Svelte 5 Runes)
  // inspectionDate 및 앱 초기화 상태($isInitialized), 로그인 세션($auth), 테스트 사번 파라미터($page.url.searchParams.get('empId'))가 변경될 때마다 loadData()를 안전하게 호출
  $effect(() => {
    if (!$isInitialized) return;

    // Svelte 5 reactive tracking context registration for auth store & test empId param
    const userState = $auth;
    empIdParam;
    inspectionDate;
    $lang;

    console.log("[DEBUG] [Page Mount/Effect] $page.url.searchParams:", $page.url.searchParams.toString());
    console.log("[DEBUG] [Page Mount/Effect] workGbnParam value:", workGbnParam);
    if (typeof window !== "undefined") {
      console.log("[DEBUG] [Page Mount/Effect] window.location.href:", window.location.href);
      console.log("[DEBUG] [Page Mount/Effect] window.location.search:", window.location.search);
    }
    loadData();
  });

  // 언어($lang)가 바뀔 때 헤더 타이틀을 반응형으로 설정
  $effect(() => {
    pageTitle.set($t.detailTitle);
  });
</script>

<svelte:head>
  <title>{$t.detailTitle}</title>
</svelte:head>

<div class="flex-1 bg-slate-50 font-sans pb-12 flex flex-col w-full">
  <!-- 상단 메인 배너: 가로 가득 채우고 고급스러운 딥 네이비 / 블루 그라데이션 적용 -->
  <header
    class="bg-linear-to-r from-slate-900 via-slate-800 to-blue-950 text-white py-5 px-6 shadow-md border-b border-slate-800">
    <div class="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
      {#if isLoading}
        <div class="animate-pulse space-y-2">
          <div class="h-4 w-20 bg-slate-700 rounded"></div>
          <div class="h-8 w-60 bg-slate-700 rounded"></div>
        </div>
      {:else if equipment}
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <!-- 1. 설비구분 (fac_gbn) -->
            <span class="px-2.5 py-0.5 text-[9px] font-black bg-blue-600/90 text-white rounded uppercase tracking-wider">
              {equipment.fac_gbn || $t.detailEquipTag}
            </span>
            <!-- 2. 설비 ID (asset_id) -->
            <span class="text-[11px] font-mono text-slate-400 font-bold bg-white/10 px-2 py-0.5 rounded">
              ID: {equipment.asset_id}
            </span>
          </div>
          <!-- 3. 설비명 (asset_nm) -->
          <h1 class="text-2xl font-black tracking-tight leading-none text-white drop-shadow-xs">
            {equipment.asset_nm || $t.detailNoAssetName}
          </h1>
        </div>

        <div
          class="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-300 border-t border-slate-800 md:border-t-0 pt-4 md:pt-0">
          <!-- 4. 설비위치 (install_loc) -->
          <div>
            <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5"
              >{$t.detailLocTag}</span>
            <span class="font-bold text-white">{equipment.install_loc || "-"}</span>
          </div>
          <!-- 5. 수리공정명 (proc_nm) -->
          <div>
            <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5"
              >{$t.detailProcTag}</span>
            <span class="font-bold text-white">{equipment.proc_nm || "-"}</span>
          </div>
        </div>
      {:else}
        <p class="text-rose-400 text-sm font-semibold">
          {$t.detailNoEquipment.replace("{id}", id || "")}
        </p>
      {/if}
    </div>
  </header>

  <!-- 하단: 점검 계획 목록 (tb_mob_std130) -->
  <main class="max-w-4xl mx-auto p-6 pt-3 space-y-3 w-full">
    <DateAdjuster bind:selectedDate={inspectionDate} />

    {#if isFutureDate}
      <!-- 미래일 안내 경고 뱃지 -->
      <div class="w-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-amber-700 dark:text-amber-300 shadow-sm">
        <svg class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-xs font-bold leading-tight">
          미래 날짜의 점검 항목은 조회 전용 모드로 제공되며 작성/저장이 불가능합니다.
        </span>
      </div>
    {/if}

    {#if isLoading}
      <section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div class="py-12 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-3 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="mt-3 text-xs font-bold text-slate-400">
            {$t.detailLoading}
          </p>
        </div>
      </section>
    {:else if groupedPlans.length > 0}
      <div class="space-y-6">
        {#each groupedPlans as group}
          <section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <!-- 카드 상단: 그룹 타이틀 (점검구분 / 주기구분) -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-blue-600 dark:text-blue-400 font-mono uppercase tracking-wide">
                  {group.chk_gbn_nm} / {group.cycle_gbn_nm}
                </span>
              </div>
              <span class="text-[10px] text-slate-400 font-bold font-mono">
                {group.items.length}
                {$t.detailItems}
              </span>
            </div>

            <!-- 그룹 내 점검 리스트 -->
            <div class="divide-y divide-slate-100">
              {#each group.items as plan}
                <div class="py-4 first:pt-0 last:pb-0 flex flex-col gap-3 text-sm">
                  <!-- 상단 영역: 항목 정보/입력창 및 판정버튼 -->
                  <div class="flex flex-col justify-between gap-3">
                    <!-- 좌측 영역: 항목 정보와 수치 입력창을 한 줄로 배치 -->
                    <div class="flex flex-col items-start gap-2 flex-1 w-full">
                      <div class="space-y-1 flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-bold text-slate-800 wrap-break-word">
                            {plan.chk_item_nm ||
                              plan.chk_item ||
                              $t.detailDefaultItemName}{#if plan.chk_item_unit}<span
                                class="font-bold text-slate-400 ml-1">({plan.chk_item_unit})</span
                              >{/if}
                          </span>
                          {#if !isFutureDate}
                            <button
                              type="button"
                              onclick={() => (plan.showNote = !plan.showNote)}
                              class="text-[10px] text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-300/80 border border-slate-200 px-2 py-0.5 rounded-lg font-black flex items-center gap-0.5 transition-all cursor-pointer ml-1 select-none active:scale-[0.98]">
                              <span>{$t.detailNote}</span>
                              <span class="text-[9px]">{plan.showNote ? "▲" : "▼"}</span>
                            </button>
                          {/if}
                        </div>
                      </div>

                      <!-- 우측/측정값 입력 측: 기준 표시 및 입력 필드 -->
                      <div class="flex items-center gap-2.5 shrink-0 sm:mr-4 flex-wrap justify-end ml-auto">
                        {#if plan.chk_ref || plan.chk_ll || plan.chk_ul}
                          <span class="text-xs font-bold text-slate-600">
                            {$t.detailCriteria} :
                            {#if plan.chk_ll || plan.chk_ul}
                              {plan.chk_ll || ""} ~ {plan.chk_ul || ""}
                              {#if plan.chk_ref}
                                ({plan.chk_ref})
                              {/if}
                            {:else if plan.chk_ref}
                              {plan.chk_ref}
                            {/if}
                          </span>
                        {/if}

                        {#if plan.chk_unit === "M" || plan.chk_unit === "T"}
                          <!-- 수치 입력 필드 및 단위 영역 -->
                          <div class="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputmode="numeric"
                              pattern="[0-9.-]*"
                              placeholder={$t.detailMeasuringValue}
                              disabled={isFutureDate}
                              bind:value={plan.mea_val}
                              oninput={(e) => {
                                const target = e.target as HTMLInputElement;
                                const val = formatNumericInput(target.value);
                                target.value = val;
                                plan.mea_val = val;
                              }}
                              class="highlighted-input w-24 sm:w-28 px-3 py-1.5 border-2 border-slate-700 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-800/60 rounded-lg text-center text-xs font-black text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 hover:border-slate-900 dark:hover:border-white focus:bg-white dark:focus:bg-zinc-950 focus:outline-none transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-200 dark:disabled:bg-zinc-800" />
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- 우측 영역: 판정 라디오 버튼 (선택 전에도 해당 색상 테두리 표시) -->
                    <div class="flex flex-col gap-2 shrink-0 items-end w-full sm:w-auto">
                      <div
                        class="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 w-full sm:w-auto shrink-0">
                        <!-- 정상 버튼 (주조색: #088a4a, 테두리 3px) -->
                        <button
                          type="button"
                          disabled={isFutureDate}
                          onclick={() => (plan.chk_rslt = "S")}
                          class="flex-1 sm:flex-initial w-16 sm:w-20 text-center py-1.5 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed
                              {plan.chk_rslt === 'S'
                            ? 'bg-[#088a4a] text-white shadow-xs border-[3px] border-[#088a4a]'
                            : 'border-[3px] border-[#088a4a] text-[#088a4a] dark:text-emerald-400 bg-[#088a4a]/10 hover:bg-[#088a4a]/20'}">
                          {$t.detailNormal}
                        </button>
                        <!-- 이상 버튼 (선택 시: 로즈 배경 / 비선택 시: 로즈 테두리 3px 및 텍스트) -->
                        <button
                          type="button"
                          disabled={isFutureDate}
                          onclick={() => (plan.chk_rslt = "F")}
                          class="flex-1 sm:flex-initial w-16 sm:w-20 text-center py-1.5 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed
                              {plan.chk_rslt === 'F'
                            ? 'bg-rose-500 text-white shadow-xs border-[3px] border-rose-500'
                            : 'border-[3px] border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40'}">
                          {$t.detailAbnormal}
                        </button>
                        <!-- 비가동 버튼 (선택 시: 앰버 배경 / 비선택 시: 앰버 테두리 3px 및 텍스트) -->
                        <button
                          type="button"
                          disabled={isFutureDate}
                          onclick={() => (plan.chk_rslt = "N")}
                          class="flex-1 sm:flex-initial w-16 sm:w-20 text-center py-1.5 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed
                              {plan.chk_rslt === 'N'
                            ? 'bg-amber-500 text-white shadow-xs border-[3px] border-amber-500'
                            : 'border-[3px] border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-900/40'}">
                          {$t.detailInactive}
                        </button>
                      </div>

                      <!-- 모바일 최적화용 판정 라디오 버튼 아래 큰 이력보기 버튼 -->
                      <button
                        type="button"
                        onclick={() =>
                          openHistoryModal(
                            plan.chk_item_nm || plan.chk_item || $t.detailDefaultItemName,
                            plan.chk_item
                          )}
                        class="w-full py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300/80 dark:hover:bg-zinc-600 border border-slate-300/70 dark:border-zinc-600 text-slate-750 dark:text-zinc-200 font-extrabold text-[11px] rounded-xl cursor-pointer transition-all active:scale-[0.98] select-none flex items-center justify-center gap-1">
                        <span
                          >{$t.detailHistoryQuery}
                          <span class="text-[9px] font-normal opacity-60 ml-0.5">{$t.detailRecent5}</span></span>
                      </button>
                    </div>
                  </div>

                  <!-- 특이사항 영역 (미래 날짜에서는 이미 적힌 내용이 있는 경우에만 읽기 전용으로 표시) -->
                  {#if (!isFutureDate && plan.showNote) || plan.special_note}
                    <div class="w-full mt-1">
                      <textarea
                        placeholder={$t.detailPlaceholderNote}
                        disabled={isFutureDate}
                        bind:value={plan.special_note}
                        maxlength="400"
                        class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none bg-slate-50 font-sans resize-y min-h-12.5 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-200 dark:disabled:bg-zinc-800"
                      ></textarea>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {:else}
      <section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <p class="text-slate-400 text-xs font-bold py-8 text-center">
          {$t.detailNoPlan}
        </p>
      </section>
    {/if}

    <!-- 하단 저장 버튼 (미래 날짜일 경우 노출 안 함) -->
    {#if plans.length > 0 && !isFutureDate}
      <div class="flex justify-end pt-4">
        <button
          onclick={handleSave}
          disabled={isSaving}
          class="px-8 py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl transition-all shadow-md active:scale-[0.98] select-none cursor-pointer flex items-center gap-2 border-none outline-none">
          {#if isSaving}
            <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            <span>{$t.detailHistoryLoadText}</span>
          {:else}
            <svg
              class="w-4 h-4 text-white fill-current shrink-0"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
            </svg>
            <span>{$t.detailSave}</span>
          {/if}
        </button>
      </div>
    {/if}
  </main>
</div>

<!-- 프리미엄 디자인 컨펌/알림 모달 장착 -->
<ConfirmModal
  bind:isOpen={confirmModalOpen}
  title={confirmModalTitle}
  message={confirmModalMessage}
  type={confirmModalType}
  confirmText={confirmModalConfirmText}
  cancelText={confirmModalCancelText}
  showCancel={confirmModalShowCancel}
  on:confirm={handleModalConfirm} />

<!-- 항목별 과거 이력 시각화 그래프 모달 영역 -->
<ModalSlideUp bind:isOpen={historyModalOpen} title={historyItemName} subTitle={$t.detailHistoryTitle}>
  <div class="p-6 space-y-6">
    {#if isHistoryLoading}
      <!-- 로딩 중 스피너 -->
      <div class="py-12 flex flex-col items-center justify-center">
        <div class="w-8 h-8 border-3 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
        <p class="mt-2 text-xs font-bold text-slate-400">
          {$t.detailHistoryLoadText}
        </p>
      </div>
    {:else if historyData.length === 0}
      <!-- 데이터 없음 상태 -->
      <div class="py-12 flex flex-col items-center justify-center">
        <span class="text-3xl mb-2">📊</span>
        <p class="text-xs font-bold text-slate-400">
          {$t.detailNoHistory}
        </p>
      </div>
    {:else}
      <!-- 수치 이력 섹션 (수치 데이터가 존재하는 경우에만 노출) -->
      {#if isNumericHistory}
        <div class="space-y-2">
          <h4 class="text-xs font-black text-slate-800 dark:text-zinc-200">
            {historyItemName}
            {$t.detailTrend}
          </h4>
          <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
            <div class="w-full flex justify-between text-[9px] font-bold text-slate-400 mb-2">
              <span>{$t.detailMin}: {minVal}{numericHistoryData[0]?.chk_unit || ""}</span>
              <span>{$t.detailMax}: {maxVal}{numericHistoryData[0]?.chk_unit || ""}</span>
            </div>
            <div class="relative w-full h-44 flex items-end">
              <!-- 그리드 배경선 -->
              <div class="absolute inset-x-0 top-0 h-px bg-slate-200/50 dark:bg-zinc-700/50"></div>
              <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200/50 dark:bg-zinc-700/50"></div>
              <div class="absolute inset-x-0 bottom-8 h-px bg-slate-300 dark:bg-zinc-650"></div>
              <!-- X축 기준선 -->

              <svg class="w-full h-full" viewBox="0 0 300 150">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                  </linearGradient>
                </defs>

                {#if numericHistoryData.length > 1}
                  <!-- 그라데이션 영역 패스 -->
                  <path d={chartPathD} fill="url(#chart-grad)" />

                  <!-- 상단 꺾은선 패스 -->
                  <path
                    d={linePathD}
                    fill="none"
                    stroke="#3b82f6"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                {/if}

                <!-- 각 이력 포인트 도트 및 축 라벨 드로잉 -->
                {#each numericHistoryData as d, i}
                  {@const val = Number(d.mea_val)}
                  {@const cx = 40 + i * 55}
                  {@const cy = 120 - ((val - minVal) / valRange) * 90}

                  <!-- 데이터 도트 -->
                  <circle {cx} {cy} r="5" fill="#ffffff" stroke="#3b82f6" stroke-width="2" />
                  <circle {cx} {cy} r="2" fill="#3b82f6" />

                  <!-- 수치값 라벨 -->
                  <text
                    x={cx}
                    y={cy - 10}
                    text-anchor="middle"
                    fill="#1e293b"
                    class="fill-slate-800 dark:fill-zinc-200 font-mono text-[9px] font-black">
                    {d.mea_val}
                  </text>

                  <!-- 월/일 (MM/DD) 라벨 -->
                  <text
                    x={cx}
                    y={140}
                    text-anchor="middle"
                    class="fill-slate-400 dark:fill-zinc-500 font-mono text-[8px] font-bold">
                    {d.chk_plan_day.slice(4, 6)}/{d.chk_plan_day.slice(6, 8)}
                  </text>
                {/each}
              </svg>
            </div>
          </div>
        </div>
      {/if}

      <!-- 가동여부 이력 섹션 (상태 그래프 단독 노출) -->
      <div class="space-y-3">
        <h4 class="text-xs font-black text-slate-800 dark:text-zinc-200">
          {$t.detailHistoryQuery}
        </h4>

        <!-- 계단식 차트(Step Line Chart)로 시각화 (정상: 1, 비가동: 0, 이상: -1) -->
        <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
          <div class="relative w-full h-44 flex items-end">
            <svg class="w-full h-full" viewBox="0 0 300 150">
              <!-- 정상 점선 가이드라인 -->
              <line
                x1="30"
                y1="30"
                x2="290"
                y2="30"
                stroke="currentColor"
                stroke-dasharray="3,3"
                class="text-slate-200 dark:bg-zinc-800/80"
                stroke-width="1" />
              <!-- 비가동 Y축 중심선 -->
              <line
                x1="30"
                y1="75"
                x2="290"
                y2="75"
                stroke="currentColor"
                class="text-slate-200 dark:bg-zinc-800/80"
                stroke-width="1" />
              <!-- 이상 점선 가이드라인 -->
              <line
                x1="30"
                y1="120"
                x2="290"
                y2="120"
                stroke="currentColor"
                stroke-dasharray="3,3"
                class="text-slate-200 dark:bg-zinc-800/80"
                stroke-width="1" />

              <!-- Y축 텍스트 라벨 -->
              <text
                x="25"
                y="30"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-emerald-600 dark:fill-emerald-400 font-bold text-[8px]">{$t.detailNormal}</text>
              <text
                x="25"
                y="75"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-amber-600 dark:fill-amber-400 font-bold text-[8px]">{$t.detailInactive}</text>
              <text
                x="25"
                y="120"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-rose-600 dark:fill-rose-400 font-bold text-[8px]">{$t.detailAbnormal}</text>

              <!-- 계단식 선 경로 -->
              {#if historyData.length > 1}
                <path
                  d={stepPathD}
                  fill="none"
                  stroke="#6366f1"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              {/if}

              <!-- 각 상태별 마커 도트 및 하단 날짜 매핑 -->
              {#each historyData as d, i}
                {@const statusVal = d.chk_rslt === "S" ? 1 : d.chk_rslt === "N" ? 0 : -1}
                {@const cx = 40 + i * 55}
                {@const cy = 75 - statusVal * 45}

                <circle
                  {cx}
                  {cy}
                  r="4.5"
                  fill={d.chk_rslt === "S" ? "#10b981" : d.chk_rslt === "N" ? "#f59e0b" : "#ef4444"}
                  stroke="#ffffff"
                  stroke-width="1.5" />

                <text
                  x={cx}
                  y={140}
                  text-anchor="middle"
                  class="fill-slate-400 dark:fill-zinc-500 font-mono text-[8px] font-bold">
                  {d.chk_plan_day.slice(4, 6)}/{d.chk_plan_day.slice(6, 8)}
                </text>
              {/each}
            </svg>
          </div>
        </div>
      </div>
    {/if}

    <!-- 한국어 주석: 항목 간 이동을 위한 모달 좌우 내비게이션 바 영역 (닫기 버튼 바로 위에 조작하기 편하게 배치) -->
    <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800/50">
      <button
        type="button"
        onclick={() => navigateHistory(-1)}
        disabled={currentHistoryIndex <= 0}
        class="px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 select-none active:scale-[0.98] border border-slate-200/50 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-850">
        {$t.detailPrevItem}
      </button>
      <span class="text-xs font-bold text-slate-500 dark:text-zinc-400 font-mono">
        {currentHistoryIndex + 1} / {plans.length}
      </span>
      <button
        type="button"
        onclick={() => navigateHistory(1)}
        disabled={currentHistoryIndex >= plans.length - 1}
        class="px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 select-none active:scale-[0.98] border border-slate-200/50 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-850">
        {$t.detailNextItem}
      </button>
    </div>

    <!-- 닫기 버튼 -->
    <div class="pt-2">
      <button
        type="button"
        onclick={() => (historyModalOpen = false)}
        class="w-full py-3.5 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer active:scale-[0.98] transition-all">
        {$t.detailClose}
      </button>
    </div>
  </div>
</ModalSlideUp>

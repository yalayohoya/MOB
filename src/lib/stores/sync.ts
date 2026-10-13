import { writable, get } from 'svelte/store';
import { dbService } from '$lib/services/database';
import { fetchWithTimeout } from '$lib/services/apiHelper';
import { isOnline } from '$lib/stores/network';
import { toLocalDateString } from '$lib/utils/date';
import {
  listExcelFiles,
  loadExcelFile,
  deleteExcelFile,
  requestStoragePermission,
  parseInspectorInfo,
  parseEquipmentSpec,
  parseInspectionPlan,
  parseInspectionStds
} from '$lib/services/excel';
import type { ExcelEquipment } from '$lib/services/excel';
import { lang, t } from '$lib/stores/lang';
import { Capacitor } from '@capacitor/core';
import { showToast } from '$lib/services/toast';
import * as XLSX from 'xlsx';
import { Filesystem, Directory } from '@capacitor/filesystem';


import { auth } from '$lib/stores/auth';
import { settings } from '$lib/stores/settings';
import { goto } from '$app/navigation';

/**
 * API 요청 전 세션 토큰 유효성을 검증하고, 만료 시 갱신하는 헬퍼 함수
 */
async function ensureValidSession(): Promise<string> {
  const user = await dbService.getUserInfo();
  if (user?.id === 'ADMIN' || user?.id === 'DEV') {
    throw new Error(`admin_dev_account:${user.id}`);
  }

  if (!user || !user.accToken) {
    console.log('1. 엑세스 토큰 검증... 실패 (세션 없음)');
    throw new Error('session_none');
  }

  // 1. Access Token 검증
  console.log('1. 엑세스 토큰 검증...');
  const isAccValid = await auth.validateAccessToken();
  if (isAccValid) {
    console.log('엑세스 토큰이 유효하여 바로 API를 호출합니다.');
    return user.accToken;
  }

  console.log(' 실패... rf토큰으로 검증합니다.');

  // 2. Access Token 실패 시 Refresh Token 검증 및 갱신
  console.log('2. rf토큰...');
  const refreshRes = await auth.refreshSession();
  if (refreshRes.success) {
    console.log('성공.. 덮어씌웁니다.');
    const updatedUser = await dbService.getUserInfo();
    if (updatedUser && updatedUser.accToken) {
      console.log('덮어씌움.');
      return updatedUser.accToken;
    }
  } else {
    const errStr = refreshRes.error || '';
    if (
      errStr.includes('Failed to fetch') ||
      errStr.includes('TypeError') ||
      errStr.includes('NetworkError') ||
      errStr.includes('timeout') ||
      errStr.includes('HTTP Error: 5') ||
      errStr.includes('HTTP Error: 404')
    ) {
      throw new Error('connection_error');
    }
  }

  // 3. 둘 다 실패할 시 에러 발생
  console.log(' 실패... 세션이 만료되어 로그인이 필요합니다.');
  throw new Error('session_expired');
}

/**
 * 데이터베이스 동기화 전용 중앙 스토어 생성 함수
 */
function createSyncStore() {
  const isSyncing = writable<boolean>(false);
  const isTransmitting = writable<boolean>(false);
  const isExcelPickerOpen = writable<boolean>(false);
  const excelFiles = writable<{ filename: string; size: number; timestamp: number; formattedDate: string }[]>([]);
  const selectedExcelFilename = writable<string>('');

  const syncStepText = writable<string>('');
  const syncAbortController = writable<AbortController | null>(null);

  // [프리미엄 UI 알림 스토어] 전역 고유 모달 제어용 변수
  const syncAlertOpen = writable<boolean>(false);
  const syncAlertTitle = writable<string>('');
  const syncAlertMessage = writable<string>('');
  const syncAlertType = writable<'success' | 'error' | 'warning'>('success');
  const syncProgressValue = writable<number | null>(null);

  // [프리미엄 UI 예/아니오 컨펌 스토어]
  const syncConfirmOpen = writable<boolean>(false);
  const syncConfirmTitle = writable<string>('');
  const syncConfirmMessage = writable<string>('');
  const syncConfirmType = writable<'confirm' | 'warning' | 'error' | 'success' | 'none'>('confirm');
  const syncConfirmResult = writable<{ confirmed: boolean; fromDt: string; toDt: string } | null>(null);
  const syncConfirmShowDateRange = writable<boolean>(false);
  const syncPlanFromDt = writable<string>('');
  const syncPlanToDt = writable<string>('');

  /**
   * 브라우저 순정 alert 대신 우리가 설계한 프리미엄 글래스모피즘 모달창을 
   * 비동기(Promise/await) 방식으로 제어하기 위한 강력한 가상 알림 헬퍼입니다.
   */
  async function showSyncAlert(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success', progress: number | null = null): Promise<void> {
    syncAlertTitle.set(title);
    syncAlertMessage.set(message);
    syncAlertType.set(type);
    syncProgressValue.set(progress);
    syncAlertOpen.set(true);

    return new Promise<void>((resolve) => {
      const unsubscribe = syncAlertOpen.subscribe((open) => {
        if (!open) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * 가상 컨펌 창 헬퍼 (예/아니오 2버튼 제어)
   */
  async function showSyncConfirm(
    title: string,
    message: string,
    type: 'confirm' | 'warning' | 'error' | 'success' | 'none' = 'confirm',
    showDateRange: boolean = false,
    defaultFromDt: string = '',
    defaultToDt: string = ''
  ): Promise<{ confirmed: boolean; fromDt: string; toDt: string }> {
    syncConfirmTitle.set(title);
    syncConfirmMessage.set(message);
    syncConfirmType.set(type);
    syncConfirmShowDateRange.set(showDateRange);

    const todayStr = toLocalDateString();
    syncPlanFromDt.set(defaultFromDt || todayStr);
    syncPlanToDt.set(defaultToDt || todayStr);

    syncConfirmResult.set(null);
    syncConfirmOpen.set(true);

    return new Promise<{ confirmed: boolean; fromDt: string; toDt: string }>((resolve) => {
      const unsubscribe = syncConfirmOpen.subscribe((open) => {
        if (!open) {
          unsubscribe();
          const result = get(syncConfirmResult);
          resolve(result || { confirmed: false, fromDt: get(syncPlanFromDt), toDt: get(syncPlanToDt) });
        }
      });
    });
  }

  /**
   * 전역 동기화 액션을 트리거합니다.
   * - 온라인 모드: MES API 연동을 통해 데이터 동기화
   * - 오프라인 모드: 4종의 엑셀 파일(점검자, 설비사양, 점검계획, 점검표준)을 자동 탐색해 순차적으로 드랍 후 인서트 실행
   */
  async function triggerSync(forceOffline: boolean = false) {
    // [방어 코드] 중복 동기화 요청 방지 (데이터베이스 락 및 불필요한 네트워크 병목 방어)
    if (get(isSyncing)) return;

    const online = forceOffline ? false : get(isOnline);
    const currentLang = get(lang);

    const controller = new AbortController();
    syncAbortController.set(controller);

    if (online) {
      // 1. 온라인 모드: MES API 동기화 세션 우선 검증 (ADMIN/DEV 경고 메시지 선출력)
      try {
        await ensureValidSession();

        // 일반 계정이면 데이터 수신 경고 컨펌 모달 호출 (아이콘 미노출 'none' 및 날짜 범위 지정)
        const confirmRes = await showSyncConfirm(
          t[currentLang].syncConfirmTitle,
          t[currentLang].syncConfirmMessage,
          'none',
          true
        );

        if (!confirmRes.confirmed) {
          return;
        }

        isSyncing.set(true);
        syncStepText.set(t[currentLang].syncStepVerifyingSession);

        // 공식 REST API 서버로부터 실시간 오프라인 마스터 정보 무결성 연동 및 DB 갱신
        const result = await syncData(
          controller.signal,
          (stepMsg) => {
            syncStepText.set(stepMsg);
          },
          confirmRes.fromDt,
          confirmRes.toDt
        );

        if (controller.signal.aborted) throw new Error('cancelled');

        // 사용자 성공 안내 알림 팝업 노출 (다국어 지원)
        await showSyncAlert(
          t[currentLang].syncCompleteTitle2,
          t[currentLang].syncOnlineCompleteMsg
            .replace('{eqCount}', String(result.eqCount))
            .replace('{planCount}', String(result.planCount))
            .replace('{stdsCount}', String(result.stdsCount)),
          'success'
        );
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'cancelled') {
          console.log('Sync cancelled by user.');
          return;
        }

        const errMsg = err.message || '';

        if (errMsg.startsWith('admin_dev_account:')) {
          const accountId = errMsg.split(':')[1] || 'ADMIN';
          const alertMsg = t[currentLang].adminDevAccountAlert.replace('{accountId}', accountId);

          await showSyncAlert(
            t[currentLang].syncFailedTitle2,
            alertMsg,
            'warning'
          );
          return;
        }

        if (errMsg === 'connection_error' || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('TypeError') || errMsg.includes('timeout') || errMsg.includes('API 동기화 실패')) {
          await showSyncAlert(
            t[currentLang].serverConnectionErrorTitle,
            t[currentLang].serverConnectionErrorMsg,
            'error'
          );
          return;
        }

        const isSessionExpired = errMsg === 'session_expired' || errMsg === 'session_none' || errMsg.includes('세션이 만료되었습니다') || errMsg.includes('로그인이 필요합니다') || errMsg.includes('인증 세션이');

        await showSyncAlert(
          t[currentLang].syncFailedTitle2,
          isSessionExpired
            ? t[currentLang].loginTimeout
            : t[currentLang].syncFailedMsg2 + `\n(${errMsg})`,
          'error'
        );

        if (isSessionExpired) {
          await auth.logout();
          if (typeof window !== 'undefined') {
            goto('/');
          }
        }
      } finally {
        // [의무 뮤텍스 해제] 동기화 상태 비활성화 (성공/실패 여부와 무관하게 연동 완료 후 UI 상태 복구)
        isSyncing.set(false);
        syncAbortController.set(null);
        syncStepText.set('');
      }
    } else {
      // 2. 오프라인 모드: 4개 필수 마스터 엑셀 파일 자동 검색 및 일관적 드랍 후 인서트
      try {
        const confirmRes = await showSyncConfirm(
          t[currentLang].syncConfirmTitle,
          t[currentLang].syncConfirmMessage,
          'warning'
        );

        if (!confirmRes.confirmed) {
          return;
        }

        isSyncing.set(true);
        if (controller.signal.aborted) throw new Error('cancelled');

        syncStepText.set(t[currentLang].syncStepStoragePermission);
        // 저장소 권한 요청 및 확인
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          await showSyncAlert(
            t[currentLang].syncErrorTitle,
            t[currentLang].syncPermissionErrorMsg,
            'error'
          );
          return;
        }

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepSearchingExcel);

        // 각 접두사별 파일 목록 조회
        const inspectorFiles = await listExcelFiles("Inspector Info");
        const equipmentFiles = await listExcelFiles("Equipment Spec Info");
        const planFiles = await listExcelFiles("Inspection Plan");
        const stdsFiles = await listExcelFiles("Inspection Stds Info");

        // 만약 모든 파일이 다 누락되었다면 동기화 진행 불가 알림(경고) 표출
        if (inspectorFiles.length === 0 && equipmentFiles.length === 0 && planFiles.length === 0 && stdsFiles.length === 0) {
          await showSyncAlert(
            t[currentLang].syncWarningTitle,
            t[currentLang].syncNoExcelFilesMsg,
            'warning'
          );
          return;
        }

        let userCount: number | null = null;
        let eqCount: number | null = null;
        let planCount: number | null = null;
        let stdsCount: number | null = null;

        let deleteFailedCount = 0;
        let syncErrors: string[] = [];

        const isWeb = Capacitor.getPlatform() === 'web';

        let assetData: any[] = [];
        let planData: any[] = [];
        let standardData: any[] = [];
        let inspectors: any[] = [];
        let equipments: any[] = [];
        let plans: any[] = [];
        let stds: any[] = [];

        // A. 존재하는 엑셀 데이터 로드, 파싱 실행
        if (inspectorFiles.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            syncStepText.set(t[currentLang].syncStepParsingInspectors);
            const inspectorFile = inspectorFiles[0].filename;
            const inspectorBytes = await loadExcelFile(inspectorFile);
            inspectors = await parseInspectorInfo(inspectorBytes);
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspector parsing failed:", err);
            syncErrors.push(`${t[currentLang].syncStepParsingInspectors}: ${err.message}`);
          }
        }

        if (equipmentFiles.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            syncStepText.set(t[currentLang].syncStepParsingEquipments);
            const equipmentFile = equipmentFiles[0].filename;
            const equipmentBytes = await loadExcelFile(equipmentFile);
            equipments = await parseEquipmentSpec(equipmentBytes);
            assetData = uppercaseKeys(equipments);
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Equipment spec parsing failed:", err);
            syncErrors.push(`${t[currentLang].syncStepParsingEquipments}: ${err.message}`);
          }
        }

        if (planFiles.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            syncStepText.set(t[currentLang].syncStepParsingPlans);
            const planFile = planFiles[0].filename;
            const planBytes = await loadExcelFile(planFile);
            plans = await parseInspectionPlan(planBytes);
            planData = uppercaseKeys(plans);
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspection plan parsing failed:", err);
            syncErrors.push(`${t[currentLang].syncStepParsingPlans}: ${err.message}`);
          }
        }

        if (stdsFiles.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            syncStepText.set(t[currentLang].syncStepParsingStds);
            const stdsFile = stdsFiles[0].filename;
            const stdsBytes = await loadExcelFile(stdsFile);
            stds = await parseInspectionStds(stdsBytes);
            standardData = uppercaseKeys(stds);
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspection standards parsing failed:", err);
            syncErrors.push(`${t[currentLang].syncStepParsingStds}: ${err.message}`);
          }
        }

        // Print the log in the format requested by the user, matching API sync
        console.log('4. 데이터 수신 완료');
        console.log({ assetData, planData, standardData });

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepLocalDatabaseApply);

        // B. DB 반영 실행 및 파일 삭제
        if (inspectorFiles.length > 0 && inspectors.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            userCount = await dbService.importSet020(inspectors);
            if (userCount !== null && userCount !== undefined) {
              const syncDate = extractDateFromFilename(inspectorFiles[0].filename);
              await dbService.updateTableSyncDate('sync_date_user', syncDate);
            }
            if (!isWeb) {
              const deleted = await deleteExcelFile(inspectorFiles[0].filename);
              if (!deleted) deleteFailedCount++;
            }
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspector sync failed:", err);
            syncErrors.push(err.message);
          }
        }

        if (equipmentFiles.length > 0 && equipments.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            eqCount = await dbService.importStd120(equipments);
            if (eqCount !== null && eqCount !== undefined) {
              const syncDate = extractDateFromFilename(equipmentFiles[0].filename);
              await dbService.updateTableSyncDate('sync_date_equip', syncDate);
            }
            if (!isWeb) {
              const deleted = await deleteExcelFile(equipmentFiles[0].filename);
              if (!deleted) deleteFailedCount++;
            }
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Equipment spec sync failed:", err);
            syncErrors.push(err.message);
          }
        }

        if (planFiles.length > 0 && plans.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            planCount = await dbService.importStd130(plans, true);
            if (planCount !== null && planCount !== undefined) {
              const syncDate = extractDateFromFilename(planFiles[0].filename);
              await dbService.updateTableSyncDate('sync_date_plan', syncDate);
            }
            if (!isWeb) {
              const deleted = await deleteExcelFile(planFiles[0].filename);
              if (!deleted) deleteFailedCount++;
            }
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspection plan sync failed:", err);
            syncErrors.push(err.message);
          }
        }

        if (stdsFiles.length > 0 && stds.length > 0) {
          try {
            if (controller.signal.aborted) throw new Error('cancelled');
            stdsCount = await dbService.importStd110(stds);
            if (stdsCount !== null && stdsCount !== undefined) {
              const syncDate = extractDateFromFilename(stdsFiles[0].filename);
              await dbService.updateTableSyncDate('sync_date_std', syncDate);
            }
            if (!isWeb) {
              const deleted = await deleteExcelFile(stdsFiles[0].filename);
              if (!deleted) deleteFailedCount++;
            }
          } catch (err: any) {
            if (err.message === 'cancelled' || err.name === 'AbortError') throw err;
            console.error("Inspection standards sync failed:", err);
            syncErrors.push(err.message);
          }
        }


        // 결과 항목 포맷 생성
        const getStatusText = (count: number | null, successLabel: string) => {
          if (count === null) {
            return currentLang === 'es' ? 'Falta (omitido)' : '누락 (건너뜀)';
          }
          return successLabel;
        };

        const inspectorStatus = getStatusText(userCount, t[currentLang].unitUsers.replace('{count}', String(userCount)));
        const equipmentStatus = getStatusText(eqCount, t[currentLang].unitEquipments.replace('{count}', String(eqCount)));
        const planStatus = getStatusText(planCount, t[currentLang].unitPlans.replace('{count}', String(planCount)));
        const stdsStatus = getStatusText(stdsCount, t[currentLang].unitStandards.replace('{count}', String(stdsCount)));

        const deleteWarning = deleteFailedCount > 0
          ? t[currentLang].syncDeleteFailedWarning.replace('{count}', String(deleteFailedCount))
          : '';

        let alertTitle = t[currentLang].syncCompleteTitle;
        let alertIcon: 'success' | 'warning' = 'success';
        let alertMsg = t[currentLang].syncOfflineCompleteMsg
          .replace('{inspectorStatus}', inspectorStatus)
          .replace('{equipmentStatus}', equipmentStatus)
          .replace('{planStatus}', planStatus)
          .replace('{stdsStatus}', stdsStatus)
          .replace('{deleteWarning}', deleteWarning);

        if (syncErrors.length > 0) {
          alertTitle = currentLang === 'es'
            ? 'Sincronización completada (con advertencias)'
            : '동기화 완료 (일부 오류 발생)';
          alertIcon = 'warning';

          const errorDetailsHeader = currentLang === 'es' ? '\n\n[Detalles del error]' : '\n\n[오류 상세 정보]';
          alertMsg += errorDetailsHeader + '\n' + syncErrors.map(e => `• ${e}`).join('\n');
        }

        await showSyncAlert(
          alertTitle,
          alertMsg,
          alertIcon
        );

      } catch (e: any) {
        if (e.name === 'AbortError' || e.message === 'cancelled') {
          console.log('Sync cancelled by user.');
          return;
        }
        console.error("Offline bulk sync failed:", e);
        await showSyncAlert(
          t[currentLang].syncErrorTitle,
          t[currentLang].syncOfflineFailedMsg.replace('{message}', (e as Error).message),
          'error'
        );
      } finally {
        isSyncing.set(false);
        syncAbortController.set(null);
        syncStepText.set('');
      }
    }
  }

  /**
   * 단일 사용자 정보 파일 적용을 위한 하위 호환성용 메서드입니다.
   */
  async function applySelectedExcel() {
    const filename = get(selectedExcelFilename);
    if (!filename) return;

    isExcelPickerOpen.set(false);
    isSyncing.set(true);

    const currentLang = get(lang);

    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        await showSyncAlert(
          t[currentLang].syncErrorTitle,
          t[currentLang].syncPermissionErrorMsg,
          'error'
        );
        return;
      }

      const bytes = await loadExcelFile(filename);
      const importedUsers = await parseInspectorInfo(bytes);
      const importedCount = await dbService.importSet020(importedUsers);
      const deleted = await deleteExcelFile(filename);

      const deleteWarning = !deleted
        ? t[currentLang].syncSingleDeleteFailedWarning
        : '';

      await showSyncAlert(
        t[currentLang].syncCompleteTitle,
        t[currentLang].syncImportSuccessMsg
          .replace('{filename}', filename)
          .replace('{count}', String(importedCount))
          .replace('{deleteWarning}', deleteWarning),
        'success'
      );
    } catch (e) {
      console.error("Excel import failed:", e);
      await showSyncAlert(
        t[currentLang].syncErrorTitle,
        t[currentLang].syncImportFailedMsg.replace('{message}', (e as Error).message),
        'error'
      );
    } finally {
      isSyncing.set(false);
    }
  }

  async function debugSyncApis() {
    console.log('[Sync Debug] Starting API debug fetch...');
    try {
      const config = await dbService.getConfig();
      if (!config) throw new Error('No config found');

      const user = await dbService.getUserInfo();
      const accToken = user?.accToken;
      if (!accToken) throw new Error('No access token. Please login online first.');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accToken}`,
        'Accept': 'application/json'
      };

      const empId = user.empId;
      const facGbn = user.companyId ? user.companyId.replace('POSAR', '') : '';
      const uploProcGbn = user.uploProcGbn;

      // 설정 테이블 직접 조회 (테이블 미존재 시 방어 처리)
      let rawConfig: any = {};
      try {
        const rawConfigRes = await dbService.query('SELECT * FROM tb_mob_set010 LIMIT 1');
        rawConfig = rawConfigRes.values?.[0] || {};
      } catch (e) {
        console.warn('[Sync] tb_mob_set010 조회 실패. 동기화 날짜 없이 진행:', e);
      }
      const formatSyncDate = (dateVal: any) => {
        if (!dateVal) return '';
        return String(dateVal).replace(/[-/]/g, '').trim();
      };
      const syncDateEquip = formatSyncDate(rawConfig.sync_date_equip);
      const syncDatePlan = formatSyncDate(rawConfig.sync_date_plan);
      const syncDateStd = formatSyncDate(rawConfig.sync_date_std);

      const baseUrl = config.baseUrl.trim();
      const apiStdsUri = config.std01Api.trim();
      const apiAssetsUri = config.std02Api.trim();
      const apiPlansUri = config.std03Api.trim();

      console.log('[Sync Debug] Calling getAssetData...');
      const assetData = await getAssetData(headers, combineUrl(baseUrl, apiAssetsUri), facGbn, uploProcGbn, syncDateEquip);
      console.log('[Sync Debug] getAssetData Result:', assetData);

      console.log('[Sync Debug] Calling getPlanData...');
      const planData = await getPlanData(headers, combineUrl(baseUrl, apiPlansUri), facGbn, uploProcGbn, empId, '', '');
      console.log('[Sync Debug] getPlanData Result:', planData);

      console.log('[Sync Debug] Calling getStandardData...');
      const standardData = await getStandardData(headers, combineUrl(baseUrl, apiStdsUri), facGbn, syncDateStd);
      console.log('[Sync Debug] getStandardData Result:', standardData);

      alert('API 디버그 호출 완료! 콘솔 로그를 확인하세요.');
    } catch (err) {
      console.error('[Sync Debug] API fetch failed:', err);
      alert(`디버그 호출 실패: ${(err as Error).message}`);
    }
  }

  async function transmitResults() {
    if (get(isSyncing) || get(isTransmitting)) return;

    const online = get(isOnline);
    const currentLang = get(lang);

    const controller = new AbortController();
    syncAbortController.set(controller);

    try {
      isTransmitting.set(true);

      // 1. 온라인 모드일 경우 인증 세션 검사를 최우선 수행 (ADMIN/DEV 계정 경고 메시지 우선 출력)
      let activeToken = "";
      if (online) {
        syncStepText.set(t[currentLang].syncStepVerifyingSession);
        try {
          activeToken = await ensureValidSession();
        } catch (authErr: any) {
          if (authErr.message === 'connection_error' || authErr.message?.startsWith('admin_dev_account:')) {
            throw authErr;
          }
          throw new Error(t[currentLang].syncSessionInvalidOrExpired);
        }
      }

      syncStepText.set(t[currentLang].syncStepQueryingLogs);

      const user = await dbService.getUserInfo();
      const empId = user?.id || '';
      const facGbn = user?.fac_gbn || '';
      const uploProcGbn = user?.uploProcGbn || '';

      // 사용자 ID가 없는 경우 로그인 안되어있는것으로 간주하여 에러처리
      if (!empId) { throw new Error(t[currentLang].syncLoginRequired); }

      // 2. 온/오프라인 모드 관계없이 전송되지 않은(N이거나 NULL) 실적만 쿼리
      let records = await dbService.getTransmitRecords({
        empId,
        facGbn,
        uploProcGbn,
        onlyUnsent: true
      });

      // 3. 미전송 실적 건수가 존재하는 경우 전송 여부 컨펌
      if (records.length > 0) {
        isTransmitting.set(false);
        const confirmRes = await showSyncConfirm(
          t[currentLang].transmitConfirmTitle,
          online
            ? `점검 완료된 미보고 실적 총 ${records.length}건을 온라인으로 전송하시겠습니까?`
            : `점검 완료된 미보고 실적 총 ${records.length}건을 엑셀 파일로 내보내시겠습니까?`
        );
        isTransmitting.set(true);

        if (!confirmRes.confirmed) {
          isTransmitting.set(false);
          return;
        }
      } else {
        // 3-B. 미전송 실적 보고 건수가 0일 경우
        isTransmitting.set(false);
        const confirmRes = await showSyncConfirm(
          t[currentLang].syncNoUnreportedConfirmTitle,
          online
            ? t[currentLang].syncNoUnreportedConfirmMsgOnline
            : t[currentLang].syncNoUnreportedConfirmMsgOffline
        );
        isTransmitting.set(true);

        if (confirmRes.confirmed) {
          const todayStr = toLocalDateString().replace(/-/g, '');
          records = await dbService.getTransmitRecords({
            empId,
            facGbn,
            uploProcGbn,
            minPlanDay: todayStr
          });
        } else {
          isTransmitting.set(false);
          return;
        }
      }

      if (records.length === 0) {
        isTransmitting.set(false);
        await showSyncAlert(
          t[currentLang].syncNoDataTitle,
          t[currentLang].syncNoDataMsg,
          'success'
        );
        return;
      }

      if (controller.signal.aborted) throw new Error('cancelled');

      // 4. 온/오프라인 여부에 따른 최종 송출 방식 분기
      if (online) {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`,
          'Accept': 'application/json'
        };

        const registTimestamp = Date.now();

        const uppercaseRecords = records.map((rec: any) => {
          const cleanRec = { ...rec };
          delete cleanRec.send_flag;
          delete cleanRec.rowid;

          const uppercaseRec: Record<string, any> = {};
          for (const key of Object.keys(cleanRec)) {
            uppercaseRec[key.toUpperCase()] = cleanRec[key] === null ? "" : cleanRec[key];
          }

          uppercaseRec.RSLT_REGIST_DTM = registTimestamp;
          uppercaseRec.CHK_REF = rec.chk_ref || uppercaseRec.CHK_REF || "";
          uppercaseRec.JQX_CB = "";

          return uppercaseRec;
        });

        const payload = {
          "EAMS101014_INSP_GRID": uppercaseRecords
        };

        const config = await dbService.getConfig();

        // api 서버 URL 값이 없을 경우 에러처리
        if (!config || !config.baseUrl) { throw new Error(t[currentLang].syncMissingUrl); }

        // 실적 송신 API URI 값이 없을 경우 에러처리
        if (!config.rst01Api) { throw new Error(t[currentLang].syncMissingRstApi); }
        const rst01Api = config.rst01Api.trim();
        const baseUrl = config.baseUrl.trim();

        const targetUrl = baseUrl.endsWith('/') && rst01Api.startsWith('/')
          ? `${baseUrl.slice(0, -1)}${rst01Api}`
          : `${baseUrl}${rst01Api}`;

        console.log('3. 데이터 요청...');
        console.log(payload);

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepTransmitting);

        const response = await fetchWithTimeout(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
          timeout: 0
        });

        if (!response.ok) {
          throw new Error(currentLang === 'es'
            ? `Error del servidor (HTTP ${response.status})`
            : `서버 통신 에러 (HTTP ${response.status})`);
        }

        const resJSON = await response.json();
        console.log('4. 데이터 수신 완료');
        console.log('[Sync Store] Transmit API response:', resJSON);

        // [API 통신 결과 검증] RESULT_MESSAGE가 SUCCESS가 아닐 경우 실패로 간주하여 로컬 DB 업데이트를 차단하고 에러 모달 노출
        if (!resJSON || resJSON.RESULT_MESSAGE !== 'SUCCESS') {
          await showSyncAlert(
            t[currentLang].syncErrorTitle,
            t[currentLang].syncFailGeneric,
            'error'
          );
          return;
        }

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepUpdatingLogs);

        console.log('5. db 업데이트');
        for (const rec of records) {
          await dbService.run(
            "UPDATE tb_mob_rst130 SET send_flag = 'Y' WHERE chk_action_no = ? AND chk_ordinal = ? AND asset_id = ? AND chk_fmt = ? AND chk_item = ?",
            [rec.chk_action_no, rec.chk_ordinal, rec.asset_id, rec.chk_fmt, rec.chk_item]
          );
        }

        // 1년 이상 경과한 실적 데이터 자동 청소
        try {
          await dbService.purgeOldRecords();
        } catch (purgeErr) {
          console.error('[Sync Purge Error] Failed to purge old records:', purgeErr);
        }

        // 웹 브라우저 환경(Wasm SQLite)에서는 변경된 메모리 데이터를 IndexedDB 물리 디스크로 동기화(Flush)해야 브라우저 새로고침 시 유실되지 않음.
        if (Capacitor.getPlatform() === 'web') { await dbService.saveToStoreWeb(); }

        await showSyncAlert(
          t[currentLang].transmitCompleteTitle,
          t[currentLang].syncTransmitSuccessMsg.replace('{count}', String(records.length)),
          'success'
        );
      } else {
        syncStepText.set(t[currentLang].syncStepStoragePermission);


        // 저장소 접근권한 파악 및 접근권한 에러 시 예외처리
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) { throw new Error(t[currentLang].syncPermissionDenied); }

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepGeneratingExcel);

        // 엑셀파일 헤더 정의 (Import parseInspectionPlan 양식과 일치하는 32개 컬럼)
        const headers = [
          "설비번호", "주기구분명", "점검활동일", "점검순서", "점검형식명",
          "점검항목명", "점검단위명", "점검항목단위", "점검하한", "점검기준",
          "점검상한", "점검자명", "점검실적명", "데이터입력방법", "점검시작일시",
          "점검종료일시", "측정값", "특이사항", "점검구분명", "점검활동 NO",
          "점검차수", "점검상세", "점검구분", "주기구분", "점검형식",
          "점검항목", "점검단위", "점검자ID", "점검실적", "작업구분",
          "공장구분", "상하공정구분"
        ];

        const rows = records.map((row: any) => [
          row.asset_id || '',
          row.cycle_gbn_nm || '',
          row.chk_plan_day || '',
          row.chk_serno || '',
          row.chk_fmt_nm || '',
          row.chk_item_nm || '',
          row.chk_unit_nm || '',
          row.chk_item_unit || '',
          row.chk_ll || '',
          row.chk_ref || '',
          row.chk_ul || '',
          row.directnm_emp_nm || '',
          row.chk_rslt_nm || '',
          '', // 데이터입력방법 (DB 필드 없으므로 빈값)
          row.chk_sta_dtm || '',
          row.chk_end_dtm || '',
          row.mea_val || '',
          row.special_note || '',
          row.chk_gbn_nm || '',
          row.chk_action_no || '',
          row.chk_ordinal || '',
          row.chk_dtl || '',
          row.chk_gbn || '',
          row.cycle_gbn || '',
          row.chk_fmt || '',
          row.chk_item || '',
          row.chk_unit || '',
          row.directnm_emp_no || '',
          row.chk_rslt || '',
          row.chk_work_gbn || '',
          row.fac_gbn || '',
          row.uplo_proc_gbn || ''
        ]);

        const timestamp = Date.now();
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inspection Result");

        const filename = `Inspection Result${timestamp}.xlsx`;
        const isWeb = Capacitor.getPlatform() === 'web';
        const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepSavingExcel);

        if (isWeb) {
          // 웹브라우저일 시 excel 데이터 동기화 테스트를 위한 코드
          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);

          // B. POST to mock server to write to disk
          const response = await fetch('/api/excel-files/receive', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              filename,
              data: excelBase64
            })
          });

          if (!response.ok) {
            console.warn('[Sync Store] Failed to save copy on local mock server:', response.statusText);
          }
        } else {
          // Native Capacitor: create mkdir if not exists, then write file
          const dirPath = 'Download/receive';
          try {
            await Filesystem.mkdir({
              path: dirPath,
              directory: Directory.ExternalStorage,
              recursive: true
            });
          } catch (mkdirErr) {
            console.log('[Sync Store] Directory already exists or creation skipped:', mkdirErr);
          }

          await Filesystem.writeFile({
            path: `${dirPath}/${filename}`,
            data: excelBase64,
            directory: Directory.ExternalStorage
          });
        }

        if (controller.signal.aborted) throw new Error('cancelled');
        syncStepText.set(t[currentLang].syncStepUpdatingLogs);

        // 5. Update local database send_flag = 'Y'
        for (const rec of records) {
          await dbService.run(
            "UPDATE tb_mob_rst130 SET send_flag = 'Y' WHERE chk_action_no = ? AND chk_ordinal = ? AND asset_id = ? AND chk_fmt = ? AND chk_item = ?",
            [rec.chk_action_no, rec.chk_ordinal, rec.asset_id, rec.chk_fmt, rec.chk_item]
          );
        }

        // 1년 이상 경과한 실적 데이터 자동 청소
        try {
          await dbService.purgeOldRecords();
        } catch (purgeErr) {
          console.error('[Sync Purge Error] Failed to purge old records:', purgeErr);
        }

        // Save state to IndexedDB on web
        if (isWeb) {
          await dbService.saveToStoreWeb();
        }

        await showSyncAlert(
          online
            ? t[currentLang].transmitCompleteTitle
            : t[currentLang].exportCompleteTitle,
          t[currentLang].syncExportSuccessMsg
            .replace('{count}', String(records.length))
            .replace('{filename}', filename),
          'success'
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'cancelled') {
        console.log('Transmit cancelled by user.');
        return;
      }
      console.error("[Sync Store] transmitResults error:", err);
      const errMsg = err.message || '';

      if (errMsg === 'connection_error' || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('TypeError') || errMsg.includes('timeout') || errMsg.includes('서버 통신 에러')) {
        await showSyncAlert(
          t[currentLang].serverConnectionErrorTitle,
          t[currentLang].serverConnectionErrorMsg,
          'error'
        );
        return;
      }

      if (errMsg.startsWith('admin_dev_account:')) {
        const accountId = errMsg.split(':')[1] || 'ADMIN';
        const alertMsg = t[currentLang].adminDevAccountAlert.replace('{accountId}', accountId);

        await showSyncAlert(
          t[currentLang].transmitFailedTitle,
          alertMsg,
          'warning'
        );
        return;
      }

      const isSessionExpired = errMsg === 'session_expired' || errMsg === 'session_none' || errMsg.includes('세션이 만료되었습니다') || errMsg.includes('로그인이 필요합니다') || errMsg.includes('인증 세션이');

      await showSyncAlert(
        online
          ? t[currentLang].transmitFailedTitle
          : t[currentLang].exportFailedTitle,
        isSessionExpired
          ? t[currentLang].loginTimeout
          : errMsg || "Unknown error",
        'error'
      );

      if (isSessionExpired) {
        await auth.logout();
        if (typeof window !== 'undefined') {
          goto('/');
        }
      }
    } finally {
      isTransmitting.set(false);
      syncAbortController.set(null);
      syncStepText.set('');
    }
  }

  /**
   * 점검 실적 저장 후 조건(온라인 모드 & autoSendYn === 'Y')에 맞는 경우 자동 실적 송신 수행
   */
  async function autoTransmitResultsSilent(): Promise<boolean> {
    const online = get(isOnline);
    const currentSettings = get(settings);

    // 온라인 상태가 아니거나 자동전송 설정이 Y가 아니면 스킵
    if (!online || currentSettings.autoSendYn !== 'Y') {
      return false;
    }

    // 다른 동기화/전송 작업이 진행 중이면 스킵
    if (get(isSyncing) || get(isTransmitting)) {
      return false;
    }

    try {
      console.log('[Auto Transmit] 온라인 자동 실적 송신 조건 충족: API 수신 시도 시작...');
      isTransmitting.set(true);

      const activeToken = await ensureValidSession();
      const user = await dbService.getUserInfo();
      const empId = user?.id || '';
      const facGbn = user?.fac_gbn || '';
      const uploProcGbn = user?.uploProcGbn || '';

      if (!empId) {
        console.warn('[Auto Transmit] 사용자 세션 사번이 없어 자동 송신을 취소합니다.');
        return false;
      }

      // 미전송(send_flag = 'N' 또는 NULL) 실적 레코드 조회
      let records = await dbService.getTransmitRecords({
        empId,
        facGbn,
        uploProcGbn,
        onlyUnsent: true
      });

      if (!records || records.length === 0) {
        records = await dbService.getTransmitRecords({
          empId,
          facGbn,
          uploProcGbn,
          onlyUnsent: true
        });
      }

      console.log('[Auto Transmit] Found unsent records count:', records?.length || 0);

      if (!records || records.length === 0) {
        console.log('[Auto Transmit] 자동 전송할 미제출 실적 건수가 0건입니다.');
        return false;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json'
      };

      const registTimestamp = Date.now();
      const uppercaseRecords = records.map((rec: any) => {
        const cleanRec = { ...rec };
        delete cleanRec.send_flag;
        delete cleanRec.rowid;

        const uppercaseRec: Record<string, any> = {};
        for (const key of Object.keys(cleanRec)) {
          uppercaseRec[key.toUpperCase()] = cleanRec[key] === null ? "" : cleanRec[key];
        }

        uppercaseRec.RSLT_REGIST_DTM = registTimestamp;
        uppercaseRec.CHK_REF = rec.chk_ref || uppercaseRec.CHK_REF || "";
        uppercaseRec.JQX_CB = "";
        return uppercaseRec;
      });

      const payload = {
        "EAMS101014_INSP_GRID": uppercaseRecords
      };

      const config = await dbService.getConfig();
      if (!config || !config.baseUrl || !config.rst01Api) return false;

      const rst01Api = config.rst01Api.trim();
      const baseUrl = config.baseUrl.trim();
      const targetUrl = baseUrl.endsWith('/') && rst01Api.startsWith('/')
        ? `${baseUrl.slice(0, -1)}${rst01Api}`
        : `${baseUrl}${rst01Api}`;

      console.log('[Auto Transmit] Sending payload to API:', payload);

      const response = await fetchWithTimeout(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (response.ok) {
        const resJSON = await response.json();
        console.log('[Auto Transmit] API Response:', resJSON);

        if (resJSON && resJSON.RESULT_MESSAGE === 'SUCCESS') {
          for (const rec of records) {
            await dbService.run(
              "UPDATE tb_mob_rst130 SET send_flag = 'Y' WHERE chk_action_no = ? AND chk_ordinal = ? AND asset_id = ? AND chk_fmt = ? AND chk_item = ?",
              [rec.chk_action_no, rec.chk_ordinal, rec.asset_id, rec.chk_fmt, rec.chk_item]
            );
          }
          await dbService.saveToStoreWeb();
          console.log('[Auto Transmit] 실적 자동 전송 완료! DB send_flag = Y 동기화 성공.');
          await showToast(get(lang) === 'es' ? 'Los resultados se enviaron automáticamente al servidor.' : '실적이 서버로 자동 전송되었습니다.');
          return true;
        } else {
          // 비즈니스 응답 에러 발생 시 경고 모달 노출
          await showSyncAlert(
            t[get(lang)].autoTransmitFailTitle,
            t[get(lang)].autoTransmitFailMsg,
            'error'
          );
        }
      } else {
        // HTTP 통신 실패 시 경고 모달 노출
        await showSyncAlert(
          t[get(lang)].autoTransmitFailTitle,
          t[get(lang)].autoTransmitFailMsg,
          'error'
        );
      }
    } catch (autoErr) {
      console.error('[Auto Transmit] 자동 실적 전송 처리 중 오류 발생:', autoErr);
      await showSyncAlert(
        t[get(lang)].autoTransmitFailTitle,
        t[get(lang)].autoTransmitFailMsg,
        'error'
      );
    } finally {
      isTransmitting.set(false);
    }
    return false;
  }

  /**
   * 점검 저장 시 이미 완성된 실적 JSON 레코드 배열을 받아 직접 온라인 API로 제출합니다.
   */
  async function submitDirectPayload(payloadRecords: any[]): Promise<boolean> {
    if (!payloadRecords || payloadRecords.length === 0) return false;

    try {
      isTransmitting.set(true);

      const activeToken = await ensureValidSession();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json'
      };

      const payload = {
        "EAMS101014_INSP_GRID": payloadRecords
      };

      const config = await dbService.getConfig();
      if (!config || !config.baseUrl || !config.rst01Api) return false;

      const rst01Api = config.rst01Api.trim();
      const baseUrl = config.baseUrl.trim();
      const targetUrl = baseUrl.endsWith('/') && rst01Api.startsWith('/')
        ? `${baseUrl.slice(0, -1)}${rst01Api}`
        : `${baseUrl}${rst01Api}`;

      console.log('[Auto Transmit] Directly submitting payload to API:', payload);

      const response = await fetchWithTimeout(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (response.ok) {
        const resJSON = await response.json();
        console.log('[Auto Transmit] Direct Payload API Response:', resJSON);

        if (resJSON && resJSON.RESULT_MESSAGE === 'SUCCESS') {
          await showToast(get(lang) === 'es' ? 'Los resultados se enviaron automáticamente al servidor.' : '실적이 서버로 자동 전송되었습니다.');
          return true;
        } else {
          await showSyncAlert(
            t[get(lang)].autoTransmitFailTitle,
            t[get(lang)].autoTransmitFailMsg,
            'error'
          );
        }
      } else {
        await showSyncAlert(
          t[get(lang)].autoTransmitFailTitle,
          t[get(lang)].autoTransmitFailMsg,
          'error'
        );
      }
    } catch (err) {
      console.error('[Auto Transmit] submitDirectPayload failed:', err);
      await showSyncAlert(
        t[get(lang)].autoTransmitFailTitle,
        t[get(lang)].autoTransmitFailMsg,
        'error'
      );
    } finally {
      isTransmitting.set(false);
    }
    return false;
  }

  return {
    isSyncing: { subscribe: isSyncing.subscribe },
    isTransmitting: { subscribe: isTransmitting.subscribe },
    isExcelPickerOpen,
    excelFiles: { subscribe: excelFiles.subscribe },
    selectedExcelFilename,
    triggerSync,
    transmitResults,
    submitDirectPayload,
    autoTransmitResultsSilent,
    applySelectedExcel,
    debugSyncApis,
    syncStepText: { subscribe: syncStepText.subscribe },
    syncAbortController: { subscribe: syncAbortController.subscribe, set: syncAbortController.set },

    // [보안 프리미엄 전역 알림 노출]
    syncAlertOpen: { subscribe: syncAlertOpen.subscribe, set: syncAlertOpen.set },
    syncAlertTitle: { subscribe: syncAlertTitle.subscribe },
    syncAlertMessage: { subscribe: syncAlertMessage.subscribe },
    syncAlertType: { subscribe: syncAlertType.subscribe },
    syncProgressValue: { subscribe: syncProgressValue.subscribe, set: syncProgressValue.set },
    showSyncAlert,

    // [프리미엄 전역 예/아니오 컨펌 노출]
    syncConfirmOpen: { subscribe: syncConfirmOpen.subscribe, set: syncConfirmOpen.set },
    syncConfirmTitle: { subscribe: syncConfirmTitle.subscribe },
    syncConfirmMessage: { subscribe: syncConfirmMessage.subscribe },
    syncConfirmType: { subscribe: syncConfirmType.subscribe },
    syncConfirmResult: { subscribe: syncConfirmResult.subscribe, set: syncConfirmResult.set },
    syncConfirmShowDateRange: { subscribe: syncConfirmShowDateRange.subscribe },
    syncPlanFromDt: { subscribe: syncPlanFromDt.subscribe, set: syncPlanFromDt.set },
    syncPlanToDt: { subscribe: syncPlanToDt.subscribe, set: syncPlanToDt.set },
    showSyncConfirm
  };
}

export const syncStore = createSyncStore();

/**
 * 엑셀 파일명에서 Unix 타임스탬프 숫자를 정규식으로 파싱하여 YYYYMMDD 날짜 형식으로 변환합니다.
 */
function extractDateFromFilename(filename: string): string {
  const match = filename.match(/\d+/);
  if (match) {
    const timestamp = parseInt(match[0], 10);
    if (!isNaN(timestamp) && timestamp > 0) {
      const date = new Date(timestamp);
      return toLocalDateString(date).replace(/-/g, '');
    }
  }
  return toLocalDateString().replace(/-/g, '');
}


function lowercaseKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(lowercaseKeys);

  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key.toLowerCase()] = lowercaseKeys(obj[key]);
  }
  return result;
}

function uppercaseKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(uppercaseKeys);

  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key.toUpperCase()] = uppercaseKeys(obj[key]);
  }
  return result;
}

function combineUrl(baseUrl: string, apiUri: string): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanUri = apiUri.startsWith('/') ? apiUri : `/${apiUri}`;
  return `${cleanBase}${cleanUri}`;
}

async function syncData(signal?: AbortSignal, onProgress?: (text: string) => void, fromDt: string = '', toDt: string = '') {
  const currentLang = get(lang);
  // 1. tb_mob_set010 테이블에서 로컬로 등록 보존 중인 서버 API 및 Base URL 로드
  const config = await dbService.getConfig();
  if (!config) { throw new Error(t[currentLang].syncNoConfig); }

  // 2. API URL 설정 여부 검증
  if (!config.baseUrl) { throw new Error(t[currentLang].syncMissingBaseUrl); }
  if (!config.userApi) throw new Error(t[currentLang].syncMissingUserApi);
  if (!config.std01Api) throw new Error(t[currentLang].syncMissingStd01Api);
  if (!config.std02Api) throw new Error(t[currentLang].syncMissingStd02Api);
  if (!config.std03Api) throw new Error(t[currentLang].syncMissingStd03Api);

  const baseUrl = config.baseUrl.trim();
  const apiUsersUri = config.userApi.trim();
  const apiStdsUri = config.std01Api.trim();
  const apiAssetsUri = config.std02Api.trim();
  const apiPlansUri = config.std03Api.trim();

  // 3. 온라인 로그인 검증 및 토큰 자동 갱신
  console.log(`[DB Service] Targeted server URL: ${baseUrl}`);

  if (onProgress) onProgress(t[currentLang].syncStepVerifyingSession);

  let activeToken = "";
  try {
    activeToken = await ensureValidSession();
  } catch (authErr: any) {
    throw new Error(authErr.message || t[currentLang].syncSessionInvalidOrExpired);
  }

  // 엎어씌워진 최신 사용자 정보 획득
  const user = await dbService.getUserInfo();
  const empId = user?.id || '';
  const facGbn = user?.companyId ? user.companyId.replace('POSAR', '') : '';
  const uploProcGbn = user?.uploProcGbn || '';

  // 통신 시 헤더에 Bearer 토큰 주입 세팅
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${activeToken}`,
    'Accept': 'application/json'
  };

  // 설정값 테이블에서 각 API 동기화 날짜 로드 (테이블 미존재 시 방어 처리)
  let rawConfig: any = {};
  try {
    const rawConfigRes = await dbService.query('SELECT * FROM tb_mob_set010 LIMIT 1');
    rawConfig = rawConfigRes.values?.[0] || {};
  } catch (e) {
    console.warn('[Sync] tb_mob_set010 조회 실패. 동기화 날짜 없이 진행:', e);
  }
  const formatSyncDate = (dateVal: any) => {
    if (!dateVal) return '';
    return String(dateVal).replace(/[-/]/g, '').trim();
  };
  const syncDateEquip = formatSyncDate(rawConfig.sync_date_equip);
  const syncDateStd = formatSyncDate(rawConfig.sync_date_std);

  try {
    // A. 4대 마스터 REST API 일괄 병렬 동기화 (Promise.all로 병렬 극대화)
    console.log('3. 데이터 요청...');
    console.log({
      apiAssetsUri: combineUrl(baseUrl, apiAssetsUri),
      apiPlansUri: combineUrl(baseUrl, apiPlansUri),
      apiStdsUri: combineUrl(baseUrl, apiStdsUri)
    });
    if (onProgress) onProgress(t[currentLang].syncStepRequestingServer);
    const [assetData, planData, standardData] = await Promise.all([
      getAssetData(headers, combineUrl(baseUrl, apiAssetsUri), facGbn, "", syncDateEquip, signal),
      getPlanData(headers, combineUrl(baseUrl, apiPlansUri), facGbn, uploProcGbn, empId, fromDt, toDt, signal),
      getStandardData(headers, combineUrl(baseUrl, apiStdsUri), facGbn, syncDateStd, signal)
    ]);

    console.log('4. 데이터 수신 완료');
    console.log({ assetData, planData, standardData });

    if (signal?.aborted) throw new Error('cancelled');
    if (onProgress) onProgress(t[currentLang].syncStepUpdatingLogs);

    // B. 정제된 데이터를 SQLite 로컬 테이블에 신속 적재 및 성공 시 날짜 갱신
    console.log('5. db 업데이트');
    const apiDateStr = toLocalDateString().replace(/-/g, '');

    let eqCount = 0;
    let planCount = 0;
    let stdsCount = 0;

    // B-1. 설비 사양 정보(Std120) 반영 및 동기화 날짜 갱신
    try {
      if (signal?.aborted) throw new Error('cancelled');
      if (onProgress) onProgress(t[currentLang].syncStepImportingEquipments);
      eqCount = await dbService.importStd120(lowercaseKeys(assetData), true);
      await dbService.updateTableSyncDate('sync_date_equip', apiDateStr);
    } catch (e: any) {
      if (e.message === 'cancelled') throw e;
      console.error('[Sync] Asset data import failed:', e);
    }

    // B-2. 설비 점검 계획(Std130) 반영 및 동기화 날짜 갱신
    try {
      if (signal?.aborted) throw new Error('cancelled');
      if (onProgress) onProgress(t[currentLang].syncStepImportingPlans);
      planCount = await dbService.importStd130(lowercaseKeys(planData), true);
      await dbService.updateTableSyncDate('sync_date_plan', apiDateStr);
    } catch (e: any) {
      if (e.message === 'cancelled') throw e;
      console.error('[Sync] Plan data import failed:', e);
    }

    // B-3. 점검 표준 정보(Std110) 반영 및 동기화 날짜 갱신
    try {
      if (signal?.aborted) throw new Error('cancelled');
      if (onProgress) onProgress(t[currentLang].syncStepImportingStds);
      stdsCount = await dbService.importStd110(lowercaseKeys(standardData), true);
      await dbService.updateTableSyncDate('sync_date_std', apiDateStr);
    } catch (e: any) {
      if (e.message === 'cancelled') throw e;
      console.error('[Sync] Standard data import failed:', e);
    }

    console.log(`동기화 완료: 설비 ${eqCount}건, 계획 ${planCount}건, 점검기준 ${stdsCount}건`);

    return {
      eqCount,
      planCount,
      stdsCount
    };
  } catch (err) {
    console.error('[DB Service] REST API online sync crash:', err);
    throw err;
  }
}

// 설비정보 가져오기
async function getAssetData(headers: any, url: string, facGbn: string, uploProcGbn: string, syncDate: string, signal?: AbortSignal) {
  const params: Record<string, string> = {
    FAC_GBN: facGbn || '',
    UPLO_PROC_GBN: uploProcGbn || '',
    ASSET_ID: ''
  };
  if (syncDate) {
    params.CRT_TM = syncDate;
  }

  const apiUrl = `${url}?${new URLSearchParams(params).toString()}`;
  const response = await fetchWithTimeout(apiUrl, { headers, signal, timeout: 0 });
  // API 응답 에러 시 설비 사양 정보 동기화 실패 예외를 던집니다.
  if (!response.ok) {
    throw new Error(t[get(lang)].syncEquipApiFailed.replace('{status}', String(response.status)));
  }

  const resJSON = await response.json();
  return resJSON.RESULT_DATA || [];
}

// 설비점검계획 가져오기
async function getPlanData(headers: any, url: string, facGbn: string, uploProcGbn: string, empId: string, fromDt: string, toDt: string, signal?: AbortSignal) {
  /**
   * FAC_GBN    : 공장구분
   * UPLO_PROC_GBN : 상하공정구분
   * PLAN_DT : 점검계획일자
   * DIRECTNM_EMP_NO : 점검담당자 ID  
   * FROM_DT : 조회 시작일자 (YYYYMMDD)
   * TO_DT : 조회 종료일자 (YYYYMMDD)
   */
  let cleanFromDt = fromDt ? fromDt.replace(/[-/]/g, '').trim() : toLocalDateString().replace(/-/g, '');
  let cleanToDt = toDt ? toDt.replace(/[-/]/g, '').trim() : cleanFromDt;

  // 1차 방어: 시작일이 종료일보다 늦을 경우 종료일로 보정
  if (cleanFromDt > cleanToDt) {
    cleanFromDt = cleanToDt;
  }

  // 2차 방어: 시작일이 종료일 기준 1개월(약 31일)보다 이전일 경우 1개월 전으로 보정
  if (cleanFromDt && cleanToDt) {
    const toDate = new Date(cleanToDt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    const fromDate = new Date(cleanFromDt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    if (!isNaN(toDate.getTime()) && !isNaN(fromDate.getTime())) {
      const minDate = new Date(toDate);
      minDate.setMonth(minDate.getMonth() - 1);
      if (fromDate < minDate) {
        cleanFromDt = toLocalDateString(minDate).replace(/-/g, '');
      }
    }
  }

  const params: Record<string, string> = {
    FAC_GBN: facGbn || '',
    UPLO_PROC_GBN: uploProcGbn || '',
    PLAN_DT: '',
    DIRECTNM_EMP_NO: empId || '',
    FROM_DT: cleanFromDt,
    TO_DT: cleanToDt
  };

  const apiUrl = `${url}?${new URLSearchParams(params).toString()}`;
  const response = await fetchWithTimeout(apiUrl, { headers, signal, timeout: 0 });
  // API 응답 에러 시 설비 점검 계획 동기화 실패 예외를 던집니다.
  if (!response.ok) {
    throw new Error(t[get(lang)].syncPlanApiFailed.replace('{status}', String(response.status)));
  }

  const resJSON = await response.json();
  return resJSON.RESULT_DATA || [];
}

// 점검기준 가져오기
async function getStandardData(headers: any, url: string, facGbn: string, syncDate: string, signal?: AbortSignal) {
  const params: Record<string, string> = {
    COMPANY_ID: facGbn || ''
  };
  if (syncDate) {
    params.CRT_TM = syncDate;
  }

  const apiUrl = `${url}?${new URLSearchParams(params).toString()}`;
  const response = await fetchWithTimeout(apiUrl, { headers, signal, timeout: 0 });
  // API 응답 에러 시 점검 기준 동기화 실패 예외를 던집니다.
  if (!response.ok) {
    throw new Error(t[get(lang)].syncStdApiFailed.replace('{status}', String(response.status)));
  }

  const resJSON = await response.json();
  return resJSON.RESULT_DATA || [];
}

// 사용자 정보 가져오기
async function getPoscoUserData(headers: any, url: string, syncDate: string) {
  const params: Record<string, string> = {};
  if (syncDate) {
    params.CRT_TM = syncDate;
  }
  const apiUrl = params.CRT_TM ? `${url}?${new URLSearchParams(params).toString()}` : url;
  const response = await fetchWithTimeout(apiUrl, { headers, timeout: 0 });
  // API 응답 에러 시 사용자 정보 동기화 실패 예외를 던집니다.
  if (!response.ok) {
    throw new Error(t[get(lang)].syncUserApiFailed.replace('{status}', String(response.status)));
  }

  const resJSON = await response.json();
  return resJSON.RESULT_DATA || [];
}
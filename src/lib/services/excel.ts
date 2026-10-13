import * as XLSX from 'xlsx';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface ManageStoragePlugin {
  checkPermission(): Promise<{ granted: boolean; isAndroid11OrAbove: boolean }>;
  requestPermission(): Promise<{ granted?: boolean; requested?: boolean }>;
}

const ManageStorage = registerPlugin<ManageStoragePlugin>('ManageStorage');

/**
 * 엑셀 셀 값을 안전하게 공백 제거된 문자열로 변환하는 공통 캡슐화 헬퍼 함수입니다.
 * @param value 엑셀 셀 값
 * @returns 공백이 트리밍된 문자열 (Null 또는 Undefined 일 시 빈 문자열 반환)
 */
function cleanVal(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * tb_mob_set020 (사용자 계정 정보) 용 엑셀 파싱 데이터 구조 인터페이스
 */
export interface ExcelUser {
  /** 상하공정 구분 (PK) - 1번째 열 (Index 0) */
  uplo_proc_gbn: string;
  /** 사용자 ID (PK) - 2번째 열 (Index 1) */
  mob_user_id: string;
  /** 사용자명 - 3번째 열 (Index 2) */
  mob_user_nm: string;
  /** 시작일자 - 4번째 열 (Index 3) */
  start_date: string;
  /** 종료일자 - 5번째 열 (Index 4) */
  end_date: string;
  /** 권한 코드 - 6번째 열 (Index 5) */
  role_cd: string;
  /** 권한명 - 7번째 열 (Index 6) */
  role_nm: string;
  /** 회사 ID - 8번째 열 (Index 7) */
  co_id: string;
  /** 공장 구분 (기존 호환성 및 DB 매핑을 위한 기본값 제공용) */
  fac_gbn?: string;
}

/**
 * tb_mob_std120 (설비사양정보) 용 엑셀 파싱 데이터 구조 인터페이스
 */
export interface ExcelEquipment {
  /** 공장 구분 - 엑셀 미존재 (선택적) */
  fac_gbn?: string;
  /** 상하공정 구분 (PK) */
  uplo_proc_gbn: string;
  /** 상하공정 구분명 */
  uplo_proc_gbn_nm?: string;
  /** 설비 ID (PK) */
  asset_id: string;
  /** 설비 명 */
  asset_nm: string;
  /** 설비분류코드 - 엑셀 미존재 (선택적) */
  asset_csf_cd?: string;
  /** 대분류코드 - 엑셀 미존재 (선택적) */
  large_csf_cd?: string;
  /** 중분류코드 - 엑셀 미존재 (선택적) */
  midd_csf_cd?: string;
  /** 소분류코드 - 엑셀 미존재 (선택적) */
  sml_csf_cd?: string;
  /** 공정설비코드 - 엑셀 미존재 (선택적) */
  proc_asset_cd?: string;
  /** 상위설비 ID */
  parent_asset_id: string;
  /** 상위설비명 */
  parent_asset_nm: string;
  /** 공정코드 */
  proc_cd: string;
  /** 공정명 */
  proc_nm?: string;
  /** 설비위치 */
  install_loc: string;
  /** 구조형식 */
  strct_fmt: string;
  /** 설비중요도 */
  asset_imp_dgr: string;
  /** 상세사양 */
  dtl_spec: string;
  /** 규격 */
  spec: string;
  /** 용량 */
  vol: string;
  /** 설비유형 */
  asset_tp: string;
  /** TAG ID */
  tag_id?: string;
}

/**
 * tb_mob_std130 (점검계획) 용 엑셀 파싱 데이터 구조 인터페이스
 */
export interface ExcelInspectionPlan {
  /** 공장 구분 (PK) - 1번째 열 (Index 0) */
  fac_gbn: string;
  /** 상하공정 구분 (PK) - 2번째 열 (Index 1) */
  uplo_proc_gbn: string;
  /** 점검 활동 번호 (PK) - 3번째 열 (Index 2) */
  chk_action_no: string;
  /** 점검 차수 - 4번째 열 (Index 3) */
  chk_ordinal: string;
  /** 점검 순서 - 5번째 열 (Index 4) */
  chk_serno: string;
  /** 점검 계획 일 - 6번째 열 (Index 5) */
  chk_plan_day: string;
  /** 설비 ID (PK) - 7번째 열 (Index 6) */
  asset_id: string;
  /** 점검 활동 명 - 8번째 열 (Index 7) */
  chk_action_nm: string;
  /** 설비 명 - 9번째 열 (Index 8) */
  asset_nm: string;
  /** 점검 항목 - 10번째 열 (Index 9) */
  chk_item: string;
  /** 점검 항목단위 - 11번째 열 (Index 10) */
  chk_item_unit: string;
  chk_item_unit_nm?: string;
  /** 점검 상세 - 12번째 열 (Index 11) */
  chk_dtl: string;
  /** 점검 형식 - 13번째 열 (Index 12) */
  chk_fmt: string;
  /** 주기 구분 - 14번째 열 (Index 13) */
  cycle_gbn: string;
  /** 점검 단위 - 15번째 열 (Index 14) */
  chk_unit: string;
  /** 주기 시작 월 - 16번째 열 (Index 15) */
  cycle_sta_mnt: string;
  /** 주기 주차 - 17번째 열 (Index 16) */
  cycle_week: string;
  /** 점검시작일시 - 18번째 열 (Index 17) */
  chk_sta_dtm: string;
  /** 주기 요일 - 19번째 열 (Index 18) */
  cycle_wkday: string;
  /** 점검종료일시 - 20번째 열 (Index 19) */
  chk_end_dtm: string;
  /** 측정값 - 21번째 열 (Index 20) */
  mea_val: string;
  /** 이상 값 여부 - 22번째 열 (Index 21) */
  abnr_val_yn: string;
  /** 특기사항 - 23번째 열 (Index 22) */
  special_note: string;
  /** 담당자 - 24번째 열 (Index 23) */
  directnm_emp_no: string;
  /** 중점 설비 여부 - 25번째 열 (Index 24) */
  impt_asset_yn: string;
  /** 점검 하한 - 26번째 열 (Index 25) */
  chk_ll: string;
  /** 점검 기준 */
  chk_ref?: string;
  /** 점검 상한 - 27번째 열 (Index 26) */
  chk_ul: string;
  /** 관련 태그 명 - 28번째 열 (Index 27) */
  reltd_tag_nm: string;
  /** 점검 구분 (chk_gbn) */
  chk_gbn?: string;
  /** 점검 결과 (chk_rslt: S/F/N) */
  chk_rslt?: string;
  chk_gbn_nm?: string;
  cycle_gbn_nm?: string;
  chk_fmt_nm?: string;
  chk_item_nm?: string;
  chk_unit_nm?: string;
  directnm_emp_nm?: string;
  chk_rslt_nm?: string;
  chk_work_gbn?: string;
}

export interface ExcelInspectionStd {
  /** 코드마스터코드 (PK) - 1번째 열 (Index 0) */
  master_cd: string;
  /** 코드마스터명 - 2번째 열 (Index 1) */
  master_nm: string;
  /** 기본 언어 - 3번째 열 (Index 2) */
  lang_cd: string;
  /** 상세코드 (PK) - 4번째 열 (Index 3) */
  cd_val: string;
  /** 상세코드명 - 5번째 열 (Index 4) */
  cd_nm: string;
  /** 상세코드설명 - 6번째 열 (Index 5) */
  cd_desc: string;
  /** 정렬 순서 - 7번째 열 (Index 6) */
  disp_seq: string;
  /** 사용유무 - 8번째 열 (Index 7) */
  use_yn: string;
}

/**
 * 엑셀 파일 목록을 탐색해 최신 순으로 정렬하여 반환합니다.
 * @param prefix 파일명의 접두사 (예: "Inspector Info")
 * @returns 파일 정보 목록 배열
 */
export async function listExcelFiles(prefix: string): Promise<{ filename: string; size: number; timestamp: number; formattedDate: string }[]> {
  if (Capacitor.getPlatform() === 'web') {
    try {
      const res = await fetch(`/api/excel-files?prefix=${encodeURIComponent(prefix)}`);
      if (!res.ok) throw new Error('서버 엑셀 목록 조회 API 요청 실패');
      return await res.json();
    } catch (err) {
      console.error('[Excel Service] Failed to fetch server excel list:', err);
      return [];
    }
  }

  const targetDir = 'Download/send';
  try {
    // 1. 디렉토리가 존재하는지 먼저 확인하고, 없으면 자동으로 생성해 줍니다.
    try {
      await Filesystem.mkdir({
        path: targetDir,
        directory: Directory.ExternalStorage,
        recursive: true
      });
    } catch (mkdirErr) {
      // 이미 디렉토리가 존재하는 등 생성 실패 시에는 무시하고 읽기를 시도합니다.
      console.log('[Excel Service] Sync directory creation skipped/failed:', mkdirErr);
    }

    const dirResult = await Filesystem.readdir({
      path: targetDir,
      directory: Directory.ExternalStorage
    });

    const filtered = [];
    for (const file of dirResult.files) {
      if (file.name.startsWith(prefix) && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        const match = file.name.match(/(\d+)\.(xlsx|xls)$/);
        const timestamp = match ? parseInt(match[1]) : (file.mtime || Date.now());

        filtered.push({
          filename: file.name,
          size: file.size || 0,
          timestamp,
          formattedDate: new Date(timestamp).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
        });
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error(`[Excel Service] Failed to read native files for prefix: ${prefix}`, err);
    throw new Error(`디바이스의 '/Download/send' 디렉토리에 접근할 수 없습니다. (${(err as Error).message})`);
  }
}

/**
 * 지정된 파일 이름의 엑셀 파일을 삭제합니다.
 * @param filename 삭제할 파일명
 */
export async function deleteExcelFile(filename: string): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web') {
    try {
      const res = await fetch(`/api/excel-files?file=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) return true;
      console.warn(`[Excel Service] 서버 엑셀 파일 삭제 실패 (HTTP ${res.status})`);
    } catch (err) {
      console.warn('[Excel Service] 서버 엑셀 파일 삭제 중 에러:', err);
    }
    return false;
  }

  try {
    await Filesystem.deleteFile({
      path: `Download/send/${filename}`,
      directory: Directory.ExternalStorage
    });
    return true;
  } catch (err) {
    // 안드로이드 11+ Scoped Storage 권한 등으로 삭제 실패 시 동기화 전체가 실패하는 것을 방지하기 위해 경고로그만 출력합니다.
    console.warn(`[Excel Service] 안드로이드 엑셀 파일 삭제 실패 (권한 제한 가능성): ${filename}`, err);
    return false;
  }
}

/**
 * 지정된 파일 이름의 엑셀 데이터를 바이트 어레이(Uint8Array)로 로드합니다.
 * @param filename 로드할 엑셀 파일명
 * @returns 엑셀 바이너리 데이터 바이트 배열
 */
export async function loadExcelFile(filename: string): Promise<Uint8Array> {
  if (Capacitor.getPlatform() === 'web') {
    const res = await fetch(`/api/excel-files?file=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`서버 엑셀 파일을 불러올 수 없습니다. status: ${res.status}`);
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const fileContent = await Filesystem.readFile({
    path: `Download/send/${filename}`,
    directory: Directory.ExternalStorage
  });

  const base64Data = fileContent.data as string;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * 엑셀 파일의 첫 번째 시트를 JSON 2차원 배열(Rows)로 변환하는 유틸리티입니다.
 * 헤더 유무와 무관하게 컬럼의 상대 위치(Index) 매핑을 수행하기 위해 사용합니다.
 * 
 * @param data 엑셀 파일 바이너리 데이터
 * @returns 2차원 행 데이터 배열 (헤더 포함)
 */
function readSheetTo2DArray(data: Uint8Array): any[][] {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (rows.length <= 1) {
    throw new Error("엑셀 파일 내에 유효 데이터가 존재하지 않습니다.");
  }
  return rows;
}

import { ADMIN_IDS } from '$lib/constants';

/**
 * 1. 점검자 정보(Inspector Info) 엑셀 데이터를 0-based 고정 열 위치 기준으로 파싱합니다.
 * ➔ tb_mob_set020 테이블 컬럼 순서 매칭
 * @param data 엑셀 파일 바이너리 데이터
 * @returns 파싱 완료된 점검자 목록 배열
 */
export async function parseInspectorInfo(data: Uint8Array): Promise<ExcelUser[]> {
  const rows = readSheetTo2DArray(data);
  const dataRows = rows.slice(1); // 1번째 헤더 행은 스킵

  return dataRows.map(row => {
    const uplo_proc_gbn = cleanVal(row[0]);
    const mob_user_id = cleanVal(row[1]);
    const mob_user_nm = cleanVal(row[2]);
    const start_date = cleanVal(row[3]);
    const end_date = cleanVal(row[4]);
    const role_cd = cleanVal(row[5]);
    const role_nm = cleanVal(row[6]);
    const co_id = cleanVal(row[7]);

    // 회사 ID 기본값 및 공장 구분 복원
    const fac_gbn = co_id.replace('POSAR', '');

    return { fac_gbn, uplo_proc_gbn, mob_user_id, mob_user_nm, start_date, end_date, role_cd, role_nm, co_id };
  }).filter(u => {
    const uidUpper = (u.mob_user_id || '').trim().toUpperCase();
    return uidUpper !== "" && !ADMIN_IDS.includes(uidUpper);
  });
}

/**
 * 2. 설비 사양 정보(Equipment Spec Info) 엑셀 데이터를 0-based 고정 열 위치 기준으로 파싱합니다.
 * ➔ tb_mob_std120 테이블 컬럼 순서 매칭
 * @param data 엑셀 파일 바이너리 데이터
 * @returns 파싱 완료된 설비 사양 목록 배열
 */
export async function parseEquipmentSpec(data: Uint8Array): Promise<ExcelEquipment[]> {
  const rows = readSheetTo2DArray(data);
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const uplo_proc_gbn = cleanVal(row[0]);
    const uplo_proc_gbn_nm = cleanVal(row[1]);
    const asset_id = cleanVal(row[2]);
    const asset_nm = cleanVal(row[3]);
    const proc_cd = cleanVal(row[4]);
    const proc_nm = cleanVal(row[5]);
    const parent_asset_id = cleanVal(row[6]);
    const parent_asset_nm = cleanVal(row[7]);
    const install_loc = cleanVal(row[8]);
    const strct_fmt = cleanVal(row[9]);
    const asset_imp_dgr = cleanVal(row[10]);
    const dtl_spec = cleanVal(row[11]);
    const spec = cleanVal(row[12]);
    const vol = cleanVal(row[13]);
    const asset_tp = cleanVal(row[14]);
    const tag_id = cleanVal(row[15]);

    return { 
      uplo_proc_gbn, 
      uplo_proc_gbn_nm, 
      asset_id, 
      asset_nm, 
      proc_cd, 
      proc_nm, 
      parent_asset_id, 
      parent_asset_nm, 
      install_loc, 
      strct_fmt, 
      asset_imp_dgr, 
      dtl_spec, 
      spec, 
      vol, 
      asset_tp, 
      tag_id 
    };
  }).filter(eq => eq.asset_id !== "" && eq.asset_nm !== "");
}

/**
 * 3. 설비 점검 계획 정보(Inspection Plan) 엑셀 데이터를 0-based 고정 열 위치 기준으로 파싱합니다.
 * ➔ tb_mob_std130 테이블 컬럼 순서 매칭
 * @param data 엑셀 파일 바이너리 데이터
 * @returns 파싱 완료된 점검 계획 목록 배열
 */
export async function parseInspectionPlan(data: Uint8Array): Promise<ExcelInspectionPlan[]> {
  const rows = readSheetTo2DArray(data);
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const asset_id        = cleanVal(row[0]);  // 설비번호
    const cycle_gbn_nm    = cleanVal(row[1]);  // 주기구분명 (점검주기)
    const chk_plan_day    = cleanVal(row[2]);  // 점검활동일 (점검일)
    const chk_serno       = cleanVal(row[3]);  // 점검순서
    const chk_fmt_nm      = cleanVal(row[4]);  // 점검형식명 (점검방법)
    const chk_item_nm     = cleanVal(row[5]);  // 점검항목명 (점검항목)
    const chk_unit_nm     = cleanVal(row[6]);  // 점검단위명 (점검결과유형)
    const chk_item_unit   = cleanVal(row[7]);  // 점검항목단위 (점검단위)
    const chk_ll          = cleanVal(row[8]);  // 점검하한 (점검하한값)
    const chk_ref         = cleanVal(row[9]);  // 점검기준 (점검기준값)
    const chk_ul          = cleanVal(row[10]); // 점검상한 (점검상한값)
    const directnm_emp_nm = cleanVal(row[11]); // 점검자명
    const chk_rslt_nm     = cleanVal(row[12]); // 점검실적명 (점검결과)
    // row[13]: 데이터입력방법 (스킵)
    const chk_sta_dtm     = cleanVal(row[14]); // 점검시작일시
    const chk_end_dtm     = cleanVal(row[15]); // 점검종료일시
    const mea_val         = cleanVal(row[16]); // 측정값
    const special_note    = cleanVal(row[17]); // 특이사항
    const chk_gbn_nm      = cleanVal(row[18]); // 점검구분명
    const chk_action_no   = cleanVal(row[19]); // 점검활동 NO
    const chk_ordinal     = cleanVal(row[20]); // 점검차수
    const chk_dtl         = cleanVal(row[21]); // 점검상세
    const chk_gbn         = cleanVal(row[22]); // 점검구분
    const cycle_gbn       = cleanVal(row[23]); // 주기구분
    const chk_fmt         = cleanVal(row[24]); // 점검형식
    const chk_item        = cleanVal(row[25]); // 점검항목
    const chk_unit        = cleanVal(row[26]); // 점검단위
    const directnm_emp_no = cleanVal(row[27]); // 점검자ID
    const chk_rslt        = cleanVal(row[28]); // 점검실적
    const chk_work_gbn    = cleanVal(row[29]); // 작업구분
    const fac_gbn         = cleanVal(row[30]); // 공장구분
    const uplo_proc_gbn   = cleanVal(row[31]); // 상하공정구분

    return {
      fac_gbn,
      uplo_proc_gbn,
      chk_action_no,
      chk_ordinal,
      chk_serno,
      chk_plan_day,
      asset_id,
      chk_action_nm: '',
      asset_nm: '',
      chk_item,
      chk_item_unit,
      chk_dtl,
      chk_fmt,
      cycle_gbn,
      chk_unit,
      cycle_sta_mnt: '',
      cycle_week: '',
      chk_sta_dtm,
      cycle_wkday: '',
      chk_end_dtm,
      mea_val,
      abnr_val_yn: '',
      special_note,
      directnm_emp_no,
      impt_asset_yn: '',
      chk_ll,
      chk_ref,
      chk_ul,
      reltd_tag_nm: '',
      chk_gbn,
      chk_rslt,
      chk_gbn_nm,
      cycle_gbn_nm,
      chk_fmt_nm,
      chk_item_nm,
      chk_unit_nm,
      directnm_emp_nm,
      chk_rslt_nm,
      chk_work_gbn
    };
  }).filter(p => p.chk_action_no !== "" && p.asset_id !== "");
}

/**
 * 4. 점검 표준 코드 정보(Inspection Stds Info) 엑셀 데이터를 0-based 고정 열 위치 기준으로 파싱합니다.
 * ➔ tb_mob_std110 테이블 컬럼 순서 매칭
 * @param data 엑셀 파일 바이너리 데이터
 * @returns 파싱 완료된 점검 표준 코드 목록 배열
 */
export async function parseInspectionStds(data: Uint8Array): Promise<ExcelInspectionStd[]> {
  const rows = readSheetTo2DArray(data);
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const master_cd = cleanVal(row[0]);
    const master_nm = cleanVal(row[1]);
    const lang_cd = cleanVal(row[2]);
    const cd_val = cleanVal(row[3]);
    const cd_nm = cleanVal(row[4]);
    const cd_desc = cleanVal(row[5]);
    const disp_seq = cleanVal(row[6]);
    const use_yn = cleanVal(row[7]);

    return {
      master_cd,
      master_nm,
      lang_cd,
      cd_val,
      cd_nm,
      cd_desc,
      disp_seq,
      use_yn
    };
  }).filter(std => std.master_cd !== "" && std.cd_val !== "");
}

/**
 * 디바이스 저장소 접근 권한이 없을 경우 권한을 요청합니다.
 * @returns 권한 부여 여부 (granted / denied)
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web') return true;

  try {
    // Android의 경우 모든 파일 관리 권한(MANAGE_EXTERNAL_STORAGE) 확인 및 요청
    if (Capacitor.getPlatform() === 'android') {
      const { granted, isAndroid11OrAbove } = await ManageStorage.checkPermission();

      if (isAndroid11OrAbove) {
        if (granted) {
          return true;
        }

        // 권한이 없는 경우 설정 화면으로 이동시킴
        await ManageStorage.requestPermission();

        // 설정 화면에서 돌아올 때까지 비동기 실행이 지연되므로, 첫 권한 미동의 시에는 
        // 사용자가 직접 설정에서 돌아온 후 다시 탭하도록 유도하게 false를 반환합니다.
        const reCheck = await ManageStorage.checkPermission();
        return reCheck.granted;
      }
    }

    // Android 10 이하 또는 타 플랫폼은 기존 Filesystem 권한 요청 사용
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') {
      return true;
    }

    const request = await Filesystem.requestPermissions();
    return request.publicStorage === 'granted';
  } catch (err) {
    console.error('[Excel Service] Failed to request storage permission:', err);
    throw new Error(`권한 요청 모듈 실행 중 오류 발생: ${(err as Error).message}`);
  }
}

/**
 * 디바이스 저장소 접근 권한이 실제로 승인되어 있는지 여부만 확인합니다. (안내 팝업용)
 */
export async function checkStoragePermissionGranted(): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web') return true;

  try {
    if (Capacitor.getPlatform() === 'android') {
      const { granted, isAndroid11OrAbove } = await ManageStorage.checkPermission();
      if (isAndroid11OrAbove) {
        return granted;
      }
    }

    const status = await Filesystem.checkPermissions();
    return status.publicStorage === 'granted';
  } catch (err) {
    console.error('[Excel Service] Failed to check storage permission:', err);
    return false;
  }
}

/**
 * 디바이스 저장소 접근 권한 설정 화면을 열거나 권한을 직접 요청합니다.
 */
export async function openStoragePermissionSettings(): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web') return true;

  try {
    if (Capacitor.getPlatform() === 'android') {
      const { granted, isAndroid11OrAbove } = await ManageStorage.checkPermission();
      if (isAndroid11OrAbove) {
        if (granted) return true;
        await ManageStorage.requestPermission();
        const reCheck = await ManageStorage.checkPermission();
        return reCheck.granted;
      }
    }

    const request = await Filesystem.requestPermissions();
    return request.publicStorage === 'granted';
  } catch (err) {
    console.error('[Excel Service] Failed to open storage permission settings:', err);
    return false;
  }
}

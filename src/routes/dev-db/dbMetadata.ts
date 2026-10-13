/**
 * SQLite 물리 테이블명 -> 한글 정의명 매핑 (DB설계.html 명세 기반)
 */
export const tableDescriptions: Record<string, string> = {
  // 1. 공식 메인 물리 테이블 (MES 연동 규격)
  "tb_mob_set010": "설비점검 모바일 설정",
  "tb_mob_set020": "사용자 계정 정보",
  "tb_mob_std110": "설비점검기준코드",
  "tb_mob_std120": "설비사양정보",
  "tb_mob_std130": "점검계획",
  "tb_mob_rst130": "점검실적",
  
  // 2. 개발 및 로컬 세션 보조 테이블
  "inspections": "점검 결과 마스터 (로컬)",
  "inspection_items": "점검 결과 상세 항목 (로컬)",
  "system_settings": "시스템 환경설정 (로컬)",
  
  // 3. 하위 호환성 전용 대칭 SQL Views
  "users": "사용자 정보 뷰 (호환용)",
  "equipment": "설비 정보 뷰 (호환용)",
  "inspection_plans": "점검 계획 뷰 (호환용)",
  "inspection_stds": "점검 표준 뷰 (호환용)"
};

/**
 * SQLite 물리 컬럼명 -> 한글 정의명 매핑 (DB설계.html 명세 기반 글로벌 사전)
 */
export const columnDescriptions: Record<string, string> = {
  // 1. 공통 & 환경설정 (tb_mob_set010)
  "fac_gbn": "공장 구분",
  "mob_lang": "기본 언어",
  "base_url": "API Base URL",
  "api1_uri": "버전정보 API",
  "api2_uri": "사용자계정 API",
  "api3_uri": "기준코드 API",
  "api4_uri": "설비사양 API",
  "api5_uri": "점검계획 API",
  "api6_uri": "점검실적 API",
  "api7_uri": "엑세스토큰 인증 API",
  "api8_uri": "리프레시토큰 인증 API",
  "sync_date_user": "동기화 날짜 - 사용자 계정 (YYYYMMDD)",
  "sync_date_equip": "동기화 날짜 - 설비 사양 (YYYYMMDD)",
  "sync_date_plan": "동기화 날짜 - 점검 계획 (YYYYMMDD)",
  "sync_date_std": "동기화 날짜 - 기준 코드 (YYYYMMDD)",

  // 2. 사용자 정보 (tb_mob_set020 / users)
  "mob_user_id": "사용자 ID (사번)",
  "mob_user_pw": "비밀번호",
  "mob_user_nm": "사용자명 (Excel)",
  "mob_user_name": "사용자명",
  "mob_user_dept": "부서",
  "mob_user_role": "역할(권한)",
  "mob_user_process_type": "공정구분",
  "co_id": "회사 ID",
  "roles_json": "전체 권한 목록 (JSON)",

  // 3. 기준코드 정보 (tb_mob_std110 / inspection_stds)
  "uplo_proc_gbn": "상하공정 구분",
  "master_cd": "코드마스터코드",
  "master_nm": "코드마스터명",
  "master_desc": "코드마스터설명",
  "cd_val": "상세코드",
  "cd_nm": "상세코드명",
  "cd_desc": "상세코드설명",
  "tags": "태그",
  "use_yn": "사용유무",
  "attr1": "속성 1",
  "attr2": "속성 2",
  "attr3": "속성 3",
  "attr4": "속성 4",
  "attr5": "속성 5",

  // 4. 설비사양 정보 (tb_mob_std120 / equipment)
  "uplo_proc_gbn_nm": "상하공정 구분명",
  "asset_id": "설비 ID",
  "asset_nm": "설비 명",
  "asset_csf_cd": "설비분류코드",
  "large_csf_cd": "대분류코드",
  "midd_csf_cd": "중분류코드",
  "sml_csf_cd": "소분류코드",
  "proc_asset_cd": "공정설비코드",
  "proc_nm": "수리공정명",
  "parent_asset_id": "상위설비 ID",
  "parent_asset_nm": "상위설비명",
  "proc_cd": "공정코드",
  "install_loc": "설치 위치",
  "strct_fmt": "구조 형식",
  "asset_imp_dgr": "설비 중요도",
  "dtl_spec": "상세 사양",
  "spec": "규격",
  "vol": "용량",
  "asset_tp": "설비 유형",
  "tag_id": "TAG ID",

  // 5. 점검 계획 및 실적 (tb_mob_std130 & tb_mob_rst130 / inspection_plans)
  "chk_action_no": "점검활동 번호",
  "chk_ordinal": "점검 차수",
  "chk_serno": "점검 순서",
  "chk_plan_day": "점검 계획일",
  "chk_action_nm": "점검활동 명",
  "chk_item": "점검 항목",
  "chk_item_unit": "점검 항목단위",
  "chk_dtl": "점검 상세",
  "chk_fmt": "점검 형식",
  "cycle_gbn": "주기 구분",
  "chk_unit": "점검 단위",
  "cycle_sta_mnt": "주기 시작월",
  "cycle_week": "주기 주차",
  "chk_sta_dtm": "점검시작 일시",
  "cycle_wkday": "주기 요일",
  "chk_end_dtm": "점검종료 일시",
  "mea_val": "측정값 (실적)",
  "abnr_val_yn": "이상여부 (Y/N)",
  "special_note": "특기사항",
  "directnm_emp_no": "담당자 사번",
  "impt_asset_yn": "중점설비 여부",
  "chk_ll": "점검 하한값",
  "chk_ul": "점검 상한값",
  "reltd_tag_nm": "관련 태그명",
  "chk_gbn": "점검 구분",
  "chk_rslt": "점검 결과 (S/F/N)",
  "send_flag": "전송 여부",

  // 6. UI 로컬 점검 및 세션 테이블
  "id": "ID (PK)",
  "equipment_id": "설비 ID",
  "status": "상태",
  "memo": "점검 메모",
  "timestamp": "등록/점검 시간",
  "inspection_id": "점검 마스터 ID",
  "label": "라벨 (지문)",
  "note": "메모(노트)",
  "photo_url": "사진 URL"
};

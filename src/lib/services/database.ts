import { Capacitor } from '@capacitor/core';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import { defineCustomElements } from 'jeep-sqlite/loader';
import { get } from 'svelte/store';
import { settings, defaultSettings } from '../stores/settings';
import { isOnline } from '../stores/network';
import { PUBLIC_APP_VERSION } from '$lib/constants';
import type { ExcelUser, ExcelEquipment, ExcelInspectionPlan, ExcelInspectionStd } from './excel';
import { encryptPassword } from '$lib/utils/crypto';
import { toLocalDateString, toLocalDtmString } from '$lib/utils/date';
import { ADMIN_IDS } from '$lib/constants';

/**
 * SQLite 데이터베이스 관리 및 데이터 연동 서비스 클래스
 */
class DatabaseService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly DB_NAME = 'securescan_db';
  private readonly LATEST_DB_VERSION = 1;

  /**
   * 데이터베이스 및 커넥션을 안전하게 초기화합니다. (중복 방지 및 꼬인 스키마 자동 복구 자가 치유 기능 포함)
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
        const platform = Capacitor.getPlatform();

        if (platform === 'web') {
          await defineCustomElements(window);
          const jeepSqlite = document.querySelector('jeep-sqlite');
          if (!jeepSqlite) {
            const newJeepSqlite = document.createElement('jeep-sqlite');
            document.body.appendChild(newJeepSqlite);
          }
          await customElements.whenDefined('jeep-sqlite');
          await this.sqlite.initWebStore();
        }

        try {
          console.log('[DB Service] Creating SQLite connection...');
          this.db = await this.sqlite.createConnection(
            this.DB_NAME,
            false,
            'no-encryption',
            1,
            false
          );
        } catch (connErr: any) {
          console.warn('[DB Service] createConnection failed. Attempting retrieveConnection fallback...', connErr);
          try {
            this.db = await this.sqlite.retrieveConnection(this.DB_NAME, false);
            console.log('[DB Service] Connection successfully retrieved from native pool.');
          } catch (retErr) {
            console.error('[DB Service] retrieveConnection also failed:', retErr);
            throw connErr;
          }
        }

        const isOpenRes = await this.db.isDBOpen();
        if (!isOpenRes.result) {
          await this.db.open();
        }

        // 현재 데이터베이스 스키마 버전 조회
        const versionRes = await this.db.query('PRAGMA user_version;');
        const versionRow = versionRes.values?.[0];
        const currentVersion = versionRow ? (versionRow.user_version ?? versionRow['user_version'] ?? Object.values(versionRow)[0] ?? 0) : 0;

        console.log(
          `%c[DB 연결 성공] %c현재 로컬 버전: %c${currentVersion}%c | %c최신 요구 버전: %c${this.LATEST_DB_VERSION}`,
          'color: #10b981; font-weight: bold;',
          'color: #d1d5db;',
          'color: #3b82f6; font-weight: bold;',
          'color: #4b5563;',
          'color: #d1d5db;',
          'color: #ec4899; font-weight: bold;'
        );

        // 데이터베이스 스키마 순차 마이그레이션 수행 (버전 변경 감지 시에만 가동)
        if (currentVersion < this.LATEST_DB_VERSION) {
          await this.runMigrations(currentVersion);
        }

        // [하위 호환 자가 치유] 기존 브라우저/기기에 이미 저장된 tb_mob_set010에 api9_uri, auto_send_yn 컬럼이 없는 경우 패치
        try {
          await this.db.execute(`ALTER TABLE tb_mob_set010 ADD COLUMN api9_uri TEXT;`);
        } catch (e) {}
        try {
          await this.db.execute(`ALTER TABLE tb_mob_set010 ADD COLUMN auto_send_yn TEXT DEFAULT 'N';`);
        } catch (e) {}

        // [방어 로직] 마이그레이션 후 핵심 테이블 존재 여부 검증 (Android 다중 SQL 실행 실패 대응)
        const criticalTables = ['tb_mob_set010', 'tb_mob_set020', 'tb_mob_std110', 'tb_mob_std120', 'tb_mob_std130', 'tb_mob_rst130'];
        let hasMissingTable = false;
        for (const tbl of criticalTables) {
          if (!(await this.tableExists(tbl))) {
            hasMissingTable = true;
            console.warn(`[DB Service] 핵심 테이블 '${tbl}' 누락 감지.`);
          }
        }
        if (hasMissingTable) {
          console.warn('[DB Service] 누락된 테이블 감지됨. 개별 CREATE TABLE로 스키마 재생성 시도...');
          await this.createTablesIndividually();
          await this.recreateViews();
          await this.db!.execute(`PRAGMA user_version = ${this.LATEST_DB_VERSION};`);
          await this.saveToStoreWeb();
          console.log('[DB Service] 개별 테이블 재생성 완료.');
        }

      } catch (err: any) {
        console.error('[DB Service] Init failed. Handling error details...', err);

        // 에러 정보 저장
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('last_db_error', err?.message || String(err));
          localStorage.setItem('last_db_error_stack', err?.stack || '');
        }

        // [안전 조치] 자가 복구 명목의 기기 내 데이터 강제 삭제(deleteDatabase) 로직 전면 제거
        try {
          await this.closeDatabase();
        } catch (closeErr) {
          console.error('[DB Service] Failed to close database safely:', closeErr);
        }

        this.db = null;

        // 재설정 루프 제한 (최대 2회)
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
          const reloadCount = Number(sessionStorage.getItem('db_init_reload_count') || '0');
          if (reloadCount < 2) {
            sessionStorage.setItem('db_init_reload_count', String(reloadCount + 1));
            console.log(`[DB Service] Init failed. Reloading page (${reloadCount + 1}/2)...`);
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            console.error('[DB Service] Infinite reload loop prevented. DB initialization error persists.');
          }
        }

        throw err;
      }
    })();

    this.initPromise.finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  /**
   * [초강력 물리 차단] 활성화된 데이터베이스 커넥션을 강제로 닫고 리소스를 해제합니다.
   * IndexedDB를 차단(Blocked) 상태에 빠뜨리지 않고 완벽하게 삭제하기 위해 필수적입니다.
   */
  async closeDatabase(): Promise<void> {
    try {
      if (this.db) {
        console.log('[DB Service] Force closing active SQLite connection...');
        await this.db.close();
      }
      if (this.sqlite) {
        console.log('[DB Service] Releasing SQLite connection helper...');
        await this.sqlite.closeConnection(this.DB_NAME, false);
      }
    } catch (err) {
      console.error('[DB Service] Error during force close connection:', err);
    } finally {
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * [웹 플랫폼 전용] 가상 DB의 현재 메모리 데이터를 IndexedDB 물리 디스크로 동기화 플러시합니다.
   */
  async saveToStoreWeb(): Promise<void> {
    if (Capacitor.getPlatform() === 'web' && this.sqlite) {
      await this.sqlite.saveToStore(this.DB_NAME);
    }
  }

  /**
   * 글로벌 데이터베이스 스키마 버전을 관리하고 필요한 마이그레이션을 순차적으로 수행합니다.
   */
  private async runMigrations(currentVersion: number): Promise<void> {
    if (!this.db) return;

    console.log(
      `%c[DB 스키마 업그레이드 시작] %c버전: ${currentVersion} ➡️ %c${this.LATEST_DB_VERSION}`,
      'color: #f59e0b; font-weight: bold;',
      'color: #d1d5db;',
      'color: #ec4899; font-weight: bold;'
    );

    // 외래 키 제약 조건 및 정합성 체크 임시 비활성화
    await this.db.execute('PRAGMA foreign_keys = OFF;');
    try {
      // 순차 마이그레이션 순회 실행
      for (let v = currentVersion + 1; v <= this.LATEST_DB_VERSION; v++) {
        console.log(
          `%c[DB 마이그레이션 실행 중] %c버전 %c${v}%c 단계 적용 중...`,
          'color: #3b82f6; font-weight: bold;',
          'color: #d1d5db;',
          'color: #f59e0b; font-weight: bold;',
          'color: #d1d5db;'
        );

        // 실제 실행될 마이그레이션 코드
        await this.executeMigrationStep(v);
      }

      // 최종 완료 후 데이터베이스 파일의 user_version 메타정보 업데이트
      await this.db.execute(`PRAGMA user_version = ${this.LATEST_DB_VERSION};`);
      console.log(
        `%c[DB 스키마 업그레이드 완료] %c데이터베이스를 %c버전 ${this.LATEST_DB_VERSION}%c(으)로 성공적으로 업그레이드했습니다.`,
        'color: #10b981; font-weight: bold;',
        'color: #d1d5db;',
        'color: #ec4899; font-weight: bold;',
        'color: #d1d5db;'
      );

      // [웹 플랫폼 전용] 가상 DB 데이터를 IndexedDB 물리 디스크로 동기화 플러시!
      await this.saveToStoreWeb();
      console.log(
        `%c[브라우저 저장소 동기화 완료] %c가상 DB 데이터를 IndexedDB 디스크에 성공적으로 플러시했습니다.`,
        'color: #8b5cf6; font-weight: bold;',
        'color: #d1d5db;'
      );
    } catch (err) {
      console.error(
        `%c[DB 업그레이드 치명적 에러] %c마이그레이션 중 크래시 발생:`,
        'color: #ef4444; font-weight: bold;',
        'color: #fca5a5;',
        err
      );
      throw err;
    } finally {
      // 작업 완료 후 외래 키 감지 재가동
      await this.db.execute('PRAGMA foreign_keys = ON;');
    }
  }

  /**
   * 각 스키마 버전별 SQL 스크립트 모음 함수
   */
  private async executeMigrationStep(version: number): Promise<void> {
    const isDev = import.meta.env.DEV;

    if (version === 1) {
      console.log('[DB Migration] Version 1: Initializing tables with the latest schema directly...');

      // 1. 기존 레거시 테이블 및 뷰 정리 (설정 및 실적 데이터 소거 방지를 위해 tb_mob_* 테이블 DROP 문 제외)
      const dropQuery = `
        DROP VIEW IF EXISTS equipment;
        DROP VIEW IF EXISTS users;
        DROP VIEW IF EXISTS inspection_plans;
        DROP VIEW IF EXISTS inspection_stds;
        DROP TABLE IF EXISTS equipment;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS inspection_plans;
        DROP TABLE IF EXISTS inspection_stds;
        ${isDev ? `
        DROP TABLE IF EXISTS inspection_items;
        DROP TABLE IF EXISTS inspections;
        DROP TABLE IF EXISTS system_settings;
        ` : ''}
      `;
      try {
        await this.db!.execute(dropQuery);
      } catch (e) {
        // 무해한 에러 통과
      }

      // 2. 최신 스키마 테이블 직접 빌드
      await this.db!.execute(`
        -- A. 설정 테이블 (id=1 PK 제약 및 sync_date_* 컬럼 완비)
        CREATE TABLE IF NOT EXISTS tb_mob_set010 (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          fac_gbn TEXT,
          mob_lang TEXT,
          base_url TEXT,
          api1_uri TEXT,
          api2_uri TEXT,
          api3_uri TEXT,
          api4_uri TEXT,
          api5_uri TEXT,
          api6_uri TEXT,
          api7_uri TEXT,
          api8_uri TEXT,
          api9_uri TEXT,
          sync_date_user TEXT,
          sync_date_equip TEXT,
          sync_date_plan TEXT,
          sync_date_std TEXT
        );

        -- B. 사용자 테이블
        CREATE TABLE IF NOT EXISTS tb_mob_set020 (
          fac_gbn TEXT NOT NULL,
          uplo_proc_gbn TEXT NOT NULL,
          mob_user_id TEXT NOT NULL,
          mob_user_nm TEXT,
          co_id TEXT,
          roles_json TEXT,
          mob_user_pw TEXT,
          PRIMARY KEY (fac_gbn, uplo_proc_gbn, mob_user_id)
        );

        -- C. 코드기준정보 테이블
        CREATE TABLE IF NOT EXISTS tb_mob_std110 (
          master_cd TEXT NOT NULL,
          master_nm TEXT,
          lang TEXT NOT NULL,
          cd_val TEXT NOT NULL,
          cd_nm TEXT,
          cd_desc TEXT,
          display_seq INTEGER,
          use_yn TEXT,
          PRIMARY KEY (master_cd, cd_val, lang)
        );

        -- D. 설비사양정보 테이블 (최종 정렬 컬럼 구조 반영)
        CREATE TABLE IF NOT EXISTS tb_mob_std120 (
          fac_gbn TEXT NOT NULL,
          uplo_proc_gbn TEXT NOT NULL,
          uplo_proc_gbn_nm TEXT,
          asset_id TEXT NOT NULL,
          asset_nm TEXT,
          proc_cd TEXT,
          proc_nm TEXT,
          parent_asset_id TEXT,
          parent_asset_nm TEXT,
          install_loc TEXT,
          strct_fmt TEXT,
          asset_imp_dgr TEXT,
          dtl_spec TEXT,
          spec TEXT,
          vol TEXT,
          asset_tp TEXT,
          tag_id TEXT,
          asset_csf_cd TEXT,
          large_csf_cd TEXT,
          midd_csf_cd TEXT,
          sml_csf_cd TEXT,
          proc_asset_cd TEXT,
          PRIMARY KEY (fac_gbn, uplo_proc_gbn, asset_id)
        );

        -- E. 점검계획 테이블 (최종 5대 복합키 chk_item 구조 반영)
        CREATE TABLE IF NOT EXISTS tb_mob_std130 (
          chk_gbn TEXT,
          chk_gbn_nm TEXT,
          cycle_gbn TEXT,
          cycle_gbn_nm TEXT,
          chk_action_no TEXT,
          chk_plan_day TEXT,
          chk_ordinal TEXT,
          chk_serno TEXT,
          asset_id TEXT,
          chk_fmt TEXT,
          chk_fmt_nm TEXT,
          chk_item TEXT,
          chk_item_nm TEXT,
          chk_dtl TEXT,
          chk_unit TEXT,
          chk_unit_nm TEXT,
          chk_ll TEXT,
          chk_ref TEXT,
          chk_ul TEXT,
          directnm_emp_no TEXT,
          directnm_emp_nm TEXT,
          chk_rslt TEXT,
          chk_rslt_nm TEXT,
          chk_work_gbn TEXT,
          chk_sta_dtm TEXT,
          chk_end_dtm TEXT,
          mea_val TEXT,
          special_note TEXT,
          fac_gbn TEXT,
          uplo_proc_gbn TEXT,
          chk_action_nm TEXT,
          asset_nm TEXT,
          chk_item_unit TEXT,
          cycle_sta_mnt TEXT,
          cycle_week TEXT,
          cycle_wkday TEXT,
          abnr_val_yn TEXT,
          impt_asset_yn TEXT,
          reltd_tag_nm TEXT,
          PRIMARY KEY (chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item)
        );

        -- F. 점검실적 테이블 (최종 5대 복합키 및 send_flag 반영)
        CREATE TABLE IF NOT EXISTS tb_mob_rst130 (
          chk_gbn TEXT,
          chk_gbn_nm TEXT,
          cycle_gbn TEXT,
          cycle_gbn_nm TEXT,
          chk_action_no TEXT,
          chk_plan_day TEXT,
          chk_ordinal TEXT,
          chk_serno TEXT,
          asset_id TEXT,
          chk_fmt TEXT,
          chk_fmt_nm TEXT,
          chk_item TEXT,
          chk_item_nm TEXT,
          chk_dtl TEXT,
          chk_unit TEXT,
          chk_unit_nm TEXT,
          chk_ll TEXT,
          chk_ref TEXT,
          chk_ul TEXT,
          directnm_emp_no TEXT,
          directnm_emp_nm TEXT,
          chk_rslt TEXT,
          chk_rslt_nm TEXT,
          chk_work_gbn TEXT,
          chk_sta_dtm TEXT,
          chk_end_dtm TEXT,
          mea_val TEXT,
          special_note TEXT,
          fac_gbn TEXT,
          uplo_proc_gbn TEXT,
          chk_action_nm TEXT,
          asset_nm TEXT,
          chk_item_unit TEXT,
          cycle_sta_mnt TEXT,
          cycle_week TEXT,
          cycle_wkday TEXT,
          abnr_val_yn TEXT,
          impt_asset_yn TEXT,
          reltd_tag_nm TEXT,
          send_flag TEXT,
          PRIMARY KEY (chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item)
        );
        CREATE INDEX IF NOT EXISTS idx_tb_mob_rst130_purge ON tb_mob_rst130 (send_flag, chk_plan_day);
      `);

      // 3. 호환성 뷰 생성
      await this.recreateViews();
    }
  }


  /**
   * 미사용 레거시 호환 뷰 정리 및 chk_ref 컬럼 방어 보강 (가상 뷰 미사용 원칙)
   */
  private async recreateViews(): Promise<void> {
    if (!this.db) return;

    try {
      // 자가 치유: 기존 DB 테이블에 chk_ref 컬럼이 없는 경우 안전 추가
      try {
        await this.db.execute(`ALTER TABLE tb_mob_std130 ADD COLUMN chk_ref TEXT;`);
      } catch (e) { }
      try {
        await this.db.execute(`ALTER TABLE tb_mob_rst130 ADD COLUMN chk_ref TEXT;`);
      } catch (e) { }

      // 미사용 레거시 뷰 삭제 (불필요한 스키마 오버헤드 및 에러 방지)
      await this.db.execute(`
        DROP VIEW IF EXISTS equipment;
        DROP VIEW IF EXISTS users;
        DROP VIEW IF EXISTS inspection_plans;
        DROP VIEW IF EXISTS inspection_stds;
      `);
    } catch (err) {
      console.warn('[DB Migration] Legacy views cleanup:', err);
    }
  }

  /**
   * DB 커넥션이 물리적으로 정상 오픈되어 있는지 확인하고, 필요 시 자동 재연결(Open)을 수행하는 안전 헬퍼입니다.
   */
  private async ensureDBConnection(): Promise<SQLiteDBConnection> {
    if (!this.db) {
      await this.init();
    }
    try {
      const isOpenRes = await this.db?.isDBOpen();
      if (!isOpenRes?.result) {
        console.warn('[DB Service] Connection was closed or stale. Re-opening connection...');
        await this.db?.open();
      }
    } catch (e) {
      console.warn('[DB Service] isDBOpen check failed. Re-initializing connection...', e);
      this.db = null;
      await this.init();
    }
    return this.db!;
  }

  /**
   * 지정한 테이블이 데이터베이스에 존재하는지 확인합니다.
   * @param tableName 확인할 테이블명
   * @returns 테이블 존재 여부
   */
  private async tableExists(tableName: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      // sqlite_master 시스템 테이블에서 테이블 존재 여부 직접 조회
      const res = await this.db.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [tableName]
      );
      return (res.values?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * 핵심 테이블을 개별 execute 호출로 생성합니다.
   * Android WebView에서 다중 SQL 문을 하나의 execute()로 실행 시
   * 일부가 무시될 수 있어, 각 CREATE TABLE을 별도 execute로 분리하여
   * 안정성을 보장합니다.
   */
  private async createTablesIndividually(): Promise<void> {
    if (!this.db) return;

    // A. 설정 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_set010 (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        fac_gbn TEXT,
        mob_lang TEXT,
        base_url TEXT,
        api1_uri TEXT,
        api2_uri TEXT,
        api3_uri TEXT,
        api4_uri TEXT,
        api5_uri TEXT,
        api6_uri TEXT,
        api7_uri TEXT,
        api8_uri TEXT,
        api9_uri TEXT,
        sync_date_user TEXT,
        sync_date_equip TEXT,
        sync_date_plan TEXT,
        sync_date_std TEXT
      );
    `);

    // B. 사용자 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_set020 (
        fac_gbn TEXT NOT NULL,
        uplo_proc_gbn TEXT NOT NULL,
        mob_user_id TEXT NOT NULL,
        mob_user_nm TEXT,
        co_id TEXT,
        roles_json TEXT,
        mob_user_pw TEXT,
        PRIMARY KEY (fac_gbn, uplo_proc_gbn, mob_user_id)
      );
    `);

    // C. 코드기준정보 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_std110 (
        master_cd TEXT NOT NULL,
        master_nm TEXT,
        lang TEXT NOT NULL,
        cd_val TEXT NOT NULL,
        cd_nm TEXT,
        cd_desc TEXT,
        display_seq INTEGER,
        use_yn TEXT,
        PRIMARY KEY (master_cd, cd_val, lang)
      );
    `);

    // D. 설비사양정보 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_std120 (
        fac_gbn TEXT NOT NULL,
        uplo_proc_gbn TEXT NOT NULL,
        uplo_proc_gbn_nm TEXT,
        asset_id TEXT NOT NULL,
        asset_nm TEXT,
        proc_cd TEXT,
        proc_nm TEXT,
        parent_asset_id TEXT,
        parent_asset_nm TEXT,
        install_loc TEXT,
        strct_fmt TEXT,
        asset_imp_dgr TEXT,
        dtl_spec TEXT,
        spec TEXT,
        vol TEXT,
        asset_tp TEXT,
        tag_id TEXT,
        asset_csf_cd TEXT,
        large_csf_cd TEXT,
        midd_csf_cd TEXT,
        sml_csf_cd TEXT,
        proc_asset_cd TEXT,
        PRIMARY KEY (fac_gbn, uplo_proc_gbn, asset_id)
      );
    `);

    // E. 점검계획 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_std130 (
        chk_gbn TEXT,
        chk_gbn_nm TEXT,
        cycle_gbn TEXT,
        cycle_gbn_nm TEXT,
        chk_action_no TEXT,
        chk_plan_day TEXT,
        chk_ordinal TEXT,
        chk_serno TEXT,
        asset_id TEXT,
        chk_fmt TEXT,
        chk_fmt_nm TEXT,
        chk_item TEXT,
        chk_item_nm TEXT,
        chk_dtl TEXT,
        chk_unit TEXT,
        chk_unit_nm TEXT,
        chk_ll TEXT,
        chk_ref TEXT,
        chk_ul TEXT,
        directnm_emp_no TEXT,
        directnm_emp_nm TEXT,
        chk_rslt TEXT,
        chk_rslt_nm TEXT,
        chk_work_gbn TEXT,
        chk_sta_dtm TEXT,
        chk_end_dtm TEXT,
        mea_val TEXT,
        special_note TEXT,
        fac_gbn TEXT,
        uplo_proc_gbn TEXT,
        chk_action_nm TEXT,
        asset_nm TEXT,
        chk_item_unit TEXT,
        cycle_sta_mnt TEXT,
        cycle_week TEXT,
        cycle_wkday TEXT,
        abnr_val_yn TEXT,
        impt_asset_yn TEXT,
        reltd_tag_nm TEXT,
        PRIMARY KEY (chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item)
      );
    `);

    // F. 점검실적 테이블
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tb_mob_rst130 (
        chk_gbn TEXT,
        chk_gbn_nm TEXT,
        cycle_gbn TEXT,
        cycle_gbn_nm TEXT,
        chk_action_no TEXT,
        chk_plan_day TEXT,
        chk_ordinal TEXT,
        chk_serno TEXT,
        asset_id TEXT,
        chk_fmt TEXT,
        chk_fmt_nm TEXT,
        chk_item TEXT,
        chk_item_nm TEXT,
        chk_dtl TEXT,
        chk_unit TEXT,
        chk_unit_nm TEXT,
        chk_ll TEXT,
        chk_ref TEXT,
        chk_ul TEXT,
        directnm_emp_no TEXT,
        directnm_emp_nm TEXT,
        chk_rslt TEXT,
        chk_rslt_nm TEXT,
        chk_work_gbn TEXT,
        chk_sta_dtm TEXT,
        chk_end_dtm TEXT,
        mea_val TEXT,
        special_note TEXT,
        fac_gbn TEXT,
        uplo_proc_gbn TEXT,
        chk_action_nm TEXT,
        asset_nm TEXT,
        chk_item_unit TEXT,
        cycle_sta_mnt TEXT,
        cycle_week TEXT,
        cycle_wkday TEXT,
        abnr_val_yn TEXT,
        impt_asset_yn TEXT,
        reltd_tag_nm TEXT,
        send_flag TEXT,
        PRIMARY KEY (chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item)
      );
    `);

    // G. 점검실적 인덱스
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_tb_mob_rst130_purge ON tb_mob_rst130 (send_flag, chk_plan_day);
    `);
  }

  /**
   * 데이터베이스 SELECT 조회를 실행합니다. (구독 스토어 연계)
   */
  async query(statement: string, values: any[] = []): Promise<any> {
    const db = await this.ensureDBConnection();
    return await db.query(statement, values);
  }

  /**
   * 데이터베이스 단일 명령(INSERT, UPDATE, DELETE)을 실행합니다.
   */
  async run(statement: string, values: any[] = []): Promise<any> {
    const db = await this.ensureDBConnection();
    return await db.run(statement, values);
  }

  async getConfig(): Promise<any> {
    // [방어 로직] 설정 테이블 존재 여부 사전 확인 (마이그레이션 미완료 시 자동 복구)
    await this.ensureDBConnection();
    if (!(await this.tableExists('tb_mob_set010'))) {
      console.warn('[DB Config] tb_mob_set010 테이블 누락 감지. 개별 테이블 재생성 시도...');
      try {
        await this.createTablesIndividually();
        await this.recreateViews();
        await this.db!.execute(`PRAGMA user_version = ${this.LATEST_DB_VERSION};`);
        await this.saveToStoreWeb();
      } catch (migErr) {
        console.error('[DB Config] 테이블 재생성 실패. 기본 설정을 반환합니다:', migErr);
        return defaultSettings;
      }
    }

    const res = await this.query('SELECT * FROM tb_mob_set010 LIMIT 1');
    const row = res.values?.[0];

    // 데이터베이스에 설정 정보가 아예 없을 경우 defaultSettings로 자동 시딩(Seeding)
    if (!row) {
      console.log('[DB Config] No configuration found. Seeding defaultSettings...');
      await this.saveConfig(defaultSettings);
      return defaultSettings;
    }

    // fac_gbn에서 plantName과 processName 복원
    const facGbn = row.fac_gbn || '1공장 LP';
    const parts = facGbn.split(' ');
    const plantName = parts[0] || '1공장';
    const processName = parts[1] || 'LP';

    // 스페인어 매핑용 로컬 테이블
    const plantOptions = [
      { value: "1공장 LP", plantKo: "1공장", plantEs: "Planta 1", processKo: "LP", processEs: "LP" },
      { value: "1공장 LH", plantKo: "1공장", plantEs: "Planta 1", processKo: "LH", processEs: "LH" },
      { value: "2공장 LC", plantKo: "2공장", plantEs: "Planta 2", processKo: "LC", processEs: "LC" }
    ];

    const matched = plantOptions.find(o => o.plantKo === plantName && o.processKo === processName)
      || plantOptions[0];

    return {
      defaultLang: row.mob_lang || 'ko',
      plantName: plantName,
      plantNameEs: matched.plantEs,
      processName: processName,
      processNameEs: matched.processEs,
      baseUrl: row.base_url || defaultSettings.baseUrl,
      userApi: row.api2_uri || defaultSettings.userApi,
      std01Api: row.api3_uri || defaultSettings.std01Api,
      std02Api: row.api4_uri || defaultSettings.std02Api,
      std03Api: row.api5_uri || defaultSettings.std03Api,
      rst01Api: row.api6_uri || defaultSettings.rst01Api,
      accessTokenApi: row.api7_uri || defaultSettings.accessTokenApi,
      refreshTokenApi: row.api8_uri || defaultSettings.refreshTokenApi,
      versionApi: row.api9_uri || defaultSettings.versionApi,
      appVersion: PUBLIC_APP_VERSION || '1.0',
      autoSendYn: row.auto_send_yn || 'N'
    };
  }

  async saveConfig(config: any): Promise<void> {
    if (!this.db) await this.init();

    const facGbn = config.processName
      ? `${config.plantName} ${config.processName}`.trim()
      : (config.plantName || '1공장 LP');

    // id = 1 고정을 통해 INSERT OR REPLACE 시 기존 1개 행이 항상 업데이트되도록 구현 (진짜 UPSERT)
    // 기존에 존재하던 각 테이블의 최종 동기화 날짜를 유실 없이 보존(COALESCE)하며 설정 정보를 저장합니다.
    await this.run(`
      INSERT OR REPLACE INTO tb_mob_set010 (
        id, fac_gbn, mob_lang, base_url, api1_uri, api2_uri, api3_uri, api4_uri, api5_uri, api6_uri, api7_uri, api8_uri, api9_uri, auto_send_yn,
        sync_date_user, sync_date_equip, sync_date_plan, sync_date_std
      ) VALUES (1, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?,
        COALESCE((SELECT sync_date_user FROM tb_mob_set010 WHERE id = 1), ''),
        COALESCE((SELECT sync_date_equip FROM tb_mob_set010 WHERE id = 1), ''),
        COALESCE((SELECT sync_date_plan FROM tb_mob_set010 WHERE id = 1), ''),
        COALESCE((SELECT sync_date_std FROM tb_mob_set010 WHERE id = 1), '')
      )
    `, [
      facGbn,
      config.defaultLang || 'ko',
      config.baseUrl || '',
      config.userApi || '',
      config.std01Api || '',
      config.std02Api || '',
      config.std03Api || '',
      config.rst01Api || '',
      config.accessTokenApi || '',
      config.refreshTokenApi || '',
      config.versionApi || '',
      config.autoSendYn || 'N'
    ]);

    // 웹 브라우저 가상 DB 데이터를 IndexedDB 디스크 물리 드라이브에 강제 동기화 플러시
    await this.saveToStoreWeb();
  }

  /**
   * 동기화에 성공한 개별 테이블의 최종 동기화 날짜를 기록합니다.
   */
  async updateTableSyncDate(columnName: string, dateStr: string): Promise<void> {
    // columnName이 유효한 동기화 날짜 컬럼명인지 검증 (SQL Injection 예방)
    const validColumns = ['sync_date_user', 'sync_date_equip', 'sync_date_plan', 'sync_date_std'];
    if (!validColumns.includes(columnName)) {
      throw new Error(`Invalid sync date column: ${columnName}`);
    }
    await this.run(`UPDATE tb_mob_set010 SET ${columnName} = ?`, [dateStr]);
    await this.saveToStoreWeb();
  }

  /**
   * 수정 및 상세 조회를 위해 저장 세션 내역을 수집합니다.
   */
  async getInspection(logId: number): Promise<any> {
    const masterRes = await this.query('SELECT * FROM inspections WHERE id = ?', [logId]);
    if (!masterRes.values || masterRes.values.length === 0) return null;
    const master = masterRes.values[0];

    const itemsRes = await this.query('SELECT * FROM inspection_items WHERE inspection_id = ?', [logId]);
    return {
      ...master,
      items: itemsRes.values || []
    };
  }

  /**
   * 점검자가 입력한 점검 결과를 로컬 세션 테이블(UI용)과 공식 실적 테이블(tb_mob_rst130)에 동시에 기록합니다.
   * @param data 저장할 원본 점검 세션 데이터
   * @param logId 수정일 경우 전달될 식별자
   */
  async saveInspection(data: any): Promise<void> {
    if (!this.db) await this.init();
    const { equipmentId, checks, timestamp } = data;

    const currentSettings = get(settings);
    const dbConfig = await this.getConfig();
    const autoSendYn = dbConfig?.autoSendYn || currentSettings.autoSendYn || 'N';
    const online = get(isOnline);
    const isAutoSend = online && autoSendYn === 'Y';

    // 로그인된 사용자 세션 정보 가져오기 (폴백용)
    const user = await this.getUserInfo();
    const activeEmpId = (user?.id || '').trim().toUpperCase();
    const activeEmpNm = user?.name || '';
    const activeFacGbn = user?.fac_gbn || '1';
    const activeUploProcGbn = user?.uploProcGbn || 'U';

    const registTimestamp = Date.now();
    const rawDbRecords: any[][] = [];
    const autoTransmitList: any[] = [];

    // 1단계: 순수 메모리 상에서 데이터 가공 및 배열화
    for (const item of checks) {
      let localDate = new Date();
      if (timestamp) {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
          localDate = parsed;
        }
      }
      const planDay = item.chk_plan_day || toLocalDateString(localDate).replace(/-/g, '');
      const cleanDtm = toLocalDtmString(localDate);
      const chkActionNo = item.chk_action_no || `ACT-${Date.now()}`;

      const chkRslt = item.chk_rslt || (item.status === 'pass' ? 'S' : (item.status === 'stop' ? 'N' : (item.status === 'fail' ? 'F' : '')));
      const chkRsltNm = item.chk_rslt_nm || (chkRslt === 'S' ? '정상' : (chkRslt === 'N' ? '비가동' : (chkRslt === 'F' ? '이상' : '')));
      const isNumeric = item.chk_unit === 'M' || item.chk_unit === 'T';
      const meaVal = isNumeric
        ? ((item.mea_val !== undefined && item.mea_val !== null && String(item.mea_val).trim() !== '') ? item.mea_val : null)
        : null;
      const abnrValYn = chkRslt === 'F' ? 'Y' : 'N';
      const empNo = (item.directnm_emp_no || activeEmpId || '').trim().toUpperCase();
      const empNm = item.directnm_emp_nm || activeEmpNm || '';
      const facGbn = item.fac_gbn || activeFacGbn;
      const uploProcGbn = item.uplo_proc_gbn || activeUploProcGbn;
      const chkItem = item.chk_item || item.chk_item_raw || item.label.slice(0, 5);
      const chkDtl = item.chk_dtl_raw || item.label || '';
      const specialNote = item.note || item.special_note || '';

      // DB 레코드 파라미터 배열 (send_flag는 2단계에서 결정 후 병합)
      rawDbRecords.push([
        item.chk_gbn || '',
        item.chk_gbn_nm || '',
        item.cycle_gbn || '',
        item.cycle_gbn_nm || '',
        chkActionNo,
        planDay,
        item.chk_ordinal || '',
        item.chk_serno || '',
        equipmentId,
        item.chk_fmt || '',
        item.chk_fmt_nm || '',
        chkItem,
        item.chk_item_nm || '',
        chkDtl,
        item.chk_unit || '',
        item.chk_unit_nm || '',
        item.chk_ll || '',
        item.chk_ref || '',
        item.chk_ul || '',
        empNo,
        empNm,
        chkRslt,
        chkRsltNm,
        item.chk_work_gbn || '',
        item.chk_sta_dtm || cleanDtm,
        item.chk_end_dtm || cleanDtm,
        meaVal,
        specialNote,
        facGbn,
        uploProcGbn,
        item.chk_action_nm || '',
        item.chk_item_unit || '',
        abnrValYn,
        item.impt_asset_yn || ''
      ]);

      // 온라인 전송용 대문자 객체 구조 가공
      if (isAutoSend) {
        autoTransmitList.push({
          CHK_GBN: item.chk_gbn || '',
          CHK_GBN_NM: item.chk_gbn_nm || '',
          CYCLE_GBN: item.cycle_gbn || '',
          CYCLE_GBN_NM: item.cycle_gbn_nm || '',
          CHK_ACTION_NO: chkActionNo,
          CHK_PLAN_DAY: planDay,
          CHK_ORDINAL: item.chk_ordinal || '',
          CHK_SERNO: item.chk_serno || '',
          ASSET_ID: equipmentId,
          CHK_FMT: item.chk_fmt || '',
          CHK_FMT_NM: item.chk_fmt_nm || '',
          CHK_ITEM: chkItem,
          CHK_ITEM_NM: item.chk_item_nm || '',
          CHK_DTL: chkDtl,
          CHK_UNIT: item.chk_unit || '',
          CHK_UNIT_NM: item.chk_unit_nm || '',
          CHK_ITEM_UNIT: item.chk_item_unit || '',
          CHK_LL: item.chk_ll || '',
          CHK_REF: item.chk_ref || '',
          CHK_UL: item.chk_ul || '',
          DIRECTNM_EMP_NO: empNo,
          DIRECTNM_EMP_NM: empNm,
          CHK_RSLT: chkRslt,
          CHK_RSLT_NM: chkRsltNm,
          CHK_WORK_GBN: item.chk_work_gbn || '',
          CHK_STA_DTM: item.chk_sta_dtm || cleanDtm,
          CHK_END_DTM: item.chk_end_dtm || cleanDtm,
          MEA_VAL: meaVal === null ? '' : meaVal,
          SPECIAL_NOTE: specialNote,
          FAC_GBN: facGbn,
          UPLO_PROC_GBN: uploProcGbn,
          ABNR_VAL_YN: abnrValYn,
          IMPT_ASSET_YN: item.impt_asset_yn || '',
          RSLT_REGIST_DTM: registTimestamp,
          JQX_CB: ''
        });
      }
    }

    // 2단계: 온라인 모드 및 자동저장 조건 충족 시 온라인 보고 먼저 수행
    let sendFlag = 'N';
    if (isAutoSend && autoTransmitList.length > 0) {
      console.log('[Auto Transmit] 온라인 자동 실적 보고 시도... 건수:', autoTransmitList.length);
      try {
        const { syncStore } = await import('$lib/stores/sync');
        const success = await syncStore.submitDirectPayload(autoTransmitList);
        if (success) {
          sendFlag = 'Y';
          console.log('[Auto Transmit] 온라인 실적 보고 성공! sendFlag = Y 결정');
        } else {
          console.warn('[Auto Transmit] 온라인 실적 보고 실패/응답 오류. sendFlag = N 유지');
        }
      } catch (autoErr) {
        console.error('[Auto Transmit] 온라인 실적 보고 예외 발생. sendFlag = N 유지:', autoErr);
      }
    } else {
      console.log('온라인 보고용이 없음')
    }

    // 3단계: 결정된 sendFlag를 포함하여 SQLite 배치 업설트 (단 1회 executeSet 호출)
    try {
      const upsertStatement = `INSERT OR REPLACE INTO tb_mob_rst130 (
        chk_gbn, chk_gbn_nm, cycle_gbn, cycle_gbn_nm, chk_action_no, chk_plan_day, 
        chk_ordinal, chk_serno, asset_id, chk_fmt, chk_fmt_nm, chk_item, 
        chk_item_nm, chk_dtl, chk_unit, chk_unit_nm, chk_ll, chk_ref, chk_ul, 
        directnm_emp_no, directnm_emp_nm, chk_rslt, chk_rslt_nm, chk_work_gbn, 
        chk_sta_dtm, chk_end_dtm, mea_val, special_note, fac_gbn, uplo_proc_gbn, 
        chk_action_nm, chk_item_unit, abnr_val_yn, impt_asset_yn, send_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const setQueries = rawDbRecords.map(params => ({
        statement: upsertStatement,
        values: [...params, sendFlag]
      }));

      await this.db!.executeSet(setQueries);
      console.log(`[DB Service] tb_mob_rst130 배치 업설트 완료! (총 ${setQueries.length}건, send_flag = ${sendFlag})`);

      if (Capacitor.getPlatform() === 'web' && this.sqlite) {
        await this.sqlite.saveToStore(this.DB_NAME);
      }
    } catch (err) {
      console.error('Save/Update inspection batch failed:', err);
      throw err;
    }
  }

  /**
   * 엑셀 또는 API 응답 배열 정보를 tb_mob_set020 테이블에 일괄 적용합니다.
   * 원천 데이터 정합성 보장을 위해 기존 데이터를 DELETE 한 후 트랜잭션 삽입하며,
   * 필수 지정 관리자 계정('poscotest')은 언제나 최우선 보장되어 강제 병합됩니다.
   * 
   * @param excelUsers 파싱된 점검자 목록 배열
   * @returns 최종 저장된 점검자 수
   */
  async importSet020(excelUsers: ExcelUser[]): Promise<number> {
    if (!excelUsers || !Array.isArray(excelUsers) || excelUsers.length === 0) {
      return 0;
    }
    if (!this.db) await this.init();
    const db = this.db!;

    // 동일한 사용자의 여러 역할을 하나의 행으로 그룹화
    const userMap = new Map<string, ExcelUser & { roles: any[] }>();

    const mergeUser = (user: ExcelUser) => {
      const userIdUpper = (user.mob_user_id || '').trim().toUpperCase();

      // ADMIN, DEV 등 시스템 슈퍼 계정 키워드는 일반 사원 DB 등록 대상에서 필터링 예외 처리
      if (ADMIN_IDS.includes(userIdUpper)) { return; }

      // Map 한글 공정구분 (상공정, 하공정, CP2) to codes (U, L, C)
      const rawProc = (user.uplo_proc_gbn || '').trim();
      let mappedProc = 'U'; // 기본값 상공정
      if (rawProc === '하공정' || rawProc === 'L') {
        mappedProc = 'L';
      } else if (rawProc === 'CP2' || rawProc === 'C' || rawProc === 'LC') {
        mappedProc = 'C';
      } else {
        mappedProc = 'U';
      }

      const key = `${user.fac_gbn || '1'}_${mappedProc}_${userIdUpper}`;
      const existing = userMap.get(key);

      const roleItem = {
        ROLE_CD: user.role_cd,
        ROLE_NM: user.role_nm,
        VALID_PERIOD_STA_DT: user.start_date,
        VALID_PERIOD_END_DT: user.end_date
      };

      if (existing) {
        if (!existing.roles.some(r => r.ROLE_CD === user.role_cd)) {
          existing.roles.push(roleItem);
        }
      } else {
        userMap.set(key, {
          ...user,
          mob_user_id: userIdUpper,
          uplo_proc_gbn: mappedProc,
          roles: [roleItem]
        });
      }
    };

    excelUsers.forEach(mergeUser);

    const finalUsers = Array.from(userMap.values());

    // 1. 기존 데이터 비우기
    await db.execute('DELETE FROM tb_mob_set020');

    // 2. 단일 트랜잭션 일괄 처리 쿼리 셋 빌드 및 브라우저 세션 캐싱 동기화
    const queries = finalUsers.map(user => {
      const rolesJson = JSON.stringify(user.roles);

      // 로컬 스토리지에 이름 및 공정 정보 캐싱 (오프라인 로그인 시 성명 및 공정 세션 복원용)
      if (typeof window !== 'undefined' && window.localStorage) {
        const uObj = {
          id: user.mob_user_id,
          name: user.mob_user_nm || '점검자',
          dept: user.uplo_proc_gbn === 'L' ? '하공정' : (user.uplo_proc_gbn === 'C' ? 'CP2' : '상공정'),
          role: user.roles, // 전체 권한 객체 배열로 캐싱
          companyId: user.co_id || 'POSAR',
          uploProcGbn: user.uplo_proc_gbn || 'U'
        };
        window.localStorage.setItem(`cached_user_${user.mob_user_id}`, JSON.stringify(uObj));
      }

      return {
        statement: `INSERT OR REPLACE INTO tb_mob_set020 (
          fac_gbn, uplo_proc_gbn, mob_user_id, mob_user_nm, co_id, roles_json, mob_user_pw
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: [
          user.fac_gbn,
          user.uplo_proc_gbn,
          user.mob_user_id,
          user.mob_user_nm,
          user.co_id,
          rolesJson,
          encryptPassword(user.mob_user_id) // 초기 패스워드는 암호화하여 저장
        ]
      };
    });

    await this.db!.executeSet(queries);

    if (Capacitor.getPlatform() === 'web' && this.sqlite) {
      await this.sqlite.saveToStore(this.DB_NAME);
    }

    console.log(`[DB Service] Successfully imported ${finalUsers.length} users into tb_mob_set020.`);
    return finalUsers.length;
  }

  /** 하위 호환성 전용 래퍼 메소드 */
  async importUsersFromExcel(excelUsers: any[]): Promise<number> {
    return this.importSet020(excelUsers);
  }

  /**
   * 파싱된 설비 정보를 tb_mob_std120 테이블에 일괄 적용합니다.
   * 기존 설비 정보를 완전히 청소(Delete)한 뒤 트랜잭션을 통해 정합성을 맞춥니다.
   * 
   * @param excelEquips 파싱된 설비 목록 배열
   * @returns 최종 저장된 설비 수
   */
  async importStd120(excelEquips: ExcelEquipment[], upsertOnly: boolean = false): Promise<number> {
    if (!excelEquips || !Array.isArray(excelEquips) || excelEquips.length === 0) {
      return 0;
    }
    if (!this.db) await this.init();
    const db = this.db!;

    if (!upsertOnly) {
      await db.execute('DELETE FROM tb_mob_std120');
    }

    const queries = excelEquips.map(eq => ({
      statement: `INSERT OR REPLACE INTO tb_mob_std120 (
        fac_gbn, uplo_proc_gbn, uplo_proc_gbn_nm, asset_id, asset_nm, proc_cd, proc_nm,
        parent_asset_id, parent_asset_nm, install_loc, strct_fmt, asset_imp_dgr,
        dtl_spec, spec, vol, asset_tp, tag_id,
        asset_csf_cd, large_csf_cd, midd_csf_cd, sml_csf_cd, proc_asset_cd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        eq.fac_gbn || '',
        eq.uplo_proc_gbn || '',
        eq.uplo_proc_gbn_nm || '',
        eq.asset_id,
        eq.asset_nm,
        eq.proc_cd || '',
        eq.proc_nm || '',
        eq.parent_asset_id || '',
        eq.parent_asset_nm || '',
        eq.install_loc || '',
        eq.strct_fmt || '',
        eq.asset_imp_dgr || '',
        eq.dtl_spec || '',
        eq.spec || '',
        eq.vol || '',
        eq.asset_tp || '',
        eq.tag_id || '',
        eq.asset_csf_cd || '',
        eq.large_csf_cd || '',
        eq.midd_csf_cd || '',
        eq.sml_csf_cd || '',
        eq.proc_asset_cd || ''
      ]
    }));

    await this.db!.executeSet(queries);

    if (Capacitor.getPlatform() === 'web' && this.sqlite) {
      await this.sqlite.saveToStore(this.DB_NAME);
    }

    console.log(`[DB Service] Successfully imported ${excelEquips.length} equipment into tb_mob_std120.`);
    return excelEquips.length;
  }

  /** 하위 호환성 전용 래퍼 메소드 */
  async importEquipmentFromExcel(excelEquips: any[]): Promise<number> {
    return this.importStd120(excelEquips);
  }

  /**
   * 파싱된 점검 계획 정보를 tb_mob_std130 테이블에 일괄 적용합니다.
   * 
   * @param excelPlans 파싱된 점검 계획 목록 배열
   * @returns 최종 저장된 계획 수
   */
  async importStd130(excelPlans: ExcelInspectionPlan[], upsertOnly: boolean = false): Promise<number> {
    if (!excelPlans || !Array.isArray(excelPlans) || excelPlans.length === 0) {
      return 0;
    }
    if (!this.db) await this.init();
    const db = this.db!;

    // 빈 값 검증용 헬퍼 함수 (Null/Undefined, 빈 문자열, 공백 문자열 검증)
    const isNotEmpty = (val: any): boolean => {
      if (val === undefined || val === null) return false;
      return String(val).trim() !== '';
    };

    const queries: { statement: string; values: any[] }[] = [];

    // 1. 기존 점검 계획 삭제 처리 (DELETE: 입력 데이터 전체에서 삭제 대상 키 추출)
    if (!upsertOnly) {
      // 전체 덮어쓰기 모드: 전체 점검 계획 초기화
      queries.push({ statement: 'DELETE FROM tb_mob_std130', values: [] });
    } else {
      // 부분 동기화/Upsert 모드: 동기화 대상 목록의 (chk_action_no, chk_ordinal, [fac_gbn]) 세트에 해당하는 기존 계획 삭제
      const targetKeys = new Set<string>();
      for (const plan of excelPlans) {
        if (isNotEmpty(plan.chk_action_no) && isNotEmpty(plan.chk_ordinal)) {
          const facGbn = isNotEmpty(plan.fac_gbn) ? String(plan.fac_gbn).trim() : '';
          const actionNo = String(plan.chk_action_no).trim();
          const ordinal = String(plan.chk_ordinal).trim();

          const key = `${facGbn}|||${actionNo}|||${ordinal}`;
          if (!targetKeys.has(key)) {
            targetKeys.add(key);
            if (facGbn) {
              queries.push({
                statement: `DELETE FROM tb_mob_std130 WHERE fac_gbn = ? AND chk_action_no = ? AND chk_ordinal = ?`,
                values: [facGbn, actionNo, ordinal]
              });
            } else {
              queries.push({
                statement: `DELETE FROM tb_mob_std130 WHERE chk_action_no = ? AND chk_ordinal = ?`,
                values: [actionNo, ordinal]
              });
            }
          }
        }
      }
    }

    // 2. DELETE 처리 후: (plan.fac_gbn && plan.chk_action_no && plan.chk_ordinal !== undefined && plan.chk_ordinal !== null) 및 복합키 조건을 만족하는 데이터만 INSERT 대상(validPlans)으로 수집
    const validPlans: ExcelInspectionPlan[] = [];
    for (const plan of excelPlans) {
      // DELETE 후 인서트 대상 조건 검증 (fac_gbn, chk_action_no, chk_ordinal 필수)
      if (!plan.fac_gbn || !plan.chk_action_no || plan.chk_ordinal === undefined || plan.chk_ordinal === null) {
        continue;
      }

      if (!isNotEmpty(plan.uplo_proc_gbn)) {
        throw new Error('점검 계획 데이터 중 공정 구분(uplo_proc_gbn)이 누락된 항목이 있습니다.');
      }

      // 5대 복합키(chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item) 누락 검증
      if (
        !isNotEmpty(plan.chk_action_no) ||
        !isNotEmpty(plan.chk_ordinal) ||
        !isNotEmpty(plan.asset_id) ||
        !isNotEmpty(plan.chk_fmt) ||
        !isNotEmpty(plan.chk_item)
      ) {
        console.warn('[DB Service] 필수 복합키 누락으로 인해 점검 계획 항목 업설트 스킵:', {
          chk_action_no: plan.chk_action_no,
          chk_ordinal: plan.chk_ordinal,
          asset_id: plan.asset_id,
          chk_fmt: plan.chk_fmt,
          chk_item: plan.chk_item
        });
        continue;
      }

      validPlans.push(plan);
    }

    if (queries.length === 0 && validPlans.length === 0) {
      console.warn('[DB Service] 유효한 점검 계획 항목이나 삭제 처리 대상이 없어 작업을 수행하지 않습니다.');
      return 0;
    }

    // 3. 누락된 설비 세부 사양 (상하공정구분, 설비명) 실시간 매핑용 메모리 매핑 맵 빌드 (성능 극대화)
    const eqRes = await db.query('SELECT asset_id, asset_nm, uplo_proc_gbn FROM tb_mob_std120');
    const eqMap = new Map<string, { asset_nm: string; uplo_proc_gbn: string }>();
    if (eqRes.values) {
      eqRes.values.forEach((eq: any) => {
        eqMap.set(eq.asset_id, { asset_nm: eq.asset_nm, uplo_proc_gbn: eq.uplo_proc_gbn });
      });
    }

    for (const plan of validPlans) {

      // 설비 ID 매칭으로 설비명 스마트 Lookup
      const eqInfo = eqMap.get(plan.asset_id) || { asset_nm: '' };
      const asset_nm = plan.asset_nm || eqInfo.asset_nm || '';

      // A. tb_mob_std130 적재 쿼리 푸시
      queries.push({
        statement: `INSERT OR REPLACE INTO tb_mob_std130 (
          chk_gbn, chk_gbn_nm, cycle_gbn, cycle_gbn_nm, chk_action_no, chk_plan_day, 
          chk_ordinal, chk_serno, asset_id, chk_fmt, chk_fmt_nm, chk_item, 
          chk_item_nm, chk_dtl, chk_unit, chk_unit_nm, chk_ll, chk_ref, chk_ul, 
          directnm_emp_no, directnm_emp_nm, chk_rslt, chk_rslt_nm, chk_work_gbn, 
          chk_sta_dtm, chk_end_dtm, mea_val, special_note, fac_gbn, uplo_proc_gbn, 
          chk_action_nm, asset_nm, chk_item_unit, cycle_sta_mnt, cycle_week, 
          cycle_wkday, abnr_val_yn, impt_asset_yn, reltd_tag_nm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          plan.chk_gbn || '',
          plan.chk_gbn_nm || '',
          plan.cycle_gbn || '',
          plan.cycle_gbn_nm || '',
          plan.chk_action_no,
          plan.chk_plan_day || '',
          plan.chk_ordinal || '',
          plan.chk_serno || '',
          plan.asset_id,
          plan.chk_fmt || '',
          plan.chk_fmt_nm || '',
          plan.chk_item || '',
          plan.chk_item_nm || '',
          plan.chk_dtl || '',
          plan.chk_unit || '',
          plan.chk_unit_nm || '',
          plan.chk_ll || '',
          plan.chk_ref || '',
          plan.chk_ul || '',
          (plan.directnm_emp_no || '').trim().toUpperCase(),
          plan.directnm_emp_nm || '',
          plan.chk_rslt || '',
          plan.chk_rslt_nm || '',
          plan.chk_work_gbn || '',
          plan.chk_sta_dtm || '',
          plan.chk_end_dtm || '',
          plan.mea_val || '',
          plan.special_note || '',
          plan.fac_gbn || '',
          plan.uplo_proc_gbn || '',
          plan.chk_action_nm || '',
          asset_nm,
          plan.chk_item_unit_nm || plan.chk_item_unit || '',
          plan.cycle_sta_mnt || '',
          plan.cycle_week || '',
          plan.cycle_wkday || '',
          plan.abnr_val_yn || '',
          plan.impt_asset_yn || '',
          plan.reltd_tag_nm || ''
        ]
      });

      // B. 결과 데이터(chk_rslt 또는 mea_val)가 기등록되어 있는 경우, tb_mob_rst130에도 Upsert 수행
      const hasResult = isNotEmpty(plan.chk_rslt) || isNotEmpty(plan.mea_val);
      if (hasResult) {
        queries.push({
          statement: `INSERT OR REPLACE INTO tb_mob_rst130 (
            chk_gbn, chk_gbn_nm, cycle_gbn, cycle_gbn_nm, chk_action_no, chk_plan_day, 
            chk_ordinal, chk_serno, asset_id, chk_fmt, chk_fmt_nm, chk_item, 
            chk_item_nm, chk_dtl, chk_unit, chk_unit_nm, chk_ll, chk_ref, chk_ul, 
            directnm_emp_no, directnm_emp_nm, chk_rslt, chk_rslt_nm, chk_work_gbn, 
            chk_sta_dtm, chk_end_dtm, mea_val, special_note, fac_gbn, uplo_proc_gbn, 
            chk_action_nm, asset_nm, chk_item_unit, abnr_val_yn, impt_asset_yn, send_flag
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            plan.chk_gbn || '',
            plan.chk_gbn_nm || '',
            plan.cycle_gbn || '',
            plan.cycle_gbn_nm || '',
            plan.chk_action_no,
            plan.chk_plan_day || '',
            plan.chk_ordinal || '',
            plan.chk_serno || '',
            plan.asset_id,
            plan.chk_fmt || '',
            plan.chk_fmt_nm || '',
            plan.chk_item || '',
            plan.chk_item_nm || '',
            plan.chk_dtl || '',
            plan.chk_unit || '',
            plan.chk_unit_nm || '',
            plan.chk_ll || '',
            plan.chk_ref || '',
            plan.chk_ul || '',
            (plan.directnm_emp_no || '').trim().toUpperCase(),
            plan.directnm_emp_nm || '',
            plan.chk_rslt || '',
            plan.chk_rslt_nm || '',
            plan.chk_work_gbn || '',
            plan.chk_sta_dtm || '',
            plan.chk_end_dtm || '',
            plan.mea_val || '',
            plan.special_note || '',
            plan.fac_gbn || '',
            plan.uplo_proc_gbn || '',
            plan.chk_action_nm || '',
            asset_nm,
            plan.chk_item_unit_nm || '',
            plan.abnr_val_yn || '',
            plan.impt_asset_yn || '',
            'Y' // 이미 외부 시스템/Excel로부터 반영된 결과이므로 'Y'로 저장
          ]
        });
      }
    }

    if (queries.length > 0) {
      await this.db!.executeSet(queries);
    }

    if (Capacitor.getPlatform() === 'web' && this.sqlite) {
      await this.sqlite.saveToStore(this.DB_NAME);
    }

    console.log(`[DB Service] Successfully imported ${validPlans.length} plans into tb_mob_std130 with dynamic asset mapping.`);
    return validPlans.length;
  }

  /** 하위 호환성 전용 래퍼 메소드 */
  async importInspectionPlansFromExcel(excelPlans: any[]): Promise<number> {
    return this.importStd130(excelPlans);
  }

  /**
   * 파싱된 점검 표준 정보를 tb_mob_std110 테이블에 일괄 적용합니다.
   * 
   * @param excelStds 파싱된 점검 표준 코드 목록 배열
   * @returns 최종 저장된 표준 코드 수
   */
  async importStd110(excelStds: ExcelInspectionStd[], upsertOnly: boolean = false): Promise<number> {
    if (!excelStds || !Array.isArray(excelStds) || excelStds.length === 0) {
      return 0;
    }
    if (!this.db) await this.init();
    const db = this.db!;

    if (!upsertOnly) {
      await db.execute('DELETE FROM tb_mob_std110');
    }

    const queries = excelStds.map(std => ({
      statement: `INSERT OR REPLACE INTO tb_mob_std110 (
        master_cd, master_nm, lang, cd_val, cd_nm, cd_desc, display_seq, use_yn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        std.master_cd,
        std.master_nm,
        std.lang_cd,
        std.cd_val,
        std.cd_nm,
        std.cd_desc,
        std.disp_seq,
        std.use_yn
      ]
    }));

    await this.db!.executeSet(queries);

    if (Capacitor.getPlatform() === 'web' && this.sqlite) {
      await this.sqlite.saveToStore(this.DB_NAME);
    }

    console.log(`[DB Service] Successfully imported ${excelStds.length} standards into tb_mob_std110.`);
    return excelStds.length;
  }

  /** 하위 호환성 전용 래퍼 메소드 */
  async importInspectionStdsFromExcel(excelStds: any[]): Promise<number> {
    return this.importStd110(excelStds);
  }



  /**
   * 세션 쿠키 또는 SQLite 백업 설정에서 현재 로그인한 사용자 정보를 취득합니다.
   */
  async getUserInfo(): Promise<any | null> {
    let userStr = null;
    if (typeof document !== 'undefined') {
      const nameEQ = "currentUser=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
          userStr = decodeURIComponent(c.substring(nameEQ.length, c.length));
          break;
        }
      }
    }
    if (!userStr) {
      userStr = await this.getSetting('current_user');
    }
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('[DB Service] Failed to parse user info:', e);
      return null;
    }
  }

  /**
   * 시스템 환경 설정 값을 조회합니다 (localStorage 이관을 통해 SQLite 테이블 비대화 및 I/O 락 방지).
   */
  async getSetting(key: string): Promise<any> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`sys_setting_${key}`);
    }
    return null;
  }

  /**
   * 시스템 환경 설정 값을 입력하거나 갱신합니다 (localStorage 이관을 통해 SQLite 테이블 비대화 및 I/O 락 방지).
   */
  async setSetting(key: string, value: string | null): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      if (value === null) {
        localStorage.removeItem(`sys_setting_${key}`);
      } else {
        localStorage.setItem(`sys_setting_${key}`, value);
      }
    }
  }

  /**
   * 설비 사양 정보(tb_mob_std120)를 조회하고 다중 조건부 실시간 검색 및 페이징 처리를 전천후 지원합니다.
   * 설비 조회 화면(+page.svelte)과 QR 스캐너 수동 선택 팝업에서 동일하게 공유 호출하는 핵심 재사용 API입니다.
   */
  async getEquipmentSpecs(options: {
    keyword?: string;
    limit?: number;
    offset?: number;
    searchBy?: 'id' | 'all';
  } = {}): Promise<any[]> {
    if (!this.db) await this.init();
    const db = this.db!;

    const limit = options.limit ?? -1;
    const offset = options.offset ?? 0;
    const keyword = options.keyword ? options.keyword.trim() : '';
    const searchBy = options.searchBy ?? 'all';

    // 사용자 세션에서 공정 구분 값을 가져옴
    const user = await this.getUserInfo();
    const sessionUploProcGbn = user?.uploProcGbn || '';

    const whereClauses: string[] = [];
    const params: any[] = [];

    // 세션의 공정 구분 값이 있으면 WHERE 조건에 추가
    if (sessionUploProcGbn) {
      whereClauses.push('uplo_proc_gbn = ?');
      params.push(sessionUploProcGbn);
    }

    if (keyword) {
      const pattern = `%${keyword}%`;
      if (searchBy === 'id') {
        whereClauses.push('asset_id LIKE ?');
        params.push(pattern);
      } else {
        whereClauses.push('(asset_nm LIKE ? OR asset_id LIKE ? OR install_loc LIKE ? OR asset_tp LIKE ? OR spec LIKE ?)');
        params.push(pattern, pattern, pattern, pattern, pattern);
      }
    }

    let sql = 'SELECT * FROM tb_mob_std120';
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // 정렬 순서 결정
    if (keyword && searchBy === 'id') {
      sql += ' ORDER BY asset_id ASC';
    } else {
      sql += ' ORDER BY asset_nm ASC';
    }

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    const res = await db.query(sql, params);
    return res.values || [];
  }

  /**
   * 지정된 계획일자에 따르는 오늘의 점검 설비 목록과 각 설비별 점검 진행 상황을 수집합니다. (플랜데이 단독 조회 및 공정코드/주기 다국어 매핑)
   */
  async getInspectionTasksByDate(planDay: string, empId: string, uploProcGbn: string = "", lang: string = 'ko'): Promise<any[]> {
    if (!this.db) await this.init();
    const db = this.db!;

    const dbLang = lang === 'es' ? 'EN' : 'KO';

    let sql = `
      SELECT 
        p.chk_action_no,
        p.chk_action_nm,
        p.chk_ordinal,
        p.chk_serno,
        p.asset_id,
        p.asset_nm,
        p.chk_item,
        COALESCE(c1.cd_nm, p.chk_item) as chk_item_nm,
        p.chk_dtl,
        p.chk_gbn,
        p.cycle_gbn,
        COALESCE(c3.cd_nm, p.chk_gbn) as chk_gbn_nm,
        COALESCE(c4.cd_nm, p.cycle_gbn) as cycle_gbn_nm,
        e.install_loc,
        COALESCE(r.chk_rslt, p.chk_rslt) as chk_rslt
      FROM tb_mob_std130 p
      LEFT JOIN tb_mob_std120 e ON p.asset_id = e.asset_id AND p.fac_gbn = e.fac_gbn AND p.uplo_proc_gbn = e.uplo_proc_gbn
      LEFT JOIN tb_mob_rst130 r ON p.asset_id = r.asset_id 
        AND p.chk_action_no = r.chk_action_no 
        AND p.chk_ordinal = r.chk_ordinal 
        AND p.chk_serno = r.chk_serno
        AND p.chk_fmt = r.chk_fmt
        AND p.chk_plan_day = r.chk_plan_day
        AND p.chk_item = r.chk_item
      LEFT JOIN tb_mob_std110 c1 ON c1.master_cd = 'EAM_CHK_ITEM' AND c1.cd_val = p.chk_item AND c1.lang = ? AND c1.use_yn = 'Y'
      LEFT JOIN tb_mob_std110 c3 ON c3.master_cd = 'EAM_CHK_GBN' AND c3.cd_val = p.chk_gbn AND c3.lang = ? AND c3.use_yn = 'Y'
      LEFT JOIN tb_mob_std110 c4 ON c4.master_cd = 'EAM_CYCLE_GBN' AND c4.cd_val = p.cycle_gbn AND c4.lang = ? AND c4.use_yn = 'Y'
      WHERE p.chk_plan_day = ? AND p.directnm_emp_no = ?
    `;

    const params = [dbLang, dbLang, dbLang, planDay, empId];

    if (uploProcGbn) {
      sql += ` AND p.uplo_proc_gbn = ?`;
      params.push(uploProcGbn);
    }

    sql += ` ORDER BY p.chk_action_no ASC, CAST(p.chk_ordinal AS INTEGER) ASC, CAST(p.chk_serno AS INTEGER) ASC`;
    const res = await db.query(sql, params);
    return res.values || [];
  }

  /**
   * 특정 설비의 해당 계획일자의 상세 점검 계획 목록을 조회합니다.
   * @param assetId 설비 ID
   * @param planDay 계획일자 (YYYYMMDD)
   * @param lang 언어 구분 ('ko' | 'es')
   */
  async getInspectionPlans(assetId: string, planDay: string, empId: string = '', uploProcGbn: string = '', lang: string = 'ko'): Promise<any[]> {
    if (!this.db) await this.init();
    const db = this.db!;
    const dbLang = lang === 'es' ? 'EN' : 'KO';

    if (!empId) {
      console.warn('[DB Service] getInspectionPlans called without empId. Returning empty list.');
      return [];
    }

    let sql = `
      SELECT 
        p.*,
        r.chk_rslt as saved_chk_rslt,
        r.mea_val as saved_mea_val,
        r.special_note as saved_special_note,
        c1.cd_nm as chk_item_nm,
        c2.cd_nm as chk_fmt_nm,
        c3.cd_nm as chk_gbn_nm,
        c4.cd_nm as cycle_gbn_nm
      FROM tb_mob_std130 p
      LEFT JOIN tb_mob_rst130 r ON p.asset_id = r.asset_id 
        AND p.chk_action_no = r.chk_action_no 
        AND p.chk_ordinal = r.chk_ordinal 
        AND p.chk_serno = r.chk_serno
        AND p.chk_fmt = r.chk_fmt
        AND p.chk_plan_day = r.chk_plan_day
        AND p.chk_item = r.chk_item
      LEFT JOIN tb_mob_std110 c1 ON c1.master_cd = 'EAM_CHK_ITEM' AND c1.cd_val = p.chk_item AND c1.lang = ? AND c1.use_yn = 'Y'
      LEFT JOIN tb_mob_std110 c2 ON c2.master_cd = 'EAM_CHK_FMT' AND c2.cd_val = p.chk_fmt AND c2.lang = ? AND c2.use_yn = 'Y'
      LEFT JOIN tb_mob_std110 c3 ON c3.master_cd = 'EAM_CHK_GBN' AND c3.cd_val = p.chk_gbn AND c3.lang = ? AND c3.use_yn = 'Y'
      LEFT JOIN tb_mob_std110 c4 ON c4.master_cd = 'EAM_CYCLE_GBN' AND c4.cd_val = p.cycle_gbn AND c4.lang = ? AND c4.use_yn = 'Y'
      WHERE p.asset_id = ? AND p.chk_plan_day = ? AND p.directnm_emp_no = ?
    `;

    const params = [dbLang, dbLang, dbLang, dbLang, assetId, planDay, empId];

    if (uploProcGbn) {
      sql += ` AND p.uplo_proc_gbn = ?`;
      params.push(uploProcGbn);
    }

    sql += ` ORDER BY p.chk_action_no ASC, CAST(p.chk_ordinal AS INTEGER) ASC, CAST(p.chk_serno AS INTEGER) ASC`;

    const res = await db.query(sql, params);
    return res.values || [];
  }

  /**
   * 특정 설비의 특정 점검 항목에 대한 최근 5건의 점검 이력을 조회합니다. (값 기준 null/공백 제외)
   * @param assetId 설비 ID
   * @param chkItem 점검 항목 ID
   * @returns 최근 5건의 이력 배열
   */
  async getItemHistory(assetId: string, chkItem: string): Promise<any[]> {
    if (!this.db) await this.init();
    const db = this.db!;
    const sql = `
      SELECT 
        chk_plan_day,
        COALESCE(chk_end_dtm, chk_sta_dtm) as raw_timestamp,
        mea_val,
        chk_rslt
      FROM tb_mob_rst130
      WHERE asset_id = ?
        AND chk_item = ?
        AND (
          (mea_val IS NOT NULL AND TRIM(mea_val) != '')
          OR
          (chk_rslt IS NOT NULL AND TRIM(chk_rslt) != '')
        )
      ORDER BY chk_plan_day DESC, raw_timestamp DESC
      LIMIT 20
    `;
    const res = await db.query(sql, [assetId, chkItem]);
    return res.values || [];
  }

  /**
   * 점검 이력을 조회합니다. (검색어 및 기간 필터 지원)
   */
  async getInspectionHistory(
    query: string = "",
    filters: { startDate?: string; endDate?: string; empId?: string; uploProcGbn?: string } = {}
  ): Promise<any[]> {
    if (!this.db) await this.init();
    const db = this.db!;

    let sql = `
      SELECT 
        p.chk_action_no || '_' || p.chk_plan_day AS id,
        p.chk_action_no,
        p.chk_plan_day,
        COALESCE(MAX(r.chk_end_dtm), MAX(r.chk_sta_dtm), MAX(p.chk_end_dtm), MAX(p.chk_sta_dtm)) as raw_timestamp,
        MAX(r.special_note) as memo,
        COALESCE(MAX(r.send_flag), 'N') as raw_send_flag,
        MAX(e.asset_nm) as equipment_name,
        MAX(e.install_loc) as location,
        1 as is_active,
        COUNT(p.chk_serno) as total_count,
        SUM(CASE WHEN r.chk_rslt IN ('S', 'F', 'N') THEN 1 ELSE 0 END) as completed_count
      FROM tb_mob_std130 p
      LEFT JOIN tb_mob_rst130 r ON p.chk_action_no = r.chk_action_no 
                               AND p.chk_plan_day = r.chk_plan_day 
                               AND p.chk_ordinal = r.chk_ordinal 
                               AND p.asset_id = r.asset_id 
                               AND p.chk_fmt = r.chk_fmt 
                               AND p.chk_item = r.chk_item
      LEFT JOIN tb_mob_std120 e ON p.asset_id = e.asset_id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    // 파라미터로 empId가 전달되면 해당 ID를 사용하고, 없으면 현재 로그인한 사용자 정보에서 취득
    let empId = filters.empId;
    if (!empId) {
      const user = await this.getUserInfo();
      empId = user?.id || "";
    }

    if (empId) {
      whereClauses.push(`p.directnm_emp_no = ?`);
      params.push(empId);
    }

    // 파라미터로 uploProcGbn이 전달되면 해당 값을 사용하고, 없으면 현재 로그인한 사용자 정보에서 취득
    let uploProcGbn = filters.uploProcGbn;
    if (!uploProcGbn) {
      const user = await this.getUserInfo();
      uploProcGbn = user?.uplo_proc_gbn || "";
    }

    if (uploProcGbn) {
      whereClauses.push(`p.uplo_proc_gbn = ?`);
      params.push(uploProcGbn);
    }

    if (query) {
      whereClauses.push(`p.chk_action_no LIKE ?`);
      params.push(`%${query}%`);
    }

    if (filters.startDate) {
      const startDay = filters.startDate.replace(/-/g, "");
      whereClauses.push(`p.chk_plan_day >= ?`);
      params.push(startDay);
    }

    if (filters.endDate) {
      const endDay = filters.endDate.replace(/-/g, "");
      whereClauses.push(`p.chk_plan_day <= ?`);
      params.push(endDay);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    sql += ` GROUP BY p.chk_action_no, p.chk_plan_day`;
    sql += ` ORDER BY p.chk_plan_day DESC, p.chk_action_no ASC LIMIT 100`;

    const res = await db.query(sql, params);

    return res?.values || [];
  }

  /**
   * 송신할 점검 실적 레코드를 조건 조회합니다.
   * @param params 조회 필터 파라미터 객체
   * @param params.empId 점검자 사번 ID
   * @param params.facGbn 공장 구분 코드
   * @param params.uploProcGbn 공정 구분 코드
   * @param params.onlyUnsent 미전송 상태인 실적만 조회 여부 (선택)
   * @param params.minPlanDay 특정 점검일시 이후의 실적 조회 (선택)
   */
  async getTransmitRecords(params: {
    empId: string;
    facGbn: string;
    uploProcGbn: string;
    onlyUnsent?: boolean;
    minPlanDay?: string;
  }): Promise<any[]> {
    if (!this.db) await this.init();

    const { empId, facGbn, uploProcGbn, onlyUnsent, minPlanDay } = params;

    let sql = 'SELECT * FROM tb_mob_rst130 WHERE directnm_emp_no = ? AND fac_gbn = ? AND uplo_proc_gbn = ?';
    const dbParams: any[] = [empId, facGbn, uploProcGbn];

    if (onlyUnsent) {
      sql += " AND (send_flag = 'N' OR send_flag IS NULL)";
    }
    if (minPlanDay) {
      sql += " AND chk_sta_dtm >= ?";
      dbParams.push(minPlanDay);
    }

    const res = await this.db!.query(sql, dbParams);
    return res.values || [];
  }

  /**
   * 1년 이상 경과하고 서버 송신 완료(send_flag = 'Y')된 점검실적 데이터를 안전하게 삭제합니다.
   * @returns 삭제된 행의 개수
   */
  async purgeOldRecords(): Promise<number> {
    if (!this.db) await this.init();

    const query = `
      DELETE FROM tb_mob_rst130 
      WHERE chk_plan_day < strftime('%Y%m%d', 'now', '-1 year', 'localtime')
        AND send_flag = 'Y'
    `;
    try {
      const result = await this.db!.run(query);
      const changes = result?.changes?.changes !== undefined
        ? result.changes.changes
        : (typeof result?.changes === 'number' ? result.changes : 0);
      console.log(`[DB] 1년 이상 경과한 전송완료 실적 정리 완료 (삭제건수: ${changes}건)`);
      return changes;
    } catch (err) {
      console.error('[DB Error] Failed to purge old records:', err);
      return 0;
    }
  }
}

export const dbService = new DatabaseService();


import { writable, get } from 'svelte/store';
import { dbService } from '$lib/services/database';
import { settings } from './settings';
import { lang } from './lang';
import { isOnline } from './network';
import * as authService from '$lib/services/authService';
import type { User } from '$lib/services/authService';
import { toLocalDateString } from '$lib/utils/date';

export type { User };

export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
}

function getInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { isLoggedIn: false, user: null };
  }

  try {
    const storedUser = authService.getCookie('currentUser') || authService.getCookie('securescan_user');
    if (storedUser) {
      return { isLoggedIn: true, user: JSON.parse(storedUser) };
    }
  } catch (e) {
    console.error('[Auth Store] 초기 동기 세션 복원 실패:', e);
  }
  return { isLoggedIn: false, user: null };
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(getInitialState());

  return {
    subscribe,
    /**
     * 초기화: 백그라운드에서 SQLite DB 백업 싱크 및 오프라인 세션 복원 수행
     */
    init: async (): Promise<void> => {
      if (typeof window === 'undefined') return;

      try {
        let storedUser = authService.getCookie('currentUser') || authService.getCookie('securescan_user');

        // 1. 쿠키에 세션이 없는 경우, 앱이 완전히 새 브라우저 세션(앱 재시작 등)으로 구동되었음을 의미하므로
        // SQLite에 잔존하는 백업 세션 정보가 있더라도 강제로 파기하여 자동 로그오프를 완성시킵니다.
        if (!storedUser) {
          await dbService.setSetting('current_user', null);
          await dbService.setSetting('active_user', null);
          set({ isLoggedIn: false, user: null });
        } else {
          // 2. 세션이 유지되고 있는 경우, SQLite 백업 싱크 유지
          await dbService.setSetting('current_user', storedUser);
        }
      } catch (e) {
        console.error('[Auth Store] 백그라운드 세션 싱크 실패:', e);
      }
    },
    /**
     * 온라인 MES API 로그인 시도 & 오프라인 SQLite 폴백 로직 (투트랙 선제적 제어)
     */
    login: async (empIdInput: string, password: string, signal?: AbortSignal, forceFlag?: string): Promise<{ success: boolean; errorType?: string; errorMsg?: { ko: string; es: string } }> => {
      const empId = (empIdInput || '').trim().toUpperCase();
      const currentLang = get(lang);

      let user: User | undefined = undefined;
      let errorType: string | undefined = undefined;
      let errorMsg: { ko: string; es: string } | undefined = undefined;

      // 2. 네트워크 상태 판별 (isOnline 스토어 기반 선제적 분기)
      const online = get(isOnline);

      // 1.슈퍼어드민 계정 예외처리
      const superAdmin = empId === 'ADMIN' && password === 'admin1!';
      const dev = empId === 'DEV' && password === 'sis123#@!';
      const today = toLocalDateString();

      if (superAdmin || dev) {
        user = {
          id: empId, name: '포스코관리자', accToken: '', rfToken: '', role: [
            { ROLE_CD: 'COM_ADM_MOB', VALID_PERIOD_STA_DT: today, VALID_PERIOD_END_DT: '9999-12-31' },
            { ROLE_CD: 'COM_EAM_MOB', VALID_PERIOD_STA_DT: today, VALID_PERIOD_END_DT: '9999-12-31' }
          ]
        };
      } else if (!online) {
        // [OFFLINE TRACK] 기기가 오프라인 상태일 때는 즉각 로컬 SQLite 대조
        const offlineResult = await authService.offlineLoginFallback(empId, password);
        if (offlineResult.success && offlineResult.user) {
          user = offlineResult.user;
        } else {
          errorType = 'invalidCredentials';
          errorMsg = {
            ko: '아이디 또는 비밀번호가 올바르지 않습니다.',
            es: 'El usuario o la contraseña son incorrectos.'
          };
        }
      } else {
        // [ONLINE TRACK] 기기가 온라인 상태일 때는 API 호출만 전념
        const currentSettings = get(settings);
        const baseUrl = (currentSettings.baseUrl || '').trim();

        if (!baseUrl) {
          errorType = 'missingUrl';
          errorMsg = {
            ko: '기본 URL이 설정되어 있지 않습니다. 환경설정에서 입력해 주세요.',
            es: 'La dirección del servidor (URL base) no está configurada en los ajustes.'
          };
        } else {
          const onlineResult = await authService.onlineLogin(empId, password, baseUrl, currentLang, signal, forceFlag);

          if (signal?.aborted) {
            return {
              success: false,
              errorType: 'loginCancelled',
              errorMsg: {
                ko: '로그인이 취소되었습니다.',
                es: 'Inicio de sesión cancelado.'
              }
            };
          }

          if (onlineResult.success && onlineResult.data) {
            const data = onlineResult.data;

            // 오프라인 계정 DB에 해당 계정이 없으면 자동 등록 (비밀번호: 아이디 암호화)
            await authService.saveOfflineUserIfNotExist(empId, data);

            const localUser = await authService.resolveLocalUser(empId, data.UPLO_PROC_GBN);
            const companyId = data.COMPANY_ID || '';
            const calculatedFacGbn = companyId.replace('POSAR', '');

            user = {
              id: empId,
              name: localUser.name,
              accToken: data.ACCESS_TOKEN || '',
              rfToken: data.REFRESH_TOKEN || '',
              companyId,
              uploProcGbn: authService.normalizeProcessType(data.UPLO_PROC_GBN) || localUser.uploProcGbn || 'U',
              fac_gbn: calculatedFacGbn,
              role: data.ROLE_INFO
            };
          } else {
            errorType = onlineResult.errorType || 'invalidCredentials';
            errorMsg = onlineResult.errorMsg;
          }
        }
      }

      // 3. 공통 세션 생성 및 결과 반환
      if (!user) {
        return { success: false, errorType, errorMsg };
      }
      set({ isLoggedIn: true, user });
      await authService.saveAuthSession(user);

      return { success: true };
    },
    /**
     * 로그아웃
     */
    logout: async (): Promise<void> => {
      const state = get(auth);
      const user = state.user;
      const online = get(isOnline);
      const baseUrl = (get(settings).baseUrl || '').trim();

      // 온라인 모드로 로그인한 경우(온라인 상태 및 acc, rf 토큰 보유)에만 로그아웃 API 호출
      if (online && user?.id && baseUrl && user.accToken && user.rfToken) {
        authService.logoutApi(baseUrl, user.id);
      }

      set({ isLoggedIn: false, user: null });
      authService.setCookie('currentUser', null);
      authService.setCookie('securescan_user', null);
      authService.setCookie('securescan_session', null);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('securescan_user');
      localStorage.removeItem('securescan_session');
      await dbService.setSetting('current_user', null);
      await dbService.setSetting('active_user', null);
      await dbService.setSetting('session', null);
    },
    /**
     * 앱 종료 시 UI 반응(로그인 화면 전환/깜빡임) 없이 쿠키 및 DB 세션만 조용히 파기
     */
    clearSessionSilent: async (): Promise<void> => {
      authService.setCookie('currentUser', null);
      authService.setCookie('securescan_user', null);
      authService.setCookie('securescan_session', null);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('securescan_user');
      localStorage.removeItem('securescan_session');
      await dbService.setSetting('current_user', null);
      await dbService.setSetting('active_user', null);
      await dbService.setSetting('session', null);
    },
    /**
     * 엑세스 토큰 인증/검증
     */
    validateAccessToken: async (): Promise<boolean> => {
      const state = get(auth);
      if (!state.isLoggedIn || !state.user || !state.user.accToken) {
        console.log('[Auth Store] validateAccessToken success: false (No active session or access token)');
        return false;
      }

      const currentSettings = get(settings);
      const baseUrl = (currentSettings.baseUrl || '').trim();
      const accessTokenApi = (currentSettings.accessTokenApi || '/SCOM/auth/me').trim();

      if (!baseUrl) {
        console.log('[Auth Store] validateAccessToken success: false (Base URL is not configured)');
        return false;
      }

      const result = await authService.verifyAccessToken(baseUrl, accessTokenApi, state.user.accToken);
      console.log('[Auth Store] validateAccessToken success:', result.success);
      return result.success;
    },
    /**
     * 리프레시 토큰 인증 및 세션 연장
     */
    refreshSession: async (): Promise<{ success: boolean; error?: string; data?: any }> => {
      const state = get(auth);
      if (!state.isLoggedIn || !state.user || !state.user.rfToken) {
        return { success: false, error: 'No active session or refresh token.' };
      }

      const currentSettings = get(settings);
      const baseUrl = (currentSettings.baseUrl || '').trim();
      const refreshTokenApi = (currentSettings.refreshTokenApi || '/SCOM/auth/refresh').trim();

      if (!baseUrl) {
        return { success: false, error: 'Base URL is not configured.' };
      }

      const result = await authService.refreshAccessToken(baseUrl, refreshTokenApi, state.user.rfToken);
      if (result.success && result.accessToken) {
        const updatedUser = {
          ...state.user,
          accToken: result.accessToken,
          rfToken: result.refreshToken || state.user.rfToken
        };
        set({ isLoggedIn: true, user: updatedUser });
        await authService.saveAuthSession(updatedUser);
        return { success: true, data: result.data };
      }

      return { success: false, error: result.error, data: result.data };
    }
  };
}

export const auth = createAuthStore();

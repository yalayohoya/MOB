import { dbService } from './database';
import { fetchWithTimeout } from './apiHelper';
import { encryptPassword } from '$lib/utils/crypto';
import { Capacitor } from '@capacitor/core';

export interface User {
  id: string;
  name: string;
  accToken: string;
  rfToken: string;
  companyId?: string;
  uploProcGbn?: string;
  fac_gbn?: string;
  role?: string | { ROLE_CD: string; VALID_PERIOD_STA_DT: string; VALID_PERIOD_END_DT: string; }[];
}

/**
 * 모바일 기기 UUID 또는 브라우저용 소문자 16자리 임의 고유 ID 취득
 */
export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'unknown_device';

  let deviceId = localStorage.getItem('device_id');
  if (deviceId) {
    return deviceId;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getId();
      const uuid = info.identifier || (info as any).uuid;
      if (uuid) {
        localStorage.setItem('device_id', uuid);
        return uuid;
      }
    }
  } catch (e) {
    console.warn('[Device Service] Failed to get native device ID, using browser fallback:', e);
  }

  // 16자리 소문자 Hex 임의 고유 ID 생성 (안드로이드 ANDROID_ID 포맷 매칭)
  const chars = '0123456789abcdef';
  let genId = '';
  for (let i = 0; i < 16; i++) {
    genId += chars[Math.floor(Math.random() * chars.length)];
  }
  localStorage.setItem('device_id', genId);
  return genId;
}

/**
 * 백엔드 에러 코드 한글/스페인어 번역 매핑
 */
export function getBackendErrorMessage(resultCode: string, resultMessage: string, lang: string): string {
  const errorMap: Record<string, string> = {
    'R101': lang === 'es' ? 'Fallo en el procesamiento general (R101)' : '요청 처리 실패 (R101)',
    'R201': lang === 'es' ? 'Error al procesar el inicio de sesión (R201)' : '로그인 처리 중 오류 발생 (R201)',
    'R203': lang === 'es' ? 'No tiene permisos de acceso móvil (R203)' : '모바일 접속 권한이 없습니다 (R203)',
    'A401': lang === 'es' ? 'Falta el encabezado de autorización (A401)' : 'Authorization 헤더가 없습니다 (A401)',
    'A402': lang === 'es' ? 'Token de acceso no válido (A402)' : '유효하지 않은 토큰입니다 (A402)',
    'A403': lang === 'es' ? 'El token ha expirado (A403)' : '만료된 토큰입니다. (A403)',
    'A404': lang === 'es' ? 'Token de refresco no válido (A404)' : '유효하지 않은 Refresh Token (A404)',
    'A405': lang === 'es' ? 'Token de refresco no encontrado (A405)' : '존재하지 않는 Refresh Token (A405)',
    'A406': lang === 'es' ? 'Token de refresco expirado (A406)' : '만료된 Refresh Token (A406)'
  };

  const fallbackMsg = lang === 'es' ? 'Error de autenticación' : '로그인 인증에 실패했습니다.';
  return resultMessage || errorMap[resultCode] || `${fallbackMsg} (${resultCode})`;
}

/**
 * 서버 응답 코드 또는 부서 명칭을 앱 표준 공정코드 ('U' | 'L' | 'C')로 매핑
 */
export function normalizeProcessType(rawInput: string | undefined | null): string {
  if (!rawInput) return 'U';
  const raw = rawInput.trim().toUpperCase();
  if (raw === '하공정' || raw === 'L') {
    return 'L';
  } else if (raw === 'CP2' || raw === 'C' || raw === 'LC') {
    return 'C';
  }
  return 'U';
}

/**
 * 로컬 SQLite DB에서 해당 사원번호의 실제 성명 및 공정구분 조회
 */
export async function resolveLocalUser(empId: string, defaultProcessType: string): Promise<{ name: string; uploProcGbn: string }> {
  const upperEmpId = (empId || '').trim().toUpperCase();
  let userName = '점검자';
  let uploProcGbn = normalizeProcessType(defaultProcessType);

  // 1. localStorage에서 엑셀 임포트 또는 로그인 세션 복원 시도 (성명 및 공정)
  if (typeof window !== 'undefined' && window.localStorage) {
    const cachedUserStr = window.localStorage.getItem(`cached_user_${upperEmpId}`);
    if (cachedUserStr) {
      try {
        const u = JSON.parse(cachedUserStr);
        if (u.name) userName = u.name;
        if (u.uploProcGbn) {
          uploProcGbn = normalizeProcessType(u.uploProcGbn);
        } else if (u.dept) {
          uploProcGbn = normalizeProcessType(u.dept);
        }
      } catch (e) {
        console.error('[Auth Service] Failed to parse cached user data:', e);
      }
    }
  }

  // 2. 캐시 데이터가 없거나 미완성인 경우 SQLite tb_mob_set020 물리 테이블 대조
  try {
    const localResult = await dbService.query(
      'SELECT mob_user_nm, uplo_proc_gbn FROM tb_mob_set020 WHERE mob_user_id = ?',
      [upperEmpId]
    );
    if (localResult && localResult.values && localResult.values.length > 0) {
      const row = localResult.values[0];
      if (userName === '점검자') userName = row.mob_user_nm || userName;
      if (!uploProcGbn || uploProcGbn === 'U') {
        uploProcGbn = normalizeProcessType(row.uplo_proc_gbn);
      }
    }
  } catch (dbErr) {
    console.error('[Auth Service] Failed to fetch user name from SQLite tb_mob_set020:', dbErr);
  }

  return { name: userName, uploProcGbn };
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function setCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return;
  if (value === null) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;";
  } else {
    // 휘발성 세션 쿠키 설정 (max-age 생략하여 WebView/브라우저 세션 종료 시 파기)
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax;`;
  }
}

export async function saveAuthSession(user: User): Promise<void> {
  const userStr = JSON.stringify(user);

  // 1. 글로벌 표준 키인 'currentUser'를 휘발성 세션 쿠키로 저장하고, SQLite에도 이중 백업 저장
  setCookie('currentUser', userStr);
  await dbService.setSetting('current_user', userStr);

  // 2. 기존 securescan_session 및 securescan_user, active_user, session 키는 깔끔하게 삭제
  localStorage.removeItem('currentUser');
  localStorage.removeItem('securescan_user');
  localStorage.removeItem('securescan_session');
  setCookie('securescan_user', null);
  setCookie('securescan_session', null);
  await dbService.setSetting('active_user', null);
  await dbService.setSetting('session', null);

  localStorage.setItem(`cached_user_${user.id}`, JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    uploProcGbn: user.uploProcGbn,
    fac_gbn: user.fac_gbn
  }));
}

export async function offlineLoginFallback(empId: string, password: string): Promise<{ success: boolean; user?: User }> {
  const upperEmpId = (empId || '').trim().toUpperCase();
  // 1. 단일 tb_mob_set020 테이블 쿼리로 ID와 암호화된 비밀번호를 직접 대조하여 검증 (보안 강화)
  try {
    const encryptedPw = encryptPassword(password);
    const localResult = await dbService.query(
      'SELECT * FROM tb_mob_set020 WHERE mob_user_id = ? AND mob_user_pw = ?',
      [upperEmpId, encryptedPw]
    );

    // 2. 조회된 행이 존재하면 유저 정보 추출
    if (localResult && localResult.values && localResult.values.length > 0) {
      const row = localResult.values[0];

      let parsedRoles: any = [];
      if (row.roles_json) {
        try {
          parsedRoles = JSON.parse(row.roles_json);
        } catch (e) {
          console.warn('[Auth Service] Failed to parse offline roles_json:', e);
        }
      }

      const user: User = {
        id: row.mob_user_id,
        name: row.mob_user_nm,
        accToken: "",
        rfToken: "",
        companyId: row.co_id,
        uploProcGbn: row.uplo_proc_gbn,
        fac_gbn: row.fac_gbn,
        role: parsedRoles
      };

      return { success: true, user };
    } else {
      return { success: false };
    }
  } catch (dbErr) {
    console.error('[Auth Service] Offline fallback query error:', dbErr);
  }
  return { success: false };
}

/**
 * 온라인 MES API 로그인 시도
 */
export async function onlineLogin(
  empId: string,
  password: string,
  baseUrl: string,
  lang: string,
  signal?: AbortSignal,
  forceFlag?: string
): Promise<{
  success: boolean;
  data?: any;
  errorType?: string;
  errorMsg?: { ko: string; es: string };
}> {
  if (!baseUrl) {
    return { success: false, errorType: 'missingUrl' };
  }

  const upperEmpId = (empId || '').trim().toUpperCase();
  const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const loginUrl = `${formattedBaseUrl}/SCOM/auth/login`;

  const deviceId = await getDeviceId();
  const encryptedPassword = encryptPassword(password);
  const payload = {
    USER_ID: upperEmpId,
    PASSWD: encryptedPassword,
    DEVICE_ID: deviceId,
    FORCE_FLAG: forceFlag || 'N',
    M_FLAG: 'Y'
  };

  try {
    const response = await fetchWithTimeout(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal,
      timeout: 10000
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Auth API] Login success response:', data);

      if (data.RESULT_CODE && data.RESULT_CODE !== 'R100') {
        const serverMsg = data.RESULT_MESSAGE || "";
        return {
          success: false,
          errorType: data.RESULT_CODE,
          errorMsg: {
            // 서버 메시지가 있으면 그대로 사용, 없을 때만 공통 매핑 테이블 참조
            ko: getBackendErrorMessage(data.RESULT_CODE, serverMsg, 'ko'),
            es: getBackendErrorMessage(data.RESULT_CODE, serverMsg, 'es')
          }
        };
      }

      return { success: true, data };
    } else {
      console.warn('[Auth API] Login failed. Server response code:', response.status);
      const fallbackMsgKo = `알 수 없는 에러가 발생하였습니다. (HTTP ${response.status})`;
      const fallbackMsgEs = `Ocurrió un error desconocido. (HTTP ${response.status})`;
      return {
        success: false,
        errorType: response.status === 401 ? 'invalidCredentials' : 'serverError',
        errorMsg: {
          ko: fallbackMsgKo,
          es: fallbackMsgEs
        }
      };
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'timeout') {
      console.log('[Auth API] Login fetch request timed out.');
      return {
        success: false,
        errorType: 'requestTimeout',
        errorMsg: {
          ko: '로그인 요청 시간이 초과되었습니다.',
          es: 'El tiempo de espera de inicio de sesión ha expirado.'
        }
      };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      console.log('[Auth API] Login fetch request aborted by user.');
      return {
        success: false,
        errorType: 'loginCancelled',
        errorMsg: {
          ko: '로그인이 취소되었습니다.',
          es: 'Inicio de sesión cancelado.'
        }
      };
    }
    console.error('[Auth API] Online connection failed:', err);
    const connectionErrorMsgKo = "서버와 연결할 수 없습니다. 서버 상태 또는 단말기의 네트워크 연결을 확인해 주세요.";
    const connectionErrorMsgEs = "Error de conexión con el servidor. Por favor, compruebe su conexión a internet.";
    return {
      success: false,
      errorType: 'connectionError',
      errorMsg: {
        ko: connectionErrorMsgKo,
        es: connectionErrorMsgEs
      }
    };
  }
}

/**
 * 엑세스 토큰 검증 API 호출
 */
export async function verifyAccessToken(
  baseUrl: string,
  accessTokenApi: string,
  accToken: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!baseUrl) return { success: false, error: 'baseUrl is required' };

  const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const targetUrl = accessTokenApi.startsWith('/') ? `${formattedBaseUrl}${accessTokenApi}` : `${formattedBaseUrl}/${accessTokenApi}`;

  try {
    const response = await fetchWithTimeout(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.ok) {
      const data = await response.json();
      if (data.RESULT_CODE && data.RESULT_CODE !== 'R100') {
        return { success: false, error: data.RESULT_MESSAGE || `Error: ${data.RESULT_CODE}`, data };
      }
      return { success: true, data };
    } else {
      return { success: false, error: `HTTP Error: ${response.status}` };
    }
  } catch (err) {
    console.error('[Auth API] verifyAccessToken failed:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 리프레시 토큰을 통한 토큰 재발급 API 호출
 */
export async function refreshAccessToken(
  baseUrl: string,
  refreshTokenApi: string,
  rfToken: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; data?: any; error?: string }> {
  if (!baseUrl) return { success: false, error: 'baseUrl is required' };

  const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const targetUrl = refreshTokenApi.startsWith('/') ? `${formattedBaseUrl}${refreshTokenApi}` : `${formattedBaseUrl}/${refreshTokenApi}`;

  try {
    const response = await fetchWithTimeout(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Refresh-Token': rfToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        REFRESH_TOKEN: rfToken
      }),
      timeout: 10000
    });

    if (response.ok) {
      const data = await response.json();
      if (data.RESULT_CODE && data.RESULT_CODE !== 'R100') {
        return { success: false, error: data.RESULT_MESSAGE || `Error: ${data.RESULT_CODE}`, data };
      }

      const newAccToken = data.ACCESS_TOKEN || data.access_token || '';
      const newRfToken = data.REFRESH_TOKEN || data.refresh_token || rfToken;

      return {
        success: true,
        accessToken: newAccToken,
        refreshToken: newRfToken,
        data
      };
    } else {
      return { success: false, error: `HTTP Error: ${response.status}` };
    }
  } catch (err) {
    console.error('[Auth API] refreshAccessToken failed:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 온라인 로그인 성공 시 해당 사번이 로컬 오프라인 계정 DB(tb_mob_set020)에 없는 경우에만 새로 저장
 * 비밀번호는 엑셀 동기화와 동일하게 아이디(empId)를 암호화하여 저장
 */
export async function saveOfflineUserIfNotExist(empId: string, loginData: any): Promise<void> {
  const upperEmpId = (empId || '').trim().toUpperCase();
  if (!upperEmpId) return;

  try {
    // 1. 기존 계정 존재 여부 확인
    const checkRes = await dbService.query(
      'SELECT COUNT(*) as cnt FROM tb_mob_set020 WHERE mob_user_id = ?',
      [upperEmpId]
    );

    const count = checkRes?.values?.[0]?.cnt ?? checkRes?.values?.[0]?.['COUNT(*)'] ?? Object.values(checkRes?.values?.[0] || {})[0] ?? 0;

    // 2. 오프라인 계정이 이미 존재하는 경우 새로 등록하지 않고 종료
    if (count > 0) {
      console.log(`[Auth Service] 오프라인 계정 DB에 이미 사번(${upperEmpId}) 정보가 존재하여 신규 저장을 스킵합니다.`);
      return;
    }

    // 3. 존재하지 않는 신규 계정인 경우 INSERT 수행
    console.log(`[Auth Service] 신규 사번(${upperEmpId}) 감지: 오프라인 계정 DB(tb_mob_set020)에 자동 추가합니다.`);

    const companyId = loginData?.COMPANY_ID || 'POSAR';
    const facGbn = loginData?.FAC_GBN || companyId.replace('POSAR', '') || '1';
    const uploProcGbn = normalizeProcessType(loginData?.UPLO_PROC_GBN);
    const userName = loginData?.USER_NM || loginData?.MOB_USER_NM || '점검자';
    const rolesJson = JSON.stringify(loginData?.ROLE_INFO || []);
    const encryptedInitialPw = encryptPassword(upperEmpId); // 엑셀 동기화와 동일하게 아이디를 암호화하여 저장

    await dbService.query(
      `INSERT INTO tb_mob_set020 (fac_gbn, uplo_proc_gbn, mob_user_id, mob_user_nm, co_id, roles_json, mob_user_pw)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [facGbn, uploProcGbn, upperEmpId, userName, companyId, rolesJson, encryptedInitialPw]
    );

    await dbService.saveToStoreWeb();
    console.log(`[Auth Service] 사번(${upperEmpId}) 정보가 오프라인 계정 DB에 성공적으로 등록되었습니다.`);
  } catch (err) {
    console.error('[Auth Service] saveOfflineUserIfNotExist error:', err);
  }
}

export async function logoutApi(baseUrl: string, userId: string): Promise<void> {
  if (!baseUrl || !userId) return;
  const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  try {
    await fetchWithTimeout(`${formattedBaseUrl}/SCOM/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ USER_ID: userId }),
      timeout: 3000
    });
  } catch (err) {
    console.warn('[Auth Service] logoutApi error:', err);
  }
}

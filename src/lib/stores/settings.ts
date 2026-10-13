import { writable } from 'svelte/store';
import { PUBLIC_APP_VERSION } from '$lib/constants';

export interface AppSettings {
  defaultLang: 'ko' | 'es';
  plantName: string;       // 한국어 공장명
  plantNameEs: string;     // 스페인어 공장명
  processName: string;     // 한국어 공정명
  processNameEs: string;   // 스페인어 공정명
  baseUrl: string;
  userApi: string;
  std01Api: string;
  std02Api: string;
  std03Api: string;
  rst01Api: string;
  accessTokenApi: string;
  refreshTokenApi: string;
  versionApi: string;
  appVersion: string;
  autoSendYn: string;      // 점검저장 시 자동 실적 전송 (Y/N)
}

export const defaultSettings: AppSettings = {
  defaultLang: 'ko',
  plantName: '1공장',
  plantNameEs: 'Planta 1',
  processName: 'LP',
  processNameEs: 'LP',
  baseUrl: 'http://192.168.0.70:8080/',
  userApi: '/SCOM/auth/login',
  std01Api: '/EAM/mob/master',
  std02Api: '/EAM/mob/asset',
  std03Api: '/EAM/mob/plan',
  rst01Api: '/EAM/mob/save',
  accessTokenApi: '/SCOM/auth/me',
  refreshTokenApi: '/SCOM/auth/refresh',
  versionApi: '/EAM/mob/version',
  appVersion: PUBLIC_APP_VERSION || '1.0',
  autoSendYn: 'N',
};

// API Endpoint Reference:
// 점검기준정보 : EAM/mob/master
// 점검실적보고 : EAM/mob/save
// 점검계획정보 : EAM/mob/plan
// 설비사양정보 : EAM/mob/asset
// 로그인API : SCOM/auth/login
// 엑세스토큰인증 : SCOM/auth/me
// 리프레시토큰 인증 : SCOM/auth/refresh

const getInitialSettings = (): AppSettings => {
  return defaultSettings;
};

const initialSettings = getInitialSettings();

export const settings = writable<AppSettings>(initialSettings);
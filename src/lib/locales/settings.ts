import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  settingsTitle: { ko: "환경설정", es: "Configuración" },
  settingsSubtitle: { ko: "SYSTEM CONFIG", es: "CONFIGURACIÓN DEL SISTEMA" },
  settingsApiEndpointConfig: { ko: "API 엔드포인트 설정", es: "Configuración de endpoints de API" },
  baseUrl: { ko: "기본 URL", es: "기본 URL" },
  userApi: { ko: "점검자 수신 API", es: "점검자 수신 API" },
  std01Api: { ko: "점검기준정보 수신 API", es: "점검기준정보 수신 API" },
  std02Api: { ko: "설비사양정보 수신 API", es: "설비사양정보 수신 API" },
  std03Api: { ko: "설비점검계획 수신 API", es: "설비점검계획 수신 API" },
  rst01Api: { ko: "설비점검실적 송신 API", es: "설비점검실적 송신 API" },
  versionApi: { ko: "앱 버전 확인 API", es: "API de verificación de versión de la app" },
  accessTokenApi: { ko: "엑세스토큰 인증 API", es: "API de autenticación de token de acceso" },
  refreshTokenApi: { ko: "리프레시토큰 인증 API", es: "API de autenticación de token de actualización" },
  autoSendYnLabel: { ko: "실적 저장 시 자동 전송", es: "Envío automático al guardar" },
  autoSendYnDesc: {
    ko: "저장 버튼을 누를 때 즉시 서버로 실적을 전송합니다.",
    es: "Envía los resultados al servidor inmediatamente al pulsar guardar."
  },
  autoTransmitFailTitle: { ko: "자동 실적전송 실패", es: "Envío automático fallido" },
  autoTransmitFailMsg: {
    ko: "점검 실적은 로컬 DB에 안전하게 저장되었습니다.\n\n네트워크 연결 또는 서버 상태를 확인한 후 나중에 동기화 메뉴에서 수동으로 전송해 주세요.",
    es: "El resultado de la inspección se guardó de forma segura en la base de datos local.\n\nPor favor, compruebe la red o el servidor e intente enviarlo manualmente más tarde desde el menú de sincronización."
  },
  settingsResetMsg: {
    ko: "환경설정이 기본값으로 초기화되었습니다.",
    es: "La configuración se ha restablecido a los valores predeterminados."
  },
  settingsConfirmReset: {
    ko: "정말로 환경설정을 기본값으로 초기화하시겠습니까?",
    es: "¿Está seguro de que desea restablecer la configuración?"
  },
  settingsSavedMsg: { ko: "환경설정이 정상적으로 저장되었습니다.", es: "La configuración se ha guardado correctamente." },
  defaultLangLabel: { ko: "기본언어", es: "기본언어" },
  settingsBtn: { ko: "환경설정", es: "Configuración" },
  saveBtn: { ko: "저장", es: "Guardar" },
  plantName: { ko: "공장", es: "공장" },
  resetBtn: { ko: "초기화", es: "Restablecer" },
} satisfies Record<string, Record<Lang, any>>;

export type SettingsKey = keyof typeof dict;

/**
 * [SETTINGS 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/settings';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

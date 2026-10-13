import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  splashDbInit: { ko: "시스템 데이터베이스 초기화 중...", es: "Inicializando base de datos del sistema..." },
  splashCheckVersion: { ko: "서버 앱 버전 점검 중...", es: "Verificando versión de la app en el servidor..." },
  splashAuthInit: { ko: "사용자 인증 세션 확인 중...", es: "Verificando sesión de usuario..." },
  splashReady: { ko: "앱 준비 완료", es: "Aplicación lista" },
  updateNoticeTitle: { ko: "앱 업데이트 알림", es: "Aviso de Actualización" },
  updateNoticeMsg: {
    ko: "새로운 버전({serverVer})이 출시되었습니다.\n(현재 설치 버전: {currentVer})\n\n업데이트 버전을 설치하시겠습니까?",
    es: "Una nueva versión ({serverVer}) está disponible.\n(Versión actual: {currentVer})\n\n¿Desea instalar la actualización?"
  },
  updateLatestTitle: { ko: "최신 버전 사용 중", es: "Versión Actualizada" },
  updateLatestMsg: {
    ko: "현재 최신 버전({version})을 사용 중입니다.",
    es: "Ya está utilizando la versión más reciente ({version})."
  },
  updateDownloadingTitle: { ko: "업데이트 파일 다운로드 중", es: "Descargando Actualización" },
  updateDownloadingMsg: {
    ko: "최신 APK 파일({filename})을 다운로드하고 있습니다.\n잠시만 기다려 주세요",
    es: "Descargando el archivo APK ({filename}) más reciente.\nPor favor, espere un momento"
  },
  updateDownloadStartTitle: { ko: "다운로드 시작", es: "Inicio de Descarga" },
  updateDownloadStartMsg: {
    ko: "APK 파일({filename}) 다운로드가 시작되었습니다.\n다운로드 완료 후 설치를 진행해 주세요.",
    es: "Ha comenzado la descarga del archivo APK ({filename}).\nPor favor, proceda con la instalación cuando finalice."
  },
  updateDownloadCompleteTitle: { ko: "다운로드 완료", es: "Descarga Completada" },
  updateDownloadCompleteMsg: {
    ko: "APK 다운로드가 완료되었습니다. 앱 패키지 설치를 진행합니다.",
    es: "La descarga del APK se ha completado. Procediendo con la instalación del paquete."
  },
  updateDownloadErrorTitle: { ko: "다운로드 오류", es: "Error de Descarga" },
  updateDownloadErrorMsg: {
    ko: "APK 다운로드 중 오류가 발생했습니다.\n{message}",
    es: "Ocurrió un error durante la descarga del APK.\n{message}"
  },
  updateConfigErrorTitle: { ko: "설정 오류", es: "Error de Configuración" },
  updateConfigErrorMsg: { ko: "환경설정에 기본 URL이 입력되어 있지 않습니다.", es: "La URL base no está configurada en los ajustes." },
  updateConnectionErrorTitle: { ko: "연결 오류", es: "Error de Conexión" },
  updateConnectionErrorMsg: {
    ko: "서버와 연결할 수 없습니다.\n환경설정의 기본 URL 주소 및 서버 작동 상태, 또는 단말기의 네트워크(Wi-Fi/LTE) 연결을 확인해 주세요.",
    es: "No se pudo conectar con el servidor.\nPor favor, verifique la URL base, el estado del servidor o su conexión de red (Wi-Fi/LTE)."
  },
  updateCheckErrorTitle: { ko: "확인 오류", es: "Error de Verificación" },
  updateCheckErrorMsg: {
    ko: "버전 확인 중 오류가 발생했습니다.\n{message}",
    es: "Ocurrió un error al verificar la versión.\n{message}"
  },
  updateFetchErrorTitle: { ko: "수신 실패", es: "Error de Recepción" },
  updateFetchErrorMsg: {
    ko: "버전 정보를 불러오지 못했습니다. (HTTP {status})",
    es: "No se pudo obtener la información de la versión. (HTTP {status})"
  },
} satisfies Record<string, Record<Lang, any>>;

export type SplashKey = keyof typeof dict;

/**
 * [SPLASH 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/splash';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

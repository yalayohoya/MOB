import capConfig from '../../capacitor.config.json';
import pkg from '../../package.json';

export const PUBLIC_APP_VERSION = pkg.version;

/**
 * 앱 전체에서 사용하는 환경 설정 및 상수
 * capacitor.config.json 및 package.json 파일을 직접 참조하여 설정의 일관성을 유지합니다.
 */
export const APP_CONFIG = {
  // 앱 딥링크 스킴 (Capacitor 설정의 appId를 그대로 사용)
  APP_SCHEME: capConfig.appId,

  // 앱 이름 (Capacitor 설정의 appName을 참조하거나 직접 정의)
  APP_NAME: capConfig.appName,

  VERSION: pkg.version
};

// 개발자 권한을 부여할 계정 ID 목록
export const DEV_IDS = ['DEV'];

// 관리자 권한을 부여할 계정 ID 목록 (개발자 포함)
export const ADMIN_IDS = ['ADMIN', ...DEV_IDS];


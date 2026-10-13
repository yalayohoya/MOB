import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import type { User } from './authService';

/**
 * 사용자 상태 및 APK 빌드 타입에 따라 화면 캡처 방지 (PrivacyScreen) 설정 업데이트
 * - Debug 빌드 (npm run apk:debug / vite dev): 무조건 캡처 허용 (PrivacyScreen.disable)
 * - Release 빌드 (npm run apk:release): 기존 정책 적용
 *   - DEV 계정: 캡처 허용 (PrivacyScreen.disable)
 *   - 그 외 (비로그인, ADMIN, 일반 유저 등): 캡처 차단 (PrivacyScreen.enable)
 */
export async function updatePrivacyScreen(user: User | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // 웹 브라우저 환경에서는 동작 안 함
    return;
  }

  try {
    const isDebugApk = import.meta.env.MODE === 'debug' || import.meta.env.DEV === true;

    if (isDebugApk) {
      console.log('[PrivacyScreen] Debug 빌드 감지: 캡처 무조건 허용');
      await PrivacyScreen.disable();
      return;
    }

    // Release APK일 경우 원래 로직 실행
    const isDevUser = user?.id === 'DEV';

    if (isDevUser) {
      console.log('[PrivacyScreen] [Release APK] DEV 계정 로그인 감지: 화면 캡처 허용');
      await PrivacyScreen.disable();
    } else {
      console.log('[PrivacyScreen] [Release APK] 일반/관리자/비로그인 상태: 화면 캡처 차단');
      await PrivacyScreen.enable();
    }
  } catch (error) {
    console.error('[PrivacyScreen] 캡처 방지 설정 업데이트 중 오류 발생:', error);
  }
}

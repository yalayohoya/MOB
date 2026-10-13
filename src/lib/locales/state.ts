import { writable, get } from 'svelte/store';
import { settings } from '$lib/stores/settings';

export type Lang = 'ko' | 'es';

// 설정 또는 localStorage에서 초기 언어를 가져오거나, 기본값으로 'ko'를 사용합니다.
const getInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'ko';
  const savedSettings = localStorage.getItem('app_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.defaultLang === 'ko' || parsed.defaultLang === 'es') {
        return parsed.defaultLang;
      }
    } catch (e) { }
  }
  return (localStorage.getItem('lang') || 'ko') as Lang;
};

export const lang = writable<Lang>(getInitialLang());

if (typeof window !== 'undefined') {
  lang.subscribe((value) => {
    localStorage.setItem('lang', value as string);

    // 화면 언어(KOR/ESP) 토글 시, 환경설정의 기본 언어값도 실시간 자동 동기화하여 보존!
    try {
      const currentSettings = get(settings);
      if (currentSettings.defaultLang !== value) {
        settings.update(s => ({ ...s, defaultLang: value }));
      }
    } catch (e) {
      console.error('[Lang Store] Sync settings failed:', e);
    }
  });
}

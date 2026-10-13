import { writable } from 'svelte/store';

// SSR 서버 렌더링 환경을 고려하여 브라우저 환경에서만 localStorage를 읽어 초기 테마를 설정합니다.
const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  }
  return 'light';
};

export const pageTitle = writable('SecureScan Ops');
export const subTitle = writable('');
export const isScanning = writable(false);
export const isInitialized = writable(true);
export const theme = writable<'light' | 'dark'>(getInitialTheme());

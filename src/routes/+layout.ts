import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'always';

// 로그인 없이 접근 가능한 공용 화이트리스트 목록
const WHITELIST = ['/'];

export const load: LayoutLoad = async ({ url }) => {
  if (typeof window !== 'undefined') {
    // trailing slash를 제거해 일관성 있는 경로 정밀 추출 (단, '/'는 유실 방지)
    const cleanPath = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, "");

    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const nameEQ = name + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
      return null;
    };

    const isLoggedIn = getCookie('currentUser') !== null || getCookie('securescan_user') !== null;

    // 미인증 상태에서 비허용 경로에 접속하는 경우
    if (!isLoggedIn && !WHITELIST.includes(cleanPath)) {
      // 렌더링 유입 찰나에 SvelteKit 인터셉트 리다이렉트 실행
      throw redirect(307, '/');
    }
  }
};

import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { toLocalDateString } from '$lib/utils/date';

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'always';

interface Role {
  ROLE_CD: string;
  VALID_PERIOD_STA_DT: string;
  VALID_PERIOD_END_DT: string;
}

/**
 * ROLE_CD가 'COM_ADM_MOB'인 역할이 존재하고, 만료일(VALID_PERIOD_END_DT)이 오늘 날짜(YYYY-MM-DD) 이상인지 확인합니다.
 */
function checkAdminRoleValidity(roles: any[]): boolean {
  if (!Array.isArray(roles)) return false;
  console.log("role ==========================> ", roles)

  const todayStr = toLocalDateString();

  const adminRole = roles.find((r) => r?.ROLE_CD === 'COM_ADM_MOB');
  if (!adminRole) return false;

  // 만료일이 오늘보다 크거나 같은지 확인 (즉, 오늘 날짜를 아직 넘지 않고 유효함)
  return adminRole.VALID_PERIOD_END_DT >= todayStr;
}

export const load: PageLoad = async () => {
  let user = null;
  let accessAuth = false;

  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        user = JSON.parse(storedUser);

        // 관리자 권한 및 유효기간 검증
        accessAuth = checkAdminRoleValidity(user.role);

        console.log('/settings/+page.ts', user);
        console.log('[Settings Load] Admin access authorization status:', accessAuth);
      } catch (e) {
        accessAuth = false;
        console.error('[Settings Load] Failed to parse user session:', e);
      }

      // 권한 검증에 실패한 경우 권한이 없다는 안내 페이지로 즉각 이동
      if (!accessAuth) {
        throw redirect(307, '/unauthorized');
      }
    }
  }

  return {
    user,
    accessAuth
  };
};




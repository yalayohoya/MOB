import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  unauthorizedTitle: { ko: "접근 권한이 없습니다", es: "Acceso Denegado" },
  unauthorizedDesc: {
    ko: "페이지에 접근할 수 있는 권한이 없거나 권한 유효기간이 만료되었습니다. 관리자에게 문의해 주세요.",
    es: "No tiene los permisos para acceder a la página o el período de validez de su autorización ha expirado. Por favor, póngase en contacto con el administrador."
  },
  unauthorizedGoToMain: { ko: "메인으로 이동", es: "Ir al Menú Principal" },
} satisfies Record<string, Record<Lang, any>>;

export type UnauthorizedKey = keyof typeof dict;

/**
 * [UNAUTHORIZED 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/unauthorized';
 *   {$t.unauthorizedTitle}
 */
export const t = createLocaleStore(dict);

import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  headerAutoLogoutTooltip: { ko: "자동 로그아웃 남은 시간", es: "Tiempo restante de cierre de sesión" },
  headerUserMenuLabel: { ko: "사용자 메뉴", es: "Menú de usuario" },
  themeLabel: { ko: "테마", es: "Tema" },
  langLabel: { ko: "언어", es: "Idioma" },
  userManagement: { ko: "사용자 관리", es: "Gestión de Usuarios" },
  changePassword: { ko: "비밀번호 변경", es: "Cambiar contraseña" },
  systemSettings: { ko: "환경설정", es: "Ajustes de Sistema" },
  userManual: { ko: "이용자 메뉴얼", es: "Manual de usuario" },
  manualTitle: { ko: "이용자 매뉴얼", es: "Manual de usuario" },
  noRole: { ko: "권한 없음", es: "Sin rol" },
  adminRole: { ko: "관리자", es: "Administrador" },
  inspectorRole: { ko: "점검자", es: "Inspector" },
  back: { ko: "뒤로 가기", es: "Atrás" },
  logout: { ko: "로그아웃", es: "Cerrar sesión" },
  dateClose: { ko: "닫기", es: "Cerrar" },
} satisfies Record<string, Record<Lang, any>>;

export type HeaderKey = keyof typeof dict;

/**
 * [HEADER 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/header';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

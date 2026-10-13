import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  usersTitle: { ko: "사용자 관리", es: "Gestión de Usuarios" },
  usersSearchPlaceholder: { ko: "사번 또는 이름 검색...", es: "Buscar por ID o Nombre..." },
  usersFoundCount: { ko: "총 {count}명의 사용자", es: "{count} usuarios encontrados" },
  usersNoResults: { ko: "일치하는 사용자가 없습니다", es: "No se encontraron usuarios" },
  usersLabelName: { ko: "이름:", es: "Nombre:" },
  usersLabelRole: { ko: "권한:", es: "Rol:" },
  usersLabelProcess: { ko: "공정:", es: "Proceso:" },
  usersRoleAdmin: { ko: "관리자", es: "Administrador" },
  usersRoleInspector: { ko: "점검자", es: "Inspector" },
  usersNoRole: { ko: "권한 없음", es: "Sin rol" },
  usersBtnReset: { ko: "비밀번호 초기화", es: "Restablecer" },
  usersResetConfirmTitle: { ko: "비밀번호 초기화", es: "Restablecer Contraseña" },
  usersResetConfirmMsg: {
    ko: "정말로 {name}님의 비밀번호를 초기화하시겠습니까?\n초기화 시 비밀번호는 사용자 ID({id})와 동일하게 설정됩니다.",
    es: "¿Está seguro de que desea restablecer la contraseña de {name}? Se establecerá como su ID de usuario ({id})."
  },
  usersResetSuccess: {
    ko: "{name}님의 비밀번호가 사용자 ID로 초기화되었습니다.",
    es: "La contraseña de {name} ha sido restablecida a su ID de usuario."
  },
  usersResetFailed: { ko: "비밀번호 초기화 중 오류가 발생했습니다.", es: "Error al restablecer contraseña." },
  usersLoadFailed: { ko: "사용자 목록을 불러오는 중 오류가 발생했습니다.", es: "Error al cargar usuarios." },
  usersLoadingText: { ko: "사용자 정보를 불러오는 중...", es: "Cargando usuarios..." },
  usersAccessDenied: { ko: "접근 권한이 없습니다.", es: "Acceso denegado." },
  usersOfflineTitle: { ko: "오프라인 사용자 관리", es: "Lista de Usuarios" },
  processUpper: { ko: "상공정", es: "Proceso Superior" },
  processLower: { ko: "하공정", es: "Proceso Inferior" },
  processCP2: { ko: "CP2", es: "CP2" },
} satisfies Record<string, Record<Lang, any>>;

export type UsersKey = keyof typeof dict;

/**
 * [USERS 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/users';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

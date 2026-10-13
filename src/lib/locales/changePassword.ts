import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  pwTitle: { ko: "비밀번호 변경", es: "Cambiar contraseña" },
  pwHeaderTitle: { ko: "비밀번호 변경", es: "CAMBIO DE CONTRASEÑA" },
  pwHeaderSubtitle: { ko: "로컬 오프라인 계정 패스워드 설정", es: "ACTUALIZAR CONTRASEÑA LOCAL" },
  pwLabelCurrent: { ko: "현재 비밀번호", es: "Contraseña Actual" },
  pwLabelNew: { ko: "새 비밀번호", es: "Nueva Contraseña" },
  pwLabelConfirm: { ko: "새 비밀번호 확인", es: "Confirmar Nueva Contraseña" },
  pwCurrentIncorrect: { ko: "현재 비밀번호가 일치하지 않습니다.", es: "Contraseña actuales incorrecta." },
  pwMismatch: { ko: "새 비밀번호가 서로 일치하지 않습니다.", es: "Las contraseñas no coinciden." },
  pwTooShort: { ko: "비밀번호는 최소 4자리 이상이어야 합니다.", es: "La contraseña debe tener al menos 4 caracteres." },
  pwFillAllFields: { ko: "모든 필드를 입력해 주세요.", es: "Complete todos los campos." },
  pwSaveSuccess: { ko: "비밀번호가 성공적으로 변경되었습니다.", es: "Contraseña cambiada con éxito. Inicie sesión de nuevo." },
  pwSaveFailed: { ko: "비밀번호 저장 중 데이터베이스 오류가 발생했습니다.", es: "Error al guardar en la base de datos." },
  pwShowPassword: { ko: "비밀번호 표시", es: "Mostrar contraseña" },
  pwHidePassword: { ko: "비밀번호 숨기기", es: "Ocultar contraseña" },
  pwBtnCancel: { ko: "취소", es: "Cancelar" },
  pwBtnSave: { ko: "비밀번호 변경", es: "Guardar" },
  pwBtnSaving: { ko: "저장 중...", es: "Guardando..." },
  pwOnlineNotAllowed: { ko: "온라인 로그인 계정은 비밀번호 변경이 불가능합니다.", es: "No disponible en línea" },
  pwSystemNotAllowed: {
    ko: "시스템 관리자/개발자 계정은 비밀번호 변경이 불가능합니다.",
    es: "La cuenta de administrador/desarrollador del sistema no permite cambiar la contraseña."
  },
} satisfies Record<string, Record<Lang, any>>;

export type ChangePasswordKey = keyof typeof dict;

/**
 * [CHANGEPASSWORD 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/changePassword';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

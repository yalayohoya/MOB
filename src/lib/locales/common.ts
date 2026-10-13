import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  confirm: { ko: "확인", es: "Aceptar" },
  cancel: { ko: "취소", es: "Cancelar" },
  saveBtn: { ko: "저장", es: "Guardar" },
  back: { ko: "뒤로 가기", es: "Atrás" },
  logout: { ko: "로그아웃", es: "Cerrar sesión" },
  themeToggle: { ko: "테마 전환", es: "Cambiar tema" },
  activeStatus: { ko: "가동 중", es: "En Funcionamiento" },
  inactiveStatus: { ko: "정지", es: "Inactivo" },
  completedStatus: { ko: "완료", es: "Completado" },
  incompleteStatus: { ko: "미흡", es: "Incompleto" },
  resetBtn: { ko: "초기화", es: "Restablecer" },
  searchPlaceholder: { ko: "설비명, ID, 위치, 유형으로 검색...", es: "Buscar por nombre, ID, ubicación, tipo..." },
  noResults: { ko: "검색 결과가 없습니다.", es: "No se encontraron resultados." },
  actionNoLabel: { ko: "점검활동번호:", es: "Nº Actividad:" },
  equipmentId: { ko: "설비 ID", es: "ID de Equipo" },
  type: { ko: "설비 유형", es: "Tipo" },
  location: { ko: "설비 위치", es: "Ubicación" },
  lastChecked: { ko: "최종 점검일", es: "Última Inspección" },
  plantName: { ko: "공장", es: "공장" },
  processName: { ko: "공정", es: "공정" },
  processUpper: { ko: "상공정", es: "Proceso Superior" },
  processLower: { ko: "하공정", es: "Proceso Inferior" },
  processCP2: { ko: "CP2", es: "CP2" },
  dateTitleFormat: { ko: "{year}년 {month}", es: "{month} de {year}" },
  dateWeekdays: {
    ko: [
        "일",
        "월",
        "화",
        "수",
        "목",
        "금",
        "토"
    ],
    es: [
        "Do",
        "Lu",
        "Ma",
        "Mi",
        "Ju",
        "Vi",
        "Sá"
    ]
  },
  dateMonths: {
    ko: [
        "1월",
        "2월",
        "3월",
        "4월",
        "5월",
        "6월",
        "7월",
        "8월",
        "9월",
        "10월",
        "11월",
        "12월"
    ],
    es: [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre"
    ]
  },
  dateToday: { ko: "오늘", es: "Hoy" },
  dateClose: { ko: "닫기", es: "Cerrar" },
  datePrevMonth: { ko: "이전 달", es: "Mes anterior" },
  dateNextMonth: { ko: "다음 달", es: "Mes siguiente" },
  datePrevDay: { ko: "이전 날짜", es: "Día anterior" },
  dateNextDay: { ko: "다음 날짜", es: "Día siguiente" },
  unauthorizedTitle: { ko: "접근 권한이 없습니다", es: "Acceso Denegado" },
  unauthorizedDesc: {
    ko: "페이지에 접근할 수 있는 권한이 없거나 권한 유효기간이 만료되었습니다. 관리자에게 문의해 주세요.",
    es: "No tiene los permisos para acceder a la página o el período de validez de su autorización ha expirado. Por favor, póngase en contacto con el administrador."
  },
  unauthorizedGoToMain: { ko: "메인으로 이동", es: "Ir al Menú Principal" },
  apply: { ko: "적용", es: "Aplicar" },
  detailTrend: { ko: "추이", es: "Tendencia" },
} satisfies Record<string, Record<Lang, any>>;

export type CommonKey = keyof typeof dict;

/**
 * [COMMON 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/common';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

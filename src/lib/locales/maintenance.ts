import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  maintenanceTitle: { ko: "설비 점검 등록", es: "Registro de Inspección" },
  maintenanceSubtitle: { ko: "오늘 수행해야 할 설비 점검 계획을 확인하세요.", es: "Consulte los planes de inspección de hoy." },
  maintenanceListTitle: { ko: "점검 목록", es: "Lista de Inspección" },
  maintenanceProgress: { ko: "진행 중", es: "En progreso" },
  maintenanceInspectLabel: { ko: "점검", es: "Inspect" },
  maintenanceActionDefaultName: { ko: "활동 {no}", es: "Actividad {no}" },
  maintenanceSelectEquipment: { ko: "설비 선택", es: "Seleccionar equipo" },
  maintenanceNumSuffix: { ko: "번", es: "" },
  maintenanceSearchPlaceholder: { ko: "설비명, 설비 ID, 위치 등", es: "Buscar nombre, ID, ubicación..." },
  maintenanceImportancePrefix: { ko: "중요도", es: "Importancia" },
  maintenanceManualSelect: { ko: "직접 설비 선택 (수동 검색)", es: "Seleccionar directamente (Búsqueda manual)" },
  maintenanceManualEquipmentSearch: { ko: "Manual Equipment Search", es: "Búsqueda manual de equipos" },
  maintenanceClearSearch: { ko: "초기화", es: "Limpiar" },
  maintenanceEquipInfo: { ko: "설비 정보 (ID / 설비명)", es: "Información del equipo (ID / Nombre)" },
  maintenanceAssetId: { ko: "ID", es: "ID" },
  maintenanceLocation: { ko: "위치", es: "Ubicación" },
  maintenanceItems: { ko: "항목", es: "tareas" },
  maintenanceNoTasks: { ko: "지정된 날짜에 배정된 점검 계획이 없습니다.", es: "No hay tareas de inspección para esta fecha." },
  maintenanceCompleted: { ko: "완료됨", es: "Completado" },
  maintenanceAll: { ko: "전체", es: "Todos" },
  maintenanceTodo: { ko: "미완료", es: "Pendiente" },
  maintenanceDone: { ko: "완료", es: "Listo" },
  maintenanceLoading: { ko: "점검 목록 조회 중...", es: "Cargando lista de tareas..." },
  maintenanceLoadingMore: { ko: "로딩 중...", es: "Cargando..." },
  maintenanceLoadMore: { ko: "설비 정보 더 보기", es: "Ver más equipos" },
  maintenanceTryAgain: { ko: "다시 시도", es: "Reintentar" },
  maintenanceInfoNoResults: { ko: "\"{query}\" 검색 결과가 없습니다.", es: "No hay resultados para \"{query}\"." },
  maintenanceInfoNotFound: { ko: "설비 정보를 찾을 수 없습니다", es: "No se encontró información del equipo" },
  maintenanceEnterEquipmentId: { ko: "설비 ID를 입력하세요...", es: "Ingrese el ID del equipo..." },
  maintenanceNotRegisteredEquip: { ko: "등록되지 않은 설비입니다. (ID: {id})", es: "Equipo no registrado. (ID: {id})" },
  maintenanceDbError: { ko: "데이터베이스 조회 중 오류가 발생했습니다.", es: "Error al consultar la base de datos." },
  maintenanceNoPlanError: {
    ko: "{date} 일자에 {id} 설비에 대한 점검 계획이 없습니다.",
    es: "No hay plan de inspección para el equipo {id} en la fecha {date}."
  },
  maintenancePlanDate: { ko: "계획일자:", es: "Fecha plan:" },
  maintenanceCompletedStatus: { ko: "완료", es: "Completado" },
  maintenanceIncompleteStatus: { ko: "미흡", es: "Incompleto" },
  maintenanceActionNoLabel: { ko: "점검활동번호:", es: "Nº Actividad:" },
  maintenanceHideCompleted: { ko: "완료 항목 숨기기", es: "Ocultar completados" },
  maintenanceTotalCount: { ko: "총 {count}건", es: "Total: {count}" },
  maintenancePending: { ko: "대기", es: "Pendiente" },
  maintenanceInspected: { ko: "점검 완료", es: "Realizado" },
  maintenanceQrButton: { ko: "QR코드 스캔", es: "Escanear QR" },
  detailTitle: { ko: "점검 계획 목록", es: "Lista de planes de inspección" },
  detailSubtitle: { ko: "계획일자:", es: "Fecha del plan:" },
  detailItems: { ko: "항목", es: "tareas" },
  detailPass: { ko: "양호 (OK)", es: "Excelente (OK)" },
  detailFail: { ko: "불량 (NG)", es: "Defectuoso (NG)" },
  detailNormal: { ko: "정상", es: "Normal" },
  detailAbnormal: { ko: "이상", es: "Anómalo" },
  detailPending: { ko: "미점검", es: "Pendiente" },
  detailLimits: { ko: "상하한", es: "Límite" },
  detailMin: { ko: "최소", es: "Mín" },
  detailMax: { ko: "최대", es: "Máx" },
  detailCriteria: { ko: "기준", es: "Criterios" },
  detailNoAssetName: { ko: "설비명 없음", es: "Sin nombre de equipo" },
  detailEquipTag: { ko: "설비", es: "Equipo" },
  detailLocTag: { ko: "설치위치", es: "Ubicación" },
  detailProcTag: { ko: "공정분류", es: "Proceso" },
  detailOthersFormat: { ko: " 외 {count}건", es: " y {count} más" },
  detailPlaceholderNote: {
    ko: "특이사항을 입력해주세요(400자 이내).",
    es: "Ingrese observaciones o comentarios aquí (máx. 400 caracteres)."
  },
  detailMeasuringValue: { ko: "측정값", es: "Valor" },
  detailNoPlan: { ko: "해당 날짜에 배정된 점검 계획이 없습니다.", es: "No hay plan de inspección asignado para esta fecha." },
  detailNoEquipment: {
    ko: "해당 ID ({id})의 설비 정보를 찾을 수 없습니다.",
    es: "No se pudo encontrar la información del equipo para el ID ({id})."
  },
  detailDefaultItemName: { ko: "점검항목", es: "Elemento" },
  detailPrevItem: { ko: "◀ 이전 항목", es: "◀ Anterior" },
  detailNextItem: { ko: "다음 항목 ▶", es: "Siguiente ▶" },
  detailSave: { ko: "저장하기", es: "Guardar" },
  detailConfirmSave: { ko: "저장", es: "Guardar" },
  detailSaveTitle: { ko: "저장 완료", es: "Guardado" },
  detailSaveTitleError: { ko: "저장 실패", es: "Error al guardar" },
  detailSaveSuccess: { ko: "점검 실적이 저장되었습니다.", es: "Se ha guardado el resultado de la inspección." },
  detailSaveFailed: { ko: "저장 중 오류가 발생했습니다.", es: "Error al guardar." },
  detailUnenteredTitle: { ko: "미입력 항목 존재", es: "Campos sin completar" },
  detailUnenteredMsg: {
    ko: "입력되지 않은 점검 항목({items})이 존재합니다.\n이대로 저장하시겠습니까?",
    es: "Hay campos sin completar ({items}).\n¿Desea guardar de todos modos?"
  },
  detailUnenteredMsgResult: {
    ko: "입력되지 않은 점검항목({itemsResult})이 존재합니다.\n이대로 저장하시겠습니까?",
    es: "Hay campos de inspección sin completar ({itemsResult}).\n¿Desea guardar de todos modos?"
  },
  detailUnenteredMsgMea: {
    ko: "입력되지 않은 측정값({itemsVal})이 존재합니다.\n이대로 저장하시겠습니까?",
    es: "Hay valores de medición sin ingresar ({itemsVal}).\n¿Desea guardar de todos modos?"
  },
  detailUnenteredMsgBoth: {
    ko: "입력되지 않은 점검항목({itemsResult}) 및 측정값({itemsVal})이 존재합니다.\n이대로 저장하시겠습니까?",
    es: "Hay campos de inspección ({itemsResult}) y valores de medición ({itemsVal}) sin completar.\n¿Desea guardar de todos modos?"
  },
  detailContinueInput: { ko: "계속 입력", es: "Continuar" },
  detailNoChangesTitle: { ko: "변경사항 없음", es: "Sin cambios" },
  detailNoChangesMsg: { ko: "수정된 점검 내역이 없습니다.", es: "No hay cambios para guardar." },
  detailClose: { ko: "닫기", es: "Cerrar" },
  detailHistoryTitle: { ko: "과거 5건 점검 이력", es: "Últimas 5 inspecciones" },
  detailRecent5: { ko: "(최근 5건)", es: "(Últimas 5)" },
  detailHistoryLoadText: { ko: "이력 로드 중...", es: "Cargando historial..." },
  detailHistoryLoadError: { ko: "이력 데이터 로드 실패", es: "Fallo al cargar historial" },
  detailHistoryQuery: { ko: "이력 조회", es: "Ver Historial" },
  detailNoHistory: { ko: "과거 점검 이력이 존재하지 않습니다.", es: "No hay historial de inspección registrado." },
  detailLoading: { ko: "점검 계획 조회 중...", es: "Buscando plan de inspección..." },
  detailTryAgain: { ko: "다시 시도", es: "Reintentar" },
  detailNote: { ko: "특이사항", es: "Observaciones" },
  detailInactive: { ko: "비가동", es: "Inactivo" },
  detailTrend: { ko: "추이", es: "Tendencia" },
} satisfies Record<string, Record<Lang, any>>;

export type MaintenanceKey = keyof typeof dict;

/**
 * [MAINTENANCE 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/maintenance';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

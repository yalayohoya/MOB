import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  dashboardTitle: { ko: "Main Dashboard", es: "Panel Principal" },
  dashboardSubtitle: {
    ko: "안전한 공정 관리를 위해 정기 점검을 생활화하세요.",
    es: "Haga de la inspección periódica un hábito para una gestión segura del proceso."
  },
  startInspection: { ko: "점검 시작", es: "Iniciar Inspección" },
  inspectionLogs: { ko: "점검 이력", es: "Historial de Inspección" },
  dataSync: { ko: "데이터 동기화", es: "Sincronizar Datos" },
  syncingText: { ko: "동기화 중...", es: "Sincronizando..." },
  syncCompleteTitle2: { ko: "동기화 완료", es: "Sincronización completada" },
  syncCompleteMsg2: {
    ko: "사원정보 및 최신 설비 정보가 업데이트 되었습니다.",
    es: "La información del personal y del equipo ha sido actualizada."
  },
  syncFailedTitle2: { ko: "동기화 실패", es: "Fallo de Sincronización" },
  syncFailedMsg2: { ko: "서버 연결에 실패했습니다.", es: "Error al conectar con el servidor." },
  dataReceive: { ko: "데이터 수신", es: "Recibir Datos" },
  dataTransmit: { ko: "실적 송신", es: "Enviar Resultados" },
  transmittingText: { ko: "송신 중...", es: "Enviando..." },
  transmitCompleteTitle: { ko: "송신 완료", es: "Envío completado" },
  transmitFailedTitle: { ko: "송신 실패", es: "Fallo de envío" },
  exportCompleteTitle: { ko: "내보내기 완료", es: "Exportación completada" },
  exportFailedTitle: { ko: "내보내기 실패", es: "Fallo de exportación" },
  sincApi: { ko: "API 연동", es: "Sinc API" },
  sincExcel: { ko: "Excel 연동", es: "Imp Excel" },
  transApi: { ko: "API 송신", es: "Trans API" },
  transExcel: { ko: "Excel 저장", es: "Exp Excel" },
  updateInspectorsTitle: { ko: "점검자 명단 업데이트", es: "Actualizar Inspectores" },
  applyLatestExcel: { ko: "최신 엑셀 파일 적용", es: "Seleccionar Archivo Excel" },
  excelPickerDescription: {
    ko: "기기에 저장된 최신 점검자 명단 엑셀 파일(.xlsx)을 선택하여 앱에 반영해 주세요:",
    es: "Seleccione el archivo Excel (.xlsx) con la lista de inspectores más reciente guardada en el dispositivo para aplicarla a la aplicación:"
  },
  syncConfirmTitle: { ko: "데이터 수신 경고", es: "Advertencia de Recepción de Datos" },
  syncConfirmMessage: {
    ko: "아직 송신(보고)하지 않은 점검 실적이 존재하는 경우 덮어씌워지거나 초기화될 수 있습니다. 진행하시겠습니까?",
    es: "Si existen registros de inspección no enviados (reportados), pueden sobrescribirse o reiniciarse. ¿Desea continuar?"
  },
  transmitConfirmTitle: { ko: "실적 송신 확인", es: "Confirmación de Envío de Resultados" },
  transmitConfirmMessage: {
    ko: "점검 완료된 실적 데이터를 서버(또는 엑셀)로 전송하시겠습니까?",
    es: "¿Desea enviar los datos de resultados de inspección al servidor (o Excel)?"
  },
  missingUrl: {
    ko: "기본 URL이 설정되어 있지 않습니다. 환경설정에서 입력해 주세요.",
    es: "La dirección del servidor (URL base) no está configurada en los ajustes."
  },
  invalidCredentials: { ko: "아이디 또는 비밀번호가 올바르지 않습니다.", es: "El usuario o la contraseña son incorrectos." },
  serverError: { ko: "로그인 처리 중 서버 오류가 발생했습니다.", es: "Error del servidor durante el inicio de sesión." },
  connectionError: {
    ko: "서버와 연결할 수 없습니다. 서버 상태 또는 단말기의 네트워크 연결을 확인해 주세요.",
    es: "Error de conexión con el servidor. Por favor, compruebe su conexión a internet."
  },
  syncGuideDetail: {
    ko: "최초 로그인 또는 사원 정보가 없을 경우 전체 데이터 동기화가 필요합니다.",
    es: "Se requiere sincronización completa de datos para el primer inicio de sesión o si no hay información."
  },
  confirm: { ko: "확인", es: "Aceptar" },
  apply: { ko: "적용", es: "Aplicar" },
  specsTitle: { ko: "설비 사양 조회", es: "Consulta de Especificaciones" },
  cancel: { ko: "취소", es: "Cancelar" },
  cancelConfirmTitle: { ko: "작업 취소", es: "Cancelar Operación" },
  cancelConfirmMessage: { ko: "진행 중인 작업을 정말로 취소하시겠습니까?", es: "¿Realmente desea cancelar la operación en curso?" },
} satisfies Record<string, Record<Lang, any>>;

export type DashboardKey = keyof typeof dict;

/**
 * [DASHBOARD 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/dashboard';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

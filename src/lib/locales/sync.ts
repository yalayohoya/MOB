import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  syncUnavailableTitle: { ko: "적용 불가", es: "Aplicación no disponible" },
  syncUnavailableMsg: {
    ko: "인터넷 연결이 원활하지 않습니다. 네트워크 상태를 확인해주세요.",
    es: "La conexión a Internet no es estable. Por favor, verifique el estado de la red."
  },
  syncCompleteTitle: { ko: "적용 완료", es: "Aplicación completada" },
  syncCompleteMsg: { ko: "사용자 정보가 성공적으로 적용되었습니다.", es: "La información del usuario se ha aplicado correctamente." },
  syncWarningTitle: { ko: "알림", es: "Aviso" },
  syncErrorTitle: { ko: "적용 오류", es: "Error de aplicación" },
  syncErrorMsg: {
    ko: "정보를 적용하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    es: "Ocurrió un problema al aplicar la información. Por favor, inténtelo de nuevo más tarde."
  },
  syncFailGeneric: {
    ko: "정상처리되지 않았습니다. 관리자에게 문의하시길 바랍니다.",
    es: "No se procesó normalmente. Por favor, póngase en contacto con el administrador."
  },
  cancelConfirmTitle: { ko: "작업 취소", es: "Cancelar Operación" },
  cancelConfirmMessage: { ko: "진행 중인 작업을 정말로 취소하시겠습니까?", es: "¿Realmente desea cancelar la operación en curso?" },
  syncCancelled: { ko: "작업이 사용자에 의해 취소되었습니다.", es: "La operación fue cancelada por el usuario." },
  syncStepVerifyingSession: { ko: "인증 세션 확인 중...", es: "Verificando sesión..." },
  syncStepStoragePermission: { ko: "저장소 접근 권한 확인 중...", es: "Verificando permisos de almacenamiento..." },
  syncStepSearchingExcel: { ko: "기기 내 엑셀 파일 탐색 중...", es: "Buscando archivos Excel en el dispositivo..." },
  syncStepParsingInspectors: { ko: "점검자 마스터 정보 분석 중...", es: "Analizando información de inspectores..." },
  syncStepParsingEquipments: { ko: "설비 사양 정보 분석 중...", es: "Analizando especificaciones de equipos..." },
  syncStepParsingPlans: { ko: "설비 점검 계획 분석 중...", es: "Analizando planes de inspección..." },
  syncStepParsingStds: { ko: "점검 표준 정보 분석 중...", es: "Analizando estándares de inspección..." },
  syncStepLocalDatabaseApply: { ko: "로컬 데이터베이스 적용 중...", es: "Actualizando base de datos local..." },
  syncStepQueryingLogs: { ko: "로컬 점검 실적 조회 중...", es: "Consultando historial de inspección..." },
  syncStepTransmitting: { ko: "실적 데이터 서버 전송 중...", es: "Transmitiendo resultados al servidor..." },
  syncStepGeneratingExcel: { ko: "실적 엑셀 파일 생성 중...", es: "Generando archivo Excel de resultados..." },
  syncStepSavingExcel: { ko: "기기 저장소에 파일 저장 중...", es: "Guardando en el almacenamiento local..." },
  syncStepUpdatingLogs: { ko: "로컬 데이터베이스 업데이트 중...", es: "Actualizando base de datos local..." },
  syncStepRequestingServer: { ko: "서버 데이터 수신 요청 중...", es: "Recibiendo datos del servidor..." },
  syncStepImportingEquipments: { ko: "설비 사양 정보 반영 중...", es: "Importando datos de equipos..." },
  syncStepImportingPlans: { ko: "설비 점검 계획 반영 중...", es: "Importando planes de inspección..." },
  syncStepImportingStds: { ko: "점검 표준 정보 반영 중...", es: "Importando estándares de inspección..." },
  serverConnectionErrorTitle: { ko: "연결 오류", es: "Error de Conexión" },
  serverConnectionErrorMsg: {
    ko: "서버 연결에 실패했습니다. 환경설정의 서버 URL 주소 또는 단말기의 네트워크(Wi-Fi/LTE) 연결 상태를 확인해 주세요.",
    es: "Error de conexión con el servidor. Por favor, verifique la URL del servidor en los ajustes o la conexión de red del dispositivo."
  },
  syncNoUnreportedConfirmTitle: { ko: "실적 전송 확인", es: "Confirmar Envío" },
  syncNoUnreportedConfirmMsgOnline: {
    ko: "전송할 미보고 실적이 없습니다.\n금일 점검 완료된 실적을 재송신하시겠습니까?",
    es: "No hay registros de inspección pendientes de envío.\n¿Desea retransmitir los registros completados hoy?"
  },
  syncNoUnreportedConfirmMsgOffline: {
    ko: "전송할 미보고 실적이 없습니다.\n금일 점검 완료된 실적을 내보내기하시겠습니까?",
    es: "No hay registros de inspección pendientes de envío.\n¿Desea exportar los registros completados hoy?"
  },
  syncOnlineCompleteMsg: {
    ko: "실시간 온라인 동기화가 완전히 성공했습니다:\n\n• 설비 사양 정보: {eqCount} 건\n• 설비 점검 계획: {planCount} 건\n• 점검 표준 정보: {stdsCount} 건",
    es: "Sincronización en línea completada con éxito:\n\n• Equipos: {eqCount} equipos\n• Planes: {planCount} planes\n• Estándares: {stdsCount} registros"
  },
  syncOfflineCompleteMsg: {
    ko: "오프라인 동기화가 완료되었습니다:\n\n• 점검자 정보: {inspectorStatus}\n• 설비 사양 정보: {equipmentStatus}\n• 설비 점검 계획: {planStatus}\n• 점검 표준 정보: {stdsStatus}{deleteWarning}",
    es: "Sincronización fuera de línea completada:\n\n• Inspectores: {inspectorStatus}\n• Equipos: {equipmentStatus}\n• Planes: {planStatus}\n• Estándares: {stdsStatus}{deleteWarning}"
  },
  syncOfflineFailedMsg: {
    ko: "오프라인 일괄 동기화 중 오류가 발생했습니다:\n{message}",
    es: "Sincronización fuera de línea fallida: {message}"
  },
  syncImportSuccessMsg: {
    ko: "'{filename}' 파일로부터 총 {count}명의 사원 정보(필수 관리자 포함)가 성공적으로 적용되었습니다.{deleteWarning}",
    es: "Se han importado {count} usuarios con éxito del archivo '{filename}'.{deleteWarning}"
  },
  syncImportFailedMsg: {
    ko: "엑셀 파일을 DB에 반영하는 중 오류가 발생했습니다:\n{message}",
    es: "Error al aplicar archivo: {message}"
  },
  syncExportSuccessMsg: {
    ko: "총 {count}건의 실적이 엑셀 파일로 저장되었습니다.\n\n경로: Download/receive/{filename}",
    es: "Se exportaron {count} registros a: Download/receive/{filename}"
  },
  syncPermissionErrorMsg: {
    ko: "엑셀 파일 동기화를 진행하려면 저장소 접근 권한이 필요합니다. 기기 설정에서 권한을 허용해 주세요.",
    es: "Se requiere permiso de almacenamiento para acceder a los archivos Excel."
  },
  syncPermissionDenied: { ko: "저장소 접근 권한이 없어 작업을 완료할 수 없습니다.", es: "Permiso de almacenamiento denegado" },
  syncNoExcelFilesMsg: {
    ko: "디렉토리('/Download/send') 내에 동기화할 엑셀 파일이 하나도 존재하지 않습니다.",
    es: "No se encontraron archivos Excel de sincronización en la ruta especificada."
  },
  syncDeleteFailedWarning: {
    ko: "\n\n⚠️ 엑셀 파일 {count}개의 자동 삭제에 실패하여 기기에 남아있을 수 있습니다. 필요시 수동으로 삭제해 주세요.",
    es: "\n\n⚠️ No se pudieron eliminar {count} archivos automáticamente. Elimínelos manualmente."
  },
  syncSingleDeleteFailedWarning: {
    ko: "\n\n⚠️ 엑셀 파일의 자동 삭제에 실패했습니다. 필요시 수동으로 삭제해 주세요.",
    es: "\n\n⚠️ No se pudo eliminar el archivo Excel automáticamente. Elimínelo manualmente."
  },
  unitUsers: { ko: "{count} 명", es: "{count} usuarios" },
  unitEquipments: { ko: "{count} 건", es: "{count} equipos" },
  unitPlans: { ko: "{count} 건", es: "{count} planes" },
  unitStandards: { ko: "{count} 건", es: "{count} registros" },
  syncLoginRequired: { ko: "실적 송신을 위해 먼저 로그인해 주세요.", es: "Debe iniciar sesión en línea primero" },
  adminDevAccountAlert: {
    ko: "[{accountId}] 관리자 계정은 온라인 MES 서버 토큰이 없는 로컬 전용 계정입니다.\nMES 계정으로 로그인하여 시도해주세요.",
    es: "La cuenta de administrador [{accountId}] es una cuenta dedicada local sin token de servidor MES en línea.\nInicie sesión con una cuenta MES e intente de nuevo."
  },
  syncNoDataTitle: { ko: "송신할 데이터 없음", es: "Sin registros" },
  syncNoDataMsg: { ko: "금일 점검 완료된 실적 데이터가 존재하지 않습니다.", es: "No hay registros de inspección hoy." },
  syncSessionInvalidOrExpired: {
    ko: "인증 세션이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.",
    es: "Sesión de autenticación inválida o caducada. Por favor, inicie sesión."
  },
  syncMissingUrl: { ko: "서버 URL 설정이 누락되었습니다.", es: "Falta la URL del servidor" },
  syncMissingRstApi: {
    ko: "실적 송신 API URI(rst01Api) 설정이 누락되었습니다.",
    es: "Falta la URI de la API de envío de resultados (rst01Api)."
  },
  syncTransmitSuccessMsg: {
    ko: "총 {count}건의 점검 실적이 성공적으로 온라인 송신 완료되었습니다.",
    es: "Se han enviado {count} registros en línea con éxito."
  },
  syncNoConfig: {
    ko: "모바일 설정 정보(tb_mob_set010)가 로컬 데이터베이스에 세팅되어 있지 않습니다.",
    es: "La información de configuración del móvil (tb_mob_set010) no está establecida en la base de datos local."
  },
  syncMissingBaseUrl: {
    ko: "API 접속을 위한 Base URL이 설정되어 있지 않습니다. 설정 페이지에서 URL을 등록해 주세요.",
    es: "La URL base para el acceso a la API no está configurada. Por favor, registre la URL en la página de ajustes."
  },
  syncMissingUserApi: {
    ko: "사용자 계정 동기화 API URI(userApi) 설정이 누락되었습니다.",
    es: "Falta la configuración de la URI de la API de sincronización de cuenta de usuario (userApi)."
  },
  syncMissingStd01Api: {
    ko: "점검 기준코드 동기화 API URI(std01Api) 설정이 누락되었습니다.",
    es: "Falta la configuración de la URI de la API de sincronización de códigos de criterios de inspección (std01Api)."
  },
  syncMissingStd02Api: {
    ko: "설비 사양정보 동기화 API URI(std02Api) 설정이 누락되었습니다.",
    es: "Falta la configuración de la URI de la API de sincronización de información de especificaciones del equipo (std02Api)."
  },
  syncMissingStd03Api: {
    ko: "설비 점검계획 동기화 API URI(std03Api) 설정이 누락되었습니다.",
    es: "Falta la configuración de la URI de la API de sincronización del plan de inspección del equipo (std03Api)."
  },
  syncEquipApiFailed: {
    ko: "설비 사양 API 동기화 실패 (HTTP {status})",
    es: "Fallo en la sincronización de la API de especificaciones de equipos (HTTP {status})"
  },
  syncPlanApiFailed: {
    ko: "점검 계획 API 동기화 실패 (HTTP {status})",
    es: "Fallo en la sincronización de la API de planes de inspección (HTTP {status})"
  },
  syncStdApiFailed: {
    ko: "점검 기준 API 동기화 실패 (HTTP {status})",
    es: "Fallo en la sincronización de la API de estándares de inspección (HTTP {status})"
  },
  syncUserApiFailed: {
    ko: "사용자 정보 API 동기화 실패 (HTTP {status})",
    es: "Fallo en la sincronización de la API de información de usuarios (HTTP {status})"
  },
} satisfies Record<string, Record<Lang, any>>;

export type SyncKey = keyof typeof dict;

/**
 * [SYNC 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/sync';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

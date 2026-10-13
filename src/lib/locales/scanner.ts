import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  scannerTitle: { ko: "QR 코드 스캐너", es: "Escáner QR" },
  scannerReadyTitle: { ko: "QR 스캔 준비 완료", es: "Listo para escanear QR" },
  scannerReadyDesc: { ko: "가이드 사각형 안에 QR 코드를 위치시켜 주세요", es: "Coloque el código QR dentro del recuadro de guía" },
  scannerSuccessTitle: { ko: "QR코드 인식 성공", es: "Código QR escaneado con éxito" },
  scannerSuccessDesc: { ko: "[{id}] 설비 검색됨", es: "Equipo [{id}] encontrado" },
  scannerRescan: { ko: "다시 스캔", es: "Volver a escanear" },
  scannerStart: { ko: "점검 시작", es: "Iniciar Inspección" },
  scannerWaitTitle: { ko: "잠시만요!", es: "¡Un momento!" },
  scannerConfirmStart: { ko: "위 설비의 점검을 시작하시겠습니까?", es: "¿Desea iniciar la inspección de este equipo?" },
  scannerNotFound: { ko: "유효한 설비를 찾을 수 없습니다.", es: "No se pudo encontrar un equipo válido." },
  scannerPermissionOrDamage: {
    ko: "카메라 권한을 확인하시거나 QR 코드가 손상되지 않았는지 확인해 주세요.",
    es: "Por favor, compruebe los permisos de la cámara o si el código QR está dañado."
  },
  scannerSearchPlaceholder: { ko: "설비명, 자산번호, 위치를 입력하세요...", es: "Ingrese nombre, ID o ubicación..." },
  scannerAssetIdLabel: { ko: "자산 번호", es: "ID de Equipo" },
  qrScanGuide: { ko: "QR 코드를 가이드 영역에 대어 주세요", es: "Por favor, coloque el código QR dentro del área de guía" },
  qrFlashToggle: { ko: "플래시 토글", es: "Alternar linterna" },
  qrPermissionError: { ko: "카메라 권한을 확인할 수 없습니다.", es: "No se pudo verificar el permiso de la cámara." },
  qrAccessError: { ko: "카메라 액세스에 실패했습니다. (권한 확인 필요)", es: "Fallo al acceder a la cámara. (Verifique los permisos)" },
  qrDisabledError: {
    ko: "카메라 권한이 비활성화되어 있습니다. 설정에서 허용해 주세요.",
    es: "El permiso de la cámara está desactivado. Por favor, permítalo en los ajustes."
  },
  qrStartError: { ko: "스캔 기능을 시작할 수 없습니다.", es: "No se pudo iniciar la función de escaneo." },
  maintenanceSelectEquipment: { ko: "설비 선택", es: "Seleccionar equipo" },
  maintenanceLocation: { ko: "위치", es: "Ubicación" },
  maintenanceInspectLabel: { ko: "점검", es: "Inspect" },
  maintenanceInfoNoResults: { ko: "\"{query}\" 검색 결과가 없습니다.", es: "No hay resultados para \"{query}\"." },
  maintenanceNotRegisteredEquip: { ko: "등록되지 않은 설비입니다. (ID: {id})", es: "Equipo no registrado. (ID: {id})" },
  maintenanceDbError: { ko: "데이터베이스 조회 중 오류가 발생했습니다.", es: "Error al consultar la base de datos." },
  maintenanceClearSearch: { ko: "초기화", es: "Limpiar" },
  maintenanceInfoNotFound: { ko: "설비 정보를 찾을 수 없습니다", es: "No se encontró información del equipo" },
  maintenanceManualEquipmentSearch: { ko: "Manual Equipment Search", es: "Búsqueda manual de equipos" },
  maintenanceManualSelect: { ko: "직접 설비 선택 (수동 검색)", es: "Seleccionar directamente (Búsqueda manual)" },
  maintenanceEquipInfo: { ko: "설비 정보 (ID / 설비명)", es: "Información del equipo (ID / Nombre)" },
  dateClose: { ko: "닫기", es: "Cerrar" },
} satisfies Record<string, Record<Lang, any>>;

export type ScannerKey = keyof typeof dict;

/**
 * [SCANNER 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/scanner';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  specsTitle: { ko: "설비 사양 조회", es: "Consulta de Especificaciones" },
  specsSubtitle: {
    ko: "시스템에 등록된 전체 설비의 상세 규격 및 위치 정보를 확인하세요.",
    es: "Verifique las especificaciones detalladas y la ubicación de todos los equipos registrados."
  },
  specsQrSearchTitle: { ko: "QR 스캔 검색", es: "Buscar por escáner QR" },
  specsImportance: { ko: "중요도", es: "IMP" },
  specsEquipName: { ko: "설비명", es: "Nombre" },
  specsProcess: { ko: "수리공정", es: "Proceso" },
  specsCapacity: { ko: "용량", es: "Capacidad" },
  specsDetailSpec: { ko: "상세 사양", es: "Especificación Detallada" },
  specsSpec: { ko: "규격", es: "Especificación" },
  specsLoadingSpecs: { ko: "설비 사양 로드 중...", es: "Cargando especificaciones..." },
  specsLoadMore: { ko: "설비 사양 더 보기", es: "Ver más" },
  searchPlaceholder: { ko: "설비명, ID, 위치, 유형으로 검색...", es: "Buscar por nombre, ID, ubicación, tipo..." },
  maintenanceLoadingMore: { ko: "로딩 중...", es: "Cargando..." },
  noSearchResultsTitle: { ko: "검색 결과 없음", es: "Sin resultados" },
  noSearchResultsDesc: { ko: '"{query}"에 대한 기록을 찾을 수 없습니다.', es: 'No se encontraron registros para "{query}".' },
  resetSearch: { ko: "검색어 초기화", es: "Restablecer búsqueda" },
} satisfies Record<string, Record<Lang, any>>;

export type SpecsKey = keyof typeof dict;

/**
 * [SPECS 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/specs';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

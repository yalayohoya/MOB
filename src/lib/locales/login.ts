import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  id: { ko: "ID", es: "ID" },
  idPlaceholder: { ko: "ID를 입력하세요", es: "Ingrese su ID" },
  password: { ko: "Password", es: "Contraseña" },
  passwordPlaceholder: { ko: "패스워드를 입력하세요", es: "Ingrese su contraseña" },
  login: { ko: "로그인", es: "Iniciar Sesión" },
  verifying: { ko: "확인 중...", es: "Verificando..." },
  loginCancel: { ko: "확인 중... (취소)", es: "Verificando... (Cancelar)" },
  loginCancelled: { ko: "로그인이 취소되었습니다.", es: "Inicio de sesión cancelado." },
  syncData: { ko: "사용자 정보 적용", es: "Aplicar información de usuario" },
  syncing: { ko: "적용 중...", es: "Aplicando..." },
  syncGuide: {
    ko: "최초 로그인 또는 사원 정보가 없을 경우 사용자 정보 적용이 필요합니다.",
    es: "Se requiere aplicar la información del usuario para el primer inicio de sesión o si no hay información del empleado."
  },
  online: { ko: "온라인", es: "En línea" },
  offline: { ko: "오프라인", es: "Fuera de línea" },
  version: { ko: "모바일 설비점검 Ver", es: "Inspección de Equipos Móviles Ver" },
  inputError: { ko: "ID와 비밀번호를 모두 입력해주세요.", es: "Por favor, introduzca tanto el ID de empleado como el nombre." },
  loginFailed: { ko: "로그인에 실패했습니다.", es: "Error al iniciar sesión." },
  loginError: { ko: "로그인 중 오류가 발생했습니다.", es: "Ocurrió un error durante el inicio de sesión." },
  loginTimeout: {
    ko: "인증 세션이 만료되었습니다. 다시 로그인해 주세요.",
    es: "La sesión de autenticación ha caducado. Por favor, inicie sesión de nuevo."
  },
  requestTimeout: {
    ko: "로그인 요청 시간이 초과되었습니다. 서버 상태 또는 단말기의 네트워크 상태를 확인해 주세요.",
    es: "El tiempo de espera de la solicitud de inicio de sesión ha expirado. Por favor, verifique el estado del servidor o la red del dispositivo."
  },
  duplicateLoginTitle: { ko: "중복 로그인 감지", es: "Doble Inicio de Sesión" },
  duplicateLoginMessage: {
    ko: "이미 다른 기기에서 로그인되어 있습니다.\n이전 연결을 끊고 현재 기기에서 로그인하시겠습니까?",
    es: "Ya ha iniciado sesión en otro dispositivo.\n¿Desea cerrar la sesión anterior e iniciar sesión en este dispositivo?"
  },
  dbInitErrorTitle: { ko: "데이터베이스 연결 실패", es: "Error de Base de Datos" },
  dbInitErrorMsg: {
    ko: "로컬 데이터베이스 연결 도중 치명적인 오류가 발생했습니다.\n\n오류가 지속될 경우 기기 설정의 애플리케이션 정보에서 [데이터 삭제]를 실행하시거나 앱을 재설치해 주시기 바랍니다.",
    es: "Ocurrió un error crítico al conectar a la base de datos local.\n\nSi el error persiste, elimine los datos de la aplicación en los ajustes del dispositivo o reinstale la aplicación."
  },
  updateInspectorsTitle: { ko: "점검자 명단 업데이트", es: "Actualizar Inspectores" },
  confirm: { ko: "확인", es: "Aceptar" },
  apply: { ko: "적용", es: "Aplicar" },
  cancel: { ko: "취소", es: "Cancelar" },
  syncConfirmTitle: { ko: "데이터 수신 경고", es: "Advertencia de Recepción de Datos" },
  applyLatestExcel: { ko: "최신 엑셀 파일 적용", es: "Seleccionar Archivo Excel" },
  invalidCredentials: { ko: "아이디 또는 비밀번호가 올바르지 않습니다.", es: "El usuario o la contraseña son incorrectos." },
  pwShowPassword: { ko: "비밀번호 표시", es: "Mostrar contraseña" },
  pwHidePassword: { ko: "비밀번호 숨기기", es: "Ocultar contraseña" },
  missingUrl: { ko: "서버 URL 주소를 확인해 주세요.", es: "Por favor, verifique la URL del servidor." },
  connectionError: { ko: "네트워크 연결 상태를 확인해 주세요.", es: "Verifique el estado de la conexión de red." },
  syncGuideDetail: {
    ko: "사원 정보 또는 설비 기준 정보가 로컬에 없을 경우 동기화를 먼저 진행해 주세요.",
    es: "Si no hay información de empleados o equipos localmente, sincronice primero."
  },
  excelPickerDescription: {
    ko: "기기에 저장된 최신 점검자 명단 엑셀 파일(.xlsx)을 선택하여 앱에 반영해 주세요:",
    es: "Seleccione el archivo Excel (.xlsx) con la lista de inspectores más reciente guardada en el dispositivo para aplicarla a la aplicación:"
  },
  syncConfirmMessage: {
    ko: "아직 송신(보고)하지 않은 점검 실적이 존재하는 경우 덮어씌워지거나 초기화될 수 있습니다. 진행하시겠습니까?",
    es: "Si hay registros de inspección no enviados, podrían sobrescribirse o reiniciarse. ¿Desea continuar?"
  },
} satisfies Record<string, Record<Lang, any>>;

export type LoginKey = keyof typeof dict;

/**
 * [LOGIN 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/login';
 *   {$t.someKey}
 */
export const t = createLocaleStore(dict);

/**
 * Date 객체를 로컬 시간 기준 YYYY-MM-DD 형식의 문자열로 변환합니다.
 * 타임존(UTC) 시차로 인해 날짜가 하루 밀리는 현상을 방지합니다.
 *
 * @param date 변환할 Date 객체 (기본값: 현재 시간)
 * @returns YYYY-MM-DD 형식의 문자열 (예: "2026-06-23")
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Date 객체를 로컬 시간 기준 YYYYMMDDHHMMSS 형식의 문자열로 변환합니다.
 *
 * @param date 변환할 Date 객체 (기본값: 현재 시간)
 * @returns YYYYMMDDHHMMSS 형식의 문자열 (예: "20260623085747")
 */
export function toLocalDtmString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}


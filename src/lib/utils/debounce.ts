/**
 * 함수 실행을 지정된 시간만큼 지연(Debounce)시키는 유틸리티 함수입니다.
 * 연속된 키 입력 등으로 인한 잦은 DB 조회/API 요청을 방지하는 데 사용됩니다.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return function (...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}

/**
 * 지정된 시간(timeout) 내에 응답이 없으면 자동으로 요청을 abort 시키는 fetch 래퍼 함수입니다.
 * 외부에서 주입받은 AbortSignal이 취소될 경우 즉각 native fetch를 취소합니다.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = 10000, signal, ...rest } = options;
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  // 외부 AbortSignal과 내부 AbortController 동기화
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      const err = new Error('The user aborted a request.');
      err.name = 'AbortError';
      throw err;
    }

    signal.addEventListener('abort', () => {
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    // AbortController가 취소된 경우
    if (error.name === 'AbortError') {
      if (signal?.aborted) {
        // 사용자가 취소를 눌러 중단된 경우: AbortError 그대로 반환
        throw error;
      } else {
        // 사용자가 취소하지 않았는데 AbortError가 발생한 경우: 타임아웃으로 인한 자동 중단
        throw new Error('timeout');
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

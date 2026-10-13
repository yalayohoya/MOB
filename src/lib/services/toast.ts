import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

/**
 * 모바일 네이티브와 웹 브라우저를 모두 지원하는 스마트 토스트 서비스
 */
export async function showToast(text: string) {
  try {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      // 1. 기존에 남아있는 토스트가 있다면 제거
      const existingToast = document.querySelector('.custom-web-toast');
      if (existingToast) {
        existingToast.remove();
      }

      // 2. 안드로이드 스타일 토스트 요소 동적 생성
      const toastEl = document.createElement('div');
      toastEl.className = 'custom-web-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-[99999] px-5 py-2.5 rounded-full bg-[#323232]/95 text-white text-[13px] font-normal shadow-md transition-all duration-200 transform scale-95 opacity-0 pointer-events-none text-center tracking-wide font-sans flex items-center justify-center max-w-[85%]';
      toastEl.innerText = text;
      document.body.appendChild(toastEl);

      // 리페인트 강제 유도 (트랜지션 애니메이션 활성화)
      toastEl.getBoundingClientRect();

      // 3. 안드로이드 특유의 페이드 & 스케일 애니메이션
      toastEl.classList.remove('scale-95', 'opacity-0');
      toastEl.classList.add('scale-100', 'opacity-100');

      // 4. 2초 후에 서서히 사라지도록 설정
      setTimeout(() => {
        toastEl.classList.remove('scale-100', 'opacity-100');
        toastEl.classList.add('scale-95', 'opacity-0');
        
        // 애니메이션 완료 후 DOM에서 완전히 삭제
        setTimeout(() => {
          toastEl.remove();
        }, 200);
      }, 2000);
    } else {
      // 5. 모바일 네이티브 기기에서는 OS 표준 Toast 호출
      await Toast.show({
        text: text,
        duration: 'short'
      });
    }
  } catch (err) {
    console.warn('[Toast Service] Failed to show toast:', err);
    // 폴백 브라우저 기본 알림
    alert(text);
  }
}

import { writable } from 'svelte/store';
import { Network, type ConnectionStatus } from '@capacitor/network';

function createNetworkStore() {
  const store = writable<boolean>(true);
  let devOverride: boolean | null = null;

  if (typeof window !== 'undefined') {
    // 초기 상태 가져오기
    Network.getStatus().then((status: ConnectionStatus) => {
      if (devOverride === null) {
        // WIFI에 연결된 상태일 때만 온라인으로 판별 (Cellular 등은 오프라인 처리)
        // 사설망 환경(인터넷 연결 없음) 지원을 위해 status.connected 조건 제외
        const isWifi = status.connectionType === 'wifi';
        store.set(isWifi);
      }
    });

    // 상태 변경 리스너 등록
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      if (devOverride === null) {
        const isWifi = status.connectionType === 'wifi';
        store.set(isWifi);
      }
    });
  }

  return {
    subscribe: store.subscribe,
    // 개발자 모드 전용 강제 상태 토글 오버라이드
    setOverride: (value: boolean | null) => {
      devOverride = value;
      if (value !== null) {
        store.set(value);
      } else {
        // 오버라이드 해제 시 네이티브 실제 상태 복구
        Network.getStatus().then((status: ConnectionStatus) => {
          const isWifi = status.connectionType === 'wifi';
          store.set(isWifi);
        });
      }
    },
    getOverride: () => devOverride
  };
}

export const isOnline = createNetworkStore();

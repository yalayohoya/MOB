<script lang="ts">
  import DownloadProgressOverlay from "$lib/components/DownloadProgressOverlay.svelte";
  import { goto } from "$app/navigation";

  let showOverlay = false;
  let progressValue = 0;
  let fileName = "app-debug_v14.0_B.apk";
  let intervalId: any = null;

  // 0% -> 100% 자동 진행 시뮬레이션
  function startPercentSimulation() {
    stopSimulation();
    showOverlay = true;
    progressValue = 0;

    intervalId = setInterval(() => {
      progressValue += 5;
      if (progressValue >= 100) {
        progressValue = 100;
        clearInterval(intervalId);
        setTimeout(() => {
          showOverlay = false;
        }, 1500);
      }
    }, 200);
  }

  // Content-Length가 없을 때 (비결정적/Indeterminate) 시뮬레이션
  function startIndeterminateSimulation() {
    stopSimulation();
    showOverlay = true;
    progressValue = -1;

    setTimeout(() => {
      showOverlay = false;
    }, 5000);
  }

  function stopSimulation() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    showOverlay = false;
  }
</script>

<svelte:head>
  <title>Download Progress Overlay Preview</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center space-y-6 font-sans">
  <div class="max-w-md w-full bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 space-y-6">
    <div class="flex items-center justify-between pb-2 border-b border-slate-100">
      <button
        type="button"
        on:click={() => goto('/')}
        class="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#005B9C] transition-colors cursor-pointer"
      >
        <span>← 메인 로비로 돌아가기</span>
      </button>
      <span class="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">TEST ROOM</span>
    </div>

    <div class="text-center space-y-1">
      <h1 class="text-lg font-extrabold text-slate-800 tracking-tight">
        ✨ APK 다운로드 프로그래스 라운지
      </h1>
      <p class="text-xs text-slate-500 font-medium">
        전체 화면 커버 GUI 프로그래스바 및 점멸 애니메이션 테스트
      </p>
    </div>

    <!-- 컨트롤 버튼 그룹 -->
    <div class="space-y-3">
      <button
        type="button"
        on:click={startPercentSimulation}
        class="w-full bg-[#005B9C] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>📊 0% ➔ 100% 게이지 시뮬레이션</span>
      </button>

      <button
        type="button"
        on:click={startIndeterminateSimulation}
        class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>🌀 무한 좌우 바 애니메이션 (크기 미상)</span>
      </button>

      <button
        type="button"
        on:click={() => { showOverlay = true; progressValue = 45; }}
        class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>⏸️ 45% 고정 정지 화면 모드</span>
      </button>
    </div>

    <!-- 설정 조절 레버 -->
    <div class="pt-4 border-t border-slate-100 space-y-4">
      <div class="space-y-1.5">
        <label for="fileNameInput" class="text-xs font-bold text-slate-600 block">테스트 파일명</label>
        <input
          id="fileNameInput"
          type="text"
          bind:value={fileName}
          class="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#005B9C]"
        />
      </div>

      {#if showOverlay}
        <button
          type="button"
          on:click={stopSimulation}
          class="w-full bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2 rounded-lg text-xs cursor-pointer"
        >
          ❌ 테스트 닫기
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- 테스트 컴포넌트 렌더링 (테스트 모드 활성화) -->
<DownloadProgressOverlay
  show={showOverlay}
  progressValue={progressValue}
  fileName={fileName}
  isTestMode={true}
  on:close={stopSimulation}
/>

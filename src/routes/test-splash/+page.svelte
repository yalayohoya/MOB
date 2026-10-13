<script lang="ts">
  import AppSplashScreen from '$lib/components/AppSplashScreen.svelte';
  import { lang, t } from '$lib/stores/lang';
  import { goto } from '$app/navigation';

  let isAlwaysShow = true;
  let customStatusText = '';
  let selectedPreset = 'default';

  const statusPresets = [
    { id: 'default', label: '기본 (자동)', text: '' },
    { id: 'db', label: '1단계: DB 초기화', text: '시스템 데이터베이스 초기화 중...' },
    { id: 'version', label: '2단계: 서버 버전 점검', text: '서버 앱 버전 점검 중...' },
    { id: 'auth', label: '3단계: 세션 확인', text: '사용자 인증 세션 확인 중...' },
    { id: 'ready', label: '4단계: 준비 완료', text: '앱 준비 완료' },
  ];

  function handlePresetChange(presetText: string) {
    customStatusText = presetText;
  }
</script>

<div class="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
  <!-- 컨트롤 패널 (스플래시 화면 위 상단 제어 바) -->
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] bg-slate-800/90 backdrop-blur-md border border-slate-700/80 p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 max-w-2xl w-full">
    <div class="flex items-center gap-3">
      <button
        type="button"
        on:click={() => goto('/')}
        class="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition-colors cursor-pointer"
      >
        ← 로비
      </button>
      <div>
        <h1 class="text-sm font-bold text-white">스플래시 디자인 테스트 라운지</h1>
        <p class="text-[11px] text-slate-400">http://localhost:5173/test-splash</p>
      </div>
    </div>

    <!-- 토글 및 프리셋 선택 -->
    <div class="flex items-center gap-3">
      <!-- 상태 텍스트 프리셋 셀렉트 -->
      <select
        on:change={(e) => handlePresetChange(e.currentTarget.value)}
        class="bg-slate-700 text-xs text-slate-200 border border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {#each statusPresets as preset}
          <option value={preset.text}>{preset.label}</option>
        {/each}
      </select>

      <!-- 스플래시 표시/숨김 토글 버튼 -->
      <button
        on:click={() => (isAlwaysShow = !isAlwaysShow)}
        class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 {isAlwaysShow ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}"
      >
        {isAlwaysShow ? '스플래시 닫기 (Hide)' : '스플래시 고정 켜기 (Show)'}
      </button>
    </div>
  </div>

  <!-- 테스트 가이드 배경 내용 -->
  <div class="max-w-xl mx-auto pt-32 text-center space-y-4">
    <p class="text-sm text-slate-400">
      위 상단 컨트롤 패널에서 <b>[스플래시 고정 켜기]</b> 버튼을 누르거나 다국어/단계별 텍스트를 변경해가며 디자인을 자유롭게 미리보기 하실 수 있습니다.
    </p>
  </div>

  <!-- 스플래시 테스트 표출 컴포넌트 -->
  <AppSplashScreen show={isAlwaysShow} statusText={customStatusText} />
</div>

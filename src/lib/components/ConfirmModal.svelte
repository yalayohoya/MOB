<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { lang } from '$lib/stores/lang';
  import { t } from '$lib/locales/common';
  import DatePickerModal from '$lib/components/DatePickerModal.svelte';
  import { toLocalDateString } from '$lib/utils/date';

  export let isOpen = false;
  export let title = '';
  export let message = '';
  export let confirmText = '';
  export let cancelText = '';
  
  // 모달의 시각 테마 설정: 'confirm' (질문/동작확인), 'success' (성공 알림), 'error' (실패/에러 알림), 'warning' (경고/알림), 'none' (아이콘 없음)
  export let type: 'confirm' | 'success' | 'error' | 'warning' | 'none' = 'confirm';
  
  // 시각적 GUI 프로그래스 바 수치 (0~100)
  export let progressValue: number | null = null;

  // 날짜 범위 선택기 노출 여부 (동기화 컨펌용)
  export let showDateRange: boolean = false;
  export let fromDt: string = '';
  export let toDt: string = '';

  // 달력 모달 제어 상태 ('from' | 'to' | null)
  let activeDatePicker: 'from' | 'to' | null = null;

  // 날짜 유효성 검증 에러 메시지
  let dateRangeError: string = '';

  // 취소 버튼 노출 여부 (success / error 타입일 경우 기본적으로 1버튼(확인만) 모드로 동작)
  export let showCancel = type === 'confirm' || type === 'warning' || type === 'none';

  const dispatch = createEventDispatcher();

  // 상위 주입값이 없을 경우 현재 언어 스토어 상태에 매칭되어 자동으로 현지화
  $: defaultConfirm = confirmText || $t.confirm;
  $: defaultCancel = cancelText || $t.cancel;

  // 종료일(toDt) 기준으로 최소 입력 가능 시작일(1개월 전) 계산 (타임존 방어)
  $: minFromDt = (() => {
    if (!toDt) return '';
    const parts = toDt.split('-').map(Number);
    if (parts.length !== 3) return '';
    const d = new Date(parts[0], parts[1] - 1 - 1, parts[2]);
    return toLocalDateString(d);
  })();

  // 시작일(fromDt) 기준으로 최대 입력 가능 종료일(1개월 후) 계산 (타임존 방어)
  $: maxToDt = (() => {
    if (!fromDt) return '';
    const parts = fromDt.split('-').map(Number);
    if (parts.length !== 3) return '';
    const d = new Date(parts[0], parts[1] - 1 + 1, parts[2]);
    return toLocalDateString(d);
  })();

  // 실시간 날짜 동적 유효성 검사
  $: {
    if (showDateRange && fromDt && toDt) {
      if (fromDt > toDt) {
        dateRangeError = '시작일은 종료일보다 이후 날짜일 수 없습니다.';
      } else if (minFromDt && fromDt < minFromDt) {
        dateRangeError = '조회 기간은 종료일 기준 최대 1개월까지만 설정 가능합니다.';
      } else {
        dateRangeError = '';
      }
    } else {
      dateRangeError = '';
    }
  }

  function handleConfirm() {
    if (showDateRange) {
      if (fromDt > toDt) {
        alert('시작일은 종료일보다 이후 날짜일 수 없습니다.');
        return;
      }
      if (minFromDt && fromDt < minFromDt) {
        alert('시작일은 종료일 기준 최대 1개월 전까지만 선택 가능합니다.');
        return;
      }
    }
    isOpen = false;
    dispatch('confirm', { fromDt, toDt });
  }

  function handleCancel() {
    isOpen = false;
    dispatch('cancel');
    dispatch('close');
  }
</script>

{#if isOpen}
  <!-- 글래스모피즘 백드롭 오버레이 (아크릴릭 블러) -->
  <div
    class="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
    transition:fade={{ duration: 200 }}
  >
    <!-- 뒷배경 영역 클릭 시 취소 처리 (컨펌 모드일 때만 적용, 단순 알림 모드일 때는 강제 닫기 방지) -->
    <button
      type="button"
      class="absolute inset-0 w-full h-full cursor-default outline-none border-none bg-transparent z-0"
      on:click={type === 'confirm' ? handleCancel : handleConfirm}
      aria-label="Close modal"
    ></button>

    <!-- 프리미엄 팝업 카드 바디 -->
    <div
      class="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-zinc-800/80 p-6 flex flex-col items-center text-center overflow-hidden"
      transition:fly={{ y: 24, duration: 300 }}
    >
      <!-- 타입별 프리미엄 아이콘 엠블럼 (type === 'none'일 경우 미노출) -->
      {#if type === 'success'}
        <!-- 1. 성공 엠블럼 (에메랄드 그린 체크) -->
        <div class="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4 border border-emerald-100/60 dark:border-emerald-900/30 shadow-inner">
          <svg
            class="w-7 h-7 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      {:else if type === 'error'}
        <!-- 2. 에러/실패 엠블럼 (로즈 레드 경고) -->
        <div class="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-4 border border-rose-100/60 dark:border-rose-900/30 shadow-inner">
          <svg
            class="w-7 h-7 text-rose-600 dark:text-rose-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      {:else if type === 'warning'}
        <!-- 4. 경고/알림 엠블럼 (앰버/오렌지 경고) -->
        <div class="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4 border border-amber-100/60 dark:border-amber-900/30 shadow-inner">
          <svg
            class="w-7 h-7 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      {:else if type === 'confirm'}
        <!-- 3. 컨펌/질문 엠블럼 (포스코 스틸 블루 물음표) -->
        <div class="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4 border border-blue-100/60 dark:border-blue-900/30 shadow-inner">
          <svg
            class="w-7 h-7 text-blue-600 dark:text-blue-400 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      {/if}

      <!-- 타이틀 및 설명 문구 -->
      <h3 class="text-base font-extrabold text-slate-800 dark:text-zinc-100 mb-3 tracking-tight">
        {showDateRange ? '점검계획기간 설정' : title}
      </h3>

      {#if !showDateRange}
        <p class="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4 font-medium whitespace-pre-line px-1">
          {message}
        </p>
      {/if}

      <!-- 동기화 점검계획 수신 날짜 범위 선택 (FROM_DT / TO_DT) -->
      {#if showDateRange}
        <div class="w-full bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 mb-3 border border-slate-200/60 dark:border-zinc-700/60 text-left space-y-2">
          <div class="text-[11px] font-bold text-slate-600 dark:text-zinc-300 flex items-center justify-between mb-1">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              수신 기간
            </span>
            <span class="text-[10px] text-slate-400 dark:text-zinc-400 font-normal">(최대 1개월)</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="block text-[10px] text-slate-400 dark:text-zinc-400 font-semibold mb-1">시작일</span>
              <button
                type="button"
                on:click={() => (activeDatePicker = 'from')}
                class="w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-blue-500 rounded-lg text-slate-800 dark:text-zinc-200 font-mono text-left flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>{fromDt || 'YYYY-MM-DD'}</span>
                <svg class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 dark:text-zinc-400 font-semibold mb-1">종료일</span>
              <button
                type="button"
                on:click={() => (activeDatePicker = 'to')}
                class="w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-blue-500 rounded-lg text-slate-800 dark:text-zinc-200 font-mono text-left flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>{toDt || 'YYYY-MM-DD'}</span>
                <svg class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
          {#if dateRangeError}
            <div class="text-[10px] text-rose-500 font-medium pt-1 flex items-center gap-1">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {dateRangeError}
            </div>
          {/if}
        </div>

        <!-- 주의 메세지 강조 박스 (날짜 범위 선택창 아래로 이동) -->
        <div class="w-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 mb-4 text-left flex items-start gap-2 shadow-sm">
          <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="text-[11px] text-amber-800 dark:text-amber-300 leading-snug font-semibold">
            <span class="font-bold text-amber-700 dark:text-amber-400">주의:</span> {message}
          </div>
        </div>
      {/if}

      <!-- 시각적 GUI 프로그래스 바 (progressValue가 존재할 때만 표시) -->
      {#if progressValue !== null}
        <div class="w-full space-y-2 mb-6 px-1">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-slate-500 dark:text-zinc-400">Downloading...</span>
            <span class="text-blue-600 dark:text-blue-400 font-mono font-bold text-sm">{progressValue}%</span>
          </div>
          <div class="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-zinc-700/60 shadow-inner">
            <div
              class="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
              style="width: {Math.max(0, Math.min(100, progressValue))}%;"
            ></div>
          </div>
        </div>
      {/if}

      <!-- 하단 액션 버튼 그룹 (확인 / 취소) -->
      <div class="flex gap-3 w-full">
        {#if showCancel}
          <button
            type="button"
            on:click={handleCancel}
            class="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] text-xs uppercase tracking-wider outline-none border-none cursor-pointer"
          >
            {defaultCancel}
          </button>
        {/if}
        <button
          type="button"
          on:click={handleConfirm}
          class="{showCancel ? 'flex-1' : 'w-full'} bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-[0.97] text-xs uppercase tracking-wider outline-none border-none cursor-pointer"
        >
          {defaultConfirm}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 시작일 선택 달력 모달 (종료일 초과 불가 & 최소 1개월 전 제한) -->
<DatePickerModal
  isOpen={activeDatePicker === 'from'}
  value={fromDt}
  min={minFromDt}
  max={toDt}
  lang={$lang}
  onSelect={(selectedDate) => {
    fromDt = selectedDate;
  }}
  onClose={() => (activeDatePicker = null)}
/>

<!-- 종료일 선택 달력 모달 (시작일 이전 및 시작일 기준 1개월 초과 선택 불가) -->
<DatePickerModal
  isOpen={activeDatePicker === 'to'}
  value={toDt}
  min={fromDt}
  max={maxToDt}
  lang={$lang}
  onSelect={(selectedDate) => {
    toDt = selectedDate;
  }}
  onClose={() => (activeDatePicker = null)}
/>

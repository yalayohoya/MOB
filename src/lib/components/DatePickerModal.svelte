<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { t as langStore } from '$lib/stores/lang';
  import { toLocalDateString } from '$lib/utils/date';

  interface Props {
    isOpen: boolean;
    value: string; // YYYY-MM-DD
    min?: string; // 최소 선택가능 날짜 (YYYY-MM-DD)
    max?: string; // 최대 선택가능 날짜 (YYYY-MM-DD)
    lang?: 'ko' | 'es';
    onSelect: (date: string) => void;
    onClose: () => void;
  }

  let { 
    isOpen = $bindable(false), 
    value, 
    min = '',
    max = '',
    lang = 'ko', 
    onSelect, 
    onClose 
  }: Props = $props();

  // 내부 상태 (연도 및 월)
  let currentYear = $state(new Date().getFullYear());
  let currentMonth = $state(new Date().getMonth()); // 0-11

  // 외부 value 또는 모달 오픈 시 연도와 월을 동기화
  $effect(() => {
    if (isOpen) {
      const targetDateStr = value || min || max || toLocalDateString();
      const parts = targetDateStr.split('-');
      if (parts.length === 3) {
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10) - 1;
      }
    }
  });

  // 다국어 스토어 매핑
  const weekdays = $derived(langStore[lang].dateWeekdays);
  const todayLabel = $derived(langStore[lang].dateToday);
  const closeLabel = $derived(langStore[lang].dateClose);
  const prevMonthLabel = $derived(langStore[lang].datePrevMonth);
  const nextMonthLabel = $derived(langStore[lang].dateNextMonth);

  // 달력 상단 연월 타이틀 포맷팅
  const calendarTitle = $derived(
    langStore[lang].dateTitleFormat
      .replace('{year}', String(currentYear))
      .replace('{month}', langStore[lang].dateMonths[currentMonth])
  );

  // 특정 월의 일수 구하기
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  interface CalendarDay {
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
    formatted: string;
  }

  // 날짜 선택 제한 유효성 체크 헬퍼
  function checkIsDisabled(formatted: string): boolean {
    if (min && formatted < min) return true;
    if (max && formatted > max) return true;
    return false;
  }

  // 달력 그리드 생성 (Svelte 5 반응형 $derived)
  const calendarDays = $derived.by<CalendarDay[]>(() => {
    const days: CalendarDay[] = [];
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = getDaysInMonth(currentYear, currentMonth);

    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthDays = getDaysInMonth(prevYear, prevMonth);

    // 오늘 날짜 문자열
    const todayStr = toLocalDateString();

    // 이전 달 잔여 일자
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const formatted = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: formatted === todayStr,
        isSelected: formatted === value,
        isDisabled: checkIsDisabled(formatted),
        formatted
      });
    }

    // 현재 달 일자
    for (let i = 1; i <= totalDays; i++) {
      const formatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNum: i,
        isCurrentMonth: true,
        isToday: formatted === todayStr,
        isSelected: formatted === value,
        isDisabled: checkIsDisabled(formatted),
        formatted
      });
    }

    // 다음 달 잔여 일자 (6주 그리드인 42개 고정)
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    let nextMonthDay = 1;
    while (days.length < 42) {
      const formatted = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
      days.push({
        dayNum: nextMonthDay,
        isCurrentMonth: false,
        isToday: formatted === todayStr,
        isSelected: formatted === value,
        isDisabled: checkIsDisabled(formatted),
        formatted
      });
      nextMonthDay++;
    }

    return days;
  });

  // 월 전환
  function changeMonth(step: number) {
    currentMonth += step;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    } else if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    }
  }

  // 오늘 날짜 이동 및 선택 (제한 범위 내일 때만)
  function selectToday() {
    const formatted = toLocalDateString();
    if (checkIsDisabled(formatted)) return;
    onSelect(formatted);
    onClose();
  }

  function handleSelect(formatted: string, isDisabled: boolean) {
    if (isDisabled) return;
    onSelect(formatted);
    onClose();
  }
</script>

{#if isOpen}
  <!-- 모달 오버레이 (바깥 여백 흐리게 처리) -->
  <div 
    class="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
    transition:fade={{ duration: 150 }}
  >
    <!-- 백드롭 클릭 시 닫기 -->
    <button 
      class="absolute inset-0 w-full h-full bg-transparent border-none cursor-default" 
      onclick={onClose}
      aria-label={closeLabel}
    ></button>

    <!-- 모달 바디 -->
    <div 
      class="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[95vh]"
      transition:fly={{ y: 20, duration: 250 }}
    >
      <!-- 헤더: 연월 표시 및 스위처 -->
      <div class="flex items-center justify-between px-1">
        <button 
          onclick={() => changeMonth(-1)}
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-colors border-none outline-none cursor-pointer"
          aria-label={prevMonthLabel}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span class="text-base font-black text-slate-800 dark:text-zinc-100 font-sans tracking-tight">
          {calendarTitle}
        </span>

        <button 
          onclick={() => changeMonth(1)}
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-colors border-none outline-none cursor-pointer"
          aria-label={nextMonthLabel}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- 요일 헤더 그리드 -->
      <div class="grid grid-cols-7 gap-1 text-center shrink-0">
        {#each weekdays as day, i}
          <span class="text-[11px] font-black tracking-wide uppercase py-1
            {i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-500'}">
            {day}
          </span>
        {/each}
      </div>

      <!-- 달력 일자 그리드 -->
      <div class="grid grid-cols-7 gap-1 text-center shrink-0 font-mono">
        {#each calendarDays as { dayNum, isCurrentMonth, isToday, isSelected, isDisabled, formatted }, i}
          {@const isSunday = i % 7 === 0}
          {@const isSaturday = i % 7 === 6}

          <button
            disabled={isDisabled}
            onclick={() => handleSelect(formatted, isDisabled)}
            class="aspect-square w-full rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative border-none outline-none select-none
              {isDisabled
                ? 'text-slate-200 dark:text-zinc-800 opacity-40 cursor-not-allowed line-through decoration-slate-300 dark:decoration-zinc-700'
                : !isCurrentMonth 
                  ? 'text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer' 
                  : isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.05] cursor-pointer'
                    : isToday
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 border border-blue-200/50 dark:border-blue-800/40 cursor-pointer'
                      : isSunday
                        ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer'
                        : isSaturday
                          ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer'
              }"
          >
            {dayNum}
          </button>
        {/each}
      </div>

      <!-- 푸터 액션 영역 -->
      <div class="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-3.5 mt-1 shrink-0">
        <button
          onclick={selectToday}
          class="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-black rounded-xl border-none outline-none cursor-pointer select-none transition-colors"
        >
          {todayLabel}
        </button>

        <button
          onclick={onClose}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl border-none outline-none cursor-pointer select-none transition-colors shadow-xs shadow-blue-500/10"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

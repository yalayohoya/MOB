<script lang="ts">
  import DatePickerModal from "./DatePickerModal.svelte";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/common";

  let { selectedDate = $bindable() } = $props();

  let isDatePickerOpen = $state(false);

  function changeDate(days: number) {
    const parts = selectedDate.split("-");
    if (parts.length !== 3) return;
    const current = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );
    if (isNaN(current.getTime())) return;
    current.setDate(current.getDate() + days);

    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    selectedDate = `${yyyy}-${mm}-${dd}`;
  }
</script>

<div
  class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3 py-1 shadow-xs flex items-center justify-between px-4 w-full"
>
  <button
    onclick={() => changeDate(-1)}
    class="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-200 rounded-xl transition-colors border-none outline-none select-none cursor-pointer group"
    aria-label={$t.datePrevDay}
  >
    <svg
      class="w-5 h-5 text-slate-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2.5"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  </button>

  <!-- 커스텀 달력 모달 트리거 버튼 -->
  <button
    onclick={() => (isDatePickerOpen = true)}
    class="flex gap-2 items-center px-4 py-1.5 select-none cursor-pointer group"
  >
    <!-- 날짜 텍스트 -->
    <span
      class="text-base font-black text-slate-700 dark:text-zinc-200 font-mono tracking-tight"
    >
      {selectedDate}
    </span>
  </button>

  <button
    onclick={() => changeDate(1)}
    class="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-200 rounded-xl transition-colors border-none outline-none select-none cursor-pointer group"
    aria-label={$t.dateNextDay}
  >
    <svg
      class="w-5 h-5 text-slate-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2.5"
        d="M9 5l7 7-7 7"
      />
    </svg>
  </button>
</div>

<DatePickerModal
  bind:isOpen={isDatePickerOpen}
  value={selectedDate}
  lang={$lang}
  onSelect={(date) => {
    selectedDate = date;
  }}
  onClose={() => (isDatePickerOpen = false)}
/>

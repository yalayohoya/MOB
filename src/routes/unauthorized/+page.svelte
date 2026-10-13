<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { pageTitle } from "$lib/stores/ui";
  import { t } from "$lib/locales/unauthorized";

  onMount(() => {
    pageTitle.set($t.unauthorizedTitle);
  });

  $: {
    pageTitle.set($t.unauthorizedTitle);
  }

  function handleGoToMain() {
    goto("/");
  }
</script>

<div class="flex-1 flex items-center justify-center p-6 font-sans">
  <div
    class="max-w-lg w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-10 md:p-12 shadow-lg text-center space-y-8"
  >
    <!-- 경고 아이콘 (Warning Icon) -->
    <div class="flex justify-center text-rose-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.8"
        stroke="currentColor"
        class="w-20 h-20 animate-pulse"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
        />
      </svg>
    </div>

    <!-- 제목 및 설명 메세지 -->
    <div class="space-y-4">
      <h2
        class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-zinc-150 uppercase tracking-tight"
      >
        {$t.unauthorizedTitle}
      </h2>
      <p
        class="text-base sm:text-lg text-slate-500 dark:text-zinc-400 font-semibold leading-relaxed"
      >
        {$t.unauthorizedDesc}
      </p>
    </div>

    <!-- 조작 컨트롤 버튼 -->
    <div class="pt-4">
      <button
        on:click={handleGoToMain}
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-4 px-8 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] uppercase tracking-wider text-sm sm:text-base cursor-pointer border-none outline-none"
      >
        {$t.unauthorizedGoToMain}
      </button>
    </div>
  </div>
</div>

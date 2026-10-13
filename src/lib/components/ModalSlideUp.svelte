<script lang="ts">
  import { fly } from "svelte/transition";
  import { createEventDispatcher, onDestroy } from "svelte";
  import { t } from "$lib/locales/common";

  import { Capacitor } from "@capacitor/core";

  export let isOpen = false;
  export let title = "";
  export let subTitle = "";

  export let zIndex = "200";

  const dispatch = createEventDispatcher();

  let backHandlerId: any = null;

  function close() {
    isOpen = false;
    dispatch("close");
  }

  $: if (typeof window !== "undefined" && Capacitor.getPlatform() !== "web") {
    if (isOpen && !backHandlerId) {
      if (!(window as any).backButtonHandlers) {
        (window as any).backButtonHandlers = [];
      }
      const handler = () => {
        close();
      };
      (window as any).backButtonHandlers.push(handler);
      backHandlerId = handler;
    } else if (!isOpen && backHandlerId) {
      (window as any).backButtonHandlers = (window as any).backButtonHandlers.filter(
        (h: any) => h !== backHandlerId
      );
      backHandlerId = null;
    }
  }

  onDestroy(() => {
    if (typeof window !== "undefined" && backHandlerId) {
      (window as any).backButtonHandlers = (window as any).backButtonHandlers.filter(
        (h: any) => h !== backHandlerId
      );
    }
  });
</script>

{#if isOpen}
  <div
    class="fixed modal-slide-up-container inset-0 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm px-0 sm:px-4"
    style="z-index: {zIndex};"
  >
    <!-- 배경 클릭 시 닫기 -->
    <button
      class="absolute inset-0 w-full h-full cursor-default"
      on:click={close}
      aria-label={$t.dateClose}
    ></button>

    <div class="relative w-full max-w-lg flex flex-col max-h-[92vh]">
      <!-- 실제 콘텐츠 컨테이너 -->
      <div
        class="bg-white dark:bg-zinc-900 w-full rounded-t-3xl sm:rounded-4xl shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.3)] dark:shadow-none overflow-hidden border-t sm:border border-white/10 flex flex-col h-full"
        transition:fly={{ y: "100%", duration: 400, opacity: 1 }}
      >
        <!-- 상단 핸들 (모바일 바텀 시트 느낌 강조) -->
        <div class="w-full flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div
            class="w-12 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full"
          ></div>
        </div>

        <!-- 헤더 영역 -->
        <div
          class="px-5 pt-5 pb-6 border-b border-slate-50 dark:border-zinc-800/50 flex justify-between items-center shrink-0"
        >
          <div>
            <h3
              class="text-xl font-black tracking-tight text-slate-800 dark:text-zinc-100"
            >
              {title}
            </h3>
            {#if subTitle}
              <p
                class="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em] mt-1"
              >
                {subTitle}
              </p>
            {/if}
          </div>
          <button
            on:click={close}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            aria-label={$t.dateClose}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- 콘텐츠 영역 -->
        <div class="overflow-hidden flex flex-col min-h-0">
          <div class="px-5 overflow-y-auto">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

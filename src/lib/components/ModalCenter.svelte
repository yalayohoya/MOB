<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/locales/common';

  export let isOpen = false;
  export let title = '';
  export let subTitle = ''; // 선택적 서브 타이틀

  const dispatch = createEventDispatcher();

  function close() {
    isOpen = false;
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade={{ duration: 200 }}>
    <!-- 배경 클릭 시 닫기 -->
    <button 
      class="absolute inset-0 w-full h-full cursor-default" 
      on:click={close}
      aria-label={$t.dateClose}
    ></button>

    <div 
      class="relative w-full max-w-2xl rounded-lg overflow-hidden flex flex-col max-h-[95vh] md:max-h-[85vh] shadow-2xl"
      transition:fly={{ y: 30, duration: 300 }}
    >
      <!-- 헤더 (배경색 직접 적용) -->
      <div class="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900 text-white shrink-0">
        <div>
          <h3 class="text-sm font-black italic uppercase tracking-tighter">{title}</h3>
          {#if subTitle}
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{subTitle}</p>
          {/if}
        </div>
        <button 
          on:click={close} 
          class="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
          aria-label={$t.dateClose}
        >
          ✕
        </button>
      </div>

      <!-- 콘텐츠 (배경색 직접 적용 및 flex-1 추가) -->
      <div class="p-6 overflow-y-auto bg-white dark:bg-zinc-900 flex-1">
        <slot />
      </div>
    </div>
  </div>
{/if}

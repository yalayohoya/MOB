<script lang="ts">
  import { fade } from "svelte/transition";
  import { PUBLIC_APP_VERSION } from "$lib/constants";
  import { t } from "$lib/locales/splash";

  export let show: boolean = true;
  export let statusText: string = "";
</script>

{#if show}
  <div
    transition:fade={{ duration: 400 }}
    class="fixed inset-0 z-[999999] flex flex-col items-center justify-between bg-white p-8 text-slate-800 select-none font-sans"
  >
    <!-- Center Logo & Status -->
    <div
      class="flex flex-col items-center justify-center text-center space-y-10 my-auto"
    >
      <!-- POSCO ARGENTINA Official Brand Logo Image -->
      <div class="flex flex-col items-center justify-center space-y-2 mt-30">
        <img
          src="/img/splash-img.png"
          alt="POSCO ARGENTINA"
          class="h-20 w-auto object-contain drop-shadow-sm transition-transform duration-700 hover:scale-105"
        />
      </div>

      <!-- App Subtitle & Sub-branding -->
      <div class="space-y-1">
        <h2 class="text-xl font-bold tracking-tight text-slate-800">
          Smart QR Inspection System
        </h2>
        <p class="text-xs text-slate-500 font-medium">
          현장 설비 점검 모바일 시스템
        </p>
      </div>

      <!-- Loading Spinner & Status Text -->
      <div class="flex flex-col items-center space-y-4 pt-2 min-h-[80px] mt-30">
        <div class="relative w-9 h-9">
          <div
            class="absolute inset-0 rounded-full border-3 border-slate-200"
          ></div>
          <div
            class="absolute inset-0 rounded-full border-3 border-[#005B9C] border-t-transparent animate-spin"
          ></div>
        </div>
        <p class="text-xs text-slate-600 font-mono tracking-wide animate-pulse">
          {statusText || $t.splashDbInit}
        </p>
      </div>
    </div>

    <!-- Bottom Version Info -->
    <div
      class="w-full flex flex-col items-center text-center space-y-1 text-xs text-slate-400 font-mono"
    >
      <p class="font-semibold text-slate-500">
        Version {PUBLIC_APP_VERSION || "1.0"}
      </p>
      <p class="text-[10px] text-slate-400">
        © POSCO ARGENTINA All Rights Reserved.
      </p>
    </div>
  </div>
{/if}

<script lang="ts">
  import { fade } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import { PUBLIC_APP_VERSION } from "$lib/constants";
  import { t } from "$lib/locales/splash";

  export let show: boolean = false;
  export let progressValue: number = 0;
  export let fileName: string = "";
  export let isTestMode: boolean = false; // 테스트 모드 여부

  const dispatch = createEventDispatcher();
</script>

{#if show}
  <div
    transition:fade={{ duration: 300 }}
    class="fixed inset-0 z-[9999999] flex flex-col items-center justify-between bg-white p-8 text-slate-800 select-none font-sans"
  >
    <!-- 테스트 모드 전용 상단 닫기/돌아가기 헤더 버튼 -->
    {#if isTestMode}
      <div class="w-full flex justify-end">
        <button
          type="button"
          on:click={() => dispatch('close')}
          class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-xs transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>✕ 테스트 화면으로 돌아가기</span>
        </button>
      </div>
    {/if}
    <!-- Center Content Area -->
    <div
      class="flex flex-col items-center justify-center text-center space-y-8 my-auto w-full max-w-md"
    >
      <!-- POSCO ARGENTINA Logo -->
      <div class="flex flex-col items-center justify-center space-y-2">
        <img
          src="/img/splash-img.png"
          alt="POSCO ARGENTINA"
          class="h-16 w-auto object-contain drop-shadow-sm"
        />
      </div>

      <!-- Title -->
      <div class="space-y-2">
        <h2 class="text-xl font-extrabold tracking-tight text-slate-800">
          {$t.updateDownloadingTitle}
        </h2>
      </div>

      <!-- Full-Screen GUI Progress Bar -->
      <div class="w-full space-y-3 pt-2">
        <div
          class="flex items-center justify-between text-xs font-bold px-1 gap-2"
        >
          <!-- PROGRESS 문구 대신 파일명 표출 -->
          <span
            class="text-slate-600 font-mono tracking-tight truncate max-w-[65%]"
          >
            {fileName || "app-update.apk"}
          </span>
          {#if progressValue >= 0}
            <span class="text-[#005B9C] font-mono text-base font-extrabold"
              >{progressValue}%</span
            >
          {:else}
            <span
              class="text-[#005B9C] font-mono text-xs font-bold animate-pulse"
              >DOWNLOADING</span
            >
          {/if}
        </div>

        <!-- Progress Bar Track -->
        <div
          class="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner relative"
        >
          {#if progressValue >= 0}
            <div
              class="h-full bg-gradient-to-r from-[#005B9C] via-sky-400 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
              style="width: {Math.max(0, Math.min(100, progressValue))}%;"
            ></div>
          {:else}
            <!-- Content-Length가 없을 때: Indeterminate 무한 좌우 바 애니메이션 -->
            <div
              class="absolute inset-0 bg-gradient-to-r from-[#005B9C] via-sky-400 to-emerald-400 rounded-full w-1/3 animate-indeterminate shadow-sm"
            ></div>
          {/if}
        </div>

        <!-- 점 1, 2, 3개 순차 점멸 애니메이션 -->
        <p
          class="text-[11px] text-slate-500 font-medium tracking-tight text-center whitespace-pre-line leading-relaxed"
        >
          {$t.updateDownloadingMsg.replace(
            "{filename}",
            fileName || "app-update.apk",
          )}<span class="inline-flex font-bold text-[#005B9C] ml-0.5"
            ><span class="animate-bounce" style="animation-delay: 0ms;">.</span
            ><span class="animate-bounce" style="animation-delay: 150ms;"
              >.</span
            ><span class="animate-bounce" style="animation-delay: 300ms;"
              >.</span
            ></span
          >
        </p>
      </div>

      <style>
        @keyframes indeterminate {
          0% {
            left: -35%;
          }
          100% {
            left: 100%;
          }
        }
        .animate-indeterminate {
          animation: indeterminate 1.5s infinite linear;
        }
      </style>
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

<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from "svelte";
  import {
    BarcodeScanner,
    BarcodeFormat,
  } from "@capacitor-mlkit/barcode-scanning";
  import { isScanning as isScanningStore } from "$lib/stores/ui";
  import { Capacitor } from "@capacitor/core";
  import { t } from "$lib/locales/scanner";
  import { navigating } from "$app/stores";
  import { fade } from "svelte/transition";

  const dispatch = createEventDispatcher();

  let hasPermission = false;
  export let errorMessage = "";
  let videoElement: HTMLVideoElement;
  let videoStream: MediaStream | null = null;
  let isInitializing = true;
  let isCameraReady = false;

  async function checkPermission() {
    try {
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera === "granted") {
        hasPermission = true;
      } else {
        const request = await BarcodeScanner.requestPermissions();
        hasPermission = request.camera === "granted";
      }
    } catch (e) {
      console.error("[QR Overlay] Permission check failed:", e);
      errorMessage = $t.qrPermissionError;
    }
  }

  async function startScan() {
    try {
      isInitializing = true;
      if (Capacitor.getPlatform() === "web") {
        console.warn("[QR Overlay] Web simulation mode active.");
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (err) {
          console.error("[QR Overlay] Webcam access failed:", err);
          errorMessage = $t.qrAccessError;
          isInitializing = false;
          return;
        }

        document.documentElement.classList.add("scanner-active");
        document.body.classList.add("scanner-active");
        isScanningStore.set(true);
        isInitializing = false;

        await tick();
        if (videoElement && videoStream) {
          videoElement.srcObject = videoStream;
          videoElement.onplaying = () => {
            setTimeout(() => {
              isCameraReady = true;
            }, 200);
          };
        } else {
          isCameraReady = true;
        }

        // 브라우저 테스트용 시뮬레이션 전역 바인딩
        (window as any).simulateScan = (val: string) => {
          dispatch("scan", { value: val });
        };
        return;
      }

      await checkPermission();
      if (!hasPermission) {
        errorMessage = $t.qrDisabledError;
        isInitializing = false;
        return;
      }

      document.documentElement.classList.add("scanner-active");
      document.body.classList.add("scanner-active");
      isScanningStore.set(true);
      isInitializing = false;

      await BarcodeScanner.addListener("barcodesScanned", async (event) => {
        if (event.barcodes && event.barcodes.length > 0) {
          dispatch("scan", { value: event.barcodes[0].displayValue });
        }
      });

      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
      });
      setTimeout(() => {
        isCameraReady = true;
      }, 350);
    } catch (e) {
      console.error("[QR Overlay] Scan failed:", e);
      errorMessage = $t.qrStartError;
      isInitializing = false;
    }
  }

  let isTorchEnabled = false;

  async function toggleTorch() {
    try {
      if (Capacitor.getPlatform() !== "web") {
        await BarcodeScanner.toggleTorch();
        const status = await BarcodeScanner.isTorchEnabled();
        isTorchEnabled = status.enabled;
      } else {
        isTorchEnabled = !isTorchEnabled;
        console.log(
          "[QR Overlay Simulation] Torch toggled to:",
          isTorchEnabled,
        );
      }
    } catch (e) {
      console.error("[QR Overlay] Failed to toggle torch:", e);
    }
  }

  async function stopScan() {
    try {
      document.documentElement.classList.remove("scanner-active");
      document.body.classList.remove("scanner-active");
      isScanningStore.set(false);
      isCameraReady = false;
      isTorchEnabled = false;

      if (Capacitor.getPlatform() !== "web") {
        await BarcodeScanner.removeAllListeners();
        await BarcodeScanner.stopScan();
      } else {
        if (videoStream) {
          videoStream.getTracks().forEach((track) => track.stop());
          videoStream = null;
        }
        if (typeof window !== "undefined") {
          delete (window as any).simulateScan;
        }
      }
    } catch (e) {
      console.error("[QR Overlay] Error stopping scan:", e);
    }
  }

  let backHandlerId: any = null;

  onMount(() => {
    if (typeof window !== "undefined" && Capacitor.getPlatform() !== "web") {
      if (!(window as any).backButtonHandlers) {
        (window as any).backButtonHandlers = [];
      }
      const handler = () => {
        handleClose();
      };
      (window as any).backButtonHandlers.push(handler);
      backHandlerId = handler;
    }
    startScan();
  });

  onDestroy(() => {
    if (typeof window !== "undefined" && backHandlerId) {
      (window as any).backButtonHandlers = (
        window as any
      ).backButtonHandlers.filter((h: any) => h !== backHandlerId);
    }
    stopScan();
  });

  function handleClose() {
    stopScan();
    dispatch("close");
  }
</script>

<div
  transition:fade={{ duration: 150 }}
  class="qr-scanner-overlay-container fixed inset-0 z-99999 flex flex-col transition-colors duration-500 overflow-hidden {isCameraReady
    ? 'bg-transparent'
    : 'bg-black'}"
>
  <!-- 상단 카메라 및 스캔 가이드 영역 (남은 공간 모두 차지) -->
  <div class="flex-1 relative overflow-hidden bg-transparent">
    <!-- 웹 환경 시뮬레이션용 비디오 레이어 -->
    {#if Capacitor.getPlatform() === "web"}
      <video
        bind:this={videoElement}
        autoplay
        playsinline
        class="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 {isCameraReady
          ? 'opacity-100'
          : 'opacity-0'}"
      >
        <track kind="captions" />
      </video>

      <!-- 시뮬레이션 테스트 버튼 (개발용) -->
      <div class="absolute top-24 right-4 z-100000 flex flex-col gap-2">
        <button
          type="button"
          on:click={() => (window as any).simulateScan?.("UEML_120C02A_001")}
          class="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border-none cursor-pointer"
        >
          스캔 성공 테스트
        </button>
        <button
          type="button"
          on:click={() => (window as any).simulateScan?.("WRONG-ID-999")}
          class="bg-rose-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border-none cursor-pointer"
        >
          스캔 실패 테스트
        </button>
      </div>
    {/if}

    <!-- 플래시 토글 버튼 -->
    <button
      type="button"
      on:click={toggleTorch}
      class="absolute top-10 right-4 z-100000 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white border-none cursor-pointer hover:bg-black/80 transition-colors"
      title={$t.qrFlashToggle}
    >
      {#if isTorchEnabled}
        <!-- ON Icon (Filled/Yellow) -->
        <svg
          class="w-5 h-5 text-amber-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      {:else}
        <!-- OFF Icon (Outline/White) -->
        <svg
          class="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          />
        </svg>
      {/if}
    </button>

    <!-- 닫기 버튼 -->
    <button
      type="button"
      on:click={handleClose}
      class="absolute top-10 left-4 z-100000 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white border-none cursor-pointer hover:bg-black/80 transition-colors"
      title={$t.dateClose}
    >
      <svg
        class="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    {#if errorMessage}
      <!-- 한국어 주석: 에러 메시지 팝업창 (텍스트 줄바꿈 방지 break-keep 및 고급스러운 딥 버건디 레드 반투명 블러 톤 적용, 부드러운 깜빡임 모션 연계) -->
      <div
        class="absolute inset-x-4 top-36 z-100000 bg-rose-950/45 dark:bg-rose-950/55 backdrop-blur-md text-rose-100 p-4 rounded-xl text-center text-xs font-black shadow-xl break-keep animate-soft-pulse"
      >
        {errorMessage}
      </div>
    {/if}

    <!-- 투명 '구멍' 가이드 레이어 -->
    <div
      class="absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-500 {isCameraReady
        ? 'opacity-100'
        : 'opacity-0'}"
    >
      <!-- 중앙 사각형 가이드 (box-shadow로 주변을 어둡게 처리) -->
      <div
        class="relative w-64 h-64 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] border-none"
      >
        <!-- 4개의 모서리 브릿지 -->
        <div
          class="absolute top-[-2px] left-[-2px] w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-tl-2xl"
          style="filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 8px rgba(37, 99, 235, 0.4));"
        ></div>
        <div
          class="absolute top-[-2px] right-[-2px] w-8 h-8 border-t-2 border-r-2 border-blue-500 rounded-tr-2xl"
          style="filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 8px rgba(37, 99, 235, 0.4));"
        ></div>
        <div
          class="absolute bottom-[-2px] left-[-2px] w-8 h-8 border-b-2 border-l-2 border-blue-500 rounded-bl-2xl"
          style="filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 8px rgba(37, 99, 235, 0.4));"
        ></div>
        <div
          class="absolute bottom-[-2px] right-[-2px] w-8 h-8 border-b-2 border-r-2 border-blue-500 rounded-br-2xl"
          style="filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 8px rgba(37, 99, 235, 0.4));"
        ></div>

        <!-- 스캔 라인 애니메이션 -->
        <div class="absolute inset-2 overflow-hidden rounded-xl">
          <div
            class="w-full h-[2px] bg-linear-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_2px_rgba(59,130,246,0.8)] absolute top-0 animate-[scan_4s_infinite_ease-in-out]"
          ></div>
        </div>

        <!-- 상태 문구 (가이드 아래 고정) -->
        <div
          class="absolute top-[calc(100%+1.5rem)] left-0 right-0 text-center flex items-center justify-center"
        >
          <span
            class="px-4 py-1.5 text-xs font-bold tracking-widest text-white uppercase animate-pulse break-keep"
          >
            {$t.qrScanGuide}
          </span>
        </div>
      </div>
    </div>
  </div>
  <slot />
</div>

<style>
  /* 한국어 주석: 에러 팝업의 시선을 유도하되 가독성을 유지하도록 투명도와 스케일이 은은하게 왕복하는 부드러운 깜빡임 애니메이션 */
  @keyframes soft-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
  :global(.animate-soft-pulse) {
    animation: soft-pulse 2s infinite ease-in-out;
  }
</style>

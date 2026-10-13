<script lang="ts">
  import "../app.css";
  import { onMount, afterUpdate } from "svelte";
  import { fly } from "svelte/transition";

  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  import { pageTitle, isScanning as isScanningStore } from "$lib/stores/ui";
  import { auth } from "$lib/stores/auth";
  import { dbService } from "$lib/services/database";
  import { settings } from "$lib/stores/settings";
  import { Capacitor, registerPlugin } from "@capacitor/core";
  import { App } from "@capacitor/app";
  import { SplashScreen } from "@capacitor/splash-screen";
  import { StatusBar, Style } from "@capacitor/status-bar";
  import { APP_CONFIG, DEV_IDS } from "$lib/constants";
  import { isInitialized, theme } from "$lib/stores/ui";
  import { lang, t } from "$lib/stores/lang";
  import { isOnline } from "$lib/stores/network";
  import { syncStore } from "$lib/stores/sync";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import Header from "$lib/components/Header.svelte";
  import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
  import { checkStoragePermissionGranted, openStoragePermissionSettings } from "$lib/services/excel";
  import { startIdleTimer, stopIdleTimer, resetIdleTimer } from "$lib/stores/activity";
  import { checkForUpdate, isDownloadingApk, downloadProgress, downloadingFileName } from "$lib/services/update";
import AppSplashScreen from "$lib/components/AppSplashScreen.svelte";
  import DownloadProgressOverlay from "$lib/components/DownloadProgressOverlay.svelte";
  import { KeepAwake } from "@capacitor-community/keep-awake";
  import { updatePrivacyScreen } from "$lib/services/privacyScreenService";

  interface SystemBarThemePlugin {
    setSystemBarTheme(options: { isDark: boolean }): Promise<{ success: boolean }>;
  }

  const SystemBarTheme = registerPlugin<SystemBarThemePlugin>("SystemBarTheme");

  // syncStore 내부의 개별 Writable 스토어 비구조화 할당
  const {
    syncAlertOpen,
    syncAlertTitle,
    syncAlertMessage,
    syncAlertType,
    syncProgressValue,
    syncConfirmOpen,
    syncConfirmTitle,
    syncConfirmMessage,
    syncConfirmType,
    syncConfirmResult,
    syncConfirmShowDateRange,
    syncPlanFromDt,
    syncPlanToDt
  } = syncStore;



  // 환경 변수로부터 기본 테마 설정 (없으면 light)
  const defaultTheme: string = "light";

  $: {
    if (typeof window !== "undefined") {
      const isDark = $theme === "dark";
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", $theme);

      // 상태바 및 네비게이션 바 스타일 & 배경색 실시간 동기화
      if (Capacitor.isNativePlatform()) {
        try {
          // 네이티브 커스텀 플러그인(SystemBarTheme)을 통해 상단 상태바 + 하단 네비게이션바 동시 완벽 동기화
          SystemBarTheme.setSystemBarTheme({ isDark }).catch((err) => {
            console.warn("[SystemBarTheme] Failed to set system bar theme:", err);
          });
        } catch (e) {
          console.warn("SystemBarTheme style update failed", e);
        }
      }
    }
  }

  let isDev = false;
  $: isDev = $auth.isLoggedIn && !!$auth.user?.id && DEV_IDS.includes($auth.user.id);
  let showDevMenu = false;

  // 로그인 계정 상태(DEV 유무)에 따른 캡처 방지 (PrivacyScreen) 설정
  $: {
    if (typeof window !== "undefined") {
      updatePrivacyScreen($auth.user);
    }
  }

  $: {
    if (typeof window !== "undefined") {
      if ($auth.isLoggedIn) {
        startIdleTimer();
      } else {
        stopIdleTimer();
      }
    }
  }

  // 실시간 세션 만료 감시 및 자동 로그인 페이지 리다이렉트
  $: {
    if (typeof window !== "undefined" && $isInitialized && !$auth.isLoggedIn) {
      const cleanPath = $page.url.pathname === "/" ? "/" : $page.url.pathname.replace(/\/$/, "");
      if (cleanPath !== "/") {
        console.log(`[Session Guard] Session expired on path: ${cleanPath}. Redirecting to login.`);
        goto("/", { replaceState: true });
      }
    }
  }

  function toggleDevNetwork() {
    let current = true;
    isOnline.subscribe((v) => (current = v))();
    isOnline.setOverride(!current);
  }

  async function downloadDevDatabase() {
    try {
      // [초정밀 보증] 다운로드 직전에 메모리 DB 상태를 IndexedDB 디스크 저장소에 강제 영구 저장
      if (dbService) {
        console.log(
          "[Dev DB Download] Force saving SQLite memory state to IndexedDB web store...",
        );
        await dbService.saveToStoreWeb();
      }

      // [동기 지연 보증] 대용량 동기화 직후 SQLite 가상 디렉토리 쓰기 디스크 버퍼의 I/O 안정 정착을 위해 350ms의 마이크로 동기 지연을 줍니다.
      await new Promise((resolve) => setTimeout(resolve, 350));

      // [초강력 무결성 보증 - 1초 네이티브 다운로드]
      // jeep-sqlite 컴포넌트의 자체 네이티브 saveToLocalDisk API를 최우선 호출합니다.
      // 이 방식은 브라우저의 File System Access API를 이용해 WASM 메모리 상태의 순정 SQLite 바이너리를
      // 어떠한 훼손이나 인코딩 오염 없이 즉시 디스크 파일로 저장 다이얼로그 팝업을 띄워 줍니다.
      const jeepSqlite = document.querySelector("jeep-sqlite");
      if (jeepSqlite) {
        console.log(
          "[Dev DB Download] Found jeep-sqlite component. Initiating native saveToLocalDisk...",
        );
        try {
          await (jeepSqlite as any).saveToLocalDisk({
            database: "securescan_db",
          });
          console.log(
            "[Dev DB Download] Native saveToLocalDisk download completed successfully!",
          );
          return;
        } catch (nativeErr) {
          console.warn(
            "[Dev DB Download] Native saveToLocalDisk failed. Falling back to manual IndexedDB extraction...",
            nativeErr,
          );
        }
      }

      console.log(
        "[Dev DB Download] Native component not found or failed. Direct-targeting jeepSqliteStore for manual extraction...",
      );

      const openRequest = indexedDB.open("jeepSqliteStore");
      openRequest.onsuccess = function (e) {
        const db = (e.target as any).result;

        // jeepSqliteStore 내에서 객체 저장소 우선순위 탐색
        const storeNames = Array.from(db.objectStoreNames);
        const targetStore =
          storeNames.find(
            (s) => s === "jeepSqliteStore" || s === "keyvaluepairs",
          ) || storeNames[0];
        if (!targetStore) {
          alert(
            "저장된 SQLite 데이터베이스 스토어를 찾을 수 없습니다. 로그인이나 동기화를 먼저 진행해 주세요.",
          );
          return;
        }

        try {
          const transaction = db.transaction([targetStore], "readonly");
          const store = transaction.objectStore(targetStore);
          const keysRequest = store.getAllKeys();

          keysRequest.onsuccess = function () {
            const keys = keysRequest.result;
            // [정밀 동적 검출] securescan_db를 포함하는 실제 물리 키(예: securescan_dbSQLite.db)를 찾아냅니다.
            const targetKey = keys.find(
              (k: any) => typeof k === "string" && k.includes("securescan_db"),
            );

            if (!targetKey) {
              alert(
                "데이터베이스 파일 키(securescan_db)를 찾을 수 없습니다. 동기화를 먼저 작동시켜 주세요.",
              );
              return;
            }

            console.log(
              `[Dev DB Download] Found active SQLite key: ${targetKey}`,
            );
            const getRequest = store.get(targetKey);

            getRequest.onsuccess = function () {
              let val = getRequest.result;
              if (!val) {
                alert("데이터베이스 내용을 읽을 수 없습니다.");
                return;
              }

              console.log(
                "[Dev DB Download] Raw retrieved value type:",
                typeof val,
              );
              console.log(
                "[Dev DB Download] Raw retrieved value constructor:",
                val.constructor?.name,
              );

              let binaryData: Uint8Array | ArrayBuffer | Blob | null = null;

              // 1. 만약 객체이고 내부 특정 속성에 바이너리나 Base64가 들어있다면 추출
              if (val && typeof val === "object") {
                if (
                  val instanceof Uint8Array ||
                  val instanceof ArrayBuffer ||
                  val instanceof Blob
                ) {
                  binaryData = val;
                } else if (val.buffer && val.buffer instanceof ArrayBuffer) {
                  // TypedArray (Int8Array, Uint8Array 등)인 경우
                  // WASM 힙 전체가 아닌 실제 바이트 슬라이스 세그먼트만 정확히 추출
                  binaryData = new Uint8Array(
                    val.buffer,
                    val.byteOffset || 0,
                    val.byteLength || val.length,
                  );
                } else if (
                  val.value &&
                  (val.value instanceof Uint8Array ||
                    typeof val.value === "string" ||
                    val.value.buffer)
                ) {
                  val = val.value;
                } else if (
                  val.data &&
                  (val.data instanceof Uint8Array ||
                    typeof val.data === "string" ||
                    val.data.buffer)
                ) {
                  val = val.data;
                } else if (
                  val.database &&
                  (val.database instanceof Uint8Array || val.database.buffer)
                ) {
                  binaryData = val.database;
                }
              }

              // 2. Base64 또는 직렬화 문자열 형태인 경우 바이너리로 강력 역변환
              if (typeof val === "string") {
                console.log(
                  "[Dev DB Download] Detected string format, checking for Base64 or plain SQL...",
                );
                if (
                  val.startsWith("data:application/octet-stream;base64,") ||
                  val.startsWith("data:;base64,")
                ) {
                  const base64Data = val.split(",")[1];
                  const decoded = atob(base64Data);
                  binaryData = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
                } else {
                  try {
                    // 순수 Base64 문자열인지 시도
                    const decoded = atob(val);
                    if (
                      decoded.startsWith("SQLite format 3") ||
                      decoded.includes("sqlite_master")
                    ) {
                      binaryData = Uint8Array.from(decoded, (c) =>
                        c.charCodeAt(0),
                      );
                      console.log(
                        "[Dev DB Download] Successfully decoded raw Base64 string to SQLite binary!",
                      );
                    } else {
                      binaryData = new TextEncoder().encode(val);
                    }
                  } catch (e) {
                    binaryData = new TextEncoder().encode(val);
                  }
                }
              } else if (!binaryData) {
                binaryData = val;
              }

              // 3. TypedArray가 아닌 raw ArrayBuffer라면 고속 Uint8Array로 랩핑
              if (binaryData instanceof ArrayBuffer) {
                binaryData = new Uint8Array(binaryData);
              }

              // 4. 최종 정합성 검증: SQLite 헤더("SQLite format 3")가 바이너리 시작 지점에 잘 들어있는지 검증 및 로깅
              try {
                let headerBytes: Uint8Array | null = null;
                if (binaryData instanceof Uint8Array) {
                  headerBytes = binaryData.subarray(0, 15);
                } else if (binaryData instanceof Blob) {
                  console.log(
                    "[Dev DB Download] Target is Blob, skipping synchronous header check",
                  );
                }

                if (headerBytes) {
                  const headerText = new TextDecoder().decode(headerBytes);
                  console.log(
                    "[Dev DB Download] SQLite Header Verification:",
                    headerText,
                  );
                  if (!headerText.startsWith("SQLite format 3")) {
                    console.warn(
                      '[Dev DB Download] WARNING: File does NOT start with "SQLite format 3" header! Current header:',
                      headerText,
                    );
                  }
                }
              } catch (hErr) {
                console.error(
                  "[Dev DB Download] SQLite Header check failed:",
                  hErr,
                );
              }

              if (!binaryData) {
                alert("데이터베이스 파일 바이너리 복조에 실패했습니다.");
                return;
              }

              const blob = new Blob([binaryData as any], {
                type: "application/octet-stream",
              });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = "securescan_db.db";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              console.log(
                "SQLite DB 다운로드 성공! (100% jeepSqliteStore 내 실시간 키 검출 완료)",
              );
            };
          };
        } catch (txErr) {
          console.error(
            "[Dev DB Download] Failed to execute download transaction:",
            txErr,
          );
          alert("데이터베이스 백업 추출에 실패했습니다.");
        }
      };

      openRequest.onerror = function (err) {
        console.error("Failed to open jeepSqliteStore:", err);
        alert("jeepSqliteStore 데이터베이스를 열 수 없습니다.");
      };
    } catch (err) {
      console.error("DB 다운로드 실패:", err);
      alert("DB 다운로드에 실패했습니다. 콘솔 에러 로그를 확인해 주세요.");
    }
  }

  async function resetDevDatabase() {
    if (
      !confirm(
        "🚨 경고: 정말로 브라우저의 모든 SQLite 데이터베이스와 로컬 세션을 통째로 지우고 강제 초기화하시겠습니까?\n\n이 작업은 IndexedDB 가상 스토리지를 물리적으로 완전히 소거하여 모든 꼬인 스키마와 테스트 쓰레기 데이터를 원천 박멸합니다.",
      )
    ) {
      return;
    }

    try {
      console.log(
        "[Dev DB Purge] Activating complete database and storage purge...",
      );

      // 0. 활성 SQLite 커넥션 강제 종료 (IndexedDB 삭제 Blocked 차단 방지용 핵심 조치)
      if (dbService) {
        console.log(
          "[Dev DB Purge] Force-closing active SQLite database connections...",
        );
        await dbService.closeDatabase();
      }

      // 1. 모든 IndexedDB 데이터베이스 색출 및 완전 드롭
      if (typeof indexedDB !== "undefined") {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name) {
            console.log(
              `[Dev DB Purge] Deleting IndexedDB database: ${dbInfo.name}`,
            );
            indexedDB.deleteDatabase(dbInfo.name);
          }
        }
        // 물리 고정 명칭 삭제 이중 안전 보장
        indexedDB.deleteDatabase("LocalForage");
        indexedDB.deleteDatabase("jeepSqliteStore");
        indexedDB.deleteDatabase("securescan_db");
      }

      // 2. localStorage 세션 흔적 올세척
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }

      alert(
        "🎉 데이터베이스가 물리적으로 완벽히 소거되었습니다!\n\n확인을 누르시면 브라우저가 클린 새로고침되며 최신 5복합키 스키마로 완전히 깨끗하게 처음부터 다시 구축됩니다.",
      );

      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (err) {
      console.error("DB 초기화 리셋 실패:", err);
      alert("초기화 실패: " + err);
    }
  }

  let showWebSplash = true;
  let splashStatusText = "";

  $: isScanning = $isScanningStore;

  /**
   * 로그아웃 처리
   */


  let showStoragePermissionModal = false;
  let dbError = "";
  let dbErrorStack = "";

  async function handleGoToSettings() {
    showStoragePermissionModal = false;
    try {
      await openStoragePermissionSettings();
    } catch (err) {
      console.error("[Permission] Failed to open storage settings:", err);
    }
  }

  onMount(async () => {
    // 앱 진입 시 화면 자동 꺼짐 방지(Keep Awake) 활성화
    try {
      if (Capacitor.isNativePlatform()) {
        const { KeepAwake } = await import("@capacitor-community/keep-awake");
        await KeepAwake.keepAwake();
        console.log('[App init] Screen KeepAwake activated successfully.');
      }
    } catch (e) {
      console.warn('[App init] KeepAwake activation skipped/failed:', e);
    }

    // 1. 유효하지 않은 세션 자동 로그아웃 및 타이머 초기화
    startIdleTimer();

    // 테마 설정 복원
    if (typeof localStorage !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      theme.set(savedTheme === "dark" ? "dark" : "light");
    } else {
      theme.set(defaultTheme === "dark" ? "dark" : "light");
    }

    try {
      await dbService.init();

      // 연결 성공 시 이전 에러 기록 제거
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("last_db_error");
        localStorage.removeItem("last_db_error_stack");
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("db_init_reload_count", "0");
      }
      dbError = "";
      dbErrorStack = "";
      
      // SQLite 데이터베이스로부터 환경설정을 동적으로 로드 및 Hydration 진행
      const dbConfig = await dbService.getConfig();
      if (dbConfig) {
        settings.set(dbConfig);
        lang.set(dbConfig.defaultLang);
        console.log('[App init] Environment settings successfully loaded from SQLite:', dbConfig);
      }

      // Step B. 온라인 모드($isOnline)일 때만 서버 앱 버전 체크 진행 (백그라운드 비동기)
      if ($isOnline) {
        checkForUpdate(false).catch((err) => {
          console.warn('[App init] Automatic update check failed:', err);
        });
      }
    } catch (e: any) {
      console.error("[App init] Database initialization failed:", e);
      if (typeof localStorage !== "undefined") {
        dbError = localStorage.getItem("last_db_error") || e?.message || String(e);
        dbErrorStack = localStorage.getItem("last_db_error_stack") || e?.stack || "";
      } else {
        dbError = e?.message || String(e);
        dbErrorStack = e?.stack || "";
      }
    }

    try {
      // Step C. 인증 세션 확인
      await auth.init();
    } catch (e) {
      console.error("[App init] Authentication session restoration failed:", e);
    } finally {
      // Step D. 준비 완료 상태 업데이트 및 스플래시 무조건 종료
      isInitialized.set(true);
      showWebSplash = false;

      // 네이티브 스플래시 가리기 및 저장소 권한 체크
      if (Capacitor.isNativePlatform()) {
        await SplashScreen.hide();

        // [앱 시작 시 자동 저장소 권한 확인] 권한이 승인되지 않은 경우 모달 출력
        try {
          const isStorageGranted = await checkStoragePermissionGranted();
          if (!isStorageGranted) {
            showStoragePermissionModal = true;
          }
        } catch (pErr) {
          console.warn('[App init] Storage permission check failed:', pErr);
        }
      }
    }

    // 3. 안드로이드 하드웨어 뒤로가기 버튼 처리
    if (Capacitor.getPlatform() !== "web") {
      const { App } = await import("@capacitor/app");
      const { Toast } = await import("@capacitor/toast");

      let lastTimeBackPress = 0;
      const timePeriodToExit = 2000;

      App.addListener("backButton", async ({ canGoBack }) => {
        // 커스텀 뒤로가기 핸들러(스캐너, 모달 등)가 등록되어 있으면 해당 동작 최우선 수행
        if (typeof window !== "undefined" && (window as any).backButtonHandlers && (window as any).backButtonHandlers.length > 0) {
          const handler = (window as any).backButtonHandlers.pop();
          handler();
          return;
        }

        // 메인 페이지면 앱 종료 대기, 아니면 뒤로가기
        if ($page.url.pathname === "/") {
          const currentTime = new Date().getTime();

          if (currentTime - lastTimeBackPress < timePeriodToExit) {
            // 앱 종료 전 세션 쿠키 파기 및 DB 연결 안전 해제 (UI 깜빡임/로그인 화면 전환 방지)
            try {
              await auth.clearSessionSilent();
              await dbService.closeDatabase();
            } catch (cleanupErr) {
              console.error("[App Exit] Cleanup failed:", cleanupErr);
            }
            App.exitApp();
          } else {
            lastTimeBackPress = currentTime;
            Toast.show({
              text: "뒤로가기 버튼을 한 번 더 누르면 종료됩니다.",
              duration: "short",
            });
          }
        } else {
          window.history.back();
        }
      });
    }

    // 1. 앱이 켜져 있는 상태(백그라운드)에서 QR을 찍었을 때 반응
    App.addListener("appUrlOpen", (event) => {
      handleNavigation(event.url);
    });

    // 2. 앱이 아예 꺼져 있다가 QR로 처음 켜질 때 주소 확인
    checkInitialUrl();
  });

  async function checkInitialUrl() {
    const info = await App.getLaunchUrl();
    if (info && info.url) {
      handleNavigation(info.url);
    }
  }

  /**
   * 딥링크 URL을 파싱하여 해당 경로로 이동합니다.
   * 특수문자(# 등)가 포함된 경우에도 URL Fragment(앵커)로 오작동하지 않도록 안전하게 인코딩합니다.
   * @param {string} urlStr 딥링크 전체 URL 문자열
   */
  function handleNavigation(urlStr: string) {
    try {
      // 1. 스킴 부분을 제거 (APP_CONFIG.APP_SCHEME에 정의된 값을 기준으로 파싱합니다.)
      const pathWithScheme = urlStr.split(`${APP_CONFIG.APP_SCHEME}://`)[1];

      if (pathWithScheme) {
        let finalPath = pathWithScheme.startsWith("/")
          ? pathWithScheme
          : "/" + pathWithScheme;

        // maintenance 경로 등에 # 특수문자가 인코딩 없이 포함된 경우 %23으로 변환하여 라우터 오작동 방지
        if (finalPath.includes("#")) {
          const [pathPart, ...hashParts] = finalPath.split("#");
          const rest = hashParts.join("#");
          if (rest.includes("?")) {
            const [idSuffix, queryString] = rest.split("?");
            finalPath = `${pathPart}%23${idSuffix}?${queryString}`;
          } else {
            finalPath = `${pathPart}%23${rest}`;
          }
        }

        // 3. 페이지 이동
        goto(finalPath);
      }
    } catch (e) {
      console.error("내비게이션 처리 실패:", e);
    }
  }
</script>

<svelte:window 
  on:click={resetIdleTimer} 
  on:touchstart={resetIdleTimer} 
  on:keydown={resetIdleTimer} 
  on:scroll={resetIdleTimer} 
/>

<div
  class="h-screen overflow-hidden {isScanning
    ? 'bg-transparent'
    : 'bg-app-bg'} text-app-text transition-colors duration-500 font-sans flex flex-col"
>
  <!-- 웹 전용 초기화/버전 확인 로딩 스플래시 화면 (로그인 전 최초 웰컴 시에만 노출) -->
  <AppSplashScreen show={showWebSplash && !$auth.isLoggedIn} statusText={splashStatusText} />

  <!-- 웹/앱 공통 APK 다운로드 전용 전체 화면 커버 GUI 프로그래스바 -->
  <DownloadProgressOverlay show={$isDownloadingApk} progressValue={$downloadProgress} fileName={$downloadingFileName} />

  <!-- DB 에러 진단 패널 -->
  {#if dbError}
    <div class="fixed top-0 left-0 right-0 z-100000 p-4 bg-rose-950/95 backdrop-blur-md border-b border-rose-800 text-white shadow-2xl flex flex-col gap-3 font-sans">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">⚠️</span>
          <span class="font-bold text-sm tracking-wider uppercase">Database Initialization Error</span>
        </div>
        <button 
          on:click={resetDevDatabase}
          class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg transition-all active:scale-95 border-none cursor-pointer"
        >
          DB 강제 초기화 (Reset DB)
        </button>
      </div>
      <div class="text-xs font-mono bg-black/40 p-2.5 rounded-lg overflow-x-auto select-all max-h-32 border border-rose-900/50">
        <div class="text-rose-300 font-bold mb-1">{dbError}</div>
        {#if dbErrorStack}
          <pre class="text-[10px] text-zinc-400 leading-normal font-mono">{dbErrorStack}</pre>
        {/if}
      </div>
      <div class="text-[10px] text-rose-300/80 flex items-center justify-between">
        <span>무한 새로고침 방지를 위해 자동 루프가 중지되었습니다.</span>
        <span>에러가 지속되면 위 버튼으로 초기화하십시오.</span>
      </div>
    </div>
  {/if}

  {#if $isInitialized && $auth.isLoggedIn}
    <Header title={$pageTitle} />
  {/if}

  <main class="active-content flex-1 overflow-y-auto flex flex-col">
    <slot />
  </main>

  <!-- 전역 프리미엄 동기화 알림/성공/실패 모달 (기본 alert 대체) -->
  <ConfirmModal
    isOpen={$syncAlertOpen}
    title={$syncAlertTitle}
    message={$syncAlertMessage}
    type={$syncAlertType}
    progressValue={$syncProgressValue}
    on:confirm={() => syncAlertOpen.set(false)}
  />

  <!-- 전역 프리미엄 동기화 예/아니오 컨펌 모달 -->
  <ConfirmModal
    isOpen={$syncConfirmOpen}
    title={$syncConfirmTitle}
    message={$syncConfirmMessage}
    confirmText={$lang === 'es' ? 'Sí' : '예'}
    cancelText={$lang === 'es' ? 'No' : '아니오'}
    type={$syncConfirmType || 'confirm'}
    showDateRange={$syncConfirmShowDateRange}
    bind:fromDt={$syncPlanFromDt}
    bind:toDt={$syncPlanToDt}
    on:confirm={(e) => {
      syncConfirmResult.set({
        confirmed: true,
        fromDt: e.detail?.fromDt || $syncPlanFromDt,
        toDt: e.detail?.toDt || $syncPlanToDt
      });
      syncConfirmOpen.set(false);
    }}
    on:cancel={() => {
      syncConfirmResult.set({
        confirmed: false,
        fromDt: $syncPlanFromDt,
        toDt: $syncPlanToDt
      });
      syncConfirmOpen.set(false);
    }}
  />

  <!-- 파일 접근 권한 안내 모달 (설정화면 이동 동의 유도용) -->
  {#if showStoragePermissionModal}
    <ConfirmModal
      bind:isOpen={showStoragePermissionModal}
      title={$lang === 'es' ? 'Permiso de Almacenamiento' : '저장소 권한 설정'}
      message={$lang === 'es'
        ? 'Se requiere permiso de acceso a todos los archivos para realizar la sincronización de archivos Excel.\n¿Desea ir a la pantalla de configuración para otorgarlo?'
        : '엑셀 파일 동기화(업로드/다운로드) 기능을 이용하려면 파일 전체 접근 권한이 필요합니다.\n설정 화면으로 이동하여 권한을 허용하시겠습니까?'}
      confirmText={$lang === 'es' ? 'Ir a Configuración' : '설정으로 이동'}
      cancelText={$lang === 'es' ? 'Cancelar' : '취소'}
      type="confirm"
      on:confirm={handleGoToSettings}
      on:cancel={() => showStoragePermissionModal = false}
    />
  {/if}

  <!-- 개발자 전용 플로팅 컨트롤 (접고 펼 수 있는 서랍식 툴 가젯) -->
  {#if isDev}
    <div
      class="fixed bottom-4 right-4 z-99999 flex flex-col items-end gap-3 font-sans select-none"
    >
      <!-- 1. 서랍식 서브 메뉴 패널 카드 -->
      {#if showDevMenu}
        <div
          transition:fly={{ y: 16, duration: 250 }}
          class="w-68 bg-slate-950/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-slate-800/80 dark:border-zinc-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-4 flex flex-col gap-4 text-left"
        >
          <!-- 헤더 구역 -->
          <div
            class="flex items-center justify-between pb-2 border-b border-slate-800/50 dark:border-zinc-800/50"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-xs">🛠️</span>
              <span
                class="text-[10px] font-black tracking-widest text-slate-400 dark:text-zinc-400 uppercase"
                >SecureScan DevTools</span
              >
            </div>
            <span
              class="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight"
              >Web Mode</span
            >
          </div>

          <!-- 1) 네트워크 스위치 영역 (스마트 토글식으로 개정) -->
          <div
            class="flex flex-col gap-1.5 bg-slate-900/50 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-slate-800/30"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-black text-slate-300 dark:text-zinc-300"
                >인터넷 가상 연결망</span
              >

              <!-- 슬라이딩 토글 스위치 -->
              <button
                type="button"
                on:click={toggleDevNetwork}
                class="relative inline-flex h-5.5 w-10.5 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none {$isOnline
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'}"
                title="인터넷 연결 상태 토글"
              >
                <span
                  class="pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out {$isOnline
                    ? 'translate-x-5'
                    : 'translate-x-0'}"
                ></span>
              </button>
            </div>

            <div class="flex items-center gap-1 text-[10px]">
              {#if $isOnline}
                <span
                  class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"
                ></span>
                <span class="text-emerald-400 font-bold"
                  >온라인(Online) 상태 - API 수신 대기</span
                >
              {:else}
                <span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                <span class="text-rose-400 font-bold"
                  >오프라인(Offline) 상태 - 로컬 보장</span
                >
              {/if}
            </div>
          </div>

          <!-- 2) SQLite 데이터베이스 관리 구역 -->
          <div class="flex flex-col gap-2">
            <span
              class="text-[10px] font-black tracking-wider text-slate-500 dark:text-zinc-500 uppercase"
              >SQLite Database</span
            >

            <div class="flex flex-col gap-1.5">
              <!-- 실시간 가상 DB 웹 뷰어 (Explorer) -->
              <a
                href="/dev-db"
                on:click={() => (showDevMenu = false)}
                class="w-full px-3 py-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-black rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none border-none outline-none no-underline text-center box-border"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>가상 DB 웹 뷰어 (Explorer)</span>
              </a>

              <!-- DB 백업 다운로드 -->
              <button
                on:click={downloadDevDatabase}
                class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none border-none outline-none"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>가상 DB 백업 추출 (.db)</span>
              </button>

              <!-- DB 전체 강제 리셋 -->
              <button
                on:click={resetDevDatabase}
                class="w-full px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none border-none outline-none"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>DB 강제 초기화 (Purge)</span>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- 2. 플로팅 메인 개발자 아이콘 토글 버튼 (FAB) -->
      <button
        on:click={() => (showDevMenu = !showDevMenu)}
        class="w-11 h-11 bg-slate-900/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-700/50 dark:border-zinc-800 flex items-center justify-center cursor-pointer active:scale-90 hover:scale-105 transition-all text-slate-300 hover:text-white select-none relative focus:outline-none"
        title="개발자 도구 패널 토글"
      >
        <div
          class="transition-transform duration-500 ease-out {showDevMenu
            ? 'rotate-90 scale-90'
            : 'rotate-0 scale-100'}"
        >
          {#if showDevMenu}
            <!-- 닫기 아이콘 -->
            <svg
              class="w-5.5 h-5.5 text-rose-500"
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
          {:else}
            <!-- 개발자 터미널 아이콘 (부드러운 커서 깜빡임 효과 장착) -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5.5 h-5.5"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" class="dev-cursor-blink" />
            </svg>
          {/if}
        </div>
      </button>
    </div>
  {/if}
</div>

<style>
  /* 레이아웃 디자인/역할: 전체 앱의 배경색과 텍스트 스타일을 관리하며 상단 헤더를 고정함 */
  :global(body) {
    margin: 0;
    padding: 0;
  }

  @keyframes devBlink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  .dev-cursor-blink {
    animation: devBlink 1s step-end infinite;
  }
</style>

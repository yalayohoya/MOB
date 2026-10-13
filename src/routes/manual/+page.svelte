<script lang="ts">
  import { onMount } from "svelte";
  import { pageTitle } from "$lib/stores/ui";
  import { lang } from "$lib/stores/lang";
  import { t } from "$lib/locales/manual";
  import { fly } from "svelte/transition";

  let activeTab: "inspection" | "password" = "inspection";

  onMount(() => {
    pageTitle.set($t.manualTitle);
  });

  $: {
    pageTitle.set($t.manualTitle);
  }

  // 매뉴얼 타입 정의
  interface SubStep {
    subLabel: string;
    title: string;
    desc: string;
    imagePlaceholder: string;
    imagePath: string | string[];
  }

  interface Step {
    stepNumber: string;
    title: string;
    desc?: string;
    imagePlaceholder?: string;
    imagePath?: string | string[];
    subSteps?: SubStep[];
  }

  interface TabContent {
    title: string;
    description: string;
    steps: Step[];
  }

  interface ManualData {
    ko: {
      tabs: {
        inspection: string;
        password: string;
      };
      inspection: TabContent;
      password: TabContent;
    };
    es: {
      tabs: {
        inspection: string;
        password: string;
      };
      inspection: TabContent;
      password: TabContent;
    };
  }

  const tabsList: ("inspection" | "password")[] = ["inspection", "password"];

  // 매뉴얼 다국어 및 설명 데이터
  const manualData: ManualData = {
    ko: {
      tabs: {
        inspection: "점검 방법",
        password: "비밀번호 변경",
      },
      inspection: {
        title: "설비 점검 및 실적 등록 방법",
        description:
          "현장의 설비 QR 코드를 스캔하거나 수동 검색을 통해 설비를 매칭한 후 점검 결과를 안전하게 등록하는 단계별 가이드입니다.",
        steps: [
          {
            stepNumber: "1",
            title: "점검 시작",
            desc: "메인 화면에서 [점검 시작] 버튼을 터치한 후, 곧이어 나타나는 [QR코드 스캔] 버튼을 터치하여 카메라를 기동합니다.",
            imagePlaceholder: "Step 1: 메인화면 점검 시작 및 스캐너 진입 화면",
            imagePath: [
              "/img/manual/dashboard_kr.png",
              "/img/manual/inspection_list_kr.png",
            ],
          },
          {
            stepNumber: "2",
            title: "점검할 설비 선택",
            subSteps: [
              {
                subLabel: "2-1",
                title: "QR스캔을 통한 점검 실시",
                desc: "가이드 사각형 내에 설비 QR코드를 인식시켜 해당 설비 점검 화면으로 이동합니다.",
                imagePlaceholder:
                  "Step 2-1: 카메라 기동 및 QR코드 스캔 성공 화면",
                imagePath: "/img/manual/qr_scan_kr.png",
              },
              {
                subLabel: "2-2",
                title: "수동 설비 선택을 통한 점검 실시",
                desc: "만약 QR코드 스캔에 실패하거나 QR코드가 훼손된 경우에는 [설비 선택] 버튼을 통해 설비 목록에서 수동으로 검색 및 조회하여 해당 설비를 터치해서 점검화면으로 진입할 수 있습니다.",
                imagePlaceholder: "Step 2-2: 설비 선택 목록 및 검색 선택 화면",
                imagePath: "/img/manual/select_fac_kr.png",
              },
            ],
          },
          {
            stepNumber: "3",
            title: "결과 입력 및 저장하기 터치",
            desc: "화면에 표시되는 설비의 상태(정상/비가동/이상), 측정값(수치형 항목), 특이사항 등을 알맞게 입력한 후 최하단의 [저장] 버튼을 터치합니다. 입력하지 않은 미입력 항목이 존재할 경우, 미입력 상태로 저장을 강행할지 아니면 취소하고 계속 입력할지 선택할 수 있는 경고 알림창이 팝업됩니다.",
            imagePlaceholder:
              "Step 3: 점검항목 입력 화면 및 미입력 항목 저장 확인 팝업",
            imagePath: "/img/manual/inspect_kr.png",
          },
        ],
      },

      password: {
        title: "오프라인 계정 비밀번호 변경 방법",
        description:
          "보안 강화를 위해 오프라인 로그인 계정의 단말기 내부 로컬 암호를 신속하게 변경하는 절차입니다.",
        steps: [
          {
            stepNumber: "1",
            title: "변경 가능 계정 조건 확인",
            desc: "단말기 내에 수동으로 복사된 오프라인 사원 정보로 로그인된 상태에서만 동작합니다.(조건을 만족하는 경우 헤더의 드롭다운 메뉴에 비밀번호 변경 메뉴가 활성화 됩니다.",
            imagePlaceholder:
              "Step 1: 비밀번호 변경 조건 계정 로그인 여부 식별",
            imagePath: "/img/manual/menu_kr.png",
          },
          {
            stepNumber: "2",
            title: "기존 암호 인증 및 신규 설정",
            desc: "기존에 사용하던 암호(초기 암호는 ID와 동일합니다)와 새로 지정할 비밀번호 및 비밀번호 확인 입력란에 같은 암호를 입력한 뒤 [변경 완료]를 누르면 비밀번호 변경이 완료됩니다.",
            imagePlaceholder:
              "Step 2: 기존 암호 인증 및 신규 비밀번호 변경 폼 화면",
            imagePath: "/img/manual/password_kr.png",
          },
        ],
      },
    },
    es: {
      tabs: {
        inspection: "Inspección",
        password: "Contraseña",
      },
      inspection: {
        title: "Método de registro de resultados e inspección",
        description:
          "Guía paso a paso para escanear el código QR del equipo o buscar manualmente el activo y registrar el resultado de forma segura.",
        steps: [
          {
            stepNumber: "1",
            title: "Inicio de inspección",
            desc: "Toque el botón [Iniciar Inspección] en la pantalla principal y luego el botón [Escanear QR] para iniciar la cámara.",
            imagePlaceholder:
              "Step 1: Botón de inicio y visor del escáner en el móvil",
            imagePath: [
              "/img/manual/dashboard_es.png",
              "/img/manual/inspection_list_es.png",
            ],
          },
          {
            stepNumber: "2",
            title: "Selección del equipo a inspeccionar",
            subSteps: [
              {
                subLabel: "2-1",
                title: "Inspección mediante escaneo QR",
                desc: "Apunte al código QR del equipo para abrir la pantalla de inspección.",
                imagePlaceholder:
                  "Step 2-1: Visor del escáner y escaneo exitoso del código QR",
                imagePath: "/img/manual/inspect_es.png",
              },
              {
                subLabel: "2-2",
                title: "Inspección mediante selección manual de equipos",
                desc: "Si el escaneo QR falla o el código está dañado, use el botón [Selección de Equipos] para buscar el activo manualmente en la lista e ingresar.",
                imagePlaceholder:
                  "Step 2-2: Buscador manual de activos y selección de equipo",
                imagePath: "/img/manual/select_fac_es.png",
              },
            ],
          },
          {
            stepNumber: "3",
            title: "Ingreso de resultados y guardado",
            desc: "Ingrese el estado (Normal/Parado/Anormal), valores medidos y notas, y toque [Guardar] abajo. Si hay campos vacíos, se mostrará una ventana emergente de confirmación preguntando si desea guardar con omisiones o seguir editando.",
            imagePlaceholder:
              "Step 3: Formulario de ingreso de resultados y alerta de confirmación",
            imagePath: "/img/manual/inspect_es.png",
          },
        ],
      },

      password: {
        title: "Método de cambio de contraseña local",
        description:
          "Procedimiento para cambiar rápidamente la contraseña local del dispositivo utilizada en modo offline.",
        steps: [
          {
            stepNumber: "1",
            title: "Verificar condiciones de la cuenta",
            desc: "Solo funciona cuando se ha iniciado sesión con la información de un empleado offline copiada manualmente en el terminal. (Si se cumple esta condición, la opción de cambio de contraseña se activará en el menú desplegable del encabezado).",
            imagePlaceholder:
              "Step 1: Identificación del estado de inicio de sesión de la cuenta para cambio de contraseña",
            imagePath: "/img/manual/menu_es.png",
          },
          {
            stepNumber: "2",
            title: "Autenticación de contraseña actual y nueva configuración",
            desc: "Ingrese la contraseña actual (la contraseña inicial es la misma que el ID), la nueva contraseña que desea establecer y la misma contraseña en el campo de confirmación. Luego, presione [Guardar] para completar el cambio de contraseña.",
            imagePlaceholder:
              "Step 2: Formulario de verificación de contraseña actual y nueva configuración",
            imagePath: "/img/manual/password_es.png",
          },
        ],
      },
    },
  };

  $: currentContent = manualData[$lang][activeTab];
</script>

<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 w-full font-sans">
  <!-- 탭 버튼 그룹 (모바일 최적화: 가로 스크롤 가능 및 컴팩트 레이아웃) -->
  <div
    class="grid grid-cols-2 gap-1 bg-slate-100/80 dark:bg-zinc-805/80 backdrop-blur-md p-1 rounded-lg border border-slate-200/50 dark:border-zinc-700/30 max-w-xl mx-auto shrink-0 select-none shadow-sm"
  >
    {#each tabsList as tabKey}
      <button
        type="button"
        on:click={() => (activeTab = tabKey)}
        class="flex items-center justify-center py-2.5 px-1 rounded-md transition-all cursor-pointer text-center active:scale-95 duration-200 border-none outline-none focus:outline-none
          {activeTab === tabKey
          ? 'bg-blue-600 text-white font-black shadow-md'
          : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 font-bold'}"
      >
        <span
          class="text-[11px] sm:text-xs md:text-sm whitespace-nowrap tracking-tight"
        >
          {manualData[$lang].tabs[tabKey]}
        </span>
      </button>
    {/each}
  </div>

  <!-- 상세 매뉴얼 카드 뷰 -->
  {#key activeTab}
    <div in:fly={{ y: 8, duration: 250 }} class="space-y-8 max-w-3xl mx-auto">
      <!-- 소개 글 헤더 -->
      <div class="text-center space-y-2 py-4">
        <span
          class="inline-block px-3 py-1 text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full tracking-wider uppercase border border-blue-200/30 dark:border-blue-900/30 shadow-sm"
        >
          Manual Guide
        </span>
        <h3
          class="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-zinc-100 dark:to-white"
        >
          {currentContent.title}
        </h3>
        <p
          class="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed"
        >
          {currentContent.description}
        </p>
      </div>

      <!-- 세로형 고급 타임라인 레이아웃 -->
      <div
        class="relative pl-6 sm:pl-8 space-y-8 border-l-2 border-slate-200/60 dark:border-zinc-800/60 ml-2 sm:ml-4 pt-2"
      >
        {#each currentContent.steps as step, idx}
          <!-- 타임라인 아이템 -->
          <div class="relative space-y-4">
            <!-- 타임라인 불릿 아이콘 -->
            <div
              class="absolute -left-[31px] sm:-left-[39px] top-1 flex items-center justify-center w-5 h-5 sm:w-6 h-6 rounded-full bg-blue-600 text-white text-[9px] sm:text-[10px] font-black border-4 border-white dark:border-zinc-900 shadow-md"
            >
              {step.stepNumber}
            </div>

            <!-- 메인 스텝 카드 -->
            <div
              class="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-300 space-y-4"
            >
              <!-- 스텝 타이틀 -->
              <h4
                class="text-sm sm:text-base md:text-lg font-black text-slate-800 dark:text-zinc-100 tracking-tight"
              >
                {step.title}
              </h4>

              {#if step.subSteps}
                <!-- 서브스텝 리스트 -->
                <div class="space-y-6 pt-2">
                  {#each step.subSteps as subStep}
                    <div
                      class="flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-between pb-6 border-b border-slate-100/60 dark:border-zinc-800/30 last:border-b-0 last:pb-0 last:mb-0 bg-slate-50/20 dark:bg-zinc-950/5 p-4 rounded-lg border border-slate-200/20 dark:border-zinc-850/10"
                    >
                      <!-- Left column: Text details -->
                      <div class="flex-1 space-y-2 text-center sm:text-left">
                        <div
                          class="flex flex-col sm:flex-row items-center sm:items-start gap-1"
                        >
                          <span
                            class="text-[11px] sm:text-xs font-black text-blue-600 dark:text-blue-400 tracking-wider"
                          >
                            {subStep.subLabel}.
                          </span>
                          <h5
                            class="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-zinc-200"
                          >
                            {subStep.title}
                          </h5>
                        </div>
                        <p
                          class="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 leading-relaxed"
                        >
                          {subStep.desc}
                        </p>
                      </div>

                      <!-- Right column: Image Slot -->
                      <div
                        class="flex flex-row gap-2 flex-shrink-0 flex-wrap justify-center"
                      >
                        {#if subStep.imagePath}
                          {#if Array.isArray(subStep.imagePath)}
                            {#each subStep.imagePath as path}
                              {#if path !== ""}
                                <div
                                  class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                                >
                                  <img
                                    src={path}
                                    alt={subStep.title}
                                    class="w-full h-full object-cover border border-slate-200 dark:border-zinc-800 shadow-sm"
                                  />
                                </div>
                              {/if}
                            {/each}
                          {:else if subStep.imagePath !== ""}
                            <div
                              class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                            >
                              <img
                                src={subStep.imagePath}
                                alt={subStep.title}
                                class="w-full h-full object-cover border border-slate-200 dark:border-zinc-800 shadow-sm"
                              />
                            </div>
                          {:else}
                            <div
                              class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                            >
                              <div
                                class="w-full h-full border-2 border-dashed border-slate-200/80 dark:border-zinc-800/80 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 select-none hover:bg-slate-100/50 dark:hover:bg-zinc-900/10 transition-colors"
                              >
                                <svg
                                  class="w-5 h-5 sm:w-7 h-7 text-slate-300 dark:text-zinc-650"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="1.5"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span
                                  class="text-[7.5px] sm:text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none px-1"
                                >
                                  {subStep.imagePlaceholder}
                                </span>
                              </div>
                            </div>
                          {/if}
                        {:else}
                          <div
                            class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                          >
                            <div
                              class="w-full h-full border-2 border-dashed border-slate-200/80 dark:border-zinc-800/80 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 select-none hover:bg-slate-100/50 dark:hover:bg-zinc-900/10 transition-colors"
                            >
                              <svg
                                class="w-5 h-5 sm:w-7 h-7 text-slate-300 dark:text-zinc-650"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span
                                class="text-[7.5px] sm:text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none px-1"
                              >
                                {subStep.imagePlaceholder}
                              </span>
                            </div>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <!-- 일반 스텝 (콘텐츠 영역) -->
                <div
                  class="flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-between pt-2"
                >
                  <!-- Left column: Text description -->
                  <div class="flex-1 space-y-2 text-center sm:text-left">
                    <p
                      class="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 leading-relaxed"
                    >
                      {step.desc || ""}
                    </p>
                  </div>

                  <!-- Right column: Image Slot(s) -->
                  <div
                    class="flex flex-row gap-2 flex-shrink-0 flex-wrap justify-center"
                  >
                    {#if step.imagePath}
                      {#if Array.isArray(step.imagePath)}
                        {#each step.imagePath as path}
                          {#if path !== ""}
                            <div
                              class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                            >
                              <img
                                src={path}
                                alt={step.title}
                                class="w-full h-full object-cover border border-slate-200 dark:border-zinc-800 shadow-sm"
                              />
                            </div>
                          {/if}
                        {/each}
                      {:else if step.imagePath !== ""}
                        <div
                          class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                        >
                          <img
                            src={step.imagePath}
                            alt={step.title}
                            class="w-full h-full object-cover border border-slate-200 dark:border-zinc-800 shadow-sm"
                          />
                        </div>
                      {:else}
                        <div
                          class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                        >
                          <div
                            class="w-full h-full border-2 border-dashed border-slate-200/80 dark:border-zinc-800/80 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 select-none hover:bg-slate-100/50 dark:hover:bg-zinc-900/10 transition-colors"
                          >
                            <svg
                              class="w-5 h-5 sm:w-7 h-7 text-slate-300 dark:text-zinc-650"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="1.5"
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span
                              class="text-[7.5px] sm:text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none px-1"
                            >
                              {step.imagePlaceholder || ""}
                            </span>
                          </div>
                        </div>
                      {/if}
                    {:else}
                      <div
                        class="portrait-image-container flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-lg overflow-hidden flex items-stretch"
                      >
                        <div
                          class="w-full h-full border-2 border-dashed border-slate-200/80 dark:border-zinc-800/80 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 select-none hover:bg-slate-100/50 dark:hover:bg-zinc-900/10 transition-colors"
                        >
                          <svg
                            class="w-5 h-5 sm:w-7 h-7 text-slate-300 dark:text-zinc-650"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span
                            class="text-[7.5px] sm:text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none px-1"
                          >
                            {step.imagePlaceholder || ""}
                          </span>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/key}
</div>

<style>
  /* 모바일 세로형 스크린샷 9:16 비율 가이드 라인 적용 */
  .portrait-image-container {
    width: 90px;
    height: 160px;
  }
  @media (min-width: 400px) {
    .portrait-image-container {
      width: 110px;
      height: 196px;
    }
  }
  @media (min-width: 640px) {
    .portrait-image-container {
      width: 140px;
      height: 249px;
    }
  }
</style>

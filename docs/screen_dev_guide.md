# 화면 개발 및 유지보수 가이드 (SvelteKit 초보자용 실무 매뉴얼)

본 문서는 SvelteKit 2를 처음 접하는 개발자도 실수 없이 기존 화면을 수정하거나 신규 화면을 추가할 수 있도록 정리한 4단계 실무 가이드입니다.

---

## 0. 화면 개발 시 절대 어기면 안 되는 3대 필수 원칙

1. **다국어(i18n) 필수 (하드코딩 절대 금지)**:
   - 본 시스템은 포스코 아르헨티나 현장 전용 앱입니다.
   - 화면에 한글이나 스페인어 텍스트를 직접 하드코딩하지 말고, 반드시 `src/lib/locales/` 아래의 전용 사전 파일(예: `notice.ts`)에 등록 후 `{$t.yourKey}`로 출력합니다. (키 단위로 `ko`, `es`를 동시 정의하므로 누락 방지)
2. **라우트 세션 가드 (`src/routes/+layout.ts`)**:
   - 로그인한 사용자만 보는 일반 업무 화면이면 아무것도 손댈 필요가 없습니다. (기본 보안 차단)
   - 만약 **로그인 전에도 열려야 하는 공개 화면**이라면 `src/routes/+layout.ts`의 `WHITELIST` 배열에 해당 경로를 추가해야 합니다.
3. **상단 헤더 타이틀 연동 (`src/lib/stores/ui.ts`)**:
   - 화면 진입 시 상단 네비게이션 헤더에 현재 화면명이 올바르게 표시되도록 `onMount` 시 `pageTitle.set(...)`을 호출합니다.

---

## 1. SvelteKit 라우팅 기본 원리

스벨트킷은 별도의 라우터 설정 파일 없이, `src/routes/` 아래의 **폴더 구조가 곧 URL 주소**가 됩니다.

- `src/routes/notice/+page.svelte` ➔ `/notice` 주소로 접속
- `src/routes/maintenance/+page.svelte` ➔ `/maintenance` 주소로 접속
- `src/routes/maintenance/[id]/+page.svelte` ➔ `/maintenance/101` (동적 파라미터 `$page.params.id`)

> 💡 **파일명 규칙**: 화면 역할을 하는 파일명은 반드시 `+page.svelte`여야 합니다.

---

## 2. 실전 예제로 따라하는 신규 화면 생성 4단계 (예: /notice 추가)

### Step 1: 화면 전용 언어팩 생성 (`src/lib/locales/notice.ts`)
Ctrl+클릭으로 바로 열리는 전용 사전에 한국어와 스페인어를 나란히 등록합니다.
```typescript
// src/lib/locales/notice.ts
import { createLocaleStore } from './helper';
import type { Lang } from '$lib/stores/lang';

export const dict = {
  noticeTitle: { ko: '현장 공지사항', es: 'Avisos del Sitio' },
  noticeEmpty: { ko: '등록된 공지사항이 없습니다.', es: 'No hay avisos registrados.' },
} satisfies Record<string, Record<Lang, string>>;

export const t = createLocaleStore(dict);
```

### Step 2: 라우트 폴더 및 `+page.svelte` 생성 (`src/routes/notice/+page.svelte`)
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { pageTitle } from '$lib/stores/ui';
  import { t } from '$lib/locales/notice'; // t 스토어 하나만 임포트!

  onMount(() => {
    pageTitle.set($t.noticeTitle);
  });
</script>

<div class="max-w-7xl mx-auto p-4 space-y-4 w-full font-sans">
  <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-black text-slate-800 dark:text-zinc-100 mb-2">
      {$t.noticeTitle}
    </h2>
    <p class="text-sm text-slate-500 dark:text-zinc-400">
      {$t.noticeEmpty}
    </p>
  </div>
</div>
```

### Step 3: 비로그인 허용 여부 설정 (`src/routes/+layout.ts`)
로그인한 점검자만 보는 화면이면 건드릴 필요 없음. 비로그인 공개 화면일 때만:
```typescript
// src/routes/+layout.ts (공개 화면일 때만)
const WHITELIST = ['/', '/notice'];
```

### Step 4: 이동 버튼 연결
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<button on:click={() => goto('/notice')} class="px-4 py-2 bg-blue-600 text-white rounded-xl">
  공지사항 이동
</button>
```

---

## 3. 자주 쓰는 공통 UI 패턴

### A. 가벼운 하단 스낵바 알림 (Toast)
```typescript
import { showToast } from "$lib/services/toast";

await showToast("설정이 저장되었습니다.");
```

### B. 전역 확인/취소 모달 (ConfirmModal)
```svelte
<script lang="ts">
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  let isModalOpen = false;

  function onConfirmAction() {
    isModalOpen = false;
    // 실행 로직
  }
</script>

<ConfirmModal
  bind:isOpen={isModalOpen}
  title="확인"
  message="작업을 진행하시겠습니까?"
  confirmText="예"
  cancelText="아니오"
  type="confirm"
  on:confirm={onConfirmAction}
  on:cancel={() => (isModalOpen = false)}
/>
```

---

## 4. 작업 완료 후 필수 검증

작업을 마친 후 터미널에서 다음 명령어를 실행하여 에러가 없는지 확인합니다:
1. `npm run check` ➔ `svelte-check found 0 errors and 0 warnings` 확인.
2. `npm run dev` ➔ 브라우저에서 다크모드 및 다국어(한국어/스페인어) 정상 출력 확인.
3. **로컬 DB 적재 검증** ➔ 화면에서 SQLite 데이터를 저장/수정하는 로직이 있다면, `DEV` 또는 `ADMIN` 계정으로 로그인 후 우측 하단 개발자 플로팅 도구(🛠️) ➔ **실시간 가상 DB 웹 뷰어(`/dev-db`)**에서 실제 데이터 변경 결과를 눈으로 즉시 확인합니다.

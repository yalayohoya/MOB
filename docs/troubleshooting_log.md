# 시행착오 및 문제 해결 기록 (Troubleshooting Log)

> [!IMPORTANT]
> **현재 최우선 과제**: 브라우저 도구(Antigravity Preview) 정상화
> 개발 효율성을 극대화하기 위해 에이전트가 브라우저를 직접 보고 검증할 수 있는 환경을 구축하는 것이 1순위입니다.

## 0. [해결 완료] 브라우저 도구 환경 개선 ($HOME 변수 문제)

- **상황**: 에이전트 내부 브라우저 도구(Playwright)가 `$HOME` 미설정 오류로 구동 실패.
- **분석**: 사용자 환경 변수 설정 후 Playwright 브라우저를 수동으로 설치하여 해결함.
- **결과**: **성공**. 이제 에이전트가 브라우저 프리뷰를 통해 실시간으로 화면을 확인할 수 있음. (2026-02-06)

## 1. 프로젝트 경로 인식 오류 (src/app.html 미인식) ... (이하 동일)

- **문제**: `src/app.html` 파일이 존재함에도 `SvelteKit`이 파일을 찾지 못하는 오류가 발생함.
- **원인**: 프로젝트 상위 폴더 이름에 한글이 포함되어 있어, `Vite` 및 `SvelteKit`의 내부 경로 해석 엔진이 파일을 올바르게 찾지 못함.
- **해결**: 프로젝트 전체를 영문 경로(`d:\projects\securescan-ops`)로 이동하여 해결함.
- **교훈**: 가급적 개발 프로젝트의 경로는 한글이나 공백이 없는 영문+하이픈 조합을 사용해야 함.

## 2. Tailwind CSS v4 설정 및 다크 모드 오류

- **문제 1**: Tailwind CSS 설치 후 스타일이 전혀 적용되지 않음.
- **원인**: 테일윈드 v4가 설치되었으나 기존 v3 방식의 `tailwind.config.js`를 사용하려고 시도함. v4는 Vite 플러그인(`@tailwindcss/vite`) 기반으로 작동함.
- **해결**: `vite.config.js`에 플러그인을 등록하고 `app.css`에서 `@import "tailwindcss";`를 사용하도록 수정함.

- **문제 2**: 다크 모드 전환 버튼은 작동하나 실제 CSS 스타일이 바뀌지 않음.
- **원인**: 테일윈드 v4에서는 `html` 태그의 `dark` 클래스를 인식하기 위해 별도의 선택자 설정이 필요함. v3의 `darkMode: 'class'` 설정은 v4에서 지원되지 않음.
- **시행착오**: `--variant-dark: .dark &;`와 같은 테마 설정을 시도했으나 환경에 따라 불안정할 수 있음.
- **해결**: `app.css`에 `@custom-variant dark (&:where(.dark, .dark *));` 설정을 시도했으나 환경에 따라 작동하지 않을 수 있음. 가장 확실한 방법인 **CSS 변수 선언 방식**(--app-bg 등)과 Tailwind v4 테마 확장을 연동하여 해결함.

## [2026-02-06] 브라우저 환경 SQLite WASM 로드 오류 (404 Not Found)

### 문제 상황
- 브라우저에서 SQLite 초기화 중 `GET http://localhost:5173/assets/sql-wasm.wasm 404 (Not Found)` 에러 발생.
- `jeep-sqlite` 엔진이 작동하기 위해 필요한 WebAssembly 바이너리 파일을 찾지 못해 초기화가 멈춤.

### 원인 분석
- `@capacitor-community/sqlite`의 웹 백엔드인 `jeep-sqlite`는 내부적으로 `sql.js`를 사용하며, 실행 시 `.wasm` 파일이 특정 경로(`/assets/`)에 있어야 함.
- SvelteKit의 기본 정적 파일 경로에 해당 파일이 복사되어 있지 않았음.

### 해결 방법
1. 프로젝트 루트에 `static/assets` 디렉토리 생성.
2. `sql.js`를 `jeep-sqlite@2.8.0`과 호환되는 `v1.11.0`으로 다운그레이드 (`npm install sql.js@1.11.0`).
3. `node_modules/sql.js/dist/sql-wasm.wasm` 파일을 `static/assets/` 및 `static/` 경로로 강제 복사.
4. `vite.config.js`에서 `jeep-sqlite`를 `optimizeDeps.exclude`에 추가하여 Vite의 자동 가동 방해를 차단.

### 결과
- `LinkError: WebAssembly.instantiate(): Import #34 "a" "I"`와 같은 버전 불일치 오류가 사라지고, 브라우저 환경에서 SQLite 엔진이 정상적으로 로드됨.

## 3. SvelteKit 환경 변수 로드 문제

- **문제**: 다크 모드 초기화 시 환경 변수가 정상적으로 읽히지 않아 기본 테마 설정이 불안정함.
- **원인**: `$env/dynamic/public`은 클라이언트 사이드에서 비동기적으로 동작하여 초기화 시점에 값이 없을 수 있음.
- **해결**: 빌드 타임에 확정되는 `$env/static/public`을 사용하여 초기 테마 설정의 안정성을 확보함.

## 4. 로컬 개발 환경 제약 (Browser Tool) [해결됨]

- **상황**: 에이전트 내부의 브라우저 프리뷰 도구(Playwright)가 시스템 환경 문제(`$HOME` 변수 미설정)로 실행되지 않았으나, 사용자 협업을 통해 해결함.
- **조치**: 사용자 환경 변수 `HOME` 확인, `npx playwright install` 수동 실행, IDE 재시작을 통해 환경 동기화 완료.
- **성과**: 이제 에이전트와 사용자가 동일한 화면을 확인하며 효율적인 협업 가능.

## 5. [2026-02-07] 로그인 멈춤 현상 (SQLite 초기화 레이스 컨디션)

- **문제**: 로그인 페이지 진입 후 '로그인' 버튼 클릭 시 응답이 없거나 멈추는 현상 발생 (무한 로딩).
- **원인 1 (Race Condition)**: `dbService.init()`이 완료되기 전에 `auth.login()` 내에서 `dbService.query()`가 호출됨. `init()`의 중복 방지 로직(`isInitializing`)이 단순히 `return`만 하고 있어, 두 번째 호출자는 초기화가 덜 된 상태에서 `db` 객체에 접근(null/undefined)하여 쿼리가 실패하거나 결과를 받지 못함.
- **원인 2 (데이터 누락)**: DB 테이블 생성 로직에 `users` 테이블 시딩(초기 데이터 삽입)이 빠져 있어, 정상적으로 초기화되더라도 로그인할 계정이 존재하지 않음.
- **해결**: 
  1. `dbService.init()`에 `Promise` 패턴을 도입하여, 초기화 중일 때 요청이 오면 기존 진행 중인 초기화 Promise를 반환하여 대기하도록 수정.
  2. `createTables()` 함수에 `users` 테이블 초기 데이터(2024001 등) 삽입 로직 추가.
  3. 로그인 실패 시 명확한 에러 메시지가 출력되도록 예외 처리 강화.

## 6. [2026-02-07] 무한 리다이렉트 (Throttling Navigation) 발생

- **문제**: 로그인 페이지와 레이아웃 간의 권한 체크가 충돌하여 무한 리다이렉트 발생 (`Throttling navigation to prevent the browser from hanging` 경고).
- **원인**:
  1. `src/routes/+layout.svelte`에서 "로그인 안 함 + !/login"이면 `/login`으로 보냄.
  2. `src/routes/login/+page.svelte`에서도 `onMount` 시 "로그인 함"이면 `/`로 보냄.
  3. 로그인 안 된 상태에서 사용자가 `/login` 진입 -> 레이아웃 로직이 불필요하게 다시 `/login`으로 보내는 엣지 케이스가 있거나, 반대로 로그인 후 `/`로 갈 때 레이아웃이 잠시 로그인 풀린 상태로 인식해 다시 `/login`으로 보내는 핑퐁 현상 발생.
- **해결**:
  1. **라우팅 제어권 일원화**: `src/routes/login/+page.svelte`의 리다이렉트 로직(`onMount`)을 제거하고 `+layout.svelte`가 전담하도록 변경.
  2. **방어 코드 추가**: `+layout.svelte`에서 리다이렉트 시 `isLoginPage` 변수 등을 통해 자기 자신으로 이동하는 것을 확실히 막고, `replaceState: true`를 사용하여 히스토리 스택 오염 방지.
## 7. [2026-02-07] TypeScript 모듈 해석 오류 (ts(2307))

- **문제**: `$lib/services/database` 등 SvelteKit 경로 별칭을 인식하지 못하는 `ts(2307)` 오류 발생.
- **원인**: 프로젝트 루트에 `tsconfig.json`이 없고 `typescript` 패키지가 설치되어 있지 않아 에디터가 경로를 해석하지 못함.
- **해결**:
  1. `typescript`, `tslib`, `svelte-check` 패키지 설치.
  2. `.svelte-kit/tsconfig.json`을 확장하는 루트 `tsconfig.json` 생성.
  3. `npx svelte-kit sync`를 통해 타입 정의 재생성.
- **결과**: 경로 별칭이 정상적으로 인식되어 오류 해결.

## 8. [2026-02-07] TypeScript 테마 타입 비교 오류 (ts(2367))

- **문제**: `defaultTheme === 'dark'` 비교 시 `'light'`와 `'dark'` 타입이 겹치지 않는다는 오류 발생.
- **원인**: `let defaultTheme: 'light' | 'dark' = 'light';`로 선언된 변수가 초기값 이후 변경되지 않아 TypeScript가 이를 `'light'` 타입으로 좁게 추론(Narrowing)함. `let`으로 선언하더라도 초기화 시점에서 추론된 타입이 고정되어 다른 리터럴과의 비교를 차단함.
- **해결**: 비교 시 `(defaultTheme as string) === 'dark'`와 같이 타입 단언(Type Assertion)을 사용하여 TypeScript의 타입 체크를 우회함.
- **결과**: 오류가 사라지고 정상적으로 빌드 가능함.

## 9. [2026-02-07] 안드로이드 물리 뒤로가기 버튼 클릭 시 앱 종료 문제

- **문제**: 서브 페이지(스캐너, 기록 등)에서 안드로이드 물리 뒤로가기 버튼을 누르면 이전 페이지로 가는 대신 앱이 즉시 종료됨.
- **원인**: Capacitor 앱은 기본적으로 하드웨어 뒤로가기 이벤트를 가로채지 않으면 기본 동작(앱 종료)을 수행함. 웹 브라우저의 히스토리 뒤로가기와 연동되지 않음.
- **해결**: 
  1. `@capacitor/app` 플러그인 설치.
  2. `src/routes/+layout.svelte`에서 `App.addListener('backButton', ...)`를 등록.
  3. 현재 경로가 메인(`/`)이면 앱 종료(`App.exitApp()`), 그 외의 경로면 브라우저 히스토리 뒤로가기(`window.history.back()`)를 수행하도록 로직 작성.
- **결과**: 이제 서브 페이지에서 뒤로가기 시 정상적으로 이전 화면으로 돌아감.

## 10. [해결 완료] Android 앱 설치 시 `no such table: tb_mob_set010` 에러 (2026-08-04)

- **문제**: 앱을 신규 설치 후 실행하면 `selectSQL cursor no such table: tb_mob_set010 (code 1)` 에러가 발생.
- **원인**: `@capacitor-community/sqlite`의 Android WebView 네이티브 브리지에서 `execute()`에 여러 CREATE TABLE 문을 세미콜론으로 묶어 전달할 때, 일부 SQL 문만 실행되고 나머지가 무시되는 현상. 마이그레이션이 실질적으로 실패했으나 에러가 throw되지 않아 `init()`이 정상 완료된 것처럼 동작한 후, `getConfig()` 등에서 테이블을 조회하면 테이블 미존재 에러 발생.
- **해결**:
  1. `database.ts`에 `tableExists()` 헬퍼 메서드 추가 (`sqlite_master` 조회).
  2. `database.ts`에 `createTablesIndividually()` 메서드 추가 — 각 CREATE TABLE을 개별 `execute()` 호출로 분리.
  3. `init()` 내 마이그레이션 후 6개 핵심 테이블 존재 여부 검증. 누락 시 `createTablesIndividually()` + `recreateViews()` 자동 재실행.
  4. `getConfig()` 진입 시 `tb_mob_set010` 존재 확인. 없으면 개별 테이블 재생성 시도, 그래도 실패 시 `defaultSettings` 반환.
  5. `sync.ts`에서 직접 `tb_mob_set010`을 쿼리하는 2곳에 try-catch 추가.
- **교훈**: Android의 SQLite 플러그인에서는 다중 SQL 문을 하나의 `execute()`로 보내지 말고, 개별 `execute()` 호출로 분리하는 것이 안전함.

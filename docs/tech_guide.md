# SecureScan Ops 기술 가이드 (Verified Production)

본 문서는 실제 프로젝트 소스 코드(`package.json`, `svelte.config.js`, `vite.config.js`, `src/lib/stores/network.ts`, `src/lib/stores/sync.ts`, `src/lib/services/database.ts`, `src/lib/services/excel.ts`)와 100% 일치하도록 검증된 공식 기술 아키텍처 가이드입니다.

---

## 0. 실제 기술 스택 및 버전 (package.json 검증)

| 구분 | 기술 / 라이브러리 | 설치 버전 | 실제 역할 및 특징 |
|:---|:---|:---|:---|
| **UI Framework** | Svelte / SvelteKit | `svelte: ^5.19.10` / `kit: ^2.16.1` | Svelte 5 룬(Runes) 기반 고반응성 클라이언트 SPA UI |
| **Build Tool** | Vite | `vite: ^6.0.11` | HMR 초고속 개발 서버 및 버전 자동 주입 빌드 |
| **Styling** | Tailwind CSS | `tailwindcss: ^4.1.18` (@tailwindcss/vite) | Tailwind v4 Vite 플러그인 기반 유틸리티 스타일링 |
| **Hybrid Native** | Capacitor | `@capacitor/core: ^8.0.2`, `android: ^8.0.2` | 안드로이드 네이티브 브리지 및 APK 패키징 |
| **Local DB** | Capacitor SQLite & jeep-sqlite | `sqlite: ^8.0.0` / `jeep-sqlite: 2.8.0` | 모바일 네이티브 / 웹 개발서버 공용 오프라인 SQLite |
| **SQLite WASM** | sql.js | `sql.js: 1.11.0` (버전 고정 엄수) | jeep-sqlite 2.8.0과 호환되는 순정 WASM 바이너리 |
| **QR / 바코드** | ML Kit Barcode Scanning | `@capacitor-mlkit/barcode-scanning: ^8.0.0` | 안드로이드 하드웨어 가속 기반 1D/2D 바코드 초고속 인식 |
| **보안 / 화면** | PrivacyScreen & KeepAwake | `privacy-screen: ^8.0.0` / `keep-awake: ^8.0.1` | 화면 캡처 방지(일반 계정) 및 점검 중 화면 꺼짐 방지 |
| **엑셀 처리** | SheetJS (xlsx) | `xlsx: ^0.18.5` | 오프라인 환경 엑셀 마스터 파싱 및 점검 실적 엑셀 생성 |

---

## 1. SvelteKit 2 SPA 모드 및 세션 가드 (`src/routes/+layout.ts`)

모바일 APK 패키징을 위해 Node.js SSR을 비활성화하고 순수 클라이언트 정적 파일로 번들링합니다.

### 1-1. `svelte.config.js` (`adapter-static`)
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA 진입점
      precompress: false,
      strict: true
    })
  }
};

export default config;
```

### 1-2. 전역 SSR 비활성화 및 미인증 인터셉트 (`src/routes/+layout.ts`)
```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'always';

const WHITELIST = ['/'];

export const load: LayoutLoad = async ({ url }) => {
  if (typeof window !== 'undefined') {
    const cleanPath = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, "");
    const isLoggedIn = document.cookie.includes('currentUser=') || document.cookie.includes('securescan_user=');

    // 미인증 상태에서 보호된 경로 진입 시 로그인 페이지로 리다이렉트
    if (!isLoggedIn && !WHITELIST.includes(cleanPath)) {
      throw redirect(307, '/');
    }
  }
};
```

### 1-3. 시스템 비상 및 로컬 개발용 슈퍼계정 (`src/lib/stores/auth.ts`)

단말기 초기 오프라인 세팅, 현장 네트워크 장애 시 긴급 환경설정 수정 및 디버깅을 위해 로컬 인증 예외 슈퍼계정이 내장되어 있습니다.

> [!CAUTION]
> **보안 및 운영 주의사항:**
> 1. 본 계정은 **시스템 관리자 및 유지보수 개발자 전용** 비상 계정이며, 일반 현장 점검자에게 공유되어서는 안 됩니다.
> 2. **온라인 동기화 제한:** 해당 계정은 로컬 전용으로 온라인 MES 세션 토큰(`accToken`, `rfToken`)이 발급되지 않으므로, 데이터 송수신(Sync) 시도가 시스템적으로 안전하게 차단됩니다.
> 3. **비밀번호 변경 불가:** 하드코딩된 시스템 보존 계정이므로 비밀번호 변경 기능이 제한됩니다.

| 계정 ID (대소문자 무관) | 비밀번호 | 보유 권한 | 주요 용도 및 시스템 제약사항 |
|:---|:---|:---|:---|
| **`ADMIN`** | `admin1!` | 관리자 (`COM_ADM_MOB`)<br>점검자 (`COM_EAM_MOB`) | • 오프라인 기기 초기 세팅 및 시스템 설정 관리<br>• 온라인 MES 토큰 미보유 (**동기화 시도 시 차단 알림**)<br>• 비밀번호 변경 불가, **`dev-db` 접근 불가** |
| **`DEV`** | `sis123#@!` | 관리자 (`COM_ADM_MOB`)<br>점검자 (`COM_EAM_MOB`) | • 개발 및 기능 디버깅 전용 슈퍼계정<br>• 온라인 MES 토큰 미보유 (**동기화 시도 시 차단 알림**)<br>• 비밀번호 변경 불가, **`dev-db` 및 개발자 도구 단독 접근 가능** |

---

## 2. Vite 6 빌드 파이프라인 & SQLite WASM 복사 훅

PC 브라우저 개발 모드(Vite Dev Server)에서 SQLite 바이너리가 404 에러 없이 로드되도록 Node.js 크로스 플랫폼 스크립트로 자동 복제합니다.

### 2-1. `package.json` scripts 설정
```json
"scripts": {
  "copy:wasm": "node -e \"const fs = require('fs'); fs.mkdirSync('static/assets', { recursive: true }); fs.copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'static/assets/sql-wasm.wasm'); fs.copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'static/sql-wasm.wasm');\"",
  "postinstall": "npm run copy:wasm",
  "dev": "npm run copy:wasm && vite dev",
  "build": "npm run copy:wasm && vite build"
}
```

### 2-2. `vite.config.js` (버전 자동 주입 및 jeep-sqlite 사전최적화 차단)
```javascript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// package.json의 version 값을 $env/static/public으로 자동 주입
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
process.env.PUBLIC_APP_VERSION = pkg.version;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    exclude: ['jeep-sqlite'] // jeep-sqlite 번들 변형 차단
  }
});
```

---

## 3. 실제 핵심 6대 SQLite 물리 테이블 구조 (복합키 정의)

본 프로젝트에서 실제로 가동 중인 6종 물리 테이블의 복합 Primary Key(PK) 및 비즈니스 역할입니다.

| 물리 테이블명 | 논리명 | 실제 복합 Primary Key (PK) | 역할 및 비즈니스 규칙 |
|:---|:---|:---|:---|
| `tb_mob_set010` | 모바일 환경설정 마스터 | `fac_gbn` / 단일 레코드 (`id=1`) | Base URL, API 1~9 URI, 최종 동기화 일시, 자동실적전송(`auto_send_yn`) |
| `tb_mob_set020` | 사용자 계정 정보 | `fac_gbn, uplo_proc_gbn, mob_user_id` | 오프라인 로컬 인증(SHA-256 대조), 소속 공정, 사용자 권한(Role) JSON |
| `tb_mob_std110` | 공통 기준코드 마스터 | `fac_gbn, uplo_proc_gbn, master_cd, cd_val` | 점검구분, 점검방식, 계측단위 등 다국어(한/스페인어) 코드북 |
| `tb_mob_std120` | 설비 마스터 및 사양제원 | `fac_gbn, uplo_proc_gbn, asset_id` | 설비명, 설치위치, 설비등급, QR 바코드 태그ID, 세부 기술스펙 |
| `tb_mob_std130` | 점검 계획 및 체크리스트 | `chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item` (5-복합키) | 당일 점검 오더번호, 점검항목, 관리하한(LL)/상한(UL) 기준 임계치 |
| `tb_mob_rst130` | 점검 수행 실적 및 송신 | `chk_action_no, chk_ordinal, asset_id, chk_fmt, chk_item` (5-복합키) | 작업자가 입력한 실제 계측값, 양부 판정, 송신여부(`send_flag` 'N'/'Y') |

### 3-1. 실시간 가상 DB 웹 탐색기 및 SQL 러너 (`/dev-db`)

PC 웹 개발 모드(Vite Dev Server) 및 모바일 기기에서 로컬 SQLite의 데이터 적재 상태를 직접 눈으로 확인하고 검증할 수 있는 **내장형 가상 DB 탐색기(Explorer)** 화면이 제공됩니다.

#### 1) 진입 방법 및 보안 가드
- **진입 경로**: **`DEV` 계정**으로 로그인 시 화면 우측 하단에 **개발자 플로팅 툴 버튼(🛠️)**이 활성화됩니다. 서랍 메뉴에서 **[실시간 가상 DB 웹 뷰어]**를 클릭하거나 `/dev-db` 경로로 이동합니다. (`ADMIN` 계정은 플로팅 툴 미노출 및 접근 차단)
- **접근 통제 가드**: 일반 계정 및 `ADMIN` 계정 등 `DEV_IDS`(`['DEV']`)에 해당하지 않는 계정이 `/dev-db`로 접근을 시도할 경우, `src/routes/dev-db/+page.svelte`의 인라인 세션 가드가 발동하여 홈 화면(`/`)으로 즉시 강제 리다이렉트(`goto('/')`)됩니다.

#### 2) 핵심 제공 기능
1. **테이블 브라우저 (Table Viewer)**:
   - `sqlite_master` 조회를 통해 내부 테이블(`sqlite_*`, `jeep_*`)을 제외한 6대 물리 테이블의 레코드 수와 데이터를 실시간 표출합니다.
   - 복합 Primary Key(PK) 컬럼 시각화 및 메타데이터 툴팁 제공.
2. **실시간 검색 및 동적 정렬**:
   - 상단 검색창 입력 시 전체 컬럼 대상 실시간 클라이언트 사이드 필터링.
   - 테이블 컬럼 헤더 클릭 시 오름차순(ASC)/내림차순(DESC) 즉각 정렬.
3. **커스텀 SQL 실행기 (SQL Runner)**:
   - 브라우저 상에서 직접 임의의 SQL문(`SELECT`, `INSERT`, `UPDATE`, `DELETE`)을 입력하고 즉시 실행.
   - 쿼리 실행 결과 그리드 표출, 오류 메시지 및 영향받은 행(Row) 수 즉각 피드백.
4. **네트워크 가상 스위처 (플로팅 패널)**:
   - 플로팅 도구에서 온라인/오프라인 스위치를 1초 만에 토글하여 오프라인 폴백 동작 검증 지원.

---

## 4. Wi-Fi 사설망 판정 및 2트랙 온라인 동기화 파이프라인

### 4-1. Wi-Fi 사설망 전용 온라인 판정 로직 (`src/lib/stores/network.ts`)
포스코 아르헨티나 현장 사설망(Wi-Fi) 접속 시에만 온라인으로 판정하며, 일반 셀룰러(LTE/5G) 망은 오프라인으로 분기 처리합니다.
```typescript
// src/lib/stores/network.ts
Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
  // WIFI에 연결된 상태일 때만 온라인으로 판별 (Cellular 등은 오프라인 처리)
  // 사설망 환경(외부 인터넷 연결 없음) 지원을 위해 status.connected 조건 제외
  const isWifi = status.connectionType === 'wifi';
  store.set(isWifi);
});
```

### 4-2. 인터넷 가상 연결망 시뮬레이터 (개발자용 Network Override)

단말기의 실제 Wi-Fi를 물리적으로 끄거나 랜선을 뽑지 않고도, 앱의 온/오프라인 분기 로직(2-트랙 파이프라인)을 브라우저 및 기기에서 원클릭으로 테스트할 수 있도록 **인터넷 가상 연결망(Network Override)** 기능이 탑재되어 있습니다.

#### 1) 동작 메커니즘 (`src/lib/stores/network.ts`)
- `isOnline` 스토어 내부에 `devOverride: boolean | null` 상태를 유지합니다.
- 오버라이드 값이 주입되면 Capacitor 네이티브 하드웨어 리스너의 실제 네트워크 이벤트를 일시 무시하고, 개발자가 지정한 가상 상태(`true` 또는 `false`)를 앱 전체 `$isOnline` 구독 컴포넌트에 즉시 전파합니다.

#### 2) 개발자 UI 컨트롤 (`src/routes/+layout.svelte`)
- `DEV` 계정 로그인 시 우측 하단 플로팅 개발도구(🛠️) 서랍에 **[인터넷 가상 연결망] 슬라이딩 토글 스위치**가 제공됩니다.
  - 🟢 **온라인 상태 (초록색 / ON)**: `온라인(Online) 상태 - API 수신 대기` ➔ 온라인 로그인, MES API 데이터 수신/실적 송신 파이프라인 테스트.
  - 🔴 **오프라인 상태 (빨간색 / OFF)**: `오프라인(Offline) 상태 - 로컬 보장` ➔ 로컬 SQLite 비밀번호 대조, 오프라인 점검 실적 저장, 미송신(`send_flag='N'`) 플래그 적재 등 완전 오프라인 현장 동작 검증.

### 4-3. 온라인 MES API 동기화 파이프라인 (`src/lib/stores/sync.ts`)
1. **세션 토큰 선검증 (`ensureValidSession`)**: API 호출 전 Access Token 유효성을 확인하고, 만료 시 Refresh Token으로 자동 갱신합니다.
2. **점검 실적 송신 (`[실적 송신]` 버튼 또는 `autoSendYn` 트리거)**:
   - `SELECT * FROM tb_mob_rst130 WHERE send_flag = 'N'`로 미송신 건 추출.
   - 백엔드 실적 저장 API (`rst01Api`)로 JSON 페이로드 일괄 업로드.
   - 서버 200 OK 수신 즉시 해당 복합키 건들에 대해 `UPDATE tb_mob_rst130 SET send_flag = 'Y'` 처리.
3. **마스터 데이터 수신 (`[데이터 수신]` 버튼 트리거)**:
   - `userApi`, `std02Api`, `std03Api`, `std01Api` 순차 호출.
   - 로컬 4대 마스터 테이블(`tb_mob_set020, std120, std130, std110`)에 대량 벌크 UPSERT.
4. **1년 경과 실적 자동 정리**: 송신 완료된 건 중 1년이 지난 레코드는 로컬 SQLite 용량 관리를 위해 자동 삭제합니다.

---

## 5. 오프라인 엑셀 동기화 및 Scoped Storage 권한 관리 (`src/lib/services/excel.ts`)

사설망 Wi-Fi 연결조차 불가능한 완전 오프라인 현장에서도 점검 업무를 지속할 수 있도록 엑셀(XLSX) 기반의 마스터 로드 및 실적 추출을 지원합니다.

| 동작 구분 | 파싱 함수 및 타깃 테이블 | 설명 |
|:---|:---|:---|
| **사용자 계정 로드** | `parseInspectorInfo()` ➔ `tb_mob_set020` | 현장 단말기에 복사된 사용자 엑셀 파일을 읽어 로컬 인증 정보 갱신 |
| **설비 사양 로드** | `parseEquipmentSpec()` ➔ `tb_mob_std120` | 설비 제원 및 마스터 엑셀 파싱 후 로컬 SQLite UPSERT |
| **점검 계획 로드** | `parseInspectionPlan()` ➔ `tb_mob_std130` | 당일 점검 대상 오더 및 체크리스트 기준치 벌크 임포트 |
| **기준 코드 로드** | `parseInspectionStds()` ➔ `tb_mob_std110` | 공통 기준코드 및 점검 항목 코드북 파싱 |
| **점검 실적 내보내기** | `exportInspectionResultsToExcel()` | 로컬 `tb_mob_rst130` 실적을 엑셀로 변환하여 `Download/` 폴더로 추출 |

> ⚠️ **Android 11+ Scoped Storage 대응:**  
> 타 앱에 의해 기기 공용 저장소에 생성된 엑셀 파일을 읽고, 동기화 완료 후 중복 임포트 방지를 위해 자동 삭제하려면 자체 네이티브 플러그인인 `ManageStoragePlugin`을 통해 **모든 파일 관리 권한(`MANAGE_EXTERNAL_STORAGE`)**이 승인되어 있어야 합니다.

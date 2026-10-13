# P-ARG MOB (POAR Inspection)
> **포스코 아르헨티나 리튬 플랜트 오프라인 우선(Offline-First) 스마트 QR 설비점검 시스템**

인터넷 연결이 제한된 염호 현장 환경에서도 중단 없이 설비 QR을 스캔하고 점검 실적을 기록할 수 있는 하이브리드 모바일(Android) 애플리케이션입니다.

---

## 🚀 빠른 시작 (Quick Start)

### 1. 사전 요구사항
- **Node.js**: LTS (v24.x 권장)
- **Android Studio**: Android SDK 34+ (Android 14) 및 JDK 17 (`JAVA_HOME`)

### 2. 설치 및 로컬 웹 개발
```bash
# 종속성 설치 (SQLite WASM 바이너리 자동 복제 포함)
npm install

# PC 브라우저 개발 서버 실행 (http://localhost:5173/)
npm run dev
```

### 3. 정적 검사 및 안드로이드 APK 빌드
```bash
# 코드 및 타입 무결성 검사 (0 errors 0 warnings 유지)
npm run check

# 릴리스용 서명 APK 빌드 (android/apks/ 폴더로 자동 수집)
npm run apk:release

# 실기기(USB 디버깅) 즉시 설치 및 자동 실행
npm run app:run
```

---

## 🛠 주요 명령어 (Cheatsheet)

| 명령어 | 설명 |
|:---|:---|
| `npm run dev` | PC 브라우저 개발용 로컬 서버 실행 |
| `npm run check` | SvelteKit 및 TypeScript 무결성 진단 |
| `npm run build` | 프로덕션용 SPA 클라이언트 정적 파일 번들링 |
| `npm run app:build` | 웹 빌드 + 안드로이드 Capacitor 동기화 |
| `npm run apk:debug` | 디버그 서명 APK 생성 (`android/apks/`) |
| `npm run apk:release` | 릴리스 서명 APK 생성 (`android/apks/`) |
| `npm run apk:all` | 디버그 + 릴리스 APK 일괄 빌드 및 수집 |
| `npm run cap:open` | Android Studio로 네이티브 프로젝트 열기 |

---

## 📚 상세 기술 및 배포 공식 문서 안내

프로젝트의 데이터베이스 구조, 비즈니스 SQL, 빌드/배포 세부 설정, 코딩 규칙 및 화면 개발 매뉴얼은 **중앙 통합 문서 포털**에서 관리됩니다.

* **통합 문서 허브 열람**: 브라우저에서 `docs/문서_허브.html`을 여시면 모든 세부 문서를 확인하실 수 있습니다.
  - 🗄️ **[DB 명세서](docs/page/DB명세서.html)**: 6대 핵심 물리 테이블 사양 및 ERD
  - 📑 **[프로그램 SQL 정의서](docs/page/SQL_정의서.html)**: 9대 화면 30개 핵심 비즈니스 SQL 쿼리
  - 📱 **[앱 배포 및 설정 가이드](docs/page/앱_배포_가이드.html)**: 환경 구축, 서명, 인셋, 버전 관리 및 APK 배포
  - 📋 **[프로젝트 개발 규칙](docs/page/프로젝트_규칙.html)**: i18n, 오프라인 우선, 보안, 시맨틱 버저닝 표준
  - ⚙️ **[기술 가이드](docs/page/기술_가이드.html)**: Svelte 5 + Capacitor 아키텍처 및 2트랙 동기화 파이프라인
  - 🖥️ **[화면 개발 가이드](docs/page/화면_개발_가이드.html)**: 신규 화면 생성 4단계 및 표준 템플릿

---
© 2026 Maintenance Engineering Team, POSCO Argentina. All rights reserved.

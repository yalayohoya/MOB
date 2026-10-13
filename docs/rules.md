# 프로젝트 개발 규칙

> 💡 **알림:** 본 문서는 [docs/project_rules.md](project_rules.md) 및 통합 웹 문서 [docs/page/프로젝트_규칙.html](page/프로젝트_규칙.html)로 통합 관리되고 있습니다. 상세한 최신 공식 규칙은 해당 문서를 참조하십시오.

최신 공식 규칙 요약:
1. **코드 스타일 & TypeScript**: 스페이스 2칸, `.ts` 및 `<script lang="ts">` 필수, `npm run check` 0 errors 유지.
2. **다국어(i18n) 필수 지원**: 포스코 아르헨티나 현장 기준 한국어(ko) 및 스페인어(es)를 `src/lib/stores/lang.ts`에 동시 등록 후 `$t`로 바인딩 (단일 언어 하드코딩 금지).
3. **오프라인 우선(Offline-First)**: 네트워크 차단 상태에서도 점검 및 SQLite 실적 저장이 100% 정상 작동해야 하며 로컬 DB 임의 삭제 금지.
4. **보안 및 세션**: 비밀번호 SHA-256 해시, 화면 캡처 방지(`PrivacyScreen`), 8시간(1교대) 무활동 자동 로그아웃, 안전 메모리 해제.
5. **UI 알림 표준**: 브라우저 기본 alert/confirm 금지, `ConfirmModal.svelte` 및 `@capacitor/toast`, `@capacitor/dialog` 사용.
6. **버전 고정**: `jeep-sqlite (2.8.0)` 및 `sql.js (1.11.0)` 버전 고정 엄수.

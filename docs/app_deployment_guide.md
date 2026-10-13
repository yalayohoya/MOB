# SecureScan Ops 앱 배포 및 네이티브 설정 가이드 (Verified Production)

본 문서는 실제 프로젝트 안드로이드 소스(`android/`, `build.gradle`, `MainActivity.java`, 커스텀 플러그인 2종)를 100% 전수 검증하여 일치시킨 공식 설정 가이드입니다.

---

## 0. 본 프로젝트 네이티브 식별 정보

| 항목 | 실제 설정값 | 참조 소스 파일 및 설명 |
|:---|:---|:---|
| **App ID (Package Name)** | `com.posco.arg_mob01` | `capacitor.config.json`, `build.gradle`, `AndroidManifest.xml` |
| **App Name (런처 표시명)** | **P-ARG MOB** | `android/app/src/main/res/values/strings.xml` (스마트폰 홈화면 앱 아이콘 밑 표시명) |
| **Capacitor App Name** | **POAR Inspection** | `capacitor.config.json` |
| **Current Version** | `v1.2.7` | `package.json` ➔ `build.gradle`의 `getAppVersionFromPackageJson()` 자동 동적 파싱 |
| **Release Key Alias** | `posco_arg_mob01` | `android/local.properties`, `android/app/build.gradle` |
| **Release Key Password** | `yLN3PpY58DxGmOc5` | `android/local.properties` (실제 검증된 키스토어 암호) |
| **Splash Background** | `#0054a6` / `@android:color/white` | `capacitor.config.json` (POSCO Blue), `styles.xml` (White) |
| **Deep Link Scheme** | `com.posco.arg_mob01://` | `AndroidManifest.xml`, `strings.xml`, `src/lib/constants.ts` |

---

## 1. 신규 PC 개발 환경 구축 및 초기 세팅 (온보딩 퀵스타트)

새로운 PC에서 프로젝트를 처음 클론받아 개발 및 빌드를 진행하기 위해 필요한 필수 소프트웨어와 초기 환경 구축 절차입니다.

### 1-1. 사전 필수 소프트웨어 설치
1. **Node.js (LTS 버전, v24.x 권장)**
   - **역할**: JavaScript 구동 및 패키지 관리 (`npm`)
   - **다운로드**: [Node.js 공식 홈페이지](https://nodejs.org/)에서 LTS 버전을 설치합니다.
   - **확인**: 터미널에서 `node -v` 및 `npm -v` 입력 후 정상 버전 출력 확인.
2. **Android Studio**
   - **역할**: 안드로이드 SDK 및 가상 에뮬레이터 제공, 네이티브 빌드 도구
   - **다운로드**: [Android Studio 공식 홈페이지](https://developer.android.com/studio)
   - **설치 후 필수**: 최초 실행 후 기본 가이드에 따라 **Android SDK(API 34/Android 14 이상)**를 설치합니다.
3. **JDK (Java Development Kit) 17 환경 변수 설정**
   - **역할**: 안드로이드 Gradle 빌드 시스템 구동에 필수
   - **설정 방법**:
     - Android Studio 설치 시 기본 포함된 JBR 폴더(`C:\Program Files\Android\Android Studio\jbr`)를 사용하는 것을 권장합니다.
     - 윈도우 시스템 환경 변수에 `JAVA_HOME` 등록 (예: `C:\Program Files\Android\Android Studio\jbr`)
     - 시스템 `Path` 환경 변수에 `%JAVA_HOME%\bin` 추가
4. **코드 에디터 (Visual Studio Code 권장)**
   - 권장 확장 프로그램: `Svelte for VS Code`, `Tailwind CSS IntelliSense`, `ESLint`

### 1-2. 프로젝트 초기 세팅
VS Code 터미널에서 다음 명령어를 실행하여 종속성을 설치합니다.
```bash
npm install
```
> 💡 **자동 복제 파이프라인**: `npm install` 완료 시 `package.json`의 `postinstall` 스크립트가 실행되어 브라우저/안드로이드용 SQLite WASM 바이너리(`sql-wasm.wasm`)가 `static/` 및 `static/assets/`로 자동 복제됩니다.

### 1-3. 로컬 웹 개발 서버 실행 (1차 화면/로직 개발)
```bash
npm run dev
```
- 브라우저에서 `http://localhost:5173/`으로 접속하여 실시간 코드 수정(HMR) 및 동작을 확인합니다.

---

## 2. 네이티브 빌드 로컬 환경 설정 (local.properties)

새 컴퓨터에서 저장소를 클론했거나 Android SDK 인식 에러가 발생할 때, `android/local.properties` 파일에 SDK 경로와 **실제 릴리스 서명 정보**를 구성해야 합니다.

### `android/local.properties` 파일 생성
```properties
sdk.dir=C\:\\Users\\<본인PC사용자명>\\AppData\\Local\\Android\\Sdk

# 릴리스 키스토어 서명 정보 (실제 암호 적용)
RELEASE_STORE_PASSWORD=yLN3PpY58DxGmOc5
RELEASE_KEY_ALIAS=posco_arg_mob01
RELEASE_KEY_PASSWORD=yLN3PpY58DxGmOc5
```
> ⚠️ **주의:** Windows 환경에서는 역슬래시 2개(`\\`)를 필수로 이스케이프 처리해야 합니다.

---

## 3. 앱 에셋 생성 (아이콘 & 로고)

루트의 `assets/` 폴더에 기본 이미지를 준비하고 Capacitor 에셋 생성 명령어를 실행합니다.
* **`assets/icon.png`**: 앱 아이콘 원본 (1024x1024 PNG)
* **`assets/splash.png`**: 스플래시 중앙 로고 원본 (2732x2732 PNG)

```bash
npx @capacitor/assets generate --android
```

---

## 4. 스플래시 화면 (Android 12+ 전용 설정)

안드로이드 12부터는 시스템 수준의 스플래시 API를 따라야 하며, 전체 화면 이미지가 아닌 중앙 아이콘 방식으로 렌더링해야 왜곡이 발생하지 않습니다.

### A. styles.xml 설정 (`android/app/src/main/res/values/styles.xml`)
```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@android:color/white</item> <!-- 배경색 (화이트 추천) -->
    <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item> <!-- 중앙 로고 (앱 아이콘 추천) -->
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
</style>
```

### B. MainActivity.java 코드 추가 (필수)
`super.onCreate(savedInstanceState)`를 호출하기 전에 스플래시 엔진을 초기화해야 합니다.
```java
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ManageStoragePlugin.class);
        registerPlugin(SystemBarThemePlugin.class);
        SplashScreen.installSplashScreen(this); // 반드시 super.onCreate 이전에 호출
        super.onCreate(savedInstanceState);
    }
}
```

---

## 5. 시스템 바 네이티브 인셋 및 실시간 테마 동기화 (실제 구현 방식)

> 💡 **가상 코드(웹 Spacer div) 미사용:**  
> 본 프로젝트는 웹 레이아웃에 임의의 safe-area spacer div를 삽입하지 않습니다. 대신 **안드로이드 네이티브 Window Insets 리스너**와 **자체 개발한 SystemBarTheme 커스텀 플러그인**을 조합하여 상단 상태바 및 하단 네비게이션바를 완벽하게 제어합니다.

### A. 네이티브 상/하단 인셋 자동 바인딩 (`MainActivity.java`)
상단 상태바(`statusBars`)와 하단 네비게이션바(`navigationBars`)의 물리적 높이를 시스템으로부터 실시간으로 읽어와 루트 뷰의 Padding으로 자동 적용합니다.
```java
// 1. 투명 상태바/네비바 플래그 해제 및 시스템 바 배경 그리기 활성화
Window window = getWindow();
window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

// 2. 상단 상태바 및 하단 네비게이션바 인셋을 네이티브 루트 뷰 패딩으로 동시 자동 바인딩
ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (v, insets) -> {
    Insets statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars());
    Insets navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
    v.setPadding(0, statusBarInsets.top, 0, navBarInsets.bottom);
    return insets;
});
```

### B. capacitor.config.json 상태바 비오버레이 설정
```json
"StatusBar": {
  "overlaysWebView": false,
  "style": "DARK"
}
```

### C. SystemBarTheme 커스텀 플러그인을 통한 테마 실시간 동기화
`src/routes/+layout.svelte`에서 테마 스토어 변경 시 호출되며, 상단 상태바뿐만 아니라 **하단 소프트키 네비게이션바의 색상과 아이콘 밝기까지 동시에 동기화**합니다.
```typescript
// src/routes/+layout.svelte 내 호출부
const SystemBarTheme = registerPlugin<SystemBarThemePlugin>("SystemBarTheme");

if (Capacitor.isNativePlatform()) {
  SystemBarTheme.setSystemBarTheme({ isDark }).catch(err => {
    console.warn("[SystemBarTheme] Failed to set system bar theme:", err);
  });
}
```

---

## 6. Scoped Storage 대응 및 ManageStorage 커스텀 플러그인

Android 11+ (API 30+) 환경에서는 엑셀 동기화 파일의 생성/로드뿐만 아니라, 타 앱이나 시스템에 의해 생성된 엑셀 임시 파일을 삭제하기 위해 **'모든 파일 관리 권한(All Files Access)'**이 필요합니다.

### A. AndroidManifest.xml 권한 선언
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
```

### B. ManageStoragePlugin.java 네이티브 구현 및 동작 원리
권한이 없는 경우 사용자를 안드로이드 시스템의 **'모든 파일 관리 허용' 설정 화면**으로 직접 안내합니다.
```java
@CapacitorPlugin(name = "ManageStorage")
public class ManageStoragePlugin extends Plugin {
    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean isApi30OrAbove = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        JSObject ret = new JSObject();
        ret.put("isAndroid11OrAbove", isApi30OrAbove);
        ret.put("granted", isApi30OrAbove ? Environment.isExternalStorageManager() : false);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
        Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
        intent.setData(uri);
        getActivity().startActivity(intent);
        ...
    }
}
```

---

## 7. 세로 고정, 딥링크 스키마 & 인앱 APK 업데이트 인프라

### A. AndroidManifest.xml 설정
```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="portrait"
    android:windowSoftInputMode="adjustResize"
    android:launchMode="singleTask">

    <!-- 실제 딥링크 스키마 (QR 스캔 시 앱 자동 실행) -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.posco.arg_mob01" />
    </intent-filter>
</activity>

<!-- 인앱 APK 다운로드 및 무인 설치 권한 -->
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />

<!-- 인앱 업데이트 APK 설치용 FileProvider -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
</provider>

<!-- ML Kit 하드웨어 가속 바코드 모델 자동 다운로드 -->
<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode" />
```

### B. capacitor.config.json 키보드 설정
```json
"Keyboard": {
  "resize": "body",
  "resizeOnFullScreen": false
}
```

---

## 8. 릴리스 키스토어 서명 설정 (build.gradle)

모든 빌드 컴퓨터에서 동일한 서명키(`android/app/release.keystore`)로 APK를 생성하여, 기존 설치된 앱 위에 업데이트 덮어쓰기 설치가 가능하도록 합니다.

* **키스토어 경로:** `android/app/release.keystore` (Git 형상관리 포함)
* **Key Alias:** `posco_arg_mob01`
* **Key/Store Password:** `yLN3PpY58DxGmOc5`

### `android/app/build.gradle` 서명 적용 범위
```groovy
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword localProps['RELEASE_STORE_PASSWORD'] ?: ''
        keyAlias localProps['RELEASE_KEY_ALIAS'] ?: 'posco_arg_mob01'
        keyPassword localProps['RELEASE_KEY_PASSWORD'] ?: ''
    }
}
buildTypes {
    debug {
        // 디버그 빌드도 릴리스 키로 동일 서명 (다른 PC에서 빌드한 APK도 기기에서 업데이트 설치 보장)
        signingConfig signingConfigs.release
    }
    release {
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        signingConfig signingConfigs.release
    }
}
```

---

## 9. 정기 APK 빌드 워크플로우

`package.json`에 구성된 자동화 스크립트로 WASM 복사, 웹 빌드, Capacitor 동기화 및 Gradle 빌드를 원클릭 수행합니다.

| 스크립트 명령어 | 실제 수행 파이프라인 동작 | 최종 생성 산출물 위치 |
|:---|:---|:---|
| `npm run apk:debug` | WASM 복사 ➔ Debug 모드 웹빌드 ➔ Cap Sync ➔ Gradle assembleDebug | `android/apks/app-debug.apk` (고정명)<br>`android/apks/app-debug_v1.2.7.apk` (버전명) |
| `npm run apk:release` | WASM 복사 ➔ Release 모드 웹빌드 ➔ Cap Sync ➔ Gradle assembleRelease | `android/apks/app-release_v1.2.7.apk` (원본 미포함본 자동삭제) |
| `npm run apk:all` | WASM 복사 ➔ Release 웹빌드 ➔ Cap Sync ➔ Debug + Release 동시 빌드 | Debug 2종 + Release 1종 전체 자동 수집 |
| `npm run app:run` | 웹빌드 ➔ Cap Sync 후 연결된 실기기 또는 에뮬레이터에서 즉시 설치/실행 | 단말기 직접 자동 배포 |

### 산출물 자동 관리 규칙 (`build.gradle`)
1. 빌드 시작 시 `android/apks/` 폴더를 자동으로 초기화(기존 잔여 파일 삭제)합니다.
2. Debug 빌드는 버전이 없는 `app-debug.apk`와 버전이 붙은 `app-debug_v1.2.7.apk` 2개 파일을 모두 보관합니다.
3. Release 빌드는 식별성을 위해 버전이 붙은 `app-release_v1.2.7.apk`만 유지하고 버전 없는 원본은 자동 삭제합니다.

---

## 10. 버전 관리 및 시맨틱 버저닝(SemVer 2.0.0) 배포 규칙

본 프로젝트는 버전의 정합성을 보장하기 위해 최상단 `package.json` 하나만을 **단일 진실 공급원(Single Source of Truth)**으로 사용합니다.

### A. 버전 입력 위치 및 전파 파이프라인
* **버전 입력 위치**: 최상단 `package.json`의 `"version"` 필드 (예: `"1.2.7"`)
* **웹/Svelte 영역**: `src/lib/constants.ts`에서 `package.json`을 직접 import하여 `PUBLIC_APP_VERSION = pkg.version`으로 앱 전체(스플래시 화면, 다운로드 프로그레스 모달, 환경설정 화면 등)에 자동 반영.
* **안드로이드 네이티브 영역**: `android/app/build.gradle`의 `getAppVersionFromPackageJson()` 함수가 `package.json`을 직접 파싱하여:
  - `versionName`: `"1.2.7"`
  - `versionCode`: `10207`
  - 산출물 APK 파일명: `app-release_v1.2.7.apk`
* **인앱 자동 업데이트**: 서버의 `version.json`에 명시된 버전과 앱의 `package.json` 버전을 비교하여 최신 버전 유무를 판정.

### B. 시맨틱 버저닝(Semantic Versioning) 표기 규칙 (`MAJOR.MINOR.PATCH`)

| 구분 | 증가 규칙 | 적용 기준 및 구체적 예시 |
|:---|:---:|:---|
| **MAJOR (주 버전)**<br>`X.0.0` | **파괴적 변경**<br>(하위 호환 불가) | • SQLite 로컬 물리 테이블 스키마의 비호환적 대규모 개편<br>• ERP/MES 서버 API 통신 프로토콜 및 URL 구조의 전면 교체<br>• 앱의 기본 인증/세션/동기화 아키텍처 전면 리뉴얼 |
| **MINOR (부 버전)**<br>`1.X.0` | **신규 기능 추가**<br>(하위 호환 유지) | • 새로운 화면이나 점검 메뉴 추가 (예: 신규 대시보드 통계 화면 추가)<br>• 신규 언어 다국어(i18n) 지원 확대 (예: 포르투갈어 추가)<br>• 신규 엑셀 마스터 서식 파싱 기능 추가 |
| **PATCH (패치 버전)**<br>`1.2.X` | **단순 버그/스타일 수정**<br>(동작 규격 불변) | • UI 오탈자 수정, 버튼 여백 및 컬러 미세 조정<br>• 특정 단말기에서의 카메라 바코드 포커싱 예외 처리 보강<br>• 비즈니스 로직에 영향 없는 경미한 버그 픽스 및 성능 최적화 |

### C. 안드로이드 `versionCode` 계산 공식
* 공식: `MAJOR * 10000 + MINOR * 100 + PATCH` (예: `1.2.7` ➔ `10207`)
* 안드로이드 OS는 이전 설치본보다 `versionCode`가 반드시 커야만 덮어쓰기 업데이트를 허용하므로, 새 릴리스 배포 시에는 반드시 `package.json`의 버전 숫자를 올려야 합니다.

---

## 11. 자주 겪는 개발 및 빌드 트러블슈팅

### A. `"java" 은(는) 내부 또는 외부 명령...` 오류
* **원인**: JDK 17 환경 변수(`JAVA_HOME`)가 설정되지 않았거나 설정 후 터미널/에디터를 재시작하지 않은 경우입니다.
* **해결**: 시스템 환경 변수에 `JAVA_HOME`(`C:\Program Files\Android\Android Studio\jbr`) 등록 및 `Path`에 `%JAVA_HOME%\bin`을 추가한 후 VS Code를 완전히 재시작하세요.

### B. 안드로이드 Build Fail 또는 `npm run app:build` 에러
* **원인**: SvelteKit 코드상에 TypeScript 문법 오류나 변수 선언 에러가 존재하는 경우입니다.
* **해결**: 터미널에서 `npm run check`를 실행하여 진단 오류를 먼저 해결하세요.

### C. 실기기 연결 시 기기를 찾지 못하거나 오프라인 상태일 때
* **원인**: 단말기의 USB 디버깅 권한이 승인되지 않은 경우입니다.
* **해결**: 스마트폰 [설정] > [개발자 옵션] > [USB 디버깅]을 켜고, PC 연결 시 뜨는 "USB 디버깅을 항상 허용" 팝업을 승인하세요.


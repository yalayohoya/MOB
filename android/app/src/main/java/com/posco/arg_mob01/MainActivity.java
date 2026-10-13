package com.posco.arg_mob01;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ManageStoragePlugin.class);
        registerPlugin(SystemBarThemePlugin.class);
        SplashScreen.installSplashScreen(this); // 스플래시 엔진 설치

        super.onCreate(savedInstanceState);

        // 1. 투명 상태바 및 네비바 플래그 해제 후 안드로이드 시스템 바 배경색 지정 렌더링 활성화
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // 3. [상/하단 인셋 바인딩] 상단 상태바(statusBars)와 하단 네비바(navigationBars) 높이를 감지하여 
        // 네이티브 루트 뷰의 Top/Bottom Padding으로 동시에 자동 바인딩함 (상단 겹침 & 하단 오버레이 완벽 차단)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (v, insets) -> {
            Insets statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars());
            Insets navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            v.setPadding(0, statusBarInsets.top, 0, navBarInsets.bottom);
            return insets;
        });
    }
}

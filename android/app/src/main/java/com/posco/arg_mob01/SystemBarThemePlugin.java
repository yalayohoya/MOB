package com.posco.arg_mob01;

import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBarTheme")
public class SystemBarThemePlugin extends Plugin {

    @PluginMethod
    public void setSystemBarTheme(PluginCall call) {
        Boolean isDark = call.getBoolean("isDark", false);

        getActivity().runOnUiThread(() -> {
            try {
                // 0. AppCompat NightMode 실시간 동기화 (상단 상태바를 MODE_NIGHT_NO가 강제 취소하는 현상 방지)
                int mode = isDark ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO;
                if (AppCompatDelegate.getDefaultNightMode() != mode) {
                    AppCompatDelegate.setDefaultNightMode(mode);
                }

                Window window = getActivity().getWindow();
                View decorView = window.getDecorView();
                WindowInsetsControllerCompat insetsController =
                    WindowCompat.getInsetsController(window, decorView);

                int backgroundColor = isDark ? Color.parseColor("#09090b") : Color.WHITE;

                // 0. DecorView 창 전체 기본 배경색 동기화 (상태바 레이어 밑의 안드로이드 창 기본 배경 변경)
                decorView.setBackgroundColor(backgroundColor);

                window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

                // 1. 상단 상태바(StatusBar) 배경색 및 아이콘 색상 컨트롤
                window.setStatusBarColor(backgroundColor);
                if (insetsController != null) {
                    // isDark가 true일 때는 어두운 배경이므로 글자/아이콘을 밝게(false), false일 때는 어두운 글자(true)
                    insetsController.setAppearanceLightStatusBars(!isDark);
                }

                // 2. 하단 네비게이션바(NavigationBar) 배경색 및 소프트키 아이콘 색상 컨트롤
                window.setNavigationBarColor(backgroundColor);
                if (insetsController != null) {
                    // isDark가 true일 때는 어두운 배경이므로 소프트키 아이콘을 밝게(false), false일 때는 어두운 아이콘(true)
                    insetsController.setAppearanceLightNavigationBars(!isDark);
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to set system bar theme: " + e.getMessage());
            }
        });
    }
}

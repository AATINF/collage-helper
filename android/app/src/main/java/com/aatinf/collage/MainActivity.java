package com.aatinf.collage;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * 应用入口。
 * 两件事：
 *   1) 注册原生保存插件（WebView 不认 a[download]，保存文件必须走它）
 *   2) 解决「升级后用户看到的还是旧界面」：Capacitor 用 https://localhost 加载本地资源，
 *      WebView 会把它们长期缓存。这里关掉缓存，并在 versionCode 变化时清一次缓存。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        int versionCode = currentVersionCode();
        SharedPreferences sp = getSharedPreferences("collage", MODE_PRIVATE);
        if (sp.getInt("versionCode", 0) != versionCode) {
            webView.clearCache(true);
            sp.edit().putInt("versionCode", versionCode).apply();
        }
    }

    private int currentVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return (int) (info.getLongVersionCode() & 0x7fffffff);
        } catch (Exception e) {
            return 0;
        }
    }
}

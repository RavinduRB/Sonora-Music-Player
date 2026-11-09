package com.sonora.musicplayer;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        dispatchWidgetAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchWidgetAction(intent);
    }

    private void dispatchWidgetAction(Intent intent) {
        String action = intent == null ? null : intent.getStringExtra("sonora_widget_action");
        if (action == null) return;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String escapedAction = action.replace("\\", "\\\\").replace("'", "\\'");
            getBridge().getWebView().evaluateJavascript(
                "window.sonoraWidgetAction && window.sonoraWidgetAction('" + escapedAction + "')",
                null
            );
        }, 700);
    }
}

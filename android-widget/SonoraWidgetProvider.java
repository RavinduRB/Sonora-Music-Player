package com.sonora.musicplayer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class SonoraWidgetProvider extends AppWidgetProvider {
    private static final String ACTION = "sonora_widget_action";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, viewsFor(context));
        }
    }

    private RemoteViews viewsFor(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sonora_widget);
        views.setOnClickPendingIntent(R.id.widget_previous, pendingIntent(context, "previous", 1));
        views.setOnClickPendingIntent(R.id.widget_play, pendingIntent(context, "play", 2));
        views.setOnClickPendingIntent(R.id.widget_next, pendingIntent(context, "next", 3));
        views.setOnClickPendingIntent(R.id.widget_surface, pendingIntent(context, "open", 4));
        return views;
    }

    private PendingIntent pendingIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra(ACTION, action);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}

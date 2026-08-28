package tv.swoop.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;

public class SwoopUpdateReceiver extends BroadcastReceiver {
    public static final String ACTION_INSTALL_STATUS = "tv.swoop.player.UPDATE_INSTALL_STATUS";

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        SharedPreferences prefs = context.getSharedPreferences(SwoopUpdateManager.PREFS, Context.MODE_PRIVATE);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            prefs.edit().putString("phase", "approval_required").putString("error", "").apply();
            Intent confirm;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            } else {
                confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            }
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { context.startActivity(confirm); } catch (Exception ignored) {}
            }
            return;
        }

        if (status == PackageInstaller.STATUS_SUCCESS) {
            prefs.edit()
                    .putString("phase", "installed")
                    .putString("error", "")
                    .putInt("progress", 100)
                    .apply();
            try {
                Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
                if (launch != null) {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(launch);
                }
            } catch (Exception ignored) {}
            return;
        }

        String failure = message == null || message.trim().isEmpty()
                ? "Android could not install the Swoop TV update."
                : message.trim();
        prefs.edit()
                .putString("phase", "error")
                .putString("error", failure)
                .putInt("progress", 0)
                .apply();
    }
}

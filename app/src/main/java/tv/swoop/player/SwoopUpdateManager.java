package tv.swoop.player;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class SwoopUpdateManager {
    interface Listener {
        void onStatus(JSONObject status);
    }

    static final String PREFS = "swoop-tv-updater";
    static final String RELEASE_TAG = "google-tv-test-v0.8.1";
    static final String STABLE_APK = "Swoop-TV-v0.8.1-Google-TV-Test.apk";

    private static final String TAG = "SwoopUpdater";
    private static final long LAUNCH_DELAY_MS = 600L;
    private static final int CONNECT_TIMEOUT_MS = 20_000;
    private static final int READ_TIMEOUT_MS = 120_000;

    private final Activity activity;
    private final SharedPreferences prefs;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Listener listener;

    private volatile boolean busy = false;
    private volatile String phase;
    private volatile String error;
    private volatile int progress;
    private volatile String latestVersion;
    private volatile int latestVersionCode;
    private volatile String latestUrl;
    private volatile long lastCheckedAt;

    SwoopUpdateManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
        this.phase = prefs.getString("phase", "idle");
        this.error = prefs.getString("error", "");
        this.progress = prefs.getInt("progress", 0);
        this.latestVersion = prefs.getString("latestVersion", "");
        this.latestVersionCode = prefs.getInt("latestVersionCode", 0);
        this.latestUrl = prefs.getString("latestUrl", "");
        this.lastCheckedAt = prefs.getLong("lastCheckedAt", 0L);
        if ("installed".equals(phase) || "installing".equals(phase)) {
            phase = "idle";
            error = "";
            progress = 0;
            persist();
        }
    }

    void scheduleLaunchCheck() {
        main.postDelayed(() -> checkForUpdate(true, false), LAUNCH_DELAY_MS);
    }

    void onResume() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            notifyStatus();
            return;
        }
        boolean canInstall = canRequestPackageInstalls();
        boolean pendingManual = prefs.getBoolean("installAfterPermission", false);
        if (canInstall && "permission_required".equals(phase)) {
            if (latestVersionCode > BuildConfig.VERSION_CODE && !busy && (pendingManual || automaticUpdates())) {
                prefs.edit().putBoolean("installAfterPermission", false).apply();
                installAvailableUpdate(false);
                return;
            }
            prefs.edit().putBoolean("installAfterPermission", false).apply();
            setState(latestVersionCode > BuildConfig.VERSION_CODE ? "available" : "up_to_date", "", latestVersionCode > BuildConfig.VERSION_CODE ? 0 : 100);
            return;
        }
        notifyStatus();
    }

    void shutdown() {
        main.removeCallbacksAndMessages(null);
        try { executor.shutdownNow(); } catch (Exception ignored) {}
    }

    boolean automaticUpdates() {
        return prefs.getBoolean("automaticUpdates", true);
    }

    String setAutomaticUpdates(boolean enabled) {
        prefs.edit().putBoolean("automaticUpdates", enabled).apply();
        notifyStatus();
        if (enabled && latestVersionCode > BuildConfig.VERSION_CODE && !busy) installAvailableUpdate(false);
        return statusJson();
    }

    String checkForUpdate(boolean installIfAvailable, boolean manual) {
        synchronized (this) {
            if (busy) return statusJson();
            busy = true;
        }
        setState("checking", "", 0);
        executor.execute(() -> {
            try {
                JSONObject manifest = fetchManifest();
                String version = manifest.optString("version", "").trim();
                int versionCode = manifest.optInt("versionCode", 0);
                if (version.isEmpty() || versionCode <= 0) throw new Exception("The update manifest is missing version information.");

                String url = stableApkUrl();
                latestVersion = version;
                latestVersionCode = versionCode;
                latestUrl = url;
                lastCheckedAt = System.currentTimeMillis();
                persist();

                if (versionCode <= BuildConfig.VERSION_CODE) {
                    if (automaticUpdates() && requestAutomaticInstallPermission(versionCode, false)) return;
                    setState("up_to_date", "", 100);
                    return;
                }

                setState("available", "", 0);
                boolean shouldInstall = installIfAvailable && (manual || automaticUpdates());
                if (!shouldInstall) return;
                if (!canRequestPackageInstalls()) {
                    if (automaticUpdates() && requestAutomaticInstallPermission(versionCode, true)) return;
                    setState("permission_required", "", 0);
                    return;
                }
                downloadAndInstall();
            } catch (Exception e) {
                setState("error", messageOf(e, "Could not check for updates."), 0);
            } finally {
                busy = false;
                notifyStatus();
            }
        });
        return statusJson();
    }

    String installAvailableUpdate(boolean openPermissionWhenNeeded) {
        if (latestVersionCode <= BuildConfig.VERSION_CODE || latestUrl == null || latestUrl.isEmpty()) {
            return checkForUpdate(true, true);
        }
        synchronized (this) {
            if (busy) return statusJson();
            if (!canRequestPackageInstalls()) {
                prefs.edit().putBoolean("installAfterPermission", true).apply();
                setState("permission_required", "", 0);
                if (openPermissionWhenNeeded) openInstallPermissionSettings();
                return statusJson();
            }
            busy = true;
        }
        setState("downloading", "", 0);
        executor.execute(() -> {
            try {
                downloadAndInstall();
            } catch (Exception e) {
                setState("error", messageOf(e, "Could not install the update."), 0);
            } finally {
                busy = false;
                notifyStatus();
            }
        });
        return statusJson();
    }

    private boolean requestAutomaticInstallPermission(int promptVersionCode, boolean installAfterPermission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || canRequestPackageInstalls() || !automaticUpdates()) return false;
        int promptKey = promptVersionCode > 0 ? promptVersionCode : BuildConfig.VERSION_CODE;
        int lastPrompt = prefs.getInt("lastPermissionPromptVersionCode", 0);
        prefs.edit().putBoolean("installAfterPermission", installAfterPermission).apply();
        setState("permission_required", "", 0);
        if (lastPrompt != promptKey) {
            prefs.edit().putInt("lastPermissionPromptVersionCode", promptKey).apply();
            openInstallPermissionSettings();
        }
        return true;
    }

    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();
        main.post(() -> {
            Uri packageUri = Uri.parse("package:" + activity.getPackageName());
            Intent[] candidates = new Intent[] {
                    new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri),
                    new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES),
                    new Intent(Settings.ACTION_SECURITY_SETTINGS),
                    new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
            };
            Exception lastError = null;
            for (Intent intent : candidates) {
                try {
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    activity.startActivity(intent);
                    Log.i(TAG, "Opened update install settings with " + intent.getAction());
                    return;
                } catch (Exception e) {
                    lastError = e;
                    Log.w(TAG, "Update settings intent unavailable: " + intent.getAction(), e);
                }
            }
            String message = "Could not open Android update-install settings. Open Settings > Apps > Special app access > Install unknown apps and allow Swoop TV.";
            if (lastError != null) Log.e(TAG, message, lastError);
            setState("permission_required", message, 0);
        });
        return statusJson();
    }

    String statusJson() {
        return statusObject().toString();
    }

    JSONObject statusObject() {
        JSONObject out = new JSONObject();
        try {
            out.put("currentVersion", BuildConfig.VERSION_NAME);
            out.put("currentVersionCode", BuildConfig.VERSION_CODE);
            out.put("automaticUpdates", automaticUpdates());
            out.put("canInstallPackages", canRequestPackageInstalls());
            out.put("phase", phase == null ? "idle" : phase);
            out.put("progress", Math.max(0, Math.min(100, progress)));
            out.put("error", error == null ? "" : error);
            out.put("latestVersion", latestVersion == null ? "" : latestVersion);
            out.put("latestVersionCode", latestVersionCode);
            out.put("updateAvailable", latestVersionCode > BuildConfig.VERSION_CODE);
            out.put("lastCheckedAt", lastCheckedAt);
        } catch (Exception ignored) {}
        return out;
    }

    private void downloadAndInstall() throws Exception {
        if (latestVersionCode <= BuildConfig.VERSION_CODE) {
            setState("up_to_date", "", 100);
            return;
        }
        setState("downloading", "", 0);
        File apk = downloadVerifiedApk(latestUrl);
        verifyArchive(apk);
        setState("installing", "", 100);
        commitPackageInstall(apk);
    }

    private JSONObject fetchManifest() throws Exception {
        String text = fetchSmallText(manifestUrl(), 512 * 1024);
        return new JSONObject(text);
    }

    private File downloadVerifiedApk(String url) throws Exception {
        String expected = fetchSmallText(url + ".sha256", 64 * 1024).trim().split("\\s+")[0].toLowerCase(Locale.US);
        if (!expected.matches("[0-9a-f]{64}")) throw new Exception("The update checksum is invalid.");

        File dir = new File(activity.getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create the update cache.");
        File target = new File(dir, "swoop-tv-update.apk");
        File part = new File(dir, "swoop-tv-update.apk.part");
        if (part.exists()) part.delete();

        HttpURLConnection connection = open(url, "application/vnd.android.package-archive,*/*");
        long total = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? connection.getContentLengthLong() : connection.getContentLength();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long done = 0L;
        int lastEmitted = -1;
        try (InputStream in = new BufferedInputStream(connection.getInputStream(), 64 * 1024);
             FileOutputStream out = new FileOutputStream(part, false)) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedException("Update download cancelled.");
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                done += n;
                int pct = total > 0L ? (int)Math.min(99L, Math.round(done * 100.0 / total)) : 0;
                if (pct != lastEmitted && (pct == 0 || pct == 99 || pct - lastEmitted >= 2)) {
                    lastEmitted = pct;
                    setState("downloading", "", pct);
                }
            }
            out.flush();
            out.getFD().sync();
        } finally {
            connection.disconnect();
        }

        String actual = hex(digest.digest());
        if (!expected.equals(actual)) {
            part.delete();
            throw new Exception("The downloaded APK failed checksum verification.");
        }
        if (target.exists() && !target.delete()) throw new Exception("Could not replace the previous update file.");
        if (!part.renameTo(target)) {
            copyFile(part, target);
            part.delete();
        }
        return target;
    }

    @SuppressWarnings("deprecation")
    private void verifyArchive(File apk) throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
        if (info == null) throw new Exception("Android could not read the downloaded APK.");
        if (!activity.getPackageName().equals(info.packageName)) throw new Exception("The update APK has the wrong application ID.");
        long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
        if (code <= BuildConfig.VERSION_CODE) throw new Exception("The downloaded APK is not newer than the installed version.");
        if (latestVersionCode > 0 && code != latestVersionCode) throw new Exception("The downloaded APK version does not match the update manifest.");
    }

    private void commitPackageInstall(File apk) throws Exception {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        params.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }

        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId);
             InputStream input = new FileInputStream(apk);
             OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
            session.fsync(output);

            Intent statusIntent = new Intent(activity, SwoopUpdateReceiver.class)
                    .setAction(SwoopUpdateReceiver.ACTION_INSTALL_STATUS)
                    .putExtra("version", latestVersion)
                    .putExtra("versionCode", latestVersionCode);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pending = PendingIntent.getBroadcast(activity, sessionId, statusIntent, flags);
            session.commit(pending.getIntentSender());
        }
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try { return activity.getPackageManager().canRequestPackageInstalls(); }
        catch (Exception ignored) { return false; }
    }

    private HttpURLConnection open(String url, String accept) throws Exception {
        HttpURLConnection connection = (HttpURLConnection)new URL(url).openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", accept);
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("User-Agent", "SwoopTV/" + BuildConfig.VERSION_NAME + " AndroidTV-Updater");
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            connection.disconnect();
            throw new Exception("Update server returned HTTP " + code + ".");
        }
        return connection;
    }

    private String fetchSmallText(String url, int limit) throws Exception {
        HttpURLConnection connection = open(url, "application/json,text/plain,*/*");
        try (InputStream in = new BufferedInputStream(connection.getInputStream(), 16 * 1024)) {
            byte[] buffer = new byte[16 * 1024];
            StringBuilder text = new StringBuilder();
            int total = 0;
            int n;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > limit) throw new Exception("Update metadata is unexpectedly large.");
                text.append(new String(buffer, 0, n, StandardCharsets.UTF_8));
            }
            return text.toString();
        } finally {
            connection.disconnect();
        }
    }

    private String repository() {
        String repo = BuildConfig.GITHUB_REPOSITORY == null ? "" : BuildConfig.GITHUB_REPOSITORY.trim();
        return repo.contains("/") ? repo : "Swoop081/swoop-tv-android";
    }

    private String manifestUrl() {
        return "https://github.com/" + repository() + "/releases/download/" + RELEASE_TAG + "/swoop-tv-latest.json";
    }

    private String stableApkUrl() {
        return "https://github.com/" + repository() + "/releases/download/" + RELEASE_TAG + "/" + STABLE_APK;
    }

    private void setState(String nextPhase, String nextError, int nextProgress) {
        phase = nextPhase;
        error = nextError == null ? "" : nextError;
        progress = Math.max(0, Math.min(100, nextProgress));
        persist();
        notifyStatus();
    }

    private void persist() {
        prefs.edit()
                .putString("phase", phase == null ? "idle" : phase)
                .putString("error", error == null ? "" : error)
                .putInt("progress", progress)
                .putString("latestVersion", latestVersion == null ? "" : latestVersion)
                .putInt("latestVersionCode", latestVersionCode)
                .putString("latestUrl", latestUrl == null ? "" : latestUrl)
                .putLong("lastCheckedAt", lastCheckedAt)
                .apply();
    }

    private void notifyStatus() {
        if (listener == null) return;
        JSONObject snapshot = statusObject();
        try { listener.onStatus(snapshot); } catch (Exception ignored) {}
    }

    private static String messageOf(Exception e, String fallback) {
        String message = e == null ? "" : e.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message.trim();
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.US, "%02x", b & 0xff));
        return out.toString();
    }

    private static void copyFile(File from, File to) throws Exception {
        try (InputStream in = new FileInputStream(from); OutputStream out = new FileOutputStream(to, false)) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            out.flush();
        }
    }
}

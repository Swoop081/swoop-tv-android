package tv.swoop.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.os.Environment;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Log;
import android.util.Xml;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.Button;
import android.widget.LinearLayout;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.webkit.WebViewAssetLoader;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.AspectRatioFrameLayout;

import org.json.JSONObject;
import org.json.JSONArray;
import org.xmlpull.v1.XmlPullParser;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PushbackInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.GZIPInputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 8001;
    private static final long SEEK_MS = 10_000L;

    private FrameLayout root;
    private WebView webView;
    private PlayerView playerView;
    private ExoPlayer player;
    private PlayerView previewPlayerView;
    private ExoPlayer previewPlayer;
    private ImageView launchSplashView;
    private ValueCallback<Uri[]> filePathCallback;
    private WebViewAssetLoader assetLoader;
    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);
    private SwoopUpdateManager updateManager;
    private final ConcurrentHashMap<String, String> asyncFetchResults = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> asyncFetchErrors = new ConcurrentHashMap<>();

    private volatile boolean nativePlayerVisible = false;
    private boolean nativePlayerFillMode = false;
    private boolean selectKeyDown = false;
    private boolean selectLongPressCandidate = false;
    private boolean selectLongPressTriggered = false;
    private int selectKeyCode = -1;
    private Runnable selectLongPressRunnable = null;
    private volatile boolean ended = false;
    private volatile String playbackError = "";
    private String currentTitle = "Swoop TV";
    private String currentKind = "video";
    private long rendererGoneCount = 0L;
    private long lastRendererGoneAt = 0L;
    private boolean lastRendererCrashed = false;
    private int lastRendererPriority = 0;
    private long nativeKeyEventCount = 0L;
    private int lastNativeKeyCode = -1;
    private long lastNativeKeyAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        applyImmersive();
        loadDiagnosticState();
        buildUi();
        configureWebView();
        updateManager = new SwoopUpdateManager(this, detail -> emitNativeEvent("swoop-update-status", detail));
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        updateManager.scheduleLaunchCheck();
    }

    private void loadDiagnosticState() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("swoop-tv-diagnostics", MODE_PRIVATE);
            rendererGoneCount = prefs.getLong("rendererGoneCount", 0L);
            lastRendererGoneAt = prefs.getLong("lastRendererGoneAt", 0L);
            lastRendererCrashed = prefs.getBoolean("lastRendererCrashed", false);
            lastRendererPriority = prefs.getInt("lastRendererPriority", 0);
        } catch (Exception ignored) {}
    }

    private void persistRendererDiagnosticState() {
        try {
            getSharedPreferences("swoop-tv-diagnostics", MODE_PRIVATE).edit()
                    .putLong("rendererGoneCount", rendererGoneCount)
                    .putLong("lastRendererGoneAt", lastRendererGoneAt)
                    .putBoolean("lastRendererCrashed", lastRendererCrashed)
                    .putInt("lastRendererPriority", lastRendererPriority)
                    .apply();
        } catch (Exception ignored) {}
    }

    private void buildUi() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 5, 8));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 8));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        previewPlayerView = new PlayerView(this);
        previewPlayerView.setBackgroundColor(Color.BLACK);
        previewPlayerView.setUseController(false);
        previewPlayerView.setControllerAutoShow(false);
        previewPlayerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
        previewPlayerView.setVisibility(View.GONE);
        root.addView(previewPlayerView, new FrameLayout.LayoutParams(1, 1));

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(false);
        playerView.setControllerShowTimeoutMs(7000);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerView.setShowRewindButton(true);
        playerView.setShowFastForwardButton(true);
        playerView.setShowSubtitleButton(true);
        playerView.setShowPreviousButton(false);
        playerView.setShowNextButton(false);
        playerView.setTimeBarScrubbingEnabled(true);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setKeepScreenOn(true);
        playerView.setVisibility(View.GONE);
        root.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        configurePremiumPlayerControls();

        launchSplashView = new ImageView(this);
        launchSplashView.setBackgroundColor(Color.rgb(5, 5, 8));
        launchSplashView.setImageResource(R.drawable.swoop_launch_logo);
        launchSplashView.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        launchSplashView.setPadding(280, 180, 280, 180);
        launchSplashView.setFocusable(false);
        launchSplashView.setClickable(false);
        root.addView(launchSplashView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setUserAgentString(s.getUserAgentString() + " SwoopTV/0.8.52 AndroidTV");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.addJavascriptInterface(new AndroidBridge(), "SwoopAndroid");
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                hideLaunchSplash();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                rendererGoneCount++;
                lastRendererGoneAt = System.currentTimeMillis();
                lastRendererCrashed = detail.didCrash();
                lastRendererPriority = detail.rendererPriorityAtExit();
                persistRendererDiagnosticState();
                Log.e("SwoopTV", "WebView renderer exited; crashed=" + detail.didCrash() + " priority=" + detail.rendererPriorityAtExit());
                stopPreviewPlayer();
                runOnUiThread(() -> recreate());
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallbackNew, FileChooserParams fileChooserParams) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = filePathCallbackNew;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/x-mpegURL", "application/vnd.apple.mpegurl", "text/plain", "application/octet-stream"
                });
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            }
        });
    }

    private void hideLaunchSplash() {
        if (launchSplashView == null) return;
        launchSplashView.animate()
                .alpha(0f)
                .setDuration(180L)
                .withEndAction(() -> {
                    if (launchSplashView != null) {
                        launchSplashView.setVisibility(View.GONE);
                        launchSplashView.setAlpha(1f);
                    }
                })
                .start();
    }

    private void applyImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            result = new Uri[]{data.getData()};
        }
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    private void startPreviewPlayer(String url, double left, double top, double width, double height) {
        stopPreviewPlayer();
        if (url == null || url.trim().isEmpty() || previewPlayerView == null || root == null) return;
        int rw = Math.max(1, root.getWidth());
        int rh = Math.max(1, root.getHeight());
        int x = Math.max(0, Math.min(rw - 1, (int)Math.round(left * rw)));
        int y = Math.max(0, Math.min(rh - 1, (int)Math.round(top * rh)));
        int w = Math.max(1, Math.min(rw - x, (int)Math.round(width * rw)));
        int h = Math.max(1, Math.min(rh - y, (int)Math.round(height * rh)));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(w, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        previewPlayerView.setLayoutParams(lp);
        previewPlayer = new ExoPlayer.Builder(this).build();
        previewPlayer.setVolume(0f);
        previewPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) runOnUiThread(() -> {
                    if (previewPlayerView != null && previewPlayer != null) previewPlayerView.setVisibility(View.VISIBLE);
                });
            }
            @Override
            public void onPlayerError(PlaybackException error) {
                runOnUiThread(() -> stopPreviewPlayer());
            }
        });
        previewPlayerView.setPlayer(previewPlayer);
        previewPlayerView.setVisibility(View.GONE);
        previewPlayer.setMediaItem(MediaItem.fromUri(url.trim()));
        previewPlayer.prepare();
        previewPlayer.play();
    }

    private void stopPreviewPlayer() {
        try {
            if (previewPlayer != null) {
                previewPlayer.stop();
                previewPlayer.release();
            }
        } catch (Exception ignored) {}
        previewPlayer = null;
        if (previewPlayerView != null) {
            previewPlayerView.setPlayer(null);
            previewPlayerView.setVisibility(View.GONE);
        }
    }

    private View media3Control(String resourceName) {
        if (playerView == null || resourceName == null) return null;
        int id = getResources().getIdentifier(resourceName, "id", getPackageName());
        return id == 0 ? null : playerView.findViewById(id);
    }

    private Button premiumPlayerButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(12f);
        button.setAllCaps(false);
        button.setFocusable(true);
        button.setFocusableInTouchMode(false);
        button.setPadding(18, 6, 18, 6);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(220, 24, 26, 34));
        bg.setCornerRadius(16f);
        bg.setStroke(1, Color.argb(100, 255, 255, 255));
        button.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(6, 0, 6, 0);
        button.setLayoutParams(lp);
        return button;
    }

    private void configurePremiumPlayerControls() {
        if (playerView == null) return;
        String[] ids = new String[]{"exo_rew","exo_play_pause","exo_ffwd","exo_subtitle","exo_settings"};
        for (String idName : ids) {
            View control = media3Control(idName);
            if (control == null) continue;
            control.setVisibility(View.VISIBLE);
            float scale = "exo_play_pause".equals(idName) ? 1.28f : 1.14f;
            control.setScaleX(scale);
            control.setScaleY(scale);
            control.setPadding(12,12,12,12);
            if ("exo_subtitle".equals(idName)) control.setContentDescription("Subtitles");
            if ("exo_settings".equals(idName)) control.setContentDescription("Audio and playback options");
        }
        View bottomBar = media3Control("exo_bottom_bar");
        if (bottomBar != null) {
            bottomBar.setBackgroundColor(Color.argb(210,7,8,14));
            bottomBar.setPadding(34,16,34,24);
        }
        View basicControls = media3Control("exo_basic_controls");
        if (basicControls instanceof LinearLayout) {
            LinearLayout group = (LinearLayout) basicControls;
            Button audio = premiumPlayerButton("Audio & Speed");
            audio.setContentDescription("Audio tracks and playback speed");
            audio.setOnClickListener(v -> {
                playerView.showController();
                View settings = media3Control("exo_settings");
                if (settings != null) settings.performClick();
            });
            Button subtitles = premiumPlayerButton("Subtitles");
            subtitles.setContentDescription("Subtitle and closed caption tracks");
            subtitles.setOnClickListener(v -> {
                playerView.showController();
                View cc = media3Control("exo_subtitle");
                if (cc != null) cc.performClick();
            });
            Button fit = premiumPlayerButton("Fit");
            fit.setContentDescription("Toggle video between fit and fill");
            fit.setOnClickListener(v -> {
                nativePlayerFillMode = !nativePlayerFillMode;
                playerView.setResizeMode(nativePlayerFillMode
                        ? AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                        : AspectRatioFrameLayout.RESIZE_MODE_FIT);
                fit.setText(nativePlayerFillMode ? "Fill" : "Fit");
                playerView.showController();
            });
            group.addView(audio, 0);
            group.addView(subtitles, 1);
            group.addView(fit, 2);
        }
    }

    private java.util.List<MediaItem.SubtitleConfiguration> buildSubtitleConfigurations(JSONArray subtitleTracks) {
        java.util.ArrayList<MediaItem.SubtitleConfiguration> out = new java.util.ArrayList<>();
        if (subtitleTracks == null) return out;
        for (int i=0;i<subtitleTracks.length();i++) {
            JSONObject row = subtitleTracks.optJSONObject(i);
            if (row == null) continue;
            String url = row.optString("url", row.optString("uri", "")).trim();
            if (url.isEmpty()) continue;
            String mime = row.optString("mimeType", row.optString("mime_type", "")).trim();
            if (mime.isEmpty()) {
                String lower = url.toLowerCase(Locale.ROOT);
                mime = lower.contains(".srt") ? MimeTypes.APPLICATION_SUBRIP : MimeTypes.TEXT_VTT;
            }
            MediaItem.SubtitleConfiguration.Builder builder = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(url)).setMimeType(mime);
            String language = row.optString("language", row.optString("lang", "")).trim();
            String label = row.optString("label", row.optString("name", "")).trim();
            if (!language.isEmpty()) builder.setLanguage(language);
            if (!label.isEmpty()) builder.setLabel(label);
            out.add(builder.build());
        }
        return out;
    }

    private void startNativePlayer(String url, String title, String kind, double startSeconds, JSONArray subtitleTracks) {
        stopPreviewPlayer();
        releasePlayerOnly();
        ended = false;
        playbackError = "";
        currentTitle = title == null || title.isEmpty() ? "Swoop TV" : title;
        currentKind = kind == null || kind.isEmpty() ? "video" : kind;

        player = new ExoPlayer.Builder(this)
                .setSeekBackIncrementMs(SEEK_MS)
                .setSeekForwardIncrementMs(SEEK_MS)
                .build();
        playerView.setPlayer(player);
        playerView.setVisibility(View.VISIBLE);
        playerView.bringToFront();
        playerView.requestFocus();
        nativePlayerVisible = true;
        webView.setVisibility(View.INVISIBLE);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED && nativePlayerVisible) {
                    ended = true;
                    JSONObject snapshot = playbackSnapshot(true);
                    hideNativePlayer(false);
                    emitNativeEvent("swoop-native-ended", snapshot);
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                playbackError = error.getMessage() == null ? "Playback failed." : error.getMessage();
                JSONObject detail = playbackSnapshot(false);
                try { detail.put("message", playbackError); } catch (Exception ignored) {}
                hideNativePlayer(false);
                emitNativeEvent("swoop-native-error", detail);
            }
        });

        MediaItem.Builder mediaBuilder = new MediaItem.Builder().setUri(url).setMediaId(currentTitle);
        java.util.List<MediaItem.SubtitleConfiguration> subtitleConfigurations = buildSubtitleConfigurations(subtitleTracks);
        if (!subtitleConfigurations.isEmpty()) mediaBuilder.setSubtitleConfigurations(subtitleConfigurations);
        MediaItem item = mediaBuilder.build();
        player.setMediaItem(item);
        if (startSeconds > 0) player.seekTo(Math.max(0L, Math.round(startSeconds * 1000.0)));
        player.prepare();
        player.play();
    }

    private JSONObject playbackSnapshot(boolean eofReached) {
        JSONObject pb = new JSONObject();
        try {
            long pos = player != null ? Math.max(0L, player.getCurrentPosition()) : 0L;
            long dur = player != null ? player.getDuration() : 0L;
            if (dur < 0) dur = 0L;
            VideoSize size = player != null ? player.getVideoSize() : VideoSize.UNKNOWN;
            pb.put("timePos", pos / 1000.0);
            pb.put("duration", dur / 1000.0);
            pb.put("percentPos", dur > 0 ? (pos * 100.0 / dur) : 0.0);
            pb.put("eofReached", eofReached);
            pb.put("width", size == null ? 0 : size.width);
            pb.put("height", size == null ? 0 : size.height);
            pb.put("videoFormat", "");
            pb.put("audioCodec", "");
            pb.put("title", currentTitle);
            pb.put("kind", currentKind);
        } catch (Exception ignored) {}
        return pb;
    }

    private JSONObject diagnosticsJson() {
        JSONObject out = new JSONObject();
        try {
            boolean usable = player != null && playbackError.isEmpty();
            int state = player != null ? player.getPlaybackState() : Player.STATE_IDLE;
            Runtime runtime = Runtime.getRuntime();
            long usedBytes = runtime.totalMemory() - runtime.freeMemory();
            out.put("version", "0.8.52");
            out.put("versionCode", 852);
            out.put("uptimeMs", SystemClock.elapsedRealtime());
            out.put("playing", nativePlayerVisible && usable && state != Player.STATE_IDLE);
            out.put("paused", player != null && !player.getPlayWhenReady());
            out.put("ended", ended);
            out.put("error", playbackError);
            out.put("previewPlaying", previewPlayer != null && previewPlayer.isPlaying());
            out.put("webViewWidth", webView == null ? 0 : webView.getWidth());
            out.put("webViewHeight", webView == null ? 0 : webView.getHeight());
            out.put("rootWidth", root == null ? 0 : root.getWidth());
            out.put("rootHeight", root == null ? 0 : root.getHeight());
            out.put("javaHeapUsedBytes", usedBytes);
            out.put("javaHeapMaxBytes", runtime.maxMemory());
            out.put("rendererGoneCount", rendererGoneCount);
            out.put("lastRendererGoneAt", lastRendererGoneAt);
            out.put("lastRendererCrashed", lastRendererCrashed);
            out.put("lastRendererPriority", lastRendererPriority);
            out.put("nativeKeyEventCount", nativeKeyEventCount);
            out.put("lastNativeKeyCode", lastNativeKeyCode);
            out.put("lastNativeKeyAt", lastNativeKeyAt);
            out.put("playback", playbackSnapshot(ended));
        } catch (Exception ignored) {}
        return out;
    }

    private JSONObject saveDiagnosticsFile(String payloadJson) {
        JSONObject out = new JSONObject();
        try {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
            if (dir == null) dir = getFilesDir();
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create diagnostics folder.");
            String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
            File file = new File(dir, "Swoop-TV-v0.8.52-Diagnostics-" + stamp + ".json");
            byte[] bytes = String.valueOf(payloadJson == null ? "{}" : payloadJson).getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream stream = new FileOutputStream(file, false)) {
                stream.write(bytes);
                stream.flush();
            }
            out.put("ok", true);
            out.put("path", file.getAbsolutePath());
            out.put("bytes", bytes.length);
        } catch (Exception e) {
            try { out.put("ok", false); out.put("error", e.getMessage() == null ? "Could not save diagnostics." : e.getMessage()); } catch (Exception ignored) {}
        }
        return out;
    }

    private JSONObject stopNativePlayer(boolean notifyWeb) {
        JSONObject pb = playbackSnapshot(false);
        hideNativePlayer(true);
        if (notifyWeb) emitNativeEvent("swoop-native-return", pb);
        JSONObject out = new JSONObject();
        try {
            out.put("ok", true);
            out.put("playback", pb);
        } catch (Exception ignored) {}
        return out;
    }

    private void hideNativePlayer(boolean release) {
        nativePlayerVisible = false;
        playerView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.requestFocus();
        if (release) releasePlayerOnly();
    }

    private void releasePlayerOnly() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
        playerView.setPlayer(null);
    }

    private void emitNativeEvent(String name, JSONObject detail) {
        String js = "window.dispatchEvent(new CustomEvent(" + JSONObject.quote(name)
                + ",{detail:" + detail.toString() + "}));";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private <T> T onMain(Callable<T> action, T fallback) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            try { return action.call(); } catch (Exception ignored) { return fallback; }
        }
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<T> ref = new AtomicReference<>(fallback);
        runOnUiThread(() -> {
            try { ref.set(action.call()); } catch (Exception ignored) {}
            latch.countDown();
        });
        try { latch.await(20, TimeUnit.SECONDS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        return ref.get();
    }

    private InputStream maybeGunzip(InputStream raw, String contentEncoding) throws Exception {
        PushbackInputStream push = new PushbackInputStream(raw, 2);
        int b1 = push.read();
        int b2 = push.read();
        if (b2 >= 0) push.unread(b2);
        if (b1 >= 0) push.unread(b1);
        boolean gzip = "gzip".equalsIgnoreCase(contentEncoding) || (b1 == 0x1f && b2 == 0x8b);
        return gzip ? new GZIPInputStream(push, 32 * 1024) : push;
    }

    private String fetchTextBlocking(String urlString) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setConnectTimeout(20_000);
        c.setReadTimeout(90_000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Accept", "*/*");
        c.setRequestProperty("Accept-Encoding", "gzip");
        c.setRequestProperty("User-Agent", "SwoopTV/0.8.52 AndroidTV");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("Provider returned HTTP " + code);
        InputStream raw = new BufferedInputStream(c.getInputStream(), 32 * 1024);
        InputStream in = maybeGunzip(raw, c.getContentEncoding());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[32 * 1024];
        int total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > 128 * 1024 * 1024) throw new Exception("Provider response is too large for direct text transfer.");
            out.write(buffer, 0, n);
        }
        in.close();
        c.disconnect();
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private long parseXmltvDateMs(String value) {
        try {
            String raw = value == null ? "" : value.trim();
            if (raw.length() < 12) return 0L;
            String[] parts = raw.split("\\s+");
            String digits = parts[0].replaceAll("[^0-9]", "");
            if (digits.length() < 12) return 0L;
            if (digits.length() == 12) digits += "00";
            if (digits.length() > 14) digits = digits.substring(0, 14);
            if (parts.length > 1 && !parts[1].isEmpty()) {
                String tz = "Z".equalsIgnoreCase(parts[1]) ? "+0000" : parts[1];
                SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmmss Z", Locale.US);
                Date d = f.parse(digits + " " + tz);
                return d == null ? 0L : d.getTime();
            }
            SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmmss", Locale.US);
            Date d = f.parse(digits);
            return d == null ? 0L : d.getTime();
        } catch (Exception ignored) { return 0L; }
    }

    private String fetchXmltvIndexBlocking(String urlString, String wantedJson, long windowStartMs, long windowEndMs) throws Exception {
        Set<String> wanted = new HashSet<>();
        JSONArray wantedArray = new JSONArray(wantedJson == null ? "[]" : wantedJson);
        for (int i = 0; i < wantedArray.length(); i++) {
            String id = wantedArray.optString(i, "").trim();
            if (!id.isEmpty()) wanted.add(id);
        }
        JSONObject channels = new JSONObject();
        if (wanted.isEmpty()) return new JSONObject().put("channels", channels).put("matched", 0).put("programmes", 0).toString();

        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setConnectTimeout(20_000);
        c.setReadTimeout(120_000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Accept", "application/xml,text/xml,*/*");
        c.setRequestProperty("Accept-Encoding", "gzip");
        c.setRequestProperty("User-Agent", "SwoopTV/0.8.52 AndroidTV");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("Programme guide returned HTTP " + code);

        InputStream raw = new BufferedInputStream(c.getInputStream(), 64 * 1024);
        InputStream in = maybeGunzip(raw, c.getContentEncoding());
        XmlPullParser parser = Xml.newPullParser();
        parser.setInput(in, "UTF-8");

        boolean capture = false;
        String channelId = "";
        String title = "Programme";
        long startMs = 0L;
        long endMs = 0L;
        int programmes = 0;
        Set<String> matchedChannels = new HashSet<>();
        int event = parser.getEventType();
        while (event != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG) {
                String name = parser.getName();
                if ("programme".equals(name)) {
                    channelId = parser.getAttributeValue(null, "channel");
                    if (channelId == null) channelId = "";
                    startMs = parseXmltvDateMs(parser.getAttributeValue(null, "start"));
                    endMs = parseXmltvDateMs(parser.getAttributeValue(null, "stop"));
                    capture = wanted.contains(channelId) && startMs > 0L && endMs > startMs && endMs > windowStartMs && startMs < windowEndMs;
                    title = "Programme";
                } else if (capture && "title".equals(name)) {
                    String t = parser.nextText();
                    if (t != null && !t.trim().isEmpty()) title = t.trim();
                }
            } else if (event == XmlPullParser.END_TAG && "programme".equals(parser.getName())) {
                if (capture) {
                    JSONArray list = channels.optJSONArray(channelId);
                    if (list == null) { list = new JSONArray(); channels.put(channelId, list); }
                    if (list.length() < 24) {
                        JSONObject item = new JSONObject();
                        item.put("title", title);
                        item.put("startMs", startMs);
                        item.put("endMs", endMs);
                        list.put(item);
                        programmes++;
                        matchedChannels.add(channelId);
                    }
                }
                capture = false;
                channelId = "";
            }
            event = parser.next();
        }
        in.close();
        c.disconnect();
        JSONObject out = new JSONObject();
        out.put("channels", channels);
        out.put("matched", matchedChannels.size());
        out.put("programmes", programmes);
        return out.toString();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String platform() { return "android"; }

        @JavascriptInterface
        public String version() { return "0.8.52"; }

        @JavascriptInterface
        public String githubRepository() { return BuildConfig.GITHUB_REPOSITORY == null ? "" : BuildConfig.GITHUB_REPOSITORY; }

        @JavascriptInterface
        public String updateStatus() { return updateManager == null ? "{\"phase\":\"unavailable\"}" : updateManager.statusJson(); }

        @JavascriptInterface
        public String setAutomaticUpdates(boolean enabled) { return updateManager == null ? "{\"phase\":\"unavailable\"}" : updateManager.setAutomaticUpdates(enabled); }

        @JavascriptInterface
        public String checkForUpdate(boolean installIfAvailable) { return updateManager == null ? "{\"phase\":\"unavailable\"}" : updateManager.checkForUpdate(installIfAvailable, true); }

        @JavascriptInterface
        public String installAvailableUpdate() { return updateManager == null ? "{\"phase\":\"unavailable\"}" : updateManager.installAvailableUpdate(true); }

        @JavascriptInterface
        public String openUpdatePermissionSettings() { return updateManager == null ? "{\"phase\":\"unavailable\"}" : updateManager.openInstallPermissionSettings(); }

        @JavascriptInterface
        public String play(String payloadJson) {
            try {
                JSONObject p = new JSONObject(payloadJson == null ? "{}" : payloadJson);
                String url = p.optString("url", "").trim();
                if (url.isEmpty()) return new JSONObject().put("ok", false).put("error", "No stream URL was supplied.").toString();
                String title = p.optString("title", "Swoop TV");
                String kind = p.optString("kind", "video");
                double start = p.optDouble("startSeconds", 0.0);
                return onMain(() -> {
                    startNativePlayer(url, title, kind, start, p.optJSONArray("subtitles"));
                    return new JSONObject().put("ok", true).toString();
                }, "{\"ok\":false,\"error\":\"Could not start playback.\"}");
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":" + JSONObject.quote(e.getMessage() == null ? "Could not start playback." : e.getMessage()) + "}";
            }
        }

        @JavascriptInterface
        public String previewLive(String payloadJson) {
            try {
                JSONObject p = new JSONObject(payloadJson == null ? "{}" : payloadJson);
                String url = p.optString("url", "").trim();
                if (url.isEmpty()) return new JSONObject().put("ok", false).put("error", "No preview URL was supplied.").toString();
                double left = p.optDouble("left", 0.50);
                double top = p.optDouble("top", 0.08);
                double width = p.optDouble("width", 0.46);
                double height = p.optDouble("height", 0.24);
                return onMain(() -> {
                    if (nativePlayerVisible) return new JSONObject().put("ok", false).put("error", "Full playback is active.").toString();
                    startPreviewPlayer(url, left, top, width, height);
                    return new JSONObject().put("ok", true).toString();
                }, "{\"ok\":false}");
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":" + JSONObject.quote(e.getMessage() == null ? "Could not start preview." : e.getMessage()) + "}";
            }
        }

        @JavascriptInterface
        public String stopPreview() {
            return onMain(() -> { stopPreviewPlayer(); return new JSONObject().put("ok", true).toString(); }, "{\"ok\":false}");
        }

        @JavascriptInterface
        public String stop() {
            return onMain(() -> stopNativePlayer(false).toString(), "{\"ok\":false}");
        }

        @JavascriptInterface
        public String diagnostics() {
            return onMain(() -> diagnosticsJson().toString(), "{\"playing\":false}");
        }

        @JavascriptInterface
        public String saveDiagnostics(String payloadJson) {
            return saveDiagnosticsFile(payloadJson).toString();
        }

        @JavascriptInterface
        public String clearDiagnostics() {
            return onMain(() -> {
                rendererGoneCount = 0L;
                lastRendererGoneAt = 0L;
                lastRendererCrashed = false;
                lastRendererPriority = 0;
                nativeKeyEventCount = 0L;
                lastNativeKeyCode = -1;
                lastNativeKeyAt = 0L;
                persistRendererDiagnosticState();
                return new JSONObject().put("ok", true).toString();
            }, "{\"ok\":false}");
        }

        @JavascriptInterface
        public String control(String payloadJson) {
            try {
                JSONObject p = new JSONObject(payloadJson == null ? "{}" : payloadJson);
                String command = p.optString("command", "");
                return onMain(() -> {
                    if (player == null) return "{\"ok\":false,\"error\":\"Player is not active.\"}";
                    if ("toggle-pause".equals(command)) {
                        if (player.isPlaying()) player.pause(); else player.play();
                    } else if ("seek".equals(command)) {
                        double delta = p.optDouble("value", 0.0);
                        player.seekTo(Math.max(0L, player.getCurrentPosition() + Math.round(delta * 1000.0)));
                    } else if ("load-url".equals(command)) {
                        JSONObject value = p.optJSONObject("value");
                        String next = value == null ? "" : value.optString("url", "").trim();
                        if (!next.isEmpty()) {
                            currentTitle = value.optString("title", currentTitle);
                            ended = false;
                            playbackError = "";
                            player.setMediaItem(MediaItem.fromUri(next));
                            player.prepare();
                            player.play();
                        }
                    } else if ("play".equals(command)) {
                        player.play();
                    } else if ("pause".equals(command)) {
                        player.pause();
                    }
                    JSONObject out = new JSONObject();
                    out.put("ok", true);
                    out.put("playback", playbackSnapshot(false));
                    return out.toString();
                }, "{\"ok\":false}");
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":" + JSONObject.quote(e.getMessage() == null ? "Player control failed." : e.getMessage()) + "}";
            }
        }

        @JavascriptInterface
        public String fetchText(String url) {
            try { return fetchTextBlocking(url); }
            catch (Exception e) { return "__SWOOP_NATIVE_ERROR__" + (e.getMessage() == null ? "Could not load provider data." : e.getMessage()); }
        }

        @JavascriptInterface
        public void fetchTextAsync(String requestId, String url) {
            final String id = requestId == null ? "" : requestId.trim();
            final String target = url == null ? "" : url.trim();
            if (id.isEmpty() || target.isEmpty()) return;
            asyncFetchResults.remove(id);
            asyncFetchErrors.remove(id);
            networkExecutor.execute(() -> {
                JSONObject detail = new JSONObject();
                try {
                    String text = fetchTextBlocking(target);
                    asyncFetchResults.put(id, text);
                    detail.put("requestId", id);
                    detail.put("ok", true);
                    detail.put("length", text.length());
                } catch (Exception e) {
                    String message = e.getMessage() == null ? "Could not load provider data." : e.getMessage();
                    asyncFetchErrors.put(id, message);
                    try {
                        detail.put("requestId", id);
                        detail.put("ok", false);
                        detail.put("error", message);
                    } catch (Exception ignored) {}
                }
                emitNativeEvent("swoop-native-fetch", detail);
            });
        }

        @JavascriptInterface
        public void fetchXmltvIndexAsync(String requestId, String url, String wantedJson, long windowStartMs, long windowEndMs) {
            final String id = requestId == null ? "" : requestId.trim();
            final String target = url == null ? "" : url.trim();
            if (id.isEmpty() || target.isEmpty()) return;
            asyncFetchResults.remove(id);
            asyncFetchErrors.remove(id);
            networkExecutor.execute(() -> {
                JSONObject detail = new JSONObject();
                try {
                    String text = fetchXmltvIndexBlocking(target, wantedJson, windowStartMs, windowEndMs);
                    asyncFetchResults.put(id, text);
                    detail.put("requestId", id);
                    detail.put("ok", true);
                    detail.put("length", text.length());
                } catch (Exception e) {
                    String message = e.getMessage() == null ? "Could not load programme guide." : e.getMessage();
                    asyncFetchErrors.put(id, message);
                    try {
                        detail.put("requestId", id);
                        detail.put("ok", false);
                        detail.put("error", message);
                    } catch (Exception ignored) {}
                }
                emitNativeEvent("swoop-native-fetch", detail);
            });
        }

        @JavascriptInterface
        public String fetchTextChunk(String requestId, int offset, int maxChars) {
            String id = requestId == null ? "" : requestId;
            String error = asyncFetchErrors.get(id);
            if (error != null) return "__SWOOP_NATIVE_ERROR__" + error;
            String text = asyncFetchResults.get(id);
            if (text == null) return "";
            int start = Math.max(0, Math.min(offset, text.length()));
            int size = Math.max(1, Math.min(maxChars, 512 * 1024));
            int end = Math.min(text.length(), start + size);
            return text.substring(start, end);
        }

        @JavascriptInterface
        public void releaseFetchText(String requestId) {
            String id = requestId == null ? "" : requestId;
            asyncFetchResults.remove(id);
            asyncFetchErrors.remove(id);
        }
    }

    @Override
    public void onBackPressed() {
        if (nativePlayerVisible) {
            onMain(() -> stopNativePlayer(true).toString(), "{}");
            return;
        }
        webView.evaluateJavascript(
                "window.__swoopHandleAndroidBack ? window.__swoopHandleAndroidBack() : false",
                value -> {
                    if (!"true".equals(value)) MainActivity.super.onBackPressed();
                }
        );
    }

    private boolean isTvSelectKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                || keyCode == KeyEvent.KEYCODE_BUTTON_A;
    }

    private boolean isWebTextInputActive() {
        try {
            if (webView == null || !webView.hasFocus()) return false;
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            return imm != null && imm.isActive(webView) && imm.isAcceptingText();
        } catch (Exception ignored) {
            return false;
        }
    }

    private void activateFocusedWebControl() {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__swoopTvActivateFocused ? window.__swoopTvActivateFocused('native') : (function(){var e=document.activeElement;if(!e||e===document.body)return false;if(typeof e.click==='function'){e.click();return true}return false})()",
                null
        );
    }

    private void beginSelectKey(int keyCode) {
        selectKeyDown = true;
        selectKeyCode = keyCode;
        selectLongPressCandidate = false;
        selectLongPressTriggered = false;
        if (selectLongPressRunnable != null && webView != null) webView.removeCallbacks(selectLongPressRunnable);
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__swoopTvFocusedSupportsLongPress ? window.__swoopTvFocusedSupportsLongPress() : false",
                value -> {
                    boolean supports = "true".equals(value);
                    if (!supports) {
                        activateFocusedWebControl();
                        return;
                    }
                    if (!selectKeyDown || selectKeyCode != keyCode) {
                        // Quick tap: ACTION_UP arrived before the bridge callback.
                        activateFocusedWebControl();
                        return;
                    }
                    selectLongPressCandidate = true;
                    selectLongPressRunnable = () -> {
                        if (!selectKeyDown || !selectLongPressCandidate || selectKeyCode != keyCode) return;
                        selectLongPressTriggered = true;
                        webView.evaluateJavascript(
                                "window.__swoopTvLongPressFocused ? window.__swoopTvLongPressFocused() : false",
                                null
                        );
                    };
                    webView.postDelayed(selectLongPressRunnable, 550L);
                }
        );
    }

    private void endSelectKey(int keyCode) {
        if (selectKeyCode != keyCode) return;
        selectKeyDown = false;
        if (selectLongPressRunnable != null && webView != null) webView.removeCallbacks(selectLongPressRunnable);
        if (selectLongPressCandidate && !selectLongPressTriggered) activateFocusedWebControl();
        selectLongPressCandidate = false;
        selectLongPressTriggered = false;
        selectKeyCode = -1;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            nativeKeyEventCount++;
            lastNativeKeyCode = event.getKeyCode();
            lastNativeKeyAt = System.currentTimeMillis();
        }
        if (nativePlayerVisible && event.getAction() == KeyEvent.ACTION_UP && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            onBackPressed();
            return true;
        }
        if (!nativePlayerVisible && isTvSelectKey(event.getKeyCode()) && !isWebTextInputActive()) {
            // Ordinary controls retain deterministic ACTION_DOWN activation. Continue Watching
            // cards opt into a 550 ms long-press window so OK can expose contextual actions.
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) beginSelectKey(event.getKeyCode());
            else if (event.getAction() == KeyEvent.ACTION_UP) endSelectKey(event.getKeyCode());
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (updateManager != null) updateManager.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null && player.isPlaying()) player.pause();
        if (previewPlayer != null && previewPlayer.isPlaying()) previewPlayer.pause();
    }

    @Override
    protected void onDestroy() {
        stopPreviewPlayer();
        releasePlayerOnly();
        if (updateManager != null) updateManager.shutdown();
        try { networkExecutor.shutdownNow(); } catch (Exception ignored) {}
        asyncFetchResults.clear();
        asyncFetchErrors.clear();
        if (webView != null) {
            webView.removeJavascriptInterface("SwoopAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }
}

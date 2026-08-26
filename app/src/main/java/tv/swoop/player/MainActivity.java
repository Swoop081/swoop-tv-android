package tv.swoop.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.webkit.WebViewAssetLoader;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
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
    private ValueCallback<Uri[]> filePathCallback;
    private WebViewAssetLoader assetLoader;

    private volatile boolean nativePlayerVisible = false;
    private volatile boolean ended = false;
    private volatile String playbackError = "";
    private String currentTitle = "Swoop TV";
    private String currentKind = "video";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        applyImmersive();
        buildUi();
        configureWebView();
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
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

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(false);
        playerView.setKeepScreenOn(true);
        playerView.setVisibility(View.GONE);
        root.addView(playerView, new FrameLayout.LayoutParams(
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
        s.setUserAgentString(s.getUserAgentString() + " SwoopTV/0.8.4 AndroidTV");
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
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
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

    private void startNativePlayer(String url, String title, String kind, double startSeconds) {
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

        MediaItem item = new MediaItem.Builder().setUri(url).setMediaId(currentTitle).build();
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
            out.put("playing", nativePlayerVisible && usable && state != Player.STATE_IDLE);
            out.put("paused", player != null && !player.getPlayWhenReady());
            out.put("ended", ended);
            out.put("error", playbackError);
            out.put("playback", playbackSnapshot(ended));
        } catch (Exception ignored) {}
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

    private String fetchTextBlocking(String urlString) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setConnectTimeout(20_000);
        c.setReadTimeout(60_000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Accept", "*/*");
        c.setRequestProperty("User-Agent", "SwoopTV/0.8.4 AndroidTV");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("Provider returned HTTP " + code);
        InputStream raw = new BufferedInputStream(c.getInputStream());
        InputStream in = "gzip".equalsIgnoreCase(c.getContentEncoding()) ? new GZIPInputStream(raw) : raw;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[32 * 1024];
        int total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > 64 * 1024 * 1024) throw new Exception("Playlist is too large for this test build.");
            out.write(buffer, 0, n);
        }
        in.close();
        c.disconnect();
        return out.toString(StandardCharsets.UTF_8.name());
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String platform() { return "android"; }

        @JavascriptInterface
        public String version() { return "0.8.4"; }

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
                    startNativePlayer(url, title, kind, start);
                    return new JSONObject().put("ok", true).toString();
                }, "{\"ok\":false,\"error\":\"Could not start playback.\"}");
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":" + JSONObject.quote(e.getMessage() == null ? "Could not start playback." : e.getMessage()) + "}";
            }
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

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (nativePlayerVisible && event.getAction() == KeyEvent.ACTION_UP && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            onBackPressed();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null && player.isPlaying()) player.pause();
    }

    @Override
    protected void onDestroy() {
        releasePlayerOnly();
        if (webView != null) {
            webView.removeJavascriptInterface("SwoopAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }
}

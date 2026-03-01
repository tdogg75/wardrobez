/**
 * Image Background Removal Service (#85)
 *
 * Provides background removal for clothing images using a hidden WebView
 * canvas approach. Since we cannot run ML models on-device without a
 * dedicated library, this service uses a practical edge-sampling +
 * flood-fill algorithm:
 *
 * 1. Sample edge pixels (corners + border pixels) to find the dominant
 *    background color.
 * 2. Flood-fill from every edge pixel, making pixels that match the
 *    background color (within a configurable tolerance) transparent.
 * 3. Return the result as a local PNG URI (preserving transparency).
 *
 * Usage:
 *   The caller must render a <BackgroundRemover /> component somewhere
 *   in the tree (it is invisible). Then call `removeImageBackground(uri)`
 *   which communicates with the mounted WebView via a singleton ref.
 */

import React, { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";

// ---------------------------------------------------------------------------
// Singleton bridge: the BackgroundRemover component registers itself here so
// the service function can communicate with the WebView from anywhere.
// ---------------------------------------------------------------------------

type PendingRequest = {
  resolve: (uri: string | null) => void;
  reject: (err: Error) => void;
};

let registeredWebView: WebView | null = null;
let pendingRequest: PendingRequest | null = null;

function registerWebView(ref: WebView | null) {
  registeredWebView = ref;
}

// ---------------------------------------------------------------------------
// HTML / JS injected into the hidden WebView
// ---------------------------------------------------------------------------

const CANVAS_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;overflow:hidden;background:transparent}</style>
</head><body>
<canvas id="c"></canvas>
<script>
/**
 * Remove the background from an image.
 *
 * Algorithm:
 *   1. Draw the image to a canvas.
 *   2. Sample edge pixels (all four borders, 1 px in) to build a
 *      frequency map of colors (quantized to 5-bit per channel).
 *   3. Pick the most common quantized color as "background".
 *   4. Flood-fill from every edge pixel that matches the background
 *      color (within tolerance), setting those pixels to transparent.
 *   5. Return the canvas content as a PNG data URI.
 */

var MAX_DIM = 1024; // limit canvas size for mobile perf

function quantize(r, g, b) {
  // 5-bit per channel -> 15-bit key
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  var dr = r1 - r2;
  var dg = g1 - g2;
  var db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function removeBackground(dataUri, tolerance) {
  tolerance = tolerance || 50;

  var img = new Image();
  img.onload = function () {
    var w = img.width;
    var h = img.height;

    // Down-scale if necessary
    if (w > MAX_DIM || h > MAX_DIM) {
      var scale = MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    var canvas = document.getElementById('c');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;

    // --- Step 1: Sample edge pixels ---
    var freq = {};
    var edgePixels = []; // indices into the flat pixel array (by pixel index, not byte index)

    function samplePixel(px, py) {
      var idx = (py * w + px);
      edgePixels.push(idx);
      var off = idx * 4;
      var q = quantize(data[off], data[off + 1], data[off + 2]);
      freq[q] = (freq[q] || 0) + 1;
    }

    // Top and bottom rows
    for (var x = 0; x < w; x++) {
      samplePixel(x, 0);
      samplePixel(x, h - 1);
    }
    // Left and right columns (skip corners, already sampled)
    for (var y = 1; y < h - 1; y++) {
      samplePixel(0, y);
      samplePixel(w - 1, y);
    }

    // Also sample a few pixels inset by 1-2 px for robustness
    for (var x = 0; x < w; x += 4) {
      if (1 < h - 1) samplePixel(x, 1);
      if (h - 2 > 0) samplePixel(x, h - 2);
    }
    for (var y = 2; y < h - 2; y += 4) {
      if (1 < w) samplePixel(1, y);
      if (w - 2 >= 0) samplePixel(w - 2, y);
    }

    // --- Step 2: Find the dominant edge color ---
    var bestQ = 0;
    var bestCount = 0;
    for (var q in freq) {
      if (freq[q] > bestCount) {
        bestCount = freq[q];
        bestQ = parseInt(q);
      }
    }

    // Decode the quantized color back to approximate RGB
    var bgR = ((bestQ >> 10) & 31) << 3;
    var bgG = ((bestQ >> 5) & 31) << 3;
    var bgB = (bestQ & 31) << 3;

    // --- Step 3: Flood-fill from edge pixels ---
    var visited = new Uint8Array(w * h);
    var stack = [];

    // Seed the flood-fill with all edge pixels that match the bg color
    for (var i = 0; i < edgePixels.length; i++) {
      var idx = edgePixels[i];
      if (visited[idx]) continue;
      var off = idx * 4;
      if (colorDist(data[off], data[off + 1], data[off + 2], bgR, bgG, bgB) <= tolerance) {
        stack.push(idx);
        visited[idx] = 1;
      }
    }

    var dx = [1, -1, 0, 0];
    var dy = [0, 0, 1, -1];

    while (stack.length > 0) {
      var cur = stack.pop();
      var cx = cur % w;
      var cy = (cur - cx) / w;

      // Make this pixel transparent
      var coff = cur * 4;
      data[coff + 3] = 0;

      // Expand to neighbors
      for (var d = 0; d < 4; d++) {
        var nx = cx + dx[d];
        var ny = cy + dy[d];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        var nidx = ny * w + nx;
        if (visited[nidx]) continue;
        visited[nidx] = 1;
        var noff = nidx * 4;
        if (colorDist(data[noff], data[noff + 1], data[noff + 2], bgR, bgG, bgB) <= tolerance) {
          stack.push(nidx);
        }
      }
    }

    // --- Step 4: Write result ---
    ctx.putImageData(imageData, 0, 0);
    var result = canvas.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'result',
      data: result
    }));
  };

  img.onerror = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      message: 'Failed to load image'
    }));
  };

  img.src = dataUri;
}

// Signal that the WebView is ready
window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remove the background from a clothing item image.
 *
 * @param imageUri  Local file URI or remote URL of the source image.
 * @param tolerance Color distance tolerance (0-255 euclidean). Default 50.
 * @returns         Local file URI of the processed PNG, or null on failure.
 */
export async function removeImageBackground(
  imageUri: string,
  tolerance: number = 50,
): Promise<string | null> {
  if (!registeredWebView) {
    console.warn(
      "[backgroundRemoval] No BackgroundRemover component mounted. " +
        "Please render <BackgroundRemover /> in your component tree.",
    );
    return null;
  }

  // Read the image as a base64 data URI
  let dataUri: string;
  try {
    let localUri = imageUri;
    if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
      const tmpFile = `${FileSystem.cacheDirectory}bgrem_tmp_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(imageUri, tmpFile);
      if (dl.status !== 200) return null;
      localUri = dl.uri;
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = localUri.toLowerCase();
    const mime = ext.includes(".png") ? "image/png" : "image/jpeg";
    dataUri = `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }

  // Send the image to the WebView for processing
  return new Promise<string | null>((resolve, reject) => {
    // Clear any stale pending request
    if (pendingRequest) {
      pendingRequest.resolve(null);
    }
    pendingRequest = { resolve, reject };

    const escaped = JSON.stringify(dataUri);
    registeredWebView!.injectJavaScript(
      `removeBackground(${escaped}, ${tolerance}); true;`,
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequest?.resolve === resolve) {
        pendingRequest = null;
        resolve(null);
      }
    }, 30000);
  });
}

// ---------------------------------------------------------------------------
// BackgroundRemover Component
// ---------------------------------------------------------------------------

/**
 * Invisible WebView component that powers background removal.
 * Mount this once in your app (e.g. in the root layout) so that
 * `removeImageBackground()` can function.
 */
export function BackgroundRemover() {
  const webViewRef = useRef<WebView | null>(null);

  const setRef = useCallback((ref: WebView | null) => {
    webViewRef.current = ref;
    registerWebView(ref);
  }, []);

  // Unregister on unmount
  useEffect(() => {
    return () => {
      registerWebView(null);
    };
  }, []);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "ready") {
        // WebView is ready — nothing to do
        return;
      }

      if (msg.type === "result" && msg.data && pendingRequest) {
        const base64 = (msg.data as string).replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const filename = `bg_removed_${Date.now()}.png`;
        const path = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const req = pendingRequest;
        pendingRequest = null;
        req.resolve(path);
        return;
      }

      if (msg.type === "error" && pendingRequest) {
        const req = pendingRequest;
        pendingRequest = null;
        req.resolve(null);
        return;
      }
    } catch {
      if (pendingRequest) {
        const req = pendingRequest;
        pendingRequest = null;
        req.resolve(null);
      }
    }
  }, []);

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={setRef}
        source={{ html: CANVAS_HTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  webview: {
    width: 1,
    height: 1,
  },
});

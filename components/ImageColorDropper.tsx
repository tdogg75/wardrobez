import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Image,
  Modal,
  Pressable,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { Theme } from "@/constants/theme";

const SCREEN = Dimensions.get("window");
const MAGNIFIER_SIZE = 120;
const MAGNIFIER_ZOOM = 2.5;
const CROSSHAIR_SIZE = 36;

interface ImageColorDropperProps {
  imageUri: string;
  onColorPicked: (hex: string) => void;
  visible: boolean;
  onClose: () => void;
}

/**
 * Colour dropper that samples exact pixel colours from an image.
 *
 * Uses a hidden WebView with an HTML5 canvas to decode the image and
 * read pixel data via getImageData(). This gives true pixel-level
 * accuracy for both JPEG and PNG images.
 */
export function ImageColorDropper({
  imageUri,
  onColorPicked,
  visible,
  onClose,
}: ImageColorDropperProps) {
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [dataUri, setDataUri] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Load image as base64 data URI for the canvas
  useEffect(() => {
    if (!imageUri || !visible) {
      setDataUri(null);
      setCanvasReady(false);
      return;
    }

    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Detect format from URI or default to jpeg
        const ext = imageUri.toLowerCase();
        const mime = ext.includes(".png") ? "image/png" : "image/jpeg";
        setDataUri(`data:${mime};base64,${base64}`);
      } catch {
        setDataUri(null);
      }
    })();
  }, [imageUri, visible]);

  // Load natural image size
  useEffect(() => {
    if (imageUri && visible) {
      Image.getSize(
        imageUri,
        (w, h) => setNaturalSize({ w, h }),
        () => setNaturalSize({ w: 0, h: 0 }),
      );
    }
  }, [imageUri, visible]);

  // Compute displayed image size to fit within available area
  const AVAIL_H = SCREEN.height - 260; // header + instruction + preview + actions
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => { if (h > 0) setAspectRatio(w / h); },
        () => setAspectRatio(1),
      );
    }
  }, [imageUri]);

  // Fit image within available space (contain mode)
  let imageWidth = SCREEN.width;
  let imageHeight = imageWidth / aspectRatio;
  if (imageHeight > AVAIL_H) {
    imageHeight = AVAIL_H;
    imageWidth = imageHeight * aspectRatio;
  }

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  }, []);

  // Request pixel colour from the WebView canvas
  const requestPixelColor = useCallback(
    (x: number, y: number) => {
      if (!canvasReady || !webViewRef.current || naturalSize.w === 0) return;

      // Map display coordinates to natural image coordinates
      const nx = Math.round((x / imageLayout.width) * naturalSize.w);
      const ny = Math.round((y / imageLayout.height) * naturalSize.h);

      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            var d = ctx.getImageData(${nx}, ${ny}, 1, 1).data;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pixel',
              r: d[0], g: d[1], b: d[2]
            }));
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error', msg: e.message
            }));
          }
        })();
        true;
      `);
    },
    [canvasReady, naturalSize, imageLayout],
  );

  // Touch handling
  const updatePosition = useCallback(
    (evt: GestureResponderEvent) => {
      const { locationX, locationY } = evt.nativeEvent;
      const x = Math.max(0, Math.min(locationX, imageLayout.width));
      const y = Math.max(0, Math.min(locationY, imageLayout.height));
      setTouchPos({ x, y });
      requestPixelColor(x, y);
    },
    [imageLayout, requestPixelColor],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: () => {},
    }),
  );

  panResponder.current = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => updatePosition(evt),
    onPanResponderMove: (evt) => updatePosition(evt),
  });

  // Handle messages from the WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setCanvasReady(true);
      } else if (data.type === "pixel") {
        const hex = rgbToHex(data.r, data.g, data.b);
        setPickedColor(hex);
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // The HTML that runs inside the hidden WebView
  const canvasHtml = useMemo(() => {
    if (!dataUri) return "";
    return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;overflow:hidden}</style></head><body>
<canvas id="c"></canvas>
<script>
var ctx;
var img = new Image();
img.onload = function() {
  var c = document.getElementById('c');
  c.width = img.width;
  c.height = img.height;
  ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'ready', w: img.width, h: img.height
  }));
};
img.onerror = function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'error', msg: 'Failed to load image'
  }));
};
img.src = ${JSON.stringify(dataUri)};
</script></body></html>`;
  }, [dataUri]);

  // Colour to display (use picked or fallback)
  const displayColor = pickedColor ?? "#808080";

  // Magnifier position
  const magnifierPos = useMemo(() => {
    if (!touchPos) return { left: 0, top: 0 };
    let left = touchPos.x + 20;
    let top = touchPos.y - MAGNIFIER_SIZE - 20;
    if (top < 0) top = touchPos.y + 40;
    if (left + MAGNIFIER_SIZE > imageLayout.width) left = touchPos.x - MAGNIFIER_SIZE - 20;
    left = Math.max(0, Math.min(left, imageLayout.width - MAGNIFIER_SIZE));
    top = Math.max(0, Math.min(top, imageLayout.height - MAGNIFIER_SIZE));
    return { left, top };
  }, [touchPos, imageLayout]);

  const handleSelect = () => {
    onColorPicked(displayColor);
    resetState();
    onClose();
  };

  const handleCancel = () => {
    resetState();
    onClose();
  };

  const resetState = () => {
    setTouchPos(null);
    setPickedColor(null);
    setCanvasReady(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCancel}>
      <View style={styles.root}>
        {/* Hidden WebView that decodes image pixels */}
        {dataUri ? (
          <WebView
            ref={webViewRef}
            source={{ html: canvasHtml }}
            style={styles.hiddenWebView}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            originWhitelist={["*"]}
          />
        ) : null}

        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color={Theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pick Colour from Image</Text>
          <View style={styles.headerBtn} />
        </View>

        <Text style={styles.instruction}>
          {touchPos
            ? "Drag to adjust position, then tap Select"
            : "Tap on the image to place the dropper"}
        </Text>

        {!canvasReady && dataUri && (
          <Text style={styles.loadingNote}>Loading image data...</Text>
        )}

        <View style={styles.imageWrapper}>
          <View
            onLayout={handleImageLayout}
            style={{ width: imageWidth, height: imageHeight }}
            {...panResponder.current.panHandlers}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: imageWidth, height: imageHeight }}
              resizeMode="contain"
            />

            {touchPos && (
              <View
                pointerEvents="none"
                style={[
                  styles.crosshair,
                  {
                    left: touchPos.x - CROSSHAIR_SIZE / 2,
                    top: touchPos.y - CROSSHAIR_SIZE / 2,
                  },
                ]}
              >
                <View style={styles.crosshairRing}>
                  <View style={[styles.crosshairCenter, { backgroundColor: displayColor }]} />
                </View>
                <View style={[styles.crosshairLineH, styles.crosshairLine]} />
                <View style={[styles.crosshairLineV, styles.crosshairLine]} />
              </View>
            )}

            {touchPos && (
              <View
                pointerEvents="none"
                style={[
                  styles.magnifier,
                  { left: magnifierPos.left, top: magnifierPos.top },
                ]}
              >
                <View style={styles.magnifierClip}>
                  <Image
                    source={{ uri: imageUri }}
                    style={{
                      width: imageWidth * MAGNIFIER_ZOOM,
                      height: imageHeight * MAGNIFIER_ZOOM,
                      left: -(touchPos.x * MAGNIFIER_ZOOM - MAGNIFIER_SIZE / 2),
                      top: -(touchPos.y * MAGNIFIER_ZOOM - MAGNIFIER_SIZE / 2),
                    }}
                    resizeMode="contain"
                  />
                  <View style={styles.magnifierCenter} />
                </View>
              </View>
            )}
          </View>
        </View>

        {touchPos && (
          <View style={styles.previewRow}>
            <View style={[styles.swatch, { backgroundColor: displayColor }]}>
              <View style={styles.swatchInnerBorder} />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.hexText}>{displayColor}</Text>
              <Text style={styles.posText}>
                {canvasReady ? "Sampled from image" : "Loading..."}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.selectBtn, !touchPos && styles.selectBtnDisabled]}
            onPress={handleSelect}
            disabled={!touchPos}
          >
            <Ionicons name="color-fill" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.selectBtnText}>Select</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background },
  hiddenWebView: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  headerBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: Theme.fontSize.lg, fontWeight: "700", color: Theme.colors.text },
  instruction: {
    textAlign: "center",
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    paddingVertical: Theme.spacing.sm,
  },
  loadingNote: {
    textAlign: "center",
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    paddingBottom: Theme.spacing.xs,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#000",
  },
  crosshair: {
    position: "absolute",
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  crosshairRing: {
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    borderRadius: CROSSHAIR_SIZE / 2,
    borderWidth: 2,
    borderColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
  },
  crosshairCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  crosshairLine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.7)" },
  crosshairLineH: { width: CROSSHAIR_SIZE + 12, height: 1, left: -6, top: CROSSHAIR_SIZE / 2 },
  crosshairLineV: { width: 1, height: CROSSHAIR_SIZE + 12, top: -6, left: CROSSHAIR_SIZE / 2 },
  magnifier: {
    position: "absolute",
    width: MAGNIFIER_SIZE,
    height: MAGNIFIER_SIZE,
    borderRadius: MAGNIFIER_SIZE / 2,
    borderWidth: 3,
    borderColor: "#FFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  magnifierClip: {
    width: MAGNIFIER_SIZE,
    height: MAGNIFIER_SIZE,
    borderRadius: MAGNIFIER_SIZE / 2,
    overflow: "hidden",
  },
  magnifierCenter: {
    position: "absolute",
    top: MAGNIFIER_SIZE / 2 - 4,
    left: MAGNIFIER_SIZE / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#FFF",
    backgroundColor: "transparent",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  swatchInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  previewInfo: { marginLeft: Theme.spacing.md, flex: 1 },
  hexText: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
    fontVariant: ["tabular-nums"],
  },
  posText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 36,
    gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  selectBtn: {
    flex: 1,
    height: 48,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  selectBtnDisabled: { opacity: 0.45 },
  selectBtnText: { fontSize: Theme.fontSize.md, fontWeight: "600", color: "#FFF" },
});

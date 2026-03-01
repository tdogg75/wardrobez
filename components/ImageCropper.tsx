import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Image,
  Modal,
  Pressable,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/theme";

const SCREEN = Dimensions.get("window");
const HANDLE_SIZE = 28;
const HANDLE_HIT = 40;
const MIN_CROP = 50;
const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 84;
const ESTIMATED_CANVAS_H = SCREEN.height - HEADER_HEIGHT - FOOTER_HEIGHT - 80;

interface ImageCropperProps {
  imageUri: string;
  visible: boolean;
  onCropDone: (croppedUri: string) => void;
  onCancel: () => void;
}

export function ImageCropper({
  imageUri,
  visible,
  onCropDone,
  onCancel,
}: ImageCropperProps) {
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: SCREEN.width, h: ESTIMATED_CANVAS_H });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [applying, setApplying] = useState(false);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Use refs for values accessed by PanResponder to avoid stale closures
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const imgSizeRef = useRef(imgSize);
  imgSizeRef.current = imgSize;

  const dragRef = useRef<{
    mode: "move" | "tl" | "tr" | "bl" | "br";
    startCrop: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Load image data on mount
  useEffect(() => {
    if (!imageUri || !visible) {
      setDataUri(null);
      setNaturalSize({ w: 0, h: 0 });
      setImgSize({ w: 0, h: 0 });
      return;
    }
    Image.getSize(
      imageUri,
      (w, h) => setNaturalSize({ w, h }),
      () => {},
    );
    (async () => {
      try {
        let localUri = imageUri;
        if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
          const tmpFile = `${FileSystem.cacheDirectory}crop_tmp_${Date.now()}.jpg`;
          const dl = await FileSystem.downloadAsync(imageUri, tmpFile);
          if (dl.status !== 200) { setDataUri(null); return; }
          localUri = dl.uri;
        }
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ext = localUri.toLowerCase();
        const mime = ext.includes(".png") ? "image/png" : "image/jpeg";
        setDataUri(`data:${mime};base64,${base64}`);
      } catch {
        setDataUri(null);
      }
    })();
  }, [imageUri, visible]);

  // When canvas area size or natural size change, compute image display size and init crop
  useEffect(() => {
    if (naturalSize.w === 0 || naturalSize.h === 0) return;
    if (canvasSize.w === 0 || canvasSize.h === 0) return;

    const ar = naturalSize.w / naturalSize.h;
    let dw = canvasSize.w;
    let dh = dw / ar;
    if (dh > canvasSize.h) {
      dh = canvasSize.h;
      dw = dh * ar;
    }
    setImgSize({ w: dw, h: dh });

    const margin = Math.min(dw, dh) * 0.08;
    setCrop({
      x: margin,
      y: margin,
      w: dw - margin * 2,
      h: dh - margin * 2,
    });
  }, [naturalSize, canvasSize]);

  const handleCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ w: width, h: height });
    }
  }, []);

  // Stable PanResponder created once — reads from refs to avoid stale closures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const c = cropRef.current;

          // Hit-test using ref values
          const inHandle = (hx: number, hy: number) =>
            Math.abs(locationX - hx) < HANDLE_HIT && Math.abs(locationY - hy) < HANDLE_HIT;

          let mode: "move" | "tl" | "tr" | "bl" | "br" | null = null;
          if (inHandle(c.x, c.y)) mode = "tl";
          else if (inHandle(c.x + c.w, c.y)) mode = "tr";
          else if (inHandle(c.x, c.y + c.h)) mode = "bl";
          else if (inHandle(c.x + c.w, c.y + c.h)) mode = "br";
          else if (
            locationX >= c.x &&
            locationX <= c.x + c.w &&
            locationY >= c.y &&
            locationY <= c.y + c.h
          )
            mode = "move";

          if (mode) {
            dragRef.current = { mode, startCrop: { ...c } };
          }
        },
        onPanResponderMove: (_, gs: PanResponderGestureState) => {
          if (!dragRef.current) return;
          const { mode, startCrop } = dragRef.current;
          const { dx, dy } = gs;
          const iSz = imgSizeRef.current;

          if (mode === "move") {
            let nx = startCrop.x + dx;
            let ny = startCrop.y + dy;
            nx = Math.max(0, Math.min(nx, iSz.w - startCrop.w));
            ny = Math.max(0, Math.min(ny, iSz.h - startCrop.h));
            setCrop({ ...startCrop, x: nx, y: ny });
          } else {
            let { x, y, w, h } = startCrop;
            if (mode === "tl") {
              x += dx; y += dy; w -= dx; h -= dy;
            } else if (mode === "tr") {
              y += dy; w += dx; h -= dy;
            } else if (mode === "bl") {
              x += dx; w -= dx; h += dy;
            } else if (mode === "br") {
              w += dx; h += dy;
            }
            // Enforce minimum crop size
            if (w < MIN_CROP) {
              if (mode === "tl" || mode === "bl") {
                x = startCrop.x + startCrop.w - MIN_CROP;
              }
              w = MIN_CROP;
            }
            if (h < MIN_CROP) {
              if (mode === "tl" || mode === "tr") {
                y = startCrop.y + startCrop.h - MIN_CROP;
              }
              h = MIN_CROP;
            }
            // Clamp to image bounds
            if (x < 0) { w += x; x = 0; }
            if (y < 0) { h += y; y = 0; }
            if (x + w > iSz.w) w = iSz.w - x;
            if (y + h > iSz.h) h = iSz.h - y;
            // Final min check after clamping
            if (w < MIN_CROP) w = MIN_CROP;
            if (h < MIN_CROP) h = MIN_CROP;
            setCrop({ x, y, w, h });
          }
        },
        onPanResponderRelease: () => {
          dragRef.current = null;
        },
      }),
    [],
  );

  // Canvas HTML for cropping
  const canvasHtml = useMemo(() => {
    if (!dataUri) return "";
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;overflow:hidden}</style></head><body>
<canvas id="c"></canvas>
<script>
var img = new Image();
img.onload = function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
};
img.src = ${JSON.stringify(dataUri)};

function cropImage(sx,sy,sw,sh) {
  var c = document.getElementById('c');
  c.width = sw;
  c.height = sh;
  var ctx = c.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  var result = c.toDataURL('image/jpeg', 0.9);
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type:'cropped', data: result
  }));
}
</script></body></html>`;
  }, [dataUri]);

  const handleWebViewMessage = useCallback(
    async (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "cropped" && data.data) {
          const base64 = data.data.replace(/^data:image\/\w+;base64,/, "");
          const filename = `cropped_${Date.now()}.jpg`;
          const path = `${FileSystem.documentDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setApplying(false);
          onCropDone(path);
        }
      } catch {
        setApplying(false);
      }
    },
    [onCropDone],
  );

  const handleApply = useCallback(() => {
    if (!webViewRef.current || naturalSize.w === 0 || imgSize.w === 0) return;
    setApplying(true);

    const scaleX = naturalSize.w / imgSize.w;
    const scaleY = naturalSize.h / imgSize.h;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);

    webViewRef.current.injectJavaScript(`cropImage(${sx},${sy},${sw},${sh}); true;`);
  }, [crop, imgSize, naturalSize]);

  const Handle = ({ left, top }: { left: number; top: number }) => (
    <View
      pointerEvents="none"
      style={[
        styles.handle,
        { left: left - HANDLE_SIZE / 2, top: top - HANDLE_SIZE / 2 },
      ]}
    />
  );

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        {dataUri ? (
          <WebView
            ref={webViewRef}
            source={{ html: canvasHtml }}
            style={styles.hidden}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            originWhitelist={["*"]}
          />
        ) : null}

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Crop Image</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Image + crop overlay — flex:1 container measured via onLayout */}
        <View style={styles.canvas} onLayout={handleCanvasLayout}>
          {imgSize.w > 0 && imgSize.h > 0 && (
            <View style={{ width: imgSize.w, height: imgSize.h }}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: imgSize.w, height: imgSize.h }}
                resizeMode="cover"
              />

              {/* Dark overlay with cutout */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.dim, { top: 0, left: 0, right: 0, height: crop.y }]} />
                <View style={[styles.dim, { top: crop.y + crop.h, left: 0, right: 0, bottom: 0 }]} />
                <View style={[styles.dim, { top: crop.y, left: 0, width: crop.x, height: crop.h }]} />
                <View style={[styles.dim, { top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h }]} />
              </View>

              {/* Crop border + grid lines */}
              <View
                pointerEvents="none"
                style={[
                  styles.cropBorder,
                  { left: crop.x, top: crop.y, width: crop.w, height: crop.h },
                ]}
              >
                {/* Rule of thirds grid */}
                <View style={[styles.gridLineH, { top: "33.3%" }]} />
                <View style={[styles.gridLineH, { top: "66.6%" }]} />
                <View style={[styles.gridLineV, { left: "33.3%" }]} />
                <View style={[styles.gridLineV, { left: "66.6%" }]} />
              </View>

              {/* Corner handles */}
              <Handle left={crop.x} top={crop.y} />
              <Handle left={crop.x + crop.w} top={crop.y} />
              <Handle left={crop.x} top={crop.y + crop.h} />
              <Handle left={crop.x + crop.w} top={crop.y + crop.h} />

              {/* Pan responder overlay */}
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.applyBtn, applying && { opacity: 0.5 }]}
            onPress={handleApply}
            disabled={applying}
          >
            <Ionicons name="checkmark" size={20} color="#FFF" />
            <Text style={styles.applyText}>
              {applying ? "Cropping..." : "Apply Crop"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: Theme.spacing.md,
    height: HEADER_HEIGHT + 50,
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: "#FFF",
  },
  canvas: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginHorizontal: 4,
  },
  dim: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cropBorder: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 36,
    gap: Theme.spacing.md,
    height: FOOTER_HEIGHT + 36,
    alignItems: "flex-start",
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: "#FFF",
  },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  applyText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: "#FFF",
  },
});

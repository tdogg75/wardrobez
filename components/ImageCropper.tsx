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
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/theme";

const SCREEN = Dimensions.get("window");
const HANDLE_SIZE = 28;
const HANDLE_HIT = 36;
const MIN_CROP = 60;
const HEADER_H = 90;
const FOOTER_H = 110;
const AVAIL_H = SCREEN.height - HEADER_H - FOOTER_H;

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
  const [imgRect, setImgRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [applying, setApplying] = useState(false);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const dragRef = useRef<{
    mode: "move" | "tl" | "tr" | "bl" | "br";
    startCrop: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Load image data
  useEffect(() => {
    if (!imageUri || !visible) {
      setDataUri(null);
      return;
    }
    Image.getSize(
      imageUri,
      (w, h) => {
        setNaturalSize({ w, h });
        const ar = w / h;
        let dw = SCREEN.width;
        let dh = dw / ar;
        if (dh > AVAIL_H) {
          dh = AVAIL_H;
          dw = dh * ar;
        }
        const dx = (SCREEN.width - dw) / 2;
        const dy = (AVAIL_H - dh) / 2;
        setImgRect({ x: dx, y: dy, w: dw, h: dh });

        const margin = dw * 0.08;
        setCrop({
          x: margin,
          y: margin,
          w: dw - margin * 2,
          h: dh - margin * 2,
        });
      },
      () => {},
    );

    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ext = imageUri.toLowerCase();
        const mime = ext.includes(".png") ? "image/png" : "image/jpeg";
        setDataUri(`data:${mime};base64,${base64}`);
      } catch {
        setDataUri(null);
      }
    })();
  }, [imageUri, visible]);

  // Determine which element was touched
  const hitTest = useCallback(
    (px: number, py: number) => {
      const inHandle = (hx: number, hy: number) =>
        Math.abs(px - hx) < HANDLE_HIT && Math.abs(py - hy) < HANDLE_HIT;
      if (inHandle(crop.x, crop.y)) return "tl" as const;
      if (inHandle(crop.x + crop.w, crop.y)) return "tr" as const;
      if (inHandle(crop.x, crop.y + crop.h)) return "bl" as const;
      if (inHandle(crop.x + crop.w, crop.y + crop.h)) return "br" as const;
      if (
        px >= crop.x &&
        px <= crop.x + crop.w &&
        py >= crop.y &&
        py <= crop.y + crop.h
      )
        return "move" as const;
      return null;
    },
    [crop],
  );

  // PanResponder for crop interaction
  const panResponder = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => false }));

  panResponder.current = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const mode = hitTest(locationX, locationY);
      if (mode) {
        dragRef.current = { mode, startCrop: { ...crop } };
      }
    },
    onPanResponderMove: (_, gs: PanResponderGestureState) => {
      if (!dragRef.current) return;
      const { mode, startCrop } = dragRef.current;
      const { dx, dy } = gs;

      if (mode === "move") {
        let nx = startCrop.x + dx;
        let ny = startCrop.y + dy;
        nx = Math.max(0, Math.min(nx, imgRect.w - startCrop.w));
        ny = Math.max(0, Math.min(ny, imgRect.h - startCrop.h));
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
        // Enforce minimums
        if (w < MIN_CROP) { w = MIN_CROP; x = startCrop.x + startCrop.w - MIN_CROP; }
        if (h < MIN_CROP) { h = MIN_CROP; y = startCrop.y + startCrop.h - MIN_CROP; }
        // Clamp to image bounds
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > imgRect.w) w = imgRect.w - x;
        if (y + h > imgRect.h) h = imgRect.h - y;
        setCrop({ x, y, w, h });
      }
    },
    onPanResponderRelease: () => {
      dragRef.current = null;
    },
  });

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
    if (!webViewRef.current || naturalSize.w === 0 || imgRect.w === 0) return;
    setApplying(true);

    // Map display crop to natural image coordinates
    const scaleX = naturalSize.w / imgRect.w;
    const scaleY = naturalSize.h / imgRect.h;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);

    webViewRef.current.injectJavaScript(`cropImage(${sx},${sy},${sw},${sh}); true;`);
  }, [crop, imgRect, naturalSize]);

  // Corner handle component
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
        {/* Hidden WebView for canvas crop */}
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

        {/* Image + crop overlay */}
        <View style={styles.canvas}>
          <View
            style={{
              marginLeft: imgRect.x,
              marginTop: imgRect.y,
              width: imgRect.w,
              height: imgRect.h,
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: imgRect.w, height: imgRect.h }}
              resizeMode="cover"
            />

            {/* Dark overlay with cutout */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Top */}
              <View style={[styles.dim, { top: 0, left: 0, right: 0, height: crop.y }]} />
              {/* Bottom */}
              <View style={[styles.dim, { top: crop.y + crop.h, left: 0, right: 0, bottom: 0 }]} />
              {/* Left */}
              <View style={[styles.dim, { top: crop.y, left: 0, width: crop.x, height: crop.h }]} />
              {/* Right */}
              <View style={[styles.dim, { top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h }]} />
            </View>

            {/* Crop border */}
            <View
              pointerEvents="none"
              style={[
                styles.cropBorder,
                { left: crop.x, top: crop.y, width: crop.w, height: crop.h },
              ]}
            />

            {/* Corner handles */}
            <Handle left={crop.x} top={crop.y} />
            <Handle left={crop.x + crop.w} top={crop.y} />
            <Handle left={crop.x} top={crop.y + crop.h} />
            <Handle left={crop.x + crop.w} top={crop.y + crop.h} />

            {/* Pan responder overlay */}
            <View style={StyleSheet.absoluteFill} {...panResponder.current.panHandlers} />
          </View>
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
    height: HEADER_H,
    paddingTop: 44,
    paddingHorizontal: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: "#FFF",
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
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
    height: FOOTER_H,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 36,
    gap: Theme.spacing.md,
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

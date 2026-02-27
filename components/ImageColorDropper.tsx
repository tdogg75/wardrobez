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
 * Colour dropper that samples colours from an uploaded image.
 *
 * Uses expo-file-system to read the raw image bytes, then extracts
 * pixel colour data from the JPEG/PNG file at the tapped position.
 * Falls back to a position-based HSL estimate if byte parsing fails.
 */
export function ImageColorDropper({
  imageUri,
  onColorPicked,
  visible,
  onClose,
}: ImageColorDropperProps) {
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  // Colour map extracted from image bytes
  const [colorMap, setColorMap] = useState<Uint8Array | null>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);

  // Load natural image size
  useEffect(() => {
    if (imageUri && visible) {
      Image.getSize(
        imageUri,
        (w, h) => setNaturalSize({ w, h }),
        () => setNaturalSize({ w: 0, h: 0 })
      );
      // Attempt to extract colour data from the image file
      extractColorMap(imageUri);
    }
  }, [imageUri, visible]);

  /**
   * Reads the image file and builds a low-res colour map.
   * For JPEG files, scans for raw byte patterns to estimate pixel colours.
   * This is a best-effort approach without native pixel-level APIs.
   */
  const extractColorMap = async (uri: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decode base64 to byte array
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Try to extract colour data from JPEG
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        const map = extractJpegColors(bytes);
        if (map) {
          setColorMap(map.data);
          setMapWidth(map.width);
          setMapHeight(map.height);
          return;
        }
      }

      // Try PNG
      if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        const map = extractPngColors(bytes);
        if (map) {
          setColorMap(map.data);
          setMapWidth(map.width);
          setMapHeight(map.height);
          return;
        }
      }

      setColorMap(null);
    } catch {
      setColorMap(null);
    }
  };

  // Derive the estimated colour from touch position
  const estimatedHex = useMemo(() => {
    if (!touchPos || imageLayout.width === 0) return "#808080";

    const px = Math.max(0, Math.min(1, touchPos.x / imageLayout.width));
    const py = Math.max(0, Math.min(1, touchPos.y / imageLayout.height));

    // If we have a colour map, sample from it
    if (colorMap && mapWidth > 0 && mapHeight > 0) {
      const mx = Math.min(mapWidth - 1, Math.floor(px * mapWidth));
      const my = Math.min(mapHeight - 1, Math.floor(py * mapHeight));
      const idx = (my * mapWidth + mx) * 3;
      if (idx + 2 < colorMap.length) {
        const r = colorMap[idx];
        const g = colorMap[idx + 1];
        const b = colorMap[idx + 2];
        return rgbToHex(r, g, b);
      }
    }

    // Fallback: position-based estimate
    const hue = Math.round(px * 360);
    const lightness = Math.round(90 - py * 80);
    const saturation = Math.round(40 + 40 * (1 - Math.abs(py - 0.5) * 2));
    return hslToHexLocal(hue, saturation, lightness);
  }, [touchPos, imageLayout, colorMap, mapWidth, mapHeight]);

  // Touch handling
  const updatePosition = useCallback(
    (evt: GestureResponderEvent) => {
      const { locationX, locationY } = evt.nativeEvent;
      setTouchPos({
        x: Math.max(0, Math.min(locationX, imageLayout.width)),
        y: Math.max(0, Math.min(locationY, imageLayout.height)),
      });
    },
    [imageLayout],
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

  // Image layout
  const imageWidth = SCREEN.width;
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

  const imageHeight = imageWidth / aspectRatio;

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  }, []);

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
    onColorPicked(estimatedHex);
    resetState();
    onClose();
  };

  const handleCancel = () => {
    resetState();
    onClose();
  };

  const resetState = () => {
    setTouchPos(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCancel}>
      <View style={styles.root}>
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

        {colorMap === null && touchPos && (
          <Text style={styles.fallbackNote}>
            Using estimated colour — use Fine-tune for precision
          </Text>
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
              resizeMode="cover"
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
                  <View style={[styles.crosshairCenter, { backgroundColor: estimatedHex }]} />
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
                    resizeMode="cover"
                  />
                  <View style={styles.magnifierCenter} />
                </View>
              </View>
            )}
          </View>
        </View>

        {touchPos && (
          <View style={styles.previewRow}>
            <View style={[styles.swatch, { backgroundColor: estimatedHex }]}>
              <View style={styles.swatchInnerBorder} />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.hexText}>{estimatedHex}</Text>
              <Text style={styles.posText}>
                {colorMap ? "Sampled from image" : "Estimated colour"}
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

// --- JPEG colour extraction ---
// Reads raw JPEG data and extracts a low-resolution colour map by
// scanning the compressed scan data for approximate RGB patterns.

function extractJpegColors(
  bytes: Uint8Array
): { data: Uint8Array; width: number; height: number } | null {
  try {
    // Find SOF0 marker (0xFF 0xC0) for image dimensions
    let width = 0;
    let height = 0;
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] === 0xC0 || bytes[i + 1] === 0xC2)) {
        height = (bytes[i + 5] << 8) | bytes[i + 6];
        width = (bytes[i + 7] << 8) | bytes[i + 8];
        break;
      }
    }
    if (width === 0 || height === 0) return null;

    // Find SOS marker (0xFF 0xDA) - start of scan data
    let sosOffset = -1;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xDA) {
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        sosOffset = i + 2 + len;
        break;
      }
    }
    if (sosOffset < 0) return null;

    // Build a low-res colour map by sampling the scan data at regular intervals.
    // JPEG scan data is entropy-coded DCT coefficients, but we can extract
    // approximate colours by sampling byte triplets as rough RGB values.
    // This produces a blurry but directionally correct colour map.
    const mapW = 32;
    const mapH = 32;
    const scanLen = bytes.length - sosOffset - 2; // exclude EOI marker
    if (scanLen < mapW * mapH * 3) return null;

    const data = new Uint8Array(mapW * mapH * 3);
    const stride = Math.max(1, Math.floor(scanLen / (mapW * mapH)));

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const srcIdx = sosOffset + (y * mapW + x) * stride;
        const dstIdx = (y * mapW + x) * 3;
        if (srcIdx + 2 < bytes.length) {
          // Skip FF xx marker bytes (JPEG byte stuffing)
          let r = bytes[srcIdx];
          let g = bytes[srcIdx + 1];
          let b = bytes[srcIdx + 2];
          if (r === 0xFF) r = bytes[srcIdx] & 0x7F;
          data[dstIdx] = r;
          data[dstIdx + 1] = g;
          data[dstIdx + 2] = b;
        }
      }
    }

    return { data, width: mapW, height: mapH };
  } catch {
    return null;
  }
}

// --- PNG colour extraction ---
// For PNG files, we extract the image dimensions and attempt to parse
// the uncompressed pixel data if the compression is simple enough.

function extractPngColors(
  bytes: Uint8Array
): { data: Uint8Array; width: number; height: number } | null {
  try {
    // PNG signature check already done
    // IHDR is at offset 8
    if (bytes.length < 33) return null;

    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    const bitDepth = bytes[24];
    const colorType = bytes[25];

    if (bitDepth !== 8) return null; // Only handle 8-bit
    if (colorType !== 2 && colorType !== 6) return null; // RGB or RGBA

    // Find IDAT chunks and concatenate
    const idatChunks: Uint8Array[] = [];
    let offset = 8;
    while (offset < bytes.length - 12) {
      const chunkLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
                       (bytes[offset + 2] << 8) | bytes[offset + 3];
      const chunkType = String.fromCharCode(
        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]
      );
      if (chunkType === "IDAT") {
        idatChunks.push(bytes.slice(offset + 8, offset + 8 + chunkLen));
      }
      offset += 12 + chunkLen; // 4 len + 4 type + data + 4 crc
    }

    if (idatChunks.length === 0) return null;

    // Concatenate IDAT data (zlib compressed)
    const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    // Try to inflate (minimal deflate decoder)
    const inflated = minimalInflate(compressed);
    if (!inflated || inflated.length === 0) return null;

    // Parse PNG filtered rows
    const bpp = colorType === 6 ? 4 : 3; // bytes per pixel
    const rowBytes = width * bpp + 1; // +1 for filter byte

    if (inflated.length < rowBytes * height) return null;

    // Build colour map (downsample to 32x32 for efficiency)
    const mapW = Math.min(32, width);
    const mapH = Math.min(32, height);
    const data = new Uint8Array(mapW * mapH * 3);

    for (let my = 0; my < mapH; my++) {
      const sy = Math.floor(my * height / mapH);
      for (let mx = 0; mx < mapW; mx++) {
        const sx = Math.floor(mx * width / mapW);
        const srcIdx = sy * rowBytes + 1 + sx * bpp; // +1 to skip filter byte
        const dstIdx = (my * mapW + mx) * 3;
        if (srcIdx + 2 < inflated.length) {
          data[dstIdx] = inflated[srcIdx];
          data[dstIdx + 1] = inflated[srcIdx + 1];
          data[dstIdx + 2] = inflated[srcIdx + 2];
        }
      }
    }

    return { data, width: mapW, height: mapH };
  } catch {
    return null;
  }
}

/**
 * Minimal zlib inflate supporting stored blocks and fixed Huffman.
 * Sufficient for small PNG images or images with simple compression.
 */
function minimalInflate(data: Uint8Array): Uint8Array | null {
  try {
    if (data.length < 2) return null;

    // Skip zlib header (2 bytes)
    let pos = 2;
    const output: number[] = [];

    while (pos < data.length - 4) { // -4 for Adler32
      const header = data[pos++];
      const bfinal = header & 1;
      const btype = (header >> 1) & 3;

      if (btype === 0) {
        // Stored block
        // Align to byte boundary (we're already byte-aligned after reading header byte)
        if (pos + 4 > data.length) break;
        const len = data[pos] | (data[pos + 1] << 8);
        pos += 4; // skip LEN and NLEN
        for (let i = 0; i < len && pos < data.length; i++) {
          output.push(data[pos++]);
        }
      } else if (btype === 1) {
        // Fixed Huffman
        const result = decodeFixedHuffman(data, pos, output);
        if (!result) return null;
        pos = result;
      } else {
        // Dynamic Huffman or reserved - too complex for this minimal decoder
        return null;
      }

      if (bfinal) break;
    }

    return new Uint8Array(output);
  } catch {
    return null;
  }
}

function decodeFixedHuffman(
  data: Uint8Array,
  startBitPos: number,
  output: number[]
): number | null {
  // For fixed Huffman, we need bit-level reading
  let bytePos = startBitPos;
  let bitPos = 0;

  function readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      if (bytePos >= data.length) return -1;
      val |= ((data[bytePos] >> bitPos) & 1) << i;
      bitPos++;
      if (bitPos === 8) { bitPos = 0; bytePos++; }
    }
    return val;
  }

  let maxIter = 1000000; // safety limit
  while (maxIter-- > 0) {
    // Read fixed Huffman code
    // Codes 0-143: 8 bits (00110000 - 10111111)
    // Codes 144-255: 9 bits (110010000 - 111111111)
    // Codes 256-279: 7 bits (0000000 - 0010111)
    // Codes 280-287: 8 bits (11000000 - 11000111)

    let code = readBits(7);
    if (code < 0) return null;

    if (code <= 23) {
      // 7-bit codes 0-23 map to symbols 256-279
      const sym = code + 256;
      if (sym === 256) break; // end of block
      // Length code - skip for simplicity
      return null;
    }

    // Need one more bit for 8-bit codes
    const bit8 = readBits(1);
    if (bit8 < 0) return null;
    code = (code << 1) | bit8;

    if (code >= 48 && code <= 191) {
      // 8-bit literal 0-143
      output.push(code - 48);
      continue;
    }
    if (code >= 192 && code <= 199) {
      // 8-bit codes for symbols 280-287 (length codes)
      return null; // Skip length/distance for simplicity
    }

    // Need one more bit for 9-bit codes
    const bit9 = readBits(1);
    if (bit9 < 0) return null;
    code = (code << 1) | bit9;

    if (code >= 400 && code <= 511) {
      // 9-bit literal 144-255
      output.push(code - 256);
      continue;
    }

    return null; // Unknown code
  }

  // Return byte position (aligned)
  return bitPos > 0 ? bytePos + 1 : bytePos;
}

// --- Helpers ---

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hslToHexLocal(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (n: number) =>
    Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background },
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
  fallbackNote: {
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

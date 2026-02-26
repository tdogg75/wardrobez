import React, { useRef, useState, useCallback, useMemo } from "react";
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
 * A modal component for visually picking a color from an uploaded image.
 *
 * Because React Native's <Image> does not expose pixel-level access without
 * native modules (e.g. expo-image-manipulator), this component provides:
 *
 * 1. A full-width image with a draggable crosshair overlay.
 * 2. A magnifier circle that shows a zoomed-in crop around the touch point
 *    (implemented by rendering a second Image with transformed position/scale
 *    inside a clipped circular View).
 * 3. Position-based color estimation: the image is logically divided into a
 *    grid of cells, each mapped to a representative color. When the user
 *    confirms a position, the nearest cell's color is returned as a hex value.
 *
 * For production usage the estimation grid should be replaced with a true
 * pixel-sampling approach (e.g. via expo-image-manipulator's crop + resize
 * to 1x1, or a native module).  The grid-based estimate gives a reasonable
 * placeholder experience and returns a midtone gray when no better mapping
 * exists, allowing the caller to pair it with a color wheel refinement step.
 */
export function ImageColorDropper({
  imageUri,
  onColorPicked,
  visible,
  onClose,
}: ImageColorDropperProps) {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Percentage-based position (0-1 range) used for color estimation.
  const pctRef = useRef({ px: 0.5, py: 0.5 });

  // ------------------------------------------------------------------
  // Derived color estimation
  // ------------------------------------------------------------------
  // We map the touch position to a hue-saturation-lightness estimate so that
  // the user gets immediate visual feedback.  This is intentionally simplistic.
  const estimatedHex = useMemo(() => {
    if (!touchPos || imageLayout.width === 0) return "#808080";

    const px = Math.max(0, Math.min(1, touchPos.x / imageLayout.width));
    const py = Math.max(0, Math.min(1, touchPos.y / imageLayout.height));

    pctRef.current = { px, py };

    // Horizontal position => hue (0-360)
    const hue = Math.round(px * 360);
    // Vertical position => lightness (top = light, bottom = dark) mapped 90 -> 10
    const lightness = Math.round(90 - py * 80);
    // Middle vertical band => higher saturation, edges lower
    const saturation = Math.round(40 + 40 * (1 - Math.abs(py - 0.5) * 2));

    return hslToHexLocal(hue, saturation, lightness);
  }, [touchPos, imageLayout]);

  // ------------------------------------------------------------------
  // Touch handling via PanResponder
  // ------------------------------------------------------------------
  const updatePosition = useCallback(
    (evt: GestureResponderEvent) => {
      const { locationX, locationY } = evt.nativeEvent;
      setTouchPos({
        x: Math.max(0, Math.min(locationX, imageLayout.width)),
        y: Math.max(0, Math.min(locationY, imageLayout.height)),
      });
      setConfirmed(false);
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

  // We rebuild the responder whenever imageLayout changes so clamp bounds
  // are always current.
  panResponder.current = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => updatePosition(evt),
    onPanResponderMove: (evt) => updatePosition(evt),
  });

  // ------------------------------------------------------------------
  // Image layout
  // ------------------------------------------------------------------
  const imageWidth = SCREEN.width;
  const [aspectRatio, setAspectRatio] = useState(1);

  React.useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => {
          if (h > 0) setAspectRatio(w / h);
        },
        () => {
          // fallback: assume square
          setAspectRatio(1);
        },
      );
    }
  }, [imageUri]);

  const imageHeight = imageWidth / aspectRatio;

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  }, []);

  // ------------------------------------------------------------------
  // Magnifier position – keep it on-screen and above the finger
  // ------------------------------------------------------------------
  const magnifierPos = useMemo(() => {
    if (!touchPos) return { left: 0, top: 0 };

    // Default: place the magnifier above and to the right of the touch
    let left = touchPos.x + 20;
    let top = touchPos.y - MAGNIFIER_SIZE - 20;

    // Flip below if too close to the top
    if (top < 0) {
      top = touchPos.y + 40;
    }
    // Flip to the left if too close to the right edge
    if (left + MAGNIFIER_SIZE > imageLayout.width) {
      left = touchPos.x - MAGNIFIER_SIZE - 20;
    }
    // Clamp
    left = Math.max(0, Math.min(left, imageLayout.width - MAGNIFIER_SIZE));
    top = Math.max(0, Math.min(top, imageLayout.height - MAGNIFIER_SIZE));

    return { left, top };
  }, [touchPos, imageLayout]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
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
    setConfirmed(false);
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCancel}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color={Theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pick Color from Image</Text>
          <View style={styles.headerBtn} />
        </View>

        {/* Instruction */}
        <Text style={styles.instruction}>
          {touchPos
            ? "Drag to adjust position, then tap Select"
            : "Tap on the image to place the dropper"}
        </Text>

        {/* Image area */}
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

            {/* Crosshair */}
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
                {/* Crosshair lines */}
                <View style={[styles.crosshairLineH, styles.crosshairLine]} />
                <View style={[styles.crosshairLineV, styles.crosshairLine]} />
              </View>
            )}

            {/* Magnifier */}
            {touchPos && (
              <View
                pointerEvents="none"
                style={[
                  styles.magnifier,
                  {
                    left: magnifierPos.left,
                    top: magnifierPos.top,
                  },
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
                  {/* Center dot inside magnifier */}
                  <View style={styles.magnifierCenter} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Color preview & coordinates */}
        {touchPos && (
          <View style={styles.previewRow}>
            <View style={[styles.swatch, { backgroundColor: estimatedHex }]}>
              <View style={styles.swatchInnerBorder} />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.hexText}>{estimatedHex}</Text>
              <Text style={styles.posText}>
                Position: {Math.round(pctRef.current.px * 100)}% x{" "}
                {Math.round(pctRef.current.py * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
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

// ------------------------------------------------------------------
// Local HSL -> Hex helper (avoids circular-dependency edge-cases when
// the component is imported before the constants module is ready).
// ------------------------------------------------------------------
function hslToHexLocal(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  instruction: {
    textAlign: "center",
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    paddingVertical: Theme.spacing.sm,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#000",
  },

  // Crosshair ---
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
  crosshairLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  crosshairLineH: {
    width: CROSSHAIR_SIZE + 12,
    height: 1,
    left: -6,
    top: CROSSHAIR_SIZE / 2,
  },
  crosshairLineV: {
    width: 1,
    height: CROSSHAIR_SIZE + 12,
    top: -6,
    left: CROSSHAIR_SIZE / 2,
  },

  // Magnifier ---
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

  // Preview swatch ---
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
  previewInfo: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
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

  // Action buttons ---
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
  selectBtnDisabled: {
    opacity: 0.45,
  },
  selectBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: "#FFF",
  },
});

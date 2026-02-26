import React, { useCallback, useRef } from "react";
import { View, StyleSheet, PanResponder, Dimensions } from "react-native";
import { hslToHex } from "@/constants/colors";

interface Props {
  hue: number;
  saturation: number;
  lightness: number;
  size: number;
  onColorChange: (h: number, s: number, l: number) => void;
}

/**
 * A simple color wheel rendered with concentric rings of hue segments.
 * The user taps/drags on the wheel to pick a hue and saturation.
 * Lightness is controlled separately via sliders.
 */
export function ColorWheelPicker({ hue, saturation, lightness, size, onColorChange }: Props) {
  const center = size / 2;
  const radius = size / 2 - 4;

  const computeFromXY = useCallback(
    (x: number, y: number) => {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius + 10) return; // too far out

      // Angle → hue (0-360)
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      const h = Math.round(angle);

      // Distance from center → saturation (0-100)
      const s = Math.round(Math.min(100, (dist / radius) * 100));

      onColorChange(h, s, lightness);
    },
    [center, radius, lightness, onColorChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        computeFromXY(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        computeFromXY(locationX, locationY);
      },
    })
  ).current;

  // Render the color wheel as concentric rings of colored segments
  const rings: React.ReactElement[] = [];
  const segmentCount = 72; // 5-degree increments
  const ringCount = 5;

  for (let r = 0; r < ringCount; r++) {
    const ringRadius = ((r + 1) / ringCount) * radius;
    const ringWidth = radius / ringCount;
    const sat = Math.round(((r + 1) / ringCount) * 100);

    for (let s = 0; s < segmentCount; s++) {
      const h = (s / segmentCount) * 360;
      const startAngle = (s / segmentCount) * 2 * Math.PI - Math.PI / 2;
      const endAngle = ((s + 1) / segmentCount) * 2 * Math.PI - Math.PI / 2;
      const midAngle = (startAngle + endAngle) / 2;

      const x = center + Math.cos(midAngle) * (ringRadius - ringWidth / 2);
      const y = center + Math.sin(midAngle) * (ringRadius - ringWidth / 2);
      const segSize = Math.max(4, (2 * Math.PI * ringRadius) / segmentCount + 1);

      rings.push(
        <View
          key={`${r}-${s}`}
          style={{
            position: "absolute",
            left: x - segSize / 2,
            top: y - segSize / 2,
            width: segSize,
            height: segSize,
            borderRadius: segSize / 2,
            backgroundColor: hslToHex(Math.round(h), sat, 50),
          }}
        />
      );
    }
  }

  // Current selection indicator
  const selAngle = (hue * Math.PI) / 180 - Math.PI / 2;
  const selDist = (saturation / 100) * radius;
  const indicatorX = center + Math.cos(selAngle) * selDist;
  const indicatorY = center + Math.sin(selAngle) * selDist;
  const selectedHex = hslToHex(hue, saturation, lightness);

  return (
    <View style={[styles.container, { width: size, height: size }]} {...panResponder.panHandlers}>
      {rings}
      {/* White center dot */}
      <View
        style={[
          styles.centerDot,
          {
            left: center - 8,
            top: center - 8,
            backgroundColor: hslToHex(0, 0, lightness),
          },
        ]}
      />
      {/* Selection indicator */}
      <View
        style={[
          styles.indicator,
          {
            left: indicatorX - 12,
            top: indicatorY - 12,
            borderColor: lightness > 50 ? "#000" : "#FFF",
          },
        ]}
      >
        <View style={[styles.indicatorInner, { backgroundColor: selectedHex }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  centerDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
  },
  indicator: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});

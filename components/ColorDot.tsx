import React from "react";
import { View, StyleSheet } from "react-native";

interface ColorDotProps {
  color: string;
  size?: number;
  selected?: boolean;
}

export function ColorDot({ color, size = 32, selected = false }: ColorDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        selected && styles.selected,
        color.toUpperCase() === "#FFFFFF" && styles.whiteBorder,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    borderColor: "#6C63FF",
    borderWidth: 3,
  },
  whiteBorder: {
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
});

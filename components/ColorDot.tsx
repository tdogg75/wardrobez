import React from "react";
import { View, StyleSheet } from "react-native";

interface ColorDotProps {
  color: string;
  size?: number;
  selected?: boolean;
}

export function ColorDot({ color, size = 32, selected = false }: ColorDotProps) {
  const isWhite = color.toUpperCase() === "#FFFFFF";
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
        !selected && isWhite && styles.whiteBorder,
        selected && styles.selected,
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

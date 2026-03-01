import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.label, { color: selected ? "#FFFFFF" : theme.colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
});

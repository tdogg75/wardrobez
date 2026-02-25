import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Theme } from "@/constants/theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surfaceAlt,
    marginRight: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: Theme.colors.primary,
  },
  label: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  labelSelected: {
    color: "#FFFFFF",
  },
});

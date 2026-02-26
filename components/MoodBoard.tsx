import React from "react";
import { View, Image, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import { CATEGORY_LABELS } from "@/models/types";
import { Theme } from "@/constants/theme";

interface MoodBoardProps {
  items: ClothingItem[];
  size?: number;
}

// Layout positions for items on the mood board grid
// Each position is { top%, left%, width%, height% }
const LAYOUTS: Record<number, { top: number; left: number; w: number; h: number }[]> = {
  1: [{ top: 5, left: 10, w: 80, h: 90 }],
  2: [
    { top: 5, left: 3, w: 46, h: 90 },
    { top: 5, left: 51, w: 46, h: 90 },
  ],
  3: [
    { top: 3, left: 3, w: 55, h: 50 },
    { top: 3, left: 60, w: 37, h: 50 },
    { top: 55, left: 15, w: 70, h: 42 },
  ],
  4: [
    { top: 3, left: 3, w: 46, h: 48 },
    { top: 3, left: 51, w: 46, h: 48 },
    { top: 53, left: 3, w: 46, h: 44 },
    { top: 53, left: 51, w: 46, h: 44 },
  ],
  5: [
    { top: 2, left: 2, w: 38, h: 48 },
    { top: 2, left: 42, w: 56, h: 30 },
    { top: 34, left: 42, w: 56, h: 30 },
    { top: 52, left: 2, w: 38, h: 46 },
    { top: 66, left: 42, w: 56, h: 32 },
  ],
};

function getLayout(count: number) {
  if (count <= 0) return [];
  if (count >= 5) return LAYOUTS[5];
  return LAYOUTS[count] ?? LAYOUTS[4];
}

const CATEGORY_ICONS: Record<ClothingCategory, string> = {
  tops: "shirt-outline",
  bottoms: "walk-outline",
  dresses: "woman-outline",
  outerwear: "cloudy-outline",
  shoes: "footsteps-outline",
  accessories: "diamond-outline",
  swimwear: "water-outline",
};

export function MoodBoard({ items, size = 280 }: MoodBoardProps) {
  const displayItems = items.slice(0, 5);
  const layout = getLayout(displayItems.length);

  if (displayItems.length === 0) {
    return (
      <View style={[styles.board, { width: size, height: size }]}>
        <Text style={styles.emptyText}>Add items to see your mood board</Text>
      </View>
    );
  }

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {displayItems.map((item, idx) => {
        const pos = layout[idx];
        if (!pos) return null;

        const iconName = CATEGORY_ICONS[item.category] ?? "shirt-outline";

        return (
          <View
            key={item.id}
            style={[
              styles.cell,
              {
                top: `${pos.top}%`,
                left: `${pos.left}%`,
                width: `${pos.w}%`,
                height: `${pos.h}%`,
              },
            ]}
          >
            {item.imageUris?.length > 0 ? (
              <Image source={{ uri: item.imageUris[0] }} style={styles.cellImage} />
            ) : (
              <View style={[styles.cellPlaceholder, { backgroundColor: item.color + "25" }]}>
                <Ionicons name={iconName as any} size={28} color={item.color} />
              </View>
            )}
            <View style={styles.cellLabel}>
              <View style={[styles.labelDot, { backgroundColor: item.color }]} />
              <Text style={styles.labelText} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Show overflow count */}
      {items.length > 5 && (
        <View style={styles.overflowBadge}>
          <Text style={styles.overflowText}>+{items.length - 5}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  emptyText: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textLight,
    paddingHorizontal: Theme.spacing.md,
  },
  cell: {
    position: "absolute",
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cellImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cellPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cellLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.colors.text,
    flex: 1,
  },
  overflowBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
  },
  overflowText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
});

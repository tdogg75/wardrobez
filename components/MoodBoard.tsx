import React from "react";
import { View, Image, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import { useTheme } from "@/hooks/useTheme";

interface MoodBoardProps {
  items: ClothingItem[];
  size?: number;
}

// Creative overlapping layouts — items overlap slightly, varied sizes & rotations
type CellPos = { top: number; left: number; w: number; h: number; rotate: number; z: number };

const LAYOUTS: Record<number, CellPos[]> = {
  1: [{ top: 5, left: 8, w: 84, h: 90, rotate: -1, z: 1 }],
  2: [
    { top: 8, left: 2, w: 52, h: 84, rotate: -3, z: 1 },
    { top: 4, left: 42, w: 55, h: 80, rotate: 2, z: 2 },
  ],
  3: [
    { top: 2, left: 0, w: 54, h: 58, rotate: -2, z: 1 },
    { top: 6, left: 48, w: 50, h: 52, rotate: 3, z: 2 },
    { top: 48, left: 18, w: 62, h: 50, rotate: -1, z: 3 },
  ],
  4: [
    { top: 0, left: 0, w: 50, h: 52, rotate: -3, z: 1 },
    { top: 4, left: 44, w: 54, h: 48, rotate: 2, z: 2 },
    { top: 44, left: 2, w: 48, h: 52, rotate: 1, z: 3 },
    { top: 48, left: 46, w: 52, h: 48, rotate: -2, z: 4 },
  ],
  5: [
    { top: 0, left: 2, w: 44, h: 46, rotate: -2, z: 1 },
    { top: 2, left: 40, w: 58, h: 38, rotate: 3, z: 2 },
    { top: 36, left: 0, w: 40, h: 38, rotate: 1, z: 3 },
    { top: 34, left: 34, w: 50, h: 36, rotate: -1, z: 4 },
    { top: 64, left: 14, w: 72, h: 34, rotate: 0, z: 5 },
  ],
};

function getLayout(count: number): CellPos[] {
  if (count <= 0) return [];
  if (count >= 5) return LAYOUTS[5];
  return LAYOUTS[count] ?? LAYOUTS[4];
}

const CATEGORY_ICONS: Partial<Record<ClothingCategory, string>> = {
  tops: "shirt-outline",
  bottoms: "walk-outline",
  skirts_shorts: "resize-outline",
  dresses: "woman-outline",
  jumpsuits: "body-outline",
  blazers: "business-outline",
  jackets: "cloudy-outline",
  shoes: "footsteps-outline",
  accessories: "diamond-outline",
  swimwear: "water-outline",
  jewelry: "sparkles-outline",
};

export function MoodBoard({ items, size = 280 }: MoodBoardProps) {
  const { theme } = useTheme();
  const displayItems = items.slice(0, 5);
  const layout = getLayout(displayItems.length);

  if (displayItems.length === 0) {
    return (
      <View style={[styles.board, { width: size, height: size, backgroundColor: theme.colors.surfaceAlt }]}>
        <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>Add items to see your mood board</Text>
      </View>
    );
  }

  return (
    <View style={[styles.board, { width: size, height: size, backgroundColor: theme.colors.surfaceAlt }]}>
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
                transform: [{ rotate: `${pos.rotate}deg` }],
                zIndex: pos.z,
              },
            ]}
          >
            {item.imageUris?.length > 0 ? (
              <Image source={{ uri: item.imageUris[0] }} style={styles.cellImage} />
            ) : (
              <View style={[styles.cellPlaceholder, { backgroundColor: item.color + "40" }]}>
                <Ionicons name={iconName as any} size={Math.round(size * 0.09)} color={item.color} />
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

      {items.length > 5 && (
        <View style={[styles.overflowBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.overflowText}>+{items.length - 5}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  emptyText: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 13,
    paddingHorizontal: 16,
  },
  cell: {
    position: "absolute",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
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
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  labelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  labelText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  overflowBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    zIndex: 10,
  },
  overflowText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
});

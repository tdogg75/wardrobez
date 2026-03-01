import React from "react";
import { View, Image, StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import { useTheme } from "@/hooks/useTheme";

interface MoodBoardProps {
  items: ClothingItem[];
  size?: number;
  onItemPress?: (item: ClothingItem) => void;
  onOverflowPress?: () => void;
}

// Body-like layout positions — items arranged as they'd appear on a person:
// Hats/hair on top, tops in upper-middle, bottoms/skirts in lower-middle,
// shoes at bottom, accessories/jewelry/purse overlaid to the sides

type CellPos = { top: number; left: number; w: number; h: number; rotate: number; z: number };

// Priority order for body placement
const BODY_ORDER: ClothingCategory[] = [
  "accessories", // hats, scarves, etc. — top area
  "tops",
  "blazers",
  "jackets",
  "dresses",
  "jumpsuits",
  "bottoms",
  "shorts",
  "skirts",
  "shoes",
  "jewelry",
  "purse",
  "swimwear",
];

function getBodyPosition(item: ClothingItem, idx: number, total: number): CellPos {
  const cat = item.category;
  const sub = item.subCategory ?? "";

  // Hat — top center
  if (cat === "accessories" && (sub === "hats" || sub === "hair_pieces")) {
    return { top: 0, left: 28, w: 44, h: 22, rotate: -2, z: 8 };
  }

  // Sunglasses / scarves — top accessory area
  if (cat === "accessories" && (sub === "sunglasses" || sub === "scarves")) {
    return { top: 18, left: 55, w: 35, h: 18, rotate: 3, z: 9 };
  }

  // Jewelry — overlaid in upper area
  if (cat === "jewelry") {
    if (sub === "earrings") return { top: 14, left: 5, w: 20, h: 16, rotate: -5, z: 10 };
    if (sub === "necklaces") return { top: 22, left: 20, w: 25, h: 16, rotate: 0, z: 9 };
    if (sub === "watches" || sub === "bracelets") return { top: 40, left: 68, w: 24, h: 16, rotate: 5, z: 10 };
    return { top: 20, left: 65, w: 22, h: 16, rotate: 3, z: 10 };
  }

  // Purse — to the side
  if (cat === "purse") {
    return { top: 42, left: 70, w: 30, h: 30, rotate: -8, z: 7 };
  }

  // Belt — waist area
  if (cat === "accessories" && sub === "belts") {
    return { top: 48, left: 10, w: 60, h: 10, rotate: 0, z: 8 };
  }

  // Stockings — leg area
  if (cat === "accessories" && sub === "stockings") {
    return { top: 58, left: 15, w: 30, h: 24, rotate: 0, z: 3 };
  }

  // Tops — upper body
  if (cat === "tops") {
    return { top: 18, left: 8, w: 56, h: 34, rotate: -1, z: 4 };
  }

  // Blazers — slightly larger, overlaid on top
  if (cat === "blazers") {
    return { top: 16, left: 4, w: 62, h: 36, rotate: 1, z: 5 };
  }

  // Jackets — outermost layer
  if (cat === "jackets") {
    return { top: 14, left: 2, w: 66, h: 38, rotate: -1, z: 6 };
  }

  // Dresses — spanning upper to lower body
  if (cat === "dresses") {
    return { top: 18, left: 12, w: 52, h: 52, rotate: 0, z: 4 };
  }

  // Jumpsuits — full body span
  if (cat === "jumpsuits") {
    return { top: 18, left: 10, w: 54, h: 56, rotate: 0, z: 4 };
  }

  // Bottoms — lower body
  if (cat === "bottoms") {
    return { top: 48, left: 12, w: 50, h: 32, rotate: 0, z: 3 };
  }

  // Shorts — shorter lower body
  if (cat === "shorts") {
    return { top: 50, left: 14, w: 46, h: 22, rotate: 0, z: 3 };
  }

  // Skirts — lower body with slight angle
  if (cat === "skirts") {
    return { top: 48, left: 10, w: 52, h: 28, rotate: 1, z: 3 };
  }

  // Shoes — bottom
  if (cat === "shoes") {
    return { top: 78, left: 14, w: 48, h: 20, rotate: 0, z: 2 };
  }

  // Swimwear
  if (cat === "swimwear") {
    if (sub === "one_piece") return { top: 20, left: 14, w: 48, h: 46, rotate: 0, z: 4 };
    if (sub === "top") return { top: 20, left: 16, w: 44, h: 24, rotate: 0, z: 4 };
    if (sub === "bottom") return { top: 46, left: 18, w: 40, h: 20, rotate: 0, z: 3 };
    return { top: 20, left: 14, w: 48, h: 46, rotate: 0, z: 4 };
  }

  // Fallback for other accessories
  if (cat === "accessories") {
    return { top: 42, left: 66, w: 28, h: 22, rotate: 5, z: 7 };
  }

  // Default
  return { top: 30, left: 15, w: 50, h: 40, rotate: 0, z: idx + 1 };
}

const CATEGORY_ICONS: Partial<Record<ClothingCategory, string>> = {
  tops: "shirt-outline",
  bottoms: "walk-outline",
  shorts: "resize-outline",
  skirts: "resize-outline",
  dresses: "woman-outline",
  jumpsuits: "body-outline",
  blazers: "business-outline",
  jackets: "cloudy-outline",
  shoes: "footsteps-outline",
  accessories: "diamond-outline",
  purse: "bag-outline",
  swimwear: "water-outline",
  jewelry: "sparkles-outline",
};

export function MoodBoard({ items, size = 280, onItemPress, onOverflowPress }: MoodBoardProps) {
  const { theme } = useTheme();

  // Sort items by body position order
  const sortedItems = [...items].sort((a, b) => {
    const aIdx = BODY_ORDER.indexOf(a.category);
    const bIdx = BODY_ORDER.indexOf(b.category);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  // Show up to 7 items in body layout
  const displayItems = sortedItems.slice(0, 7);

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
        const pos = getBodyPosition(item, idx, displayItems.length);
        const iconName = CATEGORY_ICONS[item.category] ?? "shirt-outline";
        const CellWrapper = onItemPress ? Pressable : View;

        return (
          <CellWrapper
            key={item.id}
            onPress={onItemPress ? () => onItemPress(item) : undefined}
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
                <Ionicons name={iconName as any} size={Math.round(size * 0.07)} color={item.color} />
              </View>
            )}
            <View style={styles.cellLabel}>
              <View style={[styles.labelDot, { backgroundColor: item.color }]} />
              <Text style={styles.labelText} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          </CellWrapper>
        );
      })}

      {items.length > 7 && (
        <Pressable
          style={[styles.overflowBadge, { backgroundColor: theme.colors.primary }]}
          onPress={onOverflowPress}
        >
          <Text style={styles.overflowText}>+{items.length - 7}</Text>
        </Pressable>
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

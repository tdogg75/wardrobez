import React from "react";
import { View, Image, StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import { useTheme } from "@/hooks/useTheme";

export interface MoodBoardProps {
  items: ClothingItem[];
  size?: number;
  onItemPress?: (item: ClothingItem) => void;
  onOverflowPress?: () => void;
}

/**
 * Flat-lay mood board layout.
 *
 * Items are grouped into visual tiers (outerwear → tops → bottoms → shoes →
 * accessories) and laid out in a clean, non-overlapping grid.  Items in the
 * same tier sit side-by-side.
 */

type Tier = "outerwear" | "upper" | "onepiece" | "lower" | "footwear" | "extras";

const TIER_MAP: Record<ClothingCategory, Tier> = {
  jackets: "outerwear",
  blazers: "outerwear",
  tops: "upper",
  dresses: "onepiece",
  jumpsuits: "onepiece",
  bottoms: "lower",
  shorts: "lower",
  skirts: "lower",
  shoes: "footwear",
  swimwear: "lower",
  accessories: "extras",
  jewelry: "extras",
  purse: "extras",
};

const TIER_ORDER: Tier[] = ["outerwear", "upper", "onepiece", "lower", "footwear", "extras"];

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

type CellLayout = { top: number; left: number; w: number; h: number };

/**
 * Given items, group them into tier-based rows and compute a flat-lay grid.
 * Returns one CellLayout (in %) per item, in the same order as the input.
 */
function computeFlatLayout(items: ClothingItem[]): CellLayout[] {
  if (items.length === 0) return [];

  const GAP = 2; // gap between cells in %

  // Build rows: each row is an array of indices into `items`
  const tierIndices = new Map<Tier, number[]>();
  items.forEach((item, idx) => {
    const tier = TIER_MAP[item.category] ?? "extras";
    const list = tierIndices.get(tier) ?? [];
    list.push(idx);
    tierIndices.set(tier, list);
  });

  // Merge outerwear + upper into one row if both exist and total ≤ 3
  const outerwear = tierIndices.get("outerwear") ?? [];
  const upper = tierIndices.get("upper") ?? [];
  if (outerwear.length > 0 && upper.length > 0 && outerwear.length + upper.length <= 3) {
    tierIndices.set("upper", [...outerwear, ...upper]);
    tierIndices.delete("outerwear");
  }

  // Merge footwear + extras into one row if both exist and total ≤ 3
  const footwear = tierIndices.get("footwear") ?? [];
  const extras = tierIndices.get("extras") ?? [];
  if (footwear.length > 0 && extras.length > 0 && footwear.length + extras.length <= 3) {
    tierIndices.set("footwear", [...footwear, ...extras]);
    tierIndices.delete("extras");
  }

  // Collect non-empty rows in tier order
  const rows: number[][] = [];
  for (const tier of TIER_ORDER) {
    const indices = tierIndices.get(tier);
    if (indices && indices.length > 0) rows.push(indices);
  }

  if (rows.length === 0) return items.map(() => ({ top: 0, left: 0, w: 100, h: 100 }));

  // Distribute height evenly among rows
  const totalGapY = GAP * (rows.length - 1);
  const rowHeight = (100 - totalGapY - GAP * 2) / rows.length; // GAP*2 for top/bottom padding

  const layouts: CellLayout[] = new Array(items.length);

  rows.forEach((rowIndices, rowIdx) => {
    const top = GAP + rowIdx * (rowHeight + GAP);
    const cols = rowIndices.length;
    const totalGapX = GAP * (cols - 1);
    const cellWidth = (100 - totalGapX - GAP * 2) / cols; // GAP*2 for left/right padding

    rowIndices.forEach((itemIdx, colIdx) => {
      layouts[itemIdx] = {
        top,
        left: GAP + colIdx * (cellWidth + GAP),
        w: cellWidth,
        h: rowHeight,
      };
    });
  });

  return layouts;
}

export const MoodBoard = React.forwardRef<View, MoodBoardProps>(
  function MoodBoard({ items, size = 280, onItemPress, onOverflowPress }, ref) {
    const { theme } = useTheme();

    // Show up to 8 items
    const displayItems = items.slice(0, 8);

    if (displayItems.length === 0) {
      return (
        <View
          ref={ref}
          style={[styles.board, { width: size, height: size, backgroundColor: theme.colors.surfaceAlt }]}
        >
          <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>
            Add items to see your mood board
          </Text>
        </View>
      );
    }

    const cellLayouts = computeFlatLayout(displayItems);

    return (
      <View
        ref={ref}
        style={[styles.board, { width: size, height: size, backgroundColor: theme.colors.surfaceAlt }]}
        collapsable={false}
      >
        {displayItems.map((item, idx) => {
          const cell = cellLayouts[idx];
          if (!cell) return null;
          const iconName = CATEGORY_ICONS[item.category] ?? "shirt-outline";
          const CellWrapper = onItemPress ? Pressable : View;

          return (
            <CellWrapper
              key={item.id}
              onPress={onItemPress ? () => onItemPress(item) : undefined}
              accessibilityRole={onItemPress ? "button" : undefined}
              accessibilityLabel={onItemPress ? `View ${item.name}` : undefined}
              style={[
                styles.cell,
                {
                  top: `${cell.top}%`,
                  left: `${cell.left}%`,
                  width: `${cell.w}%`,
                  height: `${cell.h}%`,
                },
              ]}
            >
              {item.imageUris?.length > 0 ? (
                <Image
                  source={{ uri: item.imageUris[0] }}
                  style={styles.cellImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.cellPlaceholder, { backgroundColor: item.color + "40" }]}>
                  <Ionicons
                    name={iconName as any}
                    size={Math.max(16, Math.round(size * 0.06))}
                    color={item.color}
                  />
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

        {items.length > 8 && (
          <Pressable
            style={[styles.overflowBadge, { backgroundColor: theme.colors.primary }]}
            onPress={onOverflowPress}
            accessibilityRole="button"
            accessibilityLabel={`Show ${items.length - 8} more items`}
          >
            <Text style={styles.overflowText}>+{items.length - 8}</Text>
          </Pressable>
        )}
      </View>
    );
  }
);

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
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cellImage: {
    width: "100%",
    height: "100%",
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

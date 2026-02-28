import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ItemFlag } from "@/models/types";
import { CATEGORY_LABELS, SUBCATEGORIES, ITEM_FLAG_LABELS } from "@/models/types";
import { ColorDot } from "./ColorDot";
import { Theme } from "@/constants/theme";

interface ClothingCardProps {
  item: ClothingItem;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onQuickLogWear?: () => void;
  compact?: boolean;
}

const FLAG_COLORS: Partial<Record<ItemFlag, string>> = {
  needs_repair: "#F97316",    // orange
  needs_dry_clean: "#3B82F6", // blue
  stained: "#EF4444",         // red
  too_big: "#8B5CF6",         // purple
  too_small: "#8B5CF6",       // purple
};

/** Returns days since last wear, or null if we cannot determine, or Infinity if never worn. */
function getDaysSinceLastWear(item: ClothingItem): number | null {
  if (item.wearCount === 0) {
    return Infinity; // never worn
  }
  if (item.wearDates && item.wearDates.length > 0) {
    const sorted = [...item.wearDates].sort();
    const lastDate = new Date(sorted[sorted.length - 1]);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  // Has wearCount > 0 but no wearDates -- can't determine when last worn
  return null;
}

function getNotWornBadge(item: ClothingItem): { color: string; label: string } | null {
  const days = getDaysSinceLastWear(item);
  if (days === null) return null;
  if (days === Infinity) {
    return { color: "#EF4444", label: "Never" }; // red
  }
  if (days >= 90) {
    return { color: "#EF4444", label: `${days}d` }; // red
  }
  if (days >= 30) {
    return { color: "#F59E0B", label: `${days}d` }; // amber
  }
  return null;
}

function getFlagBadges(item: ClothingItem): { color: string; label: string }[] {
  if (!item.itemFlags || item.itemFlags.length === 0) return [];
  const badges: { color: string; label: string }[] = [];
  for (const flag of item.itemFlags) {
    const color = FLAG_COLORS[flag];
    if (color) {
      badges.push({ color, label: ITEM_FLAG_LABELS[flag] });
    }
    if (badges.length >= 2) break;
  }
  return badges;
}

function getCostPerWear(item: ClothingItem): string | null {
  if (item.cost != null && item.cost > 0 && item.wearCount > 0) {
    return (item.cost / item.wearCount).toFixed(2);
  }
  return null;
}

export function ClothingCard({ item, onPress, onToggleFavorite, onQuickLogWear, compact }: ClothingCardProps) {
  const imageHeight = compact ? 80 : 160;
  const iconSize = compact ? 24 : 40;
  const favSize = compact ? 14 : 20;
  const favBtnSize = compact ? 22 : 32;

  const notWornBadge = getNotWornBadge(item);
  const flagBadges = getFlagBadges(item);
  const costPerWear = getCostPerWear(item);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {item.imageUris?.length > 0 ? (
          <Image source={{ uri: item.imageUris[0] }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: item.color + "30" }]}>
            <Ionicons name="shirt-outline" size={iconSize} color={item.color} />
          </View>
        )}

        {/* Not-worn badge (top-left) */}
        {notWornBadge && (
          <View style={[styles.notWornBadge, { backgroundColor: notWornBadge.color }]}>
            <Text style={styles.notWornBadgeText}>{notWornBadge.label}</Text>
          </View>
        )}

        {/* Item flag badges (below not-worn badge, left side) */}
        {flagBadges.length > 0 && (
          <View style={[styles.flagBadgeContainer, { top: notWornBadge ? 30 : 8 }]}>
            {flagBadges.map((badge, index) => (
              <View key={index} style={[styles.flagBadge, { backgroundColor: badge.color }]}>
                <Text style={styles.flagBadgeText} numberOfLines={1}>{badge.label}</Text>
              </View>
            ))}
          </View>
        )}

        {onToggleFavorite && (
          <Pressable
            style={[styles.favoriteBtn, { width: favBtnSize, height: favBtnSize, borderRadius: favBtnSize / 2 }]}
            onPress={onToggleFavorite}
          >
            <Ionicons
              name={item.favorite ? "heart" : "heart-outline"}
              size={favSize}
              color={item.favorite ? Theme.colors.secondary : Theme.colors.textLight}
            />
          </Pressable>
        )}

        {/* Quick-log wear button (bottom-right, non-compact only) */}
        {!compact && onQuickLogWear && (
          <Pressable style={styles.quickLogBtn} onPress={onQuickLogWear}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
      {!compact ? (
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <ColorDot color={item.color} size={14} />
              <Text style={styles.category} numberOfLines={1}>
                {CATEGORY_LABELS[item.category]}
                {item.subCategory
                  ? ` · ${SUBCATEGORIES[item.category]?.find((s) => s.value === item.subCategory)?.label ?? item.subCategory}`
                  : ""}
              </Text>
            </View>
            {item.brand ? (
              <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>
            ) : null}
          </View>
          {costPerWear && (
            <Text style={styles.costPerWear}>$/wear: ${costPerWear}</Text>
          )}
        </View>
      ) : (
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{item.name}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: Theme.spacing.md,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    backgroundColor: "#F5F5F5",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  notWornBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  notWornBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  flagBadgeContainer: {
    position: "absolute",
    left: 8,
    flexDirection: "column",
    gap: 3,
  },
  flagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  flagBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "600",
  },
  quickLogBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.success,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  info: {
    padding: Theme.spacing.sm,
  },
  name: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  category: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  brand: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginLeft: 4,
    fontStyle: "italic",
  },
  costPerWear: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  compactInfo: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  compactName: {
    fontSize: 9,
    fontWeight: "600",
    color: Theme.colors.text,
  },
});

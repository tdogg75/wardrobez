import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem, ItemFlag } from "@/models/types";
import { CATEGORY_LABELS, SUBCATEGORIES, ITEM_FLAG_LABELS } from "@/models/types";
import { ColorDot } from "./ColorDot";
import { useTheme } from "@/hooks/useTheme";

interface ClothingCardProps {
  item: ClothingItem;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onQuickLogWear?: () => void;
  compact?: boolean;
  /** Photo-only mode: show just the image, no text */
  photoOnly?: boolean;
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

export function ClothingCard({ item, onPress, onToggleFavorite, onQuickLogWear, compact, photoOnly }: ClothingCardProps) {
  const { theme } = useTheme();
  const imageHeight = photoOnly ? 120 : compact ? 80 : 160;
  const iconSize = compact ? 24 : 40;
  const favSize = compact ? 14 : 20;
  const favBtnSize = compact ? 22 : 32;

  const notWornBadge = getNotWornBadge(item);
  const flagBadges = getFlagBadges(item);
  const costPerWear = getCostPerWear(item);

  // Last worn label (#15)
  const lastWornLabel = (() => {
    const days = getDaysSinceLastWear(item);
    if (days === null || days === Infinity) return null;
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  })();

  if (photoOnly) {
    return (
      <Pressable style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {item.imageUris?.length > 0 ? (
            <Image source={{ uri: item.imageUris[0] }} style={styles.image} />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: item.color + "30" }]}>
              <Ionicons name="shirt-outline" size={32} color={item.color} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
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

        {/* Sustainable badge */}
        {item.sustainable && (
          <View style={styles.sustainableBadge}>
            <Ionicons name="leaf" size={10} color="#FFFFFF" />
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
              color={item.favorite ? theme.colors.secondary : theme.colors.textLight}
            />
          </Pressable>
        )}

        {/* Quick-log wear button (bottom-right, non-compact only) */}
        {!compact && onQuickLogWear && (
          <Pressable style={[styles.quickLogBtn, { backgroundColor: theme.colors.primary }]} onPress={onQuickLogWear}>
            <Ionicons name="shirt-outline" size={13} color="#FFFFFF" />
            <Text style={styles.quickLogPlus}>+</Text>
          </Pressable>
        )}
      </View>
      {!compact ? (
        <View style={{ padding: theme.spacing.sm }}>
          <Text style={[styles.name, { color: theme.colors.text, fontSize: theme.fontSize.md }]} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <ColorDot color={item.color} size={14} />
              {item.secondaryColor && <ColorDot color={item.secondaryColor} size={14} />}
              <Text style={[styles.category, { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs }]} numberOfLines={1}>
                {CATEGORY_LABELS[item.category]}
                {item.subCategory
                  ? ` · ${SUBCATEGORIES[item.category]?.find((s) => s.value === item.subCategory)?.label ?? item.subCategory}`
                  : ""}
              </Text>
            </View>
            {item.brand ? (
              <Text style={[styles.brand, { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs }]} numberOfLines={1}>{item.brand}</Text>
            ) : null}
          </View>
          <View style={styles.bottomMetaRow}>
            {costPerWear && (
              <Text style={[styles.costPerWear, { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs }]}>$/wear: ${costPerWear}</Text>
            )}
            {item.wearCount > 0 && (
              <Text style={[styles.wearCountText, { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs }]}>
                {item.wearCount}x{lastWornLabel ? ` · ${lastWornLabel}` : ""}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.compactInfo}>
          <Text style={[styles.compactName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
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
  sustainableBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  quickLogBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 28,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  quickLogPlus: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: -2,
  },
  name: {
    fontWeight: "600",
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
    flex: 1,
  },
  brand: {
    marginLeft: 4,
    fontStyle: "italic",
  },
  bottomMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  costPerWear: {},
  wearCountText: {
    fontWeight: "500",
  },
  compactInfo: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  compactName: {
    fontSize: 9,
    fontWeight: "600",
  },
});

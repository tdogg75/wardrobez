import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem } from "@/models/types";
import { CATEGORY_LABELS, SUBCATEGORIES } from "@/models/types";
import { ColorDot } from "./ColorDot";
import { Theme } from "@/constants/theme";

interface ClothingCardProps {
  item: ClothingItem;
  onPress: () => void;
  onToggleFavorite?: () => void;
  compact?: boolean;
}

export function ClothingCard({ item, onPress, onToggleFavorite, compact }: ClothingCardProps) {
  const imageHeight = compact ? 80 : 160;
  const iconSize = compact ? 24 : 40;
  const favSize = compact ? 14 : 20;
  const favBtnSize = compact ? 22 : 32;

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
    resizeMode: "cover",
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

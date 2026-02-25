import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClothingItem } from "@/models/types";
import { CATEGORY_LABELS } from "@/models/types";
import { ColorDot } from "./ColorDot";
import { Theme } from "@/constants/theme";

interface ClothingCardProps {
  item: ClothingItem;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export function ClothingCard({ item, onPress, onToggleFavorite }: ClothingCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: item.color + "30" }]}>
            <Ionicons name="shirt-outline" size={40} color={item.color} />
          </View>
        )}
        {onToggleFavorite && (
          <Pressable style={styles.favoriteBtn} onPress={onToggleFavorite}>
            <Ionicons
              name={item.favorite ? "heart" : "heart-outline"}
              size={20}
              color={item.favorite ? Theme.colors.secondary : Theme.colors.textLight}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.meta}>
          <ColorDot color={item.color} size={14} />
          <Text style={styles.category}>{CATEGORY_LABELS[item.category]}</Text>
        </View>
      </View>
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
    height: 160,
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
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  category: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
});

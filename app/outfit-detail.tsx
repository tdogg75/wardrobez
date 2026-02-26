import React from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ColorDot } from "@/components/ColorDot";
import { MoodBoard } from "@/components/MoodBoard";
import { Theme } from "@/constants/theme";
import { CATEGORY_LABELS, OCCASION_LABELS, SEASON_LABELS } from "@/models/types";
import type { ClothingItem } from "@/models/types";

export default function OutfitDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { outfits, remove } = useOutfits();
  const { getById } = useClothingItems();

  const outfit = outfits.find((o) => o.id === id);
  if (!outfit) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Outfit not found.</Text>
      </View>
    );
  }

  const outfitItems = outfit.itemIds
    .map((itemId) => getById(itemId))
    .filter(Boolean) as ClothingItem[];

  const handleDelete = () => {
    Alert.alert("Delete Outfit", "Remove this outfit from your collection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await remove(outfit.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{outfit.name}</Text>
        {outfit.suggested && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color={Theme.colors.primary} />
            <Text style={styles.aiBadgeText}>AI Suggested</Text>
          </View>
        )}
      </View>

      {/* Rating */}
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= outfit.rating ? "star" : "star-outline"}
            size={22}
            color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
          />
        ))}
      </View>

      {/* Mood Board */}
      {outfitItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Mood Board</Text>
          <View style={styles.moodBoardWrap}>
            <MoodBoard items={outfitItems} size={300} />
          </View>
        </>
      )}

      {/* Color Palette */}
      <Text style={styles.sectionTitle}>Color Palette</Text>
      <View style={styles.palette}>
        {outfitItems.map((item) => (
          <View key={item.id} style={styles.paletteItem}>
            <ColorDot color={item.color} size={36} />
            <Text style={styles.paletteLabel}>{item.colorName}</Text>
          </View>
        ))}
      </View>

      {/* Items */}
      <Text style={styles.sectionTitle}>Items</Text>
      {outfitItems.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          {item.imageUris?.length > 0 ? (
            <Image source={{ uri: item.imageUris[0] }} style={styles.itemThumb} />
          ) : (
            <View style={[styles.itemColor, { backgroundColor: item.color }]} />
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              {CATEGORY_LABELS[item.category]}
              {item.brand ? ` · ${item.brand}` : ""}
            </Text>
          </View>
        </View>
      ))}

      {/* Occasions */}
      {outfit.occasions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Occasions</Text>
          <View style={styles.tagRow}>
            {outfit.occasions.map((o) => (
              <View key={o} style={styles.tag}>
                <Text style={styles.tagText}>{OCCASION_LABELS[o]}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Seasons */}
      {(outfit.seasons ?? []).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Seasons</Text>
          <View style={styles.tagRow}>
            {(outfit.seasons ?? []).map((s) => (
              <View key={s} style={[styles.tag, styles.seasonTag]}>
                <Text style={styles.tagText}>{SEASON_LABELS[s]}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
        <Text style={styles.deleteBtnText}>Delete Outfit</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.md, paddingBottom: Theme.spacing.xxl },
  notFound: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.colors.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  aiBadgeText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  ratingRow: { flexDirection: "row", gap: 3, marginBottom: Theme.spacing.lg },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  moodBoardWrap: {
    alignItems: "center",
    marginBottom: Theme.spacing.sm,
  },
  palette: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  paletteItem: { alignItems: "center", gap: 4 },
  paletteLabel: { fontSize: Theme.fontSize.xs, color: Theme.colors.textSecondary },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: 8,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.sm,
    resizeMode: "cover",
  },
  itemColor: { width: 14, height: 44, borderRadius: 7 },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  itemMeta: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: Theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  seasonTag: {
    backgroundColor: Theme.colors.primary + "12",
  },
  tagText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.md,
  },
  deleteBtnText: {
    color: Theme.colors.error,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
});

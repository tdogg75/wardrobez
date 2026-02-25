import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ColorDot } from "@/components/ColorDot";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";

export default function OutfitsScreen() {
  const { outfits, loading, remove } = useOutfits();
  const { getById } = useClothingItems();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : outfits.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="No outfits yet"
          subtitle="Head to the Suggest tab to get AI-powered outfit recommendations based on your wardrobe!"
        />
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: outfit }) => {
            const outfitItems = outfit.itemIds
              .map((id) => getById(id))
              .filter(Boolean);

            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/outfit-detail",
                    params: { id: outfit.id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{outfit.name}</Text>
                  {outfit.suggested && (
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles" size={12} color={Theme.colors.primary} />
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>

                {/* Color swatches */}
                <View style={styles.swatches}>
                  {outfitItems.map((item) =>
                    item ? (
                      <ColorDot key={item.id} color={item.color} size={24} />
                    ) : null
                  )}
                </View>

                {/* Item names */}
                <Text style={styles.itemList} numberOfLines={2}>
                  {outfitItems.map((i) => i?.name).join(" + ")}
                </Text>

                {/* Rating */}
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= outfit.rating ? "star" : "star-outline"}
                      size={16}
                      color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
                    />
                  ))}
                </View>

                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => remove(outfit.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  loader: { flex: 1, justifyContent: "center" },
  list: { padding: Theme.spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Theme.colors.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  aiBadgeText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  swatches: { flexDirection: "row", gap: 6, marginBottom: 8 },
  itemList: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  ratingRow: { flexDirection: "row", gap: 2 },
  deleteBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
});

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
import { MoodBoard } from "@/components/MoodBoard";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";
import type { ClothingItem } from "@/models/types";

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
              .filter(Boolean) as ClothingItem[];

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
                <View style={styles.cardBody}>
                  {/* Mini Mood Board */}
                  <View style={styles.moodBoardWrap}>
                    <MoodBoard items={outfitItems} size={110} />
                  </View>

                  {/* Outfit Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {outfit.name}
                      </Text>
                      {outfit.suggested && (
                        <View style={styles.aiBadge}>
                          <Ionicons name="sparkles" size={10} color={Theme.colors.primary} />
                          <Text style={styles.aiBadgeText}>AI</Text>
                        </View>
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
                          size={14}
                          color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
                        />
                      ))}
                      <Text style={styles.itemCount}>
                        {outfitItems.length} items
                      </Text>
                    </View>
                  </View>
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
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
  },
  cardBody: {
    flexDirection: "row",
    gap: 12,
  },
  moodBoardWrap: {
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    flex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Theme.colors.primary + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  itemList: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  itemCount: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    marginLeft: 8,
  },
  deleteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
  },
});

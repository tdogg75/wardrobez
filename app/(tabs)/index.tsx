import React, { useState } from "react";
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
import { useClothingItems } from "@/hooks/useClothingItems";
import { ClothingCard } from "@/components/ClothingCard";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";
import type { ClothingCategory } from "@/models/types";
import { CATEGORY_LABELS } from "@/models/types";

const ALL_CATEGORIES: (ClothingCategory | "all")[] = [
  "all",
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "swimwear",
];

export default function WardrobeScreen() {
  const { items, loading, addOrUpdate } = useClothingItems();
  const [filter, setFilter] = useState<ClothingCategory | "all">("all");
  const router = useRouter();

  const filtered =
    filter === "all" ? items : items.filter((i) => i.category === filter);

  const toggleFavorite = async (item: (typeof items)[number]) => {
    await addOrUpdate({ ...item, favorite: !item.favorite });
  };

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ALL_CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: cat }) => (
            <Chip
              label={cat === "all" ? "All" : CATEGORY_LABELS[cat]}
              selected={filter === cat}
              onPress={() => setFilter(cat)}
            />
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={Theme.colors.primary}
          style={styles.loader}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="shirt-outline"
          title="Your wardrobe is empty"
          subtitle="Add your first clothing item to get started with outfit suggestions!"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ClothingCard
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/edit-item",
                    params: { id: item.id },
                  })
                }
                onToggleFavorite={() => toggleFavorite(item)}
              />
            </View>
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push("/add-item")}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  filterRow: {
    paddingTop: Theme.spacing.sm,
  },
  filterList: {
    paddingHorizontal: Theme.spacing.md,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  list: {
    padding: Theme.spacing.md,
    paddingBottom: 100,
  },
  row: {
    justifyContent: "space-between",
  },
  cardWrapper: {
    width: "48%",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

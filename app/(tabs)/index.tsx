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

const ALL_CATEGORIES: (ClothingCategory | "all" | "favorites")[] = [
  "all",
  "favorites",
  "tops",
  "bottoms",
  "dresses",
  "blazers",
  "jackets",
  "shoes",
  "accessories",
  "jewelry",
  "swimwear",
];

const COLUMN_OPTIONS = [2, 4, 8] as const;
type ColumnCount = (typeof COLUMN_OPTIONS)[number];

export default function WardrobeScreen() {
  const { items, loading, addOrUpdate, getFavorites } = useClothingItems();
  const [filter, setFilter] = useState<ClothingCategory | "all" | "favorites">("all");
  const [numColumns, setNumColumns] = useState<ColumnCount>(2);
  const router = useRouter();

  const filtered =
    filter === "all"
      ? items
      : filter === "favorites"
        ? getFavorites()
        : items.filter((i) => i.category === filter);

  const toggleFavorite = async (item: (typeof items)[number]) => {
    await addOrUpdate({ ...item, favorite: !item.favorite });
  };

  const cycleColumns = () => {
    const idx = COLUMN_OPTIONS.indexOf(numColumns);
    const next = COLUMN_OPTIONS[(idx + 1) % COLUMN_OPTIONS.length];
    setNumColumns(next);
  };

  const cardWidthPct =
    numColumns === 2 ? "48%" : numColumns === 4 ? "23%" : "11.5%";
  const compact = numColumns >= 4;

  return (
    <View style={styles.container}>
      {/* Top row: column toggle */}
      <View style={styles.topRow}>
        <Pressable style={styles.columnToggle} onPress={cycleColumns}>
          <Ionicons name="grid-outline" size={18} color={Theme.colors.primary} />
          <Text style={styles.columnToggleText}>{numColumns} cols</Text>
        </Pressable>
      </View>

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
              label={
                cat === "all"
                  ? "All"
                  : cat === "favorites"
                    ? "Favorites"
                    : CATEGORY_LABELS[cat]
              }
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
          icon={filter === "favorites" ? "heart-outline" : "shirt-outline"}
          title={filter === "favorites" ? "No favorites yet" : "Your wardrobe is empty"}
          subtitle={
            filter === "favorites"
              ? "Tap the heart icon on items to add them to your favorites!"
              : "Add your first clothing item to get started with outfit suggestions!"
          }
        />
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={{ width: cardWidthPct as any }}>
              <ClothingCard
                item={item}
                compact={compact}
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
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
  },
  columnToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.primary + "12",
  },
  columnToggleText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
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

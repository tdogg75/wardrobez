import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ClothingCard } from "@/components/ClothingCard";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";
import type { ClothingCategory, ClothingItem } from "@/models/types";
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

// The order in which category sections appear when filter is "all"
const SECTION_ORDER: ClothingCategory[] = [
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

export default function WardrobeScreen() {
  const { items, loading, addOrUpdate, getFavorites } = useClothingItems();
  const [filter, setFilter] = useState<ClothingCategory | "all" | "favorites">("all");
  const [numColumns, setNumColumns] = useState<ColumnCount>(2);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const filtered =
    filter === "all"
      ? items
      : filter === "favorites"
        ? getFavorites()
        : items.filter((i) => i.category === filter);

  // Group items by category for section list when filter is "all"
  const sections = useMemo(() => {
    if (filter !== "all") return [];
    const grouped: Record<string, ClothingItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    return SECTION_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => ({
      title: CATEGORY_LABELS[cat],
      data: chunkArray(grouped[cat], numColumns),
    }));
  }, [filter, items, numColumns]);

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
  const itemGap = numColumns === 2 ? 8 : 4;

  const renderCard = (item: ClothingItem) => (
    <View style={{ width: cardWidthPct as any }}>
      <ClothingCard
        item={item}
        compact={compact}
        onPress={() =>
          router.push({
            pathname: "/item-detail",
            params: { id: item.id },
          })
        }
        onToggleFavorite={() => toggleFavorite(item)}
      />
    </View>
  );

  const renderSectionRow = ({ item: rowItems }: { item: ClothingItem[] }) => (
    <View style={[styles.row, { gap: itemGap }]}>
      {rowItems.map((item) => (
        <React.Fragment key={item.id}>{renderCard(item)}</React.Fragment>
      ))}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom header row: title left, column toggle right */}
      <View style={styles.topRow}>
        <Text style={styles.headerTitle}>Wardrobe</Text>
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
                    ? "Favourites"
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
          title={filter === "favorites" ? "No favourites yet" : "Your wardrobe is empty"}
          subtitle={
            filter === "favorites"
              ? "Tap the heart icon on items to add them to your favourites!"
              : "Add your first clothing item to get started with outfit suggestions!"
          }
        />
      ) : filter === "all" ? (
        <SectionList
          key={`section-grid-${numColumns}`}
          sections={sections}
          keyExtractor={(item, index) => `row-${index}-${item.map((i: ClothingItem) => i.id).join("-")}`}
          renderItem={renderSectionRow}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={[styles.row, { gap: itemGap }]}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => renderCard(item)}
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

/** Split an array into chunks of the given size */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xs,
  },
  headerTitle: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
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
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  sectionHeader: {
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  sectionHeaderText: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
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

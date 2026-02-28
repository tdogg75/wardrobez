import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
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

type SortOption =
  | "newest"
  | "oldest"
  | "most_worn"
  | "least_worn"
  | "highest_cost"
  | "lowest_cpw";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_worn", label: "Most Worn" },
  { value: "least_worn", label: "Least Worn" },
  { value: "highest_cost", label: "Highest Cost" },
  { value: "lowest_cpw", label: "Lowest $/Wear" },
];

function sortItems(items: ClothingItem[], sort: SortOption): ClothingItem[] {
  const sorted = [...items];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "most_worn":
      return sorted.sort((a, b) => b.wearCount - a.wearCount);
    case "least_worn":
      return sorted.sort((a, b) => a.wearCount - b.wearCount);
    case "highest_cost":
      return sorted.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
    case "lowest_cpw": {
      const cpw = (item: ClothingItem) => {
        if (!item.cost || item.wearCount <= 0) return Infinity;
        return item.cost / item.wearCount;
      };
      return sorted.sort((a, b) => cpw(a) - cpw(b));
    }
    default:
      return sorted;
  }
}

export default function WardrobeScreen() {
  const { items, loading, addOrUpdate, getFavorites, remove, archiveItem, logItemWorn } =
    useClothingItems();
  const [filter, setFilter] = useState<
    ClothingCategory | "all" | "favorites"
  >("all");
  const [numColumns, setNumColumns] = useState<ColumnCount>(2);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const base =
      filter === "all"
        ? items
        : filter === "favorites"
          ? getFavorites()
          : items.filter((i) => i.category === filter);
    return sortItems(base, sortBy);
  }, [filter, items, getFavorites, sortBy]);

  // Wardrobe value summary computations
  const summary = useMemo(() => {
    const totalItems = filtered.length;
    const totalCost = filtered.reduce((sum, i) => sum + (i.cost ?? 0), 0);
    const itemsWithCpw = filtered.filter(
      (i) => i.cost != null && i.cost > 0 && i.wearCount > 0
    );
    const avgCpw =
      itemsWithCpw.length > 0
        ? itemsWithCpw.reduce((sum, i) => sum + i.cost! / i.wearCount, 0) /
          itemsWithCpw.length
        : 0;
    return { totalItems, totalCost, avgCpw };
  }, [filtered]);

  // Group items by category for section list when filter is "all"
  const sections = useMemo(() => {
    if (filter !== "all") return [];
    const sortedItems = sortItems(items, sortBy);
    const grouped: Record<string, ClothingItem[]> = {};
    for (const item of sortedItems) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    return SECTION_ORDER.filter((cat) => grouped[cat]?.length > 0).map(
      (cat) => ({
        title: CATEGORY_LABELS[cat],
        data: chunkArray(grouped[cat], numColumns),
      })
    );
  }, [filter, items, numColumns, sortBy]);

  const toggleFavorite = async (item: ClothingItem) => {
    await addOrUpdate({ ...item, favorite: !item.favorite });
  };

  const cycleColumns = () => {
    const idx = COLUMN_OPTIONS.indexOf(numColumns);
    const next = COLUMN_OPTIONS[(idx + 1) % COLUMN_OPTIONS.length];
    setNumColumns(next);
  };

  // --- Bulk selection helpers ---
  const enterSelectionMode = useCallback((itemId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Archive Items",
      `Archive ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} as donated?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive All",
          onPress: async () => {
            const ids = Array.from(selectedIds);
            for (const id of ids) {
              await archiveItem(id, "donated");
            }
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, archiveItem, exitSelectionMode]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Delete Items",
      `Permanently delete ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = Array.from(selectedIds);
            for (const id of ids) {
              await remove(id);
            }
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, remove, exitSelectionMode]);

  const cardWidthPct =
    numColumns === 2 ? "48%" : numColumns === 4 ? "23%" : "11.5%";
  const compact = numColumns >= 4;
  const itemGap = numColumns === 2 ? 8 : 4;

  const renderCard = (item: ClothingItem) => (
    <View style={{ width: cardWidthPct as any }}>
      <Pressable
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
            router.push({
              pathname: "/item-detail",
              params: { id: item.id },
            });
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            enterSelectionMode(item.id);
          }
        }}
      >
        <View>
          <ClothingCard
            item={item}
            compact={compact}
            onPress={() => {
              if (selectionMode) {
                toggleSelection(item.id);
              } else {
                router.push({
                  pathname: "/item-detail",
                  params: { id: item.id },
                });
              }
            }}
            onToggleFavorite={
              selectionMode ? undefined : () => toggleFavorite(item)
            }
            onQuickLogWear={
              selectionMode || compact
                ? undefined
                : () => {
                    Alert.alert(
                      "Log Wear",
                      `Mark "${item.name}" as worn today?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Log It", onPress: () => logItemWorn(item.id) },
                      ]
                    );
                  }
            }
          />
          {selectionMode && (
            <View style={styles.checkboxOverlay}>
              <View
                style={[
                  styles.checkbox,
                  selectedIds.has(item.id) && styles.checkboxSelected,
                ]}
              >
                {selectedIds.has(item.id) && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );

  const renderSectionRow = ({ item: rowItems }: { item: ClothingItem[] }) => (
    <View style={[styles.row, { gap: itemGap }]}>
      {rowItems.map((item) => (
        <React.Fragment key={item.id}>{renderCard(item)}</React.Fragment>
      ))}
    </View>
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string };
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Newest";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Bulk Selection Top Bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectionBarActions}>
            <Pressable
              style={styles.selectionBarBtn}
              onPress={handleBulkArchive}
            >
              <Ionicons
                name="archive-outline"
                size={18}
                color={Theme.colors.primary}
              />
              <Text style={styles.selectionBarBtnText}>Archive</Text>
            </Pressable>
            <Pressable
              style={styles.selectionBarBtn}
              onPress={handleBulkDelete}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={Theme.colors.error}
              />
              <Text
                style={[
                  styles.selectionBarBtnText,
                  { color: Theme.colors.error },
                ]}
              >
                Delete
              </Text>
            </Pressable>
            <Pressable
              style={styles.selectionBarBtn}
              onPress={exitSelectionMode}
            >
              <Ionicons
                name="close"
                size={18}
                color={Theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectionBarBtnText,
                  { color: Theme.colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Custom header row: title left, sort + column toggle right */}
      {!selectionMode && (
        <View style={styles.topRow}>
          <Text style={styles.headerTitle}>Wardrobe</Text>
          <View style={styles.topRowRight}>
            {/* Sort dropdown */}
            <Pressable
              style={styles.sortToggle}
              onPress={() => setShowSortMenu((v) => !v)}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={16}
                color={Theme.colors.primary}
              />
              <Text style={styles.sortToggleText}>{currentSortLabel}</Text>
              <Ionicons
                name={showSortMenu ? "chevron-up" : "chevron-down"}
                size={12}
                color={Theme.colors.primary}
              />
            </Pressable>
            {/* Column toggle */}
            <Pressable style={styles.columnToggle} onPress={cycleColumns}>
              <Ionicons
                name="grid-outline"
                size={18}
                color={Theme.colors.primary}
              />
              <Text style={styles.columnToggleText}>{numColumns} cols</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Sort dropdown menu */}
      {showSortMenu && !selectionMode && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.sortMenuItem,
                sortBy === opt.value && styles.sortMenuItemActive,
              ]}
              onPress={() => {
                setSortBy(opt.value);
                setShowSortMenu(false);
              }}
            >
              <Text
                style={[
                  styles.sortMenuItemText,
                  sortBy === opt.value && styles.sortMenuItemTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {sortBy === opt.value && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={Theme.colors.primary}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}

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

      {/* Wardrobe Value Summary Banner */}
      {!loading && filtered.length > 0 && (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryText}>
            {summary.totalItems} item{summary.totalItems !== 1 ? "s" : ""}
            {" \u00B7 "}${summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
            {summary.avgCpw > 0 && (
              <>{" \u00B7 "}${summary.avgCpw.toFixed(2)} avg $/wear</>
            )}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={Theme.colors.primary}
          style={styles.loader}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={filter === "favorites" ? "heart-outline" : "shirt-outline"}
          title={
            filter === "favorites"
              ? "No favourites yet"
              : "Your wardrobe is empty"
          }
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
          keyExtractor={(item, index) =>
            `row-${index}-${item.map((i: ClothingItem) => i.id).join("-")}`
          }
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

      {/* FAB - hidden in selection mode */}
      {!selectionMode && (
        <Pressable
          style={styles.fab}
          onPress={() => router.push("/add-item")}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
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
  // --- Selection bar ---
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary + "14",
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.primary + "30",
  },
  selectionBarText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  selectionBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surface,
  },
  selectionBarBtnText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  // --- Checkbox overlay ---
  checkboxOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  // --- Top row ---
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xs,
  },
  topRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
  },
  // --- Sort ---
  sortToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.primary + "12",
  },
  sortToggleText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  sortMenu: {
    marginHorizontal: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  sortMenuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
  },
  sortMenuItemActive: {
    backgroundColor: Theme.colors.primary + "10",
  },
  sortMenuItemText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
  },
  sortMenuItemTextActive: {
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  // --- Column toggle ---
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
  // --- Filter ---
  filterRow: {
    paddingTop: Theme.spacing.sm,
  },
  filterList: {
    paddingHorizontal: Theme.spacing.md,
  },
  // --- Summary Banner ---
  summaryBanner: {
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary + "10",
    borderRadius: Theme.borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.primary,
  },
  summaryText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  // --- Loader / List ---
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
  // --- FAB ---
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

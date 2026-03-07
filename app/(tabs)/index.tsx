import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  RefreshControl,
  TextInput,
  Modal,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { ClothingCard } from "@/components/ClothingCard";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { getPlannedOutfits } from "@/services/storage";
import { suggestOutfits, type SuggestionResult } from "@/services/outfitEngine";
import type { ClothingCategory, ClothingItem, FabricType, LaundryStatus, PlannedOutfit } from "@/models/types";
import { CATEGORY_LABELS, LAUNDRY_STATUS_LABELS } from "@/models/types";

const ALL_CATEGORIES: (ClothingCategory | "all" | "favorites" | "laundry")[] = [
  "all",
  "favorites",
  "laundry",
  "tops",
  "bottoms",
  "shorts",
  "skirts",
  "dresses",
  "jumpsuits",
  "blazers",
  "jackets",
  "shoes",
  "accessories",
  "purse",
  "jewelry",
  "swimwear",
];

const COLUMN_OPTIONS = [2, 4, 8] as const;
type ColumnCount = (typeof COLUMN_OPTIONS)[number];

// The order in which category sections appear when filter is "all"
const SECTION_ORDER: ClothingCategory[] = [
  "tops",
  "bottoms",
  "shorts",
  "skirts",
  "dresses",
  "jumpsuits",
  "blazers",
  "jackets",
  "shoes",
  "accessories",
  "purse",
  "jewelry",
  "swimwear",
];

type SortOption =
  | "newest"
  | "oldest"
  | "recently_added"
  | "most_worn"
  | "least_worn"
  | "highest_cost"
  | "lowest_cpw"
  | "purchase_date"
  | "brand";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "recently_added", label: "Recently Added" },
  { value: "most_worn", label: "Most Worn" },
  { value: "least_worn", label: "Least Worn" },
  { value: "highest_cost", label: "Highest Cost" },
  { value: "lowest_cpw", label: "Lowest $/Wear" },
  { value: "purchase_date", label: "Purchase Date" },
  { value: "brand", label: "Brand" },
];

function sortItems(items: ClothingItem[], sort: SortOption): ClothingItem[] {
  const sorted = [...items];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "recently_added":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
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
    case "purchase_date": {
      const getTs = (item: ClothingItem) => {
        if (item.purchaseDate) {
          return new Date(item.purchaseDate).getTime();
        }
        return item.createdAt;
      };
      return sorted.sort((a, b) => getTs(b) - getTs(a));
    }
    case "brand": {
      return sorted.sort((a, b) => {
        const brandA = (a.brand ?? "").toLowerCase();
        const brandB = (b.brand ?? "").toLowerCase();
        if (brandA < brandB) return -1;
        if (brandA > brandB) return 1;
        return 0;
      });
    }
    default:
      return sorted;
  }
}

// --- Seasonal rotation helpers (#79) ---
const SUMMER_FABRICS: FabricType[] = ["linen", "cotton", "nylon"];
const WINTER_FABRICS: FabricType[] = ["wool", "cashmere", "fleece", "leather"];

type SeasonName = "spring" | "summer" | "fall" | "winter";

function getCurrentSeason(): SeasonName {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getOppositeSeason(season: SeasonName): SeasonName {
  switch (season) {
    case "spring": return "fall";
    case "summer": return "winter";
    case "fall": return "spring";
    case "winter": return "summer";
  }
}

function getSeasonLabel(season: SeasonName): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

function isSeasonFabric(fabric: FabricType, season: SeasonName): boolean {
  if (season === "summer" || season === "spring") return SUMMER_FABRICS.includes(fabric);
  if (season === "winter" || season === "fall") return WINTER_FABRICS.includes(fabric);
  return false;
}

const PHOTO_GRID_COLUMNS = 3;

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { items, loading, addOrUpdate, getFavorites, remove, archiveItem, logItemWorn, reload, updateLaundryStatus, bulkUpdateLaundryStatus, getAvailableItems } =
    useClothingItems();
  const { outfits } = useOutfits();
  const [filter, setFilter] = useState<
    ClothingCategory | "all" | "favorites" | "laundry"
  >("all");
  const [numColumns, setNumColumns] = useState<ColumnCount>(2);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [photoOnlyMode, setPhotoOnlyMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [seasonBannerDismissed, setSeasonBannerDismissed] = useState(false);

  // Scroll-to-top button state (#28)
  const listRef = useRef<FlashList<ClothingItem>>(null);
  const photoListRef = useRef<FlatList<ClothingItem>>(null);
  const sectionListRef = useRef<SectionList<ClothingItem[]>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // OOTD (Outfit of the Day) widget state
  const [ootdItems, setOotdItems] = useState<ClothingItem[]>([]);
  const [ootdLabel, setOotdLabel] = useState<string>("");
  const [ootdDismissed, setOotdDismissed] = useState(false);
  const [ootdOutfitId, setOotdOutfitId] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Pull to refresh (#9)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Load wardrobe view preferences on mount (#59)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("wardrobez:wardrobe_prefs");
        if (raw) {
          const prefs = JSON.parse(raw);
          if (prefs.numColumns && COLUMN_OPTIONS.includes(prefs.numColumns)) {
            setNumColumns(prefs.numColumns);
          }
          if (prefs.sortBy) {
            setSortBy(prefs.sortBy);
          }
          if (prefs.filter) {
            setFilter(prefs.filter);
          }
        }
      } catch (_) {
        // ignore storage errors
      }
    })();
  }, []);

  // Persist wardrobe view preferences when they change (#59)
  useEffect(() => {
    AsyncStorage.setItem(
      "wardrobez:wardrobe_prefs",
      JSON.stringify({ numColumns, sortBy, filter })
    ).catch(() => {});
  }, [numColumns, sortBy, filter]);

  // OOTD: Load today's planned outfit or generate a suggestion
  useEffect(() => {
    if (loading || items.length < 3) return;
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      // Check for a planned outfit first
      try {
        const planned = await getPlannedOutfits();
        const todayPlan = planned.find((p) => p.date === today);
        if (todayPlan && todayPlan.outfitId) {
          const outfit = outfits.find((o) => o.id === todayPlan.outfitId);
          if (outfit && !cancelled) {
            const outfitItems = outfit.itemIds
              .map((iid) => items.find((i) => i.id === iid))
              .filter(Boolean) as ClothingItem[];
            if (outfitItems.length > 0) {
              setOotdItems(outfitItems);
              setOotdLabel(outfit.name || "Today's Planned Outfit");
              setOotdOutfitId(outfit.id);
              return;
            }
          }
        }
      } catch (_) {
        // ignore
      }
      // No planned outfit — generate a quick suggestion
      if (cancelled) return;
      const available = items.filter((i) => {
        const status = i.laundryStatus ?? "clean";
        return status !== "in_wash" && status !== "dry_cleaning";
      });
      if (available.length < 3) return;
      const results = suggestOutfits(available, { maxResults: 1 });
      if (results.length > 0 && !cancelled) {
        setOotdItems(results[0].items);
        setOotdLabel("Outfit of the Day");
        setOotdOutfitId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, items, outfits]);

  // Scroll handler for scroll-to-top button (#28)
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      setShowScrollTop(offsetY > 400);
    },
    []
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    photoListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    sectionListRef.current?.scrollToLocation?.({
      sectionIndex: 0,
      itemIndex: 0,
      viewOffset: 0,
      animated: true,
    });
  }, []);

  const filtered = useMemo(() => {
    let base =
      filter === "all"
        ? items
        : filter === "favorites"
          ? getFavorites()
          : filter === "laundry"
            ? items.filter((i) => {
                const status = i.laundryStatus ?? "clean";
                return status !== "clean";
              })
            : items.filter((i) => i.category === filter);
    // Search filter (#36)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.brand ?? "").toLowerCase().includes(q) ||
          (i.colorName ?? "").toLowerCase().includes(q) ||
          (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return sortItems(base, sortBy);
  }, [filter, items, getFavorites, sortBy, searchQuery]);

  // Item counts per category for filter chips (#5)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      favorites: getFavorites().length,
      laundry: items.filter((i) => {
        const status = i.laundryStatus ?? "clean";
        return status !== "clean";
      }).length,
    };
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items, getFavorites]);

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

  // Seasonal rotation reminder (#79)
  const seasonalRotation = useMemo(() => {
    const currentSeason = getCurrentSeason();
    const oppositeSeason = getOppositeSeason(currentSeason);
    // Count active items whose fabric belongs to the opposite season
    const oppositeSeasonItems = items.filter((i) =>
      isSeasonFabric(i.fabricType, oppositeSeason)
    );
    const count = oppositeSeasonItems.length;
    if (count === 0) return null;
    const currentLabel = getSeasonLabel(currentSeason);
    const oppositeLabel = getSeasonLabel(oppositeSeason);
    // Build contextual message
    let message: string;
    if (currentSeason === "spring" || currentSeason === "summer") {
      message = `${currentLabel} is here! You have ${count} ${oppositeLabel.toLowerCase()} item${count !== 1 ? "s" : ""} that could be rotated out.`;
    } else {
      message = `${currentLabel} is coming! You have ${count} ${oppositeLabel.toLowerCase()} item${count !== 1 ? "s" : ""} that could be rotated out.`;
    }
    return { message, count };
  }, [items]);

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
            // Validate IDs against current items to avoid stale refs
            const currentIds = new Set(items.map((i) => i.id));
            const ids = Array.from(selectedIds).filter((id) => currentIds.has(id));
            for (const id of ids) {
              await archiveItem(id, "donated");
            }
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, items, archiveItem, exitSelectionMode]);

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
            // Validate IDs against current items to avoid stale refs
            const currentIds = new Set(items.map((i) => i.id));
            const ids = Array.from(selectedIds).filter((id) => currentIds.has(id));
            for (const id of ids) {
              await remove(id);
            }
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, items, remove, exitSelectionMode]);

  // Bulk laundry status
  const [bulkLaundryModalVisible, setBulkLaundryModalVisible] = useState(false);

  const handleBulkLaundryStatus = useCallback(async (status: LaundryStatus) => {
    if (selectedIds.size === 0) return;
    await bulkUpdateLaundryStatus(Array.from(selectedIds), status);
    setBulkLaundryModalVisible(false);
    const label = LAUNDRY_STATUS_LABELS[status];
    Alert.alert("Done", `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} marked as "${label}"`);
    exitSelectionMode();
  }, [selectedIds, bulkUpdateLaundryStatus, exitSelectionMode]);

  // Bulk tag editing (#70)
  const [bulkTagModalVisible, setBulkTagModalVisible] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");

  const handleBulkAddTag = useCallback(async () => {
    if (selectedIds.size === 0 || !bulkTagInput.trim()) return;
    const tag = bulkTagInput.trim();
    for (const id of Array.from(selectedIds)) {
      const item = items.find((i) => i.id === id);
      if (item) {
        const existingTags = item.tags ?? [];
        if (!existingTags.includes(tag)) {
          await addOrUpdate({ ...item, tags: [...existingTags, tag] });
        }
      }
    }
    setBulkTagInput("");
    setBulkTagModalVisible(false);
    Alert.alert("Done", `Tag "${tag}" added to ${selectedIds.size} item(s)`);
  }, [selectedIds, items, addOrUpdate, bulkTagInput]);

  const cardWidthPct =
    numColumns === 2 ? "48%" : numColumns === 4 ? "23%" : "11.5%";
  const compact = numColumns >= 4;
  const itemGap = numColumns === 2 ? 8 : 4;

  // Photo grid tile size (3 columns with small gaps)
  const photoTileGap = 2;
  const photoTileSize =
    (screenWidth - theme.spacing.md * 2 - photoTileGap * (PHOTO_GRID_COLUMNS - 1)) /
    PHOTO_GRID_COLUMNS;

  const styles = useMemo(() => createStyles(theme), [theme]);

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Newest";

  const renderCard = (item: ClothingItem) => (
    <View style={{ width: cardWidthPct }}>
      <Pressable
        accessibilityLabel={selectionMode ? `Select ${item.name}` : `View ${item.name}`}
        accessibilityRole="button"
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
            onLaundryToggle={
              selectionMode || compact
                ? undefined
                : () => {
                    const cycle: Record<string, import("@/models/types").LaundryStatus> = {
                      clean: "worn",
                      worn: "in_wash",
                      in_wash: "clean",
                      dry_cleaning: "clean",
                    };
                    updateLaundryStatus(item.id, cycle[item.laundryStatus ?? "clean"] ?? "worn");
                  }
            }
          />
          {selectionMode && (
            <View style={styles.checkboxOverlay}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.colors.primary },
                  selectedIds.has(item.id) && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
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

  const renderPhotoTile = ({ item }: { item: ClothingItem }) => (
    <Pressable
      accessibilityLabel={`View ${item.name}`}
      accessibilityRole="button"
      onPress={() => {
        router.push({
          pathname: "/item-detail",
          params: { id: item.id },
        });
      }}
      style={{
        width: photoTileSize,
        height: photoTileSize,
        marginBottom: photoTileGap,
      }}
    >
      {item.imageUris?.length > 0 ? (
        <Image
          source={{ uri: item.imageUris[0] }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: theme.borderRadius.sm,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: "100%",
            borderRadius: theme.borderRadius.sm,
            backgroundColor: item.color + "30",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="shirt-outline" size={28} color={item.color} />
        </View>
      )}
    </Pressable>
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
    section: { title?: string; data: readonly ClothingItem[][] };
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>
        {section.title}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Bulk Selection Top Bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectionBarActions}>
            {/* Select All / Deselect All (#2) */}
            <Pressable
              accessibilityLabel={selectedIds.size === filtered.length ? "Deselect all items" : "Select all items"}
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={() => {
                if (selectedIds.size === filtered.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(filtered.map((i) => i.id)));
                }
              }}
            >
              <Ionicons
                name={selectedIds.size === filtered.length ? "checkbox-outline" : "square-outline"}
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.selectionBarBtnText}>
                {selectedIds.size === filtered.length ? "None" : "All"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Archive selected items"
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={handleBulkArchive}
            >
              <Ionicons
                name="archive-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.selectionBarBtnText}>Archive</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete selected items"
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={handleBulkDelete}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={theme.colors.error}
              />
              <Text
                style={[
                  styles.selectionBarBtnText,
                  { color: theme.colors.error },
                ]}
              >
                Delete
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Tag selected items"
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={() => setBulkTagModalVisible(true)}
            >
              <Ionicons name="pricetag-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.selectionBarBtnText}>Tag</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Set laundry status for selected items"
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={() => setBulkLaundryModalVisible(true)}
            >
              <Ionicons name="water-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.selectionBarBtnText}>Laundry</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Cancel selection"
              accessibilityRole="button"
              style={styles.selectionBarBtn}
              onPress={exitSelectionMode}
            >
              <Ionicons
                name="close"
                size={18}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectionBarBtnText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Custom header row: title left, sort + view toggles right */}
      {!selectionMode && (
        <View style={styles.topRow}>
          <Text style={styles.headerTitle}>Wardrobe</Text>
          <View style={styles.topRowRight}>
            {/* Photo-only browse mode toggle */}
            <Pressable
              accessibilityLabel={photoOnlyMode ? "Switch to card view" : "Switch to photo grid view"}
              accessibilityRole="button"
              style={[
                styles.columnToggle,
                photoOnlyMode && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              onPress={() => setPhotoOnlyMode((v) => !v)}
            >
              <Ionicons
                name="images-outline"
                size={18}
                color={photoOnlyMode ? "#FFFFFF" : theme.colors.primary}
              />
            </Pressable>
            {/* Sort dropdown */}
            <Pressable
              accessibilityLabel={`Sort by ${currentSortLabel}`}
              accessibilityRole="button"
              style={styles.sortToggle}
              onPress={() => setShowSortMenu((v) => !v)}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.sortToggleText}>{currentSortLabel}</Text>
              <Ionicons
                name={showSortMenu ? "chevron-up" : "chevron-down"}
                size={12}
                color={theme.colors.primary}
              />
            </Pressable>
            {/* Column toggle (only in card mode) */}
            {!photoOnlyMode && (
              <Pressable accessibilityLabel={`Change grid to ${COLUMN_OPTIONS[(COLUMN_OPTIONS.indexOf(numColumns) + 1) % COLUMN_OPTIONS.length]} columns`} accessibilityRole="button" style={styles.columnToggle} onPress={cycleColumns}>
                <Ionicons
                  name="grid-outline"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.columnToggleText}>{numColumns} cols</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Sort dropdown menu */}
      {showSortMenu && !selectionMode && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              accessibilityLabel={`Sort by ${opt.label}`}
              accessibilityRole="button"
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
                  color={theme.colors.primary}
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
          renderItem={({ item: cat }) => {
            const count = categoryCounts[cat] ?? 0;
            const label = cat === "all"
              ? `All (${count})`
              : cat === "favorites"
                ? `Favourites (${count})`
                : cat === "laundry"
                  ? `Laundry (${count})`
                  : `${CATEGORY_LABELS[cat as ClothingCategory]} (${count})`;
            return (
              <Chip
                label={label}
                selected={filter === cat}
                onPress={() => setFilter(cat)}
              />
            );
          }}
        />
      </View>

      {/* Search Bar (#36) */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textLight} />
        <TextInput
          accessibilityLabel="Search items by name, brand, colour, or tag"
          style={styles.searchInput}
          placeholder="Search name, brand, colour, tag..."
          placeholderTextColor={theme.colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setSearchQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textLight} />
          </Pressable>
        )}
      </View>

      {/* Outfit of the Day Widget */}
      {!loading && !ootdDismissed && ootdItems.length > 0 && !selectionMode && (
        <View style={styles.ootdCard}>
          <View style={styles.ootdHeader}>
            <View style={styles.ootdTitleRow}>
              <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
              <Text style={styles.ootdTitle}>{ootdLabel}</Text>
            </View>
            <Pressable accessibilityLabel="Dismiss outfit of the day" accessibilityRole="button" onPress={() => setOotdDismissed(true)} hitSlop={10}>
              <Ionicons name="close" size={18} color={theme.colors.textLight} />
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel="View outfit details"
            accessibilityRole="button"
            style={styles.ootdImageRow}
            onPress={() => {
              if (ootdOutfitId) {
                router.push({ pathname: "/outfit-detail", params: { id: ootdOutfitId } });
              }
            }}
          >
            {ootdItems.slice(0, 5).map((ootdItem) => (
              <View key={ootdItem.id} style={styles.ootdImageWrapper}>
                {ootdItem.imageUris?.length > 0 ? (
                  <Image source={{ uri: ootdItem.imageUris[0] }} style={styles.ootdImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.ootdImagePlaceholder, { backgroundColor: ootdItem.color + "30" }]}>
                    <Ionicons name="shirt-outline" size={20} color={ootdItem.color} />
                  </View>
                )}
              </View>
            ))}
            {ootdItems.length > 5 && (
              <View style={[styles.ootdImageWrapper, { backgroundColor: theme.colors.surfaceAlt, justifyContent: "center", alignItems: "center" }]}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, fontWeight: "600" }}>+{ootdItems.length - 5}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.ootdActions}>
            <Pressable
              accessibilityLabel="View outfit"
              accessibilityRole="button"
              style={[styles.ootdBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                if (ootdOutfitId) {
                  router.push({ pathname: "/outfit-detail", params: { id: ootdOutfitId } });
                } else {
                  router.push("/(tabs)/suggest");
                }
              }}
            >
              <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
              <Text style={styles.ootdBtnText}>View</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Shuffle outfit suggestion"
              accessibilityRole="button"
              style={[styles.ootdBtn, { backgroundColor: theme.colors.surfaceAlt }]}
              onPress={() => {
                // Regenerate with a fresh suggestion
                const available = items.filter((i) => {
                  const status = i.laundryStatus ?? "clean";
                  return status !== "in_wash" && status !== "dry_cleaning";
                });
                const results = suggestOutfits(available, { maxResults: 1 });
                if (results.length > 0) {
                  setOotdItems(results[0].items);
                  setOotdLabel("Outfit of the Day");
                  setOotdOutfitId(null);
                }
              }}
            >
              <Ionicons name="refresh-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.ootdBtnText, { color: theme.colors.primary }]}>Shuffle</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Seasonal Rotation Banner (#79) */}
      {!loading && !seasonBannerDismissed && seasonalRotation && (
        <View style={styles.seasonBanner}>
          <Ionicons name="leaf-outline" size={18} color={theme.colors.warning} style={{ marginRight: 8 }} />
          <Text style={styles.seasonBannerText}>{seasonalRotation.message}</Text>
          <Pressable
            accessibilityLabel="Dismiss seasonal rotation banner"
            accessibilityRole="button"
            onPress={() => setSeasonBannerDismissed(true)}
            hitSlop={10}
            style={styles.seasonBannerDismiss}
          >
            <Ionicons name="close" size={18} color={theme.colors.textLight} />
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.loader}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={searchQuery ? "search-outline" : filter === "favorites" ? "heart-outline" : filter === "laundry" ? "water-outline" : "shirt-outline"}
          title={
            searchQuery
              ? "No results"
              : filter === "favorites"
                ? "No favourites yet"
                : filter === "laundry"
                  ? "All clean!"
                  : filter !== "all"
                    ? `No ${CATEGORY_LABELS[filter as ClothingCategory] ?? filter} items`
                    : "Your wardrobe is empty"
          }
          subtitle={
            searchQuery
              ? `Nothing matches "${searchQuery}". Try a different search.`
              : filter === "favorites"
                ? "Tap the heart icon on items to add them to your favourites!"
                : filter === "laundry"
                  ? "No items need washing. Everything is fresh and clean!"
                  : filter !== "all"
                    ? "Add items in this category to see them here."
                    : "Add your first clothing item to get started with outfit suggestions!"
          }
        />
      ) : photoOnlyMode ? (
        /* Photo-only grid view */
        <FlatList
          ref={photoListRef}
          key="photo-grid"
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={PHOTO_GRID_COLUMNS}
          columnWrapperStyle={{
            gap: photoTileGap,
          }}
          contentContainerStyle={styles.list}
          renderItem={renderPhotoTile}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      ) : filter === "all" ? (
        <SectionList
          ref={sectionListRef}
          key={`section-grid-${numColumns}`}
          sections={sections}
          keyExtractor={(item, index) =>
            `row-${index}-${item.map((i: ClothingItem) => i.id).join("-")}`
          }
          renderItem={renderSectionRow}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      ) : (
        <FlashList
          ref={listRef}
          key={`grid-${numColumns}`}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          estimatedItemSize={compact ? 100 : 220}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => renderCard(item)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}

      {/* Scroll to top button (#28) */}
      {showScrollTop && (
        <Pressable accessibilityLabel="Scroll to top" accessibilityRole="button" style={styles.scrollTopBtn} onPress={scrollToTop}>
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      )}

      {/* FAB - hidden in selection mode */}
      {!selectionMode && (
        <Pressable
          accessibilityLabel="Add new item"
          accessibilityRole="button"
          style={styles.fab}
          onPress={() => router.push("/add-item")}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Bulk Tag Modal (#70) */}
      <Modal
        visible={bulkTagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkTagModalVisible(false)}
      >
        <Pressable accessibilityLabel="Close tag modal" accessibilityRole="button" style={styles.bulkTagOverlay} onPress={() => setBulkTagModalVisible(false)}>
          <View style={[styles.bulkTagSheet, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.bulkTagTitle, { color: theme.colors.text }]}>
              Add Tag to {selectedIds.size} Item{selectedIds.size !== 1 ? "s" : ""}
            </Text>
            <TextInput
              accessibilityLabel="Enter tag name"
              style={[styles.bulkTagInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter tag name..."
              placeholderTextColor={theme.colors.textLight}
              value={bulkTagInput}
              onChangeText={setBulkTagInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleBulkAddTag}
            />
            <View style={styles.bulkTagActions}>
              <Pressable
                accessibilityLabel="Cancel adding tag"
                accessibilityRole="button"
                style={[styles.bulkTagCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setBulkTagModalVisible(false)}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Add tag to selected items"
                accessibilityRole="button"
                style={[styles.bulkTagSaveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleBulkAddTag}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Add Tag</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Bulk Laundry Status Modal */}
      <Modal
        visible={bulkLaundryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkLaundryModalVisible(false)}
      >
        <Pressable accessibilityLabel="Close laundry status modal" accessibilityRole="button" style={styles.bulkTagOverlay} onPress={() => setBulkLaundryModalVisible(false)}>
          <View style={[styles.bulkTagSheet, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.bulkTagTitle, { color: theme.colors.text }]}>
              Set Laundry Status
            </Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: theme.fontSize.sm }}>
              {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected
            </Text>
            {(["clean", "worn", "in_wash", "dry_cleaning"] as LaundryStatus[]).map((status) => (
              <Pressable
                key={status}
                accessibilityLabel={`Set status to ${LAUNDRY_STATUS_LABELS[status]}`}
                accessibilityRole="button"
                style={[styles.laundryOption, { borderColor: theme.colors.border }]}
                onPress={() => handleBulkLaundryStatus(status)}
              >
                <Ionicons
                  name={
                    status === "clean" ? "checkmark-circle" :
                    status === "worn" ? "shirt" :
                    status === "in_wash" ? "water" : "storefront"
                  }
                  size={20}
                  color={
                    status === "clean" ? "#10B981" :
                    status === "worn" ? "#F59E0B" :
                    status === "in_wash" ? "#3B82F6" : "#8B5CF6"
                  }
                />
                <Text style={[styles.laundryOptionText, { color: theme.colors.text }]}>
                  {LAUNDRY_STATUS_LABELS[status]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityLabel="Cancel laundry status change"
              accessibilityRole="button"
              style={[styles.bulkTagCancelBtn, { borderColor: theme.colors.border, marginTop: theme.spacing.sm }]}
              onPress={() => setBulkLaundryModalVisible(false)}
            >
              <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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

function createStyles(theme: ReturnType<typeof import("@/hooks/useTheme").useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    // --- Selection bar ---
    selectionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.primary + "14",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.primary + "30",
    },
    selectionBarText: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: theme.colors.primary,
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
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
    },
    selectionBarBtnText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
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
      borderColor: theme.colors.primary,
      backgroundColor: "rgba(255,255,255,0.9)",
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    // --- Top row ---
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
    },
    topRowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: "800",
      color: theme.colors.text,
    },
    // --- Sort ---
    sortToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary + "12",
    },
    sortToggleText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    sortMenu: {
      marginHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
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
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
    },
    sortMenuItemActive: {
      backgroundColor: theme.colors.primary + "10",
    },
    sortMenuItemText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
    },
    sortMenuItemTextActive: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    // --- Column toggle ---
    columnToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary + "12",
    },
    columnToggleText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    // --- Filter ---
    filterRow: {
      paddingTop: theme.spacing.sm,
    },
    filterList: {
      paddingHorizontal: theme.spacing.md,
    },
    // --- Summary Banner ---
    summaryBanner: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.primary + "10",
      borderRadius: theme.borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    summaryText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    // --- Seasonal Rotation Banner (#79) ---
    seasonBanner: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.warning + "14",
      borderRadius: theme.borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.warning,
    },
    seasonBannerText: {
      flex: 1,
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.warning,
    },
    seasonBannerDismiss: {
      marginLeft: 8,
      padding: 4,
    },
    // --- Loader / List ---
    loader: {
      flex: 1,
      justifyContent: "center",
    },
    list: {
      padding: theme.spacing.md,
      paddingBottom: 100,
    },
    row: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    sectionHeader: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    sectionHeaderText: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.text,
    },
    // --- Search Bar ---
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surfaceAlt,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    // --- Bulk Tag Modal ---
    bulkTagOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    bulkTagSheet: {
      width: "85%",
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
    },
    bulkTagTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      marginBottom: theme.spacing.md,
    },
    bulkTagInput: {
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      marginBottom: theme.spacing.md,
    },
    bulkTagActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    bulkTagCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
    },
    bulkTagSaveBtn: {
      flex: 1,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
    },
    // --- OOTD Widget ---
    ootdCard: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    ootdHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    ootdTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    ootdTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: theme.colors.text,
    },
    ootdImageRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: theme.spacing.sm,
    },
    ootdImageWrapper: {
      flex: 1,
      aspectRatio: 0.8,
      borderRadius: theme.borderRadius.sm,
      overflow: "hidden",
    },
    ootdImage: {
      width: "100%",
      height: "100%",
    },
    ootdImagePlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    ootdActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    ootdBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
    },
    ootdBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    // --- Laundry option styles ---
    laundryOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: theme.spacing.sm + 2,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xs,
    },
    laundryOptionText: {
      fontSize: theme.fontSize.md,
      fontWeight: "500",
    },
    // --- Scroll to top button (#28) ---
    scrollTopBtn: {
      position: "absolute",
      left: 20,
      bottom: 24,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    // --- FAB ---
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  });
}

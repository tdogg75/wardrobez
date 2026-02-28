import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import {
  exportAllData,
  importAllData,
  getWishlistItems,
  saveWishlistItem,
  deleteWishlistItem,
} from "@/services/storage";
import { Theme } from "@/constants/theme";
import { CATEGORY_LABELS, ARCHIVE_REASON_LABELS } from "@/models/types";
import type { ClothingCategory, ClothingItem, WishlistItem } from "@/models/types";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const daysBetween = (a: Date, b: Date) =>
  Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProfileScreen() {
  const router = useRouter();
  const { items, archivedItems, getFavorites, unarchiveItem, reload: reloadItems } = useClothingItems();
  const { outfits, reload: reloadOutfits } = useOutfits();

  // Refresh data every time the profile screen comes into focus
  // so worn stats, flags, etc. are always up-to-date
  useFocusEffect(
    useCallback(() => {
      reloadItems();
      reloadOutfits();
    }, [reloadItems, reloadOutfits])
  );

  /* ---------- section toggles ---------- */
  const [statsOpen, setStatsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [spendingOpen, setSpendingOpen] = useState(false);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [gapAnalysisOpen, setGapAnalysisOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);

  /* ---------- wishlist state ---------- */
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistModalVisible, setWishlistModalVisible] = useState(false);
  const [wlName, setWlName] = useState("");
  const [wlBrand, setWlBrand] = useState("");
  const [wlUrl, setWlUrl] = useState("");
  const [wlPrice, setWlPrice] = useState("");
  const [wlCategory, setWlCategory] = useState<ClothingCategory | "">("");
  const [wlNotes, setWlNotes] = useState("");

  /* ---------- derived data ---------- */
  const allActive: ClothingItem[] = items;

  const totalSpent = useMemo(
    () => allActive.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    [allActive],
  );

  const favorites = useMemo(() => getFavorites(), [getFavorites]);

  /* Map itemId -> latest worn date (from outfits) */
  const lastWornMap = useMemo(() => {
    const map: Record<string, Date> = {};
    for (const outfit of outfits) {
      if (outfit.wornDates.length === 0) continue;
      const latestOutfitDate = outfit.wornDates
        .map((d) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      for (const itemId of outfit.itemIds) {
        const prev = map[itemId];
        if (!prev || latestOutfitDate > prev) {
          map[itemId] = latestOutfitDate;
        }
      }
    }
    return map;
  }, [outfits]);

  /* Utilization rate: % of items worn at least once in last 120 days */
  const utilizationRate = useMemo(() => {
    if (allActive.length === 0) return 0;
    const now = new Date();
    const cutoff = 120;
    let wornCount = 0;
    for (const item of allActive) {
      const lastWorn = lastWornMap[item.id];
      if (lastWorn && daysBetween(now, lastWorn) <= cutoff) {
        wornCount++;
      }
    }
    return Math.round((wornCount / allActive.length) * 100);
  }, [allActive, lastWornMap]);

  /* --- Most Worn Items (top 5) --- */
  const mostWorn = useMemo(
    () =>
      [...allActive]
        .filter((i) => i.wearCount > 0)
        .sort((a, b) => b.wearCount - a.wearCount)
        .slice(0, 5),
    [allActive],
  );

  /* --- Most Worn by Category --- */
  const mostWornByCategory = useMemo(() => {
    const cats = [...new Set(allActive.map((i) => i.category))];
    const results: { category: ClothingCategory; item: ClothingItem }[] = [];
    for (const cat of cats) {
      const catItems = allActive
        .filter((i) => i.category === cat && i.wearCount > 0)
        .sort((a, b) => b.wearCount - a.wearCount);
      if (catItems.length > 0) {
        results.push({ category: cat, item: catItems[0] });
      }
    }
    return results.sort((a, b) => b.item.wearCount - a.item.wearCount);
  }, [allActive]);

  /* --- Least Worn Items (bottom 5 by wearCount) --- */
  const leastWorn = useMemo(
    () =>
      [...allActive]
        .sort((a, b) => a.wearCount - b.wearCount)
        .slice(0, 5),
    [allActive],
  );

  /* --- Not Worn in 30+ Days (or never) --- */
  const notWornRecently = useMemo(() => {
    const now = new Date();
    return allActive.filter((item) => {
      if (item.wearCount === 0) return true;
      const lastWorn = lastWornMap[item.id];
      if (!lastWorn) return true;
      return daysBetween(now, lastWorn) > 30;
    });
  }, [allActive, lastWornMap]);

  /* --- Spending by Category --- */
  const spendingByCategory = useMemo(() => {
    const map: Partial<Record<ClothingCategory, number>> = {};
    for (const item of allActive) {
      if (item.cost) {
        map[item.category] = (map[item.category] ?? 0) + item.cost;
      }
    }
    return Object.entries(map)
      .map(([cat, total]) => ({
        category: cat as ClothingCategory,
        total: total as number,
      }))
      .sort((a, b) => b.total - a.total);
  }, [allActive]);

  const maxSpend = useMemo(
    () => Math.max(...spendingByCategory.map((s) => s.total), 1),
    [spendingByCategory],
  );

  /* --- Cost per Wear --- */
  const costPerWear = useMemo(
    () =>
      allActive
        .filter((i) => i.wearCount > 0 && i.cost != null && i.cost > 0)
        .map((i) => ({
          item: i,
          cpw: (i.cost as number) / i.wearCount,
        }))
        .sort((a, b) => a.cpw - b.cpw),
    [allActive],
  );

  /* --- Color Palette Analysis --- */
  const NEUTRAL_NAMES = ["black", "white", "gray", "grey", "beige", "tan", "brown", "navy"];

  const colorPalette = useMemo(() => {
    const colorMap: Record<string, { hex: string; name: string; count: number }> = {};
    for (const item of allActive) {
      const name = (item.colorName ?? "Unknown").toLowerCase().trim();
      if (colorMap[name]) {
        colorMap[name].count += 1;
      } else {
        colorMap[name] = { hex: item.color, name: item.colorName ?? "Unknown", count: 1 };
      }
    }
    const sorted = Object.values(colorMap).sort((a, b) => b.count - a.count);
    const total = allActive.length || 1;
    const neutralCount = sorted
      .filter((c) => NEUTRAL_NAMES.some((n) => c.name.toLowerCase().includes(n)))
      .reduce((sum, c) => sum + c.count, 0);
    const neutralPct = neutralCount / total;
    const distinctFamilies = sorted.length;
    return { sorted, total, neutralPct, distinctFamilies };
  }, [allActive]);

  /* --- Wardrobe Gap Analysis --- */
  const ALL_CATEGORIES: ClothingCategory[] = [
    "tops", "bottoms", "dresses", "blazers", "jackets",
    "shoes", "accessories", "swimwear", "jewelry",
  ];

  const gapInsights = useMemo(() => {
    const catCounts: Record<ClothingCategory, number> = {} as any;
    for (const cat of ALL_CATEGORIES) {
      catCounts[cat] = 0;
    }
    for (const item of allActive) {
      catCounts[item.category] = (catCounts[item.category] ?? 0) + 1;
    }

    const insights: { key: string; icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];

    // Categories with 0 items
    for (const cat of ALL_CATEGORIES) {
      if (catCounts[cat] === 0) {
        insights.push({
          key: `empty-${cat}`,
          icon: "add-circle-outline",
          text: `No ${CATEGORY_LABELS[cat].toLowerCase()} in your wardrobe — consider adding some`,
        });
      }
    }

    // Tops outnumber bottoms by 3x+
    if (catCounts.tops > 0 && catCounts.bottoms > 0 && catCounts.tops >= catCounts.bottoms * 3) {
      insights.push({
        key: "tops-bottoms",
        icon: "swap-vertical-outline",
        text: `You have ${catCounts.tops} tops but only ${catCounts.bottoms} bottoms — consider adding versatile pants`,
      });
    }

    // No outerwear/jackets (both blazers and jackets count)
    if (catCounts.jackets === 0 && catCounts.blazers === 0) {
      insights.push({
        key: "no-outerwear",
        icon: "cloudy-outline",
        text: "No jackets for layering — essential for transitional weather",
      });
    }

    // No shoes
    if (catCounts.shoes === 0) {
      insights.push({
        key: "no-shoes",
        icon: "footsteps-outline",
        text: "Don't forget footwear to complete your outfits",
      });
    }

    // No accessories (accessories + jewelry)
    if (catCounts.accessories === 0 && catCounts.jewelry === 0) {
      insights.push({
        key: "no-accessories",
        icon: "diamond-outline",
        text: "Accessories can elevate any outfit — consider belts, scarves, or jewelry",
      });
    }

    return insights;
  }, [allActive]);

  /* --- Wishlist load / handlers --- */
  const loadWishlist = useCallback(async () => {
    const data = await getWishlistItems();
    setWishlistItems(data.filter((i) => !i.purchased));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWishlist();
    }, [loadWishlist])
  );

  const handleAddWishlistItem = async () => {
    if (!wlName.trim()) {
      Alert.alert("Name required", "Please enter a name for the wishlist item.");
      return;
    }
    const newItem: WishlistItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      name: wlName.trim(),
      brand: wlBrand.trim() || undefined,
      url: wlUrl.trim() || undefined,
      estimatedPrice: wlPrice ? parseFloat(wlPrice) : undefined,
      category: wlCategory || undefined,
      notes: wlNotes.trim() || undefined,
      createdAt: Date.now(),
    };
    await saveWishlistItem(newItem);
    setWlName("");
    setWlBrand("");
    setWlUrl("");
    setWlPrice("");
    setWlCategory("");
    setWlNotes("");
    setWishlistModalVisible(false);
    loadWishlist();
  };

  const handleDeleteWishlistItem = (item: WishlistItem) => {
    Alert.alert("Remove Item", `Remove "${item.name}" from your wishlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteWishlistItem(item.id);
          loadWishlist();
        },
      },
    ]);
  };

  /* --- Backup / Export --- */
  const handleExport = async () => {
    try {
      const backup = await exportAllData();
      const path = `${FileSystem.cacheDirectory}wardrobez-backup.json`;
      await FileSystem.writeAsStringAsync(path, backup);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Save Wardrobez Backup",
          UTI: "public.json",
        });
      } else {
        Alert.alert(
          "Backup Created",
          "Sharing is not available on this device. The backup file was saved internally."
        );
      }
    } catch {
      Alert.alert("Export Failed", "Could not export your wardrobe data.");
    }
  };

  const handleImport = async () => {
    Alert.alert(
      "Import Backup",
      "This will replace all your current wardrobe data with the backup. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
              });

              if (result.canceled || !result.assets?.[0]) {
                return;
              }

              const fileUri = result.assets[0].uri;
              const raw = await FileSystem.readAsStringAsync(fileUri);
              await importAllData(raw);
              Alert.alert(
                "Import Complete",
                "Your wardrobe has been restored from the backup. Restart the app to see changes."
              );
            } catch {
              Alert.alert("Import Failed", "Could not import the backup file. Make sure it's a valid wardrobez-backup.json file.");
            }
          },
        },
      ]
    );
  };

  /* --- Unarchive --- */
  const handleUnarchive = (item: ClothingItem) => {
    Alert.alert(
      "Unarchive Item",
      `Move "${item.name}" back to your active wardrobe?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unarchive",
          onPress: () => unarchiveItem(item.id),
        },
      ]
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Sub-components                                                    */
  /* ---------------------------------------------------------------- */

  const SectionHeader = ({
    icon,
    label,
    open,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    open: boolean;
    onPress: () => void;
  }) => (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={Theme.colors.primary}
          style={styles.menuIcon}
        />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons
        name={open ? "chevron-up" : "chevron-down"}
        size={20}
        color={Theme.colors.textSecondary}
      />
    </Pressable>
  );

  const SubHeading = ({ children }: { children: string }) => (
    <Text style={styles.subHeading}>{children}</Text>
  );

  const Divider = () => <View style={styles.divider} />;

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* -------- Header -------- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          hitSlop={12}
          onPress={() => {
            Alert.alert("Settings", "Wardrobez v1.0.0", [
              {
                text: "Export Backup",
                onPress: handleExport,
              },
              {
                text: "Import Backup",
                onPress: () => handleImport(),
              },
              {
                text: "Import from Gmail",
                onPress: () => router.push("/gmail-purchases"),
              },
              { text: "Close", style: "cancel" },
            ]);
          }}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={Theme.colors.text}
          />
        </Pressable>
      </View>

      {/* -------- Quick Stats (items, outfits, utilization) -------- */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{allActive.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{outfits.length}</Text>
          <Text style={styles.statLabel}>Outfits</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{utilizationRate}%</Text>
          <Text style={styles.statLabel}>Utilisation</Text>
        </View>
      </View>

      <Text style={styles.utilNote}>
        Items worn in the last 120 days
      </Text>

      {/* ============================================================ */}
      {/*  SPENDING                                                     */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="wallet-outline"
          label="Spending"
          open={spendingOpen}
          onPress={() => setSpendingOpen((v) => !v)}
        />

        {spendingOpen && (
          <View style={styles.sectionBody}>
            <View style={styles.spendTotalRow}>
              <Text style={styles.spendTotalLabel}>Total Spent</Text>
              <Text style={styles.spendTotalValue}>{fmt(totalSpent)}</Text>
            </View>

            <Divider />

            {/* Spending by Category */}
            <SubHeading>By Category</SubHeading>
            {spendingByCategory.length === 0 ? (
              <Text style={styles.emptyText}>No cost data recorded.</Text>
            ) : (
              spendingByCategory.map(({ category, total }) => (
                <View key={category} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>
                      {CATEGORY_LABELS[category]}
                    </Text>
                    <Text style={styles.barValue}>{fmt(total)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${(total / maxSpend) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}

            <Divider />

            {/* Cost per Wear */}
            <SubHeading>Cost per Wear</SubHeading>
            {costPerWear.length === 0 ? (
              <Text style={styles.emptyText}>
                No items with cost and wear data.
              </Text>
            ) : (
              costPerWear.map(({ item, cpw }) => (
                <Pressable
                  key={item.id}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {CATEGORY_LABELS[item.category]} - {item.wearCount} wear
                      {item.wearCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={styles.cpwValue}>{fmt(cpw)}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  STATS & REPORTS                                              */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="bar-chart-outline"
          label="Stats & Reports"
          open={statsOpen}
          onPress={() => setStatsOpen((v) => !v)}
        />

        {statsOpen && (
          <View style={styles.sectionBody}>
            {/* Most Worn Items */}
            <SubHeading>Most Worn Items</SubHeading>
            {mostWorn.length === 0 ? (
              <Text style={styles.emptyText}>No worn items yet.</Text>
            ) : (
              mostWorn.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {CATEGORY_LABELS[item.category]}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.wearCount}x
                    </Text>
                  </View>
                </Pressable>
              ))
            )}

            <Divider />

            {/* Most Worn by Category */}
            <SubHeading>Most Worn by Category</SubHeading>
            {mostWornByCategory.length === 0 ? (
              <Text style={styles.emptyText}>No worn items yet.</Text>
            ) : (
              mostWornByCategory.map(({ category, item }) => (
                <Pressable
                  key={category}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {CATEGORY_LABELS[category]}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.wearCount}x
                    </Text>
                  </View>
                </Pressable>
              ))
            )}

            <Divider />

            {/* Least Worn Items */}
            <SubHeading>Least Worn Items</SubHeading>
            {leastWorn.length === 0 ? (
              <Text style={styles.emptyText}>No items yet.</Text>
            ) : (
              leastWorn.map((item) => {
                const lastWorn = lastWornMap[item.id];
                let detail: string;
                if (item.wearCount === 0 || !lastWorn) {
                  detail = "Never worn";
                } else {
                  detail = `${daysBetween(new Date(), lastWorn)}d ago`;
                }
                return (
                  <Pressable
                    key={item.id}
                    style={styles.listItem}
                    onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                  >
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.listItemSub}>{detail}</Text>
                    </View>
                    <View style={[styles.badge, styles.badgeMuted]}>
                      <Text style={[styles.badgeText, styles.badgeTextMuted]}>
                        {item.wearCount}x
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            <Divider />

            {/* Not Worn in 30+ Days */}
            <SubHeading>Not Worn in 30+ Days</SubHeading>
            {notWornRecently.length === 0 ? (
              <Text style={styles.emptyText}>
                All items worn recently!
              </Text>
            ) : (
              notWornRecently.map((item) => {
                const lastWorn = lastWornMap[item.id];
                let detail: string;
                if (item.wearCount === 0 || !lastWorn) {
                  detail = "Never worn";
                } else {
                  detail = `${daysBetween(new Date(), lastWorn)} days ago`;
                }
                return (
                  <Pressable
                    key={item.id}
                    style={styles.listItem}
                    onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                  >
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.listItemSub}>
                        {CATEGORY_LABELS[item.category]} - {detail}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  COLOUR PALETTE ANALYSIS                                      */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="color-palette-outline"
          label="Wardrobe Colour Palette"
          open={colorPaletteOpen}
          onPress={() => setColorPaletteOpen((v) => !v)}
        />

        {colorPaletteOpen && (
          <View style={styles.sectionBody}>
            {allActive.length === 0 ? (
              <Text style={styles.emptyText}>No items in your wardrobe yet.</Text>
            ) : (
              <>
                {/* Horizontal colour bar */}
                <View style={styles.colorBarContainer}>
                  {colorPalette.sorted.map((c) => (
                    <View
                      key={c.name}
                      style={[
                        styles.colorStripe,
                        {
                          backgroundColor: c.hex,
                          flex: c.count / colorPalette.total,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Top 5 colours */}
                <SubHeading>Top Colours</SubHeading>
                {colorPalette.sorted.slice(0, 5).map((c) => (
                  <View key={c.name} style={styles.colorListRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                    <Text style={styles.colorListText}>
                      {c.name} ({c.count} item{c.count !== 1 ? "s" : ""})
                    </Text>
                  </View>
                ))}

                {/* Tips */}
                {colorPalette.neutralPct > 0.7 && (
                  <View style={styles.tipCard}>
                    <Ionicons name="bulb-outline" size={16} color={Theme.colors.warning} />
                    <Text style={styles.tipText}>
                      Your wardrobe is mostly neutrals — great foundation! Consider adding a statement
                      color.
                    </Text>
                  </View>
                )}
                {colorPalette.distinctFamilies < 3 && (
                  <View style={styles.tipCard}>
                    <Ionicons name="bulb-outline" size={16} color={Theme.colors.warning} />
                    <Text style={styles.tipText}>
                      Limited color variety — adding new colors could expand your outfit options.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  WARDROBE GAP ANALYSIS                                        */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="analytics-outline"
          label="Wardrobe Gaps"
          open={gapAnalysisOpen}
          onPress={() => setGapAnalysisOpen((v) => !v)}
        />

        {gapAnalysisOpen && (
          <View style={styles.sectionBody}>
            {gapInsights.length === 0 ? (
              <View style={styles.tipCard}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Theme.colors.success} />
                <Text style={styles.tipText}>
                  Your wardrobe is well-rounded — no major gaps detected!
                </Text>
              </View>
            ) : (
              gapInsights.map((insight) => (
                <View key={insight.key} style={styles.gapCard}>
                  <Ionicons
                    name={insight.icon}
                    size={18}
                    color={Theme.colors.warning}
                    style={{ marginRight: Theme.spacing.sm }}
                  />
                  <Text style={styles.gapText}>{insight.text}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  WISHLIST                                                      */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="gift-outline"
          label="Wishlist"
          open={wishlistOpen}
          onPress={() => setWishlistOpen((v) => !v)}
        />

        {wishlistOpen && (
          <View style={styles.sectionBody}>
            {wishlistItems.length === 0 ? (
              <Text style={styles.emptyText}>Your wishlist is empty.</Text>
            ) : (
              wishlistItems.map((wItem) => (
                <View key={wItem.id} style={styles.wishlistRow}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {wItem.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {[
                        wItem.brand,
                        wItem.estimatedPrice != null ? fmt(wItem.estimatedPrice) : null,
                      ]
                        .filter(Boolean)
                        .join(" — ") || "No details"}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.wishlistDeleteBtn}
                    onPress={() => handleDeleteWishlistItem(wItem)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
                  </Pressable>
                </View>
              ))
            )}

            <Pressable
              style={styles.addWishlistBtn}
              onPress={() => setWishlistModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.addWishlistBtnText}>Add to Wishlist</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* -------- Wishlist Modal -------- */}
      <Modal
        visible={wishlistModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWishlistModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Wishlist</Text>
              <Pressable hitSlop={12} onPress={() => setWishlistModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={wlName}
                onChangeText={setWlName}
                placeholder="Item name"
                placeholderTextColor={Theme.colors.textLight}
              />

              <Text style={styles.modalLabel}>Brand</Text>
              <TextInput
                style={styles.modalInput}
                value={wlBrand}
                onChangeText={setWlBrand}
                placeholder="Brand (optional)"
                placeholderTextColor={Theme.colors.textLight}
              />

              <Text style={styles.modalLabel}>URL</Text>
              <TextInput
                style={styles.modalInput}
                value={wlUrl}
                onChangeText={setWlUrl}
                placeholder="Product URL (optional)"
                placeholderTextColor={Theme.colors.textLight}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={styles.modalLabel}>Estimated Price</Text>
              <TextInput
                style={styles.modalInput}
                value={wlPrice}
                onChangeText={setWlPrice}
                placeholder="0.00"
                placeholderTextColor={Theme.colors.textLight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.modalLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryPickerScroll}
              >
                {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryChip,
                      wlCategory === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setWlCategory(wlCategory === cat ? "" : cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        wlCategory === cat && styles.categoryChipTextActive,
                      ]}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                value={wlNotes}
                onChangeText={setWlNotes}
                placeholder="Notes (optional)"
                placeholderTextColor={Theme.colors.textLight}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <Pressable style={styles.modalSaveBtn} onPress={handleAddWishlistItem}>
              <Text style={styles.modalSaveBtnText}>Add Item</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/*  ARCHIVED ITEMS                                               */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="archive-outline"
          label="Archived Items"
          open={archivedOpen}
          onPress={() => setArchivedOpen((v) => !v)}
        />

        {archivedOpen && (
          <View style={styles.sectionBody}>
            {archivedItems.length === 0 ? (
              <Text style={styles.emptyText}>No archived items.</Text>
            ) : (
              archivedItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {item.archiveReason
                        ? ARCHIVE_REASON_LABELS[item.archiveReason]
                        : "Archived"}
                      {item.archivedAt
                        ? ` - ${new Date(item.archivedAt).toLocaleDateString()}`
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.unarchiveBtn}
                    onPress={() => handleUnarchive(item)}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color={Theme.colors.primary} />
                    <Text style={styles.unarchiveBtnText}>Unarchive</Text>
                  </Pressable>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  FAVOURITES                                                   */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <SectionHeader
          icon="heart-outline"
          label="Favourites"
          open={favoritesOpen}
          onPress={() => setFavoritesOpen((v) => !v)}
        />

        {favoritesOpen && (
          <View style={styles.sectionBody}>
            {favorites.length === 0 ? (
              <Text style={styles.emptyText}>No favourite items yet.</Text>
            ) : (
              favorites.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <Ionicons
                    name="heart"
                    size={16}
                    color={Theme.colors.secondary}
                    style={{ marginRight: Theme.spacing.sm }}
                  />
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {CATEGORY_LABELS[item.category]}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* ============================================================ */}
      {/*  GMAIL PURCHASES                                              */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <Pressable
          style={styles.gmailSection}
          onPress={() => router.push("/gmail-purchases")}
        >
          <View style={styles.menuLeft}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={Theme.colors.primary}
              style={styles.menuIcon}
            />
            <View>
              <Text style={styles.menuLabel}>Import from Gmail</Text>
              <Text style={styles.gmailHint}>
                Scan purchase emails for clothing & accessories
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* ============================================================ */}
      {/*  BACKUP & RESTORE                                             */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <View style={styles.backupSection}>
          <Ionicons name="cloud-download-outline" size={20} color={Theme.colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Backup & Restore</Text>
        </View>
        <View style={styles.backupButtons}>
          <Pressable style={styles.backupBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={18} color={Theme.colors.primary} />
            <Text style={styles.backupBtnText}>Export Backup</Text>
          </Pressable>
          <Pressable style={styles.backupBtn} onPress={handleImport}>
            <Ionicons name="push-outline" size={18} color={Theme.colors.primary} />
            <Text style={styles.backupBtnText}>Import Backup</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: 100,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Theme.spacing.lg,
  },
  headerTitle: {
    fontSize: Theme.fontSize.title,
    fontWeight: "700",
    color: Theme.colors.text,
  },

  /* Quick Stats */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
    marginHorizontal: Theme.spacing.xs,
    shadowColor: Theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: Theme.fontSize.xl,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  statLabel: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.xs,
  },
  utilNote: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    textAlign: "center",
    marginBottom: Theme.spacing.lg,
  },

  /* Card wrapper for each section */
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.md,
    shadowColor: Theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },

  /* Menu row (tappable header) */
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: Theme.spacing.sm,
  },
  menuLabel: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "600",
    color: Theme.colors.text,
  },

  /* Expanded section body */
  sectionBody: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },

  /* Sub-heading inside a section */
  subHeading: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.border,
    marginVertical: Theme.spacing.md,
  },

  /* Spending total */
  spendTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Theme.spacing.sm,
  },
  spendTotalLabel: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  spendTotalValue: {
    fontSize: Theme.fontSize.xl,
    fontWeight: "700",
    color: Theme.colors.primary,
  },

  /* Generic list item row */
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Theme.spacing.sm,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "500",
    color: Theme.colors.text,
  },
  listItemSub: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },

  /* Badge (wear count) */
  badge: {
    backgroundColor: Theme.colors.primaryLight + "22",
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  badgeText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  badgeMuted: {
    backgroundColor: Theme.colors.surfaceAlt,
  },
  badgeTextMuted: {
    color: Theme.colors.textSecondary,
  },

  /* Bar chart rows */
  barRow: {
    marginBottom: Theme.spacing.sm,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.xs,
  },
  barLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "500",
    color: Theme.colors.text,
  },
  barValue: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  barTrack: {
    height: 8,
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: Theme.borderRadius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },

  /* Cost per wear value */
  cpwValue: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },

  /* Empty text */
  emptyText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textLight,
    fontStyle: "italic",
    paddingVertical: Theme.spacing.sm,
  },

  /* Unarchive button */
  unarchiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  unarchiveBtnText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
  },

  /* Gmail section */
  gmailSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  gmailHint: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },

  /* Backup section */
  backupSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  backupButtons: {
    flexDirection: "row",
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  backupBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  backupBtnText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
  },

  /* Colour Palette */
  colorBarContainer: {
    flexDirection: "row",
    height: 24,
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
    marginBottom: Theme.spacing.md,
  },
  colorStripe: {
    height: 24,
  },
  colorListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Theme.spacing.xs,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: Theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  colorListText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
  },

  /* Tip card */
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Theme.colors.warning + "14",
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
    lineHeight: 18,
  },

  /* Gap Analysis */
  gapCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  gapText: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
    lineHeight: 18,
  },

  /* Wishlist */
  wishlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  wishlistDeleteBtn: {
    padding: Theme.spacing.xs,
  },
  addWishlistBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  addWishlistBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.borderRadius.lg,
    borderTopRightRadius: Theme.borderRadius.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Theme.spacing.md,
  },
  modalTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  modalInput: {
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 10,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
  },
  modalInputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  categoryPickerScroll: {
    marginBottom: Theme.spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surfaceAlt,
    marginRight: Theme.spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: Theme.colors.primary,
  },
  categoryChipText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalSaveBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Theme.spacing.md,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
  },
});

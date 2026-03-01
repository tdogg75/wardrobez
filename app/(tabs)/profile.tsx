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
  Image,
  ActivityIndicator,
  Linking,
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
  moveWishlistToWardrobe,
} from "@/services/storage";
import { fetchProductFromUrl } from "@/services/productSearch";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";
import { hexToHSL } from "@/constants/colors";
import { CATEGORY_LABELS, ARCHIVE_REASON_LABELS } from "@/models/types";
import type { ClothingCategory, ClothingItem, WishlistItem, InspirationPin } from "@/models/types";
import { MoodBoard } from "@/components/MoodBoard";
import {
  getInspirationPins,
  saveInspirationPin,
  deleteInspirationPin,
  getPackingLists,
  savePackingList,
  deletePackingList,
} from "@/services/storage";
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
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { items, archivedItems, getFavorites, unarchiveItem, reload: reloadItems } = useClothingItems();
  const { outfits, reload: reloadOutfits } = useOutfits();

  // Refresh data every time the profile screen comes into focus
  // so worn stats, flags, etc. are always up-to-date
  useFocusEffect(
    useCallback(() => {
      reloadItems();
      reloadOutfits();
      getInspirationPins().then(setInspirationPins);
    }, [reloadItems, reloadOutfits])
  );

  /* ---------- profile tabs ---------- */
  const [profileTab, setProfileTab] = useState<"overview" | "analytics" | "tools" | "shopping">("overview");

  /* ---------- section toggles ---------- */
  const [statsOpen, setStatsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [spendingOpen, setSpendingOpen] = useState(false);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [gapAnalysisOpen, setGapAnalysisOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);

  const [brandInsightsOpen, setBrandInsightsOpen] = useState(false);
  const [roiOpen, setRoiOpen] = useState(false);
  const [ageTrackerOpen, setAgeTrackerOpen] = useState(false);
  const [sustainabilityOpen, setSustainabilityOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  const [consistencyOpen, setConsistencyOpen] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [saleAlertsOpen, setSaleAlertsOpen] = useState(false);
  const [splurgeOpen, setSplurgeOpen] = useState(false);
  const [resaleOpen, setResaleOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);

  /* ---------- splurge calculator state ---------- */
  const [splurgePrice, setSplurgePrice] = useState("");
  const [splurgeCategory, setSplurgeCategory] = useState<ClothingCategory | "">("");
  const [splurgeResult, setSplurgeResult] = useState<{ verdict: string; reason: string } | null>(null);

  /* ---------- inspiration board state ---------- */
  const [inspirationPins, setInspirationPins] = useState<InspirationPin[]>([]);

  /* ---------- packing list / travel mode state (#88) ---------- */
  const [tripDays, setTripDays] = useState("5");
  const [tripDestination, setTripDestination] = useState("");
  const [tripClimate, setTripClimate] = useState<"warm" | "cold" | "mild" | "">("");
  const [tripType, setTripType] = useState<"casual" | "business" | "beach" | "adventure" | "">("");
  const [packingResult, setPackingResult] = useState<{ category: string; name: string; checked: boolean }[]>([]);

  /* ---------- wishlist state ---------- */
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistModalVisible, setWishlistModalVisible] = useState(false);
  const [wlName, setWlName] = useState("");
  const [wlBrand, setWlBrand] = useState("");
  const [wlUrl, setWlUrl] = useState("");
  const [wlPrice, setWlPrice] = useState("");
  const [wlCategory, setWlCategory] = useState<ClothingCategory | "">("");
  const [wlNotes, setWlNotes] = useState("");
  const [wlImageUri, setWlImageUri] = useState("");
  const [wlFetchingUrl, setWlFetchingUrl] = useState(false);
  const [wlEditingItem, setWlEditingItem] = useState<WishlistItem | null>(null);

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
    "tops", "bottoms", "shorts", "skirts", "dresses", "jumpsuits", "blazers", "jackets",
    "shoes", "accessories", "purse", "swimwear", "jewelry",
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

  /* --- Brand Stats (#6) --- */
  const brandStats = useMemo(() => {
    const map: Record<string, { brand: string; count: number; totalCost: number }> = {};
    for (const item of allActive) {
      const brand = item.brand?.trim() || "Unknown";
      if (!map[brand]) map[brand] = { brand, count: 0, totalCost: 0 };
      map[brand].count++;
      map[brand].totalCost += item.cost ?? 0;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [allActive]);

  /* --- Wardrobe Age (#5) --- */
  const getItemAge = (item: ClothingItem) => {
    const dateMs = item.purchaseDate ? new Date(item.purchaseDate).getTime() : item.createdAt;
    return Date.now() - dateMs;
  };

  const avgItemAge = useMemo(() => {
    if (allActive.length === 0) return "N/A";
    const avgMs = allActive.reduce((sum, i) => sum + getItemAge(i), 0) / allActive.length;
    const months = Math.round(avgMs / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return "< 1 month";
    if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return `${years}y ${rem}mo`;
  }, [allActive]);

  const oldestItem = useMemo(() => {
    if (allActive.length === 0) return null;
    return [...allActive].sort((a, b) => getItemAge(b) - getItemAge(a))[0];
  }, [allActive]);

  const newestItem = useMemo(() => {
    if (allActive.length === 0) return null;
    return [...allActive].sort((a, b) => getItemAge(a) - getItemAge(b))[0];
  }, [allActive]);

  const itemsOver3Years = useMemo(() => {
    const threeYearsMs = 3 * 365 * 24 * 60 * 60 * 1000;
    return allActive.filter((i) => getItemAge(i) > threeYearsMs);
  }, [allActive]);

  /* --- Sustainability Score (#37) --- */
  const sustainableCount = useMemo(() => allActive.filter((i) => i.sustainable).length, [allActive]);

  /* --- Duplicate Detector (#36) --- */
  const duplicateGroups = useMemo(() => {
    const groups: ClothingItem[][] = [];
    const checked = new Set<string>();
    for (let i = 0; i < allActive.length; i++) {
      if (checked.has(allActive[i].id)) continue;
      const group: ClothingItem[] = [allActive[i]];
      for (let j = i + 1; j < allActive.length; j++) {
        if (checked.has(allActive[j].id)) continue;
        if (
          allActive[i].category === allActive[j].category &&
          allActive[i].subCategory === allActive[j].subCategory &&
          allActive[i].colorName?.toLowerCase() === allActive[j].colorName?.toLowerCase()
        ) {
          group.push(allActive[j]);
          checked.add(allActive[j].id);
        }
      }
      if (group.length > 1) {
        groups.push(group);
        checked.add(allActive[i].id);
      }
    }
    return groups;
  }, [allActive]);

  /* --- Style Consistency Score (#3) --- */
  const consistencyData = useMemo(() => {
    if (allActive.length === 0) return { categoryFocus: 0, colorHarmony: 0, overall: 0 };

    // Category focus: % of items in top 3 categories
    const catCounts: Record<string, number> = {};
    for (const item of allActive) {
      catCounts[item.category] = (catCounts[item.category] ?? 0) + 1;
    }
    const sortedCats = Object.values(catCounts).sort((a, b) => b - a);
    const top3CatCount = sortedCats.slice(0, 3).reduce((s, c) => s + c, 0);
    const categoryFocus = Math.round((top3CatCount / allActive.length) * 100);

    // Color harmony: % of items using top 5 colors
    const colorCounts: Record<string, number> = {};
    for (const item of allActive) {
      const name = (item.colorName ?? "Unknown").toLowerCase().trim();
      colorCounts[name] = (colorCounts[name] ?? 0) + 1;
    }
    const sortedColors = Object.values(colorCounts).sort((a, b) => b - a);
    const top5ColorCount = sortedColors.slice(0, 5).reduce((s, c) => s + c, 0);
    const colorHarmony = Math.round((top5ColorCount / allActive.length) * 100);

    // Overall: weighted average (50/50)
    const overall = Math.round((categoryFocus + colorHarmony) / 2);

    return { categoryFocus, colorHarmony, overall };
  }, [allActive]);

  /* --- Smart Shopping Suggestions (#32) --- */
  const shoppingSuggestions = useMemo(() => {
    if (allActive.length === 0) return [];

    const catCounts: Partial<Record<ClothingCategory, number>> = {};
    for (const cat of ALL_CATEGORIES) {
      catCounts[cat] = 0;
    }
    for (const item of allActive) {
      catCounts[item.category] = (catCounts[item.category] ?? 0) + 1;
    }

    const sorted = (Object.entries(catCounts) as [ClothingCategory, number][])
      .sort((a, b) => a[1] - b[1]);

    const suggestions: { key: string; text: string }[] = [];

    // Find categories with fewest items compared to the highest
    const maxCount = sorted[sorted.length - 1]?.[1] ?? 0;
    const maxCatLabel = sorted[sorted.length - 1]
      ? CATEGORY_LABELS[sorted[sorted.length - 1][0]]
      : "";

    for (const [cat, count] of sorted) {
      if (count === 0) {
        suggestions.push({
          key: `missing-${cat}`,
          text: `You have no ${CATEGORY_LABELS[cat].toLowerCase()}. Consider adding some to round out your wardrobe.`,
        });
      } else if (maxCount > 0 && count <= maxCount * 0.2 && count < 3) {
        suggestions.push({
          key: `low-${cat}`,
          text: `You have ${maxCount} ${maxCatLabel.toLowerCase()} but only ${count} ${CATEGORY_LABELS[cat].toLowerCase()}. Consider adding a ${CATEGORY_LABELS[cat].toLowerCase().replace(/s$/, "")}.`,
        });
      }
    }

    // Check outerwear specifically
    const jacketCount = (catCounts.jackets ?? 0) + (catCounts.blazers ?? 0);
    if (jacketCount < 2 && allActive.length >= 5) {
      suggestions.push({
        key: "need-outerwear",
        text: `You only have ${jacketCount} outerwear piece${jacketCount !== 1 ? "s" : ""}. A versatile jacket can elevate many outfits.`,
      });
    }

    return suggestions.slice(0, 6);
  }, [allActive]);

  /* --- Resale Value Estimator (#38) --- */
  const resaleEstimates = useMemo(() => {
    return allActive
      .filter((i) => i.cost && i.cost > 0)
      .map((item) => {
        const ageMonths = Math.max(1, Math.round((Date.now() - item.createdAt) / (30 * 24 * 60 * 60 * 1000)));
        const wears = item.wearCount || 0;
        const cost = item.cost!;
        // Depreciation: ~15% first month, then ~5% per month, floor at 10%
        let depreciationRate = 0.85 * Math.pow(0.95, Math.min(ageMonths - 1, 24));
        depreciationRate = Math.max(depreciationRate, 0.10);
        // Condition bonus: well-maintained items (low wear per month) retain more value
        const wearPerMonth = wears / ageMonths;
        const conditionMultiplier = wearPerMonth > 8 ? 0.7 : wearPerMonth > 4 ? 0.85 : 1.0;
        // Brand premium: known luxury brands retain 10% more
        const brandLower = (item.brand ?? "").toLowerCase();
        const luxuryBrands = ["gucci", "prada", "louis vuitton", "chanel", "hermes", "burberry", "dior", "versace", "armani"];
        const brandBonus = luxuryBrands.some((b) => brandLower.includes(b)) ? 1.15 : 1.0;
        const estimate = Math.round(cost * depreciationRate * conditionMultiplier * brandBonus);
        return { item, estimate, pctRetained: Math.round((estimate / cost) * 100) };
      })
      .sort((a, b) => b.estimate - a.estimate)
      .slice(0, 10);
  }, [allActive]);

  /* --- Sale Alert Wishlist Items (#33) --- */
  const wishlistWithAlerts = useMemo(() => {
    return wishlistItems.filter((w) => w.targetPrice && w.estimatedPrice && w.estimatedPrice > 0);
  }, [wishlistItems]);

  /* --- Splurge Calculator (#35) --- */
  const calculateSplurge = () => {
    const price = parseFloat(splurgePrice);
    if (!price || price <= 0 || !splurgeCategory) {
      setSplurgeResult({ verdict: "Enter details", reason: "Please enter a price and select a category." });
      return;
    }
    // Average cost in this category
    const catItems = allActive.filter((i) => i.category === splurgeCategory && i.cost && i.cost > 0);
    const avgCost = catItems.length > 0 ? catItems.reduce((s, i) => s + (i.cost ?? 0), 0) / catItems.length : 0;
    // Average wears in this category
    const avgWears = catItems.length > 0 ? catItems.reduce((s, i) => s + i.wearCount, 0) / catItems.length : 10;
    // Estimated cost per wear if you wear it as much as average
    const estimatedCPW = avgWears > 0 ? price / avgWears : price;
    // Total wardrobe avg CPW
    const allWithCost = allActive.filter((i) => i.cost && i.cost > 0 && i.wearCount > 0);
    const globalAvgCPW = allWithCost.length > 0 ? allWithCost.reduce((s, i) => s + (i.cost! / i.wearCount), 0) / allWithCost.length : 5;

    let verdict: string;
    let reason: string;

    if (avgCost > 0 && price > avgCost * 3) {
      if (estimatedCPW < globalAvgCPW * 1.5) {
        verdict = "Worth It";
        reason = `At ${fmt(price)} it's ${(price / avgCost).toFixed(1)}x your avg ${CATEGORY_LABELS[splurgeCategory].toLowerCase()} cost (${fmt(avgCost)}), but if you wear it ${Math.round(avgWears)} times, the cost-per-wear (${fmt(estimatedCPW)}) is reasonable.`;
      } else {
        verdict = "Think Twice";
        reason = `At ${fmt(price)} it's ${(price / avgCost).toFixed(1)}x your avg for ${CATEGORY_LABELS[splurgeCategory].toLowerCase()} (${fmt(avgCost)}). Estimated cost-per-wear: ${fmt(estimatedCPW)} vs your wardrobe avg of ${fmt(globalAvgCPW)}.`;
      }
    } else if (avgCost > 0 && price <= avgCost * 1.5) {
      verdict = "Go For It";
      reason = `At ${fmt(price)}, it's in line with what you normally spend on ${CATEGORY_LABELS[splurgeCategory].toLowerCase()} (avg ${fmt(avgCost)}). Not really a splurge!`;
    } else {
      verdict = estimatedCPW < 10 ? "Worth It" : "Consider Carefully";
      reason = catItems.length === 0
        ? `No existing ${CATEGORY_LABELS[splurgeCategory].toLowerCase()} to compare against. Consider how often you'd wear it.`
        : `Estimated cost-per-wear: ${fmt(estimatedCPW)}. ${estimatedCPW < 10 ? "That's reasonable!" : "Make sure you'll wear it enough."}`;
    }

    setSplurgeResult({ verdict, reason });
  };

  /* --- Packing List Generator / Travel Mode (#12, #88) --- */
  const generatePackingList = () => {
    const days = parseInt(tripDays, 10) || 5;
    const result: { category: string; name: string; checked: boolean }[] = [];
    const climate = tripClimate || "mild";
    const type = tripType || "casual";

    const itemsByCategory: Partial<Record<ClothingCategory, ClothingItem[]>> = {};
    for (const item of allActive) {
      if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
      itemsByCategory[item.category]!.push(item);
    }

    const pickRandom = (arr: ClothingItem[], count: number): ClothingItem[] => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    // Climate-aware fabric filter: prefer appropriate fabrics
    const climateFabrics = (items: ClothingItem[]): ClothingItem[] => {
      if (climate === "warm") {
        const preferred = items.filter((i) => ["cotton", "linen", "silk", "nylon"].includes(i.fabricType));
        return preferred.length >= 2 ? preferred : items;
      }
      if (climate === "cold") {
        const preferred = items.filter((i) => ["wool", "cashmere", "fleece", "leather", "denim"].includes(i.fabricType));
        return preferred.length >= 2 ? preferred : items;
      }
      return items;
    };

    // Tops: ~1.5 per day
    const topsNeeded = Math.ceil(days * 1.5);
    const availableTops = climateFabrics(itemsByCategory.tops ?? []);
    const pickedTops = pickRandom(availableTops, Math.min(topsNeeded, availableTops.length));
    for (const t of pickedTops) {
      result.push({ category: "Tops", name: t.name, checked: false });
    }
    if (pickedTops.length < topsNeeded) {
      const remaining = topsNeeded - pickedTops.length;
      for (let i = 0; i < remaining; i++) result.push({ category: "Tops", name: `Extra top ${i + 1} (buy/borrow)`, checked: false });
    }

    // Bottoms: 1 per 2 days
    const bottomsNeeded = Math.ceil(days / 2);
    let bottomPool = [...(itemsByCategory.bottoms ?? [])];
    if (climate === "warm") bottomPool = [...bottomPool, ...(itemsByCategory.shorts ?? []), ...(itemsByCategory.skirts ?? [])];
    else bottomPool = [...bottomPool, ...(itemsByCategory.skirts ?? [])];
    const availableBottoms = climateFabrics(bottomPool);
    const pickedBottoms = pickRandom(availableBottoms, Math.min(bottomsNeeded, availableBottoms.length));
    for (const b of pickedBottoms) {
      result.push({ category: "Bottoms", name: b.name, checked: false });
    }
    if (pickedBottoms.length < bottomsNeeded) {
      const remaining = bottomsNeeded - pickedBottoms.length;
      for (let i = 0; i < remaining; i++) result.push({ category: "Bottoms", name: `Extra bottom ${i + 1} (buy/borrow)`, checked: false });
    }

    // Outerwear: 1 for mild/cold, skip for warm beach
    if (climate !== "warm" || type !== "beach") {
      const outerwearCount = climate === "cold" ? 2 : 1;
      const availableOuterwear = [...(itemsByCategory.jackets ?? []), ...(itemsByCategory.blazers ?? [])];
      if (availableOuterwear.length > 0) {
        const picked = pickRandom(availableOuterwear, Math.min(outerwearCount, availableOuterwear.length));
        for (const o of picked) result.push({ category: "Outerwear", name: o.name, checked: false });
      } else {
        result.push({ category: "Outerwear", name: "Jacket (buy/borrow)", checked: false });
      }
    }

    // Shoes: 1-2 based on trip length, climate-aware
    const shoesNeeded = days > 5 ? 2 : 1;
    const availableShoes = itemsByCategory.shoes ?? [];
    const pickedShoes = pickRandom(availableShoes, Math.min(shoesNeeded, availableShoes.length));
    for (const s of pickedShoes) {
      result.push({ category: "Shoes", name: s.name, checked: false });
    }
    if (pickedShoes.length < shoesNeeded) {
      result.push({ category: "Shoes", name: "Extra pair (buy/borrow)", checked: false });
    }

    // Dresses if available and trip > 3 days
    if (days > 3) {
      const availableDresses = itemsByCategory.dresses ?? [];
      if (availableDresses.length > 0) {
        const picked = pickRandom(availableDresses, 1);
        result.push({ category: "Dresses", name: picked[0].name, checked: false });
      }
    }

    // Beach trip: add swimwear
    if (type === "beach" || climate === "warm") {
      const availableSwim = itemsByCategory.swimwear ?? [];
      if (availableSwim.length > 0) {
        const picked = pickRandom(availableSwim, Math.min(2, availableSwim.length));
        for (const s of picked) result.push({ category: "Swimwear", name: s.name, checked: false });
      } else {
        result.push({ category: "Swimwear", name: "Swimsuit (buy/borrow)", checked: false });
      }
    }

    // Business trip: include blazers
    if (type === "business") {
      const availableBl = itemsByCategory.blazers ?? [];
      if (availableBl.length > 0) {
        const picked = pickRandom(availableBl, 1);
        result.push({ category: "Business", name: picked[0].name, checked: false });
      } else {
        result.push({ category: "Business", name: "Blazer (buy/borrow)", checked: false });
      }
    }

    // Accessories: 1-3
    const accessoryCount = type === "business" ? 3 : 2;
    const availableAccessories = [...(itemsByCategory.accessories ?? []), ...(itemsByCategory.jewelry ?? [])];
    if (availableAccessories.length > 0) {
      const picked = pickRandom(availableAccessories, Math.min(accessoryCount, availableAccessories.length));
      for (const a of picked) {
        result.push({ category: "Accessories", name: a.name, checked: false });
      }
    }

    // Purse
    const availablePurses = itemsByCategory.purse ?? [];
    if (availablePurses.length > 0) {
      const picked = pickRandom(availablePurses, 1);
      result.push({ category: "Bags", name: picked[0].name, checked: false });
    }

    // Destination header
    if (tripDestination.trim()) {
      result.unshift({ category: "Trip", name: `${tripDestination} — ${days} days (${climate}, ${type})`, checked: false });
    }

    setPackingResult(result);
  };

  const togglePackingItem = (index: number) => {
    setPackingResult((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  };

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

  const resetWlForm = () => {
    setWlName("");
    setWlBrand("");
    setWlUrl("");
    setWlPrice("");
    setWlCategory("");
    setWlNotes("");
    setWlImageUri("");
    setWlEditingItem(null);
  };

  const openWlAddModal = () => {
    resetWlForm();
    setWishlistModalVisible(true);
  };

  const openWlEditModal = (item: WishlistItem) => {
    setWlEditingItem(item);
    setWlName(item.name);
    setWlBrand(item.brand ?? "");
    setWlUrl(item.url ?? "");
    setWlPrice(item.estimatedPrice != null ? String(item.estimatedPrice) : "");
    setWlCategory(item.category ?? "");
    setWlNotes(item.notes ?? "");
    setWlImageUri(item.imageUri ?? "");
    setWishlistModalVisible(true);
  };

  const handleSaveWishlistItem = async () => {
    if (!wlName.trim()) {
      Alert.alert("Name required", "Please enter a name for the wishlist item.");
      return;
    }
    const itemData: WishlistItem = {
      id: wlEditingItem?.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 9)),
      name: wlName.trim(),
      brand: wlBrand.trim() || undefined,
      url: wlUrl.trim() || undefined,
      estimatedPrice: wlPrice ? parseFloat(wlPrice) : undefined,
      category: wlCategory || undefined,
      notes: wlNotes.trim() || undefined,
      imageUri: wlImageUri || undefined,
      createdAt: wlEditingItem?.createdAt ?? Date.now(),
    };
    await saveWishlistItem(itemData);
    resetWlForm();
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

  const handleWlFetchUrl = async () => {
    const url = wlUrl.trim();
    if (!url) {
      Alert.alert("Enter a URL", "Please paste the product URL first.");
      return;
    }
    setWlFetchingUrl(true);
    try {
      const result = await fetchProductFromUrl(url);
      if (result) {
        if (result.name) setWlName(result.name);
        if (result.brand) setWlBrand(result.brand);
        if (result.category) setWlCategory(result.category);
        if (result.imageUri) setWlImageUri(result.imageUri);
        if (result.cost != null) setWlPrice(String(result.cost));
      } else {
        Alert.alert("No data found", "Could not extract product info from this URL.");
      }
    } catch {
      Alert.alert("Fetch failed", "Something went wrong fetching the URL. Please fill in manually.");
    } finally {
      setWlFetchingUrl(false);
    }
  };

  const handleWlPickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) {
      setWlImageUri(result.assets[0].uri);
    }
  };

  const handleMoveToWardrobe = (item: WishlistItem) => {
    Alert.alert(
      "Move to Wardrobe",
      `Move "${item.name}" to your wardrobe? This will remove it from the wishlist.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move",
          onPress: async () => {
            const clothingItem = await moveWishlistToWardrobe(item.id);
            if (clothingItem) {
              reloadItems();
              loadWishlist();
              Alert.alert("Moved!", `"${item.name}" has been added to your wardrobe.`);
            } else {
              Alert.alert("Error", "Could not move item to wardrobe.");
            }
          },
        },
      ]
    );
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
  /*  Tab-based section visibility                                       */
  const SECTION_TABS: Record<string, typeof profileTab> = {
    spending: "overview",
    stats: "analytics",
    colorPalette: "analytics",
    gapAnalysis: "analytics",
    wishlist: "tools",
    archived: "overview",
    favorites: "overview",
    gmail: "overview",
    backup: "overview",
    brandInsights: "analytics",
    roi: "analytics",
    ageTracker: "analytics",
    sustainability: "analytics",
    duplicates: "analytics",
    consistency: "analytics",
    packing: "tools",
    shopping: "shopping",
    saleAlerts: "shopping",
    splurge: "shopping",
    resale: "shopping",
    inspiration: "tools",
  };

  const show = (section: string) => profileTab === SECTION_TABS[section];

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
          color={theme.colors.primary}
          style={styles.menuIcon}
        />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons
        name={open ? "chevron-up" : "chevron-down"}
        size={20}
        color={theme.colors.textSecondary}
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
            color={theme.colors.text}
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

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.profileTabBar}
      >
        {([
          { key: "overview", label: "Overview", icon: "home-outline" },
          { key: "analytics", label: "Analytics", icon: "analytics-outline" },
          { key: "tools", label: "Tools", icon: "construct-outline" },
          { key: "shopping", label: "Shopping", icon: "cart-outline" },
        ] as const).map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.profileTabBtn,
              profileTab === tab.key && styles.profileTabBtnActive,
            ]}
            onPress={() => setProfileTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={profileTab === tab.key ? theme.colors.primary : theme.colors.textLight}
            />
            <Text
              style={[
                styles.profileTabLabel,
                profileTab === tab.key && styles.profileTabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ============================================================ */}
      {/*  SPENDING                                                     */}
      {/* ============================================================ */}
      {show("spending") && (
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
      )}

      {/* ============================================================ */}
      {/*  STATS & REPORTS                                              */}
      {/* ============================================================ */}
      {show("stats") && (
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
      )}

      {/* ============================================================ */}
      {/*  COLOUR PALETTE ANALYSIS                                      */}
      {/* ============================================================ */}
      {show("colorPalette") && (
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
                    <Ionicons name="bulb-outline" size={16} color={theme.colors.warning} />
                    <Text style={styles.tipText}>
                      Your wardrobe is mostly neutrals — great foundation! Consider adding a statement
                      color.
                    </Text>
                  </View>
                )}
                {colorPalette.distinctFamilies < 3 && (
                  <View style={styles.tipCard}>
                    <Ionicons name="bulb-outline" size={16} color={theme.colors.warning} />
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
      )}

      {/* ============================================================ */}
      {/*  WARDROBE GAP ANALYSIS                                        */}
      {/* ============================================================ */}
      {show("gapAnalysis") && (
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
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
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
                    color={theme.colors.warning}
                    style={{ marginRight: theme.spacing.sm }}
                  />
                  <Text style={styles.gapText}>{insight.text}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  WISHLIST                                                      */}
      {/* ============================================================ */}
      {show("wishlist") && (
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
                <Pressable
                  key={wItem.id}
                  style={styles.wishlistRow}
                  onPress={() => openWlEditModal(wItem)}
                >
                  {wItem.imageUri ? (
                    <Image source={{ uri: wItem.imageUri }} style={styles.wlThumb} />
                  ) : null}
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
                    {wItem.url ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Linking.openURL(wItem.url!);
                        }}
                        hitSlop={4}
                      >
                        <Text style={styles.wlUrlLink} numberOfLines={1}>
                          {wItem.url}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.wlMoveBtn}
                    onPress={() => handleMoveToWardrobe(wItem)}
                    hitSlop={8}
                  >
                    <Ionicons name="bag-add-outline" size={16} color={theme.colors.primary} />
                  </Pressable>
                  <Pressable
                    style={styles.wishlistDeleteBtn}
                    onPress={() => handleDeleteWishlistItem(wItem)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                  </Pressable>
                </Pressable>
              ))
            )}

            <Pressable
              style={styles.addWishlistBtn}
              onPress={openWlAddModal}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.addWishlistBtnText}>Add to Wishlist</Text>
            </Pressable>
          </View>
        )}
      </View>
      )}

      {/* -------- Wishlist Modal -------- */}
      <Modal
        visible={wishlistModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setWishlistModalVisible(false); resetWlForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {wlEditingItem ? "Edit Wishlist Item" : "Add to Wishlist"}
              </Text>
              <Pressable hitSlop={12} onPress={() => { setWishlistModalVisible(false); resetWlForm(); }}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Photo thumbnail */}
              <Pressable style={styles.wlPhotoRow} onPress={handleWlPickImage}>
                {wlImageUri ? (
                  <Image source={{ uri: wlImageUri }} style={styles.wlPhotoPreview} />
                ) : (
                  <View style={styles.wlPhotoPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={theme.colors.textLight} />
                  </View>
                )}
                <Text style={styles.wlPhotoHint}>
                  {wlImageUri ? "Tap to change photo" : "Tap to add photo"}
                </Text>
              </Pressable>

              <Text style={styles.modalLabel}>URL</Text>
              <View style={styles.wlUrlRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={wlUrl}
                  onChangeText={setWlUrl}
                  placeholder="Product URL (optional)"
                  placeholderTextColor={theme.colors.textLight}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <Pressable
                  style={[styles.wlFetchBtn, wlFetchingUrl && styles.wlFetchBtnDisabled]}
                  onPress={handleWlFetchUrl}
                  disabled={wlFetchingUrl}
                >
                  {wlFetchingUrl ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>

              <Text style={styles.modalLabel}>Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={wlName}
                onChangeText={setWlName}
                placeholder="Item name"
                placeholderTextColor={theme.colors.textLight}
              />

              <Text style={styles.modalLabel}>Brand</Text>
              <TextInput
                style={styles.modalInput}
                value={wlBrand}
                onChangeText={setWlBrand}
                placeholder="Brand (optional)"
                placeholderTextColor={theme.colors.textLight}
              />

              <Text style={styles.modalLabel}>Estimated Price</Text>
              <TextInput
                style={styles.modalInput}
                value={wlPrice}
                onChangeText={setWlPrice}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textLight}
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
                placeholderTextColor={theme.colors.textLight}
                multiline
                numberOfLines={3}
              />

              {/* Move to Wardrobe button (only in edit mode) */}
              {wlEditingItem && (
                <Pressable
                  style={styles.wlMoveToWardrobeBtn}
                  onPress={() => {
                    setWishlistModalVisible(false);
                    handleMoveToWardrobe(wlEditingItem);
                    resetWlForm();
                  }}
                >
                  <Ionicons name="bag-add-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.wlMoveToWardrobeBtnText}>Move to Wardrobe</Text>
                </Pressable>
              )}
            </ScrollView>

            <Pressable style={styles.modalSaveBtn} onPress={handleSaveWishlistItem}>
              <Text style={styles.modalSaveBtnText}>
                {wlEditingItem ? "Save Changes" : "Add Item"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/*  ARCHIVED ITEMS                                               */}
      {/* ============================================================ */}
      {show("archived") && (
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
                    <Ionicons name="arrow-undo-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.unarchiveBtnText}>Unarchive</Text>
                  </Pressable>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  FAVOURITES                                                   */}
      {/* ============================================================ */}
      {show("favorites") && (
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
                    color={theme.colors.secondary}
                    style={{ marginRight: theme.spacing.sm }}
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
      )}

      {/* ============================================================ */}
      {/*  GMAIL PURCHASES                                              */}
      {/* ============================================================ */}
      {show("gmail") && (
      <View style={styles.card}>
        <Pressable
          style={styles.gmailSection}
          onPress={() => router.push("/gmail-purchases")}
        >
          <View style={styles.menuLeft}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={theme.colors.primary}
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
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
      )}

      {/* ============================================================ */}
      {/*  BACKUP & RESTORE                                             */}
      {/* ============================================================ */}
      {show("backup") && (
      <View style={styles.card}>
        <View style={styles.backupSection}>
          <Ionicons name="cloud-download-outline" size={20} color={theme.colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Backup & Restore</Text>
        </View>
        <View style={styles.backupButtons}>
          <Pressable style={styles.backupBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.backupBtnText}>Export Backup</Text>
          </Pressable>
          <Pressable style={styles.backupBtn} onPress={handleImport}>
            <Ionicons name="push-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.backupBtnText}>Import Backup</Text>
          </Pressable>
        </View>
      </View>
      )}
      {/* ============================================================ */}
      {/*  BRAND INSIGHTS (#6)                                          */}
      {/* ============================================================ */}
      {show("brandInsights") && (
      <View style={styles.card}>
        <SectionHeader
          icon="pricetag-outline"
          label="Brand Insights"
          open={brandInsightsOpen}
          onPress={() => setBrandInsightsOpen((v) => !v)}
        />
        {brandInsightsOpen && (
          <View style={styles.sectionBody}>
            {brandStats.length === 0 ? (
              <Text style={styles.emptyText}>No brands recorded yet.</Text>
            ) : (
              brandStats.slice(0, 10).map(({ brand, count, totalCost }) => (
                <View key={brand} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{brand}</Text>
                    <Text style={styles.barValue}>{count} items {totalCost > 0 ? `· ${fmt(totalCost)}` : ""}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(count / (brandStats[0]?.count || 1)) * 100}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  ROI RANKING (#10)                                            */}
      {/* ============================================================ */}
      {show("roi") && (
      <View style={styles.card}>
        <SectionHeader
          icon="trending-up-outline"
          label="Best ROI Items"
          open={roiOpen}
          onPress={() => setRoiOpen((v) => !v)}
        />
        {roiOpen && (
          <View style={styles.sectionBody}>
            {costPerWear.length === 0 ? (
              <Text style={styles.emptyText}>No items with cost and wear data yet.</Text>
            ) : (
              costPerWear.slice(0, 10).map(({ item, cpw }, idx) => (
                <Pressable
                  key={item.id}
                  style={styles.listItem}
                  onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                >
                  <Text style={[styles.barLabel, { marginRight: 8, width: 20 }]}>#{idx + 1}</Text>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.listItemSub}>{item.brand || CATEGORY_LABELS[item.category]} · {item.wearCount} wears</Text>
                  </View>
                  <Text style={styles.cpwValue}>{fmt(cpw)}/wear</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  WARDROBE AGE TRACKER (#5)                                    */}
      {/* ============================================================ */}
      {show("ageTracker") && (
      <View style={styles.card}>
        <SectionHeader
          icon="time-outline"
          label="Wardrobe Age"
          open={ageTrackerOpen}
          onPress={() => setAgeTrackerOpen((v) => !v)}
        />
        {ageTrackerOpen && (
          <View style={styles.sectionBody}>
            <View style={styles.spendTotalRow}>
              <Text style={styles.barLabel}>Average Age</Text>
              <Text style={styles.cpwValue}>{avgItemAge}</Text>
            </View>
            {oldestItem && (
              <View style={styles.spendTotalRow}>
                <Text style={styles.barLabel}>Oldest Item</Text>
                <Text style={styles.listItemSub}>{oldestItem.name}</Text>
              </View>
            )}
            {newestItem && (
              <View style={styles.spendTotalRow}>
                <Text style={styles.barLabel}>Newest Item</Text>
                <Text style={styles.listItemSub}>{newestItem.name}</Text>
              </View>
            )}
            {itemsOver3Years.length > 0 && (
              <>
                <Divider />
                <SubHeading>Consider Refreshing ({itemsOver3Years.length} items)</SubHeading>
                {itemsOver3Years.slice(0, 5).map((item) => (
                  <Pressable key={item.id} style={styles.listItem} onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}>
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.listItemSub}>{CATEGORY_LABELS[item.category]}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  SUSTAINABILITY SCORE (#37)                                    */}
      {/* ============================================================ */}
      {show("sustainability") && (
      <View style={styles.card}>
        <SectionHeader
          icon="leaf-outline"
          label="Sustainability"
          open={sustainabilityOpen}
          onPress={() => setSustainabilityOpen((v) => !v)}
        />
        {sustainabilityOpen && (
          <View style={styles.sectionBody}>
            <View style={styles.spendTotalRow}>
              <Text style={styles.barLabel}>Sustainable Items</Text>
              <Text style={[styles.cpwValue, { color: theme.colors.success }]}>
                {sustainableCount} / {allActive.length} ({allActive.length > 0 ? Math.round((sustainableCount / allActive.length) * 100) : 0}%)
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${allActive.length > 0 ? (sustainableCount / allActive.length) * 100 : 0}%`, backgroundColor: theme.colors.success }]} />
            </View>
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  DUPLICATE DETECTOR (#36)                                      */}
      {/* ============================================================ */}
      {show("duplicates") && (
      <View style={styles.card}>
        <SectionHeader
          icon="copy-outline"
          label="Possible Duplicates"
          open={duplicatesOpen}
          onPress={() => setDuplicatesOpen((v) => !v)}
        />
        {duplicatesOpen && (
          <View style={styles.sectionBody}>
            {duplicateGroups.length === 0 ? (
              <Text style={styles.emptyText}>No potential duplicates found.</Text>
            ) : (
              duplicateGroups.slice(0, 5).map((group, idx) => (
                <View key={idx} style={styles.gapCard}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.gapText}>
                    {group.map((i) => i.name).join(" & ")} — similar {CATEGORY_LABELS[group[0].category].toLowerCase()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  DARK MODE TOGGLE (#39)                                        */}
      {/* ============================================================ */}
      <View style={styles.card}>
        <Pressable style={styles.menuRow} onPress={toggleTheme}>
          <View style={styles.menuLeft}>
            <Ionicons name={isDark ? "moon" : "moon-outline"} size={20} color={theme.colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuLabel}>Dark Mode</Text>
          </View>
          <View style={{ width: 40, height: 24, borderRadius: 12, backgroundColor: isDark ? theme.colors.primary : theme.colors.border, justifyContent: "center", paddingHorizontal: 2 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF", alignSelf: isDark ? "flex-end" : "flex-start" }} />
          </View>
        </Pressable>
      </View>

      {/* ============================================================ */}
      {/*  STYLE CONSISTENCY SCORE (#3)                                  */}
      {/* ============================================================ */}
      {show("consistency") && (
      <View style={styles.card}>
        <SectionHeader
          icon="ribbon-outline"
          label="Style Consistency"
          open={consistencyOpen}
          onPress={() => setConsistencyOpen((v) => !v)}
        />
        {consistencyOpen && (
          <View style={styles.sectionBody}>
            {allActive.length === 0 ? (
              <Text style={styles.emptyText}>Add items to see your consistency score.</Text>
            ) : (
              <>
                {/* Overall score display */}
                <View style={styles.consistencyScoreCircle}>
                  <Text style={styles.consistencyScoreValue}>{consistencyData.overall}</Text>
                  <Text style={styles.consistencyScoreLabel}>/ 100</Text>
                </View>

                <Divider />

                {/* Breakdown */}
                <View style={styles.consistencyRow}>
                  <Text style={styles.barLabel}>Category Focus</Text>
                  <Text style={styles.cpwValue}>{consistencyData.categoryFocus}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${consistencyData.categoryFocus}%` }]} />
                </View>

                <View style={[styles.consistencyRow, { marginTop: theme.spacing.md }]}>
                  <Text style={styles.barLabel}>Color Harmony</Text>
                  <Text style={styles.cpwValue}>{consistencyData.colorHarmony}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${consistencyData.colorHarmony}%` }]} />
                </View>

                <View style={[styles.consistencyRow, { marginTop: theme.spacing.md }]}>
                  <Text style={styles.barLabel}>Overall</Text>
                  <Text style={styles.cpwValue}>{consistencyData.overall}/100</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${consistencyData.overall}%` }]} />
                </View>

                {/* Tips */}
                {consistencyData.overall >= 70 && (
                  <View style={[styles.tipCard, { marginTop: theme.spacing.md }]}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
                    <Text style={styles.tipText}>
                      Great consistency! Your wardrobe has a cohesive style.
                    </Text>
                  </View>
                )}
                {consistencyData.overall < 50 && (
                  <View style={[styles.tipCard, { marginTop: theme.spacing.md }]}>
                    <Ionicons name="bulb-outline" size={16} color={theme.colors.warning} />
                    <Text style={styles.tipText}>
                      Your wardrobe is eclectic. Consider focusing on a core color palette and fewer categories for a more cohesive look.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  PACKING LIST / TRAVEL MODE (#12, #88)                           */}
      {/* ============================================================ */}
      {show("packing") && (
      <View style={styles.card}>
        <SectionHeader
          icon="airplane-outline"
          label="Travel Mode"
          open={packingOpen}
          onPress={() => setPackingOpen((v) => !v)}
        />
        {packingOpen && (
          <View style={styles.sectionBody}>
            <Text style={styles.barLabel}>Destination</Text>
            <TextInput
              style={[styles.packingInput, { width: "100%", marginBottom: theme.spacing.sm }]}
              value={tripDestination}
              onChangeText={setTripDestination}
              placeholder="e.g., Paris, Cancún, NYC"
              placeholderTextColor={theme.colors.textLight}
              autoCapitalize="words"
            />

            <Text style={styles.barLabel}>Trip Duration (days)</Text>
            <TextInput
              style={[styles.packingInput, { width: "100%", marginBottom: theme.spacing.sm }]}
              value={tripDays}
              onChangeText={setTripDays}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={styles.barLabel}>Climate</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: theme.spacing.sm }}>
              {(["warm", "mild", "cold"] as const).map((c) => (
                <Chip key={c} label={c === "warm" ? "Warm / Hot" : c === "cold" ? "Cold / Winter" : "Mild / Temperate"} selected={tripClimate === c} onPress={() => setTripClimate(tripClimate === c ? "" : c)} />
              ))}
            </View>

            <Text style={styles.barLabel}>Trip Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: theme.spacing.md }}>
              {(["casual", "business", "beach", "adventure"] as const).map((t) => (
                <Chip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} selected={tripType === t} onPress={() => setTripType(tripType === t ? "" : t)} />
              ))}
            </View>

            <Pressable style={styles.packingGenerateBtn} onPress={generatePackingList}>
              <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
              <Text style={styles.packingGenerateBtnText}>Generate Packing List</Text>
            </Pressable>

            {packingResult.length > 0 && (
              <>
                <Divider />
                <SubHeading>Your Packing List</SubHeading>
                {packingResult.map((item, idx) => (
                  <Pressable
                    key={`${item.category}-${item.name}-${idx}`}
                    style={styles.packingItemRow}
                    onPress={() => togglePackingItem(idx)}
                  >
                    <Ionicons
                      name={item.checked ? "checkbox" : "square-outline"}
                      size={20}
                      color={item.checked ? theme.colors.success : theme.colors.textSecondary}
                    />
                    <View style={styles.packingItemInfo}>
                      <Text
                        style={[
                          styles.packingItemName,
                          item.checked && styles.packingItemChecked,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.packingItemCategory}>{item.category}</Text>
                    </View>
                  </Pressable>
                ))}
                <Text style={[styles.emptyText, { textAlign: "center", marginTop: theme.spacing.sm }]}>
                  {packingResult.filter((i) => i.checked).length} / {packingResult.length} packed
                </Text>
              </>
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  SMART SHOPPING SUGGESTIONS (#32)                              */}
      {/* ============================================================ */}
      {show("shopping") && (
      <View style={styles.card}>
        <SectionHeader
          icon="cart-outline"
          label="Smart Shopping Suggestions"
          open={shoppingOpen}
          onPress={() => setShoppingOpen((v) => !v)}
        />
        {shoppingOpen && (
          <View style={styles.sectionBody}>
            {allActive.length === 0 ? (
              <Text style={styles.emptyText}>Add items to get shopping suggestions.</Text>
            ) : shoppingSuggestions.length === 0 ? (
              <View style={styles.tipCard}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
                <Text style={styles.tipText}>
                  Your wardrobe is well-balanced! No major gaps to fill.
                </Text>
              </View>
            ) : (
              shoppingSuggestions.map((suggestion) => (
                <View key={suggestion.key} style={styles.gapCard}>
                  <Ionicons
                    name="bag-outline"
                    size={16}
                    color={theme.colors.primary}
                    style={{ marginRight: theme.spacing.sm, marginTop: 2 }}
                  />
                  <Text style={styles.gapText}>{suggestion.text}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  SALE PRICE ALERTS (#33)                                        */}
      {/* ============================================================ */}
      {show("saleAlerts") && (
      <View style={styles.card}>
        <SectionHeader
          icon="notifications-outline"
          label="Sale Alerts"
          open={saleAlertsOpen}
          onPress={() => setSaleAlertsOpen((v) => !v)}
        />
        {saleAlertsOpen && (
          <View style={styles.sectionBody}>
            {wishlistWithAlerts.length === 0 ? (
              <Text style={styles.emptyText}>
                Add wishlist items with a target price to get sale alerts. Set a target price on any wishlist item to track it here.
              </Text>
            ) : (
              wishlistWithAlerts.map((item) => {
                const currentPrice = item.estimatedPrice ?? 0;
                const target = item.targetPrice ?? 0;
                const isOnSale = currentPrice <= target;
                return (
                  <View key={item.id} style={styles.gapCard}>
                    <Ionicons
                      name={isOnSale ? "checkmark-circle" : "time-outline"}
                      size={18}
                      color={isOnSale ? theme.colors.success : theme.colors.warning}
                      style={{ marginRight: theme.spacing.sm, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.barLabel}>{item.name}</Text>
                      <Text style={styles.listItemSub}>
                        {isOnSale
                          ? `On sale! ${fmt(currentPrice)} (target: ${fmt(target)})`
                          : `Current: ${fmt(currentPrice)} | Target: ${fmt(target)}`}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  WORTH THE SPLURGE CALCULATOR (#35)                             */}
      {/* ============================================================ */}
      {show("splurge") && (
      <View style={styles.card}>
        <SectionHeader
          icon="calculator-outline"
          label="Worth the Splurge?"
          open={splurgeOpen}
          onPress={() => setSplurgeOpen((v) => !v)}
        />
        {splurgeOpen && (
          <View style={styles.sectionBody}>
            <Text style={styles.barLabel}>Item Price</Text>
            <TextInput
              style={[styles.packingInput, { width: "100%", marginBottom: theme.spacing.sm }]}
              value={splurgePrice}
              onChangeText={setSplurgePrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 250"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={[styles.barLabel, { marginTop: theme.spacing.sm }]}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
              {ALL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.splurgeChip,
                    splurgeCategory === cat && styles.splurgeChipActive,
                  ]}
                  onPress={() => setSplurgeCategory(cat)}
                >
                  <Text
                    style={[
                      styles.splurgeChipText,
                      splurgeCategory === cat && styles.splurgeChipTextActive,
                    ]}
                  >
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={[styles.packingGenerateBtn, { marginTop: theme.spacing.md }]} onPress={calculateSplurge}>
              <Ionicons name="calculator-outline" size={18} color="#FFFFFF" />
              <Text style={styles.packingGenerateBtnText}>Calculate</Text>
            </Pressable>

            {splurgeResult && (
              <View style={[styles.tipCard, { marginTop: theme.spacing.md }]}>
                <Ionicons
                  name={
                    splurgeResult.verdict === "Go For It" || splurgeResult.verdict === "Worth It"
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                  }
                  size={18}
                  color={
                    splurgeResult.verdict === "Go For It" || splurgeResult.verdict === "Worth It"
                      ? theme.colors.success
                      : theme.colors.warning
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.barLabel, { marginBottom: 4 }]}>{splurgeResult.verdict}</Text>
                  <Text style={styles.tipText}>{splurgeResult.reason}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  RESALE VALUE ESTIMATOR (#38)                                   */}
      {/* ============================================================ */}
      {show("resale") && (
      <View style={styles.card}>
        <SectionHeader
          icon="cash-outline"
          label="Resale Value Estimator"
          open={resaleOpen}
          onPress={() => setResaleOpen((v) => !v)}
        />
        {resaleOpen && (
          <View style={styles.sectionBody}>
            {resaleEstimates.length === 0 ? (
              <Text style={styles.emptyText}>Add items with cost data to see resale estimates.</Text>
            ) : (
              <>
                <Text style={[styles.emptyText, { marginBottom: theme.spacing.sm }]}>
                  Estimated based on age, wear frequency, and brand.
                </Text>
                {resaleEstimates.map(({ item, estimate, pctRetained }) => (
                  <Pressable
                    key={item.id}
                    style={styles.listItem}
                    onPress={() => router.push({ pathname: "/edit-item", params: { id: item.id } })}
                  >
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.listItemSub}>
                        Paid {fmt(item.cost!)} · {pctRetained}% retained
                      </Text>
                    </View>
                    <Text style={[styles.cpwValue, { color: theme.colors.success }]}>
                      ~{fmt(estimate)}
                    </Text>
                  </Pressable>
                ))}
                <Divider />
                <View style={styles.spendTotalRow}>
                  <Text style={styles.barLabel}>Total Estimated Resale</Text>
                  <Text style={[styles.cpwValue, { color: theme.colors.success }]}>
                    ~{fmt(resaleEstimates.reduce((s, r) => s + r.estimate, 0))}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
      )}

      {/* ============================================================ */}
      {/*  STYLE INSPIRATION BOARD (#28)                                  */}
      {/* ============================================================ */}
      {show("inspiration") && (
      <View style={styles.card}>
        <SectionHeader
          icon="images-outline"
          label="Style Inspiration"
          open={inspirationOpen}
          onPress={() => setInspirationOpen((v) => !v)}
        />
        {inspirationOpen && (
          <View style={styles.sectionBody}>
            <Text style={styles.emptyText}>
              Save outfit inspiration photos from your gallery. Use them as reference when building outfits.
            </Text>
            <Pressable
              style={[styles.packingGenerateBtn, { marginTop: theme.spacing.md }]}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: false,
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  const pin = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                    imageUri: result.assets[0].uri,
                    createdAt: Date.now(),
                  };
                  await saveInspirationPin(pin);
                  // Reload pins
                  const pins = await getInspirationPins();
                  setInspirationPins(pins);
                }
              }}
            >
              <Ionicons name="add-outline" size={18} color="#FFFFFF" />
              <Text style={styles.packingGenerateBtnText}>Add Inspiration</Text>
            </Pressable>
            {inspirationPins.length > 0 && (
              <>
                <Divider />
                <View style={styles.inspirationGrid}>
                  {inspirationPins.map((pin) => (
                    <View key={pin.id} style={styles.inspirationPinCard}>
                      <Image
                        source={{ uri: pin.imageUri }}
                        style={styles.inspirationPinImage}
                        resizeMode="cover"
                      />
                      <Pressable
                        style={styles.inspirationPinDelete}
                        onPress={() => {
                          Alert.alert("Remove Pin?", "Delete this inspiration?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: async () => {
                                await deleteInspirationPin(pin.id);
                                const pins = await getInspirationPins();
                                setInspirationPins(pins);
                              },
                            },
                          ]);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </View>
      )}

    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: any) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  content: {
    padding: t.spacing.md,
    paddingBottom: 100,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: t.spacing.lg,
  },
  headerTitle: {
    fontSize: t.fontSize.title,
    fontWeight: "700",
    color: t.colors.text,
  },

  /* Quick Stats */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: "center",
    marginHorizontal: t.spacing.xs,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: t.fontSize.xl,
    fontWeight: "700",
    color: t.colors.primary,
  },
  statLabel: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xs,
  },
  utilNote: {
    fontSize: t.fontSize.xs,
    color: t.colors.textLight,
    textAlign: "center",
    marginBottom: t.spacing.sm,
  },

  /* Profile tab bar */
  profileTabBar: {
    flexDirection: "row",
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.md,
    gap: 8,
  },
  profileTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: t.colors.surfaceAlt,
  },
  profileTabBtnActive: {
    backgroundColor: t.colors.primary + "15",
  },
  profileTabLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: "600",
    color: t.colors.textLight,
  },
  profileTabLabelActive: {
    color: t.colors.primary,
  },

  /* Card wrapper for each section */
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.md,
    shadowColor: t.colors.shadow,
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
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: t.spacing.sm,
  },
  menuLabel: {
    fontSize: t.fontSize.lg,
    fontWeight: "600",
    color: t.colors.text,
  },

  /* Expanded section body */
  sectionBody: {
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.md,
  },

  /* Sub-heading inside a section */
  subHeading: {
    fontSize: t.fontSize.md,
    fontWeight: "700",
    color: t.colors.text,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
    marginVertical: t.spacing.md,
  },

  /* Spending total */
  spendTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: t.spacing.sm,
  },
  spendTotalLabel: {
    fontSize: t.fontSize.lg,
    fontWeight: "600",
    color: t.colors.text,
  },
  spendTotalValue: {
    fontSize: t.fontSize.xl,
    fontWeight: "700",
    color: t.colors.primary,
  },

  /* Generic list item row */
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.sm,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemName: {
    fontSize: t.fontSize.md,
    fontWeight: "500",
    color: t.colors.text,
  },
  listItemSub: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginTop: 2,
  },

  /* Badge (wear count) */
  badge: {
    backgroundColor: t.colors.primaryLight + "22",
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  badgeText: {
    fontSize: t.fontSize.sm,
    fontWeight: "700",
    color: t.colors.primary,
  },
  badgeMuted: {
    backgroundColor: t.colors.surfaceAlt,
  },
  badgeTextMuted: {
    color: t.colors.textSecondary,
  },

  /* Bar chart rows */
  barRow: {
    marginBottom: t.spacing.sm,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.spacing.xs,
  },
  barLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: "500",
    color: t.colors.text,
  },
  barValue: {
    fontSize: t.fontSize.sm,
    fontWeight: "600",
    color: t.colors.primary,
  },
  barTrack: {
    height: 8,
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: t.borderRadius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.full,
  },

  /* Cost per wear value */
  cpwValue: {
    fontSize: t.fontSize.md,
    fontWeight: "600",
    color: t.colors.primary,
  },

  /* Empty text */
  emptyText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textLight,
    fontStyle: "italic",
    paddingVertical: t.spacing.sm,
  },

  /* Unarchive button */
  unarchiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.primary + "12",
  },
  unarchiveBtnText: {
    fontSize: t.fontSize.xs,
    fontWeight: "600",
    color: t.colors.primary,
  },

  /* Gmail section */
  gmailSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  gmailHint: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
    marginTop: 2,
  },

  /* Backup section */
  backupSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  backupButtons: {
    flexDirection: "row",
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  backupBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.primary + "12",
  },
  backupBtnText: {
    fontSize: t.fontSize.sm,
    fontWeight: "600",
    color: t.colors.primary,
  },

  /* Colour Palette */
  colorBarContainer: {
    flexDirection: "row",
    height: 24,
    borderRadius: t.borderRadius.sm,
    overflow: "hidden",
    marginBottom: t.spacing.md,
  },
  colorStripe: {
    height: 24,
  },
  colorListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.xs,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: t.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  colorListText: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },

  /* Tip card */
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: t.colors.warning + "14",
    borderRadius: t.borderRadius.sm,
    padding: t.spacing.sm,
    marginTop: t.spacing.md,
    gap: t.spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    lineHeight: 18,
  },

  /* Gap Analysis */
  gapCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: t.borderRadius.sm,
    padding: t.spacing.sm,
    marginBottom: t.spacing.sm,
  },
  gapText: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    lineHeight: 18,
  },

  /* Wishlist */
  wishlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  wishlistDeleteBtn: {
    padding: t.spacing.xs,
  },
  addWishlistBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: t.spacing.sm,
    marginTop: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.primary + "12",
  },
  addWishlistBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: "600",
    color: t.colors.primary,
  },
  wlThumb: {
    width: 40,
    height: 40,
    borderRadius: t.borderRadius.sm,
    marginRight: t.spacing.sm,
  },
  wlUrlLink: {
    fontSize: t.fontSize.xs,
    color: t.colors.primary,
    textDecorationLine: "underline",
    marginTop: 2,
  },
  wlMoveBtn: {
    padding: t.spacing.xs,
    marginRight: 4,
  },
  wlPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  wlPhotoPreview: {
    width: 64,
    height: 64,
    borderRadius: t.borderRadius.sm,
  },
  wlPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  wlPhotoHint: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
  },
  wlUrlRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  wlFetchBtn: {
    width: 48,
    height: 48,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  wlFetchBtnDisabled: {
    opacity: 0.5,
  },
  wlMoveToWardrobeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.primary + "12",
    borderWidth: 1,
    borderColor: t.colors.primary + "30",
  },
  wlMoveToWardrobeBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: "600",
    color: t.colors.primary,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.borderRadius.lg,
    borderTopRightRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: t.spacing.md,
  },
  modalTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: "700",
    color: t.colors.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: "600",
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.xs,
  },
  modalInput: {
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 10,
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },
  modalInputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  categoryPickerScroll: {
    marginBottom: t.spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 6,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.surfaceAlt,
    marginRight: t.spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: t.colors.primary,
  },
  categoryChipText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalSaveBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: t.spacing.md,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: t.fontSize.md,
    fontWeight: "700",
  },

  /* Style Consistency */
  consistencyScoreCircle: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.spacing.md,
  },
  consistencyScoreValue: {
    fontSize: 48,
    fontWeight: "700",
    color: t.colors.primary,
  },
  consistencyScoreLabel: {
    fontSize: t.fontSize.md,
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  consistencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: t.spacing.xs,
  },

  /* Packing List */
  packingInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  packingInput: {
    flex: 1,
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 10,
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },
  packingGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 10,
  },
  packingGenerateBtnText: {
    color: "#FFFFFF",
    fontSize: t.fontSize.md,
    fontWeight: "600",
  },
  packingItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  packingItemInfo: {
    flex: 1,
  },
  packingItemName: {
    fontSize: t.fontSize.md,
    fontWeight: "500",
    color: t.colors.text,
  },
  packingItemChecked: {
    textDecorationLine: "line-through",
    color: t.colors.textLight,
  },
  packingItemCategory: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
    marginTop: 1,
  },

  /* Splurge Calculator */
  splurgeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: t.borderRadius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  splurgeChipActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + "15",
  },
  splurgeChipText: {
    fontSize: t.fontSize.xs,
    fontWeight: "600",
    color: t.colors.textSecondary,
  },
  splurgeChipTextActive: {
    color: t.colors.primary,
  },

  /* Inspiration Board */
  inspirationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  inspirationPinCard: {
    width: 100,
    height: 133,
    borderRadius: t.borderRadius.sm,
    overflow: "hidden",
    position: "relative" as const,
  },
  inspirationPinImage: {
    width: "100%",
    height: "100%",
  },
  inspirationPinDelete: {
    position: "absolute",
    top: 4,
    right: 4,
  },
}); }

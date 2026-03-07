/**
 * Advanced Analytics Dashboard (#93)
 *
 * Interactive charts for:
 *  - Total spend, avg cost-per-wear
 *  - Category distribution bar chart
 *  - Color palette mosaic
 *  - Brand ranking table
 *  - Most / least worn items
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/constants/theme";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { CATEGORY_LABELS } from "@/models/types";
import type { ClothingCategory } from "@/models/types";

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { items } = useClothingItems();
  const { outfits } = useOutfits();
  const router = useRouter();

  const activeItems = useMemo(() => items.filter((i) => !i.archived), [items]);

  // --- Spend stats ---
  const totalSpend = useMemo(
    () => activeItems.reduce((s, i) => s + (i.cost ?? 0), 0),
    [activeItems]
  );

  const avgCostPerWear = useMemo(() => {
    const wornItems = activeItems.filter((i) => i.cost && i.wearCount > 0);
    if (wornItems.length === 0) return 0;
    const cpwList = wornItems.map((i) => (i.cost ?? 0) / i.wearCount);
    return cpwList.reduce((s, v) => s + v, 0) / cpwList.length;
  }, [activeItems]);

  // --- Category distribution ---
  const categoryData = useMemo(() => {
    const counts: Partial<Record<ClothingCategory, number>> = {};
    for (const item of activeItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, count]) => ({
        cat: cat as ClothingCategory,
        count,
        pct: activeItems.length > 0 ? (count / activeItems.length) * 100 : 0,
      }));
  }, [activeItems]);

  // --- Color palette ---
  const topColors = useMemo(() => {
    const colorMap: Record<string, { hex: string; name: string; count: number }> = {};
    for (const item of activeItems) {
      if (!colorMap[item.color]) {
        colorMap[item.color] = { hex: item.color, name: item.colorName, count: 0 };
      }
      colorMap[item.color].count++;
    }
    return Object.values(colorMap).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [activeItems]);

  // --- Brand ranking ---
  const brandData = useMemo(() => {
    const brandMap: Record<string, { count: number; totalWear: number; totalCost: number }> = {};
    for (const item of activeItems) {
      if (!item.brand) continue;
      if (!brandMap[item.brand]) {
        brandMap[item.brand] = { count: 0, totalWear: 0, totalCost: 0 };
      }
      brandMap[item.brand].count++;
      brandMap[item.brand].totalWear += item.wearCount;
      brandMap[item.brand].totalCost += item.cost ?? 0;
    }
    return Object.entries(brandMap)
      .sort(([, a], [, b]) => b.totalWear - a.totalWear)
      .slice(0, 10)
      .map(([brand, data]) => ({ brand, ...data }));
  }, [activeItems]);

  // --- Most / least worn ---
  const sortedByWear = useMemo(
    () => [...activeItems].sort((a, b) => b.wearCount - a.wearCount),
    [activeItems]
  );
  const mostWorn = sortedByWear.slice(0, 5);
  const leastWorn = [...sortedByWear].reverse().slice(0, 5);

  // --- Outfit stats ---
  const totalOutfits = outfits.length;
  const totalWears = outfits.reduce((s, o) => s + (o.wornDates?.length ?? 0), 0);

  const fmt = (n: number) =>
    n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Analytics</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Overview cards */}
        <View style={styles.cardRow}>
          <StatCard label="Items" value={String(activeItems.length)} color={theme.colors.primary} theme={theme} />
          <StatCard label="Outfits" value={String(totalOutfits)} color={theme.colors.secondary} theme={theme} />
          <StatCard label="Total Wears" value={String(totalWears)} color={theme.colors.accent} theme={theme} />
        </View>

        <View style={styles.cardRow}>
          <StatCard label="Total Spend" value={`$${fmt(totalSpend)}`} color={theme.colors.success} theme={theme} />
          <StatCard label="Avg $/Wear" value={`$${fmt(avgCostPerWear)}`} color={theme.colors.warning} theme={theme} />
        </View>

        {/* Category distribution */}
        <Section title="Category Distribution" theme={theme}>
          {categoryData.map(({ cat, count, pct }) => (
            <View key={cat} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: theme.colors.textSecondary, width: 80 }]} numberOfLines={1}>
                {CATEGORY_LABELS[cat]}
              </Text>
              <View style={[styles.barBg, { backgroundColor: theme.colors.surfaceAlt }]}>
                <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={[styles.barCount, { color: theme.colors.text }]}>{count}</Text>
            </View>
          ))}
          {categoryData.length === 0 && (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No items yet</Text>
          )}
        </Section>

        {/* Color palette mosaic */}
        <Section title="Color Palette" theme={theme}>
          <View style={styles.colorGrid}>
            {topColors.map((c) => (
              <View key={c.hex} style={styles.colorTile}>
                <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                <Text style={[styles.colorLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[styles.colorCount, { color: theme.colors.textLight }]}>×{c.count}</Text>
              </View>
            ))}
            {topColors.length === 0 && (
              <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No items yet</Text>
            )}
          </View>
        </Section>

        {/* Brand ranking */}
        {brandData.length > 0 && (
          <Section title="Brand Ranking" theme={theme}>
            <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.tableHeaderCell, { color: theme.colors.textSecondary, flex: 2 }]}>Brand</Text>
              <Text style={[styles.tableHeaderCell, { color: theme.colors.textSecondary }]}>Items</Text>
              <Text style={[styles.tableHeaderCell, { color: theme.colors.textSecondary }]}>Wears</Text>
              <Text style={[styles.tableHeaderCell, { color: theme.colors.textSecondary }]}>Spend</Text>
            </View>
            {brandData.map(({ brand, count, totalWear, totalCost }) => (
              <View key={brand} style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.tableCell, { color: theme.colors.text, flex: 2 }]} numberOfLines={1}>{brand}</Text>
                <Text style={[styles.tableCell, { color: theme.colors.textSecondary }]}>{count}</Text>
                <Text style={[styles.tableCell, { color: theme.colors.textSecondary }]}>{totalWear}</Text>
                <Text style={[styles.tableCell, { color: theme.colors.textSecondary }]}>${fmt(totalCost)}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Most worn */}
        {mostWorn.length > 0 && (
          <Section title="Most Worn" theme={theme}>
            {mostWorn.map((item) => (
              <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.colors.border }]}>
                <View style={[styles.itemColorDot, { backgroundColor: item.color }]} />
                <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemWear, { color: theme.colors.primary }]}>{item.wearCount}×</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Least worn */}
        {leastWorn.length > 0 && (
          <Section title="Least Worn" theme={theme}>
            {leastWorn.map((item) => (
              <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.colors.border }]}>
                <View style={[styles.itemColorDot, { backgroundColor: item.color }]} />
                <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemWear, { color: theme.colors.textLight }]}>{item.wearCount}×</Text>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: typeof Theme;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: typeof Theme;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  cardRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 12 },
  section: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  barLabel: { fontSize: 12 },
  barBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  barCount: { fontSize: 12, fontWeight: "600", width: 24, textAlign: "right" },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorTile: { alignItems: "center", width: 52 },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  colorLabel: { fontSize: 10, marginTop: 3, textAlign: "center" },
  colorCount: { fontSize: 10 },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: "700", flex: 1, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: { fontSize: 13, flex: 1, textAlign: "right" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemColorDot: { width: 14, height: 14, borderRadius: 7 },
  itemName: { flex: 1, fontSize: 13 },
  itemWear: { fontSize: 13, fontWeight: "700" },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: 8 },
});

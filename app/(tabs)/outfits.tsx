import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { MoodBoard } from "@/components/MoodBoard";
import { EmptyState } from "@/components/EmptyState";
import { Chip } from "@/components/Chip";
import { Theme } from "@/constants/theme";
import { SEASON_LABELS, OCCASION_LABELS } from "@/models/types";
import type { ClothingItem, Season, Occasion, Outfit } from "@/models/types";

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];
const OCCASIONS: Occasion[] = ["casual", "work", "fancy", "party", "vacation"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function OutfitsScreen() {
  const { outfits, loading, remove, logWorn, updateRating } = useOutfits();
  const { getById } = useClothingItems();
  const router = useRouter();

  const [seasonFilter, setSeasonFilter] = useState<Season | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<Occasion | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const filteredOutfits = useMemo(() => {
    return outfits.filter((outfit) => {
      if (seasonFilter && !(outfit.seasons ?? []).includes(seasonFilter)) return false;
      if (occasionFilter && !(outfit.occasions ?? []).includes(occasionFilter)) return false;
      return true;
    });
  }, [outfits, seasonFilter, occasionFilter]);

  // Build calendar data: map date string -> outfits worn that day
  const calendarData = useMemo(() => {
    const map: Record<string, Outfit[]> = {};
    for (const outfit of outfits) {
      for (const date of outfit.wornDates) {
        const key = date.split("T")[0]; // "YYYY-MM-DD"
        if (!map[key]) map[key] = [];
        map[key].push(outfit);
      }
    }
    return map;
  }, [outfits]);

  const handleLogWorn = (outfitId: string, outfitName: string) => {
    Alert.alert("Log Worn", `Mark "${outfitName}" as worn today?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Log It", onPress: () => logWorn(outfitId) },
    ]);
  };

  const navigateMonth = (dir: -1 | 1) => {
    let m = calMonth + dir;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m);
    setCalYear(y);
  };

  const hasActiveFilter = seasonFilter !== null || occasionFilter !== null;

  // Calendar rendering
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfWeek(calYear, calMonth);
    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calCell} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOutfits = calendarData[dateStr] ?? [];
      const isToday =
        d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();

      cells.push(
        <View key={d} style={[styles.calCell, isToday && styles.calCellToday]}>
          <Text style={[styles.calDay, isToday && styles.calDayToday]}>{d}</Text>
          {dayOutfits.length > 0 && (
            <View style={styles.calDots}>
              {dayOutfits.length === 1 ? (
                <View style={[styles.calDot, { backgroundColor: Theme.colors.primary }]} />
              ) : (
                <>
                  <View style={[styles.calDot, { backgroundColor: Theme.colors.primary }]} />
                  <Text style={styles.calDotCount}>{dayOutfits.length}</Text>
                </>
              )}
            </View>
          )}
          {dayOutfits.length > 0 && (() => {
            const firstOutfit = dayOutfits[0];
            const firstItem = firstOutfit.itemIds.length > 0 ? getById(firstOutfit.itemIds[0]) : null;
            if (firstItem?.imageUris?.length) {
              return (
                <Image
                  source={{ uri: firstItem.imageUris[0] }}
                  style={styles.calThumb}
                />
              );
            }
            return null;
          })()}
        </View>
      );
    }

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.calContainer}>
        {/* Month navigation */}
        <View style={styles.calNav}>
          <Pressable onPress={() => navigateMonth(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Theme.colors.text} />
          </Pressable>
          <Text style={styles.calMonthTitle}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <Pressable onPress={() => navigateMonth(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.text} />
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={styles.calWeekRow}>
          {WEEKDAYS.map((wd) => (
            <Text key={wd} style={styles.calWeekday}>{wd}</Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={styles.calGrid}>{cells}</View>

        {/* Outfits worn this month */}
        {(() => {
          const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
          const monthOutfitIds = new Set<string>();
          for (const [key, outfitsList] of Object.entries(calendarData)) {
            if (key.startsWith(monthPrefix)) {
              for (const o of outfitsList) monthOutfitIds.add(o.id);
            }
          }
          const monthOutfits = outfits.filter((o) => monthOutfitIds.has(o.id));
          if (monthOutfits.length === 0) return null;

          return (
            <View style={styles.calSummary}>
              <Text style={styles.calSummaryTitle}>
                {monthOutfits.length} outfit{monthOutfits.length !== 1 ? "s" : ""} worn this month
              </Text>
              {monthOutfits.slice(0, 5).map((outfit) => {
                const items = outfit.itemIds.map((id) => getById(id)).filter(Boolean) as ClothingItem[];
                const wornThisMonth = outfit.wornDates.filter((d) => d.startsWith(monthPrefix)).length;
                return (
                  <Pressable
                    key={outfit.id}
                    style={styles.calOutfitRow}
                    onPress={() => router.push({ pathname: "/outfit-detail", params: { id: outfit.id } })}
                  >
                    <View style={styles.calOutfitMood}>
                      <MoodBoard items={items} size={50} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.calOutfitName} numberOfLines={1}>{outfit.name}</Text>
                      <Text style={styles.calOutfitMeta}>
                        Worn {wornThisMonth}x this month
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Theme.colors.textLight} />
                  </Pressable>
                );
              })}
            </View>
          );
        })()}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* View mode toggle */}
          <Pressable
            style={[styles.viewToggle, viewMode === "list" && styles.viewToggleActive]}
            onPress={() => setViewMode("list")}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === "list" ? Theme.colors.primary : Theme.colors.textLight}
            />
          </Pressable>
          <Pressable
            style={[styles.viewToggle, viewMode === "calendar" && styles.viewToggleActive]}
            onPress={() => setViewMode("calendar")}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={viewMode === "calendar" ? Theme.colors.primary : Theme.colors.textLight}
            />
          </Pressable>

          <View style={styles.filterDivider} />

          <Text style={styles.filterLabel}>Season:</Text>
          {SEASONS.map((s) => (
            <Chip
              key={s}
              label={SEASON_LABELS[s]}
              selected={seasonFilter === s}
              onPress={() => setSeasonFilter(seasonFilter === s ? null : s)}
            />
          ))}

          <View style={styles.filterDivider} />

          <Text style={styles.filterLabel}>Occasion:</Text>
          {OCCASIONS.map((o) => (
            <Chip
              key={o}
              label={OCCASION_LABELS[o]}
              selected={occasionFilter === o}
              onPress={() => setOccasionFilter(occasionFilter === o ? null : o)}
            />
          ))}

          {hasActiveFilter && (
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                setSeasonFilter(null);
                setOccasionFilter(null);
              }}
            >
              <Ionicons name="close-circle" size={16} color={Theme.colors.error} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : viewMode === "calendar" ? (
        renderCalendar()
      ) : outfits.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="No outfits yet"
          subtitle="Head to the Suggest tab to get AI-powered outfit recommendations based on your wardrobe!"
        />
      ) : filteredOutfits.length === 0 ? (
        <EmptyState
          icon="filter-outline"
          title="No matching outfits"
          subtitle="No outfits match the selected filters. Try changing or clearing the filters."
        />
      ) : (
        <FlatList
          data={filteredOutfits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: outfit }) => {
            const outfitItems = outfit.itemIds
              .map((id) => getById(id))
              .filter(Boolean) as ClothingItem[];

            const totalCost = outfitItems.reduce(
              (sum, i) => sum + (i.cost ?? 0),
              0
            );

            const isFlagged = outfit.hasRemovedItems === true;

            return (
              <Pressable
                style={[styles.card, isFlagged && styles.cardFlagged]}
                onPress={() =>
                  router.push({
                    pathname: "/outfit-detail",
                    params: { id: outfit.id },
                  })
                }
              >
                <View style={styles.cardBody}>
                  <View style={styles.moodBoardWrap}>
                    <MoodBoard items={outfitItems} size={110} />
                  </View>

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

                    <Text style={styles.itemList} numberOfLines={2}>
                      {outfitItems.map((i) => i?.name).join(" + ")}
                    </Text>

                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable
                          key={star}
                          onPress={() => updateRating(outfit.id, star)}
                          hitSlop={4}
                        >
                          <Ionicons
                            name={star <= outfit.rating ? "star" : "star-outline"}
                            size={14}
                            color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
                          />
                        </Pressable>
                      ))}
                      <Text style={styles.itemCount}>
                        {outfitItems.length} items
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      {totalCost > 0 && (
                        <Text style={styles.costText}>{fmt(totalCost)}</Text>
                      )}
                      {outfit.wornDates.length > 0 && (
                        <Text style={styles.wornText}>
                          Worn {outfit.wornDates.length}x
                        </Text>
                      )}
                    </View>

                    {((outfit.seasons ?? []).length > 0 ||
                      (outfit.occasions ?? []).length > 0) && (
                      <Text style={styles.tagText} numberOfLines={1}>
                        {[
                          ...(outfit.seasons ?? []).map((s) => SEASON_LABELS[s]),
                          ...(outfit.occasions ?? []).map((o) => OCCASION_LABELS[o]),
                        ].join(", ")}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.logWornBtn}
                    onPress={() => handleLogWorn(outfit.id, outfit.name)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={Theme.colors.success} />
                    <Text style={styles.logWornText}>Log Worn</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => remove(outfit.id)}
                  >
                    <Ionicons name="trash-outline" size={14} color={Theme.colors.error} />
                  </Pressable>
                </View>
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
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  filterScroll: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    gap: 6,
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: Theme.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceAlt,
  },
  viewToggleActive: {
    backgroundColor: Theme.colors.primary + "15",
  },
  filterLabel: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginRight: 2,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 6,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  clearBtnText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.error,
  },
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
  },
  cardFlagged: {
    shadowColor: "#F59E0B",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#F59E0B40",
  },
  cardBody: { flexDirection: "row", gap: 12 },
  moodBoardWrap: {
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
  },
  cardInfo: { flex: 1, justifyContent: "center", paddingRight: 4 },
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
  aiBadgeText: { fontSize: 10, fontWeight: "700", color: Theme.colors.primary },
  itemList: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  itemCount: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  costText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  wornText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.success,
    fontWeight: "500",
  },
  tagText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
  },
  logWornBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.success + "12",
  },
  logWornText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.success,
  },
  deleteBtn: { padding: 4 },
  // Calendar styles
  calContainer: { paddingBottom: 40 },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
  },
  calMonthTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  calWeekRow: {
    flexDirection: "row",
    paddingHorizontal: Theme.spacing.sm,
  },
  calWeekday: {
    flex: 1,
    textAlign: "center",
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.textLight,
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Theme.spacing.sm,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 0.5,
    borderColor: Theme.colors.border,
    overflow: "hidden",
  },
  calCellToday: {
    backgroundColor: Theme.colors.primary + "10",
    borderColor: Theme.colors.primary + "40",
    borderWidth: 1,
  },
  calDay: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.text,
    marginTop: 2,
  },
  calDayToday: {
    color: Theme.colors.primary,
    fontWeight: "800",
  },
  calDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  calDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calDotCount: {
    fontSize: 8,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  calThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginTop: 2,
  },
  calSummary: {
    padding: Theme.spacing.md,
  },
  calSummaryTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  calOutfitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  calOutfitMood: {
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
  },
  calOutfitName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  calOutfitMeta: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
});

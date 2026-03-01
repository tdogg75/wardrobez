import React, { useState, useMemo, useCallback } from "react";
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
  Modal,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useTheme } from "@/hooks/useTheme";
import { MoodBoard } from "@/components/MoodBoard";
import { EmptyState } from "@/components/EmptyState";
import { Chip } from "@/components/Chip";
import {
  SEASON_LABELS,
  OCCASION_LABELS,
  CATEGORY_LABELS,
} from "@/models/types";
import type { ClothingItem, Season, Occasion, Outfit, PlannedOutfit } from "@/models/types";
import { getPlannedOutfits, savePlannedOutfit, deletePlannedOutfit } from "@/services/storage";

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];
const OCCASIONS: Occasion[] = ["casual", "work", "fancy", "party", "vacation"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Format a category key for display, using CATEGORY_LABELS when available */
function categoryLabel(key: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[key] ?? key;
}

export default function OutfitsScreen() {
  const { outfits, loading, remove, logWorn, updateRating } = useOutfits();
  const { getById } = useClothingItems();
  const router = useRouter();
  const { theme } = useTheme();

  const [seasonFilter, setSeasonFilter] = useState<Season | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<Occasion | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Weekly planner state
  const [plannerVisible, setPlannerVisible] = useState(false);
  const [weekPlan, setWeekPlan] = useState<Record<string, string | null>>({
    Monday: null, Tuesday: null, Wednesday: null, Thursday: null,
    Friday: null, Saturday: null, Sunday: null,
  });
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [pickerSeasonFilter, setPickerSeasonFilter] = useState<Season | null>(null);
  const [pickerOccasionFilter, setPickerOccasionFilter] = useState<Occasion | null>(null);

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

  // --- Compare mode helpers ---
  const toggleCompareSelect = useCallback((outfitId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(outfitId)) {
        return prev.filter((id) => id !== outfitId);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, outfitId];
    });
  }, []);

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setCompareIds([]);
    setCompareModalVisible(false);
  }, []);

  const openCompareModal = useCallback(() => {
    if (compareIds.length >= MIN_COMPARE) {
      setCompareModalVisible(true);
    }
  }, [compareIds]);

  const comparedOutfits = useMemo(
    () => compareIds.map((id) => outfits.find((o) => o.id === id)).filter(Boolean) as Outfit[],
    [compareIds, outfits]
  );

  // Resolve items for a given outfit, respecting the new categories
  const resolveItems = useCallback(
    (outfit: Outfit): ClothingItem[] =>
      outfit.itemIds.map((id) => getById(id)).filter(Boolean) as ClothingItem[],
    [getById]
  );

  /** Summarise the category breakdown for an outfit */
  const categorySummary = useCallback(
    (items: ClothingItem[]): string => {
      const counts: Record<string, number> = {};
      for (const item of items) {
        const label = categoryLabel(item.category);
        counts[label] = (counts[label] ?? 0) + 1;
      }
      return Object.entries(counts)
        .map(([label, n]) => (n > 1 ? `${n} ${label}` : label))
        .join(", ");
    },
    []
  );

  // --- Weekly Planner helpers ---
  const loadWeekPlan = useCallback(async () => {
    const saved = await getPlannedOutfits();
    if (saved.length > 0) {
      const plan: Record<string, string | null> = {
        Monday: null, Tuesday: null, Wednesday: null, Thursday: null,
        Friday: null, Saturday: null, Sunday: null,
      };
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (const entry of saved) {
        const d = new Date(entry.date);
        const dayName = dayNames[d.getDay()];
        if (dayName && entry.outfitId) {
          plan[dayName] = entry.outfitId;
        }
      }
      setWeekPlan(plan);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWeekPlan();
    }, [loadWeekPlan])
  );

  const assignOutfit = useCallback(async (day: string, outfit: Outfit) => {
    const newPlan = { ...weekPlan, [day]: outfit.id };
    setWeekPlan(newPlan);
    const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(day);
    const currentDayIndex = (now.getDay() + 6) % 7; // Monday = 0
    const diff = dayIndex - currentDayIndex;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);
    const isoDate = targetDate.toISOString().split("T")[0];
    await savePlannedOutfit({ date: isoDate, outfitId: outfit.id });
    setPickerDay(null);
  }, [weekPlan, now]);

  const clearDay = useCallback(async (day: string) => {
    const newPlan = { ...weekPlan, [day]: null };
    setWeekPlan(newPlan);
    const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(day);
    const currentDayIndex = (now.getDay() + 6) % 7;
    const diff = dayIndex - currentDayIndex;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);
    const isoDate = targetDate.toISOString().split("T")[0];
    await deletePlannedOutfit(isoDate);
  }, [weekPlan, now]);

  const pickerOutfits = useMemo(() => {
    return outfits.filter((outfit) => {
      if (pickerSeasonFilter && !(outfit.seasons ?? []).includes(pickerSeasonFilter)) return false;
      if (pickerOccasionFilter && !(outfit.occasions ?? []).includes(pickerOccasionFilter)) return false;
      return true;
    });
  }, [outfits, pickerSeasonFilter, pickerOccasionFilter]);

  // --- Planner Modal ---
  const renderPlannerModal = () => {
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const todayIdx = (now.getDay() + 6) % 7; // Monday = 0

    return (
      <Modal
        visible={plannerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setPlannerVisible(false); setPickerDay(null); }}
      >
        <View style={[styles.plannerModal, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[styles.plannerHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.plannerTitle, { color: theme.colors.text }]}>
              Weekly Planner
            </Text>
            <Pressable onPress={() => { setPlannerVisible(false); setPickerDay(null); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {pickerDay ? (
            /* --- Outfit Picker for a specific day --- */
            <View style={{ flex: 1 }}>
              <View style={[styles.pickerHeader, { borderBottomColor: theme.colors.border }]}>
                <Pressable onPress={() => setPickerDay(null)} hitSlop={12}>
                  <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.pickerDayTitle, { color: theme.colors.text }]}>
                  {pickerDay}
                </Text>
                {weekPlan[pickerDay] && (
                  <Pressable
                    onPress={() => clearDay(pickerDay)}
                    style={[styles.pickerClearBtn, { backgroundColor: theme.colors.error + "15" }]}
                  >
                    <Text style={[styles.pickerClearText, { color: theme.colors.error }]}>Clear</Text>
                  </Pressable>
                )}
              </View>

              {/* Filters */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerFilters}
              >
                <Text style={[styles.filterLabel, { color: theme.colors.textLight }]}>Season:</Text>
                {SEASONS.map((s) => (
                  <Chip
                    key={s}
                    label={SEASON_LABELS[s]}
                    selected={pickerSeasonFilter === s}
                    onPress={() => setPickerSeasonFilter(pickerSeasonFilter === s ? null : s)}
                  />
                ))}
                <View style={[styles.filterDivider, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.filterLabel, { color: theme.colors.textLight }]}>Occasion:</Text>
                {OCCASIONS.map((o) => (
                  <Chip
                    key={o}
                    label={OCCASION_LABELS[o]}
                    selected={pickerOccasionFilter === o}
                    onPress={() => setPickerOccasionFilter(pickerOccasionFilter === o ? null : o)}
                  />
                ))}
              </ScrollView>

              {/* Outfit list */}
              <FlatList
                data={pickerOutfits}
                keyExtractor={(o) => o.id}
                contentContainerStyle={styles.pickerList}
                ListEmptyComponent={
                  <View style={styles.pickerEmpty}>
                    <Ionicons name="shirt-outline" size={32} color={theme.colors.textLight} />
                    <Text style={[styles.pickerEmptyText, { color: theme.colors.textLight }]}>
                      No outfits match these filters
                    </Text>
                  </View>
                }
                renderItem={({ item: outfit }) => {
                  const oItems = resolveItems(outfit);
                  const isSelected = weekPlan[pickerDay] === outfit.id;
                  return (
                    <Pressable
                      style={[
                        styles.pickerCard,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                      ]}
                      onPress={() => assignOutfit(pickerDay, outfit)}
                    >
                      <View style={styles.pickerCardBody}>
                        <View style={styles.pickerMoodWrap}>
                          <MoodBoard items={oItems} size={80} />
                        </View>
                        <View style={styles.pickerCardInfo}>
                          <Text style={[styles.pickerCardName, { color: theme.colors.text }]} numberOfLines={1}>
                            {outfit.name}
                          </Text>
                          <Text style={[styles.pickerCardItems, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                            {oItems.map((i) => i.name).join(" + ")}
                          </Text>
                          <View style={styles.pickerCardMeta}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= outfit.rating ? "star" : "star-outline"}
                                size={12}
                                color={star <= outfit.rating ? "#FFD700" : theme.colors.textLight}
                              />
                            ))}
                            {(outfit.occasions ?? []).length > 0 && (
                              <Text style={[styles.pickerCardTag, { color: theme.colors.primary }]}>
                                {(outfit.occasions ?? []).map((o) => OCCASION_LABELS[o]).join(", ")}
                              </Text>
                            )}
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          ) : (
            /* --- Days of the week overview --- */
            <ScrollView contentContainerStyle={styles.plannerBody}>
              {DAYS.map((day, idx) => {
                const outfitId = weekPlan[day];
                const outfit = outfitId ? outfits.find((o) => o.id === outfitId) : null;
                const oItems = outfit ? resolveItems(outfit) : [];
                const isToday = idx === todayIdx;

                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.plannerDayRow,
                      { borderBottomColor: theme.colors.border },
                      isToday && { backgroundColor: theme.colors.primary + "08" },
                    ]}
                    onPress={() => {
                      setPickerDay(day);
                      setPickerSeasonFilter(null);
                      setPickerOccasionFilter(null);
                    }}
                  >
                    <View style={[styles.plannerDayLabel, isToday && { backgroundColor: theme.colors.primary + "15" }]}>
                      <Text style={[styles.plannerDayText, { color: isToday ? theme.colors.primary : theme.colors.text }]}>
                        {day.slice(0, 3)}
                      </Text>
                      {isToday && (
                        <View style={[styles.todayDot, { backgroundColor: theme.colors.primary }]} />
                      )}
                    </View>
                    {outfit ? (
                      <View style={styles.plannerOutfitInfo}>
                        <View style={styles.plannerMoodBoardWrap}>
                          <MoodBoard items={oItems} size={56} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.plannerOutfitName, { color: theme.colors.text }]} numberOfLines={1}>
                            {outfit.name}
                          </Text>
                          <Text style={[styles.plannerOutfitMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            {oItems.length} items
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                      </View>
                    ) : (
                      <View style={[styles.plannerEmptySlot, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
                        <Ionicons name="add-outline" size={18} color={theme.colors.textLight} />
                        <Text style={[styles.plannerEmptyText, { color: theme.colors.textLight }]}>Tap to assign</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    );
  };

  // --- Comparison Modal ---
  const renderCompareModal = () => {
    const screenWidth = Dimensions.get("window").width;
    const colWidth = (screenWidth - 48) / comparedOutfits.length;

    return (
      <Modal
        visible={compareModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompareModalVisible(false)}
      >
        <View style={[styles.compareModal, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[styles.compareHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.compareTitle, { color: theme.colors.text }]}>
              Compare Outfits
            </Text>
            <Pressable onPress={() => setCompareModalVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.compareBody}>
            {/* Mood boards row */}
            <View style={styles.compareRow}>
              {comparedOutfits.map((outfit) => {
                const items = resolveItems(outfit);
                return (
                  <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                    <MoodBoard items={items} size={colWidth - 12} />
                  </View>
                );
              })}
            </View>

            {/* Names row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                  <Text style={[styles.compareName, { color: theme.colors.text }]} numberOfLines={2}>
                    {outfit.name}
                    {outfit.nameLocked && (
                      <Text style={{ color: theme.colors.textLight }}> </Text>
                    )}
                  </Text>
                </View>
              ))}
            </View>

            {/* Rating row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                  <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                    Rating
                  </Text>
                  <View style={styles.compareStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= outfit.rating ? "star" : "star-outline"}
                        size={14}
                        color={star <= outfit.rating ? "#FFD700" : theme.colors.textLight}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {/* Total cost row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => {
                const items = resolveItems(outfit);
                const totalCost = items.reduce((sum, i) => sum + (i.cost ?? 0), 0);
                return (
                  <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                    <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                      Total Cost
                    </Text>
                    <Text style={[styles.compareCost, { color: theme.colors.text }]}>
                      {totalCost > 0 ? fmt(totalCost) : "--"}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Items / categories row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => {
                const items = resolveItems(outfit);
                return (
                  <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                    <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                      Items ({items.length})
                    </Text>
                    <Text style={[styles.compareDetail, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                      {categorySummary(items)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Occasions row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                  <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                    Occasions
                  </Text>
                  <Text style={[styles.compareDetail, { color: theme.colors.primary }]} numberOfLines={2}>
                    {(outfit.occasions ?? []).map((o) => OCCASION_LABELS[o]).join(", ") || "--"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Seasons row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                  <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                    Seasons
                  </Text>
                  <Text style={[styles.compareDetail, { color: theme.colors.primary }]} numberOfLines={2}>
                    {(outfit.seasons ?? []).map((s) => SEASON_LABELS[s]).join(", ") || "--"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Worn count row */}
            <View style={[styles.compareSectionRow, { borderTopColor: theme.colors.border }]}>
              {comparedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.compareCol, { width: colWidth }]}>
                  <Text style={[styles.compareSectionLabel, { color: theme.colors.textLight }]}>
                    Times Worn
                  </Text>
                  <Text style={[styles.compareDetail, { color: theme.colors.success }]}>
                    {outfit.wornDates.length}x
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Done button */}
          <View style={[styles.compareFooter, { borderTopColor: theme.colors.border }]}>
            <Pressable
              style={[styles.compareDoneBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setCompareModalVisible(false)}
            >
              <Text style={styles.compareDoneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

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
        <View key={d} style={[styles.calCell, isToday && { backgroundColor: theme.colors.primary + "10", borderColor: theme.colors.primary + "40", borderWidth: 1 }]}>
          <Text style={[styles.calDay, isToday && { color: theme.colors.primary, fontWeight: "800" as const }]}>{d}</Text>
          {dayOutfits.length > 0 && (
            <View style={styles.calDots}>
              {dayOutfits.length === 1 ? (
                <View style={[styles.calDot, { backgroundColor: theme.colors.primary }]} />
              ) : (
                <>
                  <View style={[styles.calDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={[styles.calDotCount, { color: theme.colors.primary }]}>{dayOutfits.length}</Text>
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
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.calMonthTitle, { color: theme.colors.text }]}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <Pressable onPress={() => navigateMonth(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={styles.calWeekRow}>
          {WEEKDAYS.map((wd) => (
            <Text key={wd} style={[styles.calWeekday, { color: theme.colors.textLight }]}>{wd}</Text>
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
              <Text style={[styles.calSummaryTitle, { color: theme.colors.text }]}>
                {monthOutfits.length} outfit{monthOutfits.length !== 1 ? "s" : ""} worn this month
              </Text>
              {monthOutfits.slice(0, 5).map((outfit) => {
                const items = outfit.itemIds.map((id) => getById(id)).filter(Boolean) as ClothingItem[];
                const wornThisMonth = outfit.wornDates.filter((d) => d.startsWith(monthPrefix)).length;
                return (
                  <Pressable
                    key={outfit.id}
                    style={[styles.calOutfitRow, { borderBottomColor: theme.colors.border }]}
                    onPress={() => router.push({ pathname: "/outfit-detail", params: { id: outfit.id } })}
                  >
                    <View style={styles.calOutfitMood}>
                      <MoodBoard items={items} size={50} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.calOutfitName, { color: theme.colors.text }]} numberOfLines={1}>{outfit.name}</Text>
                      <Text style={[styles.calOutfitMeta, { color: theme.colors.textSecondary }]}>
                        Worn {wornThisMonth}x this month
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with outfit count (#10) */}
      <View style={styles.outfitsHeaderRow}>
        <Text style={[styles.outfitsHeaderTitle, { color: theme.colors.text }]}>
          Outfits ({filteredOutfits.length})
        </Text>
      </View>
      {/* Filter bar */}
      <View style={[styles.filterBar, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* View mode toggle */}
          <Pressable
            style={[styles.viewToggle, { backgroundColor: theme.colors.surfaceAlt }, viewMode === "list" && { backgroundColor: theme.colors.primary + "15" }]}
            onPress={() => setViewMode("list")}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === "list" ? theme.colors.primary : theme.colors.textLight}
            />
          </Pressable>
          <Pressable
            style={[styles.viewToggle, { backgroundColor: theme.colors.surfaceAlt }, viewMode === "calendar" && { backgroundColor: theme.colors.primary + "15" }]}
            onPress={() => setViewMode("calendar")}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={viewMode === "calendar" ? theme.colors.primary : theme.colors.textLight}
            />
          </Pressable>

          {/* Weekly planner button */}
          <Pressable
            style={[styles.viewToggle, { backgroundColor: theme.colors.surfaceAlt }]}
            onPress={() => setPlannerVisible(true)}
          >
            <Ionicons
              name="today-outline"
              size={16}
              color={theme.colors.textLight}
            />
          </Pressable>

          <View style={[styles.filterDivider, { backgroundColor: theme.colors.border }]} />

          {/* Compare mode toggle */}
          <Pressable
            style={[
              styles.viewToggle,
              { backgroundColor: theme.colors.surfaceAlt },
              compareMode && { backgroundColor: theme.colors.secondary + "20" },
            ]}
            onPress={() => {
              if (compareMode) {
                exitCompareMode();
              } else {
                setCompareMode(true);
                setCompareIds([]);
                setViewMode("list");
              }
            }}
          >
            <Ionicons
              name="git-compare-outline"
              size={16}
              color={compareMode ? theme.colors.secondary : theme.colors.textLight}
            />
          </Pressable>

          <View style={[styles.filterDivider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.filterLabel, { color: theme.colors.textLight }]}>Season:</Text>
          {SEASONS.map((s) => (
            <Chip
              key={s}
              label={SEASON_LABELS[s]}
              selected={seasonFilter === s}
              onPress={() => setSeasonFilter(seasonFilter === s ? null : s)}
            />
          ))}

          <View style={[styles.filterDivider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.filterLabel, { color: theme.colors.textLight }]}>Occasion:</Text>
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
              <Ionicons name="close-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.clearBtnText, { color: theme.colors.error }]}>Clear</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Compare mode banner */}
      {compareMode && (
        <View style={[styles.compareBanner, { backgroundColor: theme.colors.secondary + "15", borderBottomColor: theme.colors.secondary + "30" }]}>
          <Ionicons name="git-compare-outline" size={16} color={theme.colors.secondary} />
          <Text style={[styles.compareBannerText, { color: theme.colors.secondary }]}>
            Select {MIN_COMPARE}-{MAX_COMPARE} outfits to compare ({compareIds.length} selected)
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {compareIds.length >= MIN_COMPARE && (
              <Pressable
                style={[styles.compareGoBtn, { backgroundColor: theme.colors.secondary }]}
                onPress={openCompareModal}
              >
                <Text style={styles.compareGoBtnText}>Compare</Text>
              </Pressable>
            )}
            <Pressable onPress={exitCompareMode} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={theme.colors.secondary} />
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
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
            const isSelectedForCompare = compareMode && compareIds.includes(outfit.id);

            return (
              <Pressable
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface },
                  isFlagged && styles.cardFlagged,
                  isSelectedForCompare && { borderColor: theme.colors.secondary, borderWidth: 2 },
                ]}
                onPress={() => {
                  if (compareMode) {
                    toggleCompareSelect(outfit.id);
                  } else {
                    router.push({
                      pathname: "/outfit-detail",
                      params: { id: outfit.id },
                    });
                  }
                }}
              >
                {/* Compare selection indicator */}
                {compareMode && (
                  <View style={[
                    styles.compareCheckbox,
                    {
                      backgroundColor: isSelectedForCompare ? theme.colors.secondary : theme.colors.surfaceAlt,
                      borderColor: isSelectedForCompare ? theme.colors.secondary : theme.colors.border,
                    },
                  ]}>
                    {isSelectedForCompare && (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    )}
                  </View>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.moodBoardWrap}>
                    <MoodBoard items={outfitItems} size={110} />
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {outfit.name}
                      </Text>
                      {outfit.nameLocked && (
                        <Ionicons name="lock-closed" size={10} color={theme.colors.textLight} />
                      )}
                      {outfit.suggested && (
                        <View style={[styles.aiBadge, { backgroundColor: theme.colors.primary + "15" }]}>
                          <Ionicons name="sparkles" size={10} color={theme.colors.primary} />
                          <Text style={[styles.aiBadgeText, { color: theme.colors.primary }]}>AI</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.itemList, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {outfitItems.map((i) => i?.name).join(" + ")}
                    </Text>

                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable
                          key={star}
                          onPress={() => {
                            if (!compareMode) updateRating(outfit.id, star);
                          }}
                          hitSlop={4}
                        >
                          <Ionicons
                            name={star <= outfit.rating ? "star" : "star-outline"}
                            size={14}
                            color={star <= outfit.rating ? "#FFD700" : theme.colors.textLight}
                          />
                        </Pressable>
                      ))}
                      <Text style={[styles.itemCount, { color: theme.colors.textLight }]}>
                        {outfitItems.length} items
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      {totalCost > 0 && (
                        <Text style={[styles.costText, { color: theme.colors.textSecondary }]}>{fmt(totalCost)}</Text>
                      )}
                      {outfit.wornDates.length > 0 && (
                        <Text style={[styles.wornText, { color: theme.colors.success }]}>
                          Worn {outfit.wornDates.length}x
                        </Text>
                      )}
                    </View>

                    {((outfit.seasons ?? []).length > 0 ||
                      (outfit.occasions ?? []).length > 0) && (
                      <Text style={[styles.tagText, { color: theme.colors.primary }]} numberOfLines={1}>
                        {[
                          ...(outfit.seasons ?? []).map((s) => SEASON_LABELS[s]),
                          ...(outfit.occasions ?? []).map((o) => OCCASION_LABELS[o]),
                        ].join(", ")}
                      </Text>
                    )}
                  </View>
                </View>

                {!compareMode && (
                  <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
                    <Pressable
                      style={[styles.logWornBtn, { backgroundColor: theme.colors.success + "12" }]}
                      onPress={() => handleLogWorn(outfit.id, outfit.name)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.success} />
                      <Text style={[styles.logWornText, { color: theme.colors.success }]}>Log Worn</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => remove(outfit.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {/* Comparison modal */}
      {renderCompareModal()}

      {/* Weekly planner modal */}
      {renderPlannerModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: "center" },
  outfitsHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  outfitsHeaderTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    gap: 6,
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginRight: 2,
  },
  filterDivider: {
    width: 1,
    height: 20,
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
    fontSize: 11,
    fontWeight: "600",
  },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
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
    borderRadius: 8,
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
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  aiBadgeText: { fontSize: 10, fontWeight: "700" },
  itemList: {
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 16,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  itemCount: {
    fontSize: 11,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  costText: {
    fontSize: 11,
    fontWeight: "500",
  },
  wornText: {
    fontSize: 11,
    fontWeight: "500",
  },
  tagText: {
    fontSize: 11,
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
  },
  logWornBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  logWornText: {
    fontSize: 11,
    fontWeight: "600",
  },
  deleteBtn: { padding: 4 },

  // Compare mode
  compareBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  compareGoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compareGoBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  compareCheckbox: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  // Compare modal
  compareModal: {
    flex: 1,
  },
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  compareBody: {
    paddingBottom: 32,
  },
  compareRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  compareCol: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  compareSectionRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  compareName: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  compareSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: "center",
  },
  compareStars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
  },
  compareCost: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  compareDetail: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16,
  },
  compareFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compareDoneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  compareDoneBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Calendar styles
  calContainer: { paddingBottom: 40 },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  calMonthTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  calWeekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  calWeekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 0.5,
    borderColor: "transparent",
    overflow: "hidden",
  },
  calDay: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
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
  },
  calThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginTop: 2,
  },
  calSummary: {
    padding: 16,
  },
  calSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  calOutfitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calOutfitMood: {
    borderRadius: 8,
    overflow: "hidden",
  },
  calOutfitName: {
    fontSize: 15,
    fontWeight: "600",
  },
  calOutfitMeta: {
    fontSize: 11,
  },

  // Weekly Planner styles
  plannerModal: { flex: 1 },
  plannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  plannerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  plannerBody: { paddingBottom: 40 },
  plannerDayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  plannerDayLabel: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  plannerDayText: {
    fontSize: 14,
    fontWeight: "700",
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
  plannerOutfitInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  plannerMoodBoardWrap: {
    borderRadius: 8,
    overflow: "hidden",
  },
  plannerOutfitName: {
    fontSize: 14,
    fontWeight: "600",
  },
  plannerOutfitMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  plannerEmptySlot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  plannerEmptyText: {
    fontSize: 13,
  },

  // Outfit picker styles
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerDayTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  pickerClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickerClearText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pickerFilters: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    gap: 6,
  },
  pickerList: {
    padding: 12,
    paddingBottom: 40,
  },
  pickerEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  pickerEmptyText: {
    fontSize: 14,
  },
  pickerCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: "hidden",
  },
  pickerCardBody: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 12,
  },
  pickerMoodWrap: {
    borderRadius: 8,
    overflow: "hidden",
  },
  pickerCardInfo: {
    flex: 1,
  },
  pickerCardName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  pickerCardItems: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 4,
  },
  pickerCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  pickerCardTag: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 6,
  },
});

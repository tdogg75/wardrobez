import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { suggestOutfits, generateOutfitName, flagOutfit, detectRepeatOutfit, type SuggestionResult } from "@/services/outfitEngine";
import {
  getCurrentWeather,
  weatherToSeason,
  getWeatherTips,
  type WeatherData,
} from "@/services/weatherService";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { MoodBoard } from "@/components/MoodBoard";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import type { Season, Occasion } from "@/models/types";
import { SEASON_LABELS, CATEGORY_LABELS, OCCASION_LABELS } from "@/models/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const QUICK_PICK_CARD_WIDTH = SCREEN_WIDTH - 64;

const OCCASIONS: Occasion[] = ["casual", "work", "fancy", "party", "vacation"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default function SuggestScreen() {
  const { theme } = useTheme();
  const { items } = useClothingItems();
  const { outfits, addOrUpdate: saveOutfit } = useOutfits();

  // Build rated outfits for feedback (#66)
  const ratedOutfits = useMemo(() =>
    outfits
      .filter((o) => o.rating && o.rating > 0)
      .map((o) => ({ itemIds: o.itemIds, rating: o.rating ?? 0 })),
    [outfits]
  );

  const [season, setSeason] = useState<Season | undefined>(undefined);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [generated, setGenerated] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherTips, setWeatherTips] = useState<string[]>([]);
  const [quickPickMode, setQuickPickMode] = useState(false);
  const [quickPicks, setQuickPicks] = useState<SuggestionResult[]>([]);
  const [activeQuickPick, setActiveQuickPick] = useState(0);
  const quickPickScrollRef = useRef<ScrollView>(null);
  const quickPickFadeAnim = useRef(new Animated.Value(0)).current;

  // Save modal state — lets user pick occasions/seasons before saving
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalSuggestion, setSaveModalSuggestion] = useState<{ suggestion: SuggestionResult; idx: number } | null>(null);
  const [saveOccasions, setSaveOccasions] = useState<Occasion[]>([]);
  const [saveSeasons, setSaveSeasons] = useState<Season[]>([]);

  // Flag modal state — lets user flag an outfit as bad
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [flagSuggestion, setFlagSuggestion] = useState<SuggestionResult | null>(null);
  const [flagReason, setFlagReason] = useState("");

  // Track custom names per suggestion index
  const [customNames, setCustomNames] = useState<Record<number, string>>({});

  // Track locked names per suggestion index (generated names locked on first generation)
  const [lockedNames, setLockedNames] = useState<Record<number, string>>({});

  // Load last used filters from AsyncStorage on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedSeason, savedOccasion] = await Promise.all([
          AsyncStorage.getItem("wardrobez:suggest_last_season"),
          AsyncStorage.getItem("wardrobez:suggest_last_occasion"),
        ]);
        if (!mounted) return;
        if (savedSeason) setSeason(savedSeason as Season);
        if (savedOccasion) setSelectedOccasion(savedOccasion as Occasion);
      } catch (_) {
        // ignore storage errors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch weather on mount — weather-detected season overrides stored value
  useEffect(() => {
    let mounted = true;
    setLoadingWeather(true);
    getCurrentWeather()
      .then((w) => {
        if (!mounted) return;
        setWeather(w);
        if (w) {
          setWeatherTips(getWeatherTips(w));
          // Weather-detected season always overrides stored/manual selection
          setSeason(weatherToSeason(w));
        }
      })
      .finally(() => mounted && setLoadingWeather(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Persist season whenever it changes
  useEffect(() => {
    if (season) {
      AsyncStorage.setItem("wardrobez:suggest_last_season", season).catch(() => {});
    } else {
      AsyncStorage.removeItem("wardrobez:suggest_last_season").catch(() => {});
    }
  }, [season]);

  // Persist occasion whenever it changes
  useEffect(() => {
    if (selectedOccasion) {
      AsyncStorage.setItem("wardrobez:suggest_last_occasion", selectedOccasion).catch(() => {});
    } else {
      AsyncStorage.removeItem("wardrobez:suggest_last_occasion").catch(() => {});
    }
  }, [selectedOccasion]);

  /**
   * Filter items by occasion when an occasion chip is selected.
   * Bias toward items tagged with the selected occasion, but also
   * include untagged items so we still get results.
   */
  const occasionFilteredItems = useMemo(() => {
    if (!selectedOccasion) return items;

    const tagged: typeof items = [];
    const untagged: typeof items = [];

    for (const item of items) {
      if (item.occasions && item.occasions.includes(selectedOccasion)) {
        tagged.push(item);
      } else if (!item.occasions || item.occasions.length === 0) {
        untagged.push(item);
      }
    }

    // If we have enough tagged items, prefer them but mix in untagged for variety
    if (tagged.length >= 4) {
      return [...tagged, ...untagged];
    }
    // Otherwise include all items so the engine has enough to work with
    return items;
  }, [items, selectedOccasion]);

  const getSuggestedName = (suggestion: SuggestionResult, idx: number): string => {
    if (customNames[idx] !== undefined) return customNames[idx];
    if (lockedNames[idx] !== undefined) return lockedNames[idx];
    // Generate and lock the name on first access
    const name = generateOutfitName(suggestion.items);
    setLockedNames((prev) => ({ ...prev, [idx]: name }));
    return name;
  };

  const handleResetName = (idx: number) => {
    setCustomNames((prev) => {
      const next = { ...prev };
      next[idx] = `Outfit #${Date.now().toString(36).slice(-4).toUpperCase()}`;
      return next;
    });
    // Clear the locked name so custom takes precedence
    setLockedNames((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const handleRegenerateName = (suggestion: SuggestionResult, idx: number) => {
    const newName = generateOutfitName(suggestion.items);
    setCustomNames((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setLockedNames((prev) => ({ ...prev, [idx]: newName }));
  };

  const handleGenerate = useCallback(() => {
    if (occasionFilteredItems.length < 2) {
      Alert.alert(
        "Not enough items",
        "Add at least 2 clothing items to your wardrobe to get outfit suggestions."
      );
      return;
    }
    const results = suggestOutfits(occasionFilteredItems, { season, maxResults: 6, ratedOutfits });
    setSuggestions(results);
    setGenerated(true);
    setQuickPickMode(false);
    setCustomNames({});
    setLockedNames({});
  }, [occasionFilteredItems, season, ratedOutfits]);

  const handleSurpriseMe = useCallback(() => {
    if (occasionFilteredItems.length < 2) {
      Alert.alert("Not enough items", "Add at least 2 items first.");
      return;
    }
    const results = suggestOutfits(occasionFilteredItems, { season, maxResults: 10, ratedOutfits });
    if (results.length === 0) {
      Alert.alert("No luck!", "Couldn't assemble an outfit. Try adding more items.");
      return;
    }
    const pick = results[Math.floor(Math.random() * results.length)];
    setSuggestions([pick]);
    setGenerated(true);
    setQuickPickMode(false);
    setCustomNames({});
    setLockedNames({});
  }, [occasionFilteredItems, season]);

  const handleQuickPick = useCallback(() => {
    if (occasionFilteredItems.length < 2) {
      Alert.alert("Not enough items", "Add at least 2 items first.");
      return;
    }
    const results = suggestOutfits(occasionFilteredItems, { season, maxResults: 10, ratedOutfits });
    if (results.length === 0) {
      Alert.alert("No luck!", "Couldn't assemble an outfit. Try adding more items.");
      return;
    }
    // Pick up to 3 from the top results
    const picks = results.slice(0, Math.min(3, results.length));
    setQuickPicks(picks);
    setQuickPickMode(true);
    setActiveQuickPick(0);
    setGenerated(false);
    setSuggestions([]);
    setCustomNames({});
    setLockedNames({});

    // Animate in
    quickPickFadeAnim.setValue(0);
    Animated.timing(quickPickFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [occasionFilteredItems, season, quickPickFadeAnim]);

  const openSaveModal = (suggestion: SuggestionResult, idx: number) => {
    setSaveModalSuggestion({ suggestion, idx });
    setSaveOccasions(selectedOccasion ? [selectedOccasion] : []);
    setSaveSeasons(season ? [season] : []);
    setSaveModalVisible(true);
  };

  const handleConfirmSave = async () => {
    if (!saveModalSuggestion) return;
    const { suggestion, idx } = saveModalSuggestion;
    const name = getSuggestedName(suggestion, idx);

    await saveOutfit({
      id: generateId(),
      name,
      nameLocked: true,
      itemIds: suggestion.items.map((i) => i.id),
      occasions: saveOccasions,
      seasons: saveSeasons,
      rating: Math.min(5, Math.max(1, Math.round(suggestion.score / 20))),
      createdAt: Date.now(),
      suggested: true,
      wornDates: [],
    });

    setSaveModalVisible(false);
    setSaveModalSuggestion(null);
    Alert.alert("Saved!", `"${name}" has been added to your outfits.`);

    if (quickPickMode) {
      setQuickPickMode(false);
      setQuickPicks([]);
    }
  };

  const handleQuickPickSelect = (suggestion: SuggestionResult, idx: number) => {
    openSaveModal(suggestion, idx);
  };

  const handleSave = (suggestion: SuggestionResult, idx: number) => {
    openSaveModal(suggestion, idx);
  };

  const openFlagModal = (suggestion: SuggestionResult) => {
    setFlagSuggestion(suggestion);
    setFlagReason("");
    setFlagModalVisible(true);
  };

  const handleConfirmFlag = async () => {
    if (!flagSuggestion || !flagReason.trim()) return;
    const subs = flagSuggestion.items.map((i) => i.subCategory ?? i.category);
    const pattern = subs.join("+");
    await flagOutfit(pattern, flagReason.trim());
    setFlagModalVisible(false);
    setFlagSuggestion(null);
    Alert.alert("Flagged", "This type of outfit won't be suggested again.");
  };

  const handleQuickPickScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (QUICK_PICK_CARD_WIDTH + 16));
    setActiveQuickPick(Math.max(0, Math.min(index, quickPicks.length - 1)));
  };

  // Dynamic styles that depend on theme
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.md, paddingBottom: 60 },
        heading: {
          fontSize: theme.fontSize.xxl,
          fontWeight: "800",
          color: theme.colors.text,
          marginBottom: 4,
        },
        subtitle: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textSecondary,
          lineHeight: 22,
          marginBottom: theme.spacing.md,
        },
        weatherCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.primary + "20",
        },
        weatherHeader: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        weatherInfo: { flex: 1 },
        weatherTemp: {
          fontSize: theme.fontSize.lg,
          fontWeight: "700",
          color: theme.colors.text,
        },
        weatherDesc: {
          fontSize: theme.fontSize.md,
          fontWeight: "400",
          color: theme.colors.textSecondary,
        },
        weatherCity: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textLight,
          marginTop: 2,
        },
        feelsLike: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
          fontWeight: "500",
        },
        weatherLoadingText: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
          marginLeft: 8,
        },
        weatherTips: {
          marginTop: theme.spacing.sm,
          gap: 4,
        },
        tipRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        tipText: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
          flex: 1,
        },
        sectionTitle: {
          fontSize: theme.fontSize.md,
          fontWeight: "600",
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap" },
        buttonRow: {
          flexDirection: "row",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
        },
        generateBtn: {
          flex: 2,
          flexDirection: "row",
          height: 52,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        },
        generateBtnText: {
          color: "#FFFFFF",
          fontSize: theme.fontSize.lg,
          fontWeight: "700",
        },
        surpriseBtn: {
          flex: 1,
          flexDirection: "row",
          height: 52,
          borderRadius: theme.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + "08",
        },
        surpriseBtnText: {
          color: theme.colors.primary,
          fontSize: theme.fontSize.md,
          fontWeight: "700",
        },
        quickPickBtn: {
          flexDirection: "row",
          height: 48,
          borderRadius: theme.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          backgroundColor: theme.colors.accent + "18",
          borderWidth: 1.5,
          borderColor: theme.colors.accent,
          marginBottom: theme.spacing.md,
        },
        quickPickBtnText: {
          color: theme.colors.accent,
          fontSize: theme.fontSize.md,
          fontWeight: "700",
        },
        noResults: {
          padding: theme.spacing.xl,
          alignItems: "center",
        },
        noResultsText: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textSecondary,
          textAlign: "center",
        },
        suggestionCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
        suggestionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        },
        suggestionTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: "700",
          color: theme.colors.text,
          flex: 1,
          marginRight: 8,
        },
        nameActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        scoreText: {
          fontSize: theme.fontSize.sm,
          fontWeight: "600",
          color: theme.colors.primary,
          marginBottom: 8,
        },
        moodBoardWrap: {
          alignItems: "center",
          marginBottom: 12,
        },
        palette: { flexDirection: "row", gap: 6, marginBottom: 12 },
        itemRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        itemDot: { width: 10, height: 10, borderRadius: 5 },
        itemInfo: { flex: 1 },
        itemName: {
          fontSize: theme.fontSize.md,
          fontWeight: "600",
          color: theme.colors.text,
        },
        itemMeta: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
        },
        reasons: { marginTop: 10, gap: 4 },
        reasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        reasonText: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
        },
        saveOutfitBtn: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          paddingVertical: 10,
          borderRadius: theme.borderRadius.sm,
          backgroundColor: theme.colors.primary + "12",
        },
        saveOutfitText: {
          fontSize: theme.fontSize.md,
          fontWeight: "600",
          color: theme.colors.primary,
        },
        // Quick Pick styles
        quickPickContainer: {
          marginBottom: theme.spacing.lg,
        },
        quickPickTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: "800",
          color: theme.colors.text,
          textAlign: "center",
          marginBottom: 4,
        },
        quickPickSubtitle: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textSecondary,
          textAlign: "center",
          marginBottom: theme.spacing.md,
        },
        quickPickScroll: {
          paddingHorizontal: 16,
        },
        quickPickCard: {
          width: QUICK_PICK_CARD_WIDTH,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginRight: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
          borderWidth: 2,
          borderColor: "transparent",
        },
        quickPickCardActive: {
          borderColor: theme.colors.primary,
        },
        quickPickCardName: {
          fontSize: theme.fontSize.lg,
          fontWeight: "700",
          color: theme.colors.text,
          textAlign: "center",
          marginBottom: 8,
        },
        quickPickCardScore: {
          fontSize: theme.fontSize.sm,
          fontWeight: "600",
          color: theme.colors.primary,
          textAlign: "center",
          marginBottom: 12,
        },
        quickPickItemRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 4,
        },
        quickPickItemName: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.text,
          fontWeight: "500",
        },
        quickPickItemMeta: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
        },
        quickPickSelectBtn: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.primary,
        },
        quickPickSelectText: {
          fontSize: theme.fontSize.md,
          fontWeight: "700",
          color: "#FFFFFF",
        },
        quickPickDots: {
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginTop: theme.spacing.md,
        },
        quickPickDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.border,
        },
        quickPickDotActive: {
          backgroundColor: theme.colors.primary,
          width: 24,
        },
        quickPickDismiss: {
          alignItems: "center",
          marginTop: theme.spacing.sm,
          paddingVertical: 8,
        },
        quickPickDismissText: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textLight,
          fontWeight: "500",
        },
        occasionLabel: {
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
      }),
    [theme]
  );

  if (items.length < 2) {
    return (
      <View style={dynamicStyles.container}>
        <EmptyState
          icon="sparkles-outline"
          title="Add more items"
          subtitle="You need at least 2 clothing items in your wardrobe before we can suggest outfits."
        />
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.content}>
      <Text style={dynamicStyles.heading}>Get Outfit Ideas</Text>
      <Text style={dynamicStyles.subtitle}>
        Our engine analyses colour harmony, fabric compatibility, and seasonal
        fit to suggest your best looks.
      </Text>

      {/* Weather Card */}
      {loadingWeather ? (
        <View style={dynamicStyles.weatherCard}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={dynamicStyles.weatherLoadingText}>Checking weather...</Text>
        </View>
      ) : weather ? (
        <View style={dynamicStyles.weatherCard}>
          <View style={dynamicStyles.weatherHeader}>
            <Ionicons
              name={weather.icon as any}
              size={28}
              color={theme.colors.primary}
            />
            <View style={dynamicStyles.weatherInfo}>
              <Text style={dynamicStyles.weatherTemp}>
                {weather.temp}°C{" "}
                <Text style={dynamicStyles.weatherDesc}>{weather.description}</Text>
              </Text>
              {weather.city ? (
                <Text style={dynamicStyles.weatherCity}>{weather.city}</Text>
              ) : null}
            </View>
            {weather.feelsLike !== weather.temp && (
              <Text style={dynamicStyles.feelsLike}>
                Feels {weather.feelsLike}°
              </Text>
            )}
          </View>
          {weatherTips.length > 0 && (
            <View style={dynamicStyles.weatherTips}>
              {weatherTips.map((tip, i) => (
                <View key={i} style={dynamicStyles.tipRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={theme.colors.primary}
                  />
                  <Text style={dynamicStyles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Season Chips */}
      <Text style={dynamicStyles.sectionTitle}>Season (optional)</Text>
      <View style={dynamicStyles.chipRow}>
        {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
          <Chip
            key={s}
            label={SEASON_LABELS[s]}
            selected={season === s}
            onPress={() => setSeason(season === s ? undefined : s)}
          />
        ))}
      </View>

      {/* Occasion Chips (#13) */}
      <Text style={dynamicStyles.sectionTitle}>Occasion (optional)</Text>
      <View style={dynamicStyles.chipRow}>
        {OCCASIONS.map((occ) => (
          <Chip
            key={occ}
            label={OCCASION_LABELS[occ]}
            selected={selectedOccasion === occ}
            onPress={() =>
              setSelectedOccasion(selectedOccasion === occ ? undefined : occ)
            }
          />
        ))}
      </View>

      {/* Morning Routine Quick Pick (#16) */}
      <Pressable style={dynamicStyles.quickPickBtn} onPress={handleQuickPick}>
        <Ionicons name="flash" size={20} color={theme.colors.accent} />
        <Text style={dynamicStyles.quickPickBtnText}>Quick Pick</Text>
      </Pressable>

      {/* Quick Pick Carousel */}
      {quickPickMode && quickPicks.length > 0 && (
        <Animated.View
          style={[dynamicStyles.quickPickContainer, { opacity: quickPickFadeAnim }]}
        >
          <Text style={dynamicStyles.quickPickTitle}>Your Morning Picks</Text>
          <Text style={dynamicStyles.quickPickSubtitle}>
            Swipe to browse, tap to save your pick
          </Text>

          <ScrollView
            ref={quickPickScrollRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={QUICK_PICK_CARD_WIDTH + 16}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.quickPickScroll}
            onMomentumScrollEnd={handleQuickPickScroll}
          >
            {quickPicks.map((pick, idx) => {
              const isActive = idx === activeQuickPick;
              return (
                <View
                  key={idx}
                  style={[
                    dynamicStyles.quickPickCard,
                    isActive && dynamicStyles.quickPickCardActive,
                  ]}
                >
                  <Text style={dynamicStyles.quickPickCardName}>
                    {getSuggestedName(pick, idx + 1000)}
                  </Text>
                  <Text style={dynamicStyles.quickPickCardScore}>
                    Score: {Math.round(pick.score)}
                  </Text>

                  <View style={dynamicStyles.moodBoardWrap}>
                    <MoodBoard items={pick.items} size={200} />
                  </View>

                  <View style={dynamicStyles.palette}>
                    {pick.items.map((item) => (
                      <ColorDot key={item.id} color={item.color} size={24} />
                    ))}
                  </View>

                  {pick.items.map((item) => (
                    <View key={item.id} style={dynamicStyles.quickPickItemRow}>
                      <View
                        style={[dynamicStyles.itemDot, { backgroundColor: item.color }]}
                      />
                      <View style={dynamicStyles.itemInfo}>
                        <Text style={dynamicStyles.quickPickItemName}>
                          {item.name}
                        </Text>
                        <Text style={dynamicStyles.quickPickItemMeta}>
                          {CATEGORY_LABELS[item.category]} · {item.colorName}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <Pressable
                    style={dynamicStyles.quickPickSelectBtn}
                    onPress={() => handleQuickPickSelect(pick, idx + 1000)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={dynamicStyles.quickPickSelectText}>
                      Pick This One
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={dynamicStyles.quickPickDots}>
            {quickPicks.map((_, idx) => (
              <View
                key={idx}
                style={[
                  dynamicStyles.quickPickDot,
                  idx === activeQuickPick && dynamicStyles.quickPickDotActive,
                ]}
              />
            ))}
          </View>

          <Pressable
            style={dynamicStyles.quickPickDismiss}
            onPress={() => {
              setQuickPickMode(false);
              setQuickPicks([]);
            }}
          >
            <Text style={dynamicStyles.quickPickDismissText}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Action Buttons */}
      <View style={dynamicStyles.buttonRow}>
        <Pressable style={dynamicStyles.generateBtn} onPress={handleGenerate}>
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={dynamicStyles.generateBtnText}>Generate</Text>
        </Pressable>
        <Pressable style={dynamicStyles.surpriseBtn} onPress={handleSurpriseMe}>
          <Ionicons name="shuffle" size={20} color={theme.colors.primary} />
          <Text style={dynamicStyles.surpriseBtnText}>Surprise Me</Text>
        </Pressable>
      </View>

      {generated && suggestions.length === 0 && (
        <View style={dynamicStyles.noResults}>
          <Text style={dynamicStyles.noResultsText}>
            No matching outfits found. Try a different season or add more items!
          </Text>
        </View>
      )}

      {suggestions.map((suggestion, idx) => {
        const repeatCheck = detectRepeatOutfit(suggestion.items, outfits);
        return (
        <View key={idx} style={dynamicStyles.suggestionCard}>
          <View style={dynamicStyles.suggestionHeader}>
            <Text style={dynamicStyles.suggestionTitle} numberOfLines={1}>
              {getSuggestedName(suggestion, idx)}
            </Text>
            <View style={dynamicStyles.nameActions}>
              <Pressable hitSlop={8} onPress={() => handleRegenerateName(suggestion, idx)}>
                <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => handleResetName(idx)}>
                <Ionicons name="text-outline" size={14} color={theme.colors.textLight} />
              </Pressable>
            </View>
          </View>
          <Text style={dynamicStyles.scoreText}>
            Score: {Math.round(suggestion.score)}
          </Text>

          {/* Repeat outfit warning (#95) */}
          {(repeatCheck.isRepeat || repeatCheck.nearRepeat) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F59E0B18", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
              <Text style={{ fontSize: 12, color: "#B45309", flex: 1 }}>
                {repeatCheck.isRepeat
                  ? `Exact repeat of "${repeatCheck.repeatOutfitName}" worn ${repeatCheck.daysSinceWorn}d ago`
                  : `${repeatCheck.overlapPct}% similar to "${repeatCheck.repeatOutfitName}" worn ${repeatCheck.daysSinceWorn}d ago`}
              </Text>
            </View>
          )}

          <View style={dynamicStyles.moodBoardWrap}>
            <MoodBoard items={suggestion.items} size={260} />
          </View>

          <View style={dynamicStyles.palette}>
            {suggestion.items.map((item) => (
              <ColorDot key={item.id} color={item.color} size={28} />
            ))}
          </View>

          {suggestion.items.map((item) => (
            <View key={item.id} style={dynamicStyles.itemRow}>
              <View
                style={[dynamicStyles.itemDot, { backgroundColor: item.color }]}
              />
              <View style={dynamicStyles.itemInfo}>
                <Text style={dynamicStyles.itemName}>{item.name}</Text>
                <Text style={dynamicStyles.itemMeta}>
                  {CATEGORY_LABELS[item.category]} · {item.colorName}
                </Text>
              </View>
            </View>
          ))}

          {suggestion.reasons.length > 0 && (
            <View style={dynamicStyles.reasons}>
              {suggestion.reasons.map((r, ri) => (
                <View key={ri} style={dynamicStyles.reasonRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={theme.colors.success}
                  />
                  <Text style={dynamicStyles.reasonText}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable
              style={[dynamicStyles.saveOutfitBtn, { flex: 1 }]}
              onPress={() => handleSave(suggestion, idx)}
            >
              <Ionicons name="bookmark-outline" size={16} color={theme.colors.primary} />
              <Text style={dynamicStyles.saveOutfitText}>Save Outfit</Text>
            </Pressable>
            <Pressable
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.error + "12",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => openFlagModal(suggestion)}
            >
              <Ionicons name="flag-outline" size={16} color={theme.colors.error} />
            </Pressable>
          </View>
        </View>
        );
      })}

      {/* Save Modal — pick occasions + seasons before saving */}
      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => setSaveModalVisible(false)}>
          <Pressable style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }} onPress={() => {}}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text, marginBottom: 16 }}>Save Outfit</Text>

            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 8 }}>Occasions</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {OCCASIONS.map((o) => (
                <Chip
                  key={o}
                  label={OCCASION_LABELS[o]}
                  selected={saveOccasions.includes(o)}
                  onPress={() => setSaveOccasions((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o])}
                />
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 8 }}>Seasons</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {(["spring", "summer", "fall", "winter"] as Season[]).map((s) => (
                <Chip
                  key={s}
                  label={SEASON_LABELS[s]}
                  selected={saveSeasons.includes(s)}
                  onPress={() => setSaveSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                />
              ))}
            </View>

            <Pressable
              style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              onPress={handleConfirmSave}
            >
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Flag Modal — explain why an outfit doesn't work */}
      <Modal visible={flagModalVisible} transparent animationType="fade" onRequestClose={() => setFlagModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => setFlagModalVisible(false)}>
          <Pressable style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }} onPress={() => {}}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text, marginBottom: 8 }}>Flag Outfit</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16 }}>
              Tell us why this outfit doesn't work and we won't suggest it again.
            </Text>

            {flagSuggestion && (
              <View style={{ marginBottom: 12 }}>
                {flagSuggestion.items.slice(0, 4).map((item) => (
                  <Text key={item.id} style={{ fontSize: 13, color: theme.colors.textLight, marginBottom: 2 }}>
                    {CATEGORY_LABELS[item.category]}: {item.name}
                  </Text>
                ))}
              </View>
            )}

            <TextInput
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: theme.colors.text,
                minHeight: 60,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
              placeholder="e.g., Running shoes don't go with fancy clothing"
              placeholderTextColor={theme.colors.textLight}
              value={flagReason}
              onChangeText={setFlagReason}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border }}
                onPress={() => setFlagModalVisible(false)}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, backgroundColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: flagReason.trim() ? 1 : 0.4 }}
                onPress={handleConfirmFlag}
                disabled={!flagReason.trim()}
              >
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>Flag</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

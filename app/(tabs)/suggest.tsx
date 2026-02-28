import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { suggestOutfits, generateOutfitName, type SuggestionResult } from "@/services/outfitEngine";
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
import { Theme } from "@/constants/theme";
import type { Season } from "@/models/types";
import { SEASON_LABELS, CATEGORY_LABELS } from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default function SuggestScreen() {
  const { items } = useClothingItems();
  const { addOrUpdate: saveOutfit } = useOutfits();

  const [season, setSeason] = useState<Season | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [generated, setGenerated] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherTips, setWeatherTips] = useState<string[]>([]);

  // Fetch weather on mount
  useEffect(() => {
    let mounted = true;
    setLoadingWeather(true);
    getCurrentWeather()
      .then((w) => {
        if (!mounted) return;
        setWeather(w);
        if (w) {
          setWeatherTips(getWeatherTips(w));
          if (!season) setSeason(weatherToSeason(w));
        }
      })
      .finally(() => mounted && setLoadingWeather(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleGenerate = useCallback(() => {
    if (items.length < 2) {
      Alert.alert(
        "Not enough items",
        "Add at least 2 clothing items to your wardrobe to get outfit suggestions."
      );
      return;
    }
    const results = suggestOutfits(items, { season, maxResults: 6 });
    setSuggestions(results);
    setGenerated(true);
  }, [items, season]);

  const handleSurpriseMe = useCallback(() => {
    if (items.length < 2) {
      Alert.alert("Not enough items", "Add at least 2 items first.");
      return;
    }
    const results = suggestOutfits(items, { season, maxResults: 10 });
    if (results.length === 0) {
      Alert.alert("No luck!", "Couldn't assemble an outfit. Try adding more items.");
      return;
    }
    const pick = results[Math.floor(Math.random() * results.length)];
    setSuggestions([pick]);
    setGenerated(true);
  }, [items, season]);

  // Track custom names per suggestion index
  const [customNames, setCustomNames] = useState<Record<number, string>>({});

  const getSuggestedName = (suggestion: SuggestionResult, idx: number): string => {
    if (customNames[idx] !== undefined) return customNames[idx];
    return generateOutfitName(suggestion.items);
  };

  const handleResetName = (idx: number) => {
    setCustomNames((prev) => {
      const next = { ...prev };
      next[idx] = `Outfit #${Date.now().toString(36).slice(-4).toUpperCase()}`;
      return next;
    });
  };

  const handleRegenerateName = (suggestion: SuggestionResult, idx: number) => {
    setCustomNames((prev) => {
      const next = { ...prev };
      next[idx] = generateOutfitName(suggestion.items);
      return next;
    });
  };

  const handleSave = async (suggestion: SuggestionResult, idx: number) => {
    const name = getSuggestedName(suggestion, idx);

    await saveOutfit({
      id: generateId(),
      name,
      itemIds: suggestion.items.map((i) => i.id),
      occasions: [],
      seasons: season ? [season] : [],
      rating: Math.min(5, Math.max(1, Math.round(suggestion.score / 20))),
      createdAt: Date.now(),
      suggested: true,
      wornDates: [],
    });

    Alert.alert("Saved!", `"${name}" has been added to your outfits.`);
  };

  if (items.length < 2) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="sparkles-outline"
          title="Add more items"
          subtitle="You need at least 2 clothing items in your wardrobe before we can suggest outfits."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Get Outfit Ideas</Text>
      <Text style={styles.subtitle}>
        Our engine analyses colour harmony, fabric compatibility, and seasonal
        fit to suggest your best looks.
      </Text>

      {/* Weather Card */}
      {loadingWeather ? (
        <View style={styles.weatherCard}>
          <ActivityIndicator size="small" color={Theme.colors.primary} />
          <Text style={styles.weatherLoadingText}>Checking weather...</Text>
        </View>
      ) : weather ? (
        <View style={styles.weatherCard}>
          <View style={styles.weatherHeader}>
            <Ionicons
              name={weather.icon as any}
              size={28}
              color={Theme.colors.primary}
            />
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherTemp}>
                {weather.temp}°C{" "}
                <Text style={styles.weatherDesc}>{weather.description}</Text>
              </Text>
              {weather.city ? (
                <Text style={styles.weatherCity}>{weather.city}</Text>
              ) : null}
            </View>
            {weather.feelsLike !== weather.temp && (
              <Text style={styles.feelsLike}>
                Feels {weather.feelsLike}°
              </Text>
            )}
          </View>
          {weatherTips.length > 0 && (
            <View style={styles.weatherTips}>
              {weatherTips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={Theme.colors.primary}
                  />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Season (optional)</Text>
      <View style={styles.chipRow}>
        {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
          <Chip
            key={s}
            label={SEASON_LABELS[s]}
            selected={season === s}
            onPress={() => setSeason(season === s ? undefined : s)}
          />
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Pressable style={styles.generateBtn} onPress={handleGenerate}>
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.generateBtnText}>Generate</Text>
        </Pressable>
        <Pressable style={styles.surpriseBtn} onPress={handleSurpriseMe}>
          <Ionicons name="shuffle" size={20} color={Theme.colors.primary} />
          <Text style={styles.surpriseBtnText}>Surprise Me</Text>
        </Pressable>
      </View>

      {generated && suggestions.length === 0 && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>
            No matching outfits found. Try a different season or add more items!
          </Text>
        </View>
      )}

      {suggestions.map((suggestion, idx) => (
        <View key={idx} style={styles.suggestionCard}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.suggestionTitle} numberOfLines={1}>
              {getSuggestedName(suggestion, idx)}
            </Text>
            <View style={styles.nameActions}>
              <Pressable hitSlop={8} onPress={() => handleRegenerateName(suggestion, idx)}>
                <Ionicons name="refresh-outline" size={16} color={Theme.colors.primary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => handleResetName(idx)}>
                <Ionicons name="text-outline" size={14} color={Theme.colors.textLight} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.scoreText}>
            Score: {Math.round(suggestion.score)}
          </Text>

          <View style={styles.moodBoardWrap}>
            <MoodBoard items={suggestion.items} size={260} />
          </View>

          <View style={styles.palette}>
            {suggestion.items.map((item) => (
              <ColorDot key={item.id} color={item.color} size={28} />
            ))}
          </View>

          {suggestion.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View
                style={[styles.itemDot, { backgroundColor: item.color }]}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {CATEGORY_LABELS[item.category]} · {item.colorName}
                </Text>
              </View>
            </View>
          ))}

          {suggestion.reasons.length > 0 && (
            <View style={styles.reasons}>
              {suggestion.reasons.map((r, ri) => (
                <View key={ri} style={styles.reasonRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={Theme.colors.success}
                  />
                  <Text style={styles.reasonText}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={styles.saveOutfitBtn}
            onPress={() => handleSave(suggestion, idx)}
          >
            <Ionicons
              name="bookmark-outline"
              size={16}
              color={Theme.colors.primary}
            />
            <Text style={styles.saveOutfitText}>Save Outfit</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.md, paddingBottom: 60 },
  heading: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: Theme.spacing.md,
  },
  // Weather
  weatherCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.primary + "20",
  },
  weatherHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weatherInfo: { flex: 1 },
  weatherTemp: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  weatherDesc: {
    fontSize: Theme.fontSize.md,
    fontWeight: "400",
    color: Theme.colors.textSecondary,
  },
  weatherCity: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    marginTop: 2,
  },
  feelsLike: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  weatherLoadingText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginLeft: 8,
  },
  weatherTips: {
    marginTop: Theme.spacing.sm,
    gap: 4,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tipText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  buttonRow: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  generateBtn: {
    flex: 2,
    flexDirection: "row",
    height: 52,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
  },
  surpriseBtn: {
    flex: 1,
    flexDirection: "row",
    height: 52,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + "08",
  },
  surpriseBtnText: {
    color: Theme.colors.primary,
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
  },
  noResults: {
    padding: Theme.spacing.xl,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  suggestionCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
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
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  nameActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
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
    borderBottomColor: Theme.colors.border,
  },
  itemDot: { width: 10, height: 10, borderRadius: 5 },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  itemMeta: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
  reasons: { marginTop: 10, gap: 4 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reasonText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
  },
  saveOutfitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  saveOutfitText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
});

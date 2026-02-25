import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { suggestOutfits, type SuggestionResult } from "@/services/outfitEngine";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";
import type { Occasion } from "@/models/types";
import { OCCASION_LABELS, CATEGORY_LABELS } from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default function SuggestScreen() {
  const { items } = useClothingItems();
  const { addOrUpdate: saveOutfit } = useOutfits();

  const [occasion, setOccasion] = useState<Occasion | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = useCallback(() => {
    if (items.length < 2) {
      Alert.alert(
        "Not enough items",
        "Add at least 2 clothing items to your wardrobe to get outfit suggestions."
      );
      return;
    }

    const results = suggestOutfits(items, {
      occasion,
      maxResults: 6,
    });
    setSuggestions(results);
    setGenerated(true);
  }, [items, occasion]);

  const handleSave = async (suggestion: SuggestionResult, index: number) => {
    const name = `Outfit #${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const allOccasions = new Set<Occasion>();
    for (const item of suggestion.items) {
      item.occasions.forEach((o) => allOccasions.add(o));
    }

    await saveOutfit({
      id: generateId(),
      name,
      itemIds: suggestion.items.map((i) => i.id),
      occasions: [...allOccasions],
      rating: Math.min(5, Math.max(1, Math.round(suggestion.score / 20))),
      createdAt: Date.now(),
      suggested: true,
    });

    Alert.alert("Saved!", `${name} has been added to your outfits.`);
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
      {/* Filters */}
      <Text style={styles.heading}>Get Outfit Ideas</Text>
      <Text style={styles.subtitle}>
        Our engine analyzes color harmony, fabric compatibility, and
        occasion fit to suggest your best looks.
      </Text>

      <Text style={styles.sectionTitle}>Occasion (optional)</Text>
      <View style={styles.chipRow}>
        {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
          <Chip
            key={o}
            label={OCCASION_LABELS[o]}
            selected={occasion === o}
            onPress={() => setOccasion(occasion === o ? undefined : o)}
          />
        ))}
      </View>

      <Pressable style={styles.generateBtn} onPress={handleGenerate}>
        <Ionicons name="sparkles" size={20} color="#FFFFFF" />
        <Text style={styles.generateBtnText}>Generate Suggestions</Text>
      </Pressable>

      {/* Results */}
      {generated && suggestions.length === 0 && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>
            No matching outfits found. Try different filters or add more items!
          </Text>
        </View>
      )}

      {suggestions.map((suggestion, idx) => (
        <View key={idx} style={styles.suggestionCard}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.suggestionTitle}>Look #{idx + 1}</Text>
            <Text style={styles.scoreText}>
              Score: {Math.round(suggestion.score)}
            </Text>
          </View>

          {/* Color palette */}
          <View style={styles.palette}>
            {suggestion.items.map((item) => (
              <ColorDot key={item.id} color={item.color} size={28} />
            ))}
          </View>

          {/* Items */}
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

          {/* Reasons */}
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

          {/* Save Button */}
          <Pressable
            style={styles.saveOutfitBtn}
            onPress={() => handleSave(suggestion, idx)}
          >
            <Ionicons name="bookmark-outline" size={16} color={Theme.colors.primary} />
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
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  generateBtn: {
    flexDirection: "row",
    height: 52,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.lg,
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
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  scoreText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
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

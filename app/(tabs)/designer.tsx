import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  Alert,
  SectionList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { validateOutfit, generateOutfitName } from "@/services/outfitEngine";
import { Chip } from "@/components/Chip";
import { MoodBoard } from "@/components/MoodBoard";
import { ColorDot } from "@/components/ColorDot";
import { Theme } from "@/constants/theme";
import type { ClothingItem, ClothingCategory, Occasion, Season } from "@/models/types";
import { CATEGORY_LABELS, OCCASION_LABELS, SEASON_LABELS } from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const CATEGORY_ORDER: ClothingCategory[] = [
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

export default function DesignerScreen() {
  const { items } = useClothingItems();
  const { addOrUpdate: saveOutfit } = useOutfits();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outfitName, setOutfitName] = useState("");
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  const warnings = useMemo(
    () => validateOutfit(selectedItems),
    [selectedItems]
  );

  const sections = useMemo(() => {
    const grouped = new Map<ClothingCategory, ClothingItem[]>();
    for (const item of items) {
      const list = grouped.get(item.category) ?? [];
      list.push(item);
      grouped.set(item.category, list);
    }

    return CATEGORY_ORDER
      .filter((cat) => (grouped.get(cat) ?? []).length > 0)
      .map((cat) => ({
        title: CATEGORY_LABELS[cat],
        data: grouped.get(cat) ?? [],
      }));
  }, [items]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleOccasion = (o: Occasion) =>
    setOccasions((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );

  const toggleSeason = (s: Season) =>
    setSeasons((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      Alert.alert("No items", "Select at least one item for your outfit.");
      return;
    }

    const name = outfitName.trim() || generateOutfitName(selectedItems);

    await saveOutfit({
      id: generateId(),
      name,
      itemIds: selectedItems.map((i) => i.id),
      occasions,
      seasons,
      rating: 3,
      createdAt: Date.now(),
      suggested: false,
      wornDates: [],
    });

    Alert.alert("Saved!", `${name} has been added to your outfits.`);
    setSelectedIds(new Set());
    setOutfitName("");
    setOccasions([]);
    setSeasons([]);
  };

  const handleClear = () => {
    setSelectedIds(new Set());
    setOutfitName("");
    setOccasions([]);
    setSeasons([]);
  };

  return (
    <View style={styles.container}>
      {/* Mood Board Preview - sticky at top */}
      <View style={styles.previewSection}>
        <MoodBoard items={selectedItems} size={220} />
        {selectedItems.length > 0 && (
          <View style={styles.previewMeta}>
            <View style={styles.palette}>
              {selectedItems.map((item) => (
                <ColorDot key={item.id} color={item.color} size={20} />
              ))}
            </View>
            <Text style={styles.itemCount}>
              {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <View style={styles.warningsWrap}>
            {warnings.map((w, i) => (
              <View key={i} style={styles.warningRow}>
                <Ionicons name="warning-outline" size={14} color={Theme.colors.warning} />
                <Text style={styles.warningText}>{w}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Item Picker */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <Pressable
              style={[styles.itemRow, isSelected && styles.itemRowSelected]}
              onPress={() => toggleItem(item.id)}
            >
              {item.imageUris?.length > 0 ? (
                <Image source={{ uri: item.imageUris[0] }} style={styles.itemThumb} />
              ) : (
                <View style={[styles.itemThumbPlaceholder, { backgroundColor: item.color + "30" }]}>
                  <Ionicons name="shirt-outline" size={18} color={item.color} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.itemMeta}>
                  <ColorDot color={item.color} size={12} />
                  <Text style={styles.itemMetaText}>{item.colorName}</Text>
                </View>
              </View>
              <View style={[styles.checkBox, isSelected && styles.checkBoxSelected]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.nameInputWrap}>
              <View style={styles.nameInputRow}>
                <TextInput
                  style={[styles.nameInput, { flex: 1 }]}
                  placeholder={selectedItems.length > 0 ? generateOutfitName(selectedItems) : "Outfit name (optional)"}
                  placeholderTextColor={Theme.colors.textLight}
                  value={outfitName}
                  onChangeText={setOutfitName}
                />
                {selectedItems.length > 0 && (
                  <Pressable
                    style={styles.nameGenBtn}
                    onPress={() => setOutfitName(generateOutfitName(selectedItems))}
                    hitSlop={8}
                  >
                    <Ionicons name="sparkles-outline" size={18} color={Theme.colors.primary} />
                  </Pressable>
                )}
                {outfitName.trim().length > 0 && (
                  <Pressable
                    style={styles.nameGenBtn}
                    onPress={() => setOutfitName("")}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={Theme.colors.textLight} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Occasion tags for the outfit */}
            <Text style={styles.tagSectionTitle}>Occasion</Text>
            <View style={styles.chipRow}>
              {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                <Chip
                  key={o}
                  label={OCCASION_LABELS[o]}
                  selected={occasions.includes(o)}
                  onPress={() => toggleOccasion(o)}
                />
              ))}
            </View>

            {/* Season tags for the outfit */}
            <Text style={styles.tagSectionTitle}>Season</Text>
            <View style={styles.chipRow}>
              {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
                <Chip
                  key={s}
                  label={SEASON_LABELS[s]}
                  selected={seasons.includes(s)}
                  onPress={() => toggleSeason(s)}
                />
              ))}
            </View>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, selectedItems.length === 0 && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={selectedItems.length === 0}
        >
          <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>Save Outfit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  previewSection: {
    alignItems: "center",
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  palette: {
    flexDirection: "row",
    gap: 4,
  },
  itemCount: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  warningsWrap: {
    marginTop: 8,
    paddingHorizontal: Theme.spacing.md,
    gap: 4,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warningText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.warning,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.md,
  },
  nameInputWrap: {
    paddingVertical: Theme.spacing.md,
  },
  nameInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameGenBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primary + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  nameInput: {
    height: 44,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  tagSectionTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: 4,
    marginTop: Theme.spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  sectionHeader: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "700",
    color: Theme.colors.textSecondary,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemRowSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + "08",
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.sm,
    resizeMode: "cover",
  },
  itemThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: 2,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemMetaText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkBoxSelected: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 34,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  clearBtn: {
    height: 48,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  clearBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    gap: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
  },
});

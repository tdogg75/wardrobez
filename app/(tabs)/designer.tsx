import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useOutfits } from "@/hooks/useOutfits";
import { validateOutfit, generateOutfitName } from "@/services/outfitEngine";
import { Chip } from "@/components/Chip";
import { MoodBoard } from "@/components/MoodBoard";
import { ColorDot } from "@/components/ColorDot";
import { useTheme } from "@/hooks/useTheme";
import { getOutfitTemplates, saveOutfitTemplate, deleteOutfitTemplate } from "@/services/storage";
import type { ClothingItem, ClothingCategory, Occasion, Season, OutfitTemplate } from "@/models/types";
import { CATEGORY_LABELS, OCCASION_LABELS, SEASON_LABELS } from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const CATEGORY_ORDER: ClothingCategory[] = [
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

export default function DesignerScreen() {
  const { theme } = useTheme();
  const { items } = useClothingItems();
  const { addOrUpdate: saveOutfit } = useOutfits();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outfitName, setOutfitName] = useState("");
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);

  // Template state
  const [templates, setTemplates] = useState<OutfitTemplate[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = useCallback(async () => {
    const loaded = await getOutfitTemplates();
    setTemplates(loaded);
  }, []);

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
      nameLocked: true,
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

  const handleSaveAsTemplate = () => {
    if (selectedItems.length === 0) {
      Alert.alert("No items", "Select at least one item to create a template.");
      return;
    }

    Alert.prompt(
      "Template Name",
      "Enter a name for this outfit template",
      async (templateName) => {
        if (!templateName || !templateName.trim()) return;

        // Build category slots from the selected items
        const categorySlots = selectedItems.map((item) => ({
          category: item.category,
          subCategory: item.subCategory,
        }));

        const template: OutfitTemplate = {
          id: generateId(),
          name: templateName.trim(),
          categorySlots,
          occasions,
          seasons,
          createdAt: Date.now(),
        };

        await saveOutfitTemplate(template);
        await loadTemplates();
        Alert.alert("Template Saved!", `"${template.name}" has been saved as a template.`);
      },
      "plain-text",
      outfitName.trim() || generateOutfitName(selectedItems)
    );
  };

  const handleLoadTemplate = (template: OutfitTemplate) => {
    setTemplateModalVisible(false);

    // Auto-select items matching the template's category slots
    const newSelectedIds = new Set<string>();

    for (const slot of template.categorySlots) {
      // Find an item matching this category (and subCategory if specified)
      const match = items.find((item) => {
        if (newSelectedIds.has(item.id)) return false; // Don't pick the same item twice
        if (item.category !== slot.category) return false;
        if (slot.subCategory && item.subCategory !== slot.subCategory) return false;
        return true;
      });

      if (match) {
        newSelectedIds.add(match.id);
      }
    }

    setSelectedIds(newSelectedIds);
    setOccasions(template.occasions);
    setSeasons(template.seasons);
  };

  const handleDeleteTemplate = (template: OutfitTemplate) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteOutfitTemplate(template.id);
            await loadTemplates();
          },
        },
      ]
    );
  };

  const styles = useMemo(() => createStyles(theme), [theme]);

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
                <Ionicons name="warning-outline" size={14} color={theme.colors.warning} />
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
                  placeholderTextColor={theme.colors.textLight}
                  value={outfitName}
                  onChangeText={setOutfitName}
                />
                {selectedItems.length > 0 && (
                  <Pressable
                    style={styles.nameGenBtn}
                    onPress={() => setOutfitName(generateOutfitName(selectedItems))}
                    hitSlop={8}
                  >
                    <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                  </Pressable>
                )}
                {outfitName.trim().length > 0 && (
                  <Pressable
                    style={styles.nameGenBtn}
                    onPress={() => setOutfitName("")}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={theme.colors.textLight} />
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

            {/* Template buttons */}
            <View style={styles.templateRow}>
              <Pressable style={styles.templateBtn} onPress={handleSaveAsTemplate}>
                <Ionicons name="albums-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.templateBtnText}>Save as Template</Text>
              </Pressable>
              <Pressable
                style={styles.templateBtn}
                onPress={() => {
                  loadTemplates();
                  setTemplateModalVisible(true);
                }}
              >
                <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.templateBtnText}>Load Template</Text>
              </Pressable>
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

      {/* Load Template Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Load Template</Text>
            <Pressable onPress={() => setTemplateModalVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={48} color={theme.colors.textLight} />
              <Text style={styles.emptyStateText}>No templates yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Select items and tap "Save as Template" to create one.
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(t) => t.id}
              contentContainerStyle={{ padding: theme.spacing.md }}
              renderItem={({ item: template }) => (
                <Pressable
                  style={styles.templateCard}
                  onPress={() => handleLoadTemplate(template)}
                >
                  <View style={styles.templateCardContent}>
                    <Text style={styles.templateCardName}>{template.name}</Text>
                    <Text style={styles.templateCardSlots}>
                      {template.categorySlots
                        .map((s) => CATEGORY_LABELS[s.category])
                        .join(" + ")}
                    </Text>
                    {(template.occasions.length > 0 || template.seasons.length > 0) && (
                      <Text style={styles.templateCardMeta}>
                        {[
                          ...template.occasions.map((o) => OCCASION_LABELS[o]),
                          ...template.seasons.map((s) => SEASON_LABELS[s]),
                        ].join(", ")}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleDeleteTemplate(template)}
                    hitSlop={8}
                    style={styles.templateDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </Pressable>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    previewSection: {
      alignItems: "center",
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: "600",
    },
    warningsWrap: {
      marginTop: 8,
      paddingHorizontal: theme.spacing.md,
      gap: 4,
    },
    warningRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    warningText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.warning,
    },
    listContent: {
      paddingHorizontal: theme.spacing.md,
    },
    nameInputWrap: {
      paddingVertical: theme.spacing.md,
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
      backgroundColor: theme.colors.primary + "12",
      justifyContent: "center",
      alignItems: "center",
    },
    nameInput: {
      height: 44,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagSectionTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
      marginTop: theme.spacing.sm,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
    sectionHeader: {
      fontSize: theme.fontSize.sm,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      marginBottom: 6,
      borderWidth: 2,
      borderColor: "transparent",
    },
    itemRowSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + "08",
    },
    itemThumb: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.sm,
      resizeMode: "cover",
    },
    itemThumbPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.sm,
      justifyContent: "center",
      alignItems: "center",
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    itemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    itemMetaText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    checkBox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    checkBoxSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: 34,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    clearBtn: {
      height: 48,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    clearBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    saveBtn: {
      flex: 1,
      height: 48,
      flexDirection: "row",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      color: "#FFFFFF",
      fontSize: theme.fontSize.md,
      fontWeight: "700",
    },
    // Template buttons
    templateRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    templateBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 40,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary + "40",
      backgroundColor: theme.colors.primary + "0A",
    },
    templateBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    // Template modal
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: theme.spacing.xl,
    },
    emptyStateText: {
      fontSize: theme.fontSize.lg,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    emptyStateSubtext: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textLight,
      textAlign: "center",
    },
    templateCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    templateCardContent: {
      flex: 1,
      gap: 2,
    },
    templateCardName: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: theme.colors.text,
    },
    templateCardSlots: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    templateCardMeta: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textLight,
      marginTop: 2,
    },
    templateDeleteBtn: {
      padding: 8,
    },
  });
}

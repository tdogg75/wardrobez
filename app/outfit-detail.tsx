import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ColorDot } from "@/components/ColorDot";
import { MoodBoard } from "@/components/MoodBoard";
import { Chip } from "@/components/Chip";
import { Theme } from "@/constants/theme";
import { CATEGORY_LABELS, OCCASION_LABELS, SEASON_LABELS } from "@/models/types";
import type { ClothingItem, Occasion, Season } from "@/models/types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function OutfitDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { outfits, remove, logWorn, markNotified, updateRating, addOrUpdate, removeWornDate } =
    useOutfits();
  const { items: allItems, getById } = useClothingItems();

  const outfit = outfits.find((o) => o.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [editItemIds, setEditItemIds] = useState<string[]>([]);
  const [editOccasions, setEditOccasions] = useState<Occasion[]>([]);
  const [editSeasons, setEditSeasons] = useState<Season[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [showWornLog, setShowWornLog] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameText, setRenameText] = useState("");

  // Show removed-item notification on first open
  useEffect(() => {
    if (outfit?.hasRemovedItems && !outfit.removedItemNotified) {
      Alert.alert(
        "Items Removed",
        "Some items in this outfit have been archived. This outfit may be incomplete.",
        [{ text: "OK", onPress: () => markNotified(outfit.id) }]
      );
    }
  }, [outfit?.id, outfit?.hasRemovedItems, outfit?.removedItemNotified]);

  if (!outfit) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Outfit not found.</Text>
      </View>
    );
  }

  const outfitItems = outfit.itemIds
    .map((itemId) => getById(itemId))
    .filter(Boolean) as ClothingItem[];

  const totalCost = outfitItems.reduce((sum, i) => sum + (i.cost ?? 0), 0);

  const handleDelete = () => {
    Alert.alert("Delete Outfit", "Remove this outfit from your collection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await remove(outfit.id);
          router.back();
        },
      },
    ]);
  };

  const handleLogWorn = () => {
    Alert.alert("Log Worn", `Mark "${outfit.name}" as worn today?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Log It", onPress: () => logWorn(outfit.id) },
    ]);
  };

  const handleRemoveWornDate = (index: number, date: string) => {
    Alert.alert(
      "Remove Log",
      `Remove the wear log for ${new Date(date).toLocaleDateString()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeWornDate(outfit.id, index),
        },
      ]
    );
  };

  // --- Rename ---
  const handleStartRename = () => {
    setRenameText(outfit.name);
    setShowRenameModal(true);
  };

  const handleSaveRename = async () => {
    const newName = renameText.trim();
    if (newName && newName !== outfit.name) {
      await addOrUpdate({ ...outfit, name: newName });
    }
    setShowRenameModal(false);
  };

  // --- Edit Mode ---
  const startEditing = () => {
    setIsEditing(true);
    setEditName(outfit.name);
    setEditItemIds([...outfit.itemIds]);
    setEditOccasions([...outfit.occasions]);
    setEditSeasons([...(outfit.seasons ?? [])]);
    setEditNotes(outfit.notes ?? "");
  };

  const saveEdits = async () => {
    if (editItemIds.length === 0) {
      Alert.alert("No items", "An outfit must have at least one item.");
      return;
    }
    await addOrUpdate({
      ...outfit,
      name: editName.trim() || outfit.name,
      itemIds: editItemIds,
      occasions: editOccasions,
      seasons: editSeasons,
      notes: editNotes.trim() || undefined,
    });
    setIsEditing(false);
  };

  const toggleEditItem = (itemId: string) => {
    setEditItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleOccasion = (occ: Occasion) => {
    setEditOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    );
  };

  const toggleSeason = (s: Season) => {
    setEditSeasons((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  // Edit item list for the picker
  const editOutfitItems = editItemIds
    .map((iid) => getById(iid))
    .filter(Boolean) as ClothingItem[];

  // --- Render ---
  if (isEditing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.editHeader}>
          <Text style={styles.editTitle}>Edit Outfit</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={styles.editCancelBtn}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.editSaveBtn} onPress={saveEdits}>
              <Text style={styles.editSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Name</Text>
        <TextInput
          style={styles.textInput}
          value={editName}
          onChangeText={setEditName}
          placeholder="Outfit name"
          placeholderTextColor={Theme.colors.textLight}
        />

        <Text style={styles.sectionTitle}>Items</Text>
        {editOutfitItems.map((item) => (
          <View key={item.id} style={styles.editItemRow}>
            {item.imageUris?.length > 0 ? (
              <Image source={{ uri: item.imageUris[0] }} style={styles.itemThumb} />
            ) : (
              <View style={[styles.itemColor, { backgroundColor: item.color }]} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{CATEGORY_LABELS[item.category]}</Text>
            </View>
            <Pressable
              onPress={() => toggleEditItem(item.id)}
              hitSlop={10}
              style={styles.removeItemBtn}
            >
              <Ionicons name="close-circle" size={22} color={Theme.colors.error} />
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.addItemBtn}
          onPress={() => setShowItemPicker(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={Theme.colors.primary} />
          <Text style={styles.addItemText}>Add Item</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Occasions</Text>
        <View style={styles.chipRow}>
          {(Object.keys(OCCASION_LABELS) as Occasion[]).map((occ) => (
            <Chip
              key={occ}
              label={OCCASION_LABELS[occ]}
              selected={editOccasions.includes(occ)}
              onPress={() => toggleOccasion(occ)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Seasons</Text>
        <View style={styles.chipRow}>
          {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
            <Chip
              key={s}
              label={SEASON_LABELS[s]}
              selected={editSeasons.includes(s)}
              onPress={() => toggleSeason(s)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.textInput, { minHeight: 60 }]}
          value={editNotes}
          onChangeText={setEditNotes}
          placeholder="Optional notes..."
          placeholderTextColor={Theme.colors.textLight}
          multiline
        />

        {/* Item Picker Modal */}
        <Modal visible={showItemPicker} animationType="slide">
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Items</Text>
              <Pressable onPress={() => setShowItemPicker(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={allItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = editItemIds.includes(item.id);
                return (
                  <Pressable
                    style={[
                      styles.pickerItem,
                      selected && styles.pickerItemSelected,
                    ]}
                    onPress={() => toggleEditItem(item.id)}
                  >
                    {item.imageUris?.length > 0 ? (
                      <Image
                        source={{ uri: item.imageUris[0] }}
                        style={styles.pickerThumb}
                      />
                    ) : (
                      <View
                        style={[
                          styles.pickerColorDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.name}</Text>
                      <Text style={styles.pickerItemMeta}>
                        {CATEGORY_LABELS[item.category]}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={
                        selected
                          ? Theme.colors.primary
                          : Theme.colors.textLight
                      }
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // --- Normal View ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{outfit.name}</Text>
        {outfit.suggested && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color={Theme.colors.primary} />
            <Text style={styles.aiBadgeText}>AI Suggested</Text>
          </View>
        )}
      </View>

      {/* Rating */}
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => updateRating(outfit.id, star)}
            hitSlop={6}
          >
            <Ionicons
              name={star <= outfit.rating ? "star" : "star-outline"}
              size={22}
              color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
            />
          </Pressable>
        ))}
      </View>

      {/* Stats chips */}
      <View style={styles.statsRow}>
        {totalCost > 0 && (
          <View style={styles.statChip}>
            <Ionicons name="pricetag-outline" size={14} color={Theme.colors.textSecondary} />
            <Text style={styles.statText}>{fmt(totalCost)}</Text>
          </View>
        )}
        <View style={styles.statChip}>
          <Ionicons name="shirt-outline" size={14} color={Theme.colors.textSecondary} />
          <Text style={styles.statText}>
            Worn {outfit.wornDates.length} time{outfit.wornDates.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {totalCost > 0 && outfit.wornDates.length > 0 && (
          <View style={styles.statChip}>
            <Text style={styles.statText}>
              {fmt(totalCost / outfit.wornDates.length)}/wear
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonRow}>
        <Pressable style={styles.logWornBtn} onPress={handleLogWorn}>
          <Ionicons name="checkmark-circle-outline" size={18} color={Theme.colors.success} />
          <Text style={styles.logWornText}>Log Worn</Text>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={startEditing}>
          <Ionicons name="create-outline" size={18} color={Theme.colors.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.renameBtn} onPress={handleStartRename}>
          <Ionicons name="text-outline" size={18} color={Theme.colors.primary} />
          <Text style={styles.renameBtnText}>Rename</Text>
        </Pressable>
      </View>

      {/* Mood Board */}
      {outfitItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Mood Board</Text>
          <View style={styles.moodBoardWrap}>
            <MoodBoard items={outfitItems} size={300} />
          </View>
        </>
      )}

      {/* Color Palette */}
      <Text style={styles.sectionTitle}>Colour Palette</Text>
      <View style={styles.palette}>
        {outfitItems.map((item) => (
          <View key={item.id} style={styles.paletteItem}>
            <ColorDot color={item.color} size={36} />
            <Text style={styles.paletteLabel}>{item.colorName}</Text>
          </View>
        ))}
      </View>

      {/* Items */}
      <Text style={styles.sectionTitle}>Items</Text>
      {outfitItems.map((item) => (
        <Pressable
          key={item.id}
          style={styles.itemCard}
          onPress={() =>
            router.push({ pathname: "/item-detail", params: { id: item.id } })
          }
        >
          {item.imageUris?.length > 0 ? (
            <Image source={{ uri: item.imageUris[0] }} style={styles.itemThumb} />
          ) : (
            <View style={[styles.itemColor, { backgroundColor: item.color }]} />
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              {CATEGORY_LABELS[item.category]}
              {item.brand ? ` · ${item.brand}` : ""}
              {item.cost ? ` · ${fmt(item.cost)}` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Theme.colors.textLight} />
        </Pressable>
      ))}

      {/* Occasions */}
      {outfit.occasions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Occasions</Text>
          <View style={styles.tagRow}>
            {outfit.occasions.map((o) => (
              <View key={o} style={styles.tag}>
                <Text style={styles.tagText}>{OCCASION_LABELS[o]}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Seasons */}
      {(outfit.seasons ?? []).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Seasons</Text>
          <View style={styles.tagRow}>
            {(outfit.seasons ?? []).map((s) => (
              <View key={s} style={[styles.tag, styles.seasonTag]}>
                <Text style={styles.tagText}>{SEASON_LABELS[s]}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Notes */}
      {outfit.notes && (
        <>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{outfit.notes}</Text>
        </>
      )}

      {/* Worn History */}
      <Pressable
        style={styles.wornLogToggle}
        onPress={() => setShowWornLog(!showWornLog)}
      >
        <Ionicons name="calendar-outline" size={18} color={Theme.colors.primary} />
        <Text style={styles.wornLogToggleText}>
          Wear History ({outfit.wornDates.length})
        </Text>
        <Ionicons
          name={showWornLog ? "chevron-up" : "chevron-down"}
          size={18}
          color={Theme.colors.textSecondary}
        />
      </Pressable>

      {showWornLog && (
        <View style={styles.wornLogList}>
          {outfit.wornDates.length === 0 ? (
            <Text style={styles.emptyText}>No wear history yet.</Text>
          ) : (
            [...outfit.wornDates]
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
              .map((date, idx) => {
                // Map back to original index for deletion
                const origIdx = outfit.wornDates.indexOf(date);
                return (
                  <View key={`${date}-${idx}`} style={styles.wornLogRow}>
                    <Ionicons name="checkmark" size={16} color={Theme.colors.success} />
                    <Text style={styles.wornLogDate}>
                      {new Date(date).toLocaleDateString("en-CA", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveWornDate(origIdx, date)}
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
                    </Pressable>
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* Delete */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
        <Text style={styles.deleteBtnText}>Delete Outfit</Text>
      </Pressable>

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.renameOverlay}>
          <View style={styles.renameDialog}>
            <Text style={styles.renameTitle}>Rename Outfit</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Enter new name"
              placeholderTextColor={Theme.colors.textLight}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleSaveRename}
            />
            <View style={styles.renameActions}>
              <Pressable
                style={styles.renameCancelBtn}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.renameSaveBtn} onPress={handleSaveRename}>
                <Text style={styles.renameSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.md, paddingBottom: Theme.spacing.xxl },
  notFound: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
    flex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.colors.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  aiBadgeText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  ratingRow: { flexDirection: "row", gap: 3, marginBottom: Theme.spacing.sm },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  statText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  actionButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  logWornBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.success + "12",
  },
  logWornText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.success,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  editBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  renameBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
  },
  renameBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  moodBoardWrap: {
    alignItems: "center",
    marginBottom: Theme.spacing.sm,
  },
  palette: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  paletteItem: { alignItems: "center", gap: 4 },
  paletteLabel: { fontSize: Theme.fontSize.xs, color: Theme.colors.textSecondary },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: 8,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.sm,
    resizeMode: "cover",
  },
  itemColor: { width: 14, height: 44, borderRadius: 7 },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  itemMeta: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: Theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  seasonTag: {
    backgroundColor: Theme.colors.primary + "12",
  },
  tagText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  notesText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    lineHeight: 22,
  },
  // Worn log
  wornLogToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  wornLogToggleText: {
    flex: 1,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  wornLogList: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  wornLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  wornLogDate: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
  },
  emptyText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textLight,
    fontStyle: "italic",
    padding: Theme.spacing.sm,
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.md,
  },
  deleteBtnText: {
    color: Theme.colors.error,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
  // Edit mode
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Theme.spacing.md,
  },
  editTitle: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
  },
  editCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  editCancelText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  editSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary,
  },
  editSaveText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: "#FFF",
  },
  textInput: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  editItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: 8,
  },
  removeItemBtn: {
    padding: 4,
  },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.primary + "40",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addItemText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  // Item picker modal
  pickerContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingTop: 54,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  pickerTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: Theme.colors.primary + "08",
  },
  pickerThumb: {
    width: 40,
    height: 40,
    borderRadius: Theme.borderRadius.sm,
  },
  pickerColorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  pickerItemName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  pickerItemMeta: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
  // Rename modal
  renameOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.xl,
  },
  renameDialog: {
    width: "100%",
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.lg,
  },
  renameTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  renameInput: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Theme.spacing.sm,
  },
  renameCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Theme.borderRadius.sm,
  },
  renameCancelText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  renameSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary,
  },
  renameSaveText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

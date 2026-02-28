import React, { useEffect, useMemo, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useTheme } from "@/hooks/useTheme";
import { ColorDot } from "@/components/ColorDot";
import { MoodBoard } from "@/components/MoodBoard";
import { Chip } from "@/components/Chip";
import { CATEGORY_LABELS, OCCASION_LABELS, SEASON_LABELS } from "@/models/types";
import { generateOutfitName } from "@/services/outfitEngine";
import type { ClothingItem, Occasion, Season, WornEntry } from "@/models/types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function OutfitDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { outfits, remove, logWorn, markNotified, updateRating, addOrUpdate, removeWornDate } =
    useOutfits();
  const { items: allItems, getById } = useClothingItems();
  const { theme } = useTheme();

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
  const [showLogWornModal, setShowLogWornModal] = useState(false);
  const [logSelfieUri, setLogSelfieUri] = useState<string | null>(null);
  const [logNote, setLogNote] = useState("");
  const [showAllWornDates, setShowAllWornDates] = useState(false);

  // Build dynamic styles based on the current theme
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
    setLogSelfieUri(null);
    setLogNote("");
    setShowLogWornModal(true);
  };

  const handleTakeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a selfie.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      setLogSelfieUri(result.assets[0].uri);
    }
  };

  const handlePickSelfieFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      setLogSelfieUri(result.assets[0].uri);
    }
  };

  const handleConfirmLogWorn = async () => {
    await logWorn(
      outfit.id,
      logSelfieUri ?? undefined,
      logNote.trim() || undefined
    );
    setShowLogWornModal(false);
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
      await addOrUpdate({ ...outfit, name: newName, nameLocked: true });
    }
    setShowRenameModal(false);
  };

  // --- Regenerate Name ---
  const handleRegenerateName = async () => {
    const items = outfit.itemIds
      .map((iid) => getById(iid))
      .filter(Boolean) as ClothingItem[];
    const newName = generateOutfitName(items);
    await addOrUpdate({ ...outfit, name: newName, nameLocked: true });
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
      nameLocked: true,
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
          placeholderTextColor={theme.colors.textLight}
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
              <Ionicons name="close-circle" size={22} color={theme.colors.error} />
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.addItemBtn}
          onPress={() => setShowItemPicker(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
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
          placeholderTextColor={theme.colors.textLight}
          multiline
        />

        {/* Item Picker Modal */}
        <Modal visible={showItemPicker} animationType="slide">
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Items</Text>
              <Pressable onPress={() => setShowItemPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
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
                          ? theme.colors.primary
                          : theme.colors.textLight
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
        <Pressable
          onPress={handleRegenerateName}
          hitSlop={8}
          style={styles.regenerateNameBtn}
          accessibilityLabel="Regenerate outfit name"
        >
          <Ionicons name="refresh-outline" size={18} color={theme.colors.primary} />
        </Pressable>
        {outfit.suggested && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color={theme.colors.primary} />
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
              color={star <= outfit.rating ? "#FFD700" : theme.colors.textLight}
            />
          </Pressable>
        ))}
      </View>

      {/* Stats chips */}
      <View style={styles.statsRow}>
        {totalCost > 0 && (
          <View style={styles.statChip}>
            <Ionicons name="pricetag-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.statText}>{fmt(totalCost)}</Text>
          </View>
        )}
        <View style={styles.statChip}>
          <Ionicons name="shirt-outline" size={14} color={theme.colors.textSecondary} />
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
          <Ionicons name="camera-outline" size={18} color={theme.colors.success} />
          <Text style={styles.logWornText}>Log Wear</Text>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={startEditing}>
          <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.renameBtn} onPress={handleStartRename}>
          <Ionicons name="text-outline" size={18} color={theme.colors.primary} />
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
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
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
        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.wornLogToggleText}>
          Wear History ({outfit.wornDates.length})
        </Text>
        <Ionicons
          name={showWornLog ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {showWornLog && (
        <View style={styles.wornLogList}>
          {outfit.wornDates.length === 0 ? (
            <Text style={styles.emptyText}>No wear history yet.</Text>
          ) : (
            <>
              {(() => {
                const sortedDates = [...outfit.wornDates]
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                const visibleDates = showAllWornDates
                  ? sortedDates
                  : sortedDates.slice(0, 10);
                return visibleDates.map((date, idx) => {
                  const origIdx = outfit.wornDates.indexOf(date);
                  const entry = (outfit.wornEntries ?? []).find(
                    (e) =>
                      new Date(e.date).toDateString() ===
                      new Date(date).toDateString()
                  );
                  return (
                    <View key={`${date}-${idx}`} style={styles.wornLogRow}>
                      <View style={styles.wornLogRowContent}>
                        <View style={styles.wornLogRowTop}>
                          <Ionicons name="checkmark" size={16} color={theme.colors.success} />
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
                            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                          </Pressable>
                        </View>
                        {entry && (entry.selfieUri || entry.note) && (
                          <View style={styles.wornEntryDetails}>
                            {entry.selfieUri && (
                              <Image
                                source={{ uri: entry.selfieUri }}
                                style={styles.wornSelfieThumbnail}
                              />
                            )}
                            {entry.note && (
                              <Text style={styles.wornEntryNote}>{entry.note}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                });
              })()}
              {outfit.wornDates.length > 10 && !showAllWornDates && (
                <Pressable
                  style={styles.viewAllBtn}
                  onPress={() => setShowAllWornDates(true)}
                >
                  <Text style={styles.viewAllBtnText}>
                    View all {outfit.wornDates.length} dates
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}

      {/* Delete */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
        <Text style={styles.deleteBtnText}>Delete Outfit</Text>
      </Pressable>

      {/* Log Worn Modal */}
      <Modal
        visible={showLogWornModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogWornModal(false)}
      >
        <View style={styles.renameOverlay}>
          <View style={styles.renameDialog}>
            <Text style={styles.renameTitle}>Log Wear</Text>
            <Text style={styles.logWornSubtitle}>
              Capture today's outfit with a photo!
            </Text>

            {logSelfieUri ? (
              <View style={styles.selfiePreviewWrap}>
                <Image source={{ uri: logSelfieUri }} style={styles.selfiePreview} />
                <Pressable
                  style={styles.selfieRemoveBtn}
                  onPress={() => setLogSelfieUri(null)}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.error} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.selfieButtonRow}>
                <Pressable style={styles.takeSelfieBtn} onPress={handleTakeSelfie}>
                  <Ionicons name="camera" size={24} color={theme.colors.primary} />
                  <Text style={styles.takeSelfieBtnText}>Take Selfie</Text>
                </Pressable>
                <Pressable style={styles.pickPhotoBtn} onPress={handlePickSelfieFromLibrary}>
                  <Ionicons name="images-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.takeSelfieBtnText}>Gallery</Text>
                </Pressable>
              </View>
            )}

            <TextInput
              style={[styles.renameInput, { marginTop: theme.spacing.md }]}
              value={logNote}
              onChangeText={setLogNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.colors.textLight}
              multiline
            />

            <View style={styles.renameActions}>
              <Pressable
                style={styles.renameCancelBtn}
                onPress={() => setShowLogWornModal(false)}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.renameSaveBtn} onPress={handleConfirmLogWorn}>
                <Text style={styles.renameSaveText}>Log It</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
              placeholderTextColor={theme.colors.textLight}
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

function makeStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
    notFound: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
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
      fontSize: theme.fontSize.xxl,
      fontWeight: "800",
      color: theme.colors.text,
      flex: 1,
    },
    regenerateNameBtn: {
      padding: 4,
      borderRadius: theme.borderRadius.full,
    },
    aiBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.primary + "15",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
    },
    aiBadgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    ratingRow: { flexDirection: "row", gap: 3, marginBottom: theme.spacing.sm },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: theme.spacing.md,
    },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.full,
    },
    statText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },
    actionButtonRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: theme.spacing.md,
    },
    logWornBtn: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.success + "12",
    },
    logWornText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.success,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary + "12",
    },
    editBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    renameBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary + "12",
    },
    renameBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    moodBoardWrap: {
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    palette: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
    paletteItem: { alignItems: "center", gap: 4 },
    paletteLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      marginBottom: 8,
    },
    itemThumb: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.sm,
      resizeMode: "cover",
    },
    itemColor: { width: 14, height: 44, borderRadius: 7 },
    itemInfo: { flex: 1 },
    itemName: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.text,
    },
    itemMeta: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: {
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
    },
    seasonTag: {
      backgroundColor: theme.colors.primary + "12",
    },
    tagText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },
    notesText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    // Worn log
    wornLogToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    wornLogToggleText: {
      flex: 1,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    wornLogList: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    wornLogRow: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    wornLogRowContent: {
      gap: 6,
    },
    wornLogRowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    wornLogDate: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
    },
    wornEntryDetails: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
      paddingLeft: 24,
    },
    wornSelfieThumbnail: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.sm,
      resizeMode: "cover",
    },
    wornEntryNote: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontStyle: "italic",
    },
    viewAllBtn: {
      alignItems: "center",
      paddingVertical: 10,
      marginTop: 4,
    },
    viewAllBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textLight,
      fontStyle: "italic",
      padding: theme.spacing.sm,
    },
    deleteBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
    },
    deleteBtnText: {
      color: theme.colors.error,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
    },
    // Edit mode
    editHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.md,
    },
    editTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: "800",
      color: theme.colors.text,
    },
    editCancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editCancelText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    editSaveBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary,
    },
    editSaveText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: "#FFF",
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    editItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
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
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary + "40",
      borderStyle: "dashed",
      marginTop: 4,
    },
    addItemText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    // Item picker modal
    pickerContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: 54,
    },
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    pickerTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: "700",
      color: theme.colors.text,
    },
    pickerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    pickerItemSelected: {
      backgroundColor: theme.colors.primary + "08",
    },
    pickerThumb: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.sm,
    },
    pickerColorDot: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    pickerItemName: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.text,
    },
    pickerItemMeta: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    // Rename modal
    renameOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    renameDialog: {
      width: "100%",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
    },
    renameTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    renameInput: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    renameActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.sm,
    },
    renameCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.sm,
    },
    renameCancelText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    renameSaveBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary,
    },
    renameSaveText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    // Log Worn selfie
    logWornSubtitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
      marginTop: -theme.spacing.sm,
    },
    selfieButtonRow: {
      flexDirection: "row",
      gap: 10,
    },
    selfiePreviewWrap: {
      alignItems: "center",
      position: "relative",
      marginBottom: 4,
    },
    selfiePreview: {
      width: 120,
      height: 120,
      borderRadius: theme.borderRadius.md,
      resizeMode: "cover",
    },
    selfieRemoveBtn: {
      position: "absolute",
      top: -8,
      right: "30%",
    },
    takeSelfieBtn: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 16,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary + "40",
      borderStyle: "dashed",
      backgroundColor: theme.colors.primary + "08",
    },
    pickPhotoBtn: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 16,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary + "40",
      borderStyle: "dashed",
    },
    takeSelfieBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });
}

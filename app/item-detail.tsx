import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ColorDot } from "@/components/ColorDot";
import { useTheme } from "@/hooks/useTheme";
import { hexToHSL } from "@/constants/colors";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  FABRIC_TYPE_LABELS,
  ITEM_FLAG_LABELS,
  ARCHIVE_REASON_LABELS,
  CARE_INSTRUCTION_LABELS,
  PATTERN_LABELS,
} from "@/models/types";
import type { ItemFlag, ArchiveReason, CareInstruction, Pattern } from "@/models/types";

const ARCHIVE_REASONS: ArchiveReason[] = ["donated", "sold", "worn_out", "given_away"];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Return a human-friendly age string like "3 months" or "1 year, 2 months". */
function formatAge(dateInput: string | number): string {
  const then = new Date(dateInput);
  const now = new Date();
  let years = now.getFullYear() - then.getFullYear();
  let months = now.getMonth() - then.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86400000));
  if (years > 0 && months > 0) return `${years}y ${months}mo`;
  if (years > 0) return `${years}y`;
  if (months > 0) return `${months}mo`;
  return `${days}d`;
}

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items: allItems, getById, addOrUpdate, remove, archiveItem, logItemWorn, removeItemWornDate } = useClothingItems();
  const { theme } = useTheme();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showWearLog, setShowWearLog] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const item = getById(id);

  // Similar items (#47) — same category, similar colour
  const similarItems = useMemo(() => {
    if (!item) return [];
    const itemHSL = hexToHSL(item.color);
    return allItems
      .filter((i) => {
        if (i.id === item.id || i.category !== item.category) return false;
        const iHSL = hexToHSL(i.color);
        const hueDiff = Math.min(Math.abs(itemHSL.h - iHSL.h), 360 - Math.abs(itemHSL.h - iHSL.h));
        return hueDiff <= 40;
      })
      .slice(0, 5);
  }, [item, allItems]);

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Item not found.</Text>
      </View>
    );
  }

  const subcatLabel = item.subCategory
    ? SUBCATEGORIES[item.category]?.find((sc) => sc.value === item.subCategory)?.label
    : null;

  const costPerWear =
    item.cost != null && (item.wearCount ?? 0) > 0
      ? item.cost / (item.wearCount ?? 1)
      : null;

  const ageSource: string | number | undefined = item.purchaseDate ?? item.createdAt;

  const toggleFavorite = async () => {
    await addOrUpdate({ ...item, favorite: !item.favorite });
  };

  const handleLogWear = async () => {
    await logItemWorn(id);
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
          onPress: () => removeItemWornDate(id, index),
        },
      ]
    );
  };

  const handleArchive = async (reason: ArchiveReason) => {
    if (!id) return;
    setShowArchiveModal(false);
    await archiveItem(id, reason);
    Alert.alert("Archived", "Item has been archived.");
    router.back();
  };

  const handleDelete = () => {
    Alert.alert("Delete Item", "Are you sure you want to remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (id) await remove(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Photos */}
        {item.imageUris && item.imageUris.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
          >
            {item.imageUris.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Name + Favorite */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          <Pressable onPress={toggleFavorite} hitSlop={10}>
            <Ionicons
              name={item.favorite ? "heart" : "heart-outline"}
              size={26}
              color={item.favorite ? theme.colors.error : theme.colors.textLight}
            />
          </Pressable>
        </View>

        {/* Brand (prominent + clickable) */}
        {item.brand ? (
          <Pressable
            style={styles.brandRow}
            onPress={() => router.push({ pathname: "/brand-items", params: { brand: item.brand } })}
          >
            <Text style={styles.brandText}>{item.brand}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
          </Pressable>
        ) : null}

        {/* Sustainable badge */}
        {item.sustainable && (
          <View style={styles.sustainableBadge}>
            <Ionicons name="leaf" size={16} color="#FFFFFF" />
            <Text style={styles.sustainableBadgeText}>Sustainable</Text>
          </View>
        )}

        {/* Cost-per-wear hero */}
        {costPerWear != null && (
          <View style={styles.cpwHero}>
            <Text style={styles.cpwHeroLabel}>Cost per Wear</Text>
            <Text style={styles.cpwHeroValue}>{fmt(costPerWear)}</Text>
            <Text style={styles.cpwHeroSub}>
              {fmt(item.cost!)} / {item.wearCount} wear{(item.wearCount ?? 0) !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Category */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>
            {CATEGORY_LABELS[item.category]}
            {subcatLabel ? ` — ${subcatLabel}` : ""}
          </Text>
        </View>

        {/* Colour */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Colour</Text>
          <View style={styles.colorRow}>
            <ColorDot color={item.color} size={20} />
            <Text style={styles.infoValue}>{item.colorName}</Text>
            {item.secondaryColor && (
              <>
                <View style={styles.colorSeparator} />
                <ColorDot color={item.secondaryColor} size={20} />
                <Text style={styles.infoValue}>{item.secondaryColorName}</Text>
              </>
            )}
          </View>
        </View>

        {/* Fabric */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fabric</Text>
          <Text style={styles.infoValue}>{FABRIC_TYPE_LABELS[item.fabricType]}</Text>
        </View>

        {/* Pattern */}
        {item.pattern && item.pattern !== "solid" && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pattern</Text>
            <Text style={styles.infoValue}>{PATTERN_LABELS[item.pattern as Pattern]}</Text>
          </View>
        )}

        {/* Size (#65) */}
        {item.size && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Size</Text>
            <Text style={styles.infoValue}>{item.size}</Text>
          </View>
        )}

        {/* Product URL */}
        {item.productUrl ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>URL</Text>
            <Pressable onPress={() => Linking.openURL(item.productUrl!)}>
              <Text style={[styles.infoValue, { color: theme.colors.primary, textDecorationLine: "underline" }]} numberOfLines={1}>
                {item.productUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}...
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Cost */}
        {item.cost != null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cost</Text>
            <Text style={[styles.infoValue, styles.costValue]}>{fmt(item.cost)}</Text>
          </View>
        )}

        {/* Purchase Date */}
        {item.purchaseDate ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purchased</Text>
            <Text style={styles.infoValue}>
              {new Date(item.purchaseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        ) : null}

        {/* Age */}
        {ageSource != null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{formatAge(ageSource)}</Text>
          </View>
        )}

        {/* Wear Count + Log Wear */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Worn</Text>
          <View style={styles.wearRow}>
            <Text style={styles.infoValue}>
              {item.wearCount ?? 0} time{(item.wearCount ?? 0) !== 1 ? "s" : ""}
            </Text>
            <Pressable style={styles.logWearBtn} onPress={handleLogWear}>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.logWearText}>Log a Wear</Text>
            </Pressable>
          </View>
        </View>

        {/* Wear History */}
        <Pressable
          style={styles.wornLogToggle}
          onPress={() => setShowWearLog(!showWearLog)}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.wornLogToggleText}>
            Wear History ({(item.wearDates ?? []).length})
          </Text>
          <Ionicons
            name={showWearLog ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {showWearLog && (
          <View style={styles.wornLogList}>
            {(item.wearDates ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No wear history yet.</Text>
            ) : (
              <>
                {(() => {
                  const sortedDates = [...(item.wearDates ?? [])]
                    .map((date, origIdx) => ({ date, origIdx }))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const visibleDates = showAllDates ? sortedDates : sortedDates.slice(0, 10);
                  return visibleDates.map(({ date, origIdx }, idx) => (
                    <View key={`${date}-${idx}`} style={styles.wornLogRow}>
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
                  ));
                })()}
                {!showAllDates && (item.wearDates ?? []).length > 10 && (
                  <Pressable
                    style={styles.viewAllBtn}
                    onPress={() => setShowAllDates(true)}
                  >
                    <Text style={styles.viewAllText}>
                      View all {(item.wearDates ?? []).length} dates
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {/* Care Instructions */}
        {item.careInstructions && item.careInstructions.length > 0 && (
          <View style={styles.careSection}>
            <Text style={styles.infoLabel}>Care</Text>
            <View style={styles.chipRow}>
              {(item.careInstructions as CareInstruction[]).map((ci) => (
                <View key={ci} style={styles.careChip}>
                  <Ionicons name="water-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.careChipText}>
                    {CARE_INSTRUCTION_LABELS[ci]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.careSection}>
            <Text style={styles.infoLabel}>Tags</Text>
            <View style={styles.chipRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Ionicons name="pricetag-outline" size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Flags */}
        {item.itemFlags && item.itemFlags.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Flags</Text>
            <Text style={[styles.infoValue, styles.flagValue]}>
              {(item.itemFlags as ItemFlag[]).map((f) => ITEM_FLAG_LABELS[f]).join(", ")}
            </Text>
          </View>
        )}

        {/* Notes */}
        {item.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.infoLabel}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {/* Edit Button */}
        <Pressable
          style={styles.editBtn}
          onPress={() =>
            router.push({ pathname: "/edit-item", params: { id: item.id } })
          }
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editBtnText}>Edit Item</Text>
        </Pressable>

        {/* Similar Items (#47) */}
        {similarItems.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={[styles.similarTitle, { color: theme.colors.text }]}>
              Similar Items
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {similarItems.map((si) => (
                <Pressable
                  key={si.id}
                  style={styles.similarCard}
                  onPress={() => router.push(`/item-detail?id=${si.id}`)}
                >
                  {si.imageUris?.length > 0 ? (
                    <Image source={{ uri: si.imageUris[0] }} style={styles.similarImage} />
                  ) : (
                    <View style={[styles.similarImagePlaceholder, { backgroundColor: si.color + "30" }]}>
                      <ColorDot color={si.color} size={24} />
                    </View>
                  )}
                  <Text style={[styles.similarName, { color: theme.colors.text }]} numberOfLines={1}>
                    {si.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Archive Button */}
        <Pressable
          style={styles.archiveBtn}
          onPress={() => setShowArchiveModal(true)}
        >
          <Ionicons name="archive-outline" size={18} color={theme.colors.warning} />
          <Text style={styles.archiveBtnText}>Archive Item</Text>
        </Pressable>

        {/* Delete Button */}
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
          <Text style={styles.deleteBtnText}>Delete Item</Text>
        </Pressable>
      </ScrollView>

      {/* Archive Reason Modal */}
      <Modal
        visible={showArchiveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowArchiveModal(false)}
      >
        <Pressable style={styles.archiveOverlay} onPress={() => setShowArchiveModal(false)}>
          <View style={styles.archiveSheet}>
            <Text style={styles.archiveSheetTitle}>Archive Reason</Text>
            {ARCHIVE_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={styles.archiveOption}
                onPress={() => handleArchive(reason)}
              >
                <Text style={styles.archiveOptionText}>
                  {ARCHIVE_REASON_LABELS[reason]}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              </Pressable>
            ))}
            <Pressable
              style={styles.archiveCancelBtn}
              onPress={() => setShowArchiveModal(false)}
            >
              <Text style={styles.archiveCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { paddingBottom: theme.spacing.xxl },
    notFound: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: 40,
    },
    photoScroll: {
      marginBottom: theme.spacing.md,
    },
    photo: {
      width: 280,
      height: 360,
      borderRadius: 0,
      marginRight: 2,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      gap: 12,
    },
    name: {
      flex: 1,
      fontSize: theme.fontSize.xxl,
      fontWeight: "800",
      color: theme.colors.text,
    },
    /* Brand - prominent display */
    brandRow: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    brandText: {
      fontSize: theme.fontSize.xl,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      letterSpacing: 0.5,
    },
    /* Sustainable badge */
    sustainableBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
    },
    sustainableBadgeText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    /* Cost-per-wear hero card */
    cpwHero: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary + "14",
      alignItems: "center",
    },
    cpwHeroLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cpwHeroValue: {
      fontSize: theme.fontSize.title,
      fontWeight: "800",
      color: theme.colors.primary,
      marginTop: 2,
    },
    cpwHeroSub: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textLight,
      marginTop: 2,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    infoLabel: {
      width: 70,
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.textLight,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      flexShrink: 0,
    },
    infoValue: {
      flex: 1,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      fontWeight: "500",
    },
    costValue: {
      color: theme.colors.success,
      fontWeight: "700",
    },
    cpwValue: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    flagValue: {
      color: theme.colors.warning,
    },
    colorRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    colorSeparator: {
      width: 1,
      height: 16,
      backgroundColor: theme.colors.border,
      marginHorizontal: 4,
    },
    wearRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logWearBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary + "12",
    },
    logWearText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    /* Care instructions & tags */
    careSection: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    careChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary + "14",
    },
    careChipText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    tagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    tagChipText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "500",
      color: theme.colors.text,
    },
    notesSection: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    notesText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginTop: 6,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      margin: theme.spacing.md,
      marginTop: theme.spacing.xl,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    editBtnText: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    similarSection: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
    },
    similarTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      marginBottom: theme.spacing.sm,
    },
    similarCard: {
      width: 80,
      marginRight: theme.spacing.sm,
      alignItems: "center",
    },
    similarImage: {
      width: 70,
      height: 70,
      borderRadius: theme.borderRadius.md,
    },
    similarImagePlaceholder: {
      width: 70,
      height: 70,
      borderRadius: theme.borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    similarName: {
      fontSize: 11,
      marginTop: 4,
      textAlign: "center",
    },
    archiveBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.warning + "40",
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.warning + "08",
    },
    archiveBtnText: {
      color: theme.colors.warning,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
    },
    deleteBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    deleteBtnText: {
      color: theme.colors.error,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
    },
    // Wear history
    wornLogToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    wornLogToggleText: {
      flex: 1,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    wornLogList: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    wornLogRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    wornLogDate: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textLight,
      fontStyle: "italic",
      padding: theme.spacing.sm,
    },
    viewAllBtn: {
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
    },
    viewAllText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    // Archive modal
    archiveOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    archiveSheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      paddingBottom: 40,
    },
    archiveSheetTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: "center",
    },
    archiveOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    archiveOptionText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      fontWeight: "500",
    },
    archiveCancelBtn: {
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
    },
    archiveCancelText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      fontWeight: "600",
    },
  });
}

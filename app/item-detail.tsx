import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { ColorDot } from "@/components/ColorDot";
import { Theme } from "@/constants/theme";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  FABRIC_TYPE_LABELS,
  ITEM_FLAG_LABELS,
  ARCHIVE_REASON_LABELS,
} from "@/models/types";
import type { ItemFlag, ArchiveReason } from "@/models/types";

const ARCHIVE_REASONS: ArchiveReason[] = ["donated", "sold", "worn_out", "given_away"];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, addOrUpdate, remove, archiveItem } = useClothingItems();
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  const item = getById(id);

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

  const toggleFavorite = async () => {
    await addOrUpdate({ ...item, favorite: !item.favorite });
  };

  const handleLogWear = async () => {
    await addOrUpdate({ ...item, wearCount: (item.wearCount ?? 0) + 1 });
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
              color={item.favorite ? Theme.colors.error : Theme.colors.textLight}
            />
          </Pressable>
        </View>

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

        {/* Brand */}
        {item.brand && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Brand</Text>
            <Text style={styles.infoValue}>{item.brand}</Text>
          </View>
        )}

        {/* Cost */}
        {item.cost != null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cost</Text>
            <Text style={[styles.infoValue, styles.costValue]}>{fmt(item.cost)}</Text>
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
              <Ionicons name="add-circle-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.logWearText}>Log a Wear</Text>
            </Pressable>
          </View>
        </View>

        {/* Cost per Wear */}
        {item.cost != null && (item.wearCount ?? 0) > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>$/Wear</Text>
            <Text style={[styles.infoValue, styles.cpwValue]}>
              {fmt(item.cost / (item.wearCount ?? 1))}
            </Text>
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

        {/* Archive Button */}
        <Pressable
          style={styles.archiveBtn}
          onPress={() => setShowArchiveModal(true)}
        >
          <Ionicons name="archive-outline" size={18} color={Theme.colors.warning} />
          <Text style={styles.archiveBtnText}>Archive Item</Text>
        </Pressable>

        {/* Delete Button */}
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
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
                <Ionicons name="chevron-forward" size={18} color={Theme.colors.textLight} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { paddingBottom: Theme.spacing.xxl },
  notFound: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
  photoScroll: {
    marginBottom: Theme.spacing.md,
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
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: Theme.fontSize.xxl,
    fontWeight: "800",
    color: Theme.colors.text,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
    gap: 12,
  },
  infoLabel: {
    width: 70,
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    fontWeight: "500",
  },
  costValue: {
    color: Theme.colors.success,
    fontWeight: "700",
  },
  cpwValue: {
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  flagValue: {
    color: Theme.colors.warning,
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
    backgroundColor: Theme.colors.border,
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
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.primary + "12",
  },
  logWearText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  notesSection: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  notesText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    lineHeight: 22,
    marginTop: 6,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
  },
  editBtnText: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  archiveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.warning + "40",
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.warning + "08",
  },
  archiveBtnText: {
    color: Theme.colors.warning,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md,
  },
  deleteBtnText: {
    color: Theme.colors.error,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
  // Archive modal
  archiveOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  archiveSheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.borderRadius.lg,
    borderTopRightRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    paddingBottom: 40,
  },
  archiveSheetTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
    textAlign: "center",
  },
  archiveOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  archiveOptionText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    fontWeight: "500",
  },
  archiveCancelBtn: {
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
  },
  archiveCancelText: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
});

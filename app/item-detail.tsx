import React from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
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
} from "@/models/types";
import type { ItemFlag } from "@/models/types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, addOrUpdate } = useClothingItems();

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

  return (
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

      {/* Wear Count */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Worn</Text>
        <Text style={styles.infoValue}>
          {item.wearCount ?? 0} time{(item.wearCount ?? 0) !== 1 ? "s" : ""}
        </Text>
      </View>

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
    </ScrollView>
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
});

/**
 * Virtual Try-On Screen (#58)
 *
 * Shows a body silhouette with clothing item images placed in
 * body slots computed by virtualTryOn.ts. Users can pick items
 * from their wardrobe and see them layered on a body outline.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useClothingItems } from "@/hooks/useClothingItems";
import { computeTryOnLayout, resolvePixelLayout } from "@/services/virtualTryOn";
import { CATEGORY_LABELS } from "@/models/types";
import type { ClothingItem } from "@/models/types";

const CANVAS_HEIGHT = 520;
const CANVAS_WIDTH = CANVAS_HEIGHT * 0.45;

export default function VirtualTryOnScreen() {
  const { theme } = useTheme();
  const { items } = useClothingItems();
  const router = useRouter();

  const [selectedItems, setSelectedItems] = useState<ClothingItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const layout = useMemo(
    () => computeTryOnLayout(selectedItems),
    [selectedItems]
  );

  const pixelSlots = useMemo(
    () => resolvePixelLayout(layout, CANVAS_WIDTH, CANVAS_HEIGHT),
    [layout]
  );

  const toggleItem = (item: ClothingItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      return [...prev, item];
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Virtual Try-On</Text>
        <Pressable onPress={() => setPickerVisible(true)} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Add items">
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Body silhouette canvas */}
        <View style={[styles.canvasWrapper, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.canvas, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: theme.colors.surfaceAlt }]}>
            {/* Body outline represented with a vertical bar */}
            <View style={styles.silhouetteHint}>
              <Ionicons name="person-outline" size={CANVAS_HEIGHT * 0.85} color={theme.colors.border} />
            </View>

            {/* Render clothing items in their slots */}
            {pixelSlots.map((slot) => {
              if (!slot.item) return null;
              const item = slot.item;
              return (
                <View
                  key={slot.name}
                  style={[
                    styles.slotOverlay,
                    {
                      left: slot.pixelX,
                      top: slot.pixelY,
                      width: slot.pixelWidth,
                      height: slot.pixelHeight,
                    },
                  ]}
                >
                  {item.imageUris && item.imageUris.length > 0 ? (
                    <Image
                      source={{ uri: item.imageUris[0] }}
                      style={styles.slotImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.slotColorBlock, { backgroundColor: item.color + "CC" }]}>
                      <Text style={styles.slotLabel} numberOfLines={2}>{item.name}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Selected items list */}
        <View style={[styles.selectedSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Selected Items ({selectedItems.length})
          </Text>
          {selectedItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Tap + to add items from your wardrobe
            </Text>
          ) : (
            selectedItems.map((item) => (
              <View key={item.id} style={[styles.selectedRow, { borderBottomColor: theme.colors.border }]}>
                <View style={[styles.itemColor, { backgroundColor: item.color }]} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.itemCat, { color: theme.colors.textSecondary }]}>{CATEGORY_LABELS[item.category]}</Text>
                </View>
                <Pressable
                  onPress={() => toggleItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                >
                  <Ionicons name="close-circle" size={22} color={theme.colors.error} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Item picker modal */}
      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={[styles.pickerContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.pickerHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Pick Items</Text>
            <Pressable onPress={() => setPickerVisible(false)} accessibilityRole="button" accessibilityLabel="Close picker">
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => {
              const isSelected = selectedItems.some((s) => s.id === item.id);
              return (
                <Pressable
                  style={[
                    styles.pickerRow,
                    { backgroundColor: theme.colors.surface, borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                  ]}
                  onPress={() => toggleItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${isSelected ? "Remove" : "Add"} ${item.name}`}
                >
                  {item.imageUris && item.imageUris.length > 0 ? (
                    <Image source={{ uri: item.imageUris[0] }} style={styles.pickerThumb} />
                  ) : (
                    <View style={[styles.pickerThumbColor, { backgroundColor: item.color }]} />
                  )}
                  <View style={styles.pickerInfo}>
                    <Text style={[styles.pickerName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.pickerCat, { color: theme.colors.textSecondary }]}>{CATEGORY_LABELS[item.category]}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  addBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { alignItems: "center", paddingBottom: 32, gap: 16, paddingTop: 16 },
  canvasWrapper: {
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  canvas: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  silhouetteHint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  slotOverlay: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 4,
  },
  slotImage: { width: "100%", height: "100%" },
  slotColorBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  slotLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    padding: 4,
  },
  selectedSection: {
    width: "100%",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 8 },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  itemColor: { width: 18, height: 18, borderRadius: 9 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemCat: { fontSize: 12 },
  pickerContainer: { flex: 1 },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
  },
  pickerThumb: { width: 48, height: 48, borderRadius: 6, resizeMode: "cover" },
  pickerThumbColor: { width: 48, height: 48, borderRadius: 6 },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 14, fontWeight: "600" },
  pickerCat: { fontSize: 12 },
});

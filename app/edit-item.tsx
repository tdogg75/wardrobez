import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { ColorWheelPicker } from "@/components/ColorWheelPicker";
import { Theme } from "@/constants/theme";
import {
  PRESET_COLORS,
  hexToHSL,
  hslToHex,
  getColorName,
  findClosestPresetIndex,
} from "@/constants/colors";
import type {
  ClothingCategory,
  FabricType,
} from "@/models/types";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  FABRIC_TYPE_LABELS,
} from "@/models/types";

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, addOrUpdate, remove } = useClothingItems();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory>("tops");
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);
  const [colorIdx, setColorIdx] = useState(0);
  const [fabricType, setFabricType] = useState<FabricType>("cotton");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [createdAt, setCreatedAt] = useState(Date.now());

  // HSL fine-tuning
  const [hslAdjust, setHslAdjust] = useState<{ h: number; s: number; l: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Secondary color
  const [secondaryColorIdx, setSecondaryColorIdx] = useState<number | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);

  useEffect(() => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setSubCategory(item.subCategory);
    const cIdx = findClosestPresetIndex(item.color);
    setColorIdx(cIdx);
    const hsl = hexToHSL(item.color);
    setHslAdjust({ h: hsl.h, s: hsl.s, l: hsl.l });
    setFabricType(item.fabricType);
    setImageUris(item.imageUris ?? []);
    setBrand(item.brand ?? "");
    setProductUrl(item.productUrl ?? "");
    setFavorite(item.favorite);
    setCreatedAt(item.createdAt);

    if (item.secondaryColor) {
      const secIdx = findClosestPresetIndex(item.secondaryColor);
      setSecondaryColorIdx(secIdx);
      setShowSecondaryColor(true);
    }
  }, [id, items]);

  const finalColor = useMemo(() => {
    if (hslAdjust) return hslToHex(hslAdjust.h, hslAdjust.s, hslAdjust.l);
    return PRESET_COLORS[colorIdx].hex;
  }, [colorIdx, hslAdjust]);

  const finalColorName = useMemo(() => {
    if (hslAdjust) return getColorName(finalColor);
    return PRESET_COLORS[colorIdx].name;
  }, [finalColor, hslAdjust, colorIdx]);

  const secondaryColor = secondaryColorIdx !== null ? PRESET_COLORS[secondaryColorIdx].hex : undefined;
  const secondaryColorName = secondaryColorIdx !== null ? PRESET_COLORS[secondaryColorIdx].name : undefined;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUris((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectPresetColor = (idx: number) => {
    setColorIdx(idx);
    const preset = PRESET_COLORS[idx];
    setHslAdjust({ h: preset.hue, s: preset.saturation, l: preset.lightness });
  };

  const openColorPicker = () => {
    if (!hslAdjust) {
      const preset = PRESET_COLORS[colorIdx];
      setHslAdjust({ h: preset.hue, s: preset.saturation, l: preset.lightness });
    }
    setShowColorPicker(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !id) return;
    await addOrUpdate({
      id,
      name: name.trim(),
      category,
      subCategory,
      color: finalColor,
      colorName: finalColorName,
      secondaryColor,
      secondaryColorName,
      fabricType,
      imageUris,
      brand: brand.trim() || undefined,
      productUrl: productUrl.trim() || undefined,
      favorite,
      createdAt,
    });
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

  const subcats = SUBCATEGORIES[category];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {imageUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoThumbImage} />
              <Pressable
                style={styles.removePhotoBtn}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={22} color={Theme.colors.error} />
              </Pressable>
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Main</Text>
                </View>
              )}
            </View>
          ))}
          <Pressable style={styles.addPhotoBtn} onPress={pickImage}>
            <Ionicons name="camera-outline" size={28} color={Theme.colors.textLight} />
            <Text style={styles.addPhotoLabel}>Add Photo</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.sectionTitle}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={Theme.colors.textLight}
        />

        <Text style={styles.sectionTitle}>Brand (optional)</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholderTextColor={Theme.colors.textLight}
        />

        {/* Product URL */}
        <Text style={styles.sectionTitle}>Product URL (optional)</Text>
        <TextInput
          style={styles.input}
          value={productUrl}
          onChangeText={setProductUrl}
          placeholder="https://..."
          placeholderTextColor={Theme.colors.textLight}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
            <Chip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              selected={category === cat}
              onPress={() => {
                setCategory(cat);
                setSubCategory(undefined);
              }}
            />
          ))}
        </View>

        {/* Subcategory */}
        {subcats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.chipRow}>
              {subcats.map((sc) => (
                <Chip
                  key={sc.value}
                  label={sc.label}
                  selected={subCategory === sc.value}
                  onPress={() =>
                    setSubCategory(subCategory === sc.value ? undefined : sc.value)
                  }
                />
              ))}
            </View>
          </>
        )}

        {/* Color */}
        <View style={styles.colorHeader}>
          <Text style={styles.sectionTitle}>
            Color — {finalColorName}
          </Text>
          <Pressable style={styles.colorPickerBtn} onPress={openColorPicker}>
            <View style={[styles.colorPickerSwatch, { backgroundColor: finalColor }]} />
            <Ionicons name="color-palette-outline" size={18} color={Theme.colors.primary} />
            <Text style={styles.colorPickerBtnText}>Fine-tune</Text>
          </Pressable>
        </View>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c, i) => (
            <Pressable key={c.hex + i} onPress={() => handleSelectPresetColor(i)} style={styles.colorBtn}>
              <ColorDot color={c.hex} size={36} selected={colorIdx === i && !hslAdjust} />
            </Pressable>
          ))}
        </View>

        {/* Secondary Color */}
        <Pressable
          style={styles.secondaryToggle}
          onPress={() => {
            setShowSecondaryColor(!showSecondaryColor);
            if (showSecondaryColor) setSecondaryColorIdx(null);
          }}
        >
          <Ionicons
            name={showSecondaryColor ? "chevron-up" : "chevron-down"}
            size={16}
            color={Theme.colors.primary}
          />
          <Text style={styles.secondaryToggleText}>
            {showSecondaryColor ? "Hide secondary color" : "Add secondary color (optional)"}
          </Text>
        </Pressable>

        {showSecondaryColor && (
          <>
            <Text style={styles.sectionTitle}>
              Secondary Color{secondaryColorIdx !== null ? ` — ${PRESET_COLORS[secondaryColorIdx].name}` : ""}
            </Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c, i) => (
                <Pressable
                  key={`sec-${c.hex}-${i}`}
                  onPress={() => setSecondaryColorIdx(secondaryColorIdx === i ? null : i)}
                  style={styles.colorBtn}
                >
                  <ColorDot color={c.hex} size={36} selected={secondaryColorIdx === i} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Fabric Type */}
        <Text style={styles.sectionTitle}>Fabric Type</Text>
        <View style={styles.chipRow}>
          {(Object.keys(FABRIC_TYPE_LABELS) as FabricType[]).map((ft) => (
            <Chip
              key={ft}
              label={FABRIC_TYPE_LABELS[ft]}
              selected={fabricType === ft}
              onPress={() => setFabricType(ft)}
            />
          ))}
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
          <Text style={styles.deleteBtnText}>Delete Item</Text>
        </Pressable>
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fine-tune Color</Text>
            <Pressable onPress={() => setShowColorPicker(false)}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.colorPickerContent}>
            {/* Preview swatch */}
            <View style={styles.pickerPreview}>
              <View style={[styles.pickerSwatch, { backgroundColor: finalColor }]} />
              <View>
                <Text style={styles.pickerColorName}>{finalColorName}</Text>
                <Text style={styles.pickerHex}>{finalColor}</Text>
              </View>
            </View>

            {/* Color Wheel */}
            <View style={styles.wheelWrap}>
              <ColorWheelPicker
                hue={hslAdjust?.h ?? 0}
                saturation={hslAdjust?.s ?? 50}
                lightness={hslAdjust?.l ?? 50}
                size={240}
                onColorChange={(h, s, l) => setHslAdjust({ h, s, l: hslAdjust?.l ?? 50 })}
              />
            </View>

            {/* HSL Sliders */}
            {hslAdjust && (
              <View style={styles.hslSection}>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Hue</Text>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, h: Math.max(0, hslAdjust.h - 10) })}
                  >
                    <Ionicons name="remove" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <View style={styles.sliderTrack}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${(hslAdjust.h / 360) * 100}%`, backgroundColor: `hsl(${hslAdjust.h}, 70%, 50%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, h: Math.min(360, hslAdjust.h + 10) })}
                  >
                    <Ionicons name="add" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <Text style={styles.sliderValue}>{hslAdjust.h}°</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Sat</Text>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, s: Math.max(0, hslAdjust.s - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <View style={styles.sliderTrack}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${hslAdjust.s}%`, backgroundColor: `hsl(${hslAdjust.h}, ${hslAdjust.s}%, 50%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, s: Math.min(100, hslAdjust.s + 5) })}
                  >
                    <Ionicons name="add" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <Text style={styles.sliderValue}>{hslAdjust.s}%</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Light</Text>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, l: Math.max(0, hslAdjust.l - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <View style={styles.sliderTrack}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${hslAdjust.l}%`, backgroundColor: `hsl(${hslAdjust.h}, ${hslAdjust.s}%, ${hslAdjust.l}%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={styles.sliderBtn}
                    onPress={() => setHslAdjust({ ...hslAdjust, l: Math.min(100, hslAdjust.l + 5) })}
                  >
                    <Ionicons name="add" size={16} color={Theme.colors.text} />
                  </Pressable>
                  <Text style={styles.sliderValue}>{hslAdjust.l}%</Text>
                </View>
                <Pressable style={styles.resetHslBtn} onPress={() => setHslAdjust(null)}>
                  <Text style={styles.resetHslText}>Reset to preset</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={styles.doneBtn}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.md, paddingBottom: Theme.spacing.xxl },
  photoScroll: {
    marginBottom: Theme.spacing.sm,
  },
  photoThumb: {
    width: 100,
    height: 130,
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
    marginRight: Theme.spacing.sm,
    position: "relative",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 11,
  },
  primaryBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  addPhotoBtn: {
    width: 100,
    height: 130,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderStyle: "dashed",
  },
  addPhotoLabel: {
    marginTop: 4,
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
  },
  input: {
    height: 48,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  colorPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.primary + "12",
  },
  colorPickerSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  colorPickerBtnText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorBtn: { padding: 2 },
  // Secondary Color
  secondaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.md,
    paddingVertical: 8,
  },
  secondaryToggleText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  saveBtn: {
    height: 52,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Theme.spacing.xl,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: Theme.fontSize.lg, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
  },
  deleteBtnText: {
    color: Theme.colors.error,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingTop: Theme.spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  modalTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  colorPickerContent: {
    padding: Theme.spacing.md,
    alignItems: "center",
    paddingBottom: 60,
  },
  pickerPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    alignSelf: "stretch",
  },
  pickerSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.1)",
  },
  pickerColorName: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  pickerHex: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
  },
  wheelWrap: {
    marginBottom: 20,
  },
  hslSection: {
    alignSelf: "stretch",
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sliderLabel: {
    width: 36,
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  sliderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: 4,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    borderRadius: 4,
  },
  sliderValue: {
    width: 36,
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    textAlign: "right",
  },
  resetHslBtn: {
    alignItems: "center",
    marginTop: 4,
  },
  resetHslText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  doneBtn: {
    height: 48,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Theme.spacing.lg,
    alignSelf: "stretch",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
  },
});

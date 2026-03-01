import React, { useEffect, useState, useMemo, useLayoutEffect, useCallback } from "react";
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
  ActivityIndicator,
  Linking,
  Switch,
} from "react-native";
import { fetchProductFromUrl } from "@/services/productSearch";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { ColorWheelPicker } from "@/components/ColorWheelPicker";
import { ImageColorDropper } from "@/components/ImageColorDropper";
import { ImageCropper } from "@/components/ImageCropper";
import { useTheme } from "@/hooks/useTheme";
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
  ArchiveReason,
  HardwareColour,
  ItemFlag,
  CareInstruction,
  Pattern,
} from "@/models/types";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  FABRIC_TYPE_LABELS,
  ARCHIVE_REASON_LABELS,
  ALWAYS_OPEN_SUBCATEGORIES,
  HARDWARE_COLOUR_LABELS,
  HARDWARE_SUBCATEGORIES,
  HARDWARE_CATEGORIES,
  ITEM_FLAG_LABELS,
  CARE_INSTRUCTION_LABELS,
  PATTERN_LABELS,
} from "@/models/types";

const ARCHIVE_REASONS: ArchiveReason[] = ["donated", "sold", "worn_out", "given_away"];

export default function EditItemScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { items, addOrUpdate, remove, archiveItem, removeItemWornDate } = useClothingItems();

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
  const [cost, setCost] = useState("");
  const [wearCount, setWearCount] = useState(0);

  // HSL fine-tuning
  const [hslAdjust, setHslAdjust] = useState<{ h: number; s: number; l: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Secondary color
  const [secondaryColorIdx, setSecondaryColorIdx] = useState<number | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);

  // Color dropper
  const [showDropper, setShowDropper] = useState(false);
  const [dropperTarget, setDropperTarget] = useState<"primary" | "secondary">("primary");

  // Open top detection
  const [isOpen, setIsOpen] = useState(false);

  // Hardware colour
  const [hardwareColour, setHardwareColour] = useState<HardwareColour | undefined>(undefined);

  // Item flags
  const [itemFlags, setItemFlags] = useState<ItemFlag[]>([]);

  // Pattern
  const [pattern, setPattern] = useState<Pattern>("solid");

  // Notes
  const [notes, setNotes] = useState("");

  // Original auto colour (from dropper)
  const [originalAutoColor, setOriginalAutoColor] = useState<string | undefined>(undefined);

  // URL refresh
  const [refreshingUrl, setRefreshingUrl] = useState(false);

  // Wear date history
  const [showWearDates, setShowWearDates] = useState(false);

  // Archive
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Image viewer
  const [viewingImageIdx, setViewingImageIdx] = useState<number | null>(null);

  // Purchase date
  const [purchaseDate, setPurchaseDate] = useState("");

  // Care instructions
  const [careInstructions, setCareInstructions] = useState<CareInstruction[]>([]);

  // Sustainable
  const [sustainable, setSustainable] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

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
    setCost(item.cost != null ? String(item.cost) : "");
    setWearCount(item.wearCount ?? 0);

    if (item.secondaryColor) {
      const secIdx = findClosestPresetIndex(item.secondaryColor);
      setSecondaryColorIdx(secIdx);
      setShowSecondaryColor(true);
    }

    // Load new fields
    setIsOpen(item.isOpen ?? false);
    setHardwareColour(item.hardwareColour);
    setItemFlags(item.itemFlags ?? []);
    setNotes(item.notes ?? "");
    setOriginalAutoColor(item.originalAutoColor);
    setPurchaseDate(item.purchaseDate ?? "");
    setCareInstructions(item.careInstructions ?? []);
    setSustainable(item.sustainable ?? false);
    setPattern(item.pattern ?? "solid");
    setTags(item.tags ?? []);
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

  // Cropper state
  const [croppingIdx, setCroppingIdx] = useState<number | null>(null);

  const recropImage = (index: number) => {
    setViewingImageIdx(null);
    // Delay opening cropper to let the viewer modal fully close (avoids Android modal overlap bug)
    setTimeout(() => setCroppingIdx(index), 350);
  };

  const handleCropDone = (croppedUri: string) => {
    if (croppingIdx !== null) {
      setImageUris((prev) => {
        const updated = [...prev];
        updated[croppingIdx] = croppedUri;
        return updated;
      });
    }
    setCroppingIdx(null);
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

  const handleDropperColorPicked = (hex: string) => {
    const hsl = hexToHSL(hex);
    if (dropperTarget === "primary") {
      const idx = findClosestPresetIndex(hex);
      setColorIdx(idx);
      setHslAdjust({ h: hsl.h, s: hsl.s, l: hsl.l });
      setOriginalAutoColor(hex);
    } else {
      const idx = findClosestPresetIndex(hex);
      setSecondaryColorIdx(idx);
      setShowSecondaryColor(true);
    }
  };

  const handleRevertToOriginalColor = () => {
    if (!originalAutoColor) return;
    const hsl = hexToHSL(originalAutoColor);
    const idx = findClosestPresetIndex(originalAutoColor);
    setColorIdx(idx);
    setHslAdjust({ h: hsl.h, s: hsl.s, l: hsl.l });
  };

  const wearDates = useMemo(() => {
    return items.find((i) => i.id === id)?.wearDates ?? [];
  }, [items, id]);

  // isOpen default logic: when category/subcategory changes (not from initial load),
  // default isOpen to true for blazers (all subcats), cardigan, zip_up; false otherwise.
  // Track whether the initial load has completed.
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    if (items.find((i) => i.id === id)) {
      setInitialLoadDone(true);
    }
  }, [id, items]);

  useEffect(() => {
    if (!initialLoadDone) return;
    // When category or subcategory changes after initial load, compute default isOpen
    const shouldBeOpen =
      category === "blazers" ||
      subCategory === "cardigan" ||
      subCategory === "zip_up";
    setIsOpen(shouldBeOpen);
  }, [category, subCategory, initialLoadDone]);

  const handleRefreshFromUrl = async () => {
    if (!productUrl.trim()) {
      Alert.alert("No URL", "Please enter a product URL first.");
      return;
    }
    setRefreshingUrl(true);
    try {
      const result = await fetchProductFromUrl(productUrl.trim());
      if (!result) {
        Alert.alert("No Results", "Could not fetch product information from this URL.");
        return;
      }

      const found: string[] = [];
      if (result.name) found.push(`Name: ${result.name}`);
      if (result.category) found.push(`Category: ${result.category}`);
      if (result.subCategory) found.push(`Subcategory: ${result.subCategory}`);
      if (result.fabricType) found.push(`Fabric: ${result.fabricType}`);
      if (result.colorIndex != null) found.push(`Color: ${PRESET_COLORS[result.colorIndex]?.name ?? "Unknown"}`);
      if (result.cost != null) found.push(`Cost: $${result.cost}`);
      if (result.imageUri) found.push(`Image: found`);
      if (result.brand) found.push(`Brand: ${result.brand}`);

      if (found.length === 0) {
        Alert.alert("No Data", "The URL was fetched but no product fields were found.");
        return;
      }

      Alert.alert(
        "Product Found",
        `The following fields were detected:\n\n${found.join("\n")}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Apply",
            onPress: () => {
              if (result.name) setName(result.name);
              if (result.category) {
                setCategory(result.category);
                setSubCategory(result.subCategory);
              } else if (result.subCategory) {
                setSubCategory(result.subCategory);
              }
              if (result.fabricType) setFabricType(result.fabricType);
              if (result.colorIndex != null) {
                handleSelectPresetColor(result.colorIndex);
              }
              if (result.cost != null) setCost(String(result.cost));
              if (result.imageUri) setImageUris((prev) => [...prev, result.imageUri!]);
              if (result.brand) setBrand(result.brand);
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Error", "Failed to fetch product information. Please check the URL and try again.");
    } finally {
      setRefreshingUrl(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim() || !id) return;
    const parsedCost = cost.trim() ? parseFloat(cost.trim()) : undefined;

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
      cost: parsedCost && !isNaN(parsedCost) ? parsedCost : undefined,
      favorite,
      wearCount,
      archived: false,
      createdAt,
      isOpen,
      hardwareColour,
      itemFlags: itemFlags.length > 0 ? itemFlags : undefined,
      notes: notes.trim() || undefined,
      originalAutoColor,
      purchaseDate: purchaseDate.trim() || undefined,
      careInstructions: careInstructions.length > 0 ? careInstructions : undefined,
      sustainable,
      pattern: pattern !== "solid" ? pattern : undefined,
      tags: tags.length > 0 ? tags : undefined,
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

  const handleArchive = async (reason: ArchiveReason) => {
    if (!id) return;
    setShowArchiveModal(false);
    await archiveItem(id, reason);
    Alert.alert("Archived", "Item has been archived and affected outfits have been flagged.");
    router.back();
  };

  // Set header right icons: save, archive, delete
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginRight: 4 }}>
          <Pressable onPress={handleSave} hitSlop={10}>
            <Ionicons name="checkmark-circle" size={26} color={theme.colors.primary} />
          </Pressable>
          <Pressable onPress={() => setShowArchiveModal(true)} hitSlop={10}>
            <Ionicons name="archive-outline" size={22} color={theme.colors.warning} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, handleSave, handleDelete, theme]);

  const subcats = SUBCATEGORIES[category];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Photos */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {imageUris.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              style={styles.photoThumb}
              onPress={() => setViewingImageIdx(index)}
            >
              <Image source={{ uri }} style={styles.photoThumbImage} />
              <Pressable
                style={styles.removePhotoBtn}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={22} color={theme.colors.error} />
              </Pressable>
              {index === 0 && (
                <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.primaryBadgeText}>Main</Text>
                </View>
              )}
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.addPhotoBtn,
              { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
            ]}
            onPress={pickImage}
          >
            <Ionicons name="camera-outline" size={28} color={theme.colors.textLight} />
            <Text style={[styles.addPhotoLabel, { color: theme.colors.textLight }]}>Add Photo</Text>
          </Pressable>
        </ScrollView>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Name</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          value={name}
          onChangeText={setName}
          placeholderTextColor={theme.colors.textLight}
        />

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Brand (optional)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          value={brand}
          onChangeText={setBrand}
          placeholder="e.g. Zara"
          placeholderTextColor={theme.colors.textLight}
        />

        {/* Product URL */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Product URL (optional)</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={[
              styles.input,
              styles.urlInput,
              { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
            ]}
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="https://..."
            placeholderTextColor={theme.colors.textLight}
            autoCapitalize="none"
            keyboardType="url"
          />
          {productUrl.trim().startsWith("http") && (
            <Pressable
              style={[
                styles.refreshUrlBtn,
                { backgroundColor: theme.colors.primary + "12", borderColor: theme.colors.primary + "30" },
              ]}
              onPress={() => Linking.openURL(productUrl.trim())}
            >
              <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          )}
          <Pressable
            style={[
              styles.refreshUrlBtn,
              { backgroundColor: theme.colors.primary + "12", borderColor: theme.colors.primary + "30" },
              refreshingUrl && { opacity: 0.6 },
            ]}
            onPress={handleRefreshFromUrl}
            disabled={refreshingUrl}
          >
            {refreshingUrl ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
            )}
          </Pressable>
        </View>

        {/* Cost */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Cost (optional)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          placeholder="e.g. 49.99"
          placeholderTextColor={theme.colors.textLight}
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
        />

        {/* Purchase Date */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Purchase Date (optional)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textLight}
          value={purchaseDate}
          onChangeText={setPurchaseDate}
          keyboardType="default"
        />

        {/* Category */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Category</Text>
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
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Type</Text>
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

        {/* Open Top Toggle */}
        {(category === "tops" || category === "blazers") && subCategory && (
          <>
            <View style={styles.openTopRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Open Top (requires shirt under)</Text>
              <Pressable
                style={[
                  styles.openTopToggle,
                  { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                  (isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)) && [
                    styles.openTopToggleActive,
                    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ],
                ]}
                onPress={() => {
                  if (!ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)) {
                    setIsOpen(!isOpen);
                  }
                }}
                disabled={ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)}
              >
                <Text
                  style={[
                    styles.openTopToggleText,
                    { color: theme.colors.textSecondary },
                    (isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)) && styles.openTopToggleTextActive,
                  ]}
                >
                  {isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) ? "Yes" : "No"}
                </Text>
              </Pressable>
            </View>
            {ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
              <Text style={[styles.openTopHint, { color: theme.colors.textLight }]}>
                {subcats.find((sc) => sc.value === subCategory)?.label ?? subCategory} items are always open
              </Text>
            )}
          </>
        )}

        {/* Colour */}
        <View style={styles.colorHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Colour — {finalColorName}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {imageUris.length > 0 && (
              <Pressable
                style={[styles.colorPickerBtn, { backgroundColor: theme.colors.primary + "12" }]}
                onPress={() => {
                  setDropperTarget("primary");
                  setShowDropper(true);
                }}
              >
                <Ionicons name="eyedrop-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.colorPickerBtnText, { color: theme.colors.primary }]}>Dropper</Text>
              </Pressable>
            )}
            <Pressable style={[styles.colorPickerBtn, { backgroundColor: theme.colors.primary + "12" }]} onPress={openColorPicker}>
              <View style={[styles.colorPickerSwatch, { backgroundColor: finalColor }]} />
              <Ionicons name="color-palette-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.colorPickerBtnText, { color: theme.colors.primary }]}>Fine-tune</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c, i) => (
            <Pressable key={c.hex + i} onPress={() => handleSelectPresetColor(i)} style={styles.colorBtn}>
              <ColorDot color={c.hex} size={36} selected={colorIdx === i && !hslAdjust} />
            </Pressable>
          ))}
        </View>

        {/* Revert to original colour */}
        {originalAutoColor && (
          <Pressable style={styles.revertBtn} onPress={handleRevertToOriginalColor}>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.revertBtnText, { color: theme.colors.primary }]}>Revert to original colour</Text>
          </Pressable>
        )}

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
            color={theme.colors.primary}
          />
          <Text style={[styles.secondaryToggleText, { color: theme.colors.primary }]}>
            {showSecondaryColor ? "Hide secondary colour" : "Add secondary colour (optional)"}
          </Text>
        </Pressable>

        {showSecondaryColor && (
          <>
            <View style={styles.colorHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Secondary Colour{secondaryColorIdx !== null ? ` — ${PRESET_COLORS[secondaryColorIdx].name}` : ""}
              </Text>
              {imageUris.length > 0 && (
                <Pressable
                  style={[styles.colorPickerBtn, { backgroundColor: theme.colors.primary + "12" }]}
                  onPress={() => {
                    setDropperTarget("secondary");
                    setShowDropper(true);
                  }}
                >
                  <Ionicons name="eyedrop-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.colorPickerBtnText, { color: theme.colors.primary }]}>Dropper</Text>
                </Pressable>
              )}
            </View>
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
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Fabric Type</Text>
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

        {/* Pattern / Print */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pattern</Text>
        <View style={styles.chipRow}>
          {(Object.keys(PATTERN_LABELS) as Pattern[]).map((p) => (
            <Chip
              key={p}
              label={PATTERN_LABELS[p]}
              selected={pattern === p}
              onPress={() => setPattern(p)}
            />
          ))}
        </View>

        {/* Hardware Colour */}
        {(HARDWARE_CATEGORIES.includes(category) ||
          (subCategory && HARDWARE_SUBCATEGORIES.includes(subCategory))) && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Hardware Colour</Text>
            <View style={styles.chipRow}>
              {(Object.keys(HARDWARE_COLOUR_LABELS) as HardwareColour[]).map((hc) => (
                <Chip
                  key={hc}
                  label={HARDWARE_COLOUR_LABELS[hc]}
                  selected={hardwareColour === hc}
                  onPress={() => setHardwareColour(hardwareColour === hc ? undefined : hc)}
                />
              ))}
            </View>
          </>
        )}

        {/* Care Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Care Instructions</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CARE_INSTRUCTION_LABELS) as CareInstruction[]).map((ci) => (
            <Chip
              key={ci}
              label={CARE_INSTRUCTION_LABELS[ci]}
              selected={careInstructions.includes(ci)}
              onPress={() =>
                setCareInstructions((prev) =>
                  prev.includes(ci) ? prev.filter((c) => c !== ci) : [...prev, ci]
                )
              }
            />
          ))}
        </View>

        {/* Item Flags */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Flags</Text>
        <View style={styles.chipRow}>
          {(Object.keys(ITEM_FLAG_LABELS) as ItemFlag[]).map((flag) => (
            <Chip
              key={flag}
              label={ITEM_FLAG_LABELS[flag]}
              selected={itemFlags.includes(flag)}
              onPress={() =>
                setItemFlags((prev) =>
                  prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
                )
              }
            />
          ))}
        </View>

        {/* Sustainable Toggle */}
        <View style={styles.sustainableRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sustainable / Ethical</Text>
          <Switch
            value={sustainable}
            onValueChange={setSustainable}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={sustainable ? theme.colors.primary : theme.colors.surfaceAlt}
          />
        </View>

        {/* Tags */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[
              styles.input,
              styles.tagInput,
              { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
            ]}
            placeholder="Add a tag..."
            placeholderTextColor={theme.colors.textLight}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={handleAddTag}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.tagAddBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleAddTag}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {tags.length > 0 && (
          <View style={styles.chipRow}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.tagChip, { backgroundColor: theme.colors.primary + "18", borderColor: theme.colors.primary + "40" }]}
                onPress={() => handleRemoveTag(tag)}
              >
                <Text style={[styles.tagChipText, { color: theme.colors.primary }]}>{tag}</Text>
                <Ionicons name="close" size={14} color={theme.colors.primary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Wear Count */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Wear Count</Text>
        <View
          style={[
            styles.wearCountRow,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.wearCountBtn,
              { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
              wearCount <= 0 && { opacity: 0.3 },
            ]}
            onPress={() => setWearCount(Math.max(0, wearCount - 1))}
            disabled={wearCount <= 0}
          >
            <Ionicons name="remove" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.wearCountValue, { color: theme.colors.text }]}>
            {wearCount} wear{wearCount !== 1 ? "s" : ""}
          </Text>
          <Pressable
            style={[
              styles.wearCountBtn,
              { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
            ]}
            onPress={() => setWearCount(wearCount + 1)}
          >
            <Ionicons name="add" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Wear Date History */}
        {wearDates.length > 0 && (
          <>
            <Pressable
              style={styles.wearDatesToggle}
              onPress={() => setShowWearDates(!showWearDates)}
            >
              <Ionicons
                name={showWearDates ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.colors.primary}
              />
              <Text style={[styles.wearDatesToggleText, { color: theme.colors.primary }]}>
                {showWearDates ? "Hide wear history" : `Show wear history (${wearDates.length})`}
              </Text>
            </Pressable>

            {showWearDates && (
              <View
                style={[
                  styles.wearDatesContainer,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                {[...wearDates]
                  .map((d, i) => ({ date: d, originalIndex: i }))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map(({ date, originalIndex }) => (
                    <View
                      key={`${date}-${originalIndex}`}
                      style={[styles.wearDateRow, { borderBottomColor: theme.colors.border }]}
                    >
                      <Text style={[styles.wearDateText, { color: theme.colors.text }]}>
                        {new Date(date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          Alert.alert(
                            "Remove Wear Date",
                            `Remove ${new Date(date).toLocaleDateString()}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => {
                                  if (id) removeItemWornDate(id, originalIndex);
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                      </Pressable>
                    </View>
                  ))}
                {wearDates.length > 10 && (
                  <Text style={[styles.wearDatesMoreText, { color: theme.colors.primary }]}>
                    View all {wearDates.length} dates
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Notes */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes (optional)</Text>
        <TextInput
          style={[
            styles.notesInput,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          placeholder="Add any notes about this item..."
          placeholderTextColor={theme.colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={{ textAlign: "right", fontSize: 11, color: theme.colors.textLight, marginTop: 2 }}>{notes.length}/500</Text>

      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Fine-tune Colour</Text>
            <Pressable onPress={() => setShowColorPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.colorPickerContent}>
            <View style={styles.pickerPreview}>
              <View style={[styles.pickerSwatch, { backgroundColor: finalColor }]} />
              <View>
                <Text style={[styles.pickerColorName, { color: theme.colors.text }]}>{finalColorName}</Text>
                <Text style={[styles.pickerHex, { color: theme.colors.textSecondary }]}>{finalColor}</Text>
              </View>
            </View>

            <View style={styles.wheelWrap}>
              <ColorWheelPicker
                hue={hslAdjust?.h ?? 0}
                saturation={hslAdjust?.s ?? 50}
                lightness={hslAdjust?.l ?? 50}
                size={240}
                onColorChange={(h, s, l) => setHslAdjust({ h, s, l: hslAdjust?.l ?? 50 })}
              />
            </View>

            {hslAdjust && (
              <View
                style={[
                  styles.hslSection,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { color: theme.colors.textSecondary }]}>Hue</Text>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, h: Math.max(0, hslAdjust.h - 10) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.text} />
                  </Pressable>
                  <View style={[styles.sliderTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${(hslAdjust.h / 360) * 100}%`, backgroundColor: `hsl(${hslAdjust.h}, 70%, 50%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, h: Math.min(360, hslAdjust.h + 10) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>{hslAdjust.h}°</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { color: theme.colors.textSecondary }]}>Sat</Text>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, s: Math.max(0, hslAdjust.s - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.text} />
                  </Pressable>
                  <View style={[styles.sliderTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${hslAdjust.s}%`, backgroundColor: `hsl(${hslAdjust.h}, ${hslAdjust.s}%, 50%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, s: Math.min(100, hslAdjust.s + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>{hslAdjust.s}%</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { color: theme.colors.textSecondary }]}>Light</Text>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, l: Math.max(0, hslAdjust.l - 5) })}
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.text} />
                  </Pressable>
                  <View style={[styles.sliderTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${hslAdjust.l}%`, backgroundColor: `hsl(${hslAdjust.h}, ${hslAdjust.s}%, ${hslAdjust.l}%)` },
                      ]}
                    />
                  </View>
                  <Pressable
                    style={[
                      styles.sliderBtn,
                      { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setHslAdjust({ ...hslAdjust, l: Math.min(100, hslAdjust.l + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>{hslAdjust.l}%</Text>
                </View>
                <Pressable style={styles.resetHslBtn} onPress={() => setHslAdjust(null)}>
                  <Text style={[styles.resetHslText, { color: theme.colors.primary }]}>Reset to preset</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Archive Reason Modal */}
      <Modal
        visible={showArchiveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowArchiveModal(false)}
      >
        <Pressable style={styles.archiveOverlay} onPress={() => setShowArchiveModal(false)}>
          <View style={[styles.archiveSheet, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.archiveSheetTitle, { color: theme.colors.text }]}>Archive Reason</Text>
            {ARCHIVE_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[styles.archiveOption, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleArchive(reason)}
              >
                <Text style={[styles.archiveOptionText, { color: theme.colors.text }]}>
                  {ARCHIVE_REASON_LABELS[reason]}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              </Pressable>
            ))}
            <Pressable
              style={styles.archiveCancelBtn}
              onPress={() => setShowArchiveModal(false)}
            >
              <Text style={[styles.archiveCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Image Color Dropper */}
      {imageUris.length > 0 && (
        <ImageColorDropper
          imageUri={imageUris[0]}
          visible={showDropper}
          onColorPicked={handleDropperColorPicked}
          onClose={() => setShowDropper(false)}
        />
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={viewingImageIdx !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewingImageIdx(null)}
      >
        <View style={styles.imageViewerContainer}>
          <View style={styles.imageViewerHeader}>
            <Pressable onPress={() => setViewingImageIdx(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.imageViewerTitle}>
              Photo {viewingImageIdx !== null ? viewingImageIdx + 1 : ""} of {imageUris.length}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {viewingImageIdx !== null && imageUris[viewingImageIdx] && (
            <View style={styles.imageViewerBody}>
              <Image
                source={{ uri: imageUris[viewingImageIdx] }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            </View>
          )}

          <View style={styles.imageViewerActions}>
            <Pressable
              style={[styles.imageViewerBtn, { backgroundColor: theme.colors.surface }]}
              onPress={() => viewingImageIdx !== null && recropImage(viewingImageIdx)}
            >
              <Ionicons name="crop-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.imageViewerBtnText, { color: theme.colors.primary }]}>Crop</Text>
            </Pressable>
            <Pressable
              style={[styles.imageViewerBtn, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                if (viewingImageIdx !== null) {
                  removeImage(viewingImageIdx);
                  setViewingImageIdx(null);
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.imageViewerBtnText, { color: theme.colors.error }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Image Cropper */}
      {croppingIdx !== null && imageUris[croppingIdx] && (
        <ImageCropper
          imageUri={imageUris[croppingIdx]}
          visible
          onCropDone={handleCropDone}
          onCancel={() => setCroppingIdx(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  photoScroll: {
    marginBottom: 8,
  },
  photoThumb: {
    width: 100,
    height: 130,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 8,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  addPhotoBtn: {
    width: 100,
    height: 130,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addPhotoLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  notesInput: {
    height: 90,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  revertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  revertBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  wearCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
  },
  wearCountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  wearCountValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  colorPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  colorPickerSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  colorPickerBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorBtn: { padding: 2 },
  secondaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  secondaryToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  openTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  openTopToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  openTopToggleActive: {},
  openTopToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  openTopToggleTextActive: {
    color: "#FFFFFF",
  },
  openTopHint: {
    fontSize: 11,
    marginTop: 4,
  },
  sustainableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagInput: {
    flex: 1,
  },
  tagAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  archiveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  archiveBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    padding: 16,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  colorPickerContent: {
    padding: 16,
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
    fontSize: 18,
    fontWeight: "700",
  },
  pickerHex: {
    fontSize: 13,
  },
  wheelWrap: {
    marginBottom: 20,
  },
  hslSection: {
    alignSelf: "stretch",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sliderLabel: {
    width: 36,
    fontSize: 11,
    fontWeight: "600",
  },
  sliderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    borderRadius: 4,
  },
  sliderValue: {
    width: 36,
    fontSize: 11,
    textAlign: "right",
  },
  resetHslBtn: {
    alignItems: "center",
    marginTop: 4,
  },
  resetHslText: {
    fontSize: 11,
    fontWeight: "600",
  },
  doneBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    alignSelf: "stretch",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  // Archive modal
  archiveOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  archiveSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  archiveSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  archiveOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archiveOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  archiveCancelBtn: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  archiveCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Image viewer modal
  imageViewerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imageViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
  },
  imageViewerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  imageViewerBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerImage: {
    width: "100%",
    height: "100%",
  },
  imageViewerActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 24,
    paddingBottom: 48,
  },
  imageViewerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  imageViewerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  // URL refresh
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  urlInput: {
    flex: 1,
  },
  refreshUrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  // Wear date history
  wearDatesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
  },
  wearDatesToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  wearDatesContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  wearDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wearDateText: {
    fontSize: 13,
  },
  wearDatesMoreText: {
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
  },
});

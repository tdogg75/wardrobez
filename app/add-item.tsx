import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
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
import {
  fetchProductFromUrl,
} from "@/services/productSearch";
import type {
  ClothingCategory,
  FabricType,
  HardwareColour,
  ItemFlag,
  CareInstruction,
} from "@/models/types";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  FABRIC_TYPE_LABELS,
  ALWAYS_OPEN_SUBCATEGORIES,
  HARDWARE_COLOUR_LABELS,
  HARDWARE_SUBCATEGORIES,
  HARDWARE_CATEGORIES,
  ITEM_FLAG_LABELS,
  CARE_INSTRUCTION_LABELS,
} from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/** Subcategories that should default isOpen to true */
const DEFAULT_OPEN_SUBCATEGORIES = [
  "casual_blazer", "formal_blazer",
  "cardigan", "zip_up",
];

function getDefaultIsOpen(cat: ClothingCategory, sub?: string): boolean {
  if (cat === "blazers") return true;
  if (sub && DEFAULT_OPEN_SUBCATEGORIES.includes(sub)) return true;
  return false;
}

function getTodayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AddItemScreen() {
  const router = useRouter();
  const { items, addOrUpdate } = useClothingItems();
  const { theme } = useTheme();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory>("tops");
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);
  const [colorIdx, setColorIdx] = useState(0);
  const [fabricType, setFabricType] = useState<FabricType>("cotton");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [cost, setCost] = useState("");

  // Purchase date (ISO YYYY-MM-DD)
  const [purchaseDate, setPurchaseDate] = useState(getTodayISO());

  // Open top detection
  const [isOpen, setIsOpen] = useState(false);

  // Hardware colour
  const [hardwareColour, setHardwareColour] = useState<HardwareColour | undefined>(undefined);

  // Item flags
  const [itemFlags, setItemFlags] = useState<ItemFlag[]>([]);

  // Care instructions
  const [careInstructions, setCareInstructions] = useState<CareInstruction[]>([]);

  // Sustainable
  const [sustainable, setSustainable] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Original auto-detected colour
  const [originalAutoColor, setOriginalAutoColor] = useState<string | undefined>(undefined);

  // HSL fine-tuning
  const [hslAdjust, setHslAdjust] = useState<{ h: number; s: number; l: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Secondary color
  const [secondaryColorIdx, setSecondaryColorIdx] = useState<number | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);

  // Color dropper
  const [showDropper, setShowDropper] = useState(false);
  const [dropperTarget, setDropperTarget] = useState<"primary" | "secondary">("primary");

  // Image viewer
  const [viewingImageIdx, setViewingImageIdx] = useState<number | null>(null);

  // Computed final color
  const finalColor = useMemo(() => {
    if (hslAdjust) {
      return hslToHex(hslAdjust.h, hslAdjust.s, hslAdjust.l);
    }
    return PRESET_COLORS[colorIdx].hex;
  }, [colorIdx, hslAdjust]);

  const finalColorName = useMemo(() => {
    if (hslAdjust) return getColorName(finalColor);
    return PRESET_COLORS[colorIdx].name;
  }, [finalColor, hslAdjust, colorIdx]);

  const secondaryColor = secondaryColorIdx !== null ? PRESET_COLORS[secondaryColorIdx].hex : undefined;
  const secondaryColorName = secondaryColorIdx !== null ? PRESET_COLORS[secondaryColorIdx].name : undefined;

  const similarItems = useMemo(() => {
    const finalHSL = hexToHSL(finalColor);
    return items.filter((item) => {
      if (item.category !== category) return false;
      const itemHSL = hexToHSL(item.color);
      const hueDiff = Math.min(
        Math.abs(finalHSL.h - itemHSL.h),
        360 - Math.abs(finalHSL.h - itemHSL.h)
      );
      return hueDiff <= 30;
    });
  }, [items, category, finalColor]);

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
    setCroppingIdx(index);
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

  const handleFetchUrl = async () => {
    const url = productUrl.trim();
    if (!url) {
      Alert.alert("Enter a URL", "Please paste the product URL first.");
      return;
    }
    setFetchingUrl(true);
    try {
      const result = await fetchProductFromUrl(url);
      if (result) {
        if (result.name) setName(result.name);
        if (result.brand) setBrand(result.brand);
        if (result.category) setCategory(result.category);
        if (result.subCategory) setSubCategory(result.subCategory);
        if (result.fabricType) setFabricType(result.fabricType);
        if (result.colorIndex !== undefined) {
          setColorIdx(result.colorIndex);
          const preset = PRESET_COLORS[result.colorIndex];
          setHslAdjust({ h: preset.hue, s: preset.saturation, l: preset.lightness });
        }
        if (result.imageUri) {
          setImageUris((prev) => [result.imageUri!, ...prev]);
        }
        if (result.cost != null) {
          setCost(String(result.cost));
        }
        Alert.alert("Auto-filled!", "Product info has been applied. Review and adjust as needed.");
      } else {
        Alert.alert("Could not parse", "We couldn't extract info from that URL. Please fill in manually.");
      }
    } catch {
      Alert.alert("Fetch failed", "Something went wrong fetching the URL. Please fill in manually.");
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleDropperColorPicked = (hex: string) => {
    const hsl = hexToHSL(hex);
    setOriginalAutoColor(hex);
    if (dropperTarget === "primary") {
      const idx = findClosestPresetIndex(hex);
      setColorIdx(idx);
      setHslAdjust({ h: hsl.h, s: hsl.s, l: hsl.l });
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
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name for this item.");
      return;
    }

    const parsedCost = cost.trim() ? parseFloat(cost.trim()) : undefined;

    await addOrUpdate({
      id: generateId(),
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
      purchaseDate: purchaseDate.trim() || undefined,
      favorite: false,
      wearCount: 0,
      archived: false,
      createdAt: Date.now(),
      isOpen,
      hardwareColour,
      notes: notes.trim() || undefined,
      originalAutoColor,
      itemFlags: itemFlags.length > 0 ? itemFlags : undefined,
      careInstructions: careInstructions.length > 0 ? careInstructions : undefined,
      sustainable: sustainable || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });

    router.back();
  };

  const subcats = SUBCATEGORIES[category];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={[styles.content, { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl }]}
      >
        {/* Photos */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.spacing.sm }}>
          {imageUris.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              style={[styles.photoThumb, { borderRadius: theme.borderRadius.sm, marginRight: theme.spacing.sm }]}
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
                <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full }]}>
                  <Text style={styles.primaryBadgeText}>Main</Text>
                </View>
              )}
            </Pressable>
          ))}
          <Pressable
            style={[styles.addPhotoBtn, { borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
            onPress={pickImage}
          >
            <Ionicons name="camera-outline" size={28} color={theme.colors.textLight} />
            <Text style={[styles.addPhotoLabel, { fontSize: theme.fontSize.xs, color: theme.colors.textLight }]}>Add Photo</Text>
          </Pressable>
        </ScrollView>

        {/* Name */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="e.g. Blue Oxford Shirt"
          placeholderTextColor={theme.colors.textLight}
          value={name}
          onChangeText={setName}
        />

        {/* Brand */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Brand (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="e.g. Uniqlo"
          placeholderTextColor={theme.colors.textLight}
          value={brand}
          onChangeText={setBrand}
        />

        {/* Product URL */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Product URL (optional)</Text>
        <Text style={[styles.urlHint, { fontSize: theme.fontSize.xs, color: theme.colors.textLight, marginBottom: theme.spacing.sm }]}>Paste a product link from your browser to auto-fill details</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="https://..."
            placeholderTextColor={theme.colors.textLight}
            value={productUrl}
            onChangeText={setProductUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          {productUrl.trim().startsWith("http") && (
            <Pressable
              style={styles.urlOpenBtn}
              onPress={() => Linking.openURL(productUrl.trim())}
            >
              <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          )}
          <Pressable
            style={[styles.urlFetchBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }, fetchingUrl && styles.autoFillBtnDisabled]}
            onPress={handleFetchUrl}
            disabled={fetchingUrl}
          >
            {fetchingUrl ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>

        {/* Cost */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Cost (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="e.g. 49.99"
          placeholderTextColor={theme.colors.textLight}
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
        />

        {/* Purchase Date */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Purchase Date (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textLight}
          value={purchaseDate}
          onChangeText={setPurchaseDate}
        />

        {/* Category */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Category</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
            <Chip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              selected={category === cat}
              onPress={() => {
                setCategory(cat);
                setSubCategory(undefined);
                setIsOpen(getDefaultIsOpen(cat, undefined));
              }}
            />
          ))}
        </View>

        {/* Subcategory */}
        {subcats.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Type</Text>
            <View style={styles.chipRow}>
              {subcats.map((sc) => (
                <Chip
                  key={sc.value}
                  label={sc.label}
                  selected={subCategory === sc.value}
                  onPress={() => {
                    const newSub = subCategory === sc.value ? undefined : sc.value;
                    setSubCategory(newSub);
                    setIsOpen(getDefaultIsOpen(category, newSub));
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* Open Top Detection */}
        {(category === "tops" || category === "blazers") && subCategory && !ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
          <Pressable
            style={[styles.openToggle, { marginTop: theme.spacing.sm }]}
            onPress={() => setIsOpen(!isOpen)}
          >
            <Ionicons
              name={isOpen ? "checkbox" : "square-outline"}
              size={22}
              color={isOpen ? theme.colors.primary : theme.colors.textLight}
            />
            <Text style={[styles.openToggleText, { fontSize: theme.fontSize.sm, color: theme.colors.text }]}>
              Does this top require a shirt underneath?
            </Text>
          </Pressable>
        )}
        {(category === "tops" || category === "blazers") && subCategory && ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
          <View style={[styles.openToggle, { marginTop: theme.spacing.sm }]}>
            <Ionicons name="checkbox" size={22} color={theme.colors.primary} />
            <Text style={[styles.openToggleText, { fontSize: theme.fontSize.sm, color: theme.colors.text }]}>
              This item requires a shirt underneath (always open)
            </Text>
          </View>
        )}

        {/* Primary Colour */}
        <View style={[styles.colorHeader, { marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }]}>
          <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: 0, marginTop: 0 }]}>
            Colour — {finalColorName}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {imageUris.length > 0 && (
              <Pressable
                style={[styles.colorPickerBtn, { borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary + "12" }]}
                onPress={() => {
                  setDropperTarget("primary");
                  setShowDropper(true);
                }}
              >
                <Ionicons name="eyedrop-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.colorPickerBtnText, { fontSize: theme.fontSize.xs, color: theme.colors.primary }]}>Dropper</Text>
              </Pressable>
            )}
            {originalAutoColor && (
              <Pressable style={[styles.colorPickerBtn, { borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary + "12" }]} onPress={handleRevertToOriginalColor}>
                <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.colorPickerBtnText, { fontSize: theme.fontSize.xs, color: theme.colors.primary }]}>Revert to original colour</Text>
              </Pressable>
            )}
            <Pressable style={[styles.colorPickerBtn, { borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary + "12" }]} onPress={openColorPicker}>
              <View style={[styles.colorPickerSwatch, { backgroundColor: finalColor }]} />
              <Ionicons name="color-palette-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.colorPickerBtnText, { fontSize: theme.fontSize.xs, color: theme.colors.primary }]}>Fine-tune</Text>
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

        {/* Similar Item Warning */}
        {similarItems.length > 0 && (
          <View style={[styles.similarWarning, {
            marginTop: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.warning + "14",
            borderRadius: theme.borderRadius.sm,
            borderColor: theme.colors.warning + "30",
          }]}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warning} />
            <Text style={[styles.similarWarningText, { fontSize: theme.fontSize.sm, color: theme.colors.warning }]}>
              You already have {similarItems.length} similar {CATEGORY_LABELS[category].toLowerCase()} item(s) in this color range.
            </Text>
          </View>
        )}

        {/* Secondary Color */}
        <Pressable
          style={[styles.secondaryToggle, { marginTop: theme.spacing.md }]}
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
          <Text style={[styles.secondaryToggleText, { fontSize: theme.fontSize.sm, color: theme.colors.primary }]}>
            {showSecondaryColor ? "Hide secondary colour" : "Add secondary colour (optional)"}
          </Text>
        </Pressable>

        {showSecondaryColor && (
          <>
            <View style={[styles.colorHeader, { marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }]}>
              <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: 0, marginTop: 0 }]}>
                Secondary Colour{secondaryColorIdx !== null ? ` — ${PRESET_COLORS[secondaryColorIdx].name}` : ""}
              </Text>
              {imageUris.length > 0 && (
                <Pressable
                  style={[styles.colorPickerBtn, { borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary + "12" }]}
                  onPress={() => {
                    setDropperTarget("secondary");
                    setShowDropper(true);
                  }}
                >
                  <Ionicons name="eyedrop-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.colorPickerBtnText, { fontSize: theme.fontSize.xs, color: theme.colors.primary }]}>Dropper</Text>
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
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Fabric Type</Text>
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

        {/* Hardware Colour */}
        {(HARDWARE_CATEGORIES.includes(category) || (subCategory && HARDWARE_SUBCATEGORIES.includes(subCategory))) && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Hardware Colour</Text>
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
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Care Instructions (optional)</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CARE_INSTRUCTION_LABELS) as CareInstruction[]).map((ci) => (
            <Chip
              key={ci}
              label={CARE_INSTRUCTION_LABELS[ci]}
              selected={careInstructions.includes(ci)}
              onPress={() => {
                setCareInstructions((prev) =>
                  prev.includes(ci)
                    ? prev.filter((c) => c !== ci)
                    : [...prev, ci]
                );
              }}
            />
          ))}
        </View>

        {/* Item Flags */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Flags — Watch Out For</Text>
        <View style={styles.chipRow}>
          {(Object.keys(ITEM_FLAG_LABELS) as ItemFlag[]).map((flag) => (
            <Chip
              key={flag}
              label={ITEM_FLAG_LABELS[flag]}
              selected={itemFlags.includes(flag)}
              onPress={() => {
                setItemFlags((prev) =>
                  prev.includes(flag)
                    ? prev.filter((f) => f !== flag)
                    : [...prev, flag]
                );
              }}
            />
          ))}
        </View>

        {/* Sustainable */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Sustainability</Text>
        <Pressable
          style={[
            styles.sustainableChip,
            {
              borderRadius: theme.borderRadius.full,
              backgroundColor: sustainable ? theme.colors.primary : theme.colors.surfaceAlt,
            },
          ]}
          onPress={() => setSustainable(!sustainable)}
        >
          <Ionicons
            name={sustainable ? "leaf" : "leaf-outline"}
            size={16}
            color={sustainable ? "#FFFFFF" : theme.colors.textSecondary}
          />
          <Text style={[styles.sustainableChipText, { fontSize: theme.fontSize.sm, color: sustainable ? "#FFFFFF" : theme.colors.textSecondary }]}>
            Sustainable / Ethical
          </Text>
        </Pressable>

        {/* Tags */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Tags (optional)</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Add a tag..."
            placeholderTextColor={theme.colors.textLight}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={handleAddTag}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.tagAddBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }]}
            onPress={handleAddTag}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        {tags.length > 0 && (
          <View style={[styles.chipRow, { marginTop: theme.spacing.sm }]}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.tagChip, { backgroundColor: theme.colors.primary + "18", borderRadius: theme.borderRadius.full }]}
                onPress={() => handleRemoveTag(tag)}
              >
                <Text style={[styles.tagChipText, { fontSize: theme.fontSize.sm, color: theme.colors.primary }]}>{tag}</Text>
                <Ionicons name="close-circle" size={14} color={theme.colors.primary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Notes */}
        <Text style={[styles.sectionTitle, { fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="Any additional notes about this item..."
          placeholderTextColor={theme.colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Save Button */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, marginTop: theme.spacing.xl }]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, { fontSize: theme.fontSize.lg }]}>Add to Wardrobe</Text>
        </Pressable>
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background, paddingTop: theme.spacing.md }]}>
          <View style={[styles.modalHeader, { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }]}>
            <Text style={[styles.modalTitle, { fontSize: theme.fontSize.xl, color: theme.colors.text }]}>Fine-tune Colour</Text>
            <Pressable onPress={() => setShowColorPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.colorPickerContent, { padding: theme.spacing.md }]}>
            {/* Preview swatch */}
            <View style={styles.pickerPreview}>
              <View style={[styles.pickerSwatch, { backgroundColor: finalColor }]} />
              <View>
                <Text style={[styles.pickerColorName, { fontSize: theme.fontSize.lg, color: theme.colors.text }]}>{finalColorName}</Text>
                <Text style={[styles.pickerHex, { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }]}>{finalColor}</Text>
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
              <View style={[styles.hslSection, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, borderColor: theme.colors.border }]}>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>Hue</Text>
                  <Pressable
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
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
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                    onPress={() => setHslAdjust({ ...hslAdjust, h: Math.min(360, hslAdjust.h + 10) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>{hslAdjust.h}°</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>Sat</Text>
                  <Pressable
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
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
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                    onPress={() => setHslAdjust({ ...hslAdjust, s: Math.min(100, hslAdjust.s + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>{hslAdjust.s}%</Text>
                </View>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>Light</Text>
                  <Pressable
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
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
                    style={[styles.sliderBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                    onPress={() => setHslAdjust({ ...hslAdjust, l: Math.min(100, hslAdjust.l + 5) })}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </Pressable>
                  <Text style={[styles.sliderValue, { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }]}>{hslAdjust.l}%</Text>
                </View>
                <Pressable style={styles.resetHslBtn} onPress={() => setHslAdjust(null)}>
                  <Text style={[styles.resetHslText, { fontSize: theme.fontSize.xs, color: theme.colors.primary }]}>Reset to preset</Text>
                </Pressable>
              </View>
            )}

            {/* Done button */}
            <Pressable
              style={[styles.doneBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, marginTop: theme.spacing.lg }]}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={[styles.doneBtnText, { fontSize: theme.fontSize.lg }]}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
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
          <View style={[styles.imageViewerHeader, { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }]}>
            <Pressable onPress={() => setViewingImageIdx(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.imageViewerTitle, { fontSize: theme.fontSize.md }]}>
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

          <View style={[styles.imageViewerActions, { gap: theme.spacing.lg, paddingVertical: theme.spacing.lg, paddingBottom: theme.spacing.xxl }]}>
            <Pressable
              style={[styles.imageViewerBtn, { borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface }]}
              onPress={() => viewingImageIdx !== null && recropImage(viewingImageIdx)}
            >
              <Ionicons name="crop-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.imageViewerBtnText, { fontSize: theme.fontSize.md, color: theme.colors.primary }]}>Crop</Text>
            </Pressable>
            <Pressable
              style={[styles.imageViewerBtn, { borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface }]}
              onPress={() => {
                if (viewingImageIdx !== null) {
                  removeImage(viewingImageIdx);
                  setViewingImageIdx(null);
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.imageViewerBtnText, { fontSize: theme.fontSize.md, color: theme.colors.error }]}>Delete</Text>
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
  container: {
    flex: 1,
  },
  content: {},
  photoThumb: {
    width: 100,
    height: 130,
    overflow: "hidden",
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
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  addPhotoBtn: {
    width: 100,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addPhotoLabel: {
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  input: {
    height: 48,
    borderWidth: 1,
  },
  urlRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  urlOpenBtn: {
    width: 40,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  urlFetchBtn: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  urlHint: {
    fontStyle: "italic",
  },
  autoFillBtnDisabled: {
    opacity: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colorPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  colorPickerSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  colorPickerBtnText: {
    fontWeight: "600",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorBtn: {
    padding: 2,
  },
  similarWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  similarWarningText: {
    flex: 1,
    fontWeight: "500",
  },
  secondaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  secondaryToggleText: {
    fontWeight: "600",
  },
  openToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  openToggleText: {
    flex: 1,
  },
  saveBtn: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // Sustainable chip
  sustainableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  sustainableChipText: {
    fontWeight: "500",
  },
  // Tags
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  tagAddBtn: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagChipText: {
    fontWeight: "500",
  },
  // Notes
  notesInput: {
    height: 80,
    paddingTop: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontWeight: "700",
  },
  // Colour Picker Modal
  colorPickerContent: {
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
    fontWeight: "700",
  },
  pickerHex: {},
  wheelWrap: {
    marginBottom: 20,
  },
  hslSection: {
    alignSelf: "stretch",
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
    textAlign: "right",
  },
  resetHslBtn: {
    alignItems: "center",
    marginTop: 4,
  },
  resetHslText: {
    fontWeight: "600",
  },
  doneBtn: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
    paddingTop: 54,
  },
  imageViewerTitle: {
    color: "#FFFFFF",
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
  },
  imageViewerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  imageViewerBtnText: {
    fontWeight: "600",
  },
});

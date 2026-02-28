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
  ActivityIndicator,
  Linking,
} from "react-native";
import { fetchProductFromUrl } from "@/services/productSearch";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { ColorWheelPicker } from "@/components/ColorWheelPicker";
import { ImageColorDropper } from "@/components/ImageColorDropper";
import { ImageCropper } from "@/components/ImageCropper";
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
  ArchiveReason,
  HardwareColour,
  ItemFlag,
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
} from "@/models/types";

const ARCHIVE_REASONS: ArchiveReason[] = ["donated", "sold", "worn_out", "given_away"];

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const subcats = SUBCATEGORIES[category];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
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
                <Ionicons name="close-circle" size={22} color={Theme.colors.error} />
              </Pressable>
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Main</Text>
                </View>
              )}
            </Pressable>
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
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, styles.urlInput]}
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="https://..."
            placeholderTextColor={Theme.colors.textLight}
            autoCapitalize="none"
            keyboardType="url"
          />
          {productUrl.trim().startsWith("http") && (
            <Pressable
              style={styles.refreshUrlBtn}
              onPress={() => Linking.openURL(productUrl.trim())}
            >
              <Ionicons name="open-outline" size={18} color={Theme.colors.textSecondary} />
            </Pressable>
          )}
          <Pressable
            style={[styles.refreshUrlBtn, refreshingUrl && { opacity: 0.6 }]}
            onPress={handleRefreshFromUrl}
            disabled={refreshingUrl}
          >
            {refreshingUrl ? (
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={Theme.colors.primary} />
            )}
          </Pressable>
        </View>

        {/* Cost */}
        <Text style={styles.sectionTitle}>Cost (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 49.99"
          placeholderTextColor={Theme.colors.textLight}
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
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

        {/* Open Top Toggle */}
        {(category === "tops" || category === "blazers") && subCategory && (
          <>
            <View style={styles.openTopRow}>
              <Text style={styles.sectionTitle}>Open Top (requires shirt under)</Text>
              <Pressable
                style={[
                  styles.openTopToggle,
                  (isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)) && styles.openTopToggleActive,
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
                    (isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory)) && styles.openTopToggleTextActive,
                  ]}
                >
                  {isOpen || ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) ? "Yes" : "No"}
                </Text>
              </Pressable>
            </View>
            {ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
              <Text style={styles.openTopHint}>
                {subcats.find((sc) => sc.value === subCategory)?.label ?? subCategory} items are always open
              </Text>
            )}
          </>
        )}

        {/* Colour */}
        <View style={styles.colorHeader}>
          <Text style={styles.sectionTitle}>
            Colour — {finalColorName}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {imageUris.length > 0 && (
              <Pressable
                style={styles.colorPickerBtn}
                onPress={() => {
                  setDropperTarget("primary");
                  setShowDropper(true);
                }}
              >
                <Ionicons name="eyedrop-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.colorPickerBtnText}>Dropper</Text>
              </Pressable>
            )}
            <Pressable style={styles.colorPickerBtn} onPress={openColorPicker}>
              <View style={[styles.colorPickerSwatch, { backgroundColor: finalColor }]} />
              <Ionicons name="color-palette-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.colorPickerBtnText}>Fine-tune</Text>
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
            <Ionicons name="refresh-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.revertBtnText}>Revert to original colour</Text>
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
            color={Theme.colors.primary}
          />
          <Text style={styles.secondaryToggleText}>
            {showSecondaryColor ? "Hide secondary colour" : "Add secondary colour (optional)"}
          </Text>
        </Pressable>

        {showSecondaryColor && (
          <>
            <View style={styles.colorHeader}>
              <Text style={styles.sectionTitle}>
                Secondary Colour{secondaryColorIdx !== null ? ` — ${PRESET_COLORS[secondaryColorIdx].name}` : ""}
              </Text>
              {imageUris.length > 0 && (
                <Pressable
                  style={styles.colorPickerBtn}
                  onPress={() => {
                    setDropperTarget("secondary");
                    setShowDropper(true);
                  }}
                >
                  <Ionicons name="eyedrop-outline" size={16} color={Theme.colors.primary} />
                  <Text style={styles.colorPickerBtnText}>Dropper</Text>
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

        {/* Hardware Colour */}
        {(HARDWARE_CATEGORIES.includes(category) ||
          (subCategory && HARDWARE_SUBCATEGORIES.includes(subCategory))) && (
          <>
            <Text style={styles.sectionTitle}>Hardware Colour</Text>
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

        {/* Item Flags */}
        <Text style={styles.sectionTitle}>Flags</Text>
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

        {/* Wear Count */}
        <Text style={styles.sectionTitle}>Wear Count</Text>
        <View style={styles.wearCountRow}>
          <Pressable
            style={[styles.wearCountBtn, wearCount <= 0 && { opacity: 0.3 }]}
            onPress={() => setWearCount(Math.max(0, wearCount - 1))}
            disabled={wearCount <= 0}
          >
            <Ionicons name="remove" size={20} color={Theme.colors.text} />
          </Pressable>
          <Text style={styles.wearCountValue}>
            {wearCount} wear{wearCount !== 1 ? "s" : ""}
          </Text>
          <Pressable
            style={styles.wearCountBtn}
            onPress={() => setWearCount(wearCount + 1)}
          >
            <Ionicons name="add" size={20} color={Theme.colors.text} />
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
                color={Theme.colors.primary}
              />
              <Text style={styles.wearDatesToggleText}>
                {showWearDates ? "Hide wear history" : `Show wear history (${wearDates.length})`}
              </Text>
            </Pressable>

            {showWearDates && (
              <View style={styles.wearDatesContainer}>
                {[...wearDates]
                  .map((d, i) => ({ date: d, originalIndex: i }))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map(({ date, originalIndex }) => (
                    <View key={`${date}-${originalIndex}`} style={styles.wearDateRow}>
                      <Text style={styles.wearDateText}>
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
                        <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
                      </Pressable>
                    </View>
                  ))}
                {wearDates.length > 10 && (
                  <Text style={styles.wearDatesMoreText}>
                    View all {wearDates.length} dates
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add any notes about this item..."
          placeholderTextColor={Theme.colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>

        {/* Archive Button */}
        <Pressable
          style={styles.archiveBtn}
          onPress={() => setShowArchiveModal(true)}
        >
          <Ionicons name="archive-outline" size={18} color={Theme.colors.warning} />
          <Text style={styles.archiveBtnText}>Archive Item</Text>
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
            <Text style={styles.modalTitle}>Fine-tune Colour</Text>
            <Pressable onPress={() => setShowColorPicker(false)}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.colorPickerContent}>
            <View style={styles.pickerPreview}>
              <View style={[styles.pickerSwatch, { backgroundColor: finalColor }]} />
              <View>
                <Text style={styles.pickerColorName}>{finalColorName}</Text>
                <Text style={styles.pickerHex}>{finalColor}</Text>
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
              style={styles.imageViewerBtn}
              onPress={() => viewingImageIdx !== null && recropImage(viewingImageIdx)}
            >
              <Ionicons name="crop-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.imageViewerBtnText}>Crop</Text>
            </Pressable>
            <Pressable
              style={styles.imageViewerBtn}
              onPress={() => {
                if (viewingImageIdx !== null) {
                  removeImage(viewingImageIdx);
                  setViewingImageIdx(null);
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color={Theme.colors.error} />
              <Text style={[styles.imageViewerBtnText, { color: Theme.colors.error }]}>Delete</Text>
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
  notesInput: {
    height: 90,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    textAlignVertical: "top",
  },
  revertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.sm,
    paddingVertical: 6,
  },
  revertBtnText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  wearCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  wearCountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  wearCountValue: {
    flex: 1,
    textAlign: "center",
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
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
  archiveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.md,
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
    marginTop: Theme.spacing.sm,
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
  // Image viewer modal
  imageViewerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imageViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 54,
    paddingBottom: Theme.spacing.md,
  },
  imageViewerTitle: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.md,
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
    gap: Theme.spacing.lg,
    paddingVertical: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  imageViewerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surface,
  },
  imageViewerBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  // URL refresh
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  urlInput: {
    flex: 1,
  },
  refreshUrlBtn: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.primary + "30",
  },
  // Wear date history
  wearDatesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Theme.spacing.sm,
    paddingVertical: 8,
  },
  wearDatesToggleText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.primary,
    fontWeight: "600",
  },
  wearDatesContainer: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: "hidden",
  },
  wearDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  wearDateText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
  },
  wearDatesMoreText: {
    textAlign: "center",
    paddingVertical: Theme.spacing.sm,
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.primary,
    fontWeight: "600",
  },
});

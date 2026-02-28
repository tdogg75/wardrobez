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
import { Theme } from "@/constants/theme";
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
} from "@/models/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default function AddItemScreen() {
  const router = useRouter();
  const { addOrUpdate } = useClothingItems();

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

  // Open top detection
  const [isOpen, setIsOpen] = useState(false);

  // Hardware colour
  const [hardwareColour, setHardwareColour] = useState<HardwareColour | undefined>(undefined);

  // Item flags
  const [itemFlags, setItemFlags] = useState<ItemFlag[]>([]);

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
      favorite: false,
      wearCount: 0,
      archived: false,
      createdAt: Date.now(),
      isOpen,
      hardwareColour,
      notes: notes.trim() || undefined,
      originalAutoColor,
      itemFlags: itemFlags.length > 0 ? itemFlags : undefined,
    });

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

        {/* Name */}
        <Text style={styles.sectionTitle}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Blue Oxford Shirt"
          placeholderTextColor={Theme.colors.textLight}
          value={name}
          onChangeText={setName}
        />

        {/* Brand */}
        <Text style={styles.sectionTitle}>Brand (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Uniqlo"
          placeholderTextColor={Theme.colors.textLight}
          value={brand}
          onChangeText={setBrand}
        />

        {/* Product URL */}
        <Text style={styles.sectionTitle}>Product URL (optional)</Text>
        <Text style={styles.urlHint}>Paste a product link from your browser to auto-fill details</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="https://..."
            placeholderTextColor={Theme.colors.textLight}
            value={productUrl}
            onChangeText={setProductUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Pressable
            style={[styles.urlFetchBtn, fetchingUrl && styles.autoFillBtnDisabled]}
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
                setIsOpen(false);
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
                  onPress={() => {
                    const newSub = subCategory === sc.value ? undefined : sc.value;
                    setSubCategory(newSub);
                    if (newSub && ALWAYS_OPEN_SUBCATEGORIES.includes(newSub)) {
                      setIsOpen(true);
                    } else {
                      setIsOpen(false);
                    }
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* Open Top Detection */}
        {(category === "tops" || category === "blazers") && subCategory && !ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
          <Pressable
            style={styles.openToggle}
            onPress={() => setIsOpen(!isOpen)}
          >
            <Ionicons
              name={isOpen ? "checkbox" : "square-outline"}
              size={22}
              color={isOpen ? Theme.colors.primary : Theme.colors.textLight}
            />
            <Text style={styles.openToggleText}>
              Does this top require a shirt underneath?
            </Text>
          </Pressable>
        )}
        {(category === "tops" || category === "blazers") && subCategory && ALWAYS_OPEN_SUBCATEGORIES.includes(subCategory) && (
          <View style={styles.openToggle}>
            <Ionicons name="checkbox" size={22} color={Theme.colors.primary} />
            <Text style={styles.openToggleText}>
              This item requires a shirt underneath (always open)
            </Text>
          </View>
        )}

        {/* Primary Colour */}
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
            {originalAutoColor && (
              <Pressable style={styles.colorPickerBtn} onPress={handleRevertToOriginalColor}>
                <Ionicons name="refresh-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.colorPickerBtnText}>Revert to original colour</Text>
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
        {(HARDWARE_CATEGORIES.includes(category) || (subCategory && HARDWARE_SUBCATEGORIES.includes(subCategory))) && (
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
        <Text style={styles.sectionTitle}>Flags — Watch Out For</Text>
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

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any additional notes about this item..."
          placeholderTextColor={Theme.colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Save Button */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Add to Wardrobe</Text>
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

            {/* Done button */}
            <Pressable
              style={styles.doneBtn}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
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
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },
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
  urlRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  urlFetchBtn: {
    width: 48,
    height: 48,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  urlHint: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    marginBottom: Theme.spacing.sm,
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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorBtn: {
    padding: 2,
  },
  // Secondary Colour
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
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
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
  // Colour Picker Modal
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
});

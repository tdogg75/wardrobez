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
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { Theme } from "@/constants/theme";
import {
  PRESET_COLORS,
  hexToHSL,
  hslToHex,
  getColorName,
  findClosestPresetIndex,
} from "@/constants/colors";
import {
  searchProductsOnline,
  fetchProductFromUrl,
  type OnlineProductOption,
} from "@/services/productSearch";
import type {
  ClothingCategory,
  Occasion,
  FabricType,
} from "@/models/types";
import {
  CATEGORY_LABELS,
  SUBCATEGORIES,
  OCCASION_LABELS,
  FABRIC_TYPE_LABELS,
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
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [fabricType, setFabricType] = useState<FabricType>("cotton");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // HSL fine-tuning
  const [hslAdjust, setHslAdjust] = useState<{ h: number; s: number; l: number } | null>(null);

  // Secondary color
  const [secondaryColorIdx, setSecondaryColorIdx] = useState<number | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);

  // Product search results state
  const [searchResults, setSearchResults] = useState<OnlineProductOption[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);

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

  const toggleOccasion = (o: Occasion) =>
    setOccasions((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
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
    // Reset HSL adjustment when picking a new preset
    const preset = PRESET_COLORS[idx];
    setHslAdjust({ h: preset.hue, s: preset.saturation, l: preset.lightness });
  };

  const handleSearchOnline = async () => {
    if (!name.trim()) {
      Alert.alert("Enter a name", "Please enter the item name first so we can search for it.");
      return;
    }
    setSearching(true);
    try {
      const results = await searchProductsOnline(name.trim(), brand.trim() || undefined);
      if (results.length > 0) {
        setSearchResults(results);
        setShowSearchModal(true);
      } else {
        Alert.alert("No results", "We couldn't find any matching products. Please fill in manually.");
      }
    } catch {
      Alert.alert("Search failed", "Something went wrong. Please fill in manually.");
    } finally {
      setSearching(false);
    }
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

  const handleSelectProduct = (product: OnlineProductOption) => {
    if (product.category) setCategory(product.category);
    if (product.subCategory) setSubCategory(product.subCategory);
    if (product.fabricType) setFabricType(product.fabricType);

    const cIdx = findClosestPresetIndex(product.color);
    setColorIdx(cIdx);
    const preset = PRESET_COLORS[cIdx];
    setHslAdjust({ h: preset.hue, s: preset.saturation, l: preset.lightness });

    // Bring in online image
    if (product.imageUri) {
      setImageUris((prev) => [product.imageUri!, ...prev]);
    }

    setShowSearchModal(false);
    Alert.alert("Applied!", `Details from ${product.store} have been applied. Review and adjust as needed.`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name for this item.");
      return;
    }

    await addOrUpdate({
      id: generateId(),
      name: name.trim(),
      category,
      subCategory,
      color: finalColor,
      colorName: finalColorName,
      secondaryColor,
      secondaryColorName,
      occasions,
      fabricType,
      imageUris,
      brand: brand.trim() || undefined,
      productUrl: productUrl.trim() || undefined,
      favorite: false,
      createdAt: Date.now(),
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

        {/* Search Online Button */}
        <Pressable
          style={[styles.autoFillBtn, searching && styles.autoFillBtnDisabled]}
          onPress={handleSearchOnline}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          ) : (
            <Ionicons name="globe-outline" size={18} color={Theme.colors.primary} />
          )}
          <Text style={styles.autoFillBtnText}>
            {searching ? "Searching..." : "Search Online"}
          </Text>
        </Pressable>

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

        {/* Primary Color */}
        <Text style={styles.sectionTitle}>
          Color — {finalColorName}
        </Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c, i) => (
            <Pressable key={c.hex + i} onPress={() => handleSelectPresetColor(i)} style={styles.colorBtn}>
              <ColorDot color={c.hex} size={36} selected={colorIdx === i && !hslAdjust} />
            </Pressable>
          ))}
        </View>

        {/* HSL Fine-Tuning */}
        {hslAdjust && (
          <View style={styles.hslSection}>
            <View style={styles.hslPreview}>
              <View style={[styles.hslSwatch, { backgroundColor: finalColor }]} />
              <Text style={styles.hslLabel}>{finalColorName} ({finalColor})</Text>
            </View>
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

        {/* Occasion */}
        <Text style={styles.sectionTitle}>Occasions (optional)</Text>
        <View style={styles.chipRow}>
          {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
            <Chip
              key={o}
              label={OCCASION_LABELS[o]}
              selected={occasions.includes(o)}
              onPress={() => toggleOccasion(o)}
            />
          ))}
        </View>

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

        {/* Save Button */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Add to Wardrobe</Text>
        </Pressable>
      </ScrollView>

      {/* Product Search Results Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Match</Text>
            <Pressable onPress={() => setShowSearchModal(false)}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>
            Choose the product that best matches your item, or tap "None of these" below.
          </Text>

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            renderItem={({ item: product }) => (
              <Pressable
                style={styles.resultCard}
                onPress={() => handleSelectProduct(product)}
              >
                <View style={[styles.resultImage, { backgroundColor: product.color + "30" }]}>
                  {product.imageUri ? (
                    <Image source={{ uri: product.imageUri }} style={styles.resultImg} />
                  ) : (
                    <View style={styles.resultColorPlaceholder}>
                      <View style={[styles.resultColorSwatch, { backgroundColor: product.color }]} />
                      <Ionicons name="shirt-outline" size={32} color={product.color} />
                    </View>
                  )}
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.resultStore}>{product.store}</Text>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultPrice}>{product.price}</Text>
                    <View style={styles.resultColorDot}>
                      <ColorDot color={product.color} size={16} />
                      <Text style={styles.resultColorName}>{product.colorName}</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.textLight} />
              </Pressable>
            )}
          />

          <Pressable
            style={styles.noneBtn}
            onPress={() => setShowSearchModal(false)}
          >
            <Text style={styles.noneBtnText}>None of these</Text>
          </Pressable>
        </View>
      </Modal>
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
  autoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Theme.spacing.md,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.primary + "12",
    borderWidth: 1,
    borderColor: Theme.colors.primary + "30",
  },
  autoFillBtnDisabled: {
    opacity: 0.6,
  },
  autoFillBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.primary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorBtn: {
    padding: 2,
  },
  // HSL Fine-Tuning
  hslSection: {
    marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  hslPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  hslSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  hslLabel: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.text,
    fontWeight: "600",
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
  modalSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  resultsList: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  resultImage: {
    width: 72,
    height: 90,
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
  },
  resultImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  resultColorPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  resultColorSwatch: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  resultInfo: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  resultName: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.text,
    marginBottom: 2,
  },
  resultStore: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.primary,
    fontWeight: "500",
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultPrice: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  resultColorDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultColorName: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
  },
  noneBtn: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
  },
  noneBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
});

import React, { useState } from "react";
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
import { PRESET_COLORS } from "@/constants/colors";
import {
  searchProductsOnline,
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
  const [searching, setSearching] = useState(false);

  // Product search results state
  const [searchResults, setSearchResults] = useState<OnlineProductOption[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);

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

  const handleSelectProduct = (product: OnlineProductOption) => {
    // Apply product attributes
    if (product.category) setCategory(product.category);
    if (product.subCategory) setSubCategory(product.subCategory);
    if (product.fabricType) setFabricType(product.fabricType);

    // Find closest color in presets
    const colorIdx = PRESET_COLORS.findIndex((c) => c.hex === product.color);
    if (colorIdx >= 0) setColorIdx(colorIdx);

    setShowSearchModal(false);
    Alert.alert("Applied!", `Details from ${product.store} have been applied. Review and adjust as needed.`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name for this item.");
      return;
    }
    if (occasions.length === 0) {
      Alert.alert("Missing occasion", "Please select at least one occasion.");
      return;
    }

    const color = PRESET_COLORS[colorIdx];
    await addOrUpdate({
      id: generateId(),
      name: name.trim(),
      category,
      subCategory,
      color: color.hex,
      colorName: color.name,
      occasions,
      fabricType,
      imageUris,
      brand: brand.trim() || undefined,
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

        {/* Color */}
        <Text style={styles.sectionTitle}>
          Color — {PRESET_COLORS[colorIdx].name}
        </Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c, i) => (
            <Pressable key={c.hex} onPress={() => setColorIdx(i)} style={styles.colorBtn}>
              <ColorDot color={c.hex} size={36} selected={colorIdx === i} />
            </Pressable>
          ))}
        </View>

        {/* Occasion */}
        <Text style={styles.sectionTitle}>Occasions</Text>
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

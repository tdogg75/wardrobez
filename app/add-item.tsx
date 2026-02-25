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
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { Theme } from "@/constants/theme";
import { PRESET_COLORS } from "@/constants/colors";
import { searchProduct } from "@/services/productSearch";
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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [searching, setSearching] = useState(false);

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
      setImageUri(result.assets[0].uri);
    }
  };

  const handleAutoFill = async () => {
    if (!name.trim()) {
      Alert.alert("Enter a name", "Please enter the item name first so we can search for it.");
      return;
    }
    setSearching(true);
    try {
      const result = await searchProduct(name.trim(), brand.trim() || undefined);
      if (result) {
        if (result.category) setCategory(result.category);
        if (result.subCategory) setSubCategory(result.subCategory);
        if (result.colorIndex !== undefined) setColorIdx(result.colorIndex);
        if (result.fabricType) setFabricType(result.fabricType);
        Alert.alert("Auto-filled!", "We found some info and filled in the details. Review and adjust as needed.");
      } else {
        Alert.alert("No results", "We couldn't find details for this item. Please fill in manually.");
      }
    } catch {
      Alert.alert("Search failed", "Something went wrong. Please fill in manually.");
    } finally {
      setSearching(false);
    }
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
      imageUri,
      brand: brand.trim() || undefined,
      favorite: false,
      createdAt: Date.now(),
    });

    router.back();
  };

  const subcats = SUBCATEGORIES[category];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Photo */}
      <Pressable style={styles.photoBtn} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={36} color={Theme.colors.textLight} />
            <Text style={styles.photoLabel}>Add Photo</Text>
          </View>
        )}
      </Pressable>

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

      {/* Auto-fill Button */}
      <Pressable
        style={[styles.autoFillBtn, searching && styles.autoFillBtnDisabled]}
        onPress={handleAutoFill}
        disabled={searching}
      >
        {searching ? (
          <ActivityIndicator size="small" color={Theme.colors.primary} />
        ) : (
          <Ionicons name="search-outline" size={18} color={Theme.colors.primary} />
        )}
        <Text style={styles.autoFillBtnText}>
          {searching ? "Searching..." : "Auto-fill from Web"}
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
  photoBtn: {
    height: 200,
    borderRadius: Theme.borderRadius.lg,
    overflow: "hidden",
    marginBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.surfaceAlt,
  },
  photo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoLabel: {
    marginTop: 8,
    fontSize: Theme.fontSize.sm,
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
});

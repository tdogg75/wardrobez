import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { Chip } from "@/components/Chip";
import { ColorDot } from "@/components/ColorDot";
import { Theme } from "@/constants/theme";
import { PRESET_COLORS } from "@/constants/colors";
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

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, addOrUpdate, remove } = useClothingItems();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory>("tops");
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);
  const [colorIdx, setColorIdx] = useState(0);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [fabricType, setFabricType] = useState<FabricType>("cotton");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [createdAt, setCreatedAt] = useState(Date.now());

  useEffect(() => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setSubCategory(item.subCategory);
    const cIdx = PRESET_COLORS.findIndex((c) => c.hex === item.color);
    setColorIdx(cIdx >= 0 ? cIdx : 0);
    setOccasions(item.occasions);
    setFabricType(item.fabricType);
    setImageUri(item.imageUri);
    setBrand(item.brand ?? "");
    setFavorite(item.favorite);
    setCreatedAt(item.createdAt);
  }, [id, items]);

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

  const handleSave = async () => {
    if (!name.trim() || !id) return;
    const color = PRESET_COLORS[colorIdx];
    await addOrUpdate({
      id,
      name: name.trim(),
      category,
      subCategory,
      color: color.hex,
      colorName: color.name,
      occasions,
      fabricType,
      imageUri,
      brand: brand.trim() || undefined,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Photo */}
      <Pressable style={styles.photoBtn} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={36} color={Theme.colors.textLight} />
            <Text style={styles.photoLabel}>Change Photo</Text>
          </View>
        )}
      </Pressable>

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

      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Changes</Text>
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
        <Text style={styles.deleteBtnText}>Delete Item</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.md, paddingBottom: Theme.spacing.xxl },
  photoBtn: {
    height: 200,
    borderRadius: Theme.borderRadius.lg,
    overflow: "hidden",
    marginBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.surfaceAlt,
  },
  photo: { width: "100%", height: "100%", resizeMode: "cover" },
  photoPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  photoLabel: { marginTop: 8, fontSize: Theme.fontSize.sm, color: Theme.colors.textLight },
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
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorBtn: { padding: 2 },
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
});

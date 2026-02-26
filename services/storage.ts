import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClothingItem, Outfit, FabricType } from "@/models/types";

const KEYS = {
  CLOTHING_ITEMS: "wardrobez:clothing_items",
  OUTFITS: "wardrobez:outfits",
} as const;

// --- Data Migration ---

const WEIGHT_TO_FABRIC: Record<string, FabricType> = {
  light: "cotton",
  medium: "polyester",
  heavy: "wool",
};

function migrateClothingItem(item: any): ClothingItem {
  const migrated = { ...item };

  // Migrate fabricWeight -> fabricType
  if (!migrated.fabricType && migrated.fabricWeight) {
    migrated.fabricType = WEIGHT_TO_FABRIC[migrated.fabricWeight] ?? "other";
    delete migrated.fabricWeight;
  }

  // Remove seasons if present
  delete migrated.seasons;

  // Migrate imageUri (string | null) -> imageUris (string[])
  if (migrated.imageUri !== undefined && migrated.imageUris === undefined) {
    migrated.imageUris = migrated.imageUri ? [migrated.imageUri] : [];
    delete migrated.imageUri;
  }

  // Ensure imageUris is always an array
  if (!Array.isArray(migrated.imageUris)) {
    migrated.imageUris = [];
  }

  return migrated as ClothingItem;
}

function migrateOutfit(outfit: any): Outfit {
  const migrated = { ...outfit };
  delete migrated.seasons;
  return migrated as Outfit;
}

// --- Clothing Items ---

export async function getClothingItems(): Promise<ClothingItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.CLOTHING_ITEMS);
  if (!raw) return [];
  const items = JSON.parse(raw) as any[];
  return items.map(migrateClothingItem);
}

export async function saveClothingItem(item: ClothingItem): Promise<void> {
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  await AsyncStorage.setItem(KEYS.CLOTHING_ITEMS, JSON.stringify(items));
}

export async function deleteClothingItem(id: string): Promise<void> {
  const items = await getClothingItems();
  const filtered = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(KEYS.CLOTHING_ITEMS, JSON.stringify(filtered));

  // Also remove from any outfits
  const outfits = await getOutfits();
  const updated = outfits.map((o) => ({
    ...o,
    itemIds: o.itemIds.filter((itemId) => itemId !== id),
  }));
  await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(updated));
}

// --- Outfits ---

export async function getOutfits(): Promise<Outfit[]> {
  const raw = await AsyncStorage.getItem(KEYS.OUTFITS);
  if (!raw) return [];
  const outfits = JSON.parse(raw) as any[];
  return outfits.map(migrateOutfit);
}

export async function saveOutfit(outfit: Outfit): Promise<void> {
  const outfits = await getOutfits();
  const idx = outfits.findIndex((o) => o.id === outfit.id);
  if (idx >= 0) {
    outfits[idx] = outfit;
  } else {
    outfits.push(outfit);
  }
  await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(outfits));
}

export async function deleteOutfit(id: string): Promise<void> {
  const outfits = await getOutfits();
  const filtered = outfits.filter((o) => o.id !== id);
  await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(filtered));
}

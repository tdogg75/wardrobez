import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClothingItem, Outfit, FabricType, ArchiveReason } from "@/models/types";

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

// Jewelry subcategories that should be migrated from accessories to jewelry
const JEWELRY_SUBCATEGORIES = new Set([
  "watches",
  "earrings",
  "necklaces",
  "bracelets",
  "rings",
]);

function migrateClothingItem(item: any): ClothingItem {
  const migrated = { ...item };

  // Migrate fabricWeight -> fabricType
  if (!migrated.fabricType && migrated.fabricWeight) {
    migrated.fabricType = WEIGHT_TO_FABRIC[migrated.fabricWeight] ?? "other";
    delete migrated.fabricWeight;
  }

  // Migrate imageUri (string | null) -> imageUris (string[])
  if (migrated.imageUri !== undefined && migrated.imageUris === undefined) {
    migrated.imageUris = migrated.imageUri ? [migrated.imageUri] : [];
    delete migrated.imageUri;
  }

  // Ensure imageUris is always an array
  if (!Array.isArray(migrated.imageUris)) {
    migrated.imageUris = [];
  }

  // Migrate outerwear -> jackets
  if (migrated.category === "outerwear") {
    migrated.category = "jackets";
  }

  // Migrate blazer subcategory under tops -> blazers category
  if (migrated.category === "tops" && migrated.subCategory === "blazer") {
    migrated.category = "blazers";
    migrated.subCategory = "casual_blazer";
  }

  // Migrate jewelry subcategories from accessories to jewelry category
  if (
    migrated.category === "accessories" &&
    migrated.subCategory &&
    JEWELRY_SUBCATEGORIES.has(migrated.subCategory)
  ) {
    migrated.category = "jewelry";
  }

  // Remove occasions from clothing items (legacy field)
  // Keep the field but don't require it
  if (Array.isArray(migrated.occasions)) {
    migrated.occasions = migrated.occasions
      .map((o: string) => {
        if (o === "formal") return "fancy";
        if (o === "date_night") return "party";
        if (o === "athletic" || o === "outdoor") return "casual";
        return o;
      })
      .filter((o: string, i: number, arr: string[]) => arr.indexOf(o) === i);
  }

  // Default new fields
  if (typeof migrated.wearCount !== "number") {
    migrated.wearCount = 0;
  }
  if (typeof migrated.archived !== "boolean") {
    migrated.archived = false;
  }

  return migrated as ClothingItem;
}

function migrateOutfit(outfit: any): Outfit {
  const migrated = { ...outfit };
  // Ensure seasons array exists
  if (!Array.isArray(migrated.seasons)) {
    migrated.seasons = [];
  }
  // Ensure occasions array exists
  if (!Array.isArray(migrated.occasions)) {
    migrated.occasions = [];
  }
  // Ensure wornDates array exists
  if (!Array.isArray(migrated.wornDates)) {
    migrated.wornDates = [];
  }
  // Ensure hasRemovedItems defaults to false
  if (typeof migrated.hasRemovedItems !== "boolean") {
    migrated.hasRemovedItems = false;
  }
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

// --- Archived Items ---

export async function getArchivedItems(): Promise<ClothingItem[]> {
  const items = await getClothingItems();
  return items.filter((i) => i.archived);
}

export async function archiveItem(
  id: string,
  reason: ArchiveReason
): Promise<void> {
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;

  items[idx] = {
    ...items[idx],
    archived: true,
    archiveReason: reason,
    archivedAt: Date.now(),
  };
  await AsyncStorage.setItem(KEYS.CLOTHING_ITEMS, JSON.stringify(items));

  // Mark affected outfits that contain this item
  const outfits = await getOutfits();
  let outfitsChanged = false;
  const updatedOutfits = outfits.map((o) => {
    if (o.itemIds.includes(id)) {
      outfitsChanged = true;
      return { ...o, hasRemovedItems: true };
    }
    return o;
  });
  if (outfitsChanged) {
    await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(updatedOutfits));
  }
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

// --- Wear Logging ---

export async function logOutfitWorn(outfitId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Add today's date to the outfit's wornDates
  const outfits = await getOutfits();
  const outfitIdx = outfits.findIndex((o) => o.id === outfitId);
  if (outfitIdx < 0) return;

  const outfit = outfits[outfitIdx];
  outfits[outfitIdx] = {
    ...outfit,
    wornDates: [...outfit.wornDates, today],
  };
  await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(outfits));

  // Increment wearCount on all items in the outfit
  const items = await getClothingItems();
  let itemsChanged = false;
  const updatedItems = items.map((item) => {
    if (outfit.itemIds.includes(item.id)) {
      itemsChanged = true;
      return { ...item, wearCount: item.wearCount + 1 };
    }
    return item;
  });
  if (itemsChanged) {
    await AsyncStorage.setItem(KEYS.CLOTHING_ITEMS, JSON.stringify(updatedItems));
  }
}

export async function getWearLog(): Promise<Outfit[]> {
  const outfits = await getOutfits();
  return outfits.filter((o) => o.wornDates.length > 0);
}

export async function markOutfitNotified(outfitId: string): Promise<void> {
  const outfits = await getOutfits();
  const idx = outfits.findIndex((o) => o.id === outfitId);
  if (idx < 0) return;

  outfits[idx] = {
    ...outfits[idx],
    removedItemNotified: true,
  };
  await AsyncStorage.setItem(KEYS.OUTFITS, JSON.stringify(outfits));
}

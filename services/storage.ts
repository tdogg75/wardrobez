import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClothingItem, Outfit, FabricType, ArchiveReason, WishlistItem } from "@/models/types";

// --- File-System Storage Layer ---
// Data is persisted as JSON files in the app's document directory.
// This ensures wardrobe data is saved directly to device storage and
// survives app updates. AsyncStorage is used only as a migration source.

const DATA_DIR = `${FileSystem.documentDirectory}wardrobez-data/`;
const FILES = {
  CLOTHING_ITEMS: `${DATA_DIR}clothing-items.json`,
  OUTFITS: `${DATA_DIR}outfits.json`,
  WISHLIST: `${DATA_DIR}wishlist.json`,
} as const;

// Legacy AsyncStorage keys for one-time migration
const LEGACY_KEYS = {
  CLOTHING_ITEMS: "wardrobez:clothing_items",
  OUTFITS: "wardrobez:outfits",
} as const;

let initialized = false;

async function ensureDataDir(): Promise<void> {
  if (initialized) return;
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
  initialized = true;
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    await ensureDataDir();
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
}

/**
 * One-time migration from AsyncStorage to file-system storage.
 * Checks if data exists in AsyncStorage but not yet in the file system,
 * and copies it over. After migration, AsyncStorage data is left intact
 * as a safety net but will no longer be read.
 */
async function migrateFromAsyncStorage(): Promise<void> {
  try {
    // Only migrate if file-system files don't exist yet
    const itemsInfo = await FileSystem.getInfoAsync(FILES.CLOTHING_ITEMS);
    const outfitsInfo = await FileSystem.getInfoAsync(FILES.OUTFITS);

    if (itemsInfo.exists && outfitsInfo.exists) return; // Already migrated

    // Read from AsyncStorage
    const rawItems = await AsyncStorage.getItem(LEGACY_KEYS.CLOTHING_ITEMS);
    const rawOutfits = await AsyncStorage.getItem(LEGACY_KEYS.OUTFITS);

    if (!itemsInfo.exists && rawItems) {
      await writeJsonFile(FILES.CLOTHING_ITEMS, JSON.parse(rawItems));
    }
    if (!outfitsInfo.exists && rawOutfits) {
      await writeJsonFile(FILES.OUTFITS, JSON.parse(rawOutfits));
    }
  } catch {
    // Migration failure is non-fatal — data will be created fresh
  }
}

// Run migration on first import
let migrationPromise: Promise<void> | null = null;
function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromAsyncStorage();
  }
  return migrationPromise;
}

// --- Data Migration ---

const WEIGHT_TO_FABRIC: Record<string, FabricType> = {
  light: "cotton",
  medium: "polyester",
  heavy: "wool",
};

const JEWELRY_SUBCATEGORIES = new Set([
  "watches",
  "earrings",
  "necklaces",
  "bracelets",
  "rings",
]);

function migrateClothingItem(item: any): ClothingItem {
  const migrated = { ...item };

  if (!migrated.fabricType && migrated.fabricWeight) {
    migrated.fabricType = WEIGHT_TO_FABRIC[migrated.fabricWeight] ?? "other";
    delete migrated.fabricWeight;
  }

  if (migrated.imageUri !== undefined && migrated.imageUris === undefined) {
    migrated.imageUris = migrated.imageUri ? [migrated.imageUri] : [];
    delete migrated.imageUri;
  }

  if (!Array.isArray(migrated.imageUris)) {
    migrated.imageUris = [];
  }

  if (migrated.category === "outerwear") {
    migrated.category = "jackets";
  }

  if (migrated.category === "tops" && migrated.subCategory === "blazer") {
    migrated.category = "blazers";
    migrated.subCategory = "casual_blazer";
  }

  if (
    migrated.category === "accessories" &&
    migrated.subCategory &&
    JEWELRY_SUBCATEGORIES.has(migrated.subCategory)
  ) {
    migrated.category = "jewelry";
  }

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

  if (typeof migrated.wearCount !== "number") {
    migrated.wearCount = 0;
  }
  if (typeof migrated.archived !== "boolean") {
    migrated.archived = false;
  }
  if (!Array.isArray(migrated.itemFlags)) {
    migrated.itemFlags = migrated.itemFlags ?? [];
  }
  if (!Array.isArray(migrated.wearDates)) {
    migrated.wearDates = migrated.wearDates ?? [];
  }

  return migrated as ClothingItem;
}

function migrateOutfit(outfit: any): Outfit {
  const migrated = { ...outfit };
  if (!Array.isArray(migrated.seasons)) migrated.seasons = [];
  if (!Array.isArray(migrated.occasions)) migrated.occasions = [];
  if (!Array.isArray(migrated.wornDates)) migrated.wornDates = [];
  if (typeof migrated.hasRemovedItems !== "boolean") migrated.hasRemovedItems = false;
  if (!Array.isArray(migrated.tags)) migrated.tags = [];
  return migrated as Outfit;
}

// --- Clothing Items ---

export async function getClothingItems(): Promise<ClothingItem[]> {
  await ensureMigrated();
  const data = await readJsonFile<any[]>(FILES.CLOTHING_ITEMS);
  if (!data) return [];
  return data.map(migrateClothingItem);
}

export async function saveClothingItem(item: ClothingItem): Promise<void> {
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  await writeJsonFile(FILES.CLOTHING_ITEMS, items);
}

export async function deleteClothingItem(id: string): Promise<void> {
  const items = await getClothingItems();
  const filtered = items.filter((i) => i.id !== id);
  await writeJsonFile(FILES.CLOTHING_ITEMS, filtered);

  const outfits = await getOutfits();
  const updated = outfits.map((o) => {
    if (o.itemIds.includes(id)) {
      return {
        ...o,
        itemIds: o.itemIds.filter((itemId) => itemId !== id),
        hasRemovedItems: true,
        removedItemNotified: false,
      };
    }
    return o;
  });
  await writeJsonFile(FILES.OUTFITS, updated);
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
  await writeJsonFile(FILES.CLOTHING_ITEMS, items);

  const outfits = await getOutfits();
  let outfitsChanged = false;
  const updatedOutfits = outfits.map((o) => {
    if (o.itemIds.includes(id)) {
      outfitsChanged = true;
      return { ...o, hasRemovedItems: true, removedItemNotified: false };
    }
    return o;
  });
  if (outfitsChanged) {
    await writeJsonFile(FILES.OUTFITS, updatedOutfits);
  }
}

export async function unarchiveItem(id: string): Promise<void> {
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;

  items[idx] = {
    ...items[idx],
    archived: false,
    archiveReason: undefined,
    archivedAt: undefined,
  };
  await writeJsonFile(FILES.CLOTHING_ITEMS, items);

  const outfits = await getOutfits();
  let outfitsChanged = false;
  const updatedOutfits = outfits.map((o) => {
    if (o.itemIds.includes(id) && o.hasRemovedItems) {
      const allActive = o.itemIds.every((itemId) => {
        const item = items.find((i) => i.id === itemId);
        return item && !item.archived;
      });
      if (allActive) {
        outfitsChanged = true;
        return { ...o, hasRemovedItems: false, removedItemNotified: false };
      }
    }
    return o;
  });
  if (outfitsChanged) {
    await writeJsonFile(FILES.OUTFITS, updatedOutfits);
  }
}

// --- Outfits ---

export async function getOutfits(): Promise<Outfit[]> {
  await ensureMigrated();
  const data = await readJsonFile<any[]>(FILES.OUTFITS);
  if (!data) return [];
  return data.map(migrateOutfit);
}

export async function saveOutfit(outfit: Outfit): Promise<void> {
  const outfits = await getOutfits();
  const idx = outfits.findIndex((o) => o.id === outfit.id);
  if (idx >= 0) {
    outfits[idx] = outfit;
  } else {
    outfits.push(outfit);
  }
  await writeJsonFile(FILES.OUTFITS, outfits);
}

export async function deleteOutfit(id: string): Promise<void> {
  const outfits = await getOutfits();
  const filtered = outfits.filter((o) => o.id !== id);
  await writeJsonFile(FILES.OUTFITS, filtered);
}

// --- Wear Logging ---

export async function logOutfitWorn(
  outfitId: string,
  selfieUri?: string,
  note?: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const outfits = await getOutfits();
  const outfitIdx = outfits.findIndex((o) => o.id === outfitId);
  if (outfitIdx < 0) return;

  const outfit = outfits[outfitIdx];
  const wornEntries = [...(outfit.wornEntries ?? [])];
  if (selfieUri || note) {
    wornEntries.push({ date: today, selfieUri, note });
  }
  outfits[outfitIdx] = {
    ...outfit,
    wornDates: [...outfit.wornDates, today],
    wornEntries,
  };
  await writeJsonFile(FILES.OUTFITS, outfits);

  const items = await getClothingItems();
  let itemsChanged = false;
  const updatedItems = items.map((item) => {
    if (outfit.itemIds.includes(item.id)) {
      itemsChanged = true;
      return {
        ...item,
        wearCount: item.wearCount + 1,
        wearDates: [...(item.wearDates ?? []), today],
      };
    }
    return item;
  });
  if (itemsChanged) {
    await writeJsonFile(FILES.CLOTHING_ITEMS, updatedItems);
  }
}

/** Log a standalone wear for a single item (not part of an outfit) */
export async function logItemWorn(itemId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  items[idx] = {
    ...items[idx],
    wearCount: items[idx].wearCount + 1,
    wearDates: [...(items[idx].wearDates ?? []), today],
  };
  await writeJsonFile(FILES.CLOTHING_ITEMS, items);
}

/** Remove a wear date from an item's wearDates array */
export async function removeItemWornDate(
  itemId: string,
  dateIndex: number,
): Promise<void> {
  const items = await getClothingItems();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const newDates = [...(items[idx].wearDates ?? [])];
  newDates.splice(dateIndex, 1);
  items[idx] = {
    ...items[idx],
    wearCount: Math.max(0, items[idx].wearCount - 1),
    wearDates: newDates,
  };
  await writeJsonFile(FILES.CLOTHING_ITEMS, items);
}

export async function removeWornDate(
  outfitId: string,
  dateIndex: number
): Promise<void> {
  const outfits = await getOutfits();
  const outfitIdx = outfits.findIndex((o) => o.id === outfitId);
  if (outfitIdx < 0) return;

  const outfit = outfits[outfitIdx];
  const newDates = [...outfit.wornDates];
  newDates.splice(dateIndex, 1);

  outfits[outfitIdx] = {
    ...outfit,
    wornDates: newDates,
  };
  await writeJsonFile(FILES.OUTFITS, outfits);

  // Also remove the corresponding date from each item's wearDates
  const removedDate = outfit.wornDates[dateIndex];
  const items = await getClothingItems();
  let itemsChanged = false;
  const updatedItems = items.map((item) => {
    if (outfit.itemIds.includes(item.id) && item.wearCount > 0) {
      itemsChanged = true;
      const itemDates = [...(item.wearDates ?? [])];
      // Remove the first matching date entry
      const dateIdx = itemDates.indexOf(removedDate);
      if (dateIdx >= 0) itemDates.splice(dateIdx, 1);
      return { ...item, wearCount: Math.max(0, item.wearCount - 1), wearDates: itemDates };
    }
    return item;
  });
  if (itemsChanged) {
    await writeJsonFile(FILES.CLOTHING_ITEMS, updatedItems);
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
  await writeJsonFile(FILES.OUTFITS, outfits);
}

// --- Wishlist ---

export async function getWishlistItems(): Promise<WishlistItem[]> {
  await ensureMigrated();
  const data = await readJsonFile<WishlistItem[]>(FILES.WISHLIST);
  return data ?? [];
}

export async function saveWishlistItem(item: WishlistItem): Promise<void> {
  const items = await getWishlistItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  await writeJsonFile(FILES.WISHLIST, items);
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const items = await getWishlistItems();
  await writeJsonFile(FILES.WISHLIST, items.filter((i) => i.id !== id));
}

export async function moveWishlistToWardrobe(wishlistId: string): Promise<ClothingItem | null> {
  const wishlistItems = await getWishlistItems();
  const item = wishlistItems.find(i => i.id === wishlistId);
  if (!item) return null;

  const clothingItem: ClothingItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
    name: item.name,
    category: item.category || 'tops',
    subCategory: item.subCategory,
    color: item.color || '#808080',
    colorName: item.colorName || 'Grey',
    fabricType: item.fabricType || 'other',
    imageUris: item.imageUri ? [item.imageUri] : [],
    brand: item.brand,
    productUrl: item.url,
    cost: item.estimatedPrice,
    favorite: false,
    wearCount: 0,
    archived: false,
    createdAt: Date.now(),
    notes: item.notes,
  };

  await saveClothingItem(clothingItem);

  // Mark as purchased and remove from wishlist
  await deleteWishlistItem(wishlistId);

  return clothingItem;
}

// --- Export / Import ---
// These are used by the profile screen for backup/restore.
// Version 2 includes base64-encoded photos.

async function encodeImageToBase64(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

async function saveBase64Image(base64: string, filename: string): Promise<string> {
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export async function exportAllData(): Promise<string> {
  await ensureMigrated();
  const items = await readJsonFile<any[]>(FILES.CLOTHING_ITEMS) ?? [];
  const outfits = await readJsonFile<any[]>(FILES.OUTFITS) ?? [];
  const wishlist = await readJsonFile<any[]>(FILES.WISHLIST) ?? [];

  // Encode item photos as base64
  const photos: Record<string, string> = {};
  for (const item of items) {
    if (Array.isArray(item.imageUris)) {
      for (let i = 0; i < item.imageUris.length; i++) {
        const uri = item.imageUris[i];
        if (uri && !uri.startsWith("http")) {
          const b64 = await encodeImageToBase64(uri);
          if (b64) {
            const key = `${item.id}_${i}`;
            photos[key] = b64;
          }
        }
      }
    }
  }

  // Encode outfit selfies
  for (const outfit of outfits) {
    if (Array.isArray(outfit.wornEntries)) {
      for (let i = 0; i < outfit.wornEntries.length; i++) {
        const entry = outfit.wornEntries[i];
        if (entry.selfieUri && !entry.selfieUri.startsWith("http")) {
          const b64 = await encodeImageToBase64(entry.selfieUri);
          if (b64) {
            photos[`selfie_${outfit.id}_${i}`] = b64;
          }
        }
      }
    }
  }

  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      clothing_items: items,
      outfits,
      wishlist,
      photos,
    },
    null,
    2
  );
}

export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  if (!data.clothing_items || !data.outfits) {
    throw new Error("Invalid backup format");
  }

  // Restore photos if present (version 2+)
  const photos: Record<string, string> = data.photos ?? {};
  const photoKeyToUri: Record<string, string> = {};

  for (const [key, b64] of Object.entries(photos)) {
    const ext = "jpg";
    const filename = `restored_${key}.${ext}`;
    const uri = await saveBase64Image(b64 as string, filename);
    photoKeyToUri[key] = uri;
  }

  // Remap imageUris to restored file paths
  for (const item of data.clothing_items) {
    if (Array.isArray(item.imageUris)) {
      item.imageUris = item.imageUris.map((uri: string, i: number) => {
        const key = `${item.id}_${i}`;
        return photoKeyToUri[key] ?? uri;
      });
    }
  }

  // Remap selfie URIs
  for (const outfit of data.outfits) {
    if (Array.isArray(outfit.wornEntries)) {
      outfit.wornEntries = outfit.wornEntries.map((entry: any, i: number) => {
        const key = `selfie_${outfit.id}_${i}`;
        if (photoKeyToUri[key]) {
          return { ...entry, selfieUri: photoKeyToUri[key] };
        }
        return entry;
      });
    }
  }

  await writeJsonFile(FILES.CLOTHING_ITEMS, data.clothing_items);
  await writeJsonFile(FILES.OUTFITS, data.outfits);
  if (data.wishlist) {
    await writeJsonFile(FILES.WISHLIST, data.wishlist);
  }
}

/** Returns the path to the data directory for use in backup sharing */
export function getDataDirectory(): string {
  return DATA_DIR;
}

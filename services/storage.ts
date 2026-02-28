import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClothingItem, Outfit, FabricType, ArchiveReason } from "@/models/types";

// --- File-System Storage Layer ---
// Data is persisted as JSON files in the app's document directory.
// This ensures wardrobe data is saved directly to device storage and
// survives app updates. AsyncStorage is used only as a migration source.

const DATA_DIR = `${FileSystem.documentDirectory}wardrobez-data/`;
const FILES = {
  CLOTHING_ITEMS: `${DATA_DIR}clothing-items.json`,
  OUTFITS: `${DATA_DIR}outfits.json`,
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

export async function logOutfitWorn(outfitId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const outfits = await getOutfits();
  const outfitIdx = outfits.findIndex((o) => o.id === outfitId);
  if (outfitIdx < 0) return;

  const outfit = outfits[outfitIdx];
  outfits[outfitIdx] = {
    ...outfit,
    wornDates: [...outfit.wornDates, today],
  };
  await writeJsonFile(FILES.OUTFITS, outfits);

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
    await writeJsonFile(FILES.CLOTHING_ITEMS, updatedItems);
  }
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

  const items = await getClothingItems();
  let itemsChanged = false;
  const updatedItems = items.map((item) => {
    if (outfit.itemIds.includes(item.id) && item.wearCount > 0) {
      itemsChanged = true;
      return { ...item, wearCount: item.wearCount - 1 };
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

// --- Export / Import ---
// These are used by the profile screen for backup/restore.

export async function exportAllData(): Promise<string> {
  await ensureMigrated();
  const items = await readJsonFile<any[]>(FILES.CLOTHING_ITEMS) ?? [];
  const outfits = await readJsonFile<any[]>(FILES.OUTFITS) ?? [];
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      clothing_items: items,
      outfits,
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
  await writeJsonFile(FILES.CLOTHING_ITEMS, data.clothing_items);
  await writeJsonFile(FILES.OUTFITS, data.outfits);
}

/** Returns the path to the data directory for use in backup sharing */
export function getDataDirectory(): string {
  return DATA_DIR;
}

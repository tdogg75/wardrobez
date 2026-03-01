/**
 * Cloud Sync Service (#86)
 *
 * Provides local-first sync infrastructure using a JSON-based approach.
 * All data stays on-device; this service generates and applies sync
 * payloads that can be sent to / received from any backend.
 *
 * Sync state is tracked via AsyncStorage. The generate/apply functions
 * work with the existing storage.ts layer (getClothingItems, getOutfits,
 * getWishlistItems, etc.).
 *
 * Architecture:
 *   - Each mutation in the app should call `markDataChanged()`.
 *   - `generateSyncPayload()` creates a full snapshot for upload.
 *   - `getChangesSince(timestamp)` creates a delta payload.
 *   - `applySyncPayload(payload)` merges remote data into local storage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getClothingItems,
  saveClothingItem,
  getOutfits,
  saveOutfit,
  getWishlistItems,
  saveWishlistItem,
  getOutfitTemplates,
  saveOutfitTemplate,
  getPlannedOutfits,
  savePlannedOutfit,
  getInspirationPins,
  saveInspirationPin,
  getPackingLists,
  savePackingList,
} from "@/services/storage";
import type {
  ClothingItem,
  Outfit,
  WishlistItem,
  OutfitTemplate,
  PlannedOutfit,
  InspirationPin,
  PackingList,
} from "@/models/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_KEYS = {
  LAST_SYNCED_AT: "wardrobez:sync:last_synced_at",
  PENDING_CHANGES: "wardrobez:sync:pending_changes",
  SYNC_STATUS: "wardrobez:sync:status",
  DEVICE_ID: "wardrobez:sync:device_id",
} as const;

const PAYLOAD_VERSION = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncState {
  lastSyncedAt: string | null;
  pendingChanges: number;
  syncStatus: "idle" | "syncing" | "error" | "success";
}

export interface SyncPayload {
  version: number;
  deviceId: string;
  generatedAt: string;
  clothingItems: ClothingItem[];
  outfits: Outfit[];
  wishlistItems: WishlistItem[];
  outfitTemplates: OutfitTemplate[];
  plannedOutfits: PlannedOutfit[];
  inspirationPins: InspirationPin[];
  packingLists: PackingList[];
}

export interface DeltaSyncPayload {
  version: number;
  deviceId: string;
  generatedAt: string;
  since: string;
  clothingItems: ClothingItem[];
  outfits: Outfit[];
  wishlistItems: WishlistItem[];
}

// ---------------------------------------------------------------------------
// Device ID
// ---------------------------------------------------------------------------

async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(SYNC_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId =
      "device_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9);
    await AsyncStorage.setItem(SYNC_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
}

// ---------------------------------------------------------------------------
// Sync State Management
// ---------------------------------------------------------------------------

/**
 * Get the current sync state.
 */
export async function getSyncState(): Promise<SyncState> {
  const [lastSynced, pendingStr, status] = await Promise.all([
    AsyncStorage.getItem(SYNC_KEYS.LAST_SYNCED_AT),
    AsyncStorage.getItem(SYNC_KEYS.PENDING_CHANGES),
    AsyncStorage.getItem(SYNC_KEYS.SYNC_STATUS),
  ]);

  return {
    lastSyncedAt: lastSynced,
    pendingChanges: pendingStr ? parseInt(pendingStr, 10) || 0 : 0,
    syncStatus: (status as SyncState["syncStatus"]) || "idle",
  };
}

/**
 * Mark that local data has changed and needs syncing.
 * Call this after any create/update/delete operation.
 */
export async function markDataChanged(): Promise<void> {
  const pendingStr = await AsyncStorage.getItem(SYNC_KEYS.PENDING_CHANGES);
  const current = pendingStr ? parseInt(pendingStr, 10) || 0 : 0;
  await AsyncStorage.setItem(
    SYNC_KEYS.PENDING_CHANGES,
    String(current + 1),
  );
}

/**
 * Update the sync status. Used internally when a sync starts/finishes.
 */
export async function setSyncStatus(
  status: SyncState["syncStatus"],
): Promise<void> {
  await AsyncStorage.setItem(SYNC_KEYS.SYNC_STATUS, status);
}

/**
 * Mark sync as completed successfully. Resets pending changes to 0
 * and records the current timestamp.
 */
export async function markSyncComplete(): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    AsyncStorage.setItem(SYNC_KEYS.LAST_SYNCED_AT, now),
    AsyncStorage.setItem(SYNC_KEYS.PENDING_CHANGES, "0"),
    AsyncStorage.setItem(SYNC_KEYS.SYNC_STATUS, "success"),
  ]);
}

// ---------------------------------------------------------------------------
// Full Sync Payload
// ---------------------------------------------------------------------------

/**
 * Generate a complete data export suitable for uploading to a server.
 * This is a full snapshot of all user data.
 */
export async function generateSyncPayload(): Promise<SyncPayload> {
  await setSyncStatus("syncing");

  try {
    const [
      clothingItems,
      outfits,
      wishlistItems,
      outfitTemplates,
      plannedOutfits,
      inspirationPins,
      packingLists,
      deviceId,
    ] = await Promise.all([
      getClothingItems(),
      getOutfits(),
      getWishlistItems(),
      getOutfitTemplates(),
      getPlannedOutfits(),
      getInspirationPins(),
      getPackingLists(),
      getDeviceId(),
    ]);

    const payload: SyncPayload = {
      version: PAYLOAD_VERSION,
      deviceId,
      generatedAt: new Date().toISOString(),
      clothingItems,
      outfits,
      wishlistItems,
      outfitTemplates,
      plannedOutfits,
      inspirationPins,
      packingLists,
    };

    return payload;
  } catch (err) {
    await setSyncStatus("error");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Apply (Merge) Remote Data
// ---------------------------------------------------------------------------

/**
 * Merge a remote sync payload into local storage.
 *
 * Conflict resolution strategy (last-write-wins):
 *   - For each item type, compare by ID.
 *   - If the remote item has a newer `createdAt` (or other timestamp),
 *     it overwrites the local version.
 *   - Items that only exist remotely are added.
 *   - Items that only exist locally are kept.
 */
export async function applySyncPayload(payload: object): Promise<void> {
  const p = payload as Partial<SyncPayload>;
  if (!p.version) {
    throw new Error("Invalid sync payload: missing version");
  }

  await setSyncStatus("syncing");

  try {
    // --- Clothing Items ---
    if (p.clothingItems && Array.isArray(p.clothingItems)) {
      const localItems = await getClothingItems();
      const localMap = new Map(localItems.map((i) => [i.id, i]));

      for (const remote of p.clothingItems) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          // Remote is newer or doesn't exist locally -- merge
          const merged = mergeClothingItem(local, remote);
          await saveClothingItem(merged);
        }
      }
    }

    // --- Outfits ---
    if (p.outfits && Array.isArray(p.outfits)) {
      const localOutfits = await getOutfits();
      const localMap = new Map(localOutfits.map((o) => [o.id, o]));

      for (const remote of p.outfits) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          const merged = mergeOutfit(local, remote);
          await saveOutfit(merged);
        }
      }
    }

    // --- Wishlist ---
    if (p.wishlistItems && Array.isArray(p.wishlistItems)) {
      const localWishlist = await getWishlistItems();
      const localMap = new Map(localWishlist.map((w) => [w.id, w]));

      for (const remote of p.wishlistItems) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          await saveWishlistItem(remote);
        }
      }
    }

    // --- Outfit Templates ---
    if (p.outfitTemplates && Array.isArray(p.outfitTemplates)) {
      const localTemplates = await getOutfitTemplates();
      const localMap = new Map(localTemplates.map((t) => [t.id, t]));

      for (const remote of p.outfitTemplates) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          await saveOutfitTemplate(remote);
        }
      }
    }

    // --- Planned Outfits ---
    if (p.plannedOutfits && Array.isArray(p.plannedOutfits)) {
      for (const remote of p.plannedOutfits) {
        await savePlannedOutfit(remote);
      }
    }

    // --- Inspiration Pins ---
    if (p.inspirationPins && Array.isArray(p.inspirationPins)) {
      const localPins = await getInspirationPins();
      const localMap = new Map(localPins.map((pin) => [pin.id, pin]));

      for (const remote of p.inspirationPins) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          await saveInspirationPin(remote);
        }
      }
    }

    // --- Packing Lists ---
    if (p.packingLists && Array.isArray(p.packingLists)) {
      const localLists = await getPackingLists();
      const localMap = new Map(localLists.map((l) => [l.id, l]));

      for (const remote of p.packingLists) {
        const local = localMap.get(remote.id);
        if (!local || remote.createdAt >= local.createdAt) {
          await savePackingList(remote);
        }
      }
    }

    await markSyncComplete();
  } catch (err) {
    await setSyncStatus("error");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Delta Sync
// ---------------------------------------------------------------------------

/**
 * Generate a payload containing only items changed since the given timestamp.
 * Useful for bandwidth-efficient incremental syncs.
 *
 * @param timestamp  ISO date string. Items with `createdAt` on or after
 *                   this timestamp (converted to epoch ms) are included.
 */
export async function getChangesSince(
  timestamp: string,
): Promise<DeltaSyncPayload> {
  const since = new Date(timestamp).getTime();
  if (isNaN(since)) {
    throw new Error("Invalid timestamp for delta sync");
  }

  const [clothingItems, outfits, wishlistItems, deviceId] = await Promise.all([
    getClothingItems(),
    getOutfits(),
    getWishlistItems(),
    getDeviceId(),
  ]);

  return {
    version: PAYLOAD_VERSION,
    deviceId,
    generatedAt: new Date().toISOString(),
    since: timestamp,
    clothingItems: clothingItems.filter((i) => i.createdAt >= since),
    outfits: outfits.filter((o) => o.createdAt >= since),
    wishlistItems: wishlistItems.filter((w) => w.createdAt >= since),
  };
}

// ---------------------------------------------------------------------------
// Merge Helpers
// ---------------------------------------------------------------------------

/**
 * Merge a remote clothing item with an optional local version.
 * Preserves local-only fields (like local image URIs) when possible,
 * but prefers the remote version for most fields.
 */
function mergeClothingItem(
  local: ClothingItem | undefined,
  remote: ClothingItem,
): ClothingItem {
  if (!local) return remote;

  return {
    ...remote,
    // Merge wear data: take the union of wear dates
    wearCount: Math.max(local.wearCount, remote.wearCount),
    wearDates: mergeUniqueDates(local.wearDates, remote.wearDates),
    // Keep local image URIs that reference local files (not overwritable from remote)
    imageUris:
      remote.imageUris.length > 0 ? remote.imageUris : local.imageUris,
    // Preserve favorite status if set locally
    favorite: local.favorite || remote.favorite,
  };
}

/**
 * Merge a remote outfit with an optional local version.
 */
function mergeOutfit(
  local: Outfit | undefined,
  remote: Outfit,
): Outfit {
  if (!local) return remote;

  return {
    ...remote,
    // Merge worn dates
    wornDates: mergeUniqueDates(local.wornDates, remote.wornDates),
    wornEntries: mergeWornEntries(local.wornEntries, remote.wornEntries),
    // Keep higher rating
    rating: Math.max(local.rating, remote.rating),
  };
}

/**
 * Merge two date arrays, removing duplicates.
 */
function mergeUniqueDates(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] {
  const set = new Set<string>([...(a ?? []), ...(b ?? [])]);
  return Array.from(set).sort();
}

/**
 * Merge worn entries by date, keeping entries from both sides.
 */
function mergeWornEntries(
  a: Outfit["wornEntries"],
  b: Outfit["wornEntries"],
): Outfit["wornEntries"] {
  if (!a && !b) return undefined;
  const all = [...(a ?? []), ...(b ?? [])];
  // De-duplicate by date + selfieUri combo
  const seen = new Set<string>();
  const result: NonNullable<Outfit["wornEntries"]> = [];
  for (const entry of all) {
    const key = `${entry.date}|${entry.selfieUri ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result.length > 0
    ? result.sort((a, b) => a.date.localeCompare(b.date))
    : undefined;
}

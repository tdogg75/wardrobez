/**
 * Unit tests for cloudSync.ts — verifyring sync payload validation
 * and merge helpers operate correctly.
 */

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock storage layer
jest.mock("@/services/storage", () => ({
  getClothingItems: jest.fn().mockResolvedValue([]),
  saveClothingItem: jest.fn().mockResolvedValue(undefined),
  getOutfits: jest.fn().mockResolvedValue([]),
  saveOutfit: jest.fn().mockResolvedValue(undefined),
  getWishlistItems: jest.fn().mockResolvedValue([]),
  saveWishlistItem: jest.fn().mockResolvedValue(undefined),
  getOutfitTemplates: jest.fn().mockResolvedValue([]),
  saveOutfitTemplate: jest.fn().mockResolvedValue(undefined),
  getPlannedOutfits: jest.fn().mockResolvedValue([]),
  savePlannedOutfit: jest.fn().mockResolvedValue(undefined),
  getInspirationPins: jest.fn().mockResolvedValue([]),
  saveInspirationPin: jest.fn().mockResolvedValue(undefined),
  getPackingLists: jest.fn().mockResolvedValue([]),
  savePackingList: jest.fn().mockResolvedValue(undefined),
}));

import { applySyncPayload, getSyncState } from "@/services/cloudSync";

describe("applySyncPayload", () => {
  it("throws on missing version", async () => {
    await expect(applySyncPayload({})).rejects.toThrow("missing or invalid version");
  });

  it("throws on missing deviceId", async () => {
    await expect(applySyncPayload({ version: 1 })).rejects.toThrow("missing deviceId");
  });

  it("throws when a clothingItems entry is missing id", async () => {
    await expect(
      applySyncPayload({
        version: 1,
        deviceId: "test",
        clothingItems: [{ name: "shirt" }],
      })
    ).rejects.toThrow("missing id");
  });

  it("succeeds with valid minimal payload", async () => {
    await expect(
      applySyncPayload({
        version: 1,
        deviceId: "test-device",
        clothingItems: [],
        outfits: [],
      })
    ).resolves.toBeUndefined();
  });
});

describe("getSyncState", () => {
  it("returns idle state when nothing stored", async () => {
    const state = await getSyncState();
    expect(state.syncStatus).toBe("idle");
    expect(state.pendingChanges).toBe(0);
    expect(state.lastSyncedAt).toBeNull();
  });
});

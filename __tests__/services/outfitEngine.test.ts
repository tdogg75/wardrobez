/**
 * Unit tests for outfitEngine.ts — circular hue averaging and
 * outfit suggestion smoke tests.
 */

// Minimal mock to prevent native module errors
jest.mock("expo-file-system", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// We test the exported JS logic only, not native rendering
import { suggestOutfits, generateOutfitName } from "@/services/outfitEngine";
import type { ClothingItem } from "@/models/types";

function makeItem(overrides: Partial<ClothingItem>): ClothingItem {
  return {
    id: "item-" + Math.random().toString(36).slice(2),
    name: "Test Item",
    category: "tops",
    color: "#FFFFFF",
    colorName: "White",
    fabricType: "cotton",
    imageUris: [],
    wearCount: 0,
    wearDates: [],
    archived: false,
    favorite: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

const testItems: ClothingItem[] = [
  makeItem({ id: "1", category: "tops", color: "#3B82F6", colorName: "Blue" }),
  makeItem({ id: "2", category: "bottoms", color: "#1F2937", colorName: "Dark" }),
  makeItem({ id: "3", category: "shoes", color: "#FFFFFF", colorName: "White" }),
  makeItem({ id: "4", category: "tops", color: "#EF4444", colorName: "Red" }),
  makeItem({ id: "5", category: "bottoms", color: "#F9FAFB", colorName: "Light" }),
];

describe("suggestOutfits", () => {
  it("returns empty array for < 2 items", () => {
    expect(suggestOutfits([], {})).toEqual([]);
    expect(suggestOutfits([testItems[0]], {})).toEqual([]);
  });

  it("returns suggestions for sufficient items", () => {
    const results = suggestOutfits(testItems, { maxResults: 3 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("score");
    expect(results[0]).toHaveProperty("items");
    expect(results[0]).toHaveProperty("reasons");
  });

  it("respects maxResults limit", () => {
    const results = suggestOutfits(testItems, { maxResults: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("generateOutfitName", () => {
  it("returns a non-empty string", () => {
    const name = generateOutfitName(testItems.slice(0, 2));
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });
});

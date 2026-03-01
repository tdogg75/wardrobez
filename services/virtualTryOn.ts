/**
 * Virtual Try-On Layout Service (#87)
 *
 * Provides layout computation for a body silhouette + clothing overlay
 * system. Maps clothing categories to body positions (slots) so that
 * a try-on preview can render items at the correct locations on a
 * generic body outline.
 *
 * All coordinates are expressed as percentages (0-100) relative to the
 * silhouette bounding box, making them resolution-independent.
 */

import type { ClothingCategory, ClothingItem } from "@/models/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BodySlot {
  /** Descriptive name: "head", "torso", "legs", "feet", "full_body" */
  name: string;
  /** Horizontal position — percentage from left edge of silhouette */
  x: number;
  /** Vertical position — percentage from top edge of silhouette */
  y: number;
  /** Width as a percentage of silhouette width */
  width: number;
  /** Height as a percentage of silhouette height */
  height: number;
}

export interface TryOnLayout {
  /** Ordered list of body slots with clothing items assigned */
  slots: (BodySlot & {
    /** The clothing item placed in this slot (if any) */
    item?: ClothingItem;
  })[];
  /** Aspect ratio of the silhouette graphic (width / height) */
  silhouetteAspectRatio: number;
}

// ---------------------------------------------------------------------------
// Slot Definitions
// ---------------------------------------------------------------------------

/**
 * Default body slots keyed by region name.
 * Percentages are tuned for a standing front-facing silhouette.
 */
const SLOT_DEFINITIONS: Record<string, BodySlot> = {
  head: {
    name: "head",
    x: 30,
    y: 0,
    width: 40,
    height: 12,
  },
  neck: {
    name: "neck",
    x: 32,
    y: 10,
    width: 36,
    height: 8,
  },
  torso: {
    name: "torso",
    x: 15,
    y: 18,
    width: 70,
    height: 32,
  },
  waist: {
    name: "waist",
    x: 18,
    y: 45,
    width: 64,
    height: 8,
  },
  legs: {
    name: "legs",
    x: 15,
    y: 50,
    width: 70,
    height: 30,
  },
  feet: {
    name: "feet",
    x: 15,
    y: 82,
    width: 70,
    height: 15,
  },
  full_body: {
    name: "full_body",
    x: 15,
    y: 18,
    width: 70,
    height: 62,
  },
  wrist: {
    name: "wrist",
    x: 5,
    y: 45,
    width: 20,
    height: 8,
  },
  hand: {
    name: "hand",
    x: 0,
    y: 50,
    width: 18,
    height: 10,
  },
};

// ---------------------------------------------------------------------------
// Category -> Slot Mapping
// ---------------------------------------------------------------------------

/**
 * Maps each clothing category to the body slot where it should be
 * rendered. Some categories may be sub-category dependent (handled
 * in `getItemSlot`).
 */
const CATEGORY_SLOT_MAP: Record<ClothingCategory, BodySlot> = {
  // Upper body
  tops: SLOT_DEFINITIONS.torso,
  blazers: SLOT_DEFINITIONS.torso,
  jackets: SLOT_DEFINITIONS.torso,

  // Lower body
  bottoms: SLOT_DEFINITIONS.legs,
  shorts: {
    name: "legs",
    x: 15,
    y: 50,
    width: 70,
    height: 22,
  },
  skirts: {
    name: "legs",
    x: 15,
    y: 48,
    width: 70,
    height: 25,
  },

  // Full body
  dresses: SLOT_DEFINITIONS.full_body,
  jumpsuits: SLOT_DEFINITIONS.full_body,
  swimwear: SLOT_DEFINITIONS.full_body,

  // Feet
  shoes: SLOT_DEFINITIONS.feet,

  // Accessories / Head / Neck
  accessories: SLOT_DEFINITIONS.neck,
  jewelry: SLOT_DEFINITIONS.neck,
  purse: SLOT_DEFINITIONS.hand,
};

/**
 * More specific slot mapping for subcategories that differ from
 * their parent category's default.
 */
const SUBCATEGORY_SLOT_OVERRIDES: Record<string, BodySlot> = {
  // Accessories -> specific body areas
  hats: SLOT_DEFINITIONS.head,
  sunglasses: SLOT_DEFINITIONS.head,
  hair_pieces: SLOT_DEFINITIONS.head,
  belts: SLOT_DEFINITIONS.waist,
  scarves: SLOT_DEFINITIONS.neck,
  stockings: SLOT_DEFINITIONS.legs,

  // Jewelry -> specific areas
  earrings: SLOT_DEFINITIONS.head,
  necklaces: SLOT_DEFINITIONS.neck,
  bracelets: SLOT_DEFINITIONS.wrist,
  watches: SLOT_DEFINITIONS.wrist,
  rings: SLOT_DEFINITIONS.hand,

  // Purse subcategories all go to the hand/side area
  beach_bag: SLOT_DEFINITIONS.hand,
  backpack: { name: "back", x: 65, y: 20, width: 30, height: 30 },
  handbag: SLOT_DEFINITIONS.hand,
  crossbody: { name: "crossbody", x: 60, y: 30, width: 25, height: 25 },
  clutch: SLOT_DEFINITIONS.hand,
  tote: SLOT_DEFINITIONS.hand,

  // Boot-height shoes that extend up
  knee_boots: {
    name: "feet",
    x: 15,
    y: 65,
    width: 70,
    height: 32,
  },
  winter_boots: {
    name: "feet",
    x: 15,
    y: 72,
    width: 70,
    height: 25,
  },

  // Cover-ups are like dresses
  cover_up: SLOT_DEFINITIONS.full_body,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the body slot for a given clothing category.
 * This is the basic mapping without subcategory refinement.
 */
export function getCategorySlot(category: ClothingCategory): BodySlot {
  return CATEGORY_SLOT_MAP[category] ?? SLOT_DEFINITIONS.torso;
}

/**
 * Get the body slot for a specific item, considering its subcategory
 * for more precise placement.
 */
export function getItemSlot(item: ClothingItem): BodySlot {
  // Check subcategory override first
  if (item.subCategory && SUBCATEGORY_SLOT_OVERRIDES[item.subCategory]) {
    return SUBCATEGORY_SLOT_OVERRIDES[item.subCategory];
  }
  return getCategorySlot(item.category);
}

/**
 * Compute a complete try-on layout for a set of clothing items.
 *
 * Items are sorted by visual layering order (back to front):
 *   1. Full-body items (dresses, jumpsuits) first
 *   2. Lower body (bottoms, skirts, shorts)
 *   3. Upper body (tops, then blazers/jackets on top)
 *   4. Shoes
 *   5. Accessories / Jewelry (topmost layer)
 *
 * @param items  Array of clothing items to lay out on the body.
 * @returns      A TryOnLayout with positioned slots.
 */
export function computeTryOnLayout(items: ClothingItem[]): TryOnLayout {
  if (items.length === 0) {
    return {
      slots: getDefaultSlots(),
      silhouetteAspectRatio: 0.45,
    };
  }

  // Sort items into layering order
  const sorted = [...items].sort((a, b) => {
    return getLayerOrder(a.category) - getLayerOrder(b.category);
  });

  // Resolve overlapping slots
  const occupiedRegions: Map<string, BodySlot & { item?: ClothingItem }> =
    new Map();

  for (const item of sorted) {
    const slot = getItemSlot(item);
    const key = slot.name;

    // If this slot is already occupied, stack the new item slightly offset
    if (occupiedRegions.has(key)) {
      const existing = occupiedRegions.get(key)!;
      // Layer on top (slightly offset for visual depth)
      const stacked: BodySlot & { item?: ClothingItem } = {
        ...slot,
        name: `${key}_${item.id}`,
        item,
      };
      occupiedRegions.set(stacked.name, stacked);
    } else {
      occupiedRegions.set(key, { ...slot, item });
    }
  }

  // Add empty default slots for unoccupied body regions
  const allSlotNames = new Set(
    Array.from(occupiedRegions.values()).map((s) => s.name.split("_")[0]),
  );
  for (const defaultSlot of getDefaultSlots()) {
    if (!allSlotNames.has(defaultSlot.name)) {
      occupiedRegions.set(defaultSlot.name, defaultSlot);
    }
  }

  // Sort the final layout by vertical position (top to bottom)
  const slots = Array.from(occupiedRegions.values()).sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );

  return {
    slots,
    silhouetteAspectRatio: 0.45, // typical standing figure width:height
  };
}

/**
 * Compute pixel-based layout dimensions from percentage-based slots.
 *
 * @param layout          The TryOnLayout with percentage-based slots.
 * @param containerWidth  The pixel width of the rendering container.
 * @param containerHeight The pixel height of the rendering container.
 * @returns Array of slots with absolute pixel positions.
 */
export function resolvePixelLayout(
  layout: TryOnLayout,
  containerWidth: number,
  containerHeight: number,
): {
  name: string;
  item?: ClothingItem;
  pixelX: number;
  pixelY: number;
  pixelWidth: number;
  pixelHeight: number;
}[] {
  return layout.slots.map((slot) => ({
    name: slot.name,
    item: (slot as any).item,
    pixelX: (slot.x / 100) * containerWidth,
    pixelY: (slot.y / 100) * containerHeight,
    pixelWidth: (slot.width / 100) * containerWidth,
    pixelHeight: (slot.height / 100) * containerHeight,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Layering order for rendering. Lower number = rendered first (behind).
 */
function getLayerOrder(category: ClothingCategory): number {
  switch (category) {
    case "dresses":
    case "jumpsuits":
    case "swimwear":
      return 0; // Full-body base layer
    case "bottoms":
    case "shorts":
    case "skirts":
      return 1; // Lower body
    case "tops":
      return 2; // Upper body
    case "blazers":
    case "jackets":
      return 3; // Outer layer
    case "shoes":
      return 4;
    case "accessories":
    case "purse":
      return 5;
    case "jewelry":
      return 6; // Topmost (earrings, necklaces visible on top)
    default:
      return 3;
  }
}

/**
 * Returns the default set of empty body slots (used when no items
 * are placed, to show the silhouette outline).
 */
function getDefaultSlots(): BodySlot[] {
  return [
    SLOT_DEFINITIONS.head,
    SLOT_DEFINITIONS.torso,
    SLOT_DEFINITIONS.legs,
    SLOT_DEFINITIONS.feet,
  ];
}

/**
 * Check if two slots overlap vertically (useful for layout debugging).
 */
export function slotsOverlap(a: BodySlot, b: BodySlot): boolean {
  const aTop = a.y;
  const aBottom = a.y + a.height;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  const aLeft = a.x;
  const aRight = a.x + a.width;
  const bLeft = b.x;
  const bRight = b.x + b.width;

  return aTop < bBottom && aBottom > bTop && aLeft < bRight && aRight > bLeft;
}

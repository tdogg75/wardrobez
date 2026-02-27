export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "blazers"
  | "jackets"
  | "shoes"
  | "accessories"
  | "swimwear"
  | "jewelry";

export type Occasion =
  | "casual"
  | "work"
  | "fancy"
  | "party"
  | "vacation";

export type Season =
  | "spring"
  | "summer"
  | "fall"
  | "winter";

export type FabricType =
  | "cotton"
  | "linen"
  | "silk"
  | "polyester"
  | "wool"
  | "denim"
  | "leather"
  | "nylon"
  | "cashmere"
  | "satin"
  | "fleece"
  | "other";

export type ArchiveReason = "donated" | "sold" | "worn_out" | "given_away";

export type HardwareColour = "gold" | "silver" | "rose_gold" | "black" | "bronze" | "gunmetal";

export type ItemFlag =
  | "too_big"
  | "too_small"
  | "needs_repair"
  | "needs_dry_clean"
  | "flawed"
  | "stained"
  | "pilling"
  | "missing_button"
  | "other";

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subCategory?: string;
  color: string; // hex color (primary)
  colorName: string;
  secondaryColor?: string; // hex (optional)
  secondaryColorName?: string;
  fabricType: FabricType;
  imageUris: string[]; // multiple images (online, personal, etc.)
  brand?: string;
  productUrl?: string; // link to the product page
  cost?: number;
  favorite: boolean;
  wearCount: number;
  archived: boolean;
  archiveReason?: ArchiveReason;
  archivedAt?: number;
  createdAt: number;
  // Open top: blazers, cardigans, zip-ups that require a shirt underneath
  isOpen?: boolean;
  // Hardware colour for items with buttons, buckles, clasps
  hardwareColour?: HardwareColour;
  // Optional notes
  notes?: string;
  // Original auto-detected colour from image (for revert)
  originalAutoColor?: string;
  // Item condition flags
  itemFlags?: ItemFlag[];
  // Legacy field - kept for migration but no longer used in UI
  occasions?: Occasion[];
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  occasions: Occasion[];
  seasons: Season[];
  rating: number; // 1-5
  createdAt: number;
  suggested: boolean; // was this AI-suggested?
  wornDates: string[]; // ISO date strings for each time worn
  hasRemovedItems?: boolean;
  removedItemNotified?: boolean;
  // Optional notes
  notes?: string;
  // Custom tags
  tags?: string[];
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  blazers: "Blazers",
  jackets: "Jackets",
  shoes: "Shoes",
  accessories: "Accessories",
  swimwear: "Swimwear",
  jewelry: "Jewellery",
};

export const SUBCATEGORIES: Record<ClothingCategory, { value: string; label: string }[]> = {
  tops: [
    { value: "tank_top", label: "Tank Top" },
    { value: "tshirt", label: "T-Shirt" },
    { value: "long_sleeve", label: "Long Sleeve" },
    { value: "blouse", label: "Blouse" },
    { value: "sweater", label: "Sweater" },
    { value: "cardigan", label: "Cardigan" },
    { value: "zip_up", label: "Zip-Up" },
    { value: "sweatshirt", label: "Sweatshirt" },
    { value: "hoodie", label: "Hoodie" },
    { value: "polo", label: "Polo" },
    { value: "workout_shirt", label: "Workout Shirt" },
  ],
  bottoms: [
    { value: "dress_pants", label: "Dress Pants" },
    { value: "jeans", label: "Jeans" },
    { value: "leggings", label: "Leggings" },
    { value: "casual_pants", label: "Casual Pants" },
    { value: "skirt", label: "Skirt" },
    { value: "shorts", label: "Shorts" },
    { value: "other", label: "Other" },
  ],
  dresses: [
    { value: "formal_dress", label: "Formal" },
    { value: "work_dress", label: "Work" },
    { value: "casual_dress", label: "Casual" },
    { value: "sundress", label: "Sundress" },
    { value: "cover_up", label: "Cover-Up" },
  ],
  blazers: [
    { value: "casual_blazer", label: "Casual" },
    { value: "formal_blazer", label: "Formal" },
    { value: "sport_coat", label: "Sport Coat" },
  ],
  jackets: [
    { value: "parka", label: "Parka" },
    { value: "spring_jacket", label: "Spring Jacket" },
    { value: "raincoat", label: "Raincoat" },
    { value: "work_jacket", label: "Work Jacket" },
    { value: "ski_jacket", label: "Ski Jacket" },
    { value: "jean_jacket", label: "Jean Jacket" },
  ],
  shoes: [
    { value: "dress_boots", label: "Dress Boots" },
    { value: "winter_boots", label: "Winter Boots" },
    { value: "running_shoes", label: "Running Shoes" },
    { value: "sandals", label: "Sandals" },
    { value: "soccer_shoes", label: "Soccer Shoes" },
    { value: "flats", label: "Flats" },
    { value: "heels", label: "Heels" },
  ],
  accessories: [
    { value: "belts", label: "Belts" },
    { value: "hats", label: "Hats" },
    { value: "sunglasses", label: "Sunglasses" },
  ],
  jewelry: [
    { value: "watches", label: "Watches" },
    { value: "earrings", label: "Earrings" },
    { value: "necklaces", label: "Necklaces" },
    { value: "bracelets", label: "Bracelets" },
    { value: "rings", label: "Rings" },
  ],
  swimwear: [
    { value: "one_piece", label: "One Piece" },
    { value: "swim_top", label: "Swim Top" },
    { value: "swim_bottom", label: "Swim Bottom" },
    { value: "cover_up", label: "Cover-Up" },
  ],
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: "Casual",
  work: "Work",
  fancy: "Fancy",
  party: "Party",
  vacation: "Vacation",
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

export const FABRIC_TYPE_LABELS: Record<FabricType, string> = {
  cotton: "Cotton",
  linen: "Linen",
  silk: "Silk",
  polyester: "Polyester",
  wool: "Wool",
  denim: "Denim",
  leather: "Leather",
  nylon: "Nylon",
  cashmere: "Cashmere",
  satin: "Satin",
  fleece: "Fleece",
  other: "Other",
};

export const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  donated: "Donated",
  sold: "Sold",
  worn_out: "Worn Out",
  given_away: "Given Away",
};

export const HARDWARE_COLOUR_LABELS: Record<HardwareColour, string> = {
  gold: "Gold",
  silver: "Silver",
  rose_gold: "Rose Gold",
  black: "Black",
  bronze: "Bronze",
  gunmetal: "Gunmetal",
};

export const ITEM_FLAG_LABELS: Record<ItemFlag, string> = {
  too_big: "Too Big",
  too_small: "Too Small",
  needs_repair: "Needs Repair",
  needs_dry_clean: "Needs Dry Clean",
  flawed: "Flawed",
  stained: "Stained",
  pilling: "Pilling",
  missing_button: "Missing Button",
  other: "Other",
};

// Items that can have hardware (buttons, buckles, clasps)
export const HARDWARE_CATEGORIES: ClothingCategory[] = ["blazers", "accessories", "jewelry"];
export const HARDWARE_SUBCATEGORIES: string[] = [
  "casual_blazer", "formal_blazer", "sport_coat",
  "belts", "watches", "bracelets", "necklaces",
  "cardigan", "zip_up",
];

// Subcategories that are always considered "open" (require a shirt under)
export const ALWAYS_OPEN_SUBCATEGORIES: string[] = [
  "casual_blazer", "formal_blazer", "sport_coat",
  "cardigan", "zip_up",
];

export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "shorts"
  | "skirts"
  | "dresses"
  | "jumpsuits"
  | "blazers"
  | "jackets"
  | "shoes"
  | "accessories"
  | "purse"
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

export type CareInstruction =
  | "machine_wash"
  | "hand_wash"
  | "dry_clean_only"
  | "spot_clean"
  | "delicate_cycle"
  | "tumble_dry"
  | "hang_dry"
  | "line_dry"
  | "do_not_bleach"
  | "iron_low"
  | "iron_medium"
  | "iron_high"
  | "do_not_iron"
  | "steam_only";

export type ArchiveReason = "donated" | "sold" | "worn_out" | "given_away";

export type HardwareColour = "gold" | "silver" | "rose_gold" | "black" | "bronze" | "gunmetal";

export type Pattern =
  | "solid"
  | "striped"
  | "plaid"
  | "floral"
  | "polka_dot"
  | "graphic"
  | "camo"
  | "abstract"
  | "animal_print"
  | "checkered"
  | "paisley"
  | "houndstooth"
  | "tie_dye"
  | "color_block";

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
  purchaseDate?: string; // ISO date string (YYYY-MM-DD)
  favorite: boolean;
  wearCount: number;
  /** ISO date strings for each time worn (includes both standalone and outfit wears) */
  wearDates?: string[];
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
  // Care instructions
  careInstructions?: CareInstruction[];
  // Sustainability - is this from a sustainable/ethical brand?
  sustainable?: boolean;
  // Legacy field - kept for migration but no longer used in UI
  occasions?: Occasion[];
  // Pattern / print
  pattern?: Pattern;
  // Size (e.g., "S", "M", "L", "XL", "32", "8", "One Size")
  size?: string;
  // Custom tags
  tags?: string[];
}

/** Common sizes for quick selection */
export const COMMON_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "One Size"] as const;
export const NUMERIC_SIZES = ["0", "2", "4", "6", "8", "10", "12", "14", "16"] as const;
export const SHOE_SIZES = ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13"] as const;

/** A single wear-log entry for an outfit, optionally with a selfie + note */
export interface WornEntry {
  date: string; // ISO date string
  selfieUri?: string;
  note?: string;
}

export interface Outfit {
  id: string;
  name: string;
  /** Once set, the name is locked unless user explicitly regenerates */
  nameLocked?: boolean;
  itemIds: string[];
  occasions: Occasion[];
  seasons: Season[];
  rating: number; // 1-5
  createdAt: number;
  suggested: boolean; // was this AI-suggested?
  wornDates: string[]; // ISO date strings for each time worn
  /** Rich wear-log entries (selfie + note). Coexists with wornDates for compat. */
  wornEntries?: WornEntry[];
  hasRemovedItems?: boolean;
  removedItemNotified?: boolean;
  // Optional notes
  notes?: string;
  // Custom tags
  tags?: string[];
}

/** A wishlist / shopping-list item */
export interface WishlistItem {
  id: string;
  name: string;
  brand?: string;
  url?: string;
  estimatedPrice?: number;
  category?: ClothingCategory;
  notes?: string;
  imageUri?: string;
  color?: string;
  colorName?: string;
  subCategory?: string;
  fabricType?: FabricType;
  createdAt: number;
  purchased?: boolean;
  /** Track price history for sale alerts */
  priceHistory?: { date: string; price: number }[];
  /** Target price for sale alerts */
  targetPrice?: number;
}

/** Outfit template - reusable formula for generating outfits */
export interface OutfitTemplate {
  id: string;
  name: string;
  categorySlots: { category: ClothingCategory; subCategory?: string }[];
  occasions: Occasion[];
  seasons: Season[];
  createdAt: number;
}

/** Weekly outfit plan entry */
export interface PlannedOutfit {
  date: string; // ISO date YYYY-MM-DD
  outfitId?: string; // reference to saved outfit
  itemIds?: string[]; // or ad-hoc item selection
  notes?: string;
}

/** Style inspiration pin */
export interface InspirationPin {
  id: string;
  imageUri: string;
  title?: string;
  notes?: string;
  tags?: string[];
  createdAt: number;
}

/** Packing list */
export interface PackingList {
  id: string;
  name: string;
  destination?: string;
  startDate: string;
  endDate: string;
  itemIds: string[];
  outfitIds?: string[];
  notes?: string;
  createdAt: number;
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  shorts: "Shorts",
  skirts: "Skirts",
  dresses: "Dresses",
  jumpsuits: "Jumpsuits",
  blazers: "Blazers",
  jackets: "Jackets",
  shoes: "Shoes",
  accessories: "Accessories",
  purse: "Purse",
  swimwear: "Swimwear",
  jewelry: "Jewellery",
};

export const SUBCATEGORIES: Record<ClothingCategory, { value: string; label: string }[]> = {
  tops: [
    { value: "blouse", label: "Blouse" },
    { value: "long_sleeve", label: "Long Sleeve" },
    { value: "tshirt", label: "T-Shirt" },
    { value: "tank_top", label: "Tank Top" },
    { value: "sweater", label: "Sweater" },
    { value: "cardigan", label: "Cardigan" },
    { value: "sweatshirt", label: "Sweatshirt" },
    { value: "hoodie", label: "Hoodie" },
    { value: "zip_up", label: "Zip-Up" },
    { value: "lounge_shirt", label: "Lounge Shirt" },
    { value: "sport", label: "Sport" },
  ],
  bottoms: [
    { value: "trousers", label: "Trousers" },
    { value: "jeans", label: "Jeans" },
    { value: "casual", label: "Casual" },
    { value: "leggings", label: "Leggings" },
    { value: "sweatpants", label: "Sweatpants" },
  ],
  shorts: [
    { value: "casual_shorts", label: "Casual" },
    { value: "athletic_shorts", label: "Athletic" },
  ],
  skirts: [
    { value: "mini_skirt", label: "Mini" },
    { value: "midi_skirt", label: "Midi" },
    { value: "maxi_skirt", label: "Maxi" },
    { value: "skort", label: "Skort" },
  ],
  dresses: [
    { value: "work_dress", label: "Work" },
    { value: "casual_dress", label: "Casual" },
    { value: "party_dress", label: "Party" },
    { value: "sundress", label: "Sundress" },
    { value: "cover_up", label: "Cover-Up" },
  ],
  jumpsuits: [
    { value: "casual_jumpsuit", label: "Casual" },
    { value: "dressy_jumpsuit", label: "Dressy" },
  ],
  blazers: [
    { value: "casual_blazer", label: "Casual" },
    { value: "formal_blazer", label: "Formal" },
  ],
  jackets: [
    { value: "spring_jacket", label: "Spring Jacket" },
    { value: "jean_jacket", label: "Jean Jacket" },
    { value: "work_jacket", label: "Work Jacket" },
    { value: "raincoat", label: "Raincoat" },
    { value: "parka", label: "Parka" },
    { value: "ski_jacket", label: "Ski Jacket" },
  ],
  shoes: [
    { value: "flats", label: "Flats" },
    { value: "loafers", label: "Loafers" },
    { value: "heels", label: "Heels" },
    { value: "casual_sandals", label: "Casual Sandals" },
    { value: "sandals", label: "Sandals" },
    { value: "birks", label: "Birks" },
    { value: "ankle_boots", label: "Ankle Boots" },
    { value: "knee_boots", label: "Knee-High Boots" },
    { value: "winter_boots", label: "Winter Boots" },
    { value: "running_shoes", label: "Running Shoes" },
    { value: "soccer_shoes", label: "Soccer Shoes" },
  ],
  accessories: [
    { value: "belts", label: "Belts" },
    { value: "hats", label: "Hats" },
    { value: "sunglasses", label: "Sunglasses" },
    { value: "scarves", label: "Scarves" },
    { value: "hair_pieces", label: "Hair Pieces" },
    { value: "stockings", label: "Stockings/Tights" },
  ],
  purse: [
    { value: "beach_bag", label: "Beach Bag" },
    { value: "backpack", label: "Backpack" },
    { value: "handbag", label: "Handbag" },
    { value: "crossbody", label: "Crossbody" },
    { value: "clutch", label: "Clutch" },
    { value: "tote", label: "Tote" },
  ],
  jewelry: [
    { value: "earrings", label: "Earrings" },
    { value: "necklaces", label: "Necklaces" },
    { value: "bracelets", label: "Bracelets" },
    { value: "rings", label: "Rings" },
    { value: "watches", label: "Watches" },
  ],
  swimwear: [
    { value: "one_piece", label: "One Piece" },
    { value: "top", label: "Top" },
    { value: "bottom", label: "Bottom" },
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

export const CARE_INSTRUCTION_LABELS: Record<CareInstruction, string> = {
  machine_wash: "Machine Wash",
  hand_wash: "Hand Wash",
  dry_clean_only: "Dry Clean Only",
  spot_clean: "Spot Clean",
  delicate_cycle: "Delicate Cycle",
  tumble_dry: "Tumble Dry",
  hang_dry: "Hang Dry",
  line_dry: "Line Dry",
  do_not_bleach: "Do Not Bleach",
  iron_low: "Iron Low",
  iron_medium: "Iron Medium",
  iron_high: "Iron High",
  do_not_iron: "Do Not Iron",
  steam_only: "Steam Only",
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

export const PATTERN_LABELS: Record<Pattern, string> = {
  solid: "Solid",
  striped: "Striped",
  plaid: "Plaid",
  floral: "Floral",
  polka_dot: "Polka Dot",
  graphic: "Graphic",
  camo: "Camo",
  abstract: "Abstract",
  animal_print: "Animal Print",
  checkered: "Checkered",
  paisley: "Paisley",
  houndstooth: "Houndstooth",
  tie_dye: "Tie-Dye",
  color_block: "Colour Block",
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
export const HARDWARE_CATEGORIES: ClothingCategory[] = ["blazers", "accessories", "jewelry", "purse"];
export const HARDWARE_SUBCATEGORIES: string[] = [
  "casual_blazer", "formal_blazer",
  "belts", "watches", "bracelets", "necklaces",
  "cardigan", "zip_up",
];

// Subcategories that are always considered "open" (require a shirt under)
export const ALWAYS_OPEN_SUBCATEGORIES: string[] = [
  "casual_blazer", "formal_blazer",
  "cardigan", "zip_up",
];

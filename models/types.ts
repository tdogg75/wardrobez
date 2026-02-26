export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "swimwear";

export type Occasion =
  | "casual"
  | "work"
  | "fancy"
  | "party"
  | "vacation";

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

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subCategory?: string;
  color: string; // hex color (primary)
  colorName: string;
  secondaryColor?: string; // hex (optional)
  secondaryColorName?: string;
  occasions: Occasion[];
  fabricType: FabricType;
  imageUris: string[]; // multiple images (online, personal, etc.)
  brand?: string;
  productUrl?: string; // link to the product page
  favorite: boolean;
  createdAt: number;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  occasions: Occasion[];
  rating: number; // 1-5
  createdAt: number;
  suggested: boolean; // was this AI-suggested?
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessories: "Accessories",
  swimwear: "Swimwear",
};

export const SUBCATEGORIES: Record<ClothingCategory, { value: string; label: string }[]> = {
  tops: [
    { value: "tank_top", label: "Tank Top" },
    { value: "tshirt", label: "T-Shirt" },
    { value: "long_sleeve", label: "Long Sleeve" },
    { value: "blouse", label: "Blouse" },
    { value: "sweater", label: "Sweater" },
    { value: "sweatshirt", label: "Sweatshirt" },
    { value: "hoodie", label: "Hoodie" },
    { value: "blazer", label: "Blazer" },
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
  outerwear: [
    { value: "parka", label: "Parka" },
    { value: "spring_jacket", label: "Spring Jacket" },
    { value: "raincoat", label: "Raincoat" },
    { value: "work_jacket", label: "Work Jacket" },
    { value: "ski_jacket", label: "Ski Jacket" },
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
    { value: "watches", label: "Watches" },
    { value: "earrings", label: "Earrings" },
    { value: "necklaces", label: "Necklaces" },
    { value: "bracelets", label: "Bracelets" },
    { value: "rings", label: "Rings" },
  ],
  swimwear: [],
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: "Casual",
  work: "Work",
  fancy: "Fancy",
  party: "Party",
  vacation: "Vacation",
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

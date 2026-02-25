export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories";

export type Season = "spring" | "summer" | "fall" | "winter";

export type Occasion =
  | "casual"
  | "work"
  | "formal"
  | "athletic"
  | "date_night"
  | "outdoor";

export type FabricWeight = "light" | "medium" | "heavy";

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string; // hex color
  colorName: string;
  seasons: Season[];
  occasions: Occasion[];
  fabricWeight: FabricWeight;
  imageUri: string | null;
  brand?: string;
  favorite: boolean;
  createdAt: number;
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
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessories: "Accessories",
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: "Casual",
  work: "Work",
  formal: "Formal",
  athletic: "Athletic",
  date_night: "Date Night",
  outdoor: "Outdoor",
};

export const FABRIC_WEIGHT_LABELS: Record<FabricWeight, string> = {
  light: "Lightweight",
  medium: "Midweight",
  heavy: "Heavyweight",
};

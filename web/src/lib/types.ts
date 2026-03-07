/**
 * Shared types for the Wardrobez web companion app.
 * Mirrors the mobile app's ClothingItem and Outfit types.
 */

export interface ClothingItem {
  id: string;
  name: string;
  category: string;
  color: string;
  colorName: string;
  secondaryColor?: string;
  fabricType: string;
  imageUris: string[];
  brand?: string;
  cost?: number;
  wearCount: number;
  wearDates?: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  tags?: string[];
  seasons?: string[];
  occasions?: string[];
  laundryStatus?: string;
  sustainable?: boolean;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  occasions?: string[];
  seasons?: string[];
  rating?: number;
  wornDates: string[];
  createdAt: number;
}

export interface WardrobeBackup {
  version: number;
  exportedAt: string;
  clothing_items: ClothingItem[];
  outfits: Outfit[];
}

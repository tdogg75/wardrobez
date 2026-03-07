"use client";

import type { Outfit, ClothingItem } from "@/lib/types";

export function OutfitList({
  outfits,
  items,
}: {
  outfits: Outfit[];
  items: ClothingItem[];
}) {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  if (outfits.length === 0) {
    return <p className="text-center text-gray-400 py-12">No saved outfits yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {outfits.map((outfit) => {
        const outfitItems = outfit.itemIds
          .map((id) => itemMap.get(id))
          .filter(Boolean) as ClothingItem[];

        return (
          <div
            key={outfit.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            {/* Color palette */}
            <div className="flex gap-1.5 mb-3">
              {outfitItems.slice(0, 8).map((item) => (
                <span
                  key={item.id}
                  className="w-5 h-5 rounded-full border border-gray-200"
                  style={{ backgroundColor: item.color }}
                  title={item.colorName}
                />
              ))}
            </div>

            <h3 className="font-semibold text-gray-800 text-sm truncate">{outfit.name}</h3>

            <p className="text-xs text-gray-400 mt-1">
              {outfitItems.map((i) => i.name).join(" + ") || "No items"}
            </p>

            <div className="flex items-center gap-3 mt-2">
              {outfit.rating ? (
                <span className="text-xs text-yellow-500">{"★".repeat(outfit.rating)}</span>
              ) : null}
              {outfit.wornDates?.length ? (
                <span className="text-xs text-gray-400">
                  Worn {outfit.wornDates.length}×
                </span>
              ) : null}
              {outfit.seasons?.length ? (
                <span className="text-xs text-indigo-400 capitalize">
                  {outfit.seasons.join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

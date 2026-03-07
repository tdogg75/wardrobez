"use client";

import { useState } from "react";
import type { ClothingItem } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  tops: "Tops", bottoms: "Bottoms", dresses: "Dresses", shoes: "Shoes",
  jackets: "Jackets", blazers: "Blazers", jumpsuits: "Jumpsuits",
  skirts: "Skirts", shorts: "Shorts", swimwear: "Swimwear",
  accessories: "Accessories", purse: "Bags", jewelry: "Jewelry",
};

export function WardrobeGrid({ items }: { items: ClothingItem[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const categories = [...new Set(items.map((i) => i.category))].sort();

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filter === "all" || item.category === filter;
    return matchSearch && matchCat;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px] outline-none focus:border-indigo-400"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} items</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-gray-400 py-12">No items found.</p>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: ClothingItem }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      {/* Image or color swatch */}
      <div className="h-32 relative">
        {item.imageUris && item.imageUris.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUris[0]}
            alt={item.name}
            className="w-full h-full object-contain bg-gray-50"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: item.color + "33" }}
          >
            👕
          </div>
        )}
        {item.favorite && (
          <span className="absolute top-1 right-1 text-red-500 text-xs">♥</span>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <span
            className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-400 truncate">{item.colorName}</span>
        </div>
        {item.wearCount > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{item.wearCount}× worn</p>
        )}
      </div>
    </div>
  );
}

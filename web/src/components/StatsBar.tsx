import type { ClothingItem, Outfit } from "@/lib/types";

export function StatsBar({
  items,
  outfits,
}: {
  items: ClothingItem[];
  outfits: Outfit[];
}) {
  const totalSpend = items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const wornItems = items.filter((i) => i.wearCount > 0 && i.cost);
  const avgCpw =
    wornItems.length > 0
      ? wornItems.reduce((s, i) => s + (i.cost ?? 0) / i.wearCount, 0) /
        wornItems.length
      : 0;

  const stats = [
    { label: "Items", value: items.length.toString() },
    { label: "Outfits", value: outfits.length.toString() },
    { label: "Total Spend", value: `$${totalSpend.toFixed(0)}` },
    { label: "Avg $/Wear", value: `$${avgCpw.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 text-center"
        >
          <div className="text-xl font-bold text-indigo-600">{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

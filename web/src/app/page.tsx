"use client";

import { useState, useCallback } from "react";
import type { WardrobeBackup, ClothingItem, Outfit } from "@/lib/types";
import { WardrobeGrid } from "@/components/WardrobeGrid";
import { OutfitList } from "@/components/OutfitList";
import { StatsBar } from "@/components/StatsBar";

type Tab = "wardrobe" | "outfits" | "stats";

export default function Home() {
  const [backup, setBackup] = useState<WardrobeBackup | null>(null);
  const [tab, setTab] = useState<Tab>("wardrobe");
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as WardrobeBackup;
        if (!parsed.clothing_items || !parsed.outfits) {
          setError("This doesn't look like a Wardrobez backup file.");
          return;
        }
        setBackup(parsed);
      } catch {
        setError("Failed to parse the backup file. Make sure it's a valid JSON.");
      }
    };
    reader.readAsText(file);
  }, []);

  if (!backup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <div className="text-6xl mb-4">👗</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Wardrobez Web</h1>
          <p className="text-gray-500 text-lg">
            Upload your backup file to view your wardrobe in the browser.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Export from the app: Profile → Backup & Export → Export Backup
          </p>
        </div>

        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg">
          <span>Choose Backup File</span>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFile}
          />
        </label>

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  const activeItems = backup.clothing_items.filter((i) => !i.archived);

  return (
    <div>
      {/* Stats bar */}
      <StatsBar items={activeItems} outfits={backup.outfits} />

      {/* Tab nav */}
      <div className="flex gap-2 mt-6 mb-6 border-b border-gray-200">
        {(["wardrobe", "outfits", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <button
            onClick={() => { setBackup(null); setError(null); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Load different backup
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === "wardrobe" && <WardrobeGrid items={activeItems} />}
      {tab === "outfits" && (
        <OutfitList outfits={backup.outfits} items={backup.clothing_items} />
      )}
      {tab === "stats" && <StatsTab items={activeItems} outfits={backup.outfits} />}
    </div>
  );
}

function StatsTab({ items, outfits }: { items: ClothingItem[]; outfits: Outfit[] }) {
  const totalSpend = items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const totalWears = outfits.reduce((s, o) => s + (o.wornDates?.length ?? 0), 0);

  const catMap: Record<string, number> = {};
  for (const item of items) catMap[item.category] = (catMap[item.category] ?? 0) + 1;
  const cats = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  const maxCat = cats[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Items", value: items.length },
          { label: "Outfits", value: outfits.length },
          { label: "Total Wears", value: totalWears },
          { label: "Total Spend", value: `$${totalSpend.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-indigo-600">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Category Distribution</h3>
        <div className="space-y-2">
          {cats.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-28 text-sm text-gray-600 capitalize truncate">{cat}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${(count / maxCat) * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-5 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

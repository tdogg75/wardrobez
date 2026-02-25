import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Outfit } from "@/models/types";
import {
  getOutfits,
  saveOutfit,
  deleteOutfit as removeOutfit,
} from "@/services/storage";

interface OutfitsContextValue {
  outfits: Outfit[];
  loading: boolean;
  reload: () => Promise<void>;
  addOrUpdate: (outfit: Outfit) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const OutfitsContext = createContext<OutfitsContextValue | null>(null);

export function OutfitsProvider({ children }: { children: React.ReactNode }) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getOutfits();
    setOutfits(data.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addOrUpdate = useCallback(
    async (outfit: Outfit) => {
      await saveOutfit(outfit);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await removeOutfit(id);
      await reload();
    },
    [reload]
  );

  const value: OutfitsContextValue = {
    outfits,
    loading,
    reload,
    addOrUpdate,
    remove,
  };

  return React.createElement(OutfitsContext.Provider, { value }, children);
}

export function useOutfits(): OutfitsContextValue {
  const ctx = useContext(OutfitsContext);
  if (!ctx) {
    throw new Error("useOutfits must be used within an OutfitsProvider");
  }
  return ctx;
}

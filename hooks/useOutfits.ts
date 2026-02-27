import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Outfit } from "@/models/types";
import {
  getOutfits,
  saveOutfit,
  deleteOutfit as removeOutfit,
  logOutfitWorn,
  removeWornDate as removeWornDateStorage,
  markOutfitNotified,
} from "@/services/storage";

interface OutfitsContextValue {
  outfits: Outfit[];
  loading: boolean;
  reload: () => Promise<void>;
  addOrUpdate: (outfit: Outfit) => Promise<void>;
  remove: (id: string) => Promise<void>;
  logWorn: (outfitId: string) => Promise<void>;
  removeWornDate: (outfitId: string, dateIndex: number) => Promise<void>;
  markNotified: (outfitId: string) => Promise<void>;
  updateRating: (outfitId: string, rating: number) => Promise<void>;
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

  const logWorn = useCallback(
    async (outfitId: string) => {
      await logOutfitWorn(outfitId);
      await reload();
    },
    [reload]
  );

  const removeWornDate = useCallback(
    async (outfitId: string, dateIndex: number) => {
      await removeWornDateStorage(outfitId, dateIndex);
      await reload();
    },
    [reload]
  );

  const markNotified = useCallback(
    async (outfitId: string) => {
      await markOutfitNotified(outfitId);
      await reload();
    },
    [reload]
  );

  const updateRating = useCallback(
    async (outfitId: string, rating: number) => {
      const outfit = outfits.find((o) => o.id === outfitId);
      if (!outfit) return;
      await saveOutfit({ ...outfit, rating });
      await reload();
    },
    [outfits, reload]
  );

  const value: OutfitsContextValue = {
    outfits,
    loading,
    reload,
    addOrUpdate,
    remove,
    logWorn,
    removeWornDate,
    markNotified,
    updateRating,
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

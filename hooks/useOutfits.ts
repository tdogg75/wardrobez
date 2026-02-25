import { useCallback, useEffect, useState } from "react";
import type { Outfit } from "@/models/types";
import {
  getOutfits,
  saveOutfit,
  deleteOutfit as removeOutfit,
} from "@/services/storage";

export function useOutfits() {
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

  return { outfits, loading, reload, addOrUpdate, remove };
}

import { useCallback, useEffect, useState } from "react";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import {
  getClothingItems,
  saveClothingItem,
  deleteClothingItem as deleteItem,
} from "@/services/storage";

export function useClothingItems() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getClothingItems();
    setItems(data.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addOrUpdate = useCallback(
    async (item: ClothingItem) => {
      await saveClothingItem(item);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteItem(id);
      await reload();
    },
    [reload]
  );

  const getByCategory = useCallback(
    (category: ClothingCategory) => items.filter((i) => i.category === category),
    [items]
  );

  const getById = useCallback(
    (id: string) => items.find((i) => i.id === id) ?? null,
    [items]
  );

  return { items, loading, reload, addOrUpdate, remove, getByCategory, getById };
}

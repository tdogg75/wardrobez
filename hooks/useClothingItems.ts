import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ClothingItem, ClothingCategory } from "@/models/types";
import {
  getClothingItems,
  saveClothingItem,
  deleteClothingItem as deleteItem,
} from "@/services/storage";

interface ClothingItemsContextValue {
  items: ClothingItem[];
  loading: boolean;
  reload: () => Promise<void>;
  addOrUpdate: (item: ClothingItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getByCategory: (category: ClothingCategory) => ClothingItem[];
  getById: (id: string) => ClothingItem | null;
}

const ClothingItemsContext = createContext<ClothingItemsContextValue | null>(null);

export function ClothingItemsProvider({ children }: { children: React.ReactNode }) {
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

  const value: ClothingItemsContextValue = {
    items,
    loading,
    reload,
    addOrUpdate,
    remove,
    getByCategory,
    getById,
  };

  return React.createElement(ClothingItemsContext.Provider, { value }, children);
}

export function useClothingItems(): ClothingItemsContextValue {
  const ctx = useContext(ClothingItemsContext);
  if (!ctx) {
    throw new Error("useClothingItems must be used within a ClothingItemsProvider");
  }
  return ctx;
}

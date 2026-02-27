import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ClothingItem, ClothingCategory, ArchiveReason } from "@/models/types";
import {
  getClothingItems,
  saveClothingItem,
  deleteClothingItem as deleteItem,
  archiveItem as archiveStorageItem,
  unarchiveItem as unarchiveStorageItem,
} from "@/services/storage";

interface ClothingItemsContextValue {
  items: ClothingItem[];
  activeItems: ClothingItem[];
  archivedItems: ClothingItem[];
  loading: boolean;
  reload: () => Promise<void>;
  addOrUpdate: (item: ClothingItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  archiveItem: (id: string, reason: ArchiveReason) => Promise<void>;
  unarchiveItem: (id: string) => Promise<void>;
  getByCategory: (category: ClothingCategory) => ClothingItem[];
  getById: (id: string) => ClothingItem | null;
  getFavorites: () => ClothingItem[];
}

const ClothingItemsContext = createContext<ClothingItemsContextValue | null>(null);

export function ClothingItemsProvider({ children }: { children: React.ReactNode }) {
  const [allItems, setAllItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getClothingItems();
    setAllItems(data.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeItems = useMemo(
    () => allItems.filter((i) => !i.archived),
    [allItems]
  );

  const archivedItems = useMemo(
    () => allItems.filter((i) => i.archived),
    [allItems]
  );

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

  const archiveItem = useCallback(
    async (id: string, reason: ArchiveReason) => {
      await archiveStorageItem(id, reason);
      await reload();
    },
    [reload]
  );

  const unarchiveItem = useCallback(
    async (id: string) => {
      await unarchiveStorageItem(id);
      await reload();
    },
    [reload]
  );

  const getByCategory = useCallback(
    (category: ClothingCategory) => activeItems.filter((i) => i.category === category),
    [activeItems]
  );

  const getById = useCallback(
    (id: string) => allItems.find((i) => i.id === id) ?? null,
    [allItems]
  );

  const getFavorites = useCallback(
    () => activeItems.filter((i) => i.favorite),
    [activeItems]
  );

  const value: ClothingItemsContextValue = {
    items: activeItems,
    activeItems,
    archivedItems,
    loading,
    reload,
    addOrUpdate,
    remove,
    archiveItem,
    unarchiveItem,
    getByCategory,
    getById,
    getFavorites,
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

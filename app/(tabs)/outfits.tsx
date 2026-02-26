import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOutfits } from "@/hooks/useOutfits";
import { useClothingItems } from "@/hooks/useClothingItems";
import { MoodBoard } from "@/components/MoodBoard";
import { EmptyState } from "@/components/EmptyState";
import { Theme } from "@/constants/theme";
import { SEASON_LABELS } from "@/models/types";
import type { ClothingItem } from "@/models/types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function OutfitsScreen() {
  const { outfits, loading, remove, logWorn, updateRating } = useOutfits();
  const { getById } = useClothingItems();
  const router = useRouter();

  const handleLogWorn = (outfitId: string, outfitName: string) => {
    Alert.alert("Log Worn", `Mark "${outfitName}" as worn today?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log It",
        onPress: () => logWorn(outfitId),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : outfits.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="No outfits yet"
          subtitle="Head to the Suggest tab to get AI-powered outfit recommendations based on your wardrobe!"
        />
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: outfit }) => {
            const outfitItems = outfit.itemIds
              .map((id) => getById(id))
              .filter(Boolean) as ClothingItem[];

            const totalCost = outfitItems.reduce(
              (sum, i) => sum + (i.cost ?? 0),
              0
            );

            const isFlagged = outfit.hasRemovedItems && !outfit.removedItemNotified;

            return (
              <Pressable
                style={[
                  styles.card,
                  isFlagged && styles.cardFlagged,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/outfit-detail",
                    params: { id: outfit.id },
                  })
                }
              >
                <View style={styles.cardBody}>
                  {/* Mini Mood Board */}
                  <View style={styles.moodBoardWrap}>
                    <MoodBoard items={outfitItems} size={110} />
                  </View>

                  {/* Outfit Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {outfit.name}
                      </Text>
                      {outfit.suggested && (
                        <View style={styles.aiBadge}>
                          <Ionicons name="sparkles" size={10} color={Theme.colors.primary} />
                          <Text style={styles.aiBadgeText}>AI</Text>
                        </View>
                      )}
                    </View>

                    {/* Item names */}
                    <Text style={styles.itemList} numberOfLines={2}>
                      {outfitItems.map((i) => i?.name).join(" + ")}
                    </Text>

                    {/* Rating (tappable) */}
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable
                          key={star}
                          onPress={() => updateRating(outfit.id, star)}
                          hitSlop={4}
                        >
                          <Ionicons
                            name={star <= outfit.rating ? "star" : "star-outline"}
                            size={14}
                            color={star <= outfit.rating ? "#FFD700" : Theme.colors.textLight}
                          />
                        </Pressable>
                      ))}
                      <Text style={styles.itemCount}>
                        {outfitItems.length} items
                      </Text>
                    </View>

                    {/* Cost + Worn count */}
                    <View style={styles.metaRow}>
                      {totalCost > 0 && (
                        <Text style={styles.costText}>{fmt(totalCost)}</Text>
                      )}
                      {outfit.wornDates.length > 0 && (
                        <Text style={styles.wornText}>
                          Worn {outfit.wornDates.length}x
                        </Text>
                      )}
                    </View>

                    {(outfit.seasons ?? []).length > 0 && (
                      <Text style={styles.seasonText}>
                        {(outfit.seasons ?? []).map((s) => SEASON_LABELS[s]).join(", ")}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.logWornBtn}
                    onPress={() => handleLogWorn(outfit.id, outfit.name)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={Theme.colors.success} />
                    <Text style={styles.logWornText}>Log Worn</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => remove(outfit.id)}
                  >
                    <Ionicons name="trash-outline" size={14} color={Theme.colors.error} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  loader: { flex: 1, justifyContent: "center" },
  list: { padding: Theme.spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardFlagged: {
    shadowColor: "#F59E0B",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#F59E0B40",
  },
  cardBody: {
    flexDirection: "row",
    gap: 12,
  },
  moodBoardWrap: {
    borderRadius: Theme.borderRadius.sm,
    overflow: "hidden",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: Theme.colors.text,
    flex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Theme.colors.primary + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  itemList: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  itemCount: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  costText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  wornText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.success,
    fontWeight: "500",
  },
  seasonText: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
  },
  logWornBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.success + "12",
  },
  logWornText: {
    fontSize: Theme.fontSize.xs,
    fontWeight: "600",
    color: Theme.colors.success,
  },
  deleteBtn: {
    padding: 4,
  },
});

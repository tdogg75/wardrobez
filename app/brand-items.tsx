import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClothingItems } from "@/hooks/useClothingItems";
import { useTheme } from "@/hooks/useTheme";
import { CATEGORY_LABELS } from "@/models/types";

export default function BrandItemsScreen() {
  const { brand } = useLocalSearchParams<{ brand: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { items } = useClothingItems();
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: brand || "Brand" });
  }, [brand, navigation]);

  const brandItems = useMemo(
    () => items.filter((i) => i.brand?.toLowerCase().trim() === brand?.toLowerCase().trim()),
    [items, brand]
  );

  const totalValue = useMemo(
    () => brandItems.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    [brandItems]
  );

  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {brandItems.length} item{brandItems.length !== 1 ? "s" : ""}
          {totalValue > 0
            ? ` · ${totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
            : ""}
        </Text>
      </View>

      <FlatList
        data={brandItems}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/item-detail", params: { id: item.id } })}
          >
            {item.imageUris?.length > 0 ? (
              <Image source={{ uri: item.imageUris[0] }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardPlaceholder, { backgroundColor: item.color + "30" }]}>
                <Ionicons name="shirt-outline" size={32} color={item.color} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardCategory}>
                {CATEGORY_LABELS[item.category]}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    summary: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    summaryText: {
      fontSize: 14,
      color: theme.colors.textLight,
    },
    list: {
      padding: 8,
    },
    card: {
      flex: 1,
      margin: 6,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    cardImage: {
      width: "100%",
      aspectRatio: 1,
    },
    cardPlaceholder: {
      width: "100%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    cardInfo: {
      padding: 8,
    },
    cardName: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    cardCategory: {
      fontSize: 11,
      color: theme.colors.textLight,
      marginTop: 2,
    },
  });
}

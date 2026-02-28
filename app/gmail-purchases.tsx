import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "@/constants/theme";
import {
  signInWithGoogle,
  scanGmailForPurchases,
  getCachedToken,
  clearToken,
} from "@/services/gmailService";
import type { GmailPurchaseItem } from "@/services/gmailService";
import { useClothingItems } from "@/hooks/useClothingItems";
import { findClosestPresetIndex } from "@/constants/colors";
import { PRESET_COLORS } from "@/constants/colors";

type ScanState = "idle" | "signing_in" | "scanning" | "done" | "error";

export default function GmailPurchasesScreen() {
  const router = useRouter();
  const { addOrUpdate } = useClothingItems();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [purchases, setPurchases] = useState<GmailPurchaseItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  const startScan = useCallback(async () => {
    setScanState("signing_in");

    let token = getCachedToken();
    if (!token) {
      token = await signInWithGoogle();
    }

    if (!token) {
      Alert.alert("Sign-in failed", "Could not sign in to Google. Please try again.");
      setScanState("idle");
      return;
    }

    setScanState("scanning");

    try {
      const results = await scanGmailForPurchases(token, (loaded, total) => {
        setProgress({ loaded, total });
      });
      setPurchases(results);
      setCurrentIndex(0);
      setScanState("done");

      if (results.length === 0) {
        Alert.alert(
          "No purchases found",
          "We couldn't find any clothing, shoes, or accessories purchase emails from the last 2 years."
        );
      }
    } catch (err) {
      setScanState("error");
      Alert.alert("Scan failed", "Something went wrong scanning your emails. Please try again.");
    }
  }, []);

  const currentItem = purchases[currentIndex] ?? null;

  const handleAdd = async () => {
    if (!currentItem) return;

    const costStr = currentItem.price.replace(/[^0-9.]/g, "");
    const cost = parseFloat(costStr) || undefined;

    await addOrUpdate({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      name: currentItem.itemName,
      category: "tops", // Default — user can change after
      color: PRESET_COLORS[0].hex,
      colorName: PRESET_COLORS[0].name,
      fabricType: "other",
      imageUris: currentItem.localImageUri ? [currentItem.localImageUri] : [],
      brand: currentItem.vendor,
      cost,
      favorite: false,
      wearCount: 0,
      archived: false,
      createdAt: Date.now(),
      notes: `Purchased from ${currentItem.vendor} on ${currentItem.date}`,
    });

    setAddedIds((prev) => new Set(prev).add(currentItem.id));
    goNext();
  };

  const handleSkip = () => {
    if (!currentItem) return;
    setSkippedIds((prev) => new Set(prev).add(currentItem.id));
    goNext();
  };

  const goNext = () => {
    if (currentIndex < purchases.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleDone = () => {
    clearToken();
    router.back();
  };

  const remaining = purchases.filter(
    (p) => !addedIds.has(p.id) && !skippedIds.has(p.id)
  ).length;

  /* ---------- Render ---------- */

  if (scanState === "idle") {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-outline" size={64} color={Theme.colors.primary} />
        <Text style={styles.title}>Scan Gmail for Purchases</Text>
        <Text style={styles.subtitle}>
          Connect your Gmail to find clothing, shoes, jewelry, and accessories
          purchases from the last 2 years.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={startScan}>
          <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Connect Gmail</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (scanState === "signing_in") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Signing in to Google...</Text>
      </View>
    );
  }

  if (scanState === "scanning") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Scanning your emails...</Text>
        {progress.total > 0 && (
          <Text style={styles.progressText}>
            Checking {progress.loaded} of {progress.total} emails
          </Text>
        )}
      </View>
    );
  }

  if (scanState === "error") {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={64} color={Theme.colors.error} />
        <Text style={styles.title}>Something went wrong</Text>
        <Pressable style={styles.primaryBtn} onPress={startScan}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Done state — show purchases one by one
  if (purchases.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={64} color={Theme.colors.textLight} />
        <Text style={styles.title}>No Purchases Found</Text>
        <Text style={styles.subtitle}>
          We couldn't find any fashion-related purchase emails in the last 2 years.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isAdded = currentItem ? addedIds.has(currentItem.id) : false;
  const isSkipped = currentItem ? skippedIds.has(currentItem.id) : false;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleDone} hitSlop={12}>
          <Ionicons name="close" size={24} color={Theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gmail Purchases</Text>
        <Text style={styles.counter}>
          {currentIndex + 1} / {purchases.length}
        </Text>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Added: {addedIds.size} | Skipped: {skippedIds.size} | Remaining: {remaining}
        </Text>
      </View>

      {/* Current item card */}
      {currentItem && (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Thumbnail */}
            {currentItem.localImageUri || currentItem.thumbnailUrl ? (
              <Image
                source={{ uri: currentItem.localImageUri ?? currentItem.thumbnailUrl }}
                style={styles.thumbnail}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noImage}>
                <Ionicons name="image-outline" size={48} color={Theme.colors.textLight} />
                <Text style={styles.noImageText}>No image available</Text>
              </View>
            )}

            {/* Item details */}
            <View style={styles.detailSection}>
              <Text style={styles.vendorLabel}>Vendor</Text>
              <Text style={styles.vendorValue}>{currentItem.vendor}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Item</Text>
              <Text style={styles.detailValue}>{currentItem.itemName}</Text>
            </View>

            {currentItem.price ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.priceValue}>{currentItem.price}</Text>
              </View>
            ) : null}

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{currentItem.date}</Text>
            </View>

            {currentItem.snippet ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Email snippet</Text>
                <Text style={styles.snippetText}>{currentItem.snippet}</Text>
              </View>
            ) : null}

            {/* Status badge */}
            {isAdded && (
              <View style={[styles.statusBadge, styles.addedBadge]}>
                <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
                <Text style={[styles.statusBadgeText, { color: Theme.colors.success }]}>
                  Added to wardrobe
                </Text>
              </View>
            )}
            {isSkipped && (
              <View style={[styles.statusBadge, styles.skippedBadge]}>
                <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
                <Text style={[styles.statusBadgeText, { color: Theme.colors.textSecondary }]}>
                  Skipped
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Navigation + action buttons */}
      <View style={styles.bottomBar}>
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={currentIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentIndex === 0 ? Theme.colors.textLight : Theme.colors.text}
            />
            <Text
              style={[
                styles.navBtnText,
                currentIndex === 0 && styles.navBtnTextDisabled,
              ]}
            >
              Previous
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navBtn, currentIndex >= purchases.length - 1 && styles.navBtnDisabled]}
            onPress={goNext}
            disabled={currentIndex >= purchases.length - 1}
          >
            <Text
              style={[
                styles.navBtnText,
                currentIndex >= purchases.length - 1 && styles.navBtnTextDisabled,
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                currentIndex >= purchases.length - 1
                  ? Theme.colors.textLight
                  : Theme.colors.text
              }
            />
          </Pressable>
        </View>

        {!isAdded && !isSkipped && currentItem && (
          <View style={styles.actionRow}>
            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={handleAdd}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add to Wardrobe</Text>
            </Pressable>
          </View>
        )}

        {remaining === 0 && (
          <Pressable style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>
              Done — Added {addedIds.size} items
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.xl,
  },
  title: {
    fontSize: Theme.fontSize.xl,
    fontWeight: "700",
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xl,
    lineHeight: 22,
  },
  loadingText: {
    fontSize: Theme.fontSize.lg,
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
  },
  progressText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Theme.borderRadius.md,
    marginTop: Theme.spacing.md,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: Theme.spacing.md,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.text,
  },
  counter: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  summaryBar: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.surfaceAlt,
  },
  summaryText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    overflow: "hidden",
    shadowColor: Theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: "100%",
    height: 200,
    backgroundColor: Theme.colors.surfaceAlt,
  },
  noImage: {
    width: "100%",
    height: 120,
    backgroundColor: Theme.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textLight,
    marginTop: 4,
  },
  detailSection: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  vendorLabel: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  vendorValue: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.primary,
    marginTop: 2,
  },
  detailLabel: {
    fontSize: Theme.fontSize.xs,
    color: Theme.colors.textLight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: Theme.fontSize.md,
    color: Theme.colors.text,
    marginTop: 2,
  },
  priceValue: {
    fontSize: Theme.fontSize.lg,
    fontWeight: "700",
    color: Theme.colors.success,
    marginTop: 2,
  },
  snippetText: {
    fontSize: Theme.fontSize.sm,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  addedBadge: {
    backgroundColor: Theme.colors.success + "15",
  },
  skippedBadge: {
    backgroundColor: Theme.colors.surfaceAlt,
  },
  statusBadgeText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
  },
  bottomBar: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingBottom: Theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.sm,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  navBtnTextDisabled: {
    color: Theme.colors.textLight,
  },
  actionRow: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  skipBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  skipBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  addBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
  },
  addBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.success,
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

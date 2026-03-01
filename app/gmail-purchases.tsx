import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import {
  signInWithGoogle,
  scanGmailForPurchases,
  getCachedToken,
  clearToken,
  setManualToken,
  getSavedClientId,
  saveClientId,
  isOAuthRedirectSupported,
  markEmailImported,
} from "@/services/gmailService";
import type { GmailPurchaseItem, GmailLineItem } from "@/services/gmailService";
import { fetchProductFromUrl } from "@/services/productSearch";
import type { ClothingCategory, FabricType } from "@/models/types";
import { CATEGORY_LABELS, SUBCATEGORIES, FABRIC_TYPE_LABELS } from "@/models/types";
import { useClothingItems } from "@/hooks/useClothingItems";
import { PRESET_COLORS } from "@/constants/colors";

type ScanState =
  | "idle"
  | "signing_in"
  | "scanning"
  | "reviewing_emails"
  | "reviewing_items"
  | "need_client_id"
  | "manual_token"
  | "error";

interface EditableLineItem extends GmailLineItem {
  selected: boolean;
  brand: string;
  category: ClothingCategory;
  cost: string;
  url: string;
  fetchingDetails: boolean;
  subCategory?: string;
  colorHex?: string;
  colorName?: string;
  fabricType?: string;
}

export default function GmailPurchasesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { addOrUpdate } = useClothingItems();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [purchases, setPurchases] = useState<GmailPurchaseItem[]>([]);
  const [scanningDone, setScanningDone] = useState(false);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [importedEmailCount, setImportedEmailCount] = useState(0);
  const [skippedEmailCount, setSkippedEmailCount] = useState(0);
  const [totalItemsAdded, setTotalItemsAdded] = useState(0);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [clientId, setClientId] = useState("");
  const [clientIdInput, setClientIdInput] = useState("");
  const [manualTokenInput, setManualTokenInput] = useState("");

  // reviewing_items state
  const [editableItems, setEditableItems] = useState<EditableLineItem[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Load saved client ID on mount
  useEffect(() => {
    getSavedClientId().then((id) => {
      if (id) setClientId(id);
    });
  }, []);

  const currentEmail = purchases[currentEmailIndex] ?? null;
  const remaining = purchases.length - currentEmailIndex;

  const handleSaveClientId = async () => {
    const trimmed = clientIdInput.trim();
    if (!trimmed || !trimmed.includes(".apps.googleusercontent.com")) {
      Alert.alert(
        "Invalid Client ID",
        "Please enter a valid Google OAuth Client ID. It should end with .apps.googleusercontent.com"
      );
      return;
    }
    await saveClientId(trimmed);
    setClientId(trimmed);
    setScanState("idle");
  };

  const runScanWithToken = useCallback(async (token: string) => {
    setScanState("scanning");
    setPurchases([]);
    setScanningDone(false);
    setCurrentEmailIndex(0);
    setImportedEmailCount(0);
    setSkippedEmailCount(0);
    setTotalItemsAdded(0);

    try {
      // Switch to reviewing_emails immediately so results stream in
      let hasStartedReview = false;

      const results = await scanGmailForPurchases(
        token,
        (loaded, total) => {
          setProgress({ loaded, total });
        },
        (item) => {
          setPurchases((prev) => [...prev, item]);
          if (!hasStartedReview) {
            hasStartedReview = true;
            setScanState("reviewing_emails");
          }
        }
      );

      setScanningDone(true);

      // If no results came through the callback, handle the empty case
      if (results.length === 0) {
        Alert.alert(
          "No purchases found",
          "We couldn't find any clothing, shoes, or accessories purchase emails from the last 2 years."
        );
        setScanState("idle");
      } else if (!hasStartedReview) {
        // Fallback: if onItem was never called but results exist, set them
        setPurchases(results);
        setScanState("reviewing_emails");
      }
    } catch (err) {
      setScanningDone(true);
      setScanState("error");
      Alert.alert("Scan failed", "Something went wrong scanning your emails. Please try again.");
    }
  }, []);

  const startScan = useCallback(async () => {
    let id = clientId;
    if (!id) {
      id = (await getSavedClientId()) ?? "";
    }
    if (!id) {
      setScanState("need_client_id");
      return;
    }

    setScanState("signing_in");

    let token = getCachedToken();
    if (!token) {
      token = await signInWithGoogle(id);
    }

    if (!token) {
      Alert.alert("Sign-in failed", "Could not sign in to Google. Please try again.");
      setScanState("idle");
      return;
    }

    await runScanWithToken(token);
  }, [clientId, runScanWithToken]);

  const handleManualToken = useCallback(async () => {
    const token = manualTokenInput.trim();
    if (!token) {
      Alert.alert("Enter a token", "Please paste a valid Gmail API access token.");
      return;
    }
    setManualToken(token);
    await runScanWithToken(token);
  }, [manualTokenInput, runScanWithToken]);

  /* ---------- Email review actions ---------- */

  const handleShowItems = () => {
    if (!currentEmail) return;
    const items: EditableLineItem[] = currentEmail.lineItems.map((li) => ({
      ...li,
      selected: true,
      brand: currentEmail.vendor,
      category: "tops" as ClothingCategory,
      cost: li.price?.replace(/[^0-9.]/g, "") ?? "",
      url: li.productUrl ?? "",
      fetchingDetails: false,
    }));
    setEditableItems(items);
    setScanState("reviewing_items");
  };

  const handleSkipEmail = () => {
    setSkippedEmailCount((c) => c + 1);
    goToNextEmail();
  };

  const handleStopScanning = () => {
    Alert.alert(
      "Scanning Complete",
      `Added ${totalItemsAdded} items from ${importedEmailCount} emails.`,
      [{ text: "OK", onPress: () => { clearToken(); router.back(); } }]
    );
  };

  const goToNextEmail = () => {
    if (currentEmailIndex < purchases.length - 1) {
      setCurrentEmailIndex((i) => i + 1);
    } else {
      // No more emails
      handleStopScanning();
    }
  };

  const goToPrevEmail = () => {
    if (currentEmailIndex > 0) {
      setCurrentEmailIndex((i) => i - 1);
    }
  };

  /* ---------- Item review actions ---------- */

  const toggleItemSelected = (index: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setEditModalVisible(true);
  };

  const updateEditableItem = (index: number, updates: Partial<EditableLineItem>) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleFetchDetails = async (index: number) => {
    const item = editableItems[index];
    if (!item.url) return;

    updateEditableItem(index, { fetchingDetails: true });

    try {
      const result = await fetchProductFromUrl(item.url);
      if (result) {
        const updates: Partial<EditableLineItem> = { fetchingDetails: false };
        if (result.name) updates.name = result.name;
        if (result.brand) updates.brand = result.brand;
        if (result.category) updates.category = result.category;
        if (result.cost != null) updates.cost = result.cost.toString();
        if (result.imageUri) updates.localImageUri = result.imageUri;
        updateEditableItem(index, updates);
      } else {
        updateEditableItem(index, { fetchingDetails: false });
        Alert.alert("No details found", "Could not extract product details from that URL.");
      }
    } catch {
      updateEditableItem(index, { fetchingDetails: false });
      Alert.alert("Fetch failed", "Could not load product details from that URL.");
    }
  };

  const handleAddSelectedToWardrobe = async () => {
    if (!currentEmail) return;

    const selected = editableItems.filter((item) => item.selected);
    if (selected.length === 0) {
      Alert.alert("No items selected", "Please select at least one item to add.");
      return;
    }

    for (const item of selected) {
      const cost = parseFloat(item.cost) || undefined;

      await addOrUpdate({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
        name: item.name,
        category: item.category,
        subCategory: item.subCategory,
        color: item.colorHex || PRESET_COLORS[0].hex,
        colorName: item.colorName || PRESET_COLORS[0].name,
        fabricType: (item.fabricType as FabricType) || "other",
        imageUris: item.localImageUri ? [item.localImageUri] : [],
        brand: item.brand || undefined,
        productUrl: item.url || undefined,
        cost,
        purchaseDate: currentEmail.date,
        favorite: false,
        wearCount: 0,
        archived: false,
        createdAt: Date.now(),
        notes: `Purchased from ${currentEmail.vendor} on ${currentEmail.date}`,
      });
    }

    await markEmailImported(currentEmail.id);
    setImportedEmailCount((c) => c + 1);
    setTotalItemsAdded((c) => c + selected.length);
    setScanState("reviewing_emails");
    goToNextEmail();
  };

  const handleBackToEmails = () => {
    setScanState("reviewing_emails");
  };

  /* ---------- Render helpers ---------- */

  const categoryKeys = Object.keys(CATEGORY_LABELS) as ClothingCategory[];

  /* ---------- Render: need_client_id ---------- */

  if (scanState === "need_client_id") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.center}
        keyboardShouldPersistTaps="handled"
      >
        <Ionicons name="key-outline" size={64} color={theme.colors.primary} />
        <Text style={styles.title}>Google OAuth Setup</Text>
        <Text style={styles.subtitle}>
          To scan your Gmail, you need a Google OAuth Client ID. Follow these steps:{"\n\n"}
          1. Go to Google Cloud Console{"\n"}
          2. Create a project (or select existing){"\n"}
          3. Enable the Gmail API{"\n"}
          4. Go to Credentials → Create OAuth 2.0 Client ID{"\n"}
          5. Select <Text style={{ fontWeight: "700" }}>"Desktop app"</Text> as the application type{"\n"}
          6. Give it any name (e.g. "Wardrobez"){"\n"}
          7. Click Create — no redirect URIs needed for Desktop apps{"\n"}
          8. Copy the <Text style={{ fontWeight: "700" }}>Client ID</Text> and paste it below
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.colors.textSecondary }]}
          onPress={() => Linking.openURL("https://console.cloud.google.com/apis/credentials")}
        >
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Open Google Cloud Console</Text>
        </Pressable>
        <View style={styles.clientIdInputWrap}>
          <Text style={styles.clientIdLabel}>OAuth Client ID</Text>
          <TextInput
            style={styles.clientIdInput}
            value={clientIdInput}
            onChangeText={setClientIdInput}
            placeholder="xxxx.apps.googleusercontent.com"
            placeholderTextColor={theme.colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.primaryBtn} onPress={handleSaveClientId}>
            <Text style={styles.primaryBtnText}>Save & Continue</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* ---------- Render: manual_token ---------- */

  if (scanState === "manual_token") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.center}
        keyboardShouldPersistTaps="handled"
      >
        <Ionicons name="key-outline" size={64} color={theme.colors.primary} />
        <Text style={styles.title}>Manual Gmail Token</Text>
        <Text style={styles.subtitle}>
          1. Open{" "}
          <Text
            style={{ fontWeight: "700", color: theme.colors.primary }}
            onPress={() =>
              Linking.openURL(
                "https://developers.google.com/oauthplayground"
              )
            }
          >
            OAuth Playground
          </Text>{"\n"}
          2. In the left panel, scroll to <Text style={{ fontWeight: "700" }}>Gmail API v1</Text>{"\n"}
          3. Select <Text style={{ fontWeight: "700" }}>gmail.readonly</Text>{"\n"}
          4. Click <Text style={{ fontWeight: "700" }}>Authorize APIs</Text> and sign in{"\n"}
          5. Click <Text style={{ fontWeight: "700" }}>Exchange authorization code for tokens</Text>{"\n"}
          6. Copy the <Text style={{ fontWeight: "700" }}>Access token</Text> and paste below
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}
          onPress={() =>
            Linking.openURL("https://developers.google.com/oauthplayground")
          }
        >
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Open OAuth Playground</Text>
        </Pressable>
        <View style={styles.clientIdInputWrap}>
          <Text style={styles.clientIdLabel}>Gmail Access Token</Text>
          <TextInput
            style={[styles.clientIdInput, { minHeight: 80, textAlignVertical: "top" }]}
            value={manualTokenInput}
            onChangeText={setManualTokenInput}
            placeholder="ya29.a0AfH..."
            placeholderTextColor={theme.colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Pressable style={styles.primaryBtn} onPress={handleManualToken}>
            <Ionicons name="search" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Scan Emails</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => setScanState("idle")}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* ---------- Render: idle ---------- */

  const oauthSupported = isOAuthRedirectSupported();

  if (scanState === "idle") {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-outline" size={64} color={theme.colors.primary} />
        <Text style={styles.title}>Scan Gmail for Purchases</Text>
        <Text style={styles.subtitle}>
          Connect your Gmail to find clothing, shoes, jewelry, and accessories
          purchases from the last 2 years.
        </Text>
        {oauthSupported ? (
          <Pressable style={styles.primaryBtn} onPress={startScan}>
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Connect Gmail</Text>
          </Pressable>
        ) : (
          <View style={styles.expoGoWarning}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.expoGoWarningText}>
              Google sign-in requires a standalone APK.{"\n"}
              Use <Text style={{ fontWeight: "700" }}>Manual Token</Text> below to scan from Expo Go, or build an APK with{" "}
              <Text style={{ fontWeight: "700" }}>npm run build:apk</Text>.
            </Text>
          </View>
        )}

        {/* Manual token entry — works in Expo Go */}
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.colors.textSecondary }]}
          onPress={() => setScanState("manual_token")}
        >
          <Ionicons name="key-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Enter Token Manually</Text>
        </Pressable>

        {clientId ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              setClientIdInput(clientId);
              setScanState("need_client_id");
            }}
          >
            <Text style={styles.secondaryBtnText}>Change Client ID</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  /* ---------- Render: signing_in ---------- */

  if (scanState === "signing_in") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Signing in to Google...</Text>
      </View>
    );
  }

  /* ---------- Render: scanning ---------- */

  if (scanState === "scanning") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Scanning your emails...</Text>
        {progress.total > 0 && (
          <Text style={styles.progressText}>
            Checking {progress.loaded} of {progress.total} emails
          </Text>
        )}
      </View>
    );
  }

  /* ---------- Render: error ---------- */

  if (scanState === "error") {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={64} color={theme.colors.error} />
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

  /* ---------- Render: reviewing_items ---------- */

  if (scanState === "reviewing_items" && currentEmail) {
    const editingItem = editingIndex >= 0 ? editableItems[editingIndex] : null;

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBackToEmails} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentEmail.vendor} Items
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Select All / Uncheck All row */}
        <View style={styles.selectionRow}>
          <Text style={styles.selectionCount}>
            {editableItems.filter((i) => i.selected).length} of {editableItems.length} selected
          </Text>
          <View style={styles.selectionButtons}>
            <Pressable
              style={styles.selectionBtn}
              onPress={() =>
                setEditableItems((prev) => prev.map((item) => ({ ...item, selected: true })))
              }
            >
              <Ionicons name="checkbox-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.selectionBtnText}>Select All</Text>
            </Pressable>
            <Pressable
              style={styles.selectionBtn}
              onPress={() =>
                setEditableItems((prev) => prev.map((item) => ({ ...item, selected: false })))
              }
            >
              <Ionicons name="square-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.selectionBtnText, { color: theme.colors.textSecondary }]}>Uncheck All</Text>
            </Pressable>
          </View>
        </View>

        {/* Items list */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {editableItems.map((item, index) => (
            <View key={index} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => toggleItemSelected(index)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={item.selected ? "checkbox" : "square-outline"}
                    size={24}
                    color={item.selected ? theme.colors.primary : theme.colors.textLight}
                  />
                </Pressable>
                <View style={styles.lineItemInfo}>
                  {(item.localImageUri || item.imageUrl) ? (
                    <Image
                      source={{ uri: item.localImageUri ?? item.imageUrl }}
                      style={styles.lineItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.lineItemImagePlaceholder}>
                      <Ionicons name="image-outline" size={24} color={theme.colors.textLight} />
                    </View>
                  )}
                  <View style={styles.lineItemText}>
                    <Text style={styles.lineItemName} numberOfLines={2}>{item.name}</Text>
                    {item.price ? (
                      <Text style={styles.lineItemPrice}>{item.price}</Text>
                    ) : null}
                    <Text style={styles.lineItemCategory}>
                      {CATEGORY_LABELS[item.category]} | {item.brand}
                    </Text>
                    {item.url ? (
                      <Text
                        style={styles.lineItemUrl}
                        numberOfLines={1}
                        onPress={() => Linking.openURL(item.url)}
                      >
                        {item.url}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.lineItemActions}>
                {item.url ? (
                  <Pressable
                    style={styles.fetchBtn}
                    onPress={() => handleFetchDetails(index)}
                    disabled={item.fetchingDetails}
                  >
                    {item.fetchingDetails ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.fetchBtnText}>Fetch Details</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => openEditModal(index)}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.addSelectedBtn} onPress={handleAddSelectedToWardrobe}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addSelectedBtnText}>
              Add Selected to Wardrobe ({editableItems.filter((i) => i.selected).length})
            </Text>
          </Pressable>
          <Pressable style={styles.backToEmailsBtn} onPress={handleBackToEmails}>
            <Text style={styles.backToEmailsBtnText}>Back to Emails</Text>
          </Pressable>
        </View>

        {/* Edit Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Item</Text>
                <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </Pressable>
              </View>

              {editingItem && (
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                  <Text style={styles.modalLabel}>Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.name}
                    onChangeText={(v) => updateEditableItem(editingIndex, { name: v })}
                    placeholder="Item name"
                    placeholderTextColor={theme.colors.textLight}
                  />

                  <Text style={styles.modalLabel}>Brand</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.brand}
                    onChangeText={(v) => updateEditableItem(editingIndex, { brand: v })}
                    placeholder="Brand"
                    placeholderTextColor={theme.colors.textLight}
                  />

                  <Text style={styles.modalLabel}>Category</Text>
                  <View style={styles.categoryPicker}>
                    {categoryKeys.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[
                          styles.categoryChip,
                          editingItem.category === cat && styles.categoryChipActive,
                        ]}
                        onPress={() => updateEditableItem(editingIndex, { category: cat })}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            editingItem.category === cat && styles.categoryChipTextActive,
                          ]}
                        >
                          {CATEGORY_LABELS[cat]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Subcategory chips */}
                  {SUBCATEGORIES[editingItem.category]?.length > 0 && (
                    <>
                      <Text style={styles.modalLabel}>Subcategory</Text>
                      <View style={styles.categoryPicker}>
                        {SUBCATEGORIES[editingItem.category].map((sub) => (
                          <Pressable
                            key={sub.value}
                            style={[
                              styles.categoryChip,
                              editingItem.subCategory === sub.value && styles.categoryChipActive,
                            ]}
                            onPress={() =>
                              updateEditableItem(editingIndex, {
                                subCategory: editingItem.subCategory === sub.value ? undefined : sub.value,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                editingItem.subCategory === sub.value && styles.categoryChipTextActive,
                              ]}
                            >
                              {sub.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Color picker */}
                  <Text style={styles.modalLabel}>Color</Text>
                  <View style={styles.colorPickerRow}>
                    {PRESET_COLORS.map((c) => (
                      <Pressable
                        key={c.hex}
                        style={[
                          styles.colorDot,
                          { backgroundColor: c.hex },
                          editingItem.colorHex === c.hex && styles.colorDotSelected,
                        ]}
                        onPress={() =>
                          updateEditableItem(editingIndex, { colorHex: c.hex, colorName: c.name })
                        }
                      >
                        {editingItem.colorHex === c.hex && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={c.hex === "#FFFFFF" || c.hex === "#FFFDD0" || c.hex === "#F5F5DC" ? "#000000" : "#FFFFFF"}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                  {editingItem.colorName ? (
                    <Text style={styles.colorNameLabel}>{editingItem.colorName}</Text>
                  ) : null}

                  {/* Fabric type chips */}
                  <Text style={styles.modalLabel}>Fabric</Text>
                  <View style={styles.categoryPicker}>
                    {(Object.keys(FABRIC_TYPE_LABELS) as FabricType[]).map((ft) => (
                      <Pressable
                        key={ft}
                        style={[
                          styles.categoryChip,
                          editingItem.fabricType === ft && styles.categoryChipActive,
                        ]}
                        onPress={() =>
                          updateEditableItem(editingIndex, {
                            fabricType: editingItem.fabricType === ft ? undefined : ft,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            editingItem.fabricType === ft && styles.categoryChipTextActive,
                          ]}
                        >
                          {FABRIC_TYPE_LABELS[ft]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.modalLabel}>Cost</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.cost}
                    onChangeText={(v) => updateEditableItem(editingIndex, { cost: v })}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textLight}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>Product URL</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.url}
                    onChangeText={(v) => updateEditableItem(editingIndex, { url: v })}
                    placeholder="https://..."
                    placeholderTextColor={theme.colors.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </ScrollView>
              )}

              <Pressable
                style={styles.modalDoneBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalDoneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  /* ---------- Render: reviewing_emails ---------- */

  if (scanState === "reviewing_emails") {
    if (purchases.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textLight} />
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

    if (!currentEmail) {
      // Reached end of emails
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.success} />
          <Text style={styles.title}>All Done!</Text>
          <Text style={styles.subtitle}>
            Added {totalItemsAdded} items from {importedEmailCount} emails.{"\n"}
            Skipped {skippedEmailCount} emails.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => { clearToken(); router.back(); }}
          >
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleStopScanning} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Gmail Purchases</Text>
          <Text style={styles.counter}>
            Email {currentEmailIndex + 1} of {purchases.length}
          </Text>
        </View>

        {/* Scanning indicator */}
        {!scanningDone && (
          <View style={styles.scanningBanner}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.scanningBannerText}>
              Still scanning emails{progress.total > 0 ? ` (${progress.loaded}/${progress.total})` : ""}...
            </Text>
          </View>
        )}

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            Imported: {importedEmailCount} | Skipped: {skippedEmailCount} | Remaining: {remaining}
          </Text>
        </View>

        {/* Current email card */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Previously imported badge */}
            {currentEmail.previouslyImported && (
              <View style={styles.importedBadge}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.warning} />
                <Text style={styles.importedBadgeText}>Already Imported</Text>
              </View>
            )}

            {/* Thumbnail */}
            {currentEmail.localImageUri || currentEmail.thumbnailUrl ? (
              <Image
                source={{ uri: currentEmail.localImageUri ?? currentEmail.thumbnailUrl }}
                style={styles.thumbnail}
                resizeMode="contain"
              />
            ) : null}

            {/* Email details */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{currentEmail.from}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.vendorLabel}>Vendor</Text>
              <Text style={styles.vendorValue}>{currentEmail.vendor}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailValue} numberOfLines={3}>{currentEmail.subject}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{currentEmail.date}</Text>
            </View>

            {currentEmail.snippet ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Summary</Text>
                <Text style={styles.snippetText}>{currentEmail.snippet}</Text>
              </View>
            ) : null}

            {currentEmail.price ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.priceValue}>{currentEmail.price}</Text>
              </View>
            ) : null}

            {currentEmail.lineItems.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  Detected Items ({currentEmail.lineItems.length})
                </Text>
                {currentEmail.lineItems.slice(0, 5).map((li, i) => (
                  <Text key={i} style={styles.lineItemPreview}>
                    {li.name}{li.price ? ` - ${li.price}` : ""}
                  </Text>
                ))}
                {currentEmail.lineItems.length > 5 && (
                  <Text style={styles.lineItemPreview}>
                    ...and {currentEmail.lineItems.length - 5} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Navigation + action buttons */}
        <View style={styles.bottomBar}>
          {/* Navigation arrows */}
          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, currentEmailIndex === 0 && styles.navBtnDisabled]}
              onPress={goToPrevEmail}
              disabled={currentEmailIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={currentEmailIndex === 0 ? theme.colors.textLight : theme.colors.text}
              />
              <Text
                style={[
                  styles.navBtnText,
                  currentEmailIndex === 0 && styles.navBtnTextDisabled,
                ]}
              >
                Previous
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.navBtn,
                currentEmailIndex >= purchases.length - 1 && styles.navBtnDisabled,
              ]}
              onPress={() => {
                if (currentEmailIndex < purchases.length - 1) {
                  setCurrentEmailIndex((i) => i + 1);
                }
              }}
              disabled={currentEmailIndex >= purchases.length - 1}
            >
              <Text
                style={[
                  styles.navBtnText,
                  currentEmailIndex >= purchases.length - 1 && styles.navBtnTextDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  currentEmailIndex >= purchases.length - 1
                    ? theme.colors.textLight
                    : theme.colors.text
                }
              />
            </Pressable>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.skipBtn} onPress={handleSkipEmail}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              <Text style={styles.skipBtnText}>No - Skip</Text>
            </Pressable>
            <Pressable style={styles.showItemsBtn} onPress={handleShowItems}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.showItemsBtnText}>Yes - Show Items</Text>
            </Pressable>
          </View>

          <Pressable style={styles.stopBtn} onPress={handleStopScanning}>
            <Text style={styles.stopBtnText}>Stop Scanning</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Fallback
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof import("@/hooks/useTheme").useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    title: {
      fontSize: theme.fontSize.xl,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      textAlign: "center",
    },
    subtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    loadingText: {
      fontSize: theme.fontSize.lg,
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
    },
    progressText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.md,
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
    },
    secondaryBtn: {
      marginTop: theme.spacing.md,
      paddingVertical: 10,
    },
    secondaryBtnText: {
      color: theme.colors.textSecondary,
      fontSize: theme.fontSize.md,
      fontWeight: "600",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
      textAlign: "center",
      marginHorizontal: theme.spacing.sm,
    },
    counter: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    summaryBar: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceAlt,
    },
    summaryText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      overflow: "hidden",
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 2,
    },
    importedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.warning + "20",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    importedBadgeText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.warning,
    },
    thumbnail: {
      width: "100%",
      height: 200,
      backgroundColor: theme.colors.surfaceAlt,
    },
    detailSection: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    vendorLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textLight,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    vendorValue: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.primary,
      marginTop: 2,
    },
    detailLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textLight,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    detailValue: {
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      marginTop: 2,
    },
    priceValue: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.success,
      marginTop: 2,
    },
    snippetText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    lineItemPreview: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      marginTop: 4,
      paddingLeft: theme.spacing.sm,
    },
    bottomBar: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    navRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
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
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.text,
    },
    navBtnTextDisabled: {
      color: theme.colors.textLight,
    },
    actionRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    skipBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    skipBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    showItemsBtn: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.success,
    },
    showItemsBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    stopBtn: {
      alignItems: "center",
      paddingVertical: 10,
    },
    stopBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },

    /* ---------- Line item card styles ---------- */

    lineItemCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 1,
    },
    lineItemHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    checkbox: {
      paddingTop: 2,
    },
    lineItemInfo: {
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    lineItemImage: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surfaceAlt,
    },
    lineItemImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    lineItemText: {
      flex: 1,
    },
    lineItemName: {
      fontSize: theme.fontSize.md,
      fontWeight: "600",
      color: theme.colors.text,
    },
    lineItemPrice: {
      fontSize: theme.fontSize.sm,
      fontWeight: "700",
      color: theme.colors.success,
      marginTop: 2,
    },
    lineItemCategory: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    lineItemUrl: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.primary,
      marginTop: 2,
    },
    lineItemActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    fetchBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    fetchBtnText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editBtnText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    addSelectedBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    addSelectedBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    backToEmailsBtn: {
      alignItems: "center",
      paddingVertical: 10,
      marginTop: theme.spacing.xs,
    },
    backToEmailsBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },

    /* ---------- Modal styles ---------- */

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      maxHeight: "85%",
      paddingBottom: theme.spacing.xl,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: "700",
      color: theme.colors.text,
    },
    modalScroll: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    modalLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    modalInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryPicker: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    categoryChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    categoryChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + "15",
    },
    categoryChipText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    categoryChipTextActive: {
      color: theme.colors.primary,
    },
    modalDoneBtn: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.lg,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
    },
    modalDoneBtnText: {
      fontSize: theme.fontSize.md,
      fontWeight: "700",
      color: "#FFFFFF",
    },

    /* ---------- Existing utility styles ---------- */

    clientIdInputWrap: {
      width: "100%",
      marginTop: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    clientIdLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.text,
    },
    clientIdInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      fontSize: theme.fontSize.sm,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    expoGoWarning: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: theme.colors.warning + "15",
      borderWidth: 1,
      borderColor: theme.colors.warning + "40",
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      width: "100%",
    },
    expoGoWarningText: {
      flex: 1,
      fontSize: theme.fontSize.sm,
      color: theme.colors.warning,
      lineHeight: 20,
    },

    /* ---------- Scanning banner ---------- */

    scanningBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.primary + "12",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.primary + "30",
    },
    scanningBannerText: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.primary,
    },

    /* ---------- Selection row ---------- */

    selectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    selectionCount: {
      fontSize: theme.fontSize.sm,
      fontWeight: "600",
      color: theme.colors.text,
    },
    selectionButtons: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    selectionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    selectionBtnText: {
      fontSize: theme.fontSize.xs,
      fontWeight: "600",
      color: theme.colors.primary,
    },

    /* ---------- Color picker ---------- */

    colorPickerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    colorDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    colorDotSelected: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    colorNameLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
  });

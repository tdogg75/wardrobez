import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { lookupBarcode } from "@/services/barcodeService";
import type { BarcodeProductResult } from "@/services/barcodeService";

let CameraView: any = null;
let useCameraPermissions: any = null;

try {
  const mod = require("expo-camera");
  CameraView = mod.CameraView;
  useCameraPermissions = mod.useCameraPermissions;
} catch {
  // expo-camera not installed
}

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [scanned, setScanned] = useState(false);
  const [looking, setLooking] = useState(false);

  // Camera permissions — only available if expo-camera is installed
  const permissionHook = useCameraPermissions ? useCameraPermissions() : [null, null];
  const permission = permissionHook?.[0];
  const requestPermission = permissionHook?.[1];

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned || looking) return;
      setScanned(true);
      setLooking(true);

      try {
        const result = await lookupBarcode(data);
        if (result && (result.name || result.brand)) {
          // Pass result back via router params
          router.replace({
            pathname: "/add-item",
            params: {
              barcodeResult: JSON.stringify(result),
            },
          });
        } else {
          Alert.alert(
            "Product Not Found",
            `We couldn't find product info for barcode: ${data}. You can enter details manually.`,
            [
              { text: "Try Again", onPress: () => { setScanned(false); setLooking(false); } },
              { text: "Enter Manually", onPress: () => router.back() },
            ]
          );
          setLooking(false);
        }
      } catch {
        Alert.alert("Lookup Failed", "Something went wrong looking up the barcode.", [
          { text: "Try Again", onPress: () => { setScanned(false); setLooking(false); } },
          { text: "Cancel", onPress: () => router.back() },
        ]);
        setLooking(false);
      }
    },
    [scanned, looking, router]
  );

  // If expo-camera is not installed
  if (!CameraView) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color={theme.colors.textLight} />
          <Text style={[styles.noCamera, { color: theme.colors.text }]}>
            Camera Not Available
          </Text>
          <Text style={[styles.noCameraHint, { color: theme.colors.textLight }]}>
            Install expo-camera to enable barcode scanning:{"\n"}
            npx expo install expo-camera
          </Text>
          <Pressable
            style={[styles.backBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Permission not granted yet
  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={theme.colors.textLight} />
          <Text style={[styles.noCamera, { color: theme.colors.text }]}>
            Camera Permission Needed
          </Text>
          <Text style={[styles.noCameraHint, { color: theme.colors.textLight }]}>
            We need camera access to scan barcodes.
          </Text>
          <Pressable
            style={[styles.backBtn, { backgroundColor: theme.colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.backBtnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "qr",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          <Text style={styles.topTitle}>Scan Barcode</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>

        {/* Bottom hint */}
        <View style={styles.bottomBar}>
          {looking ? (
            <View style={styles.lookingRow}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.hint}>Looking up product...</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              Point camera at a barcode or QR code
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  noCamera: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  noCameraHint: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  topTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  viewfinder: {
    width: 250,
    height: 250,
    alignSelf: "center",
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFF",
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFF",
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFF",
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFF",
  },
  bottomBar: {
    paddingBottom: 60,
    alignItems: "center",
  },
  lookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hint: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});

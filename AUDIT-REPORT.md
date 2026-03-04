# Wardrobez Security Audit & QA Report

**Date:** 2026-03-03
**Scope:** Full codebase review (services, screens, hooks, components, models)

---

## Security Audit Findings

### CRITICAL

| # | Issue | File | Status |
|---|-------|------|--------|
| S1 | **OAuth Implicit Grant with PKCE disabled** — Gmail OAuth used `ResponseType.Token` (implicit flow) with `usePKCE: false`, exposing access tokens in URL fragments. Google has deprecated this flow for mobile apps. | `services/gmailService.ts:113-118` | **FIXED** — Switched to Authorization Code flow with PKCE enabled |

### HIGH

| # | Issue | File | Status |
|---|-------|------|--------|
| S2 | OAuth access token stored in plain memory variable with no expiry tracking | `services/gmailService.ts:91` | **FIXED** — Token now persisted in `expo-secure-store` |
| S3 | Google OAuth Client ID stored as plain text file on device filesystem | `services/gmailService.ts:45-65` | **FIXED** — Migrated to `expo-secure-store`, legacy file auto-deleted |
| S4 | **Unvalidated JSON import** — `importAllData` only checked for key presence, not schema validity. Could inject malformed data or exhaust storage. | `services/storage.ts:680-725` | **FIXED** — Added schema validation, size limits, and type checks |
| S5 | **Cloud sync payload lacks validation** — `applySyncPayload` accepted any object with no deviceId or entry validation | `services/cloudSync.ts:230-332` | **FIXED** — Added deviceId check and array entry validation |

### MEDIUM

| # | Issue | File | Status |
|---|-------|------|--------|
| S6 | **WebView `originWhitelist={["*"]}`** — All three WebView instances allowed navigation to any origin | `ImageCropper.tsx`, `ImageColorDropper.tsx`, `backgroundRemoval.tsx` | **FIXED** — Restricted to `["about:*", "data:*"]` |
| S7 | Race conditions in storage layer (read-modify-write without locking) | `services/storage.ts` throughout | **FIXED** — Added per-file write serialization queue |
| S8 | Product search service spoofs User-Agent to scrape Google | `services/productSearch.ts` | Noted — use official APIs |
| S9 | **Unvalidated URL opening via `Linking.openURL`** — User-supplied URLs could use `tel:`, `sms:`, `intent:` schemes | 5 files | **FIXED** — Created `safeOpenURL` utility that only allows http/https |
| S10 | Gmail email body processed without sanitization; URLs extracted from untrusted HTML | `services/gmailService.ts` | Noted — use proper HTML parser |
| S11 | IP-based geolocation leaks approximate user location to third party without consent | `services/weatherService.ts:33-39` | Noted — add privacy disclosure |

### LOW

| # | Issue | File | Status |
|---|-------|------|--------|
| S12 | Non-cryptographic random IDs (`Math.random`) for data objects | Multiple files | Noted — use `expo-crypto` |
| S13 | Silent error swallowing in 43+ catch blocks | 16 files | Noted — add logging |
| S14 | Backup export contains all user data unencrypted | `services/storage.ts:628-678` | Noted — offer optional encryption |
| S15 | No input length validation on text fields | `add-item.tsx`, `edit-item.tsx` | Noted — add `maxLength` |
| S16 | **Excessive Android permissions** — `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` unnecessary on modern Android | `app.json` | **FIXED** — Removed legacy permissions |

---

## QA Pass Findings

### CRITICAL

| # | Issue | File | Status |
|---|-------|------|--------|
| Q1 | Race condition in storage: concurrent read-modify-write can cause data loss | `services/storage.ts` | **FIXED** — Same as S7, write serialization queue added |
| Q2 | **`removeWornDate` does not remove corresponding `wornEntries`** — selfie/note data becomes orphaned | `services/storage.ts:493-529` | **FIXED** — Now splices `wornEntries` at same index |
| Q3 | **`wornDates` and `wornEntries` indices diverge** — `logOutfitWorn` only pushes to `wornEntries` when selfie/note present | `services/storage.ts:377-418` | **FIXED** — Always pushes entry to `wornEntries` |

### HIGH

| # | Issue | File | Status |
|---|-------|------|--------|
| Q4 | Stale `now` reference in weekly planner — can cause wrong dates after midnight | `app/(tabs)/outfits.tsx:76` | **FIXED** — Pinned date with `useRef` on mount |
| Q5 | **`useMemo` with empty deps captures stale `items`** — always defaults to "tops" category | `app/add-item.tsx:101-106` | **FIXED** — Added `[items]` dependency |
| Q6 | **Styles computed without memoization on every render** | `app/(tabs)/index.tsx:530` | **FIXED** — Wrapped in `useMemo` |
| Q7 | **`wearCount` decremented even when date not found** — desyncs count from dates array | `services/storage.ts:515-522` | **FIXED** — Only decrement when date actually removed |
| Q8 | `Math.max(...[])` returns `-Infinity` on empty spreads — fragile pattern in color scoring | `services/outfitEngine.ts` | Noted — add empty array guard |
| Q9 | **Outfit flag cache never invalidated + flags never checked in suggestions** — flagging feature was dead code | `services/outfitEngine.ts:592-621` | **FIXED** — Integrated `matchesFlagPattern` into scoring, added `preloadFlags` |

### MEDIUM

| # | Issue | File | Status |
|---|-------|------|--------|
| Q10 | `useEffect` depends on `.length` instead of array reference — OOTD won't update on item changes | `app/(tabs)/index.tsx:291` | Noted |
| Q11 | `colorName` not derived from actual hex in `moveWishlistToWardrobe` | `services/storage.ts` | Noted |
| Q12 | **Missing `wearDates` field default in `moveWishlistToWardrobe`** | `services/storage.ts` | **FIXED** — Added `wearDates: []` |
| Q13 | `Dimensions.get("window").width` computed at module level — stale on rotation | `index.tsx`, `suggest.tsx` | Noted — use `useWindowDimensions` |
| Q14 | `importAllData` overwrites all data without backup | `services/storage.ts` | Noted — create backup before import |
| Q15 | `handleBulkAddTag` uses stale `items` reference in loop | `app/(tabs)/index.tsx` | Noted |
| Q16 | Pattern defaults to "solid" for imported items | `app/add-item.tsx` | Noted |
| Q17 | **Unused `hues` variable** in `validateOutfit` | `services/outfitEngine.ts:1259` | **FIXED** — Removed dead code |
| Q18 | Averaging hue values is mathematically wrong for circular data (0-360) | `services/outfitEngine.ts` | Noted — use circular mean |

### LOW

| # | Issue | File | Status |
|---|-------|------|--------|
| Q19 | 15+ uses of `as any` type assertions | Multiple files | Noted |
| Q20 | Nearly zero accessibility support (1 `accessibilityLabel` in entire codebase) | All screens | **FIXED** — Added 330+ `accessibilityLabel` and `accessibilityRole` props across all screens and components |
| Q21 | Several touch targets below 44x44pt minimum | Multiple components | Noted |
| Q22 | Module-level `loadNotifications()` call with unhandled promise | `services/notifications.ts` | Noted |
| Q23 | `getSuggestedName` calls state setter during render | `app/(tabs)/suggest.tsx:172-179` | Noted |
| Q24-27 | Various performance issues: constants inside components, double function calls | Multiple files | Noted |
| Q28 | `weatherToSeason` always overrides user's manual season selection | `app/(tabs)/suggest.tsx` | Noted |
| Q29 | Silent storage failures can appear as data wipe | `services/storage.ts` | Noted |
| Q30 | `outfitItems` not memoized in outfit-detail — defeats downstream `useMemo` | `app/outfit-detail.tsx` | Noted |

---

## Summary

| Category | Total Found | Fixed | Remaining |
|----------|-------------|-------|-----------|
| Security Critical | 1 | 1 | 0 |
| Security High | 4 | 4 | 0 |
| Security Medium | 6 | 4 | 2 |
| Security Low | 5 | 1 | 4 |
| QA Critical | 3 | 3 | 0 |
| QA High | 6 | 5 | 1 |
| QA Medium | 9 | 2 | 7 |
| QA Low | 12 | 1 | 11 |
| **Totals** | **46** | **21** | **25** |

### Priority Remaining Items (all FIXED)

1. ~~**Storage write queue** (S7/Q1) — Prevents data loss from concurrent writes~~ **DONE**
2. ~~**Always push to `wornEntries`** (Q3) — Keeps selfie/wear log data consistent~~ **DONE**
3. ~~**Stale `now` in planner** (Q4) — Pin date reference on mount~~ **DONE**
4. ~~**Secure token storage** (S2/S3) — Move to `expo-secure-store`~~ **DONE**
5. ~~**Accessibility** (Q20) — Add labels to all interactive elements~~ **DONE**

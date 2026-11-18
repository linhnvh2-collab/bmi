# Security Specification — Stage 1 & Stage 2

## 1. Data Invariants
### Stage 1 (`users` & `health_records`)
1. Strict ownership isolation for `/users/{userId}` and `/users/{userId}/health_records/{recordId}`.
2. Consent gate (`consentAccepted == true`) required before creating/updating profile or storing health records.
3. Immutable `uid`, `userId`, `createdAt`, `consentAcceptedAt` and server timestamp validation (`request.time`).
4. Under-18 safety integrity (`age < 18` must have `isUnder18 == true` and `categoryKey == 'under_18_limited'`).

### Stage 2 (`foods` & `users/{userId}/favorites`)
5. **Public Educational Read for `foods`**: Guests and authenticated users can `get` individual food documents and `list` active (`isActive == true`) foods. Only admins (`request.auth.token.admin == true`) can create, update, soft-delete, hard-delete, or list inactive foods.
6. **Verified Requires Complete Source**: Any `foods` write with `verificationStatus == 'verified'` MUST include a complete `source` (`name`, numeric `year`, and `reference`).
7. **Plausible & Null-Safe Nutrients**: `nutrientsPer100g` keys are strictly allowlisted; each field is either `null` (unknown) or a bounded non-negative number (`>= 0`).
8. **Static Image Path Isolation**: `imagePath` may only be `null` or a static `/images/foods/...` path (never external URLs).
9. **Owner-Only Favorites**: `/users/{userId}/favorites/{foodId}` is strictly isolated to `request.auth.uid == userId`.

## 2. Adversarial Payloads & Manual/Emulator Rules Checklist
All of the following MUST return `PERMISSION_DENIED`:
1. **Guest Write to Foods**: Unauthenticated user tries `setDoc(/foods/pho-bo, ...)` -> DENIED.
2. **Normal User Write to Foods**: Signed-in non-admin user tries `setDoc(/foods/pho-bo, ...)` or `updateDoc` or `deleteDoc` -> DENIED.
3. **Self-Assigned Admin via Profile**: User tries writing `role: "admin"` or `admin: true` into `/users/{uid}` -> DENIED (`hasOnly` check).
4. **Verified Food Without Source**: Admin attempts to write a `'verified'` food with `source: null` or empty `source.name` -> DENIED.
5. **Negative or Implausible Nutrients**: Admin attempts to write `energyKcal: -10` or `proteinG: 500` -> DENIED.
6. **External Image URL**: Admin attempts to write `imagePath: "https://example.com/pho.jpg"` -> DENIED.
7. **Cross-User Favorite Read**: User A attempts `get(/users/userB/favorites/pho-bo)` or `list(/users/userB/favorites)` -> DENIED.
8. **Cross-User Favorite Write**: User A attempts `setDoc(/users/userB/favorites/pho-bo, ...)` -> DENIED.
9. **Public Listing Inactive Foods**: Guest queries `/foods` without `where('isActive', '==', true)` when inactive documents exist -> DENIED.

Allowed Operations (MUST SUCCEED):
1. Guest reads `/foods/{foodId}` and lists `/foods` with `where('isActive', '==', true)`.
2. Admin (`request.auth.token.admin == true`) creates/updates/soft-deletes `/foods/{foodId}` with valid schema.
3. User A creates/lists/deletes `/users/{userA}/favorites/{foodId}`.

### Stage 3 (`goals`, `food_diaries`, `shopping_list`)
10. **Owner-Only Private Tracking**: `/users/{userId}/goals/current`, `/users/{userId}/food_diaries/{dateKey}`, and `/users/{userId}/shopping_list/current` are strictly restricted to `request.auth.uid == userId`.
11. **Zero Screening Leakage**: `UserGoal` strictly allows only expected goal fields via `keys().hasOnly(...)`; safety screening answers are rejected if ever sent to Firestore.
12. **Minimum Energy Floor**: Rules enforce `targetKcal == null` (for `healthy_habits`) or `targetKcal >= 1200 && targetKcal <= 6000` and `weeklyChangeKg <= 0.5`.
13. **Bounded Write-Efficient Arrays**: `food_diaries` allows max 60 entries/day and validates entry snapshot schema; `shopping_list` allows max 100 items.

Adversarial Checks for Stage 3 (MUST return `PERMISSION_DENIED`):
10. **Screening Data Injection**: User attempts to write `screeningAnswers: {...}` inside `/users/{uid}/goals/current` -> DENIED.
11. **Unsafe Calorie Target**: User attempts to write `targetKcal: 800` or `weeklyChangeKg: 2.0` -> DENIED.
12. **Cross-User Diary/Goal/Shopping Read or Write**: User A reads/writes `/users/userB/food_diaries/2026-11-16` -> DENIED.
13. **Oversized Diary Array**: User attempts to write > 60 entries in a single day document -> DENIED.

# GIS Shooter Firestore Security Specification

## 1. Data Invariants
1. **Identity Binding**: Every document in `/leaderboard/{callsignKey}` must have `ownerUid == request.auth.uid` on create (unless created by a verified admin) and `ownerUid` is immutable after creation.
2. **Verified Users Only for Writes**: Non-admin writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Personal Best Monotonicity**: A non-admin update to `/leaderboard/{callsignKey}` cannot lower `score` (`incoming().score >= existing().score`).
4. **PII & Secret Isolation**: `/leaderboard/{callsignKey}` never stores emails or PIN hashes; `/operatives/{uid}` stores private `pinHash` and is strictly readable/writable only when `request.auth.uid == uid` (`allow list: if false`).
5. **Temporal Integrity**: `createdAt` is immutable on update and all `createdAt` / `updatedAt` timestamps must equal `request.time`.
6. **Strict Keys & Volumetric Bounds**: Exact key allowlists (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update) and explicit `.size()` / integer range bounds on every field.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/leaderboard/GHOST01` while `request.auth == null`.
2. **Unverified Email Write**: Creating `/leaderboard/GHOST01` with `email_verified: false`.
3. **Identity Spoofing**: Creating `/leaderboard/GHOST01` with `ownerUid: "someone_else"` != `request.auth.uid`.
4. **Callsign Hijack**: Updating `/leaderboard/ALPHA01` owned by `uidA` while authenticated as `uidB`.
5. **Shadow / Ghost Field Injection**: Creating `/leaderboard/GHOST01` with extra field `isAdmin: true` or `verified: true`.
6. **Document ID Poisoning**: Creating `/leaderboard/..invalid!!id..` or 1.5KB callsign string.
7. **Score Downgrade / Tamper**: Non-admin updating `/leaderboard/GHOST01` with `score < existing.score` or negative `score: -100`.
8. **Fake Client Timestamp**: Creating `/leaderboard/GHOST01` with hardcoded `createdAt` != `request.time`.
9. **Immutable Field Mutation**: Updating `ownerUid`, `callsignKey`, or `createdAt` on an existing `/leaderboard/GHOST01`.
10. **Value Type Poisoning**: Updating `score` to a string `"999999"` or `accuracy` to `999`.
11. **Private Operative List Scrape**: Calling `list` on `/operatives` to enumerate user PIN hashes.
12. **Cross-User Operative Read/Write**: Reading or overwriting `/operatives/uidA` while signed in as `uidB`.

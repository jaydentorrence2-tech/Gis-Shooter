/**
 * Real Global Cloud Leaderboard & Operative Account Service
 * - Syncs verified Personal Best records to /leaderboard/{callsignKey}
 * - Protects Callsign ownership via Google UID + optional /operatives/{uid} PIN hash
 * - Streams real-time Top 100 cloud operatives via onSnapshot
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  db,
  handleFirestoreError,
  isPermissionError,
  OperationType,
} from './client';
import { getCurrentWeekKey, type LeaderboardEntry } from '../game/leaderboard';

export type CallsignAvailability =
  | 'checking'
  | 'available'
  | 'owned_by_you'
  | 'owned_by_other'
  | 'offline';

export interface CallsignLookupResult {
  status: CallsignAvailability;
  callsignKey: string;
  existingScore?: number;
  existingWave?: number;
  ownerUid?: string;
  hasPin?: boolean;
}

export interface OperativeAccountDoc {
  uid: string;
  primaryCallsign: string;
  pinHash: string;
  accentColor: string;
}

export interface CloudUpsertResult {
  status:
    | 'created'
    | 'updated_pb'
    | 'kept_pb'
    | 'auth_required'
    | 'owned_by_other'
    | 'error';
  bestScore?: number;
  message: string;
}

export function normalizeCallsignDisplay(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .slice(0, 16);
  if (cleaned.length < 2) return 'OPERATIVE';
  return cleaned;
}

export function normalizeCallsignKey(raw: string): string {
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_\-]/g, '')
    .slice(0, 16);
  if (key.length < 2) return 'OPERATIVE';
  return key;
}

function sanitizeHexColor(hex?: string): string {
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex;
  }
  return '#06b6d4';
}

function sanitizeWeekKey(wk?: string): string {
  if (typeof wk === 'string' && /^[0-9]{4}-W[0-9]{2}$/.test(wk)) {
    return wk;
  }
  return getCurrentWeekKey();
}

export async function hashOperativePin(pin: string, uid: string): Promise<string> {
  const clean = pin.trim();
  if (!clean) return '';
  const data = new TextEncoder().encode(`gis_op_pin:${uid}:${clean}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function lookupCloudCallsign(
  callsign: string,
  currentUid: string | null
): Promise<CallsignLookupResult> {
  const callsignKey = normalizeCallsignKey(callsign);
  const path = `leaderboard/${callsignKey}`;
  try {
    const snap = await getDoc(doc(db, 'leaderboard', callsignKey));
    if (!snap.exists()) {
      return { status: 'available', callsignKey };
    }
    const data = snap.data();
    const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : '';
    const existingScore = typeof data.score === 'number' ? data.score : 0;
    const existingWave = typeof data.wave === 'number' ? data.wave : 1;
    const hasPin = Boolean(data.hasPin);
    if (currentUid && ownerUid === currentUid) {
      return {
        status: 'owned_by_you',
        callsignKey,
        existingScore,
        existingWave,
        ownerUid,
        hasPin,
      };
    }
    return {
      status: 'owned_by_other',
      callsignKey,
      existingScore,
      existingWave,
      ownerUid,
      hasPin,
    };
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return { status: 'offline', callsignKey };
  }
}

export async function fetchOperativeAccount(
  uid: string
): Promise<OperativeAccountDoc | null> {
  const path = `operatives/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'operatives', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid || uid),
      primaryCallsign: normalizeCallsignKey(String(d.primaryCallsign || 'OPERATIVE')),
      pinHash: String(d.pinHash || ''),
      accentColor: sanitizeHexColor(d.accentColor),
    };
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function saveOperativeAccount(params: {
  uid: string;
  callsign: string;
  accentColor: string;
  newPin?: string;
  keepExistingPin?: boolean;
}): Promise<OperativeAccountDoc> {
  const path = `operatives/${params.uid}`;
  const ref = doc(db, 'operatives', params.uid);
  const primaryCallsign = normalizeCallsignKey(params.callsign);
  const accentColor = sanitizeHexColor(params.accentColor);

  try {
    const existingSnap = await getDoc(ref);
    let pinHash = '';
    if (params.newPin && params.newPin.trim().length > 0) {
      pinHash = await hashOperativePin(params.newPin.trim(), params.uid);
    } else if (params.keepExistingPin && existingSnap.exists()) {
      pinHash = String(existingSnap.data().pinHash || '');
    }

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: params.uid,
        primaryCallsign,
        pinHash,
        accentColor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          uid: params.uid,
          primaryCallsign,
          pinHash,
          accentColor,
          createdAt: existingSnap.data().createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    }

    return {
      uid: params.uid,
      primaryCallsign,
      pinHash,
      accentColor,
    };
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        path
      );
    }
    throw error;
  }
}

export interface CloudScorePayload {
  callsign: string;
  countryCode?: string;
  flag?: string;
  score: number;
  wave: number;
  kills: number;
  headshots: number;
  accuracy: number;
  survivalSec: number;
  xpEarned: number;
  level: number;
  avatarColor: string;
  favoriteWeapon: string;
  weekKey?: string;
  hasPin?: boolean;
}

function buildSanitizedScoreFields(payload: CloudScorePayload, ownerUid: string) {
  const callsign = normalizeCallsignDisplay(payload.callsign);
  const callsignKey = normalizeCallsignKey(callsign);
  const kills = Math.max(0, Math.min(100000, Math.round(payload.kills)));
  const headshots = Math.max(0, Math.min(kills, Math.round(payload.headshots)));
  return {
    callsignKey,
    callsign,
    ownerUid,
    countryCode: (payload.countryCode || 'ID').slice(0, 4).toUpperCase(),
    flag: (payload.flag || '🇮🇩').slice(0, 12),
    score: Math.max(0, Math.min(100000000, Math.round(payload.score))),
    wave: Math.max(1, Math.min(99, Math.round(payload.wave))),
    kills,
    headshots,
    accuracy: Math.max(0, Math.min(100, Math.round(payload.accuracy))),
    survivalSec: Math.max(0, Math.min(86400, Math.round(payload.survivalSec))),
    xpEarned: Math.max(0, Math.min(10000000, Math.round(payload.xpEarned))),
    level: Math.max(1, Math.min(999, Math.round(payload.level))),
    avatarColor: sanitizeHexColor(payload.avatarColor),
    favoriteWeapon: (payload.favoriteWeapon || 'AR-X7 Tactical').trim().slice(0, 48) || 'AR-X7 Tactical',
    weekKey: sanitizeWeekKey(payload.weekKey),
    isPlayer: true,
    hasPin: Boolean(payload.hasPin),
  };
}

export async function upsertCloudPersonalBest(
  user: User | null,
  payload: CloudScorePayload,
  forceAdminOverwrite = false
): Promise<CloudUpsertResult> {
  if (!user) {
    return {
      status: 'auth_required',
      message: 'Sign in with Google to publish your score to the Global Cloud Leaderboard.',
    };
  }

  const sanitized = buildSanitizedScoreFields(payload, user.uid);
  const path = `leaderboard/${sanitized.callsignKey}`;
  const docRef = doc(db, 'leaderboard', sanitized.callsignKey);

  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        tx.set(docRef, {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          status: 'created' as const,
          bestScore: sanitized.score,
          message: `Registered ${sanitized.callsign} on Global Cloud (${sanitized.score.toLocaleString()}).`,
        };
      }

      const existing = snap.data();
      const existingOwner = String(existing.ownerUid || '');
      const existingScore = typeof existing.score === 'number' ? existing.score : 0;

      if (!forceAdminOverwrite && existingOwner !== user.uid) {
        return {
          status: 'owned_by_other' as const,
          bestScore: existingScore,
          message: `Callsign "${sanitized.callsign}" is protected by another operative account.`,
        };
      }

      if (!forceAdminOverwrite && sanitized.score <= existingScore) {
        return {
          status: 'kept_pb' as const,
          bestScore: existingScore,
          message: `Cloud Personal Best preserved (${existingScore.toLocaleString()}).`,
        };
      }

      tx.update(docRef, {
        callsign: sanitized.callsign,
        countryCode: sanitized.countryCode,
        flag: sanitized.flag,
        score: sanitized.score,
        wave: sanitized.wave,
        kills: sanitized.kills,
        headshots: sanitized.headshots,
        accuracy: sanitized.accuracy,
        survivalSec: sanitized.survivalSec,
        xpEarned: sanitized.xpEarned,
        level: sanitized.level,
        avatarColor: sanitized.avatarColor,
        favoriteWeapon: sanitized.favoriteWeapon,
        weekKey: sanitized.weekKey,
        hasPin: sanitized.hasPin,
        updatedAt: serverTimestamp(),
      });

      return {
        status: 'updated_pb' as const,
        bestScore: sanitized.score,
        message: `New Cloud Personal Best synced: ${sanitized.score.toLocaleString()}!`,
      };
    });

    return outcome;
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Cloud sync failed (saved locally).',
    };
  }
}

export async function migrateCloudCallsignEntry(
  user: User | null,
  oldCallsign: string,
  newPayload: CloudScorePayload
): Promise<CloudUpsertResult | null> {
  if (!user) return null;
  const oldKey = normalizeCallsignKey(oldCallsign);
  const newKey = normalizeCallsignKey(newPayload.callsign);
  if (!oldKey || !newKey || oldKey === newKey) return null;

  const oldPath = `leaderboard/${oldKey}`;
  const oldRef = doc(db, 'leaderboard', oldKey);

  try {
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) return null;
    const oldData = oldSnap.data();
    if (String(oldData.ownerUid || '') !== user.uid) return null;

    const oldScore = typeof oldData.score === 'number' ? oldData.score : 0;
    const oldKills = typeof oldData.kills === 'number' ? oldData.kills : 0;
    const oldHeadshots = typeof oldData.headshots === 'number' ? oldData.headshots : 0;
    const oldWave = typeof oldData.wave === 'number' ? oldData.wave : 1;
    const oldAccuracy = typeof oldData.accuracy === 'number' ? oldData.accuracy : 0;
    const oldSurvival = typeof oldData.survivalSec === 'number' ? oldData.survivalSec : 60;
    const oldXp = typeof oldData.xpEarned === 'number' ? oldData.xpEarned : 0;

    const useOldBest = oldScore > newPayload.score;
    const mergedPayload: CloudScorePayload = useOldBest
      ? {
          ...newPayload,
          score: oldScore,
          wave: Math.max(newPayload.wave, oldWave),
          kills: Math.max(newPayload.kills, oldKills),
          headshots: Math.max(newPayload.headshots, oldHeadshots),
          accuracy: Math.max(newPayload.accuracy, oldAccuracy),
          survivalSec: Math.max(newPayload.survivalSec, oldSurvival),
          xpEarned: Math.max(newPayload.xpEarned, oldXp),
        }
      : newPayload;

    const upsertRes = await upsertCloudPersonalBest(user, mergedPayload);
    if (
      upsertRes.status === 'created' ||
      upsertRes.status === 'updated_pb' ||
      upsertRes.status === 'kept_pb'
    ) {
      try {
        await deleteDoc(oldRef);
      } catch (delErr) {
        if (isPermissionError(delErr)) {
          handleFirestoreError(delErr, OperationType.DELETE, oldPath);
        }
      }
    }
    return upsertRes;
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, oldPath);
    }
    return null;
  }
}

export async function deleteCloudLeaderboardEntry(callsignOrId: string): Promise<void> {
  const rawKey = callsignOrId.startsWith('cloud_')
    ? callsignOrId.slice('cloud_'.length)
    : callsignOrId;
  const callsignKey = normalizeCallsignKey(rawKey);
  const path = `leaderboard/${callsignKey}`;
  try {
    await deleteDoc(doc(db, 'leaderboard', callsignKey));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}

function isBetterLeaderboardEntry(
  candidate: LeaderboardEntry,
  existing: LeaderboardEntry
): boolean {
  if (candidate.score !== existing.score) {
    return candidate.score > existing.score;
  }
  if (candidate.timestamp !== existing.timestamp) {
    return candidate.timestamp > existing.timestamp;
  }
  if (candidate.kills !== existing.kills) {
    return candidate.kills > existing.kills;
  }
  return candidate.accuracy > existing.accuracy;
}

export function dedupeCloudLeaderboardEntries(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  // Pass 1: Reduce by ownerUid so one operative account never renders twice after a rename
  const byOwnerUid = new Map<string, LeaderboardEntry>();
  const anonymousOrLegacy: LeaderboardEntry[] = [];

  for (const entry of entries) {
    const uid = entry.ownerUid?.trim();
    if (!uid) {
      anonymousOrLegacy.push(entry);
      continue;
    }
    const prev = byOwnerUid.get(uid);
    if (!prev || isBetterLeaderboardEntry(entry, prev)) {
      byOwnerUid.set(uid, entry);
    }
  }

  // Pass 2: Reduce by normalized callsign so identical callsigns never duplicate
  const byCallsign = new Map<string, LeaderboardEntry>();
  for (const entry of [...byOwnerUid.values(), ...anonymousOrLegacy]) {
    const key = normalizeCallsignKey(entry.callsign || entry.id);
    const prev = byCallsign.get(key);
    if (!prev || isBetterLeaderboardEntry(entry, prev)) {
      byCallsign.set(key, entry);
    }
  }

  return Array.from(byCallsign.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.accuracy - a.accuracy;
  });
}

export function subscribeCloudLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onStatusChange?: (status: 'live' | 'offline') => void
): Unsubscribe {
  const path = 'leaderboard';
  const q = query(
    collection(db, 'leaderboard'),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rawEntries: LeaderboardEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const updatedMs =
          d.updatedAt && typeof d.updatedAt.toMillis === 'function'
            ? d.updatedAt.toMillis()
            : Date.now();
        return {
          id: `cloud_${docSnap.id}`,
          callsign: String(d.callsign || docSnap.id),
          countryCode: String(d.countryCode || 'ID'),
          flag: String(d.flag || '🇮🇩'),
          kills: Number(d.kills || 0),
          headshots: Number(d.headshots || 0),
          accuracy: Number(d.accuracy || 0),
          survivalSec: Number(d.survivalSec || 0),
          wave: Number(d.wave || 1),
          score: Number(d.score || 0),
          xpEarned: Number(d.xpEarned || 0),
          timestamp: updatedMs,
          isPlayer: true,
          isCloud: true,
          ownerUid: typeof d.ownerUid === 'string' ? d.ownerUid : undefined,
          hasPin: Boolean(d.hasPin),
          weekKey: typeof d.weekKey === 'string' ? d.weekKey : undefined,
          level: typeof d.level === 'number' ? d.level : 1,
          avatarColor: typeof d.avatarColor === 'string' ? d.avatarColor : '#06b6d4',
          favoriteWeapon:
            typeof d.favoriteWeapon === 'string' ? d.favoriteWeapon : 'AR-X7 Tactical',
        };
      });
      const entries = dedupeCloudLeaderboardEntries(rawEntries);
      onStatusChange?.('live');
      onData(entries);
    },
    (error) => {
      onStatusChange?.('offline');
      if (isPermissionError(error)) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      console.warn('Cloud leaderboard stream degraded to offline cache:', error);
    }
  );
}

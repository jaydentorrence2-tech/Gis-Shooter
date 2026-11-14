/**
 * Hybrid Global / Local Leaderboard & Score Store
 * Merges browser localStorage match submissions with deterministic seeded
 * Global Top 100 and Weekly Season community operatives.
 */

export type LeaderboardTab = 'global' | 'personal' | 'weekly';

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  countryCode: string;
  flag: string;
  kills: number;
  headshots: number;
  accuracy: number;
  survivalSec: number;
  wave: number;
  score: number;
  xpEarned: number;
  timestamp: number;
  isPlayer: boolean;
  weekKey?: string;
  level?: number;
  avatarColor?: string;
  favoriteWeapon?: string;
  isCloud?: boolean;
  ownerUid?: string;
  hasPin?: boolean;
}

export const LEADERBOARD_STORAGE_KEY = 'GIS_SHOOTER_LEADERBOARD_V1';
export const BANNED_CALLSIGNS_STORAGE_KEY = 'GIS_SHOOTER_BANNED_CALLSIGNS_V1';
export const DELETED_SCORES_STORAGE_KEY = 'GIS_SHOOTER_DELETED_SCORES_V1';

export function loadBannedCallsigns(): string[] {
  try {
    const raw = localStorage.getItem(BANNED_CALLSIGNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string').map((s) => s.trim().toUpperCase())
      : [];
  } catch {
    return [];
  }
}

function saveBannedCallsigns(list: string[]) {
  try {
    localStorage.setItem(BANNED_CALLSIGNS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function loadDeletedScoreIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_SCORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveDeletedScoreIds(ids: string[]) {
  try {
    localStorage.setItem(DELETED_SCORES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function banOrRemoveLeaderboardEntry(id: string, callsign: string, banCallsign = true) {
  const deleted = new Set(loadDeletedScoreIds());
  deleted.add(id);
  saveDeletedScoreIds(Array.from(deleted));

  // Also strip matching local entries if deleted directly
  const local = loadLocalScores().filter((e) => e.id !== id);
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(local));
  } catch {
    // ignore
  }

  if (banCallsign && callsign.trim()) {
    const banned = new Set(loadBannedCallsigns());
    banned.add(callsign.trim().toUpperCase());
    saveBannedCallsigns(Array.from(banned));
  }
}

export function unbanCallsign(callsign: string) {
  const norm = callsign.trim().toUpperCase();
  const next = loadBannedCallsigns().filter((c) => c !== norm);
  saveBannedCallsigns(next);
}

export function clearAllModerationFilters() {
  saveBannedCallsigns([]);
  saveDeletedScoreIds([]);
}

export function addOrUpdateCustomScore(params: {
  callsign: string;
  score: number;
  wave: number;
  kills: number;
  accuracy: number;
  isPlayer?: boolean;
}): LeaderboardEntry {
  const cleanCallsign = params.callsign.trim().toUpperCase() || 'OPERATIVE';
  const cleanScore = Math.max(0, Math.round(params.score));
  const cleanWave = Math.max(1, Math.min(99, Math.round(params.wave)));
  const cleanKills = Math.max(0, Math.round(params.kills));
  const cleanAcc = Math.max(0, Math.min(100, Math.round(params.accuracy)));

  // Unban callsign automatically if admin explicitly adds custom score for them
  unbanCallsign(cleanCallsign);

  const existing = loadLocalScores();
  const matchIdx = existing.findIndex(
    (e) => e.callsign.trim().toUpperCase() === cleanCallsign
  );
  const weekKey = getCurrentWeekKey();

  let savedEntry: LeaderboardEntry;
  if (matchIdx >= 0) {
    savedEntry = {
      ...existing[matchIdx],
      callsign: cleanCallsign,
      score: cleanScore,
      wave: cleanWave,
      kills: cleanKills,
      accuracy: cleanAcc,
      headshots: Math.min(cleanKills, Math.round(cleanKills * 0.45)),
      timestamp: Date.now(),
      weekKey,
    };
    existing[matchIdx] = savedEntry;
  } else {
    savedEntry = {
      id: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      callsign: cleanCallsign,
      countryCode: 'ID',
      flag: '🇮🇩',
      kills: cleanKills,
      headshots: Math.min(cleanKills, Math.round(cleanKills * 0.45)),
      accuracy: cleanAcc,
      survivalSec: Math.max(60, cleanWave * 55 + cleanKills * 4),
      wave: cleanWave,
      score: cleanScore,
      xpEarned: Math.round(cleanScore * 0.4),
      timestamp: Date.now(),
      isPlayer: params.isPlayer ?? true,
      weekKey,
      level: Math.min(25, Math.max(1, Math.round(1 + cleanWave * 1.2))),
      avatarColor: '#f59e0b',
      favoriteWeapon: 'AR-X7 Tactical',
    };
    existing.unshift(savedEntry);
  }

  const next = existing
    .sort((a, b) => b.score - a.score || b.kills - a.kills || b.accuracy - a.accuracy)
    .slice(0, 60);

  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  return savedEntry;
}

export function getCurrentWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo < 10 ? '0' : ''}${weekNo}`;
}

export function formatSurvivalTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

const COUNTRIES: { code: string; flag: string }[] = [
  { code: 'US', flag: '🇺🇸' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'KR', flag: '🇰🇷' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'ID', flag: '🇮🇩' },
  { code: 'SG', flag: '🇸🇬' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'CA', flag: '🇨🇦' },
  { code: 'SE', flag: '🇸🇪' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'BR', flag: '🇧🇷' },
];

const FEATURED_GLOBAL_NAMES = [
  'Ghost_Rider',
  'CyberNinja99',
  'AlphaZero',
  'Valkyrie_KR',
  'SpectreOps',
  'NovaStrike',
  'ShadowViper',
  'Kestrel_77',
  'Phantom_ID',
  'ZeroCool_X',
  'ApexSniper',
  'RoninBlade',
  'CobaltWolf',
  'Orion_Prime',
  'Aegis_Unit4',
  'VortexEcho',
  'Hyperion_9',
  'RaptorSeven',
  'IceBreaker',
  'DeltaWraith',
];

const BOT_PREFIXES = [
  'Kilo', 'Echo', 'Sierra', 'Tango', 'Razor', 'Titan', 'Nyx', 'Vector',
  'Pulse', 'Omega', 'Frost', 'Blitz', 'Helios', 'Atlas', 'Vanguard', 'Striker',
];

const BOT_SUFFIXES = [
  '01', '07', '13', '24', '42', '88', '99', 'X', 'Pro', 'Ops', 'HQ', 'Tac',
];

const OPERATOR_COLORS = ['#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#38bdf8', '#a855f7'];
const OPERATOR_WEAPONS = [
  'AR-X7 Tactical',
  'Vector-V9 Tactical',
  'SG-12 Breach',
  'SR-50 Marksman',
  '.50 Desert Python',
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateCommunityRoster(
  count: number,
  seed: number,
  scoreCeiling: number,
  scoreFloor: number,
  weekKey?: string
): LeaderboardEntry[] {
  const rand = mulberry32(seed);
  const usedNames = new Set<string>();
  const list: LeaderboardEntry[] = [];

  for (let i = 0; i < count; i++) {
    let callsign = '';
    if (i < FEATURED_GLOBAL_NAMES.length) {
      callsign = FEATURED_GLOBAL_NAMES[i];
    } else {
      for (let attempt = 0; attempt < 15; attempt++) {
        const pre = BOT_PREFIXES[Math.floor(rand() * BOT_PREFIXES.length)];
        const suf = BOT_SUFFIXES[Math.floor(rand() * BOT_SUFFIXES.length)];
        const candidate = `${pre}_${suf}`;
        if (!usedNames.has(candidate)) {
          callsign = candidate;
          break;
        }
      }
      if (!callsign) callsign = `Operative_${100 + i}`;
    }
    usedNames.add(callsign);

    const t = i / Math.max(1, count - 1);
    const curve = Math.pow(1 - t, 1.55);
    const jitter = (rand() - 0.5) * 0.045;
    const score = Math.max(
      scoreFloor,
      Math.round((scoreFloor + (scoreCeiling - scoreFloor) * Math.max(0, Math.min(1, curve + jitter))) / 10) * 10
    );

    const wave = Math.max(1, Math.min(18, Math.round(1 + (score / scoreCeiling) * 13 + (rand() - 0.5) * 2)));
    const kills = Math.max(4, Math.round(score / (155 + rand() * 35)));
    const headshots = Math.min(kills, Math.round(kills * (0.28 + rand() * 0.34)));
    const accuracy = Math.min(89, Math.max(24, Math.round(32 + (1 - t) * 40 + (rand() - 0.5) * 12)));
    const survivalSec = Math.max(45, Math.round(wave * 54 + kills * 4.5 + rand() * 45));
    const country = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
    const level = Math.max(1, Math.min(25, Math.round(1 + (score / scoreCeiling) * 19 + rand() * 3)));
    const avatarColor = OPERATOR_COLORS[Math.floor(rand() * OPERATOR_COLORS.length)];
    const favoriteWeapon = OPERATOR_WEAPONS[Math.floor(rand() * OPERATOR_WEAPONS.length)];

    list.push({
      id: `bot_${weekKey || 'global'}_${i}`,
      callsign,
      countryCode: country.code,
      flag: country.flag,
      kills,
      headshots,
      accuracy,
      survivalSec,
      wave,
      score,
      xpEarned: Math.round(score * 0.42),
      timestamp: Date.now() - Math.floor(rand() * 1000 * 86400 * 6),
      isPlayer: false,
      weekKey,
      level,
      avatarColor,
      favoriteWeapon,
    });
  }

  return list;
}

const GLOBAL_BOTS: LeaderboardEntry[] = generateCommunityRoster(96, 0x47495331, 24500, 620);

export function getWeeklyBots(weekKey = getCurrentWeekKey()): LeaderboardEntry[] {
  return generateCommunityRoster(64, hashString(`WEEK_${weekKey}`), 16800, 540, weekKey);
}

export function loadLocalScores(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.score === 'number' && typeof item.callsign === 'string');
  } catch {
    return [];
  }
}

export function saveLocalScore(entry: Omit<LeaderboardEntry, 'id' | 'timestamp' | 'isPlayer' | 'weekKey'>): {
  savedEntry: LeaderboardEntry;
  allLocal: LeaderboardEntry[];
} {
  const existing = loadLocalScores();
  const weekKey = getCurrentWeekKey();
  const savedEntry: LeaderboardEntry = {
    ...entry,
    id: `plr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    isPlayer: true,
    weekKey,
  };

  const next = [savedEntry, ...existing]
    .sort((a, b) => b.score - a.score || b.kills - a.kills || b.accuracy - a.accuracy)
    .slice(0, 60);

  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }

  return { savedEntry, allLocal: next };
}

export interface RankedLeaderboardRow extends LeaderboardEntry {
  rank: number;
  isActivePlayer: boolean;
}

export interface LeaderboardResult {
  rows: RankedLeaderboardRow[];
  activePlayerBestRank: number | null;
  activePlayerBestScore: number | null;
  localRunCount: number;
  cloudRunCount: number;
  weekKey: string;
}

export function getMergedLeaderboard(
  tab: LeaderboardTab,
  activeCallsign: string,
  cloudEntries: LeaderboardEntry[] = []
): LeaderboardResult {
  const local = loadLocalScores();
  const weekKey = getCurrentWeekKey();
  const normalizedActive = activeCallsign.trim().toUpperCase();
  const bannedSet = new Set(loadBannedCallsigns());
  const deletedSet = new Set(loadDeletedScoreIds());

  // Map best cloud score per normalized callsign so we don't duplicate synced local runs in Global/Weekly
  const cloudBestByCallsign = new Map<string, number>();
  for (const c of cloudEntries) {
    const k = c.callsign.trim().toUpperCase();
    const prev = cloudBestByCallsign.get(k) ?? -1;
    if (c.score > prev) cloudBestByCallsign.set(k, c.score);
  }

  let pool: LeaderboardEntry[] = [];
  if (tab === 'personal') {
    const myCloud = cloudEntries.filter(
      (c) => c.callsign.trim().toUpperCase() === normalizedActive
    );
    pool = [...myCloud, ...local];
  } else if (tab === 'weekly') {
    const weeklyCloud = cloudEntries.filter((e) => !e.weekKey || e.weekKey === weekKey);
    const weeklyLocal = local.filter((e) => {
      if (e.weekKey && e.weekKey !== weekKey) return false;
      const cloudScore = cloudBestByCallsign.get(e.callsign.trim().toUpperCase());
      return cloudScore === undefined || e.score > cloudScore;
    });
    pool = [...weeklyCloud, ...weeklyLocal, ...getWeeklyBots(weekKey)];
  } else {
    const unsyncedLocal = local.filter((e) => {
      const cloudScore = cloudBestByCallsign.get(e.callsign.trim().toUpperCase());
      return cloudScore === undefined || e.score > cloudScore;
    });
    pool = [...cloudEntries, ...unsyncedLocal, ...GLOBAL_BOTS];
  }

  pool = pool.filter(
    (entry) =>
      !deletedSet.has(entry.id) &&
      !bannedSet.has(entry.callsign.trim().toUpperCase())
  );

  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.accuracy - a.accuracy;
  });

  const capped = pool.slice(0, 100);
  let activePlayerBestRank: number | null = null;
  let activePlayerBestScore: number | null = null;

  const rows: RankedLeaderboardRow[] = capped.map((item, idx) => {
    const rank = idx + 1;
    const isActivePlayer =
      item.isPlayer && item.callsign.trim().toUpperCase() === normalizedActive;
    if (isActivePlayer && activePlayerBestRank === null) {
      activePlayerBestRank = rank;
      activePlayerBestScore = item.score;
    }
    return {
      ...item,
      rank,
      isActivePlayer,
    };
  });

  // Fallback check if player's record fell outside top 100
  if (activePlayerBestRank === null && tab !== 'personal') {
    const fullIdx = pool.findIndex(
      (item) => item.isPlayer && item.callsign.trim().toUpperCase() === normalizedActive
    );
    if (fullIdx >= 0) {
      activePlayerBestRank = fullIdx + 1;
      activePlayerBestScore = pool[fullIdx].score;
    }
  }

  return {
    rows,
    activePlayerBestRank,
    activePlayerBestScore,
    localRunCount: local.length,
    cloudRunCount: cloudEntries.length,
    weekKey,
  };
}

export interface OperatorProfileDetails {
  callsign: string;
  countryCode: string;
  flag: string;
  level: number;
  rankTitle: string;
  avatarColor: string;
  favoriteWeapon: string;
  kills: number;
  headshots: number;
  headshotRatio: number;
  accuracy: number;
  wave: number;
  score: number;
  survivalSec: number;
  isPlayer: boolean;
}

function rankTitleFromLevel(level: number): string {
  if (level >= 15) return 'APEX COMMANDER';
  if (level >= 10) return 'PHANTOM ELITE';
  if (level >= 6) return 'VANGUARD';
  if (level >= 3) return 'SENTINEL';
  return 'RECRUIT';
}

export function resolveOperatorProfileDetails(
  entry: LeaderboardEntry,
  activeProfile?: { callsign: string; level: number; accentColor: string; preferredSlot: number }
): OperatorProfileDetails {
  const h = hashString(entry.callsign || entry.id);
  const isMe =
    entry.isPlayer &&
    activeProfile &&
    entry.callsign.trim().toUpperCase() === activeProfile.callsign.trim().toUpperCase();

  const level =
    entry.level ??
    (isMe && activeProfile ? activeProfile.level : Math.max(1, Math.min(25, Math.round(1 + entry.wave * 1.1))));
  const avatarColor =
    entry.avatarColor ||
    (isMe && activeProfile ? activeProfile.accentColor : OPERATOR_COLORS[h % OPERATOR_COLORS.length]);
  const favoriteWeapon =
    entry.favoriteWeapon ||
    (isMe && activeProfile
      ? OPERATOR_WEAPONS[activeProfile.preferredSlot % OPERATOR_WEAPONS.length] || OPERATOR_WEAPONS[0]
      : OPERATOR_WEAPONS[h % OPERATOR_WEAPONS.length]);
  const headshotRatio =
    entry.kills > 0 ? Math.min(100, Math.round((entry.headshots / entry.kills) * 100)) : 0;

  return {
    callsign: entry.callsign,
    countryCode: entry.countryCode,
    flag: entry.flag,
    level,
    rankTitle: rankTitleFromLevel(level),
    avatarColor,
    favoriteWeapon,
    kills: entry.kills,
    headshots: entry.headshots,
    headshotRatio,
    accuracy: entry.accuracy,
    wave: entry.wave,
    score: entry.score,
    survivalSec: entry.survivalSec,
    isPlayer: entry.isPlayer,
  };
}


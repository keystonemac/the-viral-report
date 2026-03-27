import { MAJOR_LABELS, MAJOR_ARTISTS } from "@/constants/markets";
import { RawSoundEntry, ReportMode } from "./csv-parser";

export interface ReportSound {
  id: string;
  rank: number;
  soundName: string;
  songTitle: string;
  artist: string;
  label: string;
  creates24h: number;
  creates7d: number;
  createsTotal: number;
  growth24h: string;
  tiktokLink: string;
  markets: string[];
  avgCreates24h: number;
  isNewArtist: boolean;
  streams: number;
  streams7d: number;
  streams24h: number;
  streams24hPercent: string;
  views: number;
  views7d: number;
  views24h: number;
  views24hPercent: string;
  comment: string;
}

export interface ViralReport {
  id: string;
  generatedAt: string;
  totalSounds: number;
  marketBreakdown: Record<string, number>;
  sounds: ReportSound[];
  reportMode: ReportMode;
}

function isMajorLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return MAJOR_LABELS.some((ml) => lower.includes(ml));
}

function isMajorArtist(artist: string): boolean {
  const lower = artist.toLowerCase().trim();
  return MAJOR_ARTISTS.some((ma) => {
    if (lower === ma) return true;
    if (ma.length <= 3) {
      const words = lower.split(/[\s,&+]+/).map((w) => w.trim()).filter(Boolean);
      return words.some((w) => w === ma);
    }
    if (lower.includes(ma) || ma.includes(lower)) return true;
    const words = lower.split(/[\s,&+]+/).map((w) => w.trim()).filter(Boolean);
    return words.some((w) => w === ma);
  });
}

function isCustomBlockedArtist(artist: string, customList: string[]): boolean {
  const lower = artist.toLowerCase().trim();
  return customList.some((ca) => {
    const cl = ca.toLowerCase().trim();
    if (!cl) return false;
    if (lower === cl) return true;
    if (cl.length <= 3) {
      const words = lower.split(/[\s,&+]+/).map((w) => w.trim()).filter(Boolean);
      return words.some((w) => w === cl);
    }
    return lower.includes(cl) || cl.includes(lower);
  });
}

function isCustomBlockedLabel(label: string, customList: string[]): boolean {
  const lower = label.toLowerCase().trim();
  return customList.some((cl) => {
    const c = cl.toLowerCase().trim();
    if (!c) return false;
    return lower.includes(c);
  });
}

function createSoundKey(entry: RawSoundEntry): string {
  const name = (entry.songTitle || entry.soundName).toLowerCase().replace(/[^a-z0-9]/g, "");
  const artist = entry.artist.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${name}-${artist}`;
}

export function generateReport(
  allEntries: RawSoundEntry[],
  minCreates: number = 0,
  maxCreates: number = 100000,
  customBlockedArtists: string[] = [],
  customBlockedLabels: string[] = [],
  reportMode: ReportMode = "sounds",
): ViralReport {
  console.log(`Generating report from ${allEntries.length} total entries`);
  console.log(`Filter: ${minCreates} - ${maxCreates} creates`);

  const filtered = allEntries.filter((entry) => {
    const creates = entry.creates24h || entry.createsTotal || entry.creates7d;
    if (creates < minCreates || creates > maxCreates) {
      console.log(`Filtered out by creates (${creates}): ${entry.soundName || entry.songTitle}`);
      return false;
    }
    if (isMajorLabel(entry.label)) {
      console.log(`Filtered out major label: ${entry.artist} (${entry.label})`);
      return false;
    }
    if (isMajorArtist(entry.artist)) {
      console.log(`Filtered out major artist: ${entry.artist}`);
      return false;
    }
    if (isCustomBlockedArtist(entry.artist, customBlockedArtists)) {
      console.log(`Filtered out custom blocked artist: ${entry.artist}`);
      return false;
    }
    if (isCustomBlockedLabel(entry.label, customBlockedLabels)) {
      console.log(`Filtered out custom blocked label: ${entry.label}`);
      return false;
    }
    return true;
  });

  console.log(`After filtering: ${filtered.length} entries`);

  const deduped = new Map<string, { entries: RawSoundEntry[]; markets: string[] }>();

  for (const entry of filtered) {
    const key = createSoundKey(entry);
    if (deduped.has(key)) {
      const existing = deduped.get(key)!;
      existing.entries.push(entry);
      if (!existing.markets.includes(entry.market)) {
        existing.markets.push(entry.market);
      }
    } else {
      deduped.set(key, { entries: [entry], markets: [entry.market] });
    }
  }

  const sounds: ReportSound[] = [];
  let rank = 1;

  const sorted = Array.from(deduped.values()).sort((a, b) => {
    const aMax = Math.max(...a.entries.map((e) => e.creates24h || e.createsTotal));
    const bMax = Math.max(...b.entries.map((e) => e.creates24h || e.createsTotal));
    return bMax - aMax;
  });

  for (const { entries, markets } of sorted) {
    const best = entries.reduce((a, b) =>
      (a.creates24h || a.createsTotal) > (b.creates24h || b.createsTotal) ? a : b
    );

    const avgCreates = Math.round(
      entries.reduce((sum, e) => sum + (e.creates24h || e.createsTotal), 0) / entries.length
    );

    sounds.push({
      id: `${rank}-${Date.now()}`,
      rank,
      soundName: best.soundName,
      songTitle: best.songTitle || best.soundName,
      artist: best.artist,
      label: best.label,
      creates24h: best.creates24h,
      creates7d: best.creates7d,
      createsTotal: best.createsTotal,
      growth24h: best.growth24h,
      tiktokLink: best.tiktokLink,
      markets,
      avgCreates24h: avgCreates,
      isNewArtist: !isMajorLabel(best.label),
      streams: best.streams,
      streams7d: best.streams7d,
      streams24h: best.streams24h,
      streams24hPercent: best.streams24hPercent,
      views: best.views,
      views7d: best.views7d,
      views24h: best.views24h,
      views24hPercent: best.views24hPercent,
      comment: "",
    });

    rank++;
  }

  const marketBreakdown: Record<string, number> = {};
  for (const entry of filtered) {
    marketBreakdown[entry.market] = (marketBreakdown[entry.market] || 0) + 1;
  }

  const report: ViralReport = {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    totalSounds: sounds.length,
    marketBreakdown,
    sounds,
    reportMode,
  };

  console.log(`Report generated: ${report.totalSounds} sounds`);
  return report;
}

export function formatCreates(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

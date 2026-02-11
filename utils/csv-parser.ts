export type ReportMode = "sounds" | "songs";

export interface RawSoundEntry {
  rank: number;
  soundName: string;
  songTitle: string;
  artist: string;
  label: string;
  growth24h: string;
  creates24h: number;
  creates7d: number;
  createsTotal: number;
  tiktokLink: string;
  market: string;
  streams: number;
  streams7d: number;
  streams24h: number;
  streams24hPercent: string;
  views: number;
  views7d: number;
  views24h: number;
  views24hPercent: string;
}

function parseNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").replace(/"/g, "").replace(/—/g, "").replace(/–/g, "").replace(/-/g, "").trim();
  if (!cleaned) return 0;
  const multiplier = cleaned.toLowerCase().includes("k")
    ? 1000
    : cleaned.toLowerCase().includes("m")
      ? 1000000
      : cleaned.toLowerCase().includes("b")
        ? 1000000000
        : 1;
  const num = parseFloat(cleaned.replace(/[kKmMbB]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * multiplier);
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

interface DataGroup {
  pctCol: number;
  col24h: number;
  col7d: number;
  colTotal: number;
}

interface ColumnMapping {
  rank: number;
  song: number;
  sound: number;
  artist: number;
  label: number;
  link: number;
  soundsNr: number;
  creates: DataGroup | null;
  streams: DataGroup | null;
  views: DataGroup | null;
}

function classifyHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    rank: -1, song: -1, sound: -1, artist: -1, label: -1, link: -1, soundsNr: -1,
    creates: null, streams: null, views: null,
  };

  let tikPct = -1, tik24h = -1, tik7d = -1, tikTotal = -1;
  let spoPct = -1, spo24h = -1, spo7d = -1, spoTotal = -1;
  let ytPct = -1, yt24h = -1, yt7d = -1, ytTotal = -1;

  console.log("=== CSV Column Classification (direct match) ===");
  console.log("Header count:", headers.length);

  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i];
    const low = raw.toLowerCase().trim().replace(/\s+/g, " ");
    console.log(`  [${i}] raw="${raw}" low="${low}"`);

    if (low === "nr. crt." || low === "nr.crt." || low === "nrcrt" || low === "#" || low === "rank" || low === "no" || low === "nr" || low === "nr." || low === "no.") {
      mapping.rank = i;
      continue;
    }
    if (low === "song" || low === "song title" || low === "songtitle" || low === "track" || low === "title") {
      mapping.song = i;
      continue;
    }
    if (low === "sound name" || low === "soundname" || low === "sound") {
      mapping.sound = i;
      continue;
    }
    if (low === "sound creator" || low === "soundcreator" || low === "creator") {
      continue;
    }
    if (low === "username" || low === "user" || low === "user name") {
      continue;
    }
    if (low === "artist" || low === "author" || low === "account" || low === "artists") {
      mapping.artist = i;
      continue;
    }
    if (low === "record label" || low === "recordlabel" || low === "label") {
      mapping.label = i;
      continue;
    }
    if (low === "sounds nr." || low === "sounds nr" || low === "sounds number" || low === "nr of sounds" || low === "# sounds") {
      mapping.soundsNr = i;
      continue;
    }
    if (low === "sound url" || low === "sound link" || low === "tiktok link" || low === "link" || low === "url" || low === "official link" || low === "officiallink" || ((low.includes("url") || low.includes("link")) && (low.includes("tiktok") || low.includes("sound") || low.includes("official")))) {
      mapping.link = i;
      continue;
    }

    if ((low.includes("tiktok") || low.includes("high-reach") || low.includes("high reach") || low.includes("highreach")) && !low.includes("url") && !low.includes("link")) {
      if (low.includes("%")) { tikPct = i; }
      else if (low.includes("total")) { tikTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { tik7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { tik24h = i; }
      else { tikTotal = i; }
      continue;
    }

    if (low.includes("create") && !low.includes("creator")) {
      if (low.includes("%") || low.includes("growth")) { tikPct = i; }
      else if (low.includes("total")) { tikTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { tik7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { tik24h = i; }
      else { tikTotal = i; }
      continue;
    }

    if ((low.includes("24h") || low.includes("24 h") || low === "24 hours") && (low.includes("%") || low.includes("growth"))) {
      tikPct = i;
      continue;
    }
    if ((low === "24 hours" || low === "24h" || low === "24 h") && !low.includes("%") && !low.includes("growth")) {
      tik24h = i;
      continue;
    }
    if (low === "7 days" || low === "7d" || low === "7 d") {
      tik7d = i;
      continue;
    }
    if (low.includes("growth") && low.includes("%")) {
      tikPct = i;
      continue;
    }

    if (low.includes("spotify")) {
      if (low.includes("%")) { spoPct = i; }
      else if (low.includes("total")) { spoTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { spo7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { spo24h = i; }
      else { spoTotal = i; }
      continue;
    }

    if (low.includes("stream")) {
      if (low.includes("%") || low.includes("growth")) { spoPct = i; }
      else if (low.includes("total")) { spoTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { spo7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { spo24h = i; }
      else { spoTotal = i; }
      continue;
    }

    if (low.includes("youtube")) {
      if (low.includes("%")) { ytPct = i; }
      else if (low.includes("total")) { ytTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { yt7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { yt24h = i; }
      else { ytTotal = i; }
      continue;
    }

    if (low.includes("view")) {
      if (low.includes("%") || low.includes("growth")) { ytPct = i; }
      else if (low.includes("total")) { ytTotal = i; }
      else if (low.includes("7d") || low.includes("7 d")) { yt7d = i; }
      else if (low.includes("24h") || low.includes("24 h")) { yt24h = i; }
      else { ytTotal = i; }
      continue;
    }
  }

  if (tik24h >= 0 || tikTotal >= 0) {
    mapping.creates = { pctCol: tikPct, col24h: tik24h, col7d: tik7d, colTotal: tikTotal };
  }
  if (spo24h >= 0 || spoTotal >= 0) {
    mapping.streams = { pctCol: spoPct, col24h: spo24h, col7d: spo7d, colTotal: spoTotal };
  }
  if (yt24h >= 0 || ytTotal >= 0) {
    mapping.views = { pctCol: ytPct, col24h: yt24h, col7d: yt7d, colTotal: ytTotal };
  }

  if (!mapping.creates && !mapping.streams && !mapping.views) {
    console.log("=== No named columns found, falling back to positional grouping ===");
    const metaIndices = new Set([mapping.rank, mapping.song, mapping.sound, mapping.artist, mapping.label, mapping.link, mapping.soundsNr].filter(i => i >= 0));
    const dataColumns: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (!metaIndices.has(i)) dataColumns.push(i);
    }
    console.log("Data columns:", dataColumns.map(i => `[${i}]"${headers[i]}"`).join(", "));
    if (dataColumns.length >= 4) {
      mapping.creates = { pctCol: dataColumns[0], col24h: dataColumns[1], col7d: dataColumns[2], colTotal: dataColumns[3] };
    }
    if (dataColumns.length >= 8) {
      mapping.streams = { pctCol: dataColumns[4], col24h: dataColumns[5], col7d: dataColumns[6], colTotal: dataColumns[7] };
    }
    if (dataColumns.length >= 12) {
      mapping.views = { pctCol: dataColumns[8], col24h: dataColumns[9], col7d: dataColumns[10], colTotal: dataColumns[11] };
    }
  }

  console.log("=== Final Column Mapping ===");
  console.log(`  rank=[${mapping.rank}], song=[${mapping.song}], sound=[${mapping.sound}], artist=[${mapping.artist}], label=[${mapping.label}], link=[${mapping.link}], soundsNr=[${mapping.soundsNr}]`);
  if (mapping.creates) console.log(`  CREATES: pct=[${mapping.creates.pctCol}], 24h=[${mapping.creates.col24h}], 7d=[${mapping.creates.col7d}], total=[${mapping.creates.colTotal}]`);
  else console.log("  CREATES: NOT FOUND");
  if (mapping.streams) console.log(`  STREAMS: pct=[${mapping.streams.pctCol}], 24h=[${mapping.streams.col24h}], 7d=[${mapping.streams.col7d}], total=[${mapping.streams.colTotal}]`);
  else console.log("  STREAMS: NOT FOUND");
  if (mapping.views) console.log(`  VIEWS: pct=[${mapping.views.pctCol}], 24h=[${mapping.views.col24h}], 7d=[${mapping.views.col7d}], total=[${mapping.views.colTotal}]`);
  else console.log("  VIEWS: NOT FOUND");

  return mapping;
}

function detectMultiRowHeader(lines: string[]): { headerLine: string; dataStart: number } {
  if (lines.length < 3) return { headerLine: lines[0], dataStart: 1 };

  const row0 = splitCSVLine(lines[0]);
  const row1 = splitCSVLine(lines[1]);
  const row2 = splitCSVLine(lines[2]);

  const countNumeric = (cells: string[]) =>
    cells.filter(c => {
      const v = c.replace(/[",\s%$]/g, "").replace(/—/g, "").replace(/–/g, "").replace(/-/g, "");
      return v.length > 0 && !isNaN(Number(v));
    }).length;

  const row1Numeric = countNumeric(row1);
  const row2Numeric = countNumeric(row2);
  const row1Total = row1.filter(c => c.trim().length > 0).length;

  const row0HasData = row0.some(h => {
    const low = h.toLowerCase().trim();
    return low.includes("tiktok") || low.includes("spotify") || low.includes("youtube") ||
      low.includes("stream") || low.includes("view") || low.includes("create") ||
      low.includes("high-reach") || low.includes("highreach") || low.includes("high reach") ||
      (low.includes("24h") && !low.includes("nr") && !low.includes("song") && !low.includes("artist"));
  });

  if (row0HasData) {
    console.log("=== Single-row header detected (contains data keywords) ===");
    return { headerLine: lines[0], dataStart: 1 };
  }

  if (row1Numeric < row1Total * 0.3 && row2Numeric > row2.length * 0.3) {
    console.log("=== Detected multi-row header, merging row 0 and row 1 ===");
    const merged: string[] = [];
    const maxLen = Math.max(row0.length, row1.length);
    let lastCategory = "";
    for (let i = 0; i < maxLen; i++) {
      const cat = (i < row0.length ? row0[i] : "").trim();
      const sub = (i < row1.length ? row1[i] : "").trim();
      if (cat) lastCategory = cat;
      if (sub && lastCategory && !sub.toLowerCase().includes(lastCategory.toLowerCase().split(" ")[0])) {
        merged.push(`${lastCategory} ${sub}`);
      } else if (sub) {
        merged.push(sub);
      } else if (cat) {
        merged.push(cat);
      } else {
        merged.push("");
      }
    }
    console.log("Merged headers:", JSON.stringify(merged));
    return { headerLine: merged.join(","), dataStart: 2 };
  }

  return { headerLine: lines[0], dataStart: 1 };
}

export function parseChartexCSV(csvContent: string, marketId: string): RawSoundEntry[] {
  const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    console.log("CSV has fewer than 2 lines, skipping");
    return [];
  }

  const bom = rawLines[0].charCodeAt(0) === 0xFEFF;
  const lines = bom ? [rawLines[0].substring(1), ...rawLines.slice(1)] : rawLines;

  console.log("=== Parsing CSV for market:", marketId, "===");
  console.log("Total lines:", lines.length);
  console.log("BOM detected:", bom);
  console.log("First line (raw):", lines[0].substring(0, 500));
  if (lines.length > 1) console.log("Second line (raw):", lines[1].substring(0, 500));

  const { headerLine, dataStart } = detectMultiRowHeader(lines);
  const headers = splitCSVLine(headerLine);

  console.log("Resolved header count:", headers.length);
  console.log("Data starts at line:", dataStart);

  const cols = classifyHeaders(headers);

  if (lines.length > dataStart) {
    const firstDataRow = splitCSVLine(lines[dataStart]);
    console.log("=== First data row verification ===");
    console.log(`  Row has ${firstDataRow.length} columns (headers: ${headers.length})`);
    console.log(`  Raw row values: ${firstDataRow.map((v, i) => `[${i}]="${v}"`).join(", ")}`);
    if (cols.creates) {
      console.log(`  CREATES -> pct[${cols.creates.pctCol}]="${firstDataRow[cols.creates.pctCol] ?? "UNDEF"}", 24h[${cols.creates.col24h}]="${firstDataRow[cols.creates.col24h] ?? "UNDEF"}", 7d[${cols.creates.col7d}]="${firstDataRow[cols.creates.col7d] ?? "UNDEF"}", total[${cols.creates.colTotal}]="${firstDataRow[cols.creates.colTotal] ?? "UNDEF"}"`);
    } else {
      console.log("  CREATES -> NULL (no creates columns found!)");
    }
    if (cols.streams) {
      console.log(`  STREAMS -> pct[${cols.streams.pctCol}]="${firstDataRow[cols.streams.pctCol] ?? "UNDEF"}", 24h[${cols.streams.col24h}]="${firstDataRow[cols.streams.col24h] ?? "UNDEF"}", 7d[${cols.streams.col7d}]="${firstDataRow[cols.streams.col7d] ?? "UNDEF"}", total[${cols.streams.colTotal}]="${firstDataRow[cols.streams.colTotal] ?? "UNDEF"}"`);
    }
    if (cols.views) {
      console.log(`  VIEWS -> pct[${cols.views.pctCol}]="${firstDataRow[cols.views.pctCol] ?? "UNDEF"}", 24h[${cols.views.col24h}]="${firstDataRow[cols.views.col24h] ?? "UNDEF"}", 7d[${cols.views.col7d}]="${firstDataRow[cols.views.col7d] ?? "UNDEF"}", total[${cols.views.colTotal}]="${firstDataRow[cols.views.colTotal] ?? "UNDEF"}"`);
    }
  }

  const entries: RawSoundEntry[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const raw = splitCSVLine(lines[i]);
    if (raw.length < 3) continue;

    const getVal = (idx: number): string => (idx >= 0 && idx < raw.length ? (raw[idx] ?? "").replace(/"/g, "").trim() : "");
    const getNum = (idx: number): number => {
      if (idx < 0 || idx >= raw.length) return 0;
      const val = raw[idx] ?? "";
      const result = parseNumber(val);
      return result;
    };

    const creates24hVal = cols.creates ? getNum(cols.creates.col24h) : 0;
    const creates7dVal = cols.creates ? getNum(cols.creates.col7d) : 0;
    const createsTotalVal = cols.creates ? getNum(cols.creates.colTotal) : 0;
    const streamsVal = cols.streams ? getNum(cols.streams.colTotal) : 0;
    const viewsVal = cols.views ? getNum(cols.views.colTotal) : 0;

    const entry: RawSoundEntry = {
      rank: cols.rank >= 0 ? parseInt(getVal(cols.rank)) || (i - dataStart + 1) : (i - dataStart + 1),
      soundName: getVal(cols.sound),
      songTitle: getVal(cols.song),
      artist: getVal(cols.artist),
      label: getVal(cols.label),
      growth24h: cols.creates ? getVal(cols.creates.pctCol) : "",
      creates24h: creates24hVal,
      creates7d: creates7dVal,
      createsTotal: createsTotalVal,
      tiktokLink: getVal(cols.link),
      market: marketId,
      streams: streamsVal,
      streams7d: cols.streams ? getNum(cols.streams.col7d) : 0,
      streams24h: cols.streams ? getNum(cols.streams.col24h) : 0,
      streams24hPercent: cols.streams ? getVal(cols.streams.pctCol) : "",
      views: viewsVal,
      views7d: cols.views ? getNum(cols.views.col7d) : 0,
      views24h: cols.views ? getNum(cols.views.col24h) : 0,
      views24hPercent: cols.views ? getVal(cols.views.pctCol) : "",
    };

    if (i === dataStart) {
      console.log("=== FIRST ENTRY DEBUG ===");
      console.log(`  songTitle="${entry.songTitle}", artist="${entry.artist}"`);
      console.log(`  creates24h=${entry.creates24h}, creates7d=${entry.creates7d}, createsTotal=${entry.createsTotal}`);
      console.log(`  streams=${entry.streams}, views=${entry.views}`);
    }

    if (entry.soundName || entry.songTitle) {
      entries.push(entry);
    }
  }

  console.log(`=== Parsed ${entries.length} entries from ${marketId} CSV ===`);
  if (entries.length > 0) {
    const s = entries[0];
    console.log(`  [0] "${s.soundName || s.songTitle}" by "${s.artist}"`);
    console.log(`    creates: 24h=${s.creates24h}, 7d=${s.creates7d}, total=${s.createsTotal}, growth="${s.growth24h}"`);
    console.log(`    streams: 24h=${s.streams24h}, 7d=${s.streams7d}, total=${s.streams}`);
    console.log(`    views: 24h=${s.views24h}, 7d=${s.views7d}, total=${s.views}`);
  }
  if (entries.length > 4) {
    const s = entries[4];
    console.log(`  [4] "${s.soundName || s.songTitle}" by "${s.artist}"`);
    console.log(`    creates: 24h=${s.creates24h}, 7d=${s.creates7d}, total=${s.createsTotal}`);
    console.log(`    streams: total=${s.streams}, views: total=${s.views}`);
  }
  return entries;
}

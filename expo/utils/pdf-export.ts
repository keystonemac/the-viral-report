import { ViralReport, ReportSound, formatCreates } from "./report-generator";
import { MARKETS } from "@/constants/markets";

function buildSoundRow(s: ReportSound, idx: number, isSongs: boolean): string {
  const tiktokUrl = s.tiktokLink
    ? s.tiktokLink.startsWith("http")
      ? s.tiktokLink
      : `https://www.tiktok.com/music/${s.tiktokLink}`
    : null;

  const title = s.songTitle || s.soundName;
  const creates = s.creates24h || s.createsTotal;

  const extraCols = isSongs
    ? `<td class="streams-col">${s.streams ? formatCreates(s.streams) : "—"}</td>
       <td class="streams-col">${s.streams7d ? formatCreates(s.streams7d) : "—"}</td>
       <td class="streams-col">${s.streams24h ? formatCreates(s.streams24h) : "—"}</td>
       <td class="views-col">${s.views ? formatCreates(s.views) : "—"}</td>
       <td class="views-col">${s.views7d ? formatCreates(s.views7d) : "—"}</td>
       <td class="views-col">${s.views24h ? formatCreates(s.views24h) : "—"}</td>`
    : "";

  const tiktokCol = isSongs
    ? ""
    : `<td class="link-col">${tiktokUrl ? `<a href="${tiktokUrl}" style="word-break:break-all;">${tiktokUrl}</a>` : "—"}</td>`;

  return `
    <tr>
      <td class="rank-col">${idx + 1}</td>
      <td class="song-col">
        <div class="song-title">${title}</div>
        <div class="song-artist">${s.artist}${s.label ? ` · ${s.label}` : ""}</div>
      </td>
      <td class="creates-col">${formatCreates(creates)}</td>
      ${extraCols}
      <td class="growth-col">${s.growth24h || "—"}</td>
      ${tiktokCol}
      <td class="comment-col">${s.comment || ""}</td>
    </tr>`;
}

function buildMarketSection(
  marketId: string,
  sounds: ReportSound[],
  isSongs: boolean
): string {
  const market = MARKETS.find((m) => m.id === marketId);
  if (!market || sounds.length === 0) return "";

  const itemLabel = isSongs ? "song" : "sound";
  const rows = sounds.map((s, i) => buildSoundRow(s, i, isSongs)).join("");

  const extraHeaders = isSongs
    ? `<th class="streams-col">Total Streams</th>
       <th class="streams-col">7D Streams</th>
       <th class="streams-col">24H Streams</th>
       <th class="views-col">Total Views</th>
       <th class="views-col">7D Views</th>
       <th class="views-col">24H Views</th>`
    : "";

  const tiktokHeader = isSongs ? "" : `<th class="link-col">TikTok</th>`;

  return `
    <div class="market-block">
      <div class="market-header">
        <span class="market-flag">${market.flag}</span>
        <span class="market-name">${market.label}</span>
        <span class="market-count">${sounds.length} ${itemLabel}${sounds.length !== 1 ? "s" : ""}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th class="rank-col">#</th>
            <th class="song-col">${isSongs ? "Song" : "Sound"} / Artist</th>
            <th class="creates-col">${isSongs ? "HR Creates" : "24h Creates"}</th>
            ${extraHeaders}
            <th class="growth-col">Growth</th>
            ${tiktokHeader}
            <th class="comment-col">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

export function generateReportHTML(report: ViralReport): string {
  const dateStr = new Date(report.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const marketIds = Object.keys(report.marketBreakdown);

  const soundsByMarket: Record<string, ReportSound[]> = {};
  for (const mId of marketIds) {
    soundsByMarket[mId] = report.sounds
      .filter((s) => s.markets.includes(mId))
      .sort((a, b) => (b.creates24h || b.createsTotal) - (a.creates24h || a.createsTotal));
  }

  const isSongs = report.reportMode === "songs";
  const itemLabel = isSongs ? "song" : "sound";

  const sections = marketIds
    .map((mId) => buildMarketSection(mId, soundsByMarket[mId] || [], isSongs))
    .join("");

  const totalSounds = report.totalSounds;
  const totalMarkets = marketIds.length;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>The Viral Report – ${dateStr}</title>
<style>
  @page { size: A4; margin: 0.6in 0.7in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    font-size: 10pt;
    line-height: 1.45;
    padding: 40px 48px;
    max-width: 800px;
    margin: 0 auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-banner {
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
    border-radius: 10px;
    padding: 28px 32px;
    margin-bottom: 28px;
    color: #fff;
  }
  .report-banner h1 {
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: 1.5px;
    margin-bottom: 4px;
    color: #fff;
  }
  .report-banner .tagline {
    font-size: 10pt;
    color: #aaa;
    font-weight: 400;
  }
  .report-banner .meta-row {
    display: flex;
    gap: 20px;
    margin-top: 14px;
    font-size: 9pt;
    color: #ccc;
  }
  .report-banner .meta-item {
    background: rgba(255,255,255,0.08);
    padding: 4px 12px;
    border-radius: 20px;
  }

  .market-block {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .market-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 2px solid #111;
    margin-bottom: 0;
  }
  .market-flag {
    font-size: 16pt;
  }
  .market-name {
    font-size: 12pt;
    font-weight: 700;
    color: #111;
  }
  .market-count {
    font-size: 9pt;
    color: #888;
    margin-left: auto;
    font-weight: 500;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  thead tr {
    border-bottom: 1px solid #ddd;
  }
  th {
    text-align: left;
    font-size: 7.5pt;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 6px 6px;
  }
  td {
    padding: 9px 6px;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }
  tr:last-child td {
    border-bottom: none;
  }

  .rank-col { width: 30px; text-align: center; }
  td.rank-col {
    font-weight: 700;
    font-size: 11pt;
    color: #333;
    vertical-align: middle;
  }
  .song-col { }
  .song-title {
    font-weight: 600;
    font-size: 10pt;
    color: #111;
    line-height: 1.3;
  }
  .song-artist {
    font-size: 8.5pt;
    color: #777;
    margin-top: 1px;
  }
  .creates-col {
    width: 80px;
    text-align: right;
    font-weight: 700;
    font-size: 10pt;
    color: #1a1a1a;
    vertical-align: middle;
  }
  .growth-col {
    width: 60px;
    text-align: right;
    font-size: 9pt;
    color: #16a34a;
    font-weight: 500;
    vertical-align: middle;
  }
  .link-col {
    width: 160px;
    text-align: left;
    vertical-align: middle;
    word-break: break-all;
  }
  .link-col a {
    color: #2563eb;
    text-decoration: underline;
    font-size: 7pt;
    font-weight: 500;
    word-break: break-all;
  }

  .comment-col {
    width: 140px;
    text-align: left;
    font-size: 8pt;
    color: #555;
    font-style: italic;
    vertical-align: middle;
  }

  .streams-col {
    width: 55px;
    text-align: right;
    font-size: 8pt;
    color: #1DB954;
    font-weight: 600;
    vertical-align: middle;
  }
  .views-col {
    width: 55px;
    text-align: right;
    font-size: 8pt;
    color: #FF0000;
    font-weight: 600;
    vertical-align: middle;
  }

  .footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    font-size: 8pt;
    color: #aaa;
    text-align: center;
  }

  @media print {
    body { padding: 0; }
    .market-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="report-banner">
    <h1>⚡ THE VIRAL REPORT</h1>
    <div class="tagline">TikTok Trending ${isSongs ? "Songs" : "Sounds"} · 24HR Report · Emerging Artists</div>
    <div class="meta-row">
      <span class="meta-item">📅 ${dateStr}</span>
      <span class="meta-item">🎵 ${totalSounds} ${itemLabel}${totalSounds !== 1 ? "s" : ""}</span>
      <span class="meta-item">🌍 ${totalMarkets} market${totalMarkets !== 1 ? "s" : ""}</span>
      <span class="meta-item">${isSongs ? "HR Creates" : "Creates"}: 10K–50K</span>
    </div>
  </div>

  ${sections}

  <div class="footer">
    Generated by The Viral Report · ${dateStr}
  </div>
</body>
</html>`;
}

export function openReportInNewWindow(html: string): void {
  const newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
    setTimeout(() => {
      newWindow.print();
    }, 400);
  }
}

function toBoldUnicode(text: string): string {
  const boldMap: Record<string, string> = {
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
    'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
    'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
    'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴',
    'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻',
    'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂',
    'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲',
    '7': '𝟳', '8': '𝟴', '9': '𝟵',
  };
  return text.split('').map(c => boldMap[c] || c).join('');
}

function buildPlainSoundLine(s: ReportSound, idx: number, isSongs: boolean): string {
  const title = s.songTitle || s.soundName;
  const tiktokUrl = s.tiktokLink
    ? s.tiktokLink.startsWith("http")
      ? s.tiktokLink
      : `https://www.tiktok.com/music/${s.tiktokLink}`
    : "";

  const parts: string[] = [];

  parts.push(`  ${toBoldUnicode(`${idx + 1}. ${title}`)}`);
  parts.push(`     𝗔𝗿𝘁𝗶𝘀𝘁: ${s.artist}${s.label ? `  ·  𝗟𝗮𝗯𝗲𝗹: ${s.label}` : ''}`);

  let createsLine = `     𝗖𝗿𝗲𝗮𝘁𝗲𝘀:  Total ${formatCreates(s.createsTotal)}  ·  7D ${formatCreates(s.creates7d)}  ·  24H ${formatCreates(s.creates24h)}`;
  if (s.growth24h) createsLine += `  (${s.growth24h})`;
  parts.push(createsLine);

  if (isSongs) {
    let streamsLine = `     𝗦𝘁𝗿𝗲𝗮𝗺𝘀:  Total ${s.streams ? formatCreates(s.streams) : '—'}  ·  7D ${s.streams7d ? formatCreates(s.streams7d) : '—'}  ·  24H ${s.streams24h ? formatCreates(s.streams24h) : '—'}`;
    if (s.streams24hPercent) streamsLine += `  (${s.streams24hPercent})`;
    parts.push(streamsLine);

    let viewsLine = `     𝗩𝗶𝗲𝘄𝘀:    Total ${s.views ? formatCreates(s.views) : '—'}  ·  7D ${s.views7d ? formatCreates(s.views7d) : '—'}  ·  24H ${s.views24h ? formatCreates(s.views24h) : '—'}`;
    if (s.views24hPercent) viewsLine += `  (${s.views24hPercent})`;
    parts.push(viewsLine);
  }

  if (tiktokUrl && !isSongs) parts.push(`     🔗 ${tiktokUrl}`);
  if (s.comment) parts.push(`     📝 ${s.comment}`);

  return parts.join('\n');
}

export function generateReportPlaintext(report: ViralReport): string {
  const dateStr = new Date(report.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const marketIds = Object.keys(report.marketBreakdown);
  const lines: string[] = [];

  const isSongs = report.reportMode === "songs";
  const itemLabel = isSongs ? "song" : "sound";
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const thinDivider = '────────────────────────────────────────';

  lines.push(divider);
  lines.push(`⚡  ${toBoldUnicode(`THE VIRAL REPORT`)}`);
  lines.push(`    TikTok Trending ${isSongs ? 'Songs' : 'Sounds'}  ·  24HR Report  ·  Emerging Artists`);
  lines.push('');
  lines.push(`    📅  ${dateStr}`);
  lines.push(`    🎵  ${report.totalSounds} ${itemLabel}${report.totalSounds !== 1 ? 's' : ''}  ·  🌍  ${marketIds.length} market${marketIds.length !== 1 ? 's' : ''}`);
  lines.push(divider);

  const soundsByMarket: Record<string, ReportSound[]> = {};
  for (const mId of marketIds) {
    soundsByMarket[mId] = report.sounds
      .filter((s) => s.markets.includes(mId))
      .sort((a, b) => (b.creates24h || b.createsTotal) - (a.creates24h || a.createsTotal));
  }

  for (const mId of marketIds) {
    const market = MARKETS.find((m) => m.id === mId);
    const sounds = soundsByMarket[mId] || [];
    if (!market || sounds.length === 0) continue;

    lines.push('');
    lines.push(`${market.flag}  ${toBoldUnicode(market.label.toUpperCase())}  —  ${sounds.length} ${itemLabel}${sounds.length !== 1 ? 's' : ''}`);
    lines.push(thinDivider);
    lines.push('');

    for (let i = 0; i < sounds.length; i++) {
      lines.push(buildPlainSoundLine(sounds[i], i, isSongs));
      if (i < sounds.length - 1) lines.push('');
    }

    lines.push('');
  }

  lines.push(divider);
  lines.push(`  Generated by The Viral Report  ·  ${dateStr}`);
  lines.push(divider);

  return lines.join('\n');
}

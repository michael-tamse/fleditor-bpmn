// scripts/generate-third-party.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT || 'THIRD_PARTY.md';
const PROD = process.env.PROD === 'true';           // nur runtime deps
const DEV  = process.env.DEV  === 'true';           // nur dev deps
const REQUIRE_PNPM = process.env.REQUIRE_PNPM === 'true';

function run(cmd) {
  try { return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }); }
  catch { return null; }
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

const isWorkspace = exists(path.join(process.cwd(), 'pnpm-workspace.yaml'));

// 1) pnpm-Befehle (ohne --depth, korrekt für 'licenses ls')
const pnpmFlags = ['licenses', 'ls', '--json'];
if (PROD) pnpmFlags.push('--prod');
if (DEV)  pnpmFlags.push('--dev');

const lcFlags = ['--json'];
if (PROD) lcFlags.push('--production');
const fallbackCmd = `npx --yes license-checker-rseidelsohn ${lcFlags.join(' ')}`;

const cmds = [];
// Try non-recursive first (matches typical manual usage), then ALWAYS try recursive,
// then fall back to license-checker.
cmds.push(`pnpm ${pnpmFlags.join(' ')}`);
cmds.push(`pnpm -r ${pnpmFlags.join(' ')}`);
cmds.push(fallbackCmd);

let raw = null;
let tool = null;
let usedCmd = null;

function parseJsonFlex(rawText) {
  // Try plain JSON first
  try {
    return JSON.parse(rawText);
  } catch (_) {
    // Try NDJSON (one JSON per line)
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('{') || l.startsWith('['));
    const parts = [];
    for (const line of lines) {
      try {
        parts.push(JSON.parse(line));
      } catch {}
    }
    if (parts.length === 0) return null;
    // Flatten arrays/objects into a single array of package-like entries
    const flat = [];
    for (const part of parts) {
      if (Array.isArray(part)) {
        flat.push(...part);
      } else if (part && typeof part === 'object') {
        if (Array.isArray(part.packages)) {
          flat.push(...part.packages);
        } else {
          flat.push(part);
        }
      }
    }
    return flat.length ? flat : null;
  }
}

for (const cmd of cmds) {
  const out = run(cmd);
  if (!out) continue;

  const parsed = parseJsonFlex(out);
  if (!parsed) continue;

  // Accept only if we actually have items
  const asArray = Array.isArray(parsed) ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray(parsed.packages)) ? parsed.packages
    : Array.isArray(Object.values(parsed)) ? Object.values(parsed) : [];

  if (asArray.length === 0) {
    // try next strategy (e.g., fall back to -r in workspaces)
    continue;
  }

  raw = JSON.stringify(parsed);
  tool = cmd.startsWith('pnpm') ? 'pnpm' : 'license-checker';
  usedCmd = cmd;
  break;
}

if (!raw) {
  console.error('Konnte keine Lizenzdaten generieren. Hinweis: Im Workspace-Root ohne Root-Dependencies liefert "pnpm licenses ls --json --prod" oft 0 Einträge. Versuche ohne PROD oder mit -r. Sind Dependencies installiert?');
  console.error('Versuchte Kommandos:\n - ' + cmds.join('\n - '));
  process.exit(1);
}
if (REQUIRE_PNPM && tool !== 'pnpm') {
  console.error('REQUIRE_PNPM=true gesetzt, aber pnpm-Ausgabe war leer/ungültig. Abbruch.');
  process.exit(2);
}

let data = JSON.parse(raw);

// --- Normalisierung ---
// pnpm liefert je nach Version/flags/NDJSON verschiedene Formen:
function normFromPnpm(json) {
  let items = [];
  if (Array.isArray(json)) {
    // Simple array of package objects
    items = json;
  } else if (json && typeof json === 'object') {
    if (Array.isArray(json.packages)) {
      // { packages: [...] }
      items = json.packages;
    } else {
      // Either a map of path->pkg OR a map of license-> [ { name, versions, ... } ]
      const values = Object.values(json);
      // Case A: license map (values are arrays; first element has "name" and optional "versions")
      const looksLikeLicenseBuckets = values.length > 0
        && Array.isArray(values[0])
        && (values[0].length === 0 || typeof values[0][0] === 'object')
        && (values[0][0]?.name || values[0][0]?.versions);
      if (looksLikeLicenseBuckets) {
        // flatten license buckets
        for (const arr of values) {
          for (const entry of arr) {
            items.push(entry);
          }
        }
      } else {
        // Case B: generic object map (e.g., path->pkg)
        items = values;
      }
    }
  }

  // Normalize into unified records.
  const out = [];
  for (const p of items) {
    if (!p) continue;

    // pnpm license bucket entries: { name, versions: [...], license, author, homepage, ... }
    if (p.name && Array.isArray(p.versions) && p.versions.length) {
      for (const v of p.versions) {
        out.push({
          name: p.name || '',
          version: v || '',
          license: (p.license || p.licenses || p.licenseName || 'UNKNOWN').toString(),
          homepage: (p.homepage || p.url || p.repository?.url || p.repository || '')
            .toString().replace(/^git\+/, '').replace(/\.git$/, ''),
          author: (p.publisher || p.author || p.authors || '').toString()
        });
      }
      continue;
    }

    // generic package-like objects
    const name = p.name || p.package || '';
    const version = p.version || p.versionInfo || p.versionSpecifier || '';
    const license = (p.license || p.licenses || p.licenseName || 'UNKNOWN').toString();
    const homepage = (p.homepage || p.url || p.repository?.url || p.repository || '')
      .toString().replace(/^git\+/, '').replace(/\.git$/, '');
    const author = (p.publisher || p.author || p.authors || '').toString();

    if (name) {
      out.push({ name, version, license, homepage, author });
    }
  }

  return out;
}
function normFromLicenseChecker(json) {
  const out = [];
  for (const [key, val] of Object.entries(json)) {
    const at = key.lastIndexOf('@');
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    const license = (val.licenses || 'UNKNOWN').toString();
    const homepage = (val.repository || val.url || '').toString();
    const author = (val.publisher || val.author || '').toString();
    if (name) out.push({ name, version, license, homepage, author });
  }
  return out;
}

let pkgs = tool === 'pnpm' ? normFromPnpm(data) : normFromLicenseChecker(data);

// Deduplizieren & sortieren
const map = new Map();
for (const p of pkgs) {
  const key = `${p.name}@${p.version || '?'}`;
  if (!map.has(key)) map.set(key, p);
}
pkgs = Array.from(map.values())
  .sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.version || '').localeCompare(b.version || '', 'en'));

// --- Markdown ---
function toMdTable(rows) {
  const header = `| Package | Version | License | Homepage |
|---|---:|---|---|
`;
  return header + rows.map(r => {
    const name = r.name ? `\`${r.name}\`` : '';
    const ver = r.version || '';
    const lic = r.license || '';
    const home = r.homepage ? `[link](${r.homepage})` : '';
    return `| ${name} | ${ver} | ${lic} | ${home} |`;
  }).join('\n');
}

const now = new Date().toISOString();
let md = `<!-- Generated on ${now}. Do not edit manually. -->
# Third-Party Software Notices

Dieses Dokument listet die im Projekt verwendeten Open-Source-Pakete und deren Lizenzen auf.

**Quelle:** \`${usedCmd}\`

## Übersicht (Tabelle)

${pkgs.length ? toMdTable(pkgs) : '_(Keine Pakete gefunden – evtl. nur Dev-Dependencies vorhanden oder im Workspace-Root ohne Root-Dependencies. Versuche ohne `PROD=true` oder mit Workspace-Scan `pnpm -r`.)_'}

## Nach Lizenz gruppiert

`;

const byLicense = pkgs.reduce((acc, p) => {
  (acc[p.license] ||= []).push(p);
  return acc;
}, {});

for (const lic of Object.keys(byLicense).sort()) {
  md += `### ${lic}\n\n`;
  for (const p of byLicense[lic]) {
    const home = p.homepage ? ` – ${p.homepage}` : '';
    const author = p.author ? ` · ${p.author}` : '';
    md += `- \`${p.name}@${p.version}\`${author}${home}\n`;
  }
  md += '\n';
}

fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT} with ${pkgs.length} packages using: ${usedCmd}`);
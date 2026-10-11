/**
 * Unicode Security Data Update Script
 * Fetches UTS #39 confusables/identifier data from unicode.org plus UCD
 * script data (Scripts, ScriptExtensions) and CLDR script metadata used by
 * the mixed-script / restriction-level APIs, and writes compact JSON datasets.
 */

import { renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "src", "data");

const BASE_URL = "https://www.unicode.org/Public/18.0.0/security/";
const UCD_URL = "https://www.unicode.org/Public/18.0.0/ucd/";
const CLDR_TAG = "release-48-2";
// Fetched through the nexus CDN mirror instead of a raw GitHub URL for
// consistent availability; the pinned tag keeps the data reproducible.
const CLDR_URL = `https://nexus.funish.net/cdn/gh/unicode-org/cldr@${CLDR_TAG}/common/properties/`;

interface Dataset {
  version: string;
  date: string;
  confusables: Record<string, { target: string; type: "MA" | "MI" | "X" }>;
}

interface IntentionalDataset {
  version: string;
  date: string;
  pairs: { source: string; target: string }[];
}

interface RangesDataset {
  version: string;
  ranges: [number, number, string][];
}

/** Write via a temp file + rename so a mid-run failure never leaves
 * half-updated JSON behind. */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

function parseRangeBoundary(token: string): number {
  return parseInt(token, 16);
}

function parseRangesFile(content: string): RangesDataset {
  let version = "unknown";
  const ranges: [number, number, string][] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith("# Version:")) version = line.split(":")[1].trim();
    if (version === "unknown") {
      const fileVersion = line.match(/^#\s*\w+-(\d+\.\d+\.\d+)\.txt/);
      if (fileVersion) version = fileVersion[1];
    }
    if (line.startsWith("#") || line.trim() === "") continue;

    const match = line.match(
      /^([0-9A-Fa-f]+)(?:\.\.([0-9A-Fa-f]+))?\s*;\s*([A-Za-z_][A-Za-z_0-9\s]*?)\s*(?:#.*)?$/,
    );
    if (!match) continue;

    const [, startHex, endHex, value] = match;
    const start = parseRangeBoundary(startHex);
    const end = endHex ? parseRangeBoundary(endHex) : start;
    ranges.push([start, end, value.trim()]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  return { version, ranges };
}

const SOURCES = [
  {
    file: "confusables.json",
    url: `${BASE_URL}confusables.txt`,
    label: "confusables.txt",
    kind: "confusables" as const,
  },
  {
    file: "intentional.json",
    url: `${BASE_URL}intentional.txt`,
    label: "intentional.txt",
    kind: "intentional" as const,
  },
  {
    file: "identifier-status.json",
    url: `${BASE_URL}IdentifierStatus.txt`,
    label: "IdentifierStatus.txt",
    kind: "ranges" as const,
  },
  {
    file: "identifier-type.json",
    url: `${BASE_URL}IdentifierType.txt`,
    label: "IdentifierType.txt",
    kind: "ranges" as const,
  },
  {
    file: "scripts.json",
    url: `${UCD_URL}Scripts.txt`,
    label: "Scripts.txt",
    kind: "ranges" as const,
  },
  {
    file: "script-extensions.json",
    url: `${UCD_URL}ScriptExtensions.txt`,
    label: "ScriptExtensions.txt",
    kind: "ranges" as const,
  },
  {
    file: "script-metadata.json",
    url: `${CLDR_URL}scriptMetadata.txt`,
    label: "scriptMetadata.txt",
    kind: "script-metadata" as const,
  },
  {
    file: "default-ignorable.json",
    url: `${UCD_URL}DerivedCoreProperties.txt`,
    label: "DerivedCoreProperties.txt",
    kind: "derived-properties" as const,
  },
] as const;

/** UCD property value aliases: long Script names -> 4-letter codes (Latin -> Latn). */
async function fetchScriptNameMap(): Promise<Map<string, string>> {
  const content = await fetchText(`${UCD_URL}PropertyValueAliases.txt`, "PropertyValueAliases.txt");
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const match = line.match(
      /^sc\s*;\s*([A-Za-z_]+)\s*;\s*([A-Za-z_]+)(?:\s*;\s*[A-Za-z_]+)*\s*(?:#.*)?$/,
    );
    if (match) map.set(match[2], match[1]);
  }
  return map;
}

/** intentional.txt is a pair list; the same source may appear on several rows. */
function parseIntentionalFile(content: string): IntentionalDataset {
  let version = "unknown";
  let date = "unknown";
  const pairs: IntentionalDataset["pairs"] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith("# Version:")) version = line.split(":")[1].trim();
    if (line.startsWith("# Date:")) date = line.split(":").slice(1).join(":").trim();
    if (line.startsWith("#") || line.trim() === "") continue;

    const match = line.match(/^([0-9A-Fa-f]+)\s*;\s*([0-9A-Fa-f]+)\s*(?:;|#)/);
    if (!match) continue;
    pairs.push({
      source: String.fromCodePoint(parseInt(match[1], 16)),
      target: String.fromCodePoint(parseInt(match[2], 16)),
    });
  }

  return { version, date, pairs };
}

/** Extract one DerivedCoreProperties range table, e.g. Default_Ignorable_Code_Point. */
function parseDerivedProperty(
  content: string,
  property: string,
): { version: string; ranges: [number, number][] } {
  let version = "unknown";
  const ranges: [number, number][] = [];

  for (const line of content.split("\n")) {
    const fileVersion = line.match(/^#\s*\w+-(\d+\.\d+\.\d+)\.txt/);
    if (fileVersion) version = fileVersion[1];
    if (line.startsWith("#") || line.trim() === "") continue;

    const match = line.match(
      new RegExp(`^([0-9A-Fa-f]+)(?:\\.\\.([0-9A-Fa-f]+))?\\s*;\\s*${property}\\s*(?:#.*)?$`),
    );
    if (!match) continue;
    ranges.push([parseInt(match[1], 16), parseInt(match[2] ?? match[1], 16)]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  return { version, ranges };
}

function parseConfusablesFile(content: string): Dataset {
  let version = "unknown";
  let date = "unknown";
  const confusables: Dataset["confusables"] = {};

  for (const line of content.split("\n")) {
    if (line.startsWith("# Version:")) version = line.split(":")[1].trim();
    if (line.startsWith("# Date:")) date = line.split(":").slice(1).join(":").trim();
    if (line.startsWith("#") || line.trim() === "") continue;

    // Format: source ; target-sequence ; type # description.
    // The target is one prototype string, not a list of alternatives.
    const match =
      line.match(/^([0-9A-Fa-f]+)\s*;\s*([0-9A-Fa-f\s]+?)\s*;\s*(MA|MI|X)/) ??
      line.match(/^([0-9A-Fa-f]+)\s*;\s*([0-9A-Fa-f\s]+?)\s*#/);
    if (!match) continue;

    const [, sourceHex, targetHexStr, type] = match;
    const sourceChar = String.fromCodePoint(parseInt(sourceHex, 16));
    const target = targetHexStr
      .trim()
      .split(/\s+/)
      .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
      .join("");

    confusables[sourceChar] = { target, type: (type ?? "MA") as "MA" | "MI" | "X" };
  }

  return { version, date, confusables };
}

/** CLDR scriptMetadata.txt rows: `Latn; 2; 004C; IT; 1; RECOMMENDED; ...` — keep the ID_Usage column. */
function parseScriptMetadata(content: string): {
  version: string;
  scripts: Record<string, string>;
} {
  const scripts: Record<string, string> = {};
  // scriptMetadata.txt has no inline version; attribute it to the pinned tag
  let version = CLDR_TAG.replace("release-", "").replace("-", ".");

  for (const line of content.split("\n")) {
    const fileVersion = line.match(/^#\s*Unicode Version:\s*(.+)$/);
    if (fileVersion) version = fileVersion[1].trim();
    if (line.startsWith("#") || line.trim() === "") continue;

    const columns = line.split(";").map((part) => part.trim());
    if (columns.length < 6 || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(columns[0])) continue;
    scripts[columns[0]] = columns[5].toUpperCase();
  }

  return { version, scripts };
}

async function fetchText(url: string, label: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${label}`);
  const content = await response.text();
  console.log(`📥 Fetched ${label} (${content.length} bytes)`);
  return content;
}

async function main() {
  for (const source of SOURCES) {
    const content = await fetchText(source.url, source.label);
    const filePath = join(DATA_DIR, source.file);

    if (source.kind === "confusables") {
      const data = parseConfusablesFile(content);
      writeJsonAtomic(filePath, data);
      const kb = (await import("node:fs")).statSync(filePath).size;
      console.log(
        `💾 ${source.file}: ${Object.keys(data.confusables).length} mappings, version ${data.version} (${(kb / 1024).toFixed(0)} KB)`,
      );
    } else if (source.kind === "intentional") {
      const data = parseIntentionalFile(content);
      writeJsonAtomic(filePath, data);
      console.log(`💾 ${source.file}: ${data.pairs.length} pairs, version ${data.version}`);
    } else if (source.kind === "derived-properties") {
      // One DerivedCoreProperties.txt download feeds three range tables.
      const properties = [
        { file: "default-ignorable.json", property: "Default_Ignorable_Code_Point" },
        { file: "xid-start.json", property: "XID_Start" },
        { file: "xid-continue.json", property: "XID_Continue" },
      ] as const;
      for (const { file, property } of properties) {
        const data = parseDerivedProperty(content, property);
        writeJsonAtomic(join(DATA_DIR, file), data);
        console.log(`Saved ${file}: ${data.ranges.length} ranges, version ${data.version}`);
      }
    } else if (source.kind === "script-metadata") {
      const data = parseScriptMetadata(content);
      writeJsonAtomic(filePath, data);
      const kb = (await import("node:fs")).statSync(filePath).size;
      console.log(
        `💾 ${source.file}: ${Object.keys(data.scripts).length} scripts, version ${data.version} (${(kb / 1024).toFixed(0)} KB)`,
      );
    } else {
      const data = parseRangesFile(content);
      if (source.file === "scripts.json") {
        const nameMap = await fetchScriptNameMap();
        data.ranges = data.ranges.map(([start, end, value]) => [
          start,
          end,
          nameMap.get(value) ?? value,
        ]);
      }
      writeJsonAtomic(filePath, data);
      const kb = (await import("node:fs")).statSync(filePath).size;
      console.log(
        `💾 ${source.file}: ${data.ranges.length} ranges, version ${data.version} (${(kb / 1024).toFixed(0)} KB)`,
      );
    }
  }
}

await main();

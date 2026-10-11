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
// CLDR 49 has not had a final tag yet; beta 3 is the pinned Unicode 18 line.
const CLDR_TAG = "release-49-beta3";
// Fetched from the official CLDR repository; the pinned tag keeps updates reproducible.
const CLDR_URL = `https://raw.githubusercontent.com/unicode-org/cldr/${CLDR_TAG}/common/properties/`;
/** Keep generated range tables compact while preserving one range per line. */
function serializeDataset(data) {
  if (typeof data === "object" && data !== null && "ranges" in data && Array.isArray(data.ranges)) {
    const dataset = data;
    const ranges = dataset.ranges.map((range) => `    ${JSON.stringify(range)}`).join(",\n");
    return `{
  "version": ${JSON.stringify(dataset.version)},
  "ranges": [
${ranges}
  ]
}\n`;
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}
/** Write via a temp file + rename so a mid-run failure never leaves
 * half-updated JSON behind. */
function writeJsonAtomic(filePath, data) {
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, serializeDataset(data), "utf-8");
  renameSync(tmpPath, filePath);
}
function parseRangeBoundary(token) {
  return parseInt(token, 16);
}
function parseRangesFile(content) {
  let version = "unknown";
  const ranges = [];
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
    kind: "confusables",
  },
  {
    file: "intentional.json",
    url: `${BASE_URL}intentional.txt`,
    label: "intentional.txt",
    kind: "intentional",
  },
  {
    file: "identifier-status.json",
    url: `${BASE_URL}IdentifierStatus.txt`,
    label: "IdentifierStatus.txt",
    kind: "ranges",
  },
  {
    file: "identifier-type.json",
    url: `${BASE_URL}IdentifierType.txt`,
    label: "IdentifierType.txt",
    kind: "ranges",
  },
  {
    file: "scripts.json",
    url: `${UCD_URL}Scripts.txt`,
    label: "Scripts.txt",
    kind: "ranges",
  },
  {
    file: "script-extensions.json",
    url: `${UCD_URL}ScriptExtensions.txt`,
    label: "ScriptExtensions.txt",
    kind: "ranges",
  },
  {
    file: "script-metadata.json",
    url: `${CLDR_URL}scriptMetadata.txt`,
    label: "scriptMetadata.txt",
    kind: "script-metadata",
  },
  {
    file: "default-ignorable.json",
    url: `${UCD_URL}DerivedCoreProperties.txt`,
    label: "DerivedCoreProperties.txt",
    kind: "derived-properties",
  },
];
/** UCD property value aliases: long Script names -> 4-letter codes (Latin -> Latn). */
async function fetchScriptNameMap() {
  const content = await fetchText(`${UCD_URL}PropertyValueAliases.txt`, "PropertyValueAliases.txt");
  const map = new Map();
  for (const line of content.split("\n")) {
    const match = line.match(
      /^sc\s*;\s*([A-Za-z_]+)\s*;\s*([A-Za-z_]+)(?:\s*;\s*[A-Za-z_]+)*\s*(?:#.*)?$/,
    );
    if (match) map.set(match[2], match[1]);
  }
  return map;
}
/** intentional.txt is a pair list; the same source may appear on several rows. */
function parseIntentionalFile(content) {
  let version = "unknown";
  let date = "unknown";
  const pairs = [];
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
function parseDerivedProperty(content, property) {
  let version = "unknown";
  const ranges = [];
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
function parseConfusablesFile(content) {
  let version = "unknown";
  let date = "unknown";
  const confusables = {};
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
    confusables[sourceChar] = { target, type: type ?? "MA" };
  }
  return { version, date, confusables };
}
/** CLDR scriptMetadata.txt rows: `Latn; 2; 004C; IT; 1; RECOMMENDED; ...` — keep the ID_Usage column. */
function parseScriptMetadata(content) {
  const scripts = {};
  // scriptMetadata.txt has no inline Unicode version header. The pinned CLDR
  // beta is aligned with the UCD version above.
  let version = "18.0.0";
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
async function fetchText(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${label}`);
  const content = await response.text();
  console.log(`📥 Fetched ${label} (${content.length} bytes)`);
  return content;
}
async function main() {
  // Parse every source before writing anything so a late fetch or parse
  // failure cannot leave the data directory on mixed Unicode versions.
  const outputs = new Map();
  for (const source of SOURCES) {
    const content = await fetchText(source.url, source.label);
    if (source.kind === "confusables") {
      const data = parseConfusablesFile(content);
      if (data.version === "unknown" || Object.keys(data.confusables).length < 6000) {
        throw new Error(`confusables.txt produced invalid data`);
      }
      outputs.set(source.file, data);
    } else if (source.kind === "intentional") {
      const data = parseIntentionalFile(content);
      if (data.version === "unknown" || data.pairs.length === 0) {
        throw new Error(`intentional.txt produced invalid data`);
      }
      outputs.set(source.file, data);
    } else if (source.kind === "derived-properties") {
      // One DerivedCoreProperties.txt download feeds three range tables.
      const properties = [
        { file: "default-ignorable.json", property: "Default_Ignorable_Code_Point" },
        { file: "xid-start.json", property: "XID_Start" },
        { file: "xid-continue.json", property: "XID_Continue" },
      ];
      for (const { file, property } of properties) {
        const data = parseDerivedProperty(content, property);
        if (data.version === "unknown" || data.ranges.length === 0) {
          throw new Error(`${property} produced invalid data`);
        }
        outputs.set(file, data);
      }
    } else if (source.kind === "script-metadata") {
      const data = parseScriptMetadata(content);
      if (Object.keys(data.scripts).length < 100) {
        throw new Error("scriptMetadata.txt produced invalid data");
      }
      outputs.set(source.file, data);
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
      // Identifier_Status intentionally publishes only Allowed entries today.
      // Reject any unexpected value instead of letting range lookup semantics
      // silently invert if the upstream format changes.
      if (source.file === "identifier-status.json") {
        data.ranges = data.ranges.filter(([, , value]) => value === "Allowed");
      }
      if (data.version === "unknown" || data.ranges.length === 0) {
        throw new Error(`${source.label} produced invalid data`);
      }
      outputs.set(source.file, data);
    }
  }
  for (const [file, data] of outputs) {
    const filePath = join(DATA_DIR, file);
    writeJsonAtomic(filePath, data);
    const summary =
      "confusables" in data
        ? `${Object.keys(data.confusables).length} mappings`
        : "pairs" in data
          ? `${data.pairs.length} pairs`
          : "scripts" in data
            ? `${Object.keys(data.scripts).length} scripts`
            : `${data.ranges.length} ranges`;
    const version = data.version;
    const kb = (await import("node:fs")).statSync(filePath).size;
    console.log(`💾 ${file}: ${summary}, version ${version} (${(kb / 1024).toFixed(0)} KB)`);
  }
}
await main();

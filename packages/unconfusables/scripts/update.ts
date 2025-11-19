/**
 * Unicode Confusables Data Update Script
 * Fetches the latest confusables data from Unicode ICU and updates local JSON files
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "src", "data");

// Unicode confusables data source URL
const CONFUSABLES_URL =
  "https://cdn.jsdelivr.net/gh/unicode-org/icu/icu4c/source/data/unidata/confusables.txt";

import type {
  ConfusableMap,
  ConfusableRecord,
  ConfusableType,
} from "../src/types";

/**
 * Parse confusables.txt content into structured data
 */
function parseConfusablesFile(content: string): ConfusableMap {
  const lines = content.split("\n");
  const confusables: Record<string, ConfusableRecord> = {};
  const reverseLookup: Record<string, string[]> = {};

  let version = "unknown";
  let date = "unknown";

  for (const line of lines) {
    // Parse version and date information
    if (line.startsWith("# Version:")) {
      version = line.split(":")[1].trim();
    }
    if (line.startsWith("# Date:")) {
      date = line.split(":")[1].trim();
    }

    // Skip comment lines and empty lines
    if (line.startsWith("#") || line.trim() === "") {
      continue;
    }

    // Parse confusable character mapping lines
    // Format: source ; target ; type # description
    const match = line.match(
      /^([0-9A-Fa-f]+)\s*;\s*([0-9A-Fa-f\s]+)\s*;\s*(MA|MI|X)/,
    );
    if (!match) continue;

    const [, sourceHex, targetHexStr, type] = match;

    // Convert hexadecimal code points to strings
    const sourceChar = String.fromCodePoint(parseInt(sourceHex, 16));

    // Parse target characters (can be multiple characters)
    const targetHexes = targetHexStr.trim().split(/\s+/);
    const targetChars = targetHexes.map((hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );

    // Get description information
    const descriptionMatch = line.match(/#\s*(.+)$/);
    const description = descriptionMatch
      ? descriptionMatch[1].trim()
      : undefined;

    const record: ConfusableRecord = {
      source: sourceChar,
      target: targetChars,
      type: type as ConfusableType,
      description,
    };

    confusables[sourceChar] = record;

    // Build reverse lookup index
    for (const targetChar of targetChars) {
      if (!reverseLookup[targetChar]) {
        reverseLookup[targetChar] = [];
      }
      reverseLookup[targetChar].push(sourceChar);
    }
  }

  return {
    version,
    date,
    confusables,
    reverseLookup,
  };
}

/**
 * Fetch confusables data from Unicode ICU repository
 */
async function fetchConfusablesData(): Promise<string> {
  console.log(`📥 Fetching confusables data from Unicode ICU...`);

  try {
    const response = await fetch(CONFUSABLES_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    console.log(
      `✅ Successfully fetched confusables.txt (${content.length} bytes)`,
    );
    return content;
  } catch (error) {
    console.error(`❌ Failed to fetch confusables.txt:`, String(error));
    throw error;
  }
}

/**
 * Update confusables data
 */
async function updateConfusablesData() {
  console.log("🔄 Updating Unicode confusables data...");

  try {
    // Fetch the latest confusables data
    const content = await fetchConfusablesData();

    // Parse the content
    console.log("🔍 Parsing confusables data...");
    const data = parseConfusablesFile(content);

    console.log(`📊 Parsing completed:`);
    console.log(`   Version: ${data.version}`);
    console.log(`   Date: ${data.date}`);
    console.log(`   Total mappings: ${Object.keys(data.confusables).length}`);
    console.log(
      `   Reverse lookup entries: ${Object.keys(data.reverseLookup).length}`,
    );

    // Save as JSON file
    const filePath = join(DATA_DIR, "confusables.json");
    const jsonOutput = JSON.stringify(data, null, 2);
    writeFileSync(filePath, jsonOutput, "utf-8");

    console.log(`💾 Successfully updated confusables.json`);

    // Display some sample data for verification
    const sampleKeys = Object.keys(data.confusables).slice(0, 5);
    console.log("\n📝 Sample mappings:");
    for (const key of sampleKeys) {
      const record = data.confusables[key];
      const keyHex = key
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      const targetHex = record.target.map((t) =>
        t.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"),
      );
      console.log(
        `   U+${keyHex} (${key}) → [${record.target.map((t, i) => `U+${targetHex[i]} (${t})`).join(", ")}] (${record.type})`,
      );
    }
  } catch (error) {
    console.error("❌ Failed to update confusables data:", String(error));
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("🚀 Starting Unicode confusables data update...\n");

    await updateConfusablesData();

    console.log("\n🎯 Update completed successfully!");
  } catch (error) {
    console.error("\n❌ Update failed:", String(error));
    process.exit(1);
  }
}

// Execute the script if running directly
if (import.meta.main) {
  await main();
}

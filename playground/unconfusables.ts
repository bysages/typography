import {
  getConfusables,
  getConfusableSources,
  normalizeString,
  normalizeStringAll,
  areConfusable,
  getConfusableVariations,
  getMetadata,
  confusables,
} from "unconfusables";

function testBasicFunctions() {
  console.log("=== Basic Functions Test ===\n");

  // Test metadata
  console.log("📊 Metadata:");
  const metadata = getMetadata();
  console.log(`   Version: ${metadata.version}`);
  console.log(`   Total mappings: ${metadata.totalMappings}\n`);

  // Test single character lookup
  console.log("🔍 Character lookup:");
  const chars = ["0", "1", "O", "l"];
  chars.forEach((char) => {
    const mapping = getConfusables(char);
    if (mapping) {
      console.log(
        `   '${char}' -> ${mapping.target.map((t) => `'${t}'`).join(", ")} (${mapping.type})`,
      );
    } else {
      const sources = getConfusableSources(char);
      console.log(
        `   '${char}' <- ${
          sources.length > 0
            ? sources
                .slice(0, 3)
                .map((s) => `'${s}'`)
                .join(", ") + "..."
            : "no sources"
        }`,
      );
    }
  });

  console.log();
}

function testNormalization() {
  console.log("🔧 String Normalization:\n");

  const testCases = [
    "0l", // numbers and letters
    "123", // numbers only
    "admin", // common word
    "paypa1", // mixed
    "P@yp@ss", // with symbols
    "google", // brand
    "micros0ft", // brand with number
  ];

  testCases.forEach((str) => {
    const normalized = normalizeString(str);
    const normalizedAll = normalizeStringAll(str);
    console.log(
      `   '${str}' -> '${normalized}' (MA) -> '${normalizedAll}' (all)`,
    );
  });

  console.log();
}

function testConfusability() {
  console.log("⚖️  Confusability Check:\n");

  const pairs = [
    ["0l", "Ol"],
    ["1", "l"],
    ["admin", "adm1n"],
    ["paypal", "paypa1"],
    ["google", "goog1e"],
    ["microsoft", "micros0ft"],
  ];

  pairs.forEach(([str1, str2]) => {
    const isConfusable = areConfusable(str1, str2);
    console.log(
      `   '${str1}' vs '${str2}': ${isConfusable ? "✅ Confusable" : "❌ Not confusable"}`,
    );
  });

  console.log();
}

function testVariations() {
  console.log("🎭 Confusable Variations:\n");

  const testStrings = ["0l", "admin", "pay"];
  testStrings.forEach((text) => {
    const variations = getConfusableVariations(text);
    console.log(`   '${text}': ${variations.length} variations`);
    variations.slice(0, 8).forEach((v) => console.log(`     - '${v}'`));
    if (variations.length > 8) {
      console.log(`     ... and ${variations.length - 8} more`);
    }
  });

  console.log();
}

function testSecurityScenarios() {
  console.log("🔒 Security Scenarios:\n");

  // Simulate phishing detection
  const suspiciousUrls = [
    "g00gle.com",
    "paypa1.com",
    "m1crosoft.com",
    "amaz0n.com",
  ];

  console.log("🚨 Phishing detection:");
  suspiciousUrls.forEach((url) => {
    const normalized = normalizeString(url);
    const legitimate = normalized.replace(".com", "");
    console.log(`   '${url}' -> normalized to '${normalized}'`);
    console.log(`   Looks like: ${legitimate}`);
  });

  console.log();
}

function testUnicodeExamples() {
  console.log("🌐 Unicode Examples:\n");

  // Test various Unicode characters
  const unicodeChars = [
    ["с", "c"], // Cyrillic c
    ["о", "o"], // Cyrillic o
    ["а", "a"], // Cyrillic a
    ["е", "e"], // Cyrillic e
    ["і", "i"], // Ukrainian i
    ["ј", "j"], // Macedonian j
  ];

  unicodeChars.forEach(([char, expected]) => {
    const mapping = getConfusables(char);
    console.log(
      `   '${char}' (Unicode) -> ${mapping ? `'${mapping.target[0]}'` : "no mapping"} (expected: '${expected}')`,
    );
  });

  console.log();
}

function showDatasetInfo() {
  console.log("📈 Dataset Information:\n");

  const totalMappings = Object.keys(confusables.confusables).length;
  const totalTargets = Object.keys(confusables.reverseLookup).length;

  // Find some interesting mappings
  const interestingMappings: Array<[string, string[]]> = [];
  for (const [source, record] of Object.entries(confusables.confusables)) {
    if (
      record.target.length > 1 ||
      (source.charCodeAt(0) > 127 && record.target[0].charCodeAt(0) <= 127)
    ) {
      interestingMappings.push([source, record.target]);
      if (interestingMappings.length >= 10) break;
    }
  }

  console.log(`   Total source characters: ${totalMappings}`);
  console.log(`   Total target characters: ${totalTargets}`);
  console.log(`   Interesting mappings (multi-target or Unicode):`);
  interestingMappings.slice(0, 5).forEach(([source, targets]) => {
    const sourceCode = source
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    const targetCodes = targets.map(
      (t: string) =>
        `'${t}' (${t.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")})`,
    );
    console.log(
      `     U+${sourceCode} '${source}' -> [${targetCodes.join(", ")}]`,
    );
  });

  console.log();
}

function main() {
  console.log("🧪 Unicode Confusables Library Test\n");
  console.log("=====================================\n");

  try {
    testBasicFunctions();
    testNormalization();
    testConfusability();
    testVariations();
    testSecurityScenarios();
    testUnicodeExamples();
    showDatasetInfo();

    console.log("✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

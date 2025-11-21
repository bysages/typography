import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import {
  createFont,
  renderGlyph,
  createGlyphManager,
  parseFont,
  generateFont,
  type GlyphData,
  type FontOptions,
} from "unglyph";

// Clean and create cache directory
const cacheDir = ".cache";
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
}
mkdirSync(cacheDir, { recursive: true });

async function getGlyphsFromFont(): Promise<GlyphData[]> {
  console.log("Parsing Roboto-Regular.ttf font file...");

  try {
    // Parse the Roboto font file
    const fontPath = join(process.cwd(), "Roboto-Regular.ttf");
    const fontBuffer = readFileSync(fontPath);
    const parsedFont = parseFont(fontBuffer);

    console.log(`✓ Font parsed successfully: ${parsedFont.familyName}`);
    console.log(`✓ Total glyphs available: ${parsedFont.glyphs.length}`);

    // Find A, B, C glyphs from parsed FontData
    const glyphA = parsedFont.glyphs.find((g) => g.unicode === 65);
    const glyphB = parsedFont.glyphs.find((g) => g.unicode === 66);
    const glyphC = parsedFont.glyphs.find((g) => g.unicode === 67);
    const spaceGlyph = parsedFont.glyphs.find((g) => g.unicode === 32);

    const glyphs: GlyphData[] = [];

    if (glyphA) {
      console.log(
        `✓ Found glyph A (id: ${glyphA.index}, name: ${glyphA.name || "unnamed"})`,
      );
      glyphs.push(glyphA);
    } else {
      console.log("✗ Glyph A not found in font");
    }

    if (glyphB) {
      console.log(
        `✓ Found glyph B (id: ${glyphB.index}, name: ${glyphB.name || "unnamed"})`,
      );
      glyphs.push(glyphB);
    } else {
      console.log("✗ Glyph B not found in font");
    }

    if (glyphC) {
      console.log(
        `✓ Found glyph C (id: ${glyphC.index}, name: ${glyphC.name || "unnamed"})`,
      );
      glyphs.push(glyphC);
    } else {
      console.log("✗ Glyph C not found in font");
    }

    if (spaceGlyph) {
      console.log(`✓ Found space glyph (id: ${spaceGlyph.index})`);
      glyphs.push(spaceGlyph);
    }

    return glyphs;
  } catch (error) {
    console.error("✗ Failed to parse font:", error);
    throw error;
  }
}

async function testUnglyphWorkflow() {
  console.log("Starting unglyph workflow test...");

  // 1. Get glyphs from Roboto font
  console.log("\n1. Getting glyphs from Roboto-Regular.ttf...");
  const fontGlyphs = await getGlyphsFromFont();
  const manager = createGlyphManager(fontGlyphs);

  console.log(
    `✓ Manager created successfully with ${manager.count()} glyphs from font`,
  );

  // 2. Test manager functionality
  console.log("\n2. Testing manager functionality...");
  console.log(`✓ Contains glyph with index 0: ${manager.has(0)}`);
  console.log(`✓ Find 'A' by unicode 65: ${manager.findByUnicode(65)?.name}`);
  console.log(`✓ Find 'B' by unicode 66: ${manager.findByUnicode(66)?.name}`);
  console.log(`✓ Is empty: ${manager.isEmpty()}`);

  // 3. Create font
  console.log("\n3. Creating font...");
  const fontOptions: FontOptions = {
    familyName: "TestFont",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    weight: 400,
  };

  const fontData = createFont(manager.list(), fontOptions);
  const fontBytes = generateFont(fontData);
  console.log(
    `✓ Font created successfully, format: otf, size: ${fontBytes.length} bytes`,
  );

  // 4. Test rendering functionality
  console.log("\n4. Testing rendering functionality...");
  const glyphA = manager.findByUnicode(65);
  if (glyphA) {
    const svg = renderGlyph(glyphA, {
      size: 100,
      color: "#2563eb",
      padding: 20,
    });
    console.log(
      `✓ Glyph 'A' rendered successfully, SVG length: ${svg.length} characters`,
    );

    // Save SVG file for inspection
    writeFileSync(join(cacheDir, "glyph_A.svg"), svg);
    console.log("✓ Saved as glyph_A.svg");
  }

  // 5. Display glyph information
  console.log("\n5. Displaying glyph information...");
  fontGlyphs.forEach((glyph, index) => {
    console.log(
      `   Glyph ${index + 1}: ${glyph.name} (unicode: ${glyph.unicode}, index: ${glyph.index}, advance: ${glyph.advanceWidth})`,
    );
    if (glyph.path.commands.length > 0) {
      console.log(`     Path commands: ${glyph.path.commands.length}`);
    } else {
      console.log(`     Path commands: 0 (empty glyph)`);
    }
  });

  // 6. Final test: recreate font
  console.log("\n6. Final test...");
  const finalFontData = createFont(manager.list(), fontOptions);
  const finalFontBytes = generateFont(finalFontData);

  console.log(`🎉 Final results:`);
  console.log(`   Parsed glyphs from Roboto: ${manager.count()}`);
  console.log(`   Created font size: ${finalFontBytes.length} bytes`);

  console.log("\n🎯 unglyph test completed with Roboto font!");

  // 7. Test Image rendering for all glyphs using the new API
  console.log("\n7. Testing Image rendering for all parsed glyphs...");

  // Filter non-empty glyphs and assign colors
  const colors = [
    "#000000",
    "#1e40af",
    "#dc2626",
    "#059669",
    "#7c3aed",
    "#dc2626",
  ];
  const nonEmptyGlyphs = fontGlyphs.filter((g) => g.path.commands.length > 0);

  for (let i = 0; i < nonEmptyGlyphs.length; i++) {
    const glyph = nonEmptyGlyphs[i];
    const color = colors[i % colors.length];
    try {
      console.log(`\n  Rendering glyph ${glyph.name} (${glyph.unicode})...`);

      // Generate clean PNG image
      const pngBuffer = await renderGlyph(glyph, {
        size: 120,
        format: "png",
        backgroundColor: "white",
        color: color,
        padding: 20,
      });
      writeFileSync(join(cacheDir, `glyph_${glyph.name}.png`), pngBuffer);
      console.log(
        `    ✓ PNG generated - glyph_${glyph.name}.png (${Math.round(pngBuffer.length / 1024)}KB)`,
      );

      // Generate high-resolution PNG
      const hdPngBuffer = await renderGlyph(glyph, {
        size: 200,
        format: "png",
        backgroundColor: "white",
        color: color,
        padding: 40,
      });
      writeFileSync(join(cacheDir, `glyph_${glyph.name}_2x.png`), hdPngBuffer);
      console.log(
        `    ✓ HD PNG generated - glyph_${glyph.name}_2x.png (${Math.round(hdPngBuffer.length / 1024)}KB)`,
      );

      // Generate JPEG
      const jpegBuffer = await renderGlyph(glyph, {
        size: 150,
        format: "jpeg",
        backgroundColor: "white",
        color: "#000000",
      });
      writeFileSync(join(cacheDir, `glyph_${glyph.name}.jpg`), jpegBuffer);
      console.log(
        `    ✓ JPEG generated - glyph_${glyph.name}.jpg (${Math.round(jpegBuffer.length / 1024)}KB)`,
      );

      // Generate WebP
      const webpBuffer = await renderGlyph(glyph, {
        size: 150,
        format: "webp",
        backgroundColor: "transparent",
        color: color,
      });
      writeFileSync(join(cacheDir, `glyph_${glyph.name}.webp`), webpBuffer);
      console.log(
        `    ✓ WebP generated - glyph_${glyph.name}.webp (${Math.round(webpBuffer.length / 1024)}KB)`,
      );

      // Generate debug version for first glyph only
      if (glyph.name === "A") {
        const canvas = createCanvas(200, 200);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 200, 200);

          // Calculate glyph bounds for proper centering
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const cmd of glyph.path.commands) {
            switch (cmd.type) {
              case "move":
              case "line":
                minX = Math.min(minX, cmd.x);
                minY = Math.min(minY, cmd.y);
                maxX = Math.max(maxX, cmd.x);
                maxY = Math.max(maxY, cmd.y);
                break;
              case "quadratic":
                minX = Math.min(minX, cmd.x, cmd.cx);
                minY = Math.min(minY, cmd.y, cmd.cy);
                maxX = Math.max(maxX, cmd.x, cmd.cx);
                maxY = Math.max(maxY, cmd.y, cmd.cy);
                break;
            }
          }

          const glyphCenterX = (minX + maxX) / 2;
          const glyphCenterY = (minY + maxY) / 2;
          const canvasCenterX = 100;
          const canvasCenterY = 100;
          const scale = 100 / 1000;

          const debugRenderX = canvasCenterX - glyphCenterX * scale;
          const debugRenderY = canvasCenterY - glyphCenterY * scale;

          renderGlyph(glyph, {
            ctx,
            x: debugRenderX,
            y: debugRenderY,
            size: 100,
            color: color,
          });

          // Add debug info
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(20, 100);
          ctx.lineTo(180, 100);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#6b7280";
          ctx.font = "12px Arial";
          ctx.fillText(`Glyph: ${glyph.name}`, 20, 30);
          ctx.fillText(
            `Unicode: ${glyph.unicode} (${String.fromCharCode(Number(glyph.unicode))})`,
            20,
            45,
          );
          ctx.fillText(`Advance: ${glyph.advanceWidth}`, 20, 60);

          const debugBuffer = canvas.toBuffer("image/png");
          writeFileSync(join(cacheDir, "glyph_A_debug.png"), debugBuffer);
          console.log(
            `    ✓ Debug PNG generated - glyph_A_debug.png (${Math.round(debugBuffer.length / 1024)}KB)`,
          );
        }
      }
    } catch (error) {
      console.error(`    ✗ Image rendering failed for ${glyph.name}:`, error);
    }
  }

  console.log("\n🎯 Final Summary:");
  console.log(`   ✓ Created test glyphs: ${manager.count()} (A, B, C, space)`);
  console.log(`   ✓ SVG rendering: ${join(cacheDir, "glyph_A.svg")}`);
  console.log(`   ✓ Generated images for all glyphs:`);
  console.log(`     - glyph_A.png, glyph_B.png, glyph_C.png (standard PNG)`);
  console.log(
    `     - glyph_A_2x.png, glyph_B_2x.png, glyph_C_2x.png (high-res)`,
  );
  console.log(`     - glyph_A.jpg, glyph_B.jpg, glyph_C.jpg (JPEG)`);
  console.log(`     - glyph_A.webp, glyph_B.webp, glyph_C.webp (WebP)`);
  console.log(
    `   ✓ Debug version: ${join(cacheDir, "glyph_A_debug.png")} (with reference lines)`,
  );
  console.log(`   ✓ Font creation: ${finalFontBytes.length} bytes`);
  console.log(
    "\n🎯 unglyph test completed with realistic glyphs and complete image rendering!",
  );
}

// Run test
testUnglyphWorkflow().catch(console.error);

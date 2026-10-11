import { ImageResponse } from "@vercel/og";
import { toString } from "hast-util-to-string";
import { createOCRManager } from "unocr";

import tesseractDriver from "../../packages/unocr/src/drivers/tesseract";

/**
 * Generate test image using Vercel OG and then test OCR recognition
 */
async function testOCRWithOGImage() {
  console.log("🦜 Testing unocr with @vercel/og generated image...\n");

  // Test text to generate and recognize
  const testText = "Hello";
  console.log(`📝 Original text: "${testText}"`);

  try {
    // Generate image using Vercel OG
    console.log("\n🎨 Generating image with @vercel/og...");
    const imageResponse = new ImageResponse(
      {
        type: "div",
        props: {
          style: {
            background: "white",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial",
            fontSize: "48px",
            color: "black",
            padding: "20px",
            textAlign: "center",
          },
          children: testText,
        },
      },
      {
        width: 400,
        height: 200,
      },
    );

    // Create OCR manager using factory function
    console.log("\n🚀 Creating OCR manager...");
    const ocr = createOCRManager({
      driver: tesseractDriver({
        langs: "eng",
        logger: (m) => {
          if (m.status === "recognizing text") {
            process.stdout.write(`\r⏳ OCR Progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
        outputType: "hast",
      }),
    });

    // Perform OCR recognition on the image bytes
    console.log("\n🔍 Starting OCR recognition...");
    const startTime = Date.now();
    const imageBytes = await imageResponse.bytes();
    const result = await ocr.recognize(imageBytes);
    const processingTime = Date.now() - startTime;

    // Extract text from hast result using hast-util-to-string
    const recognizedText = toString(result).trim();
    console.log(`\n✅ OCR completed in ${processingTime}ms`);
    console.log(`📖 Recognized text: "${recognizedText}"`);

    // Compare results
    console.log("\n📊 Comparison Results:");
    console.log(`Original:   "${testText}"`);
    console.log(`Recognized: "${recognizedText}"`);
    console.log(`Match:      ${testText === recognizedText ? "✅ YES" : "❌ NO"}`);

    // Clean up
    await ocr.dispose();
    console.log("\n🧹 OCR manager disposed successfully");
  } catch (error) {
    console.error("\n❌ Test failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Test batch processing with multiple generated images
 */
async function testBatchProcessing() {
  console.log("\n" + "=".repeat(50));
  console.log("🔄 Testing batch OCR processing...\n");

  const testTexts = ["Hello", "World", "Test", "123"];

  try {
    // Generate multiple images
    console.log("🎨 Generating multiple images...");
    const images: Uint8Array[] = [];

    for (const text of testTexts) {
      const imageResponse = new ImageResponse(
        {
          type: "div",
          props: {
            style: {
              background: "white",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Arial",
              fontSize: "36px",
              color: "black",
              padding: "20px",
              textAlign: "center",
            },
            children: text,
          },
        },
        {
          width: 300,
          height: 100,
        },
      );

      images.push(await imageResponse.bytes());
    }

    console.log(`✅ Generated ${images.length} images`);

    // Create OCR manager and test batch processing
    const ocr = createOCRManager({
      driver: tesseractDriver({
        langs: "eng",
        outputType: "hast",
      }),
    });
    console.log("\n🔍 Starting batch OCR recognition...");

    const startTime = Date.now();
    const results = await ocr.recognizes(images, { parallel: 2 });
    const processingTime = Date.now() - startTime;

    console.log(`\n✅ Batch OCR completed in ${processingTime}ms`);

    // Extract and display results
    console.log("\n📊 Batch Results:");
    results.forEach((result, index) => {
      const text = toString(result).trim();
      console.log(
        `${index + 1}. "${testTexts[index]}" → "${text}" (${testTexts[index] === text ? "✅" : "❌"})`,
      );
    });

    await ocr.dispose();
  } catch (error) {
    console.error("\n❌ Batch test failed:", error instanceof Error ? error.message : error);
  }
}

// Run tests
async function runTests() {
  await testOCRWithOGImage();
  await testBatchProcessing();

  console.log("\n" + "=".repeat(50));
  console.log("🎉 All tests completed!");
}

// Run tests
runTests().catch(console.error);

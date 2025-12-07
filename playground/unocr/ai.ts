import { ImageResponse } from "@vercel/og";
import { toString } from "hast-util-to-string";
import { createOCRManager } from "unocr";
import aiDriver from "../../packages/unocr/src/drivers/ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const openai = createOpenAICompatible({
  name: "openai",
  baseURL:
    process.env.OPENAI_COMPATIBLE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

const modelName = process.env.AI_MODEL || "qwen3-vl-flash";

/**
 * Generate test image using Vercel OG and then test OCR recognition with AI driver
 */
async function testOCRWithOGImage() {
  console.log(
    "🦜 Testing unocr with AI driver and @vercel/og generated image...\n",
  );

  // Test text to generate and recognize
  const testText = "Hello AI";
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

    // Create OCR manager using AI driver
    console.log("\n🚀 Creating OCR manager with AI driver...");
    const ocr = createOCRManager({
      driver: aiDriver({
        model: openai(modelName),
        outputType: "hast",
      }),
    });

    // Perform OCR recognition on the image bytes
    console.log("\n🔍 Starting AI OCR recognition...");
    const startTime = Date.now();
    const imageBytes = await imageResponse.bytes();
    const result = await ocr.recognize(imageBytes);
    const processingTime = Date.now() - startTime;

    // Extract text from hast result using hast-util-to-string
    const recognizedText = toString(result).trim();
    console.log(`\n✅ AI OCR completed in ${processingTime}ms`);
    console.log(`📖 Recognized text: "${recognizedText}"`);

    // Compare results
    console.log("\n📊 Comparison Results:");
    console.log(`Original:   "${testText}"`);
    console.log(`Recognized: "${recognizedText}"`);
    console.log(
      `Match:      ${testText === recognizedText ? "✅ YES" : "❌ NO"}`,
    );

    // Clean up
    await ocr.dispose();
    console.log("\n🧹 AI OCR manager disposed successfully");
  } catch (error) {
    console.error(
      "\n❌ Test failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Test batch processing with multiple generated images using AI driver
 */
async function testBatchProcessing() {
  console.log("\n" + "=".repeat(50));
  console.log("🔄 Testing batch AI OCR processing...\n");

  const testTexts = ["Hello", "World", "AI", "123"];

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

    // Create OCR manager with AI driver and test batch processing
    const ocr = createOCRManager({
      driver: aiDriver({
        model: openai(modelName),
        outputType: "hast",
      }),
    });

    console.log("\n🔍 Starting batch AI OCR recognition...");
    const startTime = Date.now();
    const results = await ocr.recognizes(images, { parallel: 2 });
    const processingTime = Date.now() - startTime;

    console.log(`\n✅ Batch AI OCR completed in ${processingTime}ms`);

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
    console.error(
      "\n❌ Batch test failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Test AI driver performance with custom system prompt
 */
async function testCustomSystemPrompt() {
  console.log("\n" + "=".repeat(50));
  console.log("🧠 Testing AI driver with custom system prompt...\n");

  const testText = "Custom Test";
  const customPrompt =
    "You are an expert OCR system. Extract all visible text and return it as HTML. Preserve the exact formatting and capitalization.";

  try {
    // Generate image
    console.log("🎨 Generating test image...");
    const imageResponse = new ImageResponse(
      {
        type: "div",
        props: {
          style: {
            background: "#f0f0f0",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial",
            fontSize: "42px",
            color: "#333",
            padding: "20px",
            textAlign: "center",
            fontWeight: "bold",
          },
          children: testText,
        },
      },
      {
        width: 400,
        height: 150,
      },
    );

    // Create OCR manager with custom system prompt
    const ocr = createOCRManager({
      driver: aiDriver({
        model: openai(modelName),
        system: customPrompt,
        outputType: "hast",
      }),
    });

    console.log("\n🧠 Testing with custom system prompt...");
    const startTime = Date.now();
    const imageBytes = await imageResponse.bytes();
    const result = await ocr.recognize(imageBytes);
    const processingTime = Date.now() - startTime;

    const recognizedText = toString(result).trim();
    console.log(`\n✅ Custom prompt OCR completed in ${processingTime}ms`);
    console.log(`📖 Recognized text: "${recognizedText}"`);

    console.log("\n📊 Custom Prompt Results:");
    console.log(`Original: "${testText}"`);
    console.log(`Recognized: "${recognizedText}"`);
    console.log(`Match: ${testText === recognizedText ? "✅ YES" : "❌ NO"}`);

    await ocr.dispose();
  } catch (error) {
    console.error(
      "\n❌ Custom prompt test failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Run tests
async function runTests() {
  await testOCRWithOGImage();
  await testBatchProcessing();
  await testCustomSystemPrompt();

  console.log("\n" + "=".repeat(50));
  console.log("🎉 All AI driver tests completed!");
}

// Run tests
runTests().catch(console.error);

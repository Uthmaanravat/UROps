
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Read .env manually since we're not in Next.js context for this script
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].replace(/"/g, '').trim() : null;

if (!apiKey) {
    console.error("Could not find GEMINI_API_KEY in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        console.log("Fetching available models for API key...");
        // Note: The SDK might not expose listModels directly on the main class in all versions, 
        // but let's try via the model manager if accessible or just try a standard model to verify.
        // Actually, for the JS SDK, we typically just try to use a model. 
        // But there isn't a simple listModels helper exposed in the high-level `GoogleGenerativeAI` class in early versions.
        // We will try to confirm if 'gemini-1.5-flash' works with a simple prompt, if not try 'gemini-pro'.

        const modelsToTest = ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-pro', 'gemini-pro'];

        for (const modelName of modelsToTest) {
            try {
                console.log(`Testing model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(`✅ SUCCESS: ${modelName} is available.`);
                return; // Found a working one
            } catch (e) {
                console.log(`❌ FAILED: ${modelName} - ${e.message}`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();

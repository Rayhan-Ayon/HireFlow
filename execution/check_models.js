const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    try {
        // For google-generative-ai SDK, referencing the model through getGenerativeModel is standard,
        // but to list models we might need to use the REST API or just try the standard 'gemini-pro'.
        // Actually the SDK doesn't honestly expose a listModels method easily in all versions.
        // Let's try to just test 'gemini-1.5-pro-latest' vs 'gemini-1.5-pro-001' vs 'gemini-pro'.

        console.log("Testing model availability...");

        const modelsToTest = [
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-pro-001",
            "gemini-1.5-pro-latest",
            "gemini-pro",
            "gemini-1.5-flash"
        ];

        for (const modelName of modelsToTest) {
            console.log(`Testing ${modelName}...`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(`✅ ${modelName} is WORKING.`);
                console.log(result.response.text());
                return; // Found a working one
            } catch (e) {
                console.log(`❌ ${modelName} FAILED: ${e.message.split('\n')[0]}`);
            }
        }
    } catch (e) {
        console.error("Fatal error", e);
    }
}

listModels();

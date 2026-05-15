const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // We can't list models directly with the Node SDK v0.2.0? Yes we can if we use fetch manually or if there's a listModels method.
        // Let's just manually fetch the API endpoint to see what models exist for this key.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();

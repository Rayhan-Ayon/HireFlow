/**
 * draft_job.js
 * Usage: node execution/draft_job.js "Raw user notes here..."
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY not found in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function draftJobDescription(notes) {
    if (!notes) {
        console.error("Error: No notes provided.");
        console.log("Usage: node execution/draft_job.js \"<notes>\"");
        process.exit(1);
    }

    try {
        const prompt = `You are an expert HR recruiter. 
        Please rewrite the following rough notes into a professional Job Description (JD). 
        The JD should have a 'Job Title', 'Responsibilities', 'Requirements', and 'Benefits' section.
        Return the result in JSON format with two keys: "title" (suggested job title) and "description" (the full markdown body of the JD).
        
        Notes: "${notes}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Attempt to extract JSON using regex (finds the first { and last })
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        let cleanText = "";
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        } else {
            // Fallback: try stripping markdown if regex failed (unlikely for valid JSON)
            cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        console.log(cleanText);

    } catch (error) {
        console.error("Error generating content:", error);
        process.exit(1);
    }
}

// Get notes from command line argument
const userNotes = process.argv[2];
draftJobDescription(userNotes);

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function processResume(filePath, jobDescription, chatTranscript = "", chatbotInstructions = "") {
    let parts = [];
    let resumeText = 'No Resume Provided';

    let ext = '';
    if (filePath) {
        ext = path.extname(filePath).toLowerCase();
        const dataBuffer = fs.readFileSync(filePath);

        if (ext === '.pdf') {
            parts.push({
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: "application/pdf"
                }
            });
            parts.push({ text: `Analyze this resume against the following job description:\n\nJD: ${jobDescription}\n\nPlease also consider the following interview chat transcript for context:\n${chatTranscript}\n\n${chatbotInstructions ? `SPECIAL RECRUITER INSTRUCTIONS:\n${chatbotInstructions}` : ''}` });
        } else {
            let text = '';
            if (ext === '.docx' || ext === '.doc') {
                const res = await mammoth.extractRawText({ buffer: dataBuffer });
                text = res.value;
            } else {
                text = dataBuffer.toString();
            }
            resumeText = text;
            parts.push({ text: `Job Description:\n${jobDescription}\n\nResume Text:\n${text}\n\nInterview Chat Transcript:\n${chatTranscript}\n\n${chatbotInstructions ? `SPECIAL RECRUITER INSTRUCTIONS:\n${chatbotInstructions}` : ''}` });
        }
    } else {
        parts.push({ text: `Job Description:\n${jobDescription}\n\nInterview Chat Transcript:\n${chatTranscript}\n\n${chatbotInstructions ? `SPECIAL RECRUITER INSTRUCTIONS:\n${chatbotInstructions}` : ''}\n\n(No resume was provided, please analyze based on the chat alone.)` });
    }

    const prompt = `
    You are a "Super Intelligent" Senior Technical Recruiter. 
    Analyze the provided resume AND the in-depth interview chat transcript against the job description.
    
    Your goal is to provide a "Brutally Honest" and "Highly Insightful" evaluation.
    
    EVALUATION CRITERIA:
    1. **Evidence vs. Claims**: Compare what's on the resume to how they performed in the chat. Did they provide concrete examples in the chat that back up their resume claims?
    2. **Technical Depth**: Judge their actual knowledge based on the follow-up questions asked by the bot.
    3. **Soft Skills & Communication**: Evaluate their clarity, proactive nature, and professionalism from the transcript.
    4. **Gap Analysis**: Explicitly look for missing skills or red flags (e.g., job hopping, vague answers).
    5. **Special Instructions**: If the recruiter provided special instructions (e.g., skip salary, focus on projects), ensure the match_score and summary reflect adherence to those specific criteria.
    6. **Contact Extraction**: precise extraction of their phone number/contact info if present.
    
    Provide a JSON response with:
    - match_score: (Integer 0-100. Be strict. 90+ is for unicorns only.)
    - summary: (A 4-5 sentence HIGH-VALUE evaluation. Start with their strongest trait, then move to specific evidence from the chat, and end with a 'Recommendation' (Hire/Technical Interview/Decline).)
    - key_skills: (Array of strings - only verified skills)
    - missing_skills: (Array of strings - what they clearly lacked in the interview)
    - extracted_phone: (String - The phone number formatted if found, else null)
    - extracted_linkedin: (String - The LinkedIn URL if found in chat or resume, else null)
    
    Return ONLY JSON.
    `;

    try {
        parts.push({ text: prompt });
        const result = await model.generateContent(parts);
        const response = await result.response;
        let resultText = response.text();

        // Clean up JSON
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(resultText);

        return {
            resume_text: ext === '.pdf' ? 'PDF Binary Processed' : parts[0].text,
            ...analysis
        };
    } catch (error) {
        console.error("Gemini Processing Error:", error);
        return {
            resume_text: "Extraction Failed",
            match_score: 0,
            summary: "AI processing failed. Please review manually.",
            key_skills: [],
            missing_skills: []
        };
    }
}

module.exports = { processResume };

// If run directly for testing
if (require.main === module) {
    const testFilePath = process.argv[2];
    const testJD = "Looking for a Senior Node.js Developer with 5 years experience, React, and SQL.";
    if (testFilePath) {
        processResume(testFilePath, testJD).then(res => console.log(JSON.stringify(res, null, 2)));
    }
}

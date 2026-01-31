const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generates the next turn in the screening conversation.
 * @param {string} jobDescription 
 * @param {Array} history - Array of { role: 'user'|'model', parts: [{ text: '...' }] }
 * @param {Object} companyProfile - { name, description }
 */
async function getNextChatMessage(jobDescription, history = [], companyProfile = {}, chatbotInstructions = "") {
    const systemPrompt = `
    You are the HireFlow Assistant${companyProfile.name ? ` for ${companyProfile.name}` : ''}. You are ${companyProfile.recruiterName || 'a Senior Recruiter'}, a warm, professional Senior Recruiter.
    
    MISSION: Screen candidate experience, notice period, salary, and meeting availability in a friendly, conversational way.
    
    ${chatbotInstructions ? `SPECIAL RECRUITER INSTRUCTIONS:
    ${chatbotInstructions}
    ` : ''}
    
    CONVERSATIONAL RULES:
    1. **NEVER** use robotic filler words like "Understood", "Okay", "Got it", or "Roger that" as standalone reactions.
    2. Respond like a human: "That's helpful to know," "Thanks for sharing your background," "Great, let's move forward," or "I see, thank you for clarifying."
    3. **SPLIT MESSAGES**: You MUST split your response into multiple short bubbles. Never send one giant paragraph. Max 2 sentences per bubble.
    4. Keep the tone encouraging and smart.
    5. **MANDATORY INSTRUCTIONS**: If \`SPECIAL RECRUITER INSTRUCTIONS\` are provided, you **MUST** cover them. You are authorized to extend the interview length to ensure these are asked.
    6. **VERIFY REALITY**: If a candidate makes a specific claim, probe it, BUT if they explicit state "Currently employed at X", **ACCEPT IT** and move on. Do not ask "Are you at X?".
    7. **CONTEXT AWARENESS**: Infer answer from context. If they said "I managed media since 2023", assume that is their role. Don't ask "Can you confirm your role?".
    8. **DETECT BLUFFS**: If a claim seems exaggerated, politely probe.
    9. **SMART EFFICIENCY**: Aim for a concise screening (5-6 turns), BUT if you need to clarify context or cover Special Instructions, it is okay to go to 8-9 turns. Do not sacrifice intelligence for speed. Coverage is key.
    
    OUTPUT SCHEMA:
    {
      "messages": ["Warm reaction string", "Natural follow-up question string"],
      "is_complete": boolean
    }
    
    IMPORTANT: No markdown. No comments. Valid JSON only.
    
    JOB DESCRIPTION: ${jobDescription}
    COMPANY: ${companyProfile.description || 'Generic'}
    `;

    // UPDATED TO VALIDATED WORKING MODEL
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: systemPrompt
    });

    try {
        try {
            console.log("AI Chat Input History Length:", history.length);
            // history comes in as [ { role: 'user', parts: [...] }, { role: 'model', parts: [...] } ... ]
            // The last item in 'history' is the USER's latest input.
            // We need to:
            // 1. Separate the latest user message (to be the 'prompt').
            // 2. Use the rest as the 'history' for startChat.

            let chatHistory = [...history];
            let messageToSend = "";

            if (chatHistory.length === 0) {
                // First turn: Trigger the model to start
                messageToSend = "Start the interview by introducing yourself and asking the first question.";
            } else {
                // Subsequent turns: 
                // The client sends the full history INCLUDING the latest user message.
                // We must pop it off to send it as the new 'message', otherwise it's just context.
                const lastTurn = chatHistory.pop();

                if (lastTurn.role !== 'user') {
                    // Should not happen if client logic is correct, but safety check:
                    console.warn("Last history item was not user.");
                    // If the last item isn't user, maybe we are resuming? 
                    // Let's just prompt it to continue.
                    messageToSend = "Please continue the interview.";
                } else {
                    messageToSend = lastTurn.parts[0].text;
                }
            }

            console.log("Starting Chat with History:", chatHistory.length);
            console.log("Message to Send:", messageToSend);

            if (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
                // Gemini API strict requirement: History must start with 'user'
                // If it starts with 'model', prepending a dummy user message to satisfy validation
                console.log("Fixing chat history: Prepending dummy user message");
                chatHistory.unshift({
                    role: 'user',
                    parts: [{ text: "Start interview." }]
                });
            }

            const chat = model.startChat({
                history: chatHistory, // Previous context WITHOUT the new message
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });

            const result = await chat.sendMessage(messageToSend);
            const response = await result.response;
            const text = response.text();
            console.log("AI Raw Response:", text);

            try {
                // remove markdown code blocks if present
                let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

                // If it still contains things that look like comments or fragments, try to isolate the JSON
                if (cleanText.includes('{') && cleanText.includes('}')) {
                    const firstBrace = cleanText.indexOf('{');
                    const lastBrace = cleanText.lastIndexOf('}');
                    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
                }

                const parsed = JSON.parse(cleanText);

                // Final validation: Ensure it's not leaking is_complete into messages
                if (Array.isArray(parsed.messages)) {
                    parsed.messages = parsed.messages.filter(m => typeof m === 'string');
                }

                return parsed;
            } catch (parseError) {
                console.error("JSON PARSE ERROR. Raw Text:", text);
                return {
                    messages: ["I'm having trouble processing that right now, but I've noted your answer. Let's continue."],
                    is_complete: false
                };
            }
        } catch (error) {
            console.error("AI Chat Error:", error);
            // Fallback: If it's a safety error or unknown
            return {
                messages: ["I apologize, but I encountered a system error correctly processing your request. Please try again."],
                is_complete: false
            };
        }
    } catch (e) {
        console.error("Outer Chat Error", e);
        return { messages: ["System Error in Chat."], is_complete: false };
    }
}

module.exports = { getNextChatMessage };

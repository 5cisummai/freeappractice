const OpenAI = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const questionStorageService = require('./questionStorageService');
const logger = require('../utils/logger');

// Environment configuration
const OPENAI_BASE_URL = process.env.OPENAI_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY || '';

// Load unit descriptions from the revised JSON (legacy data is no longer supported)
let revisedUnitDescriptions = null;

// Try to load revised descriptions first (preferred)
try {
    const revisedPath = path.join(__dirname, '..', 'data', 'unit-descriptionsrevised.json');
    const revisedData = fs.readFileSync(revisedPath, 'utf8');
    revisedUnitDescriptions = JSON.parse(revisedData);
    if (process.env.NODE_ENV !== 'production') {
        console.log('✓ Loaded revised unit descriptions');
    }
} catch (err) {
    console.warn('⚠ Failed to load revised unit descriptions', err.message);
}


function getUnitContextData(className, unitIdentifier) {
    if (!className || !unitIdentifier) return null;
    const norm = s => (s || '').toString().toLowerCase().trim();
    const cName = norm(className);
    const uRaw = unitIdentifier.toString().trim();
    const uNorm = norm(uRaw);

    if (revisedUnitDescriptions && Array.isArray(revisedUnitDescriptions.courses)) {
        for (const course of revisedUnitDescriptions.courses) {
            const courseNames = [course.course_code, course.course_name].filter(Boolean).map(norm);
            const importantNotes = course.important_notes || course.importantNotes || '';
            if (courseNames.some(n => n === cName || cName.includes(n) || n.includes(cName))) {
                if (Array.isArray(course.units)) {
                    const unitNumMatch = uRaw.match(/\d+/);
                    let found = null;
                    if (unitNumMatch) {
                        const num = parseInt(unitNumMatch[0], 10);
                        found = course.units.find(u => Number(u.unit_number) === num || norm(u.unit_title).includes(`unit ${num}`));
                    }
                    if (!found) {
                        found = course.units.find(u => norm(u.unit_title).includes(uNorm) || uNorm.includes(norm(u.unit_title)));
                    }
                    if (found) {
                        const topics = found.topics_may_include || found.topics || [];
                        const keywords = found.keywords || [];
                        return { description: found.description || '', topics, keywords, importantNotes };
                    }
                }
                if (importantNotes) {
                    return { description: '', topics: [], keywords: [], importantNotes };
                }
            }
        }
    }

    // No legacy descriptions support – if nothing found in revised data, return null

    return null;
}

function selectModelForClass(className) {
    const normalizedClass = (className || '').toLowerCase();
    const historyKeywords = ['history', 'government', 'economics', 'psychology', 'sociology', 'human geography', 'world studies'];
    const englishKeywords = ['english', 'literature'];
    const matchesKeyword = (keywords) => keywords.some(keyword => normalizedClass.includes(keyword.toLowerCase()));
    if (
        matchesKeyword(historyKeywords) ||
        matchesKeyword(englishKeywords) ||
        normalizedClass.includes('economics') ||
        normalizedClass.includes('computer science principles')
    ) {
        return 'gpt-4.1-mini';
    }
    return 'gpt-5-mini';
}


function buildClient() {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    return new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY });
}

const APQuestion = z.object({
    question: z.string().describe('The AP-level practice question with proper LaTeX formatting for ALL math/science notation (e.g., "$f(x) = \\sqrt{3x+1}$")'),
    optionA: z.string().describe('First answer choice as a single line; if it is a math expression, return ONLY the LaTeX expression wrapped in $...$ (e.g., "$\\dfrac{3}{2\\sqrt{7}}$") with no label like "A." For code, use triple backticks notation and newlines as needed.'),
    optionB: z.string().describe('Second answer choice as a single line; same LaTeX rules and code format rules as optionA'),
    optionC: z.string().describe('Third answer choice as a single line; same LaTeX rules and code format rules as optionA'),
    optionD: z.string().describe('Fourth answer choice as a single line; same LaTeX rules and code format rules as optionA'),
    correctAnswer: z.enum(['A', 'B', 'C', 'D']).describe('The letter of the correct answer'),
    explanation: z.string().describe('Detailed explanation of why the correct answer is right and why distractors are wrong, using proper LaTeX for any math. Use a newline before each option letter (A, B, C, D) when discussing them.')
});

async function generateAPQuestion({ className, unit }) {
    const provider = 'openai';
    if (!className) throw new Error('className is required');

    // Build the user prompt from className and unit
    let question = `Create an AP-level practice question for ${className}`;
    if (unit) {
        question += ` covering ${unit}`;
    }
    question += `.\n\nReturn a valid JSON object with these exact fields:\n- question: the question text\n- optionA, optionB, optionC, optionD: the four answer choices\n- correctAnswer: one of "A", "B", "C", or "D"\n- explanation: detailed explanation of the correct answer and why other options are wrong\n\nReturn ONLY the JSON object, no other text.`;

    // Build unit context for system prompt
    let unitContext = '';
    let keywordsContext = '';
    let courseNotesContext = '';
    if (className && unit) {
        const ctxData = getUnitContextData(className, unit);
        if (ctxData) {
            unitContext = `\nUNIT CONTEXT: ${unit}\n${ctxData.description}\nKey Topics: ${Array.isArray(ctxData.topics) ? ctxData.topics.join(', ') : ''}\n`;
            
            // Add keywords if available
            if (ctxData.keywords && Array.isArray(ctxData.keywords) && ctxData.keywords.length > 0) {
                keywordsContext = `\nREQUIRED KEYWORDS/CONSTRAINTS: ${ctxData.keywords.join('; ')}\n*** Your question MUST focus ONLY on these specific keywords and topics. Pay special attention to any constraints mentioned (e.g., "concepts only, not equations"). Do NOT include topics from other units. ***\n`;
            }
            if (ctxData.importantNotes) {
                courseNotesContext = `\nCOURSE-GUIDANCE: ${ctxData.importantNotes}\n`;
            }
        }
    }

    // Adjust difficulty guidance based on course
    const isBiology = className?.toLowerCase().includes('biology');
    const difficultyGuidance = isBiology 
        ? `\nDIFFICULTY CALIBRATION FOR AP BIOLOGY:
- Focus on conceptual understanding and application, not memorization of obscure details
- Questions should test core biological principles and connections between concepts
- Avoid overly specific terminology or advanced research-level content
- Match the difficulty of questions in the official AP Biology Course and Exam Description
- Emphasize scientific practices (data analysis, experimental design, reasoning) over pure recall
- Use straightforward language - AP Bio questions test biology, not reading comprehension`
        : '';

    const systemPrompt = `You are an expert AP exam question writer with deep knowledge of College Board standards. Create high-quality, authentic practice questions that closely mirror real AP exam questions.${unitContext}${keywordsContext}${courseNotesContext}${difficultyGuidance}

CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the unit's specified keywords and topics listed above
- DO NOT incorporate concepts from other units, even if they seem related
- If keywords specify constraints (e.g., "pH concepts, not equations or equilibria"), you MUST follow them exactly
- Only test material that appears in the keywords or topics for this specific unit

QUESTION QUALITY:
- Match actual AP exam difficulty and style, but do not overestimate diffuculty
- Avoid trivial or overly complex questions; aim for balanced challenge
- Ensure clarity and precision in wording; avoid ambiguity
- often vary question types (e.g., data analysis, experimental design, conceptual application) while adhering to AP standards
- often vary content focus within the unit, but never step outside the unit's defined scope

- Test understanding, not just memorization
- Include real-world scenarios or experimental contexts
- Use exact terminology and clear language
- Plausible distractors reflecting common misconceptions
- Options should be roughly equal in length
- Avoid "all of the above" or "none of the above"

FORMATTING:
- Use proper markdown formatting for any math/science notation and code
- Use tables or lists if needed for clarity, this is very important for complex questions.

EXPLANATION:
- Explain why the correct answer is right
- Address why distractors are incorrect
- Use a newline before each option letter (A, B, C, D) when discussing them
- Keep concise (1-2 sentences per option)

OUTPUT:
- Return ONLY the JSON object matching the schema; no text before or after the JSON`;

    const client = buildClient();
    const model = selectModelForClass(className);

    const completionParams = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
        ],
        response_format: zodResponseFormat(APQuestion, 'ap_question')
    };
    if (model === 'gpt-5-mini') completionParams.reasoning_effort = 'low';

    try {
        const completion = await client.chat.completions.parse(completionParams);
        const message = completion?.choices?.[0]?.message;
        if (!message) throw new Error('No message returned from provider');
        if (message.refusal) throw new Error('Content refused by provider');
        const parsedQuestion = message.parsed;
        if (!parsedQuestion) throw new Error('No parsed output from structured response');

        try {
            const questionId = await questionStorageService.saveQuestionToS3({
                ...parsedQuestion,
                apClass: className,
                unit: unit || 'General'
            });
            logger.info('Question auto-saved to S3', { questionId, provider, model });
            return { answer: parsedQuestion, provider, model, questionId };
        } catch (s3Error) {
            logger.warn('Failed to auto-save question to S3', { error: s3Error.message });
            return { answer: parsedQuestion, provider, model };
        }
    } catch (error) {
        throw error;
    }
}

module.exports = { generateAPQuestion, getUnitContextData, selectModelForClass };

const OpenAI = require('openai');

class TutorService {
    constructor() {
        this.openai = null;
        this.model = 'gpt-4o-mini'; // Using gpt-4o-mini as a fast, efficient model
    }

    /**
     * Lazy initialization of OpenAI client
     */
    getClient() {
        if (!this.openai) {
            this.openai = new OpenAI({
                apiKey: process.env.OPEN_AI_KEY
            });
        }
        return this.openai;
    }

    /**
     * Chat with the AI tutor about a specific question
     * @param {string} question - The practice question text
     * @param {string} correctAnswer - The correct answer
     * @param {string} explanation - The explanation for the answer
     * @param {string} apClass - The AP class name
     * @param {string} unit - The unit name
     * @param {Object} answerChoices - Object with optionA, optionB, optionC, optionD
     * @param {Array} conversationHistory - Previous messages in the conversation
     * @param {string} userMessage - The user's current message
     * @returns {Promise<string>} The tutor's response
     */
    async chat(question, correctAnswer, explanation, apClass, unit, answerChoices, conversationHistory, userMessage) {
        try {
            const choicesText = answerChoices ? `
Answer Choices:
A. ${answerChoices.A}
B. ${answerChoices.B}
C. ${answerChoices.C}
D. ${answerChoices.D}` : '';
            
            const systemPrompt = `You are a helpful AP exam tutor. You're helping a student understand a specific practice question.

Course: ${apClass || 'AP Course'}
Unit: ${unit || 'N/A'}

Question: ${question}${choicesText}

Correct Answer: ${correctAnswer}
Explanation: ${explanation}

Your role:
- Help the student understand the concept behind this question
- Answer their questions clearly and concisely
- Provide additional examples if needed
- Be encouraging and supportive
- Keep responses focused on this specific question and related concepts
- Reference the specific AP course and unit when relevant
- Use simple, student-friendly language

Keep your responses brief (2-3 paragraphs max) unless the student asks for more detail.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const stream = await this.getClient().chat.completions.create({
                model: this.model,
                messages: messages,
                max_completion_tokens: 500,
                stream: true
            });

            return stream;
        } catch (error) {
            console.error('Tutor service error:', error);
            throw new Error('Failed to get tutor response');
        }
    }

    /**
     * Get an initial greeting from the tutor
     * @param {string} question - The practice question text
     * @returns {Promise<string>} The tutor's greeting
     */
    async getGreeting(question) {
        try {
            const response = await this.getClient().chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a friendly AP exam tutor. Greet the student and let them know you can help them understand the current question. Keep it very brief (1-2 sentences). Do not at any point give the answer to the question, but guide the student to think critically and understand the concepts.'
                    },
                    {
                        role: 'user',
                        content: `The student is working on this question: ${question}`
                    }
                ],
                max_completion_tokens: 100
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Tutor greeting error:', error);
            return "Hi! I'm here to help you understand this question. What would you like to know?";
        }
    }
}

module.exports = new TutorService();

/**
 * AI Tutor Component
 * Provides context-aware tutoring for practice questions
 */

class AITutor {
    constructor() {
        this.currentQuestion = null;
        this.currentAnswer = null;
        this.currentExplanation = null;
        this.conversationHistory = [];
        this.isOpen = false;
        this.isLoading = false;
        
        this.elements = {
            container: null,
            toggle: null,
            modal: null,
            close: null,
            messages: null,
            input: null,
            send: null
        };
    }

    /**
     * Initialize the AI Tutor component
     */
    async init() {
        // Load the component HTML
        await this.loadComponent();
        
        // Get DOM elements
        this.elements = {
            container: document.getElementById('aiTutorContainer'),
            toggle: document.getElementById('aiTutorToggle'),
            modal: document.getElementById('aiTutorModal'),
            close: document.getElementById('aiTutorClose'),
            messages: document.getElementById('aiTutorMessages'),
            input: document.getElementById('aiTutorInput'),
            send: document.getElementById('aiTutorSend')
        };

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Load the AI Tutor component HTML
     */
    async loadComponent() {
        try {
            const response = await fetch('/components/ai-tutor.html');
            if (!response.ok) throw new Error('Failed to load AI tutor component');
            
            const html = await response.text();
            
            // Insert component at end of body (preserve all nodes)
            const temp = document.createElement('div');
            temp.innerHTML = html;
            while (temp.firstChild) {
                document.body.appendChild(temp.firstChild);
            }
        } catch (error) {
            console.error('Error loading AI tutor component:', error);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Guard against missing elements
        const { toggle, close, send, input } = this.elements;
        if (!toggle || !close || !send || !input) {
            console.warn('AI Tutor elements missing; skipping event binding');
            return;
        }

        // Toggle button
        toggle.addEventListener('click', () => this.toggle());
        
        // Close button
        close.addEventListener('click', () => this.close());
        
        // Send button
        send.addEventListener('click', () => this.sendMessage());
        
        // Input enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Input changes
        input.addEventListener('input', () => {
            send.disabled = !input.value.trim();
            this.autoResize();
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Auto-resize the textarea
     */
    autoResize() {
        const input = this.elements.input;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    }

    /**
     * Set the current question context
     */
    setQuestionContext(question, answer, explanation, apClass, unit, answerChoices) {
        if (!this.elements.container || !this.elements.toggle || !this.elements.messages || !this.elements.input || !this.elements.send) {
            console.warn('AI Tutor not initialized; missing DOM elements');
            return;
        }
        this.currentQuestion = question;
        this.currentAnswer = answer;
        this.currentExplanation = explanation;
        this.currentApClass = apClass;
        this.currentUnit = unit;
        this.currentAnswerChoices = answerChoices;
        this.conversationHistory = [];
        
        // Reset the chat
        this.resetChat();
        
        // Enable the toggle button
        this.elements.toggle.disabled = false;
        this.elements.container.style.display = 'block';
        
        // Get initial greeting
        this.getInitialGreeting();
    }

    /**
     * Reset the chat for a new question
     */
    resetChat() {
        if (this.elements.messages) {
            this.elements.messages.innerHTML = '';
        }
        this.conversationHistory = [];
        this.isLoading = false;
        if (this.elements.input) {
            this.elements.input.value = '';
        }
        if (this.elements.send) {
            this.elements.send.disabled = true;
        }
    }

    /**
     * Get initial greeting from the tutor
     */
    async getInitialGreeting() {
        try {
            const response = await fetch('/api/tutor/greeting', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: this.currentQuestion
                })
            });

            if (!response.ok) throw new Error('Failed to get greeting');
            
            const data = await response.json();
            this.addTutorMessage(data.message);
        } catch (error) {
            console.error('Error getting greeting:', error);
            this.addTutorMessage("Hi! I'm here to help you understand this question. What would you like to know?");
        }
    }

    /**
     * Toggle the tutor modal
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open the tutor modal
     */
    open() {
        this.elements.modal.classList.add('show');
        this.isOpen = true;
        this.elements.input.focus();
        
        // Scroll to bottom
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    /**
     * Close the tutor modal
     */
    close() {
        this.elements.modal.classList.remove('show');
        this.isOpen = false;
    }

    /**
     * Send a message to the tutor
     */
    async sendMessage() {
        const message = this.elements.input.value.trim();
        if (!message || this.isLoading) return;

        // Add user message to UI
        this.addUserMessage(message);
        
        // Clear input
        this.elements.input.value = '';
        this.elements.send.disabled = true;
        this.autoResize();

        // Show loading indicator
        this.showLoading();

        try {
            // Send to API with streaming
            const response = await fetch('/api/tutor/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: this.currentQuestion,
                    answer: this.currentAnswer,
                    explanation: this.currentExplanation,
                    apClass: this.currentApClass,
                    unit: this.currentUnit,
                    answerChoices: this.currentAnswerChoices,
                    conversationHistory: this.conversationHistory,
                    message: message
                })
            });

            if (!response.ok) throw new Error('Failed to get tutor response');
            
            // Remove loading indicator
            this.hideLoading();
            
            // Create message element for streaming
            const messageEl = this.createTutorMessageElement('');
            const contentEl = messageEl.querySelector('.ai-tutor-message-content');
            let fullResponse = '';
            
            // Read the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                contentEl.textContent = fullResponse;
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
            
            // Format the final message with proper HTML
            contentEl.innerHTML = this.formatMessage(fullResponse);
            
            // Update conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            );
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideLoading();
            this.addTutorMessage("I'm sorry, I encountered an error. Please try again.");
        }
    }

    /**
     * Add a user message to the chat
     */
    addUserMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'user-message';
        messageEl.innerHTML = `
            <div class="user-message-avatar">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.6667 17.5V15.8333C16.6667 14.9493 16.3155 14.1014 15.6904 13.4763C15.0652 12.8512 14.2174 12.5 13.3333 12.5H6.66667C5.78261 12.5 4.93477 12.8512 4.30964 13.4763C3.68452 14.1014 3.33333 14.9493 3.33333 15.8333V17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 9.16667C11.8409 9.16667 13.3333 7.67428 13.3333 5.83333C13.3333 3.99238 11.8409 2.5 10 2.5C8.15905 2.5 6.66667 3.99238 6.66667 5.83333C6.66667 7.67428 8.15905 9.16667 10 9.16667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="user-message-content">
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        
        this.elements.messages.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * Add a tutor message to the chat
     */
    addTutorMessage(message) {
        const messageEl = this.createTutorMessageElement(message);
        this.scrollToBottom();
    }

    /**
     * Create a tutor message element (for streaming or regular messages)
     */
    createTutorMessageElement(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'tutor-message';
        messageEl.innerHTML = `
            <div class="tutor-message-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="ai-tutor-message-content tutor-message-content">
                ${message ? this.formatMessage(message) : ''}
            </div>
        `;
        
        this.elements.messages.appendChild(messageEl);
        return messageEl;
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        this.isLoading = true;
        const loadingEl = document.createElement('div');
        loadingEl.className = 'tutor-message';
        loadingEl.id = 'tutorLoading';
        loadingEl.innerHTML = `
            <div class="tutor-message-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="tutor-message-content">
                <div class="tutor-message-loading">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        
        this.elements.messages.appendChild(loadingEl);
        this.scrollToBottom();
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.isLoading = false;
        const loadingEl = document.getElementById('tutorLoading');
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    /**
     * Scroll to bottom of messages
     */
    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    /**
     * Format message with paragraphs and render LaTeX
     */
    formatMessage(message) {
        // Check if KaTeXRenderer is available
        if (typeof KaTeXRenderer !== 'undefined' && KaTeXRenderer.render) {
            // Use KaTeX renderer for math expressions
            return KaTeXRenderer.render(message);
        }
        
        // Fallback to simple formatting
        return message
            .split('\n\n')
            .map(p => `<p>${this.escapeHtml(p)}</p>`)
            .join('');
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Hide the tutor component
     */
    hide() {
        this.elements.container.style.display = 'none';
        this.close();
    }
}

// Initialize and export
const aiTutor = new AITutor();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => aiTutor.init());
} else {
    aiTutor.init();
}

// Export for use in other scripts
window.aiTutor = aiTutor;

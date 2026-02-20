/**
 * Question Modal Component
 * Displays a question in a modal when clicked from a list
 * Usage: new QuestionModal()
 */

class QuestionModal {
    constructor() {
        this.isLoaded = false;
        this.currentQuestion = null;
        this.elements = {};
    }

    /**
     * Initialize the Question Modal component
     */
    async init() {
        try {
            // Load the component HTML
            await this.loadComponent();

            // Get DOM elements
            this.cacheElements();

            // Set up event listeners
            this.setupEventListeners();

            this.isLoaded = true;
        } catch (error) {
            console.error('Error initializing Question Modal:', error);
        }
    }

    /**
     * Load the Question Modal component HTML
     */
    async loadComponent() {
        try {
            const response = await fetch('/components/question-modal.html');
            if (!response.ok) {
                throw new Error(`Failed to load question modal component: ${response.status}`);
            }

            const html = await response.text();

            // Insert at the end of body
            document.body.insertAdjacentHTML('beforeend', html);
        } catch (error) {
            console.error('Error loading question modal component:', error);
            throw error;
        }
    }

    /**
     * Cache DOM elements for quick access
     */
    cacheElements() {
        this.elements = {
            overlay: document.getElementById('questionModalOverlay'),
            close: document.getElementById('questionModalClose'),
            close2: document.getElementById('questionModalClose2'),
            course: document.getElementById('questionModalCourse'),
            unit: document.getElementById('questionModalUnit'),
            question: document.getElementById('questionModalQuestion'),
            options: document.getElementById('questionModalOptions'),
            answerSection: document.getElementById('questionModalAnswerSection'),
            answer: document.getElementById('questionModalAnswer'),
            explanation: document.getElementById('questionModalExplanation'),
            showAnswerBtn: document.getElementById('questionModalShowAnswer')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Close button
        this.elements.close?.addEventListener('click', () => this.close());
        this.elements.close2?.addEventListener('click', () => this.close());

        // Close on overlay click
        this.elements.overlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.overlay?.classList.contains('show')) {
                this.close();
            }
        });

        // Show answer button
        this.elements.showAnswerBtn?.addEventListener('click', () => {
            this.toggleAnswer();
        });
    }

    /**
     * Escape HTML to prevent XSS when KaTeX renderer isn't available
     * @param {string} str
     */
    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Display a question in the modal
     * @param {Object} question - Question object with properties: question, options, answer, explanation, course, unit
     */
    display(question) {
        if (!this.isLoaded) {
            console.warn('Question Modal not yet initialized');
            return;
        }

        this.currentQuestion = question;

        // Set metadata
        if (question.course) {
            this.elements.course.textContent = question.course;
        }
        if (question.unit) {
            this.elements.unit.textContent = `• ${question.unit}`;
        }

        // Set question text
        // Render question using KaTeX renderer if available
        if (this.elements.question) {
            try {
                const qText = question.question || question.questionText || 'Question';
                // Prefer global KaTeXRenderer if available
                if (window && window.KaTeXRenderer && typeof window.KaTeXRenderer.render === 'function') {
                    this.elements.question.innerHTML = window.KaTeXRenderer.render(qText);
                } else if (typeof window !== 'undefined' && typeof window.renderKaTeX === 'function') {
                    // set raw text and let renderKaTeX handle it
                    this.elements.question.setAttribute('data-raw', qText);
                    window.renderKaTeX(this.elements.question);
                } else {
                    this.elements.question.textContent = qText;
                }
            } catch (err) {
                this.elements.question.textContent = question.question || question.questionText || 'Question';
            }
        }

        // Render options
        this.renderOptions(question.options || []);

        // Set answer and explanation
        if (question.answer) {
            // Render answer with KaTeX
            if (this.elements.answer) {
                const aText = question.answer || '';
                if (window && window.KaTeXRenderer && typeof window.KaTeXRenderer.render === 'function') {
                    this.elements.answer.innerHTML = window.KaTeXRenderer.render(aText);
                } else if (typeof window !== 'undefined' && typeof window.renderKaTeX === 'function') {
                    this.elements.answer.setAttribute('data-raw', aText);
                    window.renderKaTeX(this.elements.answer);
                } else {
                    this.elements.answer.textContent = aText;
                }
            }
        }

        if (question.explanation) {
            if (this.elements.explanation) {
                const eText = question.explanation || '';
                if (window && window.KaTeXRenderer && typeof window.KaTeXRenderer.render === 'function') {
                    this.elements.explanation.innerHTML = window.KaTeXRenderer.render(eText);
                } else if (typeof window !== 'undefined' && typeof window.renderKaTeX === 'function') {
                    this.elements.explanation.setAttribute('data-raw', eText);
                    window.renderKaTeX(this.elements.explanation);
                } else {
                    this.elements.explanation.innerHTML = eText;
                }
            }
        }

        // Hide answer section initially
        this.elements.answerSection.style.display = 'none';
        this.elements.showAnswerBtn.textContent = 'Show Answer';

        // Show modal
        this.elements.overlay?.classList.add('show');
    }

    /**
     * Render multiple choice options
     * @param {Array} options - Array of option strings or objects
     */
    renderOptions(options) {
        this.elements.options.innerHTML = '';

        if (!Array.isArray(options) || options.length === 0) {
            this.elements.options.innerHTML = '<p class="question-modal-no-options">No options available</p>';
            return;
        }

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'question-modal-options-list';

        const letters = ['A', 'B', 'C', 'D', 'E'];

        options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'question-modal-option';

            const letter = letters[index] || String(index + 1);
            const text = typeof option === 'object' ? option.text || option.label || option.content : option;

            // Render option text with KaTeX if available
            const renderedText = (typeof KaTeXRenderer !== 'undefined' && KaTeXRenderer && KaTeXRenderer.render)
                ? KaTeXRenderer.render(String(text || ''))
                : this.escapeHTML(String(text || ''));

            optionDiv.innerHTML = `
                <span class="question-modal-option-letter">${letter}</span>
                <span class="question-modal-option-text">${renderedText}</span>
            `;

            optionsContainer.appendChild(optionDiv);
        });

        this.elements.options.appendChild(optionsContainer);
    }

    /**
     * Toggle visibility of answer section
     */
    toggleAnswer() {
        const isHidden = this.elements.answerSection.style.display === 'none';

        if (isHidden) {
            this.elements.answerSection.style.display = 'block';
            this.elements.showAnswerBtn.textContent = 'Hide Answer';
            // Scroll to answer
            setTimeout(() => {
                this.elements.answerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            this.elements.answerSection.style.display = 'none';
            this.elements.showAnswerBtn.textContent = 'Show Answer';
        }
    }

    /**
     * Close the modal
     */
    close() {
        this.elements.overlay?.classList.remove('show');
        this.currentQuestion = null;
        this.elements.options.innerHTML = '';
    }

    /**
     * Check if modal is currently open
     */
    isOpen() {
        return this.elements.overlay?.classList.contains('show') || false;
    }
}

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.questionModal) {
        window.questionModal = new QuestionModal();
        window.questionModal.init().catch(err => {
            console.error('Failed to initialize QuestionModal:', err);
        });
    }
});

// Export for manual use
window.QuestionModal = QuestionModal;

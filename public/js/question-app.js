/**
 * Question Application - Main app for generating and displaying questions
 * Dependencies: utils.js, katex-renderer.js, storage-manager.js, theme-manager.js, authorization.js
 */

// ============================================================================
// PROGRESS TRACKER
// ============================================================================

class ProgressTracker {
    constructor(classSelect, unitSelect, fromSlider, toSlider, currentUnits) {
        this.classSelect = classSelect;
        this.unitSelect = unitSelect;
        this.fromSlider = fromSlider;
        this.toSlider = toSlider;
        this.currentUnits = currentUnits;
    }

    getUnitKey() {
        const val = this.unitSelect?.value;
        if (val === '__custom__') {
            const fromIndex = parseInt(this.fromSlider?.value || 0);
            const toIndex = parseInt(this.toSlider?.value || 0);
            const from = Math.min(fromIndex, toIndex);
            const to = Math.max(fromIndex, toIndex);
            return `__custom__|${from}|${to}`;
        }
        return val || '';
    }

    getUnitDisplay() {
        const val = this.unitSelect?.value;
        if (!val) return 'All Units';
        if (val === '__custom__') {
            const fromIndex = parseInt(this.fromSlider?.value || 0);
            const toIndex = parseInt(this.toSlider?.value || 0);
            const from = Math.min(fromIndex, toIndex);
            const to = Math.max(fromIndex, toIndex);
            const fromUnit = this.currentUnits[from] || `Unit ${from + 1}`;
            const toUnit = this.currentUnits[to] || `Unit ${to + 1}`;
            return `${fromUnit} through ${toUnit}`;
        }
        return val;
    }

    getKey() {
        const cls = this.classSelect?.value || 'unselected';
        const unitKey = this.getUnitKey();
        return `${cls}|${unitKey}`;
    }

    increment(isCorrect) {
        const store = StorageManager.getProgress();
        const key = this.getKey();
        const cls = this.classSelect?.value || 'unselected';
        const unitKey = this.getUnitKey();
        const unitDisplay = this.getUnitDisplay();

        if (!store[key]) {
            store[key] = { 
                answered: 0, 
                correct: 0, 
                className: cls, 
                unitKey, 
                unitDisplay 
            };
        }

        store[key].answered += 1;
        if (isCorrect) store[key].correct += 1;

        StorageManager.setProgress(store);
    }

    getCurrent() {
        const store = StorageManager.getProgress();
        const key = this.getKey();
        return store[key] || { 
            answered: 0, 
            correct: 0, 
            className: this.classSelect?.value || 'unselected', 
            unitDisplay: this.getUnitDisplay() 
        };
    }
}

// ============================================================================
// QUESTION MANAGER
// ============================================================================

class QuestionManager {
    constructor() {
        this.currentQuestion = null;
        this.cache = {};
        this.prefetchController = null;
        this.hasShownFirst = false;
    }

    setCurrentQuestion(data) {
        this.currentQuestion = data;
    }

    getCurrentQuestion() {
        return this.currentQuestion;
    }

    cacheQuestion(key, data) {
        this.cache[key] = data;
    }

    getCachedQuestion(key) {
        const data = this.cache[key];
        if (data) {
            delete this.cache[key];
        }
        return data;
    }

    clearCache() {
        this.cache = {};
    }

    markFirstShown() {
        this.hasShownFirst = true;
    }

    resetFirstShown() {
        this.hasShownFirst = false;
    }

    hasShownFirstQuestion() {
        return this.hasShownFirst;
    }

    cancelPrefetch() {
        if (this.prefetchController) {
            this.prefetchController.abort();
            this.prefetchController = null;
        }
    }

    async prefetch(selectedClass, selectedUnit, currentUnits, providerSelect) {
        if (!selectedClass) return;

        this.cancelPrefetch();
        this.prefetchController = new AbortController();

        let unitDescription = '';
        const unitForCacheKey = selectedUnit;

        // Randomly select unit for variety
        if (selectedUnit && selectedUnit.startsWith('__custom__')) {
            const parts = selectedUnit.split('|');
            const from = parseInt(parts[1]);
            const to = parseInt(parts[2]);
            const randomIndex = from + Math.floor(Math.random() * (to - from + 1));
            unitDescription = currentUnits[randomIndex];
        } else if (!selectedUnit && currentUnits.length > 0) {
            const randomIndex = Math.floor(Math.random() * currentUnits.length);
            unitDescription = currentUnits[randomIndex];
        } else if (selectedUnit) {
            unitDescription = selectedUnit;
        }

        const preferred = providerSelect?.value || 'local';
        const cacheKey = unitForCacheKey ? `${selectedClass}|${unitForCacheKey}` : selectedClass;

        try {
            const response = await this.requestQuestion(selectedClass, unitDescription, preferred, true);
            if (response && !response.error) {
                this.cacheQuestion(cacheKey, response);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Prefetch failed:', err.message);
            }
        }
    }

    async requestQuestion(className, unit, provider, skipCache = false) {
        const response = await fetch('/api/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                className,
                unit,
                provider,
                skipCache
            }),
            signal: this.prefetchController?.signal
        });

        return await response.json();
    }
}

// ============================================================================
// UI MANAGER
// ============================================================================

class UIManager {
    constructor() {
        this.elements = {};
        this.lastExplanationModal = null;
    }

    initializeElements() {
        this.elements = {
            form: document.getElementById('questionForm'),
            answerOutput: document.getElementById('answerOutput'),
            progressPanel: document.getElementById('progressPanel'),
            classSelect: document.getElementById('classSelect'),
            unitSelect: document.getElementById('unitSelect'),
            rangeSliderContainer: document.getElementById('rangeSliderContainer'),
            fromSlider: document.getElementById('fromSlider'),
            toSlider: document.getElementById('toSlider'),
            sliderRange: document.getElementById('sliderRange'),
            fromLabel: document.getElementById('fromLabel'),
            toLabel: document.getElementById('toLabel'),
            providerSelect: document.getElementById('providerSelect'),
            themeSelect: document.getElementById('themeSelect'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            authButton: document.getElementById('authButton'),
            userProfile: document.getElementById('userProfile'),
            bugReportModal: document.getElementById('bugReportModal'),
            bugReportForm: document.getElementById('bugReportForm'),
            bugReportClose: document.getElementById('bugReportClose')
        };
    }

    showLoading(message = 'Generating question...') {
        if (this.elements.answerOutput) {
            this.elements.answerOutput.innerHTML = `
                <div class="loading">
                    <p>${message}</p>
                    <div class="loading-bar">
                        <div class="loading-bar-fill"></div>
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        if (this.elements.answerOutput) {
            this.elements.answerOutput.innerHTML = `
                <p style="color:red">${Utils.escapeHTML(message)}</p>
            `;
        }
    }

    renderQuestion(questionData) {
        if (!this.elements.answerOutput) return;

        this.elements.answerOutput.innerHTML = `
            <div class="question-container" style="animation: fadeIn 0.4s ease-in-out;">
                <div class="question-section">
                    <h3>Question</h3>
                    <pre class="question-text"></pre>
                </div>
                <div class="options-section">
                    ${['A', 'B', 'C', 'D'].map(letter => `
                        <button class="option-btn" data-option="${letter}">
                            <span class="option-label">${letter}.</span>
                            <pre class="option-text"></pre>
                        </button>
                    `).join('')}
                    <div class="question-actions">
                        <button class="question-action-btn skip-btn">Skip</button>
                        <button class="question-action-btn not-learned-btn">I haven't learned this yet</button>
                        <button class="question-action-btn report-bug-btn">Report a bug</button>
                        <!--
                        <button class="question-action-btn focus-mode-btn">Focus Mode</button>
                        -->
                    </div>
                </div>
            </div>
        `;

        // Render question text with KaTeX
        const questionTextEl = this.elements.answerOutput.querySelector('.question-text');
        if (questionTextEl) {
            questionTextEl.innerHTML = KaTeXRenderer.render(questionData.question);
        }

        // Render options with KaTeX
        ['A', 'B', 'C', 'D'].forEach(letter => {
            const optionEl = this.elements.answerOutput.querySelector(
                `.option-btn[data-option="${letter}"] .option-text`
            );
            if (optionEl) {
                optionEl.innerHTML = KaTeXRenderer.render(questionData[`option${letter}`]);
            }
        });

        // Detect long questions and apply two-column layout
        this.detectLongQuestion(questionData);
    }

    detectLongQuestion(questionData) {
        const container = this.elements.answerOutput?.querySelector('.question-container');
        const questionSection = this.elements.answerOutput?.querySelector('.question-section');
        
        if (!container || !questionSection) return;

        requestAnimationFrame(() => {
            const textLength = (questionData.question || '').length;
            const hasCodeBlock = /```|\n\s{2,}|<code/i.test(questionData.question);
            const qHeight = questionSection.scrollHeight;
            const threshold = Math.min(window.innerHeight * 0.7, 600);
            
            const isLong = textLength > 450 || hasCodeBlock || qHeight > threshold;
            
            if (isLong) {
                container.classList.add('has-long-question');
            } else {
                container.classList.remove('has-long-question');
            }
        });
    }

    showExplanation(questionData, selectedAnswer) {
        const correct = questionData.correctAnswer;
        const isCorrect = selectedAnswer === correct;

        // Clean up previous explanation
        if (this.lastExplanationModal && this.lastExplanationModal.parentNode) {
            this.lastExplanationModal.parentNode.removeChild(this.lastExplanationModal);
        }

        const container = this.elements.answerOutput?.querySelector('.question-container');
        if (!container) return;

        // Ensure container is positioned for overlay
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.className = 'explanation-overlay';
        overlay.innerHTML = `
            <div class="explanation-card" tabindex="-1">
                <h2>${isCorrect ? 'Correct!' : 'Incorrect'}</h2>
                <p><strong>Correct Answer:</strong> ${correct}</p>
                <pre class="explanation-text"></pre>
                <div class="explain-actions">
                    <button class="close-modal">Close</button>
                </div>
            </div>
        `;

        const explanationText = overlay.querySelector('.explanation-text');
        if (explanationText) {
            explanationText.innerHTML = KaTeXRenderer.render(questionData.explanation);
        }

        overlay.querySelector('.close-modal')?.addEventListener('click', () => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            this.lastExplanationModal = null;
        });

        container.appendChild(overlay);
        this.lastExplanationModal = overlay;
    }

    disableOptions(correctAnswer, selectedAnswer) {
        this.elements.answerOutput?.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.option === correctAnswer) {
                btn.classList.add('correct');
            } else if (btn.dataset.option === selectedAnswer) {
                btn.classList.add('incorrect');
            }
        });
    }

    addAnswerActions(questionData, selectedAnswer, onNext) {
        const optionsSection = this.elements.answerOutput?.querySelector('.options-section');
        if (!optionsSection) return;

        const actionWrap = document.createElement('div');
        actionWrap.className = 'question-action-split';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'next-question-btn';
        nextBtn.textContent = 'Next Question';
        nextBtn.addEventListener('click', () => {
            if (this.lastExplanationModal && this.lastExplanationModal.parentNode) {
                this.lastExplanationModal.parentNode.removeChild(this.lastExplanationModal);
                this.lastExplanationModal = null;
            }
            onNext();
        });

        const showBtn = document.createElement('button');
        showBtn.className = 'show-explanation-btn';
        showBtn.textContent = 'Show Explanation';
        showBtn.addEventListener('click', () => {
            this.showExplanation(questionData, selectedAnswer);
            if (this.lastExplanationModal) {
                this.lastExplanationModal.querySelector('.explanation-card')?.focus();
            }
        });

        actionWrap.appendChild(nextBtn);
        actionWrap.appendChild(showBtn);
        optionsSection.appendChild(actionWrap);

        // Show explanation immediately
        this.showExplanation(questionData, selectedAnswer);
    }
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

class APStudyApp {
    constructor() {
        this.ui = new UIManager();
        this.questionManager = new QuestionManager();
        this.progressTracker = null;
        this.apClassesData = null;
        this.currentUnits = [];
        this.listenersAttached = false;
    }

    async initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Handle homepage redirect for logged-in users
        this.handleHomepageRedirect();

        // Initialize UI elements
        this.ui.initializeElements();

        // Load AP classes data
        await this.loadAPClassesData();

        // Initialize theme
        ThemeManager.initialize(this.ui.elements.themeSelect);

        // Initialize progress tracker
        this.initializeProgressTracker();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize auth UI
        this.initializeAuth();

        // Initialize progress UI
        this.updateProgressPanel();
        this.setProgressVisibility();

        // Try to initialize question section
        this.initQuestionSection();

        // Expose global functions
        this.exposeGlobalFunctions();
    }

    handleHomepageRedirect() {
        try {
            const homepagePaths = ['/', '/index.html'];
            if (homepagePaths.includes(location.pathname) && 
                typeof isLoggedIn === 'function' && isLoggedIn()) {
                location.replace('/app/');
            }
        } catch (error) {
            console.warn('Homepage redirect check failed:', error);
        }
    }

    async loadAPClassesData() {
        try {
            const response = await fetch('/data/ap-classes.json');
            this.apClassesData = await response.json();
        } catch (error) {
            console.error('Failed to load AP classes data:', error);
        }
    }

    initializeProgressTracker() {
        this.progressTracker = new ProgressTracker(
            this.ui.elements.classSelect,
            this.ui.elements.unitSelect,
            this.ui.elements.fromSlider,
            this.ui.elements.toSlider,
            this.currentUnits
        );
    }

    setupEventListeners() {
        // Theme change
        this.ui.elements.themeSelect?.addEventListener('change', (e) => {
            StorageManager.setTheme(e.target.value);
            ThemeManager.apply(e.target.value);
        });

        // Settings modal
        this.ui.elements.settingsBtn?.addEventListener('click', () => {
            this.toggleSettingsModal();
        });

        this.ui.elements.closeSettings?.addEventListener('click', () => {
            this.ui.elements.settingsModal?.classList.remove('show');
        });

        this.ui.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.ui.elements.settingsModal) {
                this.ui.elements.settingsModal.classList.remove('show');
            }
        });

        // Progress panel toggle (click on hidden state or hide button)
        this.setupProgressPanelToggle();

        // FAQ accordion
        document.querySelectorAll('.faq-question').forEach(button => {
            button.addEventListener('click', () => {
                const faqItem = button.parentElement;
                const isActive = faqItem.classList.contains('active');
                
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                if (!isActive) {
                    faqItem.classList.add('active');
                }
            });
        });

        // Bug report
        this.setupBugReportListeners();
    }

    setupProgressPanelToggle() {
        const panel = this.ui.elements.progressPanel;
        if (!panel) return;

        // Click handler for when panel is in hidden state
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('hidden')) {
                StorageManager.setProgressHidden(false);
                this.updateProgressPanel();
            }
        });
    }

    setupBugReportListeners() {
        this.ui.elements.bugReportClose?.addEventListener('click', () => {
            this.ui.elements.bugReportModal?.classList.remove('show');
        });

        this.ui.elements.bugReportModal?.addEventListener('click', (e) => {
            if (e.target === this.ui.elements.bugReportModal) {
                this.ui.elements.bugReportModal.classList.remove('show');
            }
        });

        this.ui.elements.bugReportForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitBugReport();
        });
    }

    async submitBugReport() {
        const descriptionEl = document.getElementById('bugDescription');
        const feedbackEl = document.getElementById('bugReportFeedback');
        
        if (!descriptionEl?.value.trim()) {
            if (feedbackEl) feedbackEl.textContent = 'Please describe the issue.';
            return;
        }

        const metadata = {
            class: this.ui.elements.classSelect?.value || 'unselected',
            unit: this.ui.elements.unitSelect?.value || 'unselected',
            theme: document.documentElement.getAttribute('data-theme') || 'system'
        };

        try {
            const response = await fetch('/api/bug-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'User reported bug',
                    description: descriptionEl.value.trim(),
                    severity: 'low',
                    metadata
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                if (feedbackEl) {
                    feedbackEl.textContent = `Thanks! Reference ${result.id} in any follow-up.`;
                }
                descriptionEl.value = '';
            } else {
                if (feedbackEl) {
                    feedbackEl.textContent = result.error || 'Could not submit bug report.';
                }
            }
        } catch (error) {
            if (feedbackEl) {
                feedbackEl.textContent = 'Network error. Please try again.';
            }
        }
    }

    toggleSettingsModal() {
        if (!this.ui.elements.settingsModal) return;
        
        const isOpen = this.ui.elements.settingsModal.classList.contains('show');
        if (isOpen) {
            this.ui.elements.settingsModal.classList.remove('show');
        } else {
            this.ui.elements.settingsModal.classList.add('show');
            setTimeout(() => {
                const firstControl = this.ui.elements.themeSelect || 
                    this.ui.elements.settingsModal.querySelector('select, button, [tabindex]');
                firstControl?.focus();
            }, 50);
        }
    }

    initializeAuth() {
        const { authButton, userProfile } = this.ui.elements;
        
        if (!authButton || !userProfile) return;

        if (typeof isLoggedIn === 'function' && isLoggedIn()) {
            const userData = getUserData();
            if (userData) {
                authButton.style.display = 'none';
                userProfile.style.display = 'flex';
                
                const userName = document.getElementById('userName');
                if (userName) userName.textContent = userData.name || 'Account';
                
                this.setupUserDropdown();
                this.hideSettingsButton();
            }
        } else {
            authButton.style.display = '';
            userProfile.style.display = 'none';
            this.ui.elements.settingsBtn.style.display = '';
        }
    }

    setupUserDropdown() {
        const userProfileBtn = document.getElementById('userProfileBtn');
        const userDropdown = document.getElementById('userDropdown');
        const logoutBtn = document.getElementById('logoutBtn');
        const openSettings = document.getElementById('openSettingsFromDropdown');

        userProfileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown?.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userDropdown?.classList.remove('show');
        });

        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof logout === 'function') logout();
        });

        openSettings?.addEventListener('click', (e) => {
            e.preventDefault();
            userDropdown?.classList.remove('show');
            this.ui.elements.settingsBtn?.click();
        });
    }

    hideSettingsButton() {
        if (this.ui.elements.settingsBtn) {
            this.ui.elements.settingsBtn.style.display = 'none';
        }
    }

    initQuestionSection() {
        // Refresh element references
        this.ui.initializeElements();

        if (!this.ui.elements.form || !this.ui.elements.classSelect || !this.ui.elements.unitSelect) {
            return false;
        }

        if (this.listenersAttached) return true;

        // Class selection change
        this.ui.elements.classSelect.addEventListener('change', (e) => {
            this.populateUnits(e.target.value);
            this.questionManager.resetFirstShown();
            this.questionManager.clearCache(); // Clear cache when class changes
            this.questionManager.cancelPrefetch(); // Cancel any ongoing prefetch
            this.updateProgressPanel();
        });

        // Unit selection change
        this.ui.elements.unitSelect.addEventListener('change', (e) => {
            this.handleUnitChange(e.target.value);
            this.questionManager.resetFirstShown();
            this.questionManager.clearCache(); // Clear cache when unit changes
            this.questionManager.cancelPrefetch(); // Cancel any ongoing prefetch
            this.updateProgressPanel();
        });

        // Range sliders
        this.ui.elements.fromSlider?.addEventListener('input', () => {
            this.updateSliderRange();
            this.updateProgressPanel();
        });

        this.ui.elements.toSlider?.addEventListener('input', () => {
            this.updateSliderRange();
            this.updateProgressPanel();
        });

        // Form submission
        this.ui.elements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleQuestionRequest();
        });

        this.listenersAttached = true;
        this.updateProgressPanel();
        return true;
    }

    handleUnitChange(value) {
        const container = this.ui.elements.rangeSliderContainer;
        if (!container) return;

        if (value === '__custom__') {
            container.style.display = 'block';
            setTimeout(() => container.classList.add('show'), 10);
        } else {
            container.classList.remove('show');
            setTimeout(() => container.style.display = 'none', 300);
        }
    }

    populateUnits(className) {
        const { unitSelect } = this.ui.elements;
        if (!unitSelect) return;

        if (!this.apClassesData || !className) {
            unitSelect.innerHTML = '<option value="">Choose a class</option>';
            unitSelect.disabled = true;
            return;
        }

        const course = this.apClassesData.courses.find(c => c.name === className);
        if (!course) {
            unitSelect.innerHTML = '<option value="">Choose a class</option>';
            unitSelect.disabled = true;
            return;
        }

        const allUnits = [...course.semester1, ...course.semester2];
        if (allUnits.length === 0) {
            unitSelect.innerHTML = '<option value="">No units available</option>';
            unitSelect.disabled = true;
            return;
        }

        this.currentUnits = allUnits;

        unitSelect.innerHTML = '<option value="">All Units</option>';
        unitSelect.innerHTML += '<option value="__custom__">Custom Range</option>';
        allUnits.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });

        unitSelect.disabled = false;
        this.setupRangeSlider(allUnits);
    }

    setupRangeSlider(units) {
        this.currentUnits = units;
        const maxIndex = units.length - 1;
        
        if (this.ui.elements.fromSlider) {
            this.ui.elements.fromSlider.max = maxIndex;
            this.ui.elements.fromSlider.value = 0;
        }
        
        if (this.ui.elements.toSlider) {
            this.ui.elements.toSlider.max = maxIndex;
            this.ui.elements.toSlider.value = maxIndex;
        }
        
        this.updateSliderRange();
    }

    updateSliderRange() {
        if (this.currentUnits.length === 0) return;
        
        let from = parseInt(this.ui.elements.fromSlider?.value || 0);
        let to = parseInt(this.ui.elements.toSlider?.value || 0);
        
        if (from > to) [from, to] = [to, from];
        
        if (this.ui.elements.fromSlider) this.ui.elements.fromSlider.value = from;
        if (this.ui.elements.toSlider) this.ui.elements.toSlider.value = to;
        
        const maxIndex = this.currentUnits.length - 1;
        const fromPercent = (from / maxIndex) * 100;
        const toPercent = (to / maxIndex) * 100;
        
        if (this.ui.elements.sliderRange) {
            this.ui.elements.sliderRange.style.left = fromPercent + '%';
            this.ui.elements.sliderRange.style.width = (toPercent - fromPercent) + '%';
        }
        
        if (this.ui.elements.fromLabel) {
            this.ui.elements.fromLabel.textContent = this.currentUnits[from] || '';
        }
        if (this.ui.elements.toLabel) {
            this.ui.elements.toLabel.textContent = this.currentUnits[to] || '';
        }
    }

    async handleQuestionRequest() {
        this.updateProgressPanel();
        
        const selectedClass = this.ui.elements.classSelect?.value;
        let selectedUnit = this.ui.elements.unitSelect?.value;

        if (!selectedClass) {
            this.ui.showError('Please select an AP class first.');
            return;
        }

        // Handle custom range
        if (selectedUnit === '__custom__') {
            const from = parseInt(this.ui.elements.fromSlider?.value || 0);
            const to = parseInt(this.ui.elements.toSlider?.value || 0);
            const [min, max] = [Math.min(from, to), Math.max(from, to)];
            selectedUnit = `__custom__|${min}|${max}`;
        }

        // Store current selections for recordAttempt
        this.currentClass = selectedClass;
        this.currentUnit = selectedUnit || '';

        const cacheKey = selectedUnit ? `${selectedClass}|${selectedUnit}` : selectedClass;
        
        // Check if selection has changed (treat as "first question" for new selection)
        const selectionChanged = this.lastCacheKey !== cacheKey;
        if (selectionChanged) {
            this.lastCacheKey = cacheKey;
            this.questionManager.resetFirstShown();
        }

        // Check prefetch cache first for all requests (instant loading)
        const cached = this.questionManager.getCachedQuestion(cacheKey);
        if (cached) {
            this.processQuestionData(cached);
            this.questionManager.markFirstShown();
            setTimeout(() => this.prefetchNext(selectedClass, selectedUnit), 100);
            return;
        }

        this.ui.showLoading();

        try {
            const unitDescription = this.getRandomUnit(selectedUnit);
            // Store the actual unit description for recordAttempt
            this.currentUnit = unitDescription || 'All Units';
            
            // Use database cache for first question of this selection, fresh generation for subsequent
            const useCache = !this.questionManager.hasShownFirstQuestion();
            const data = await this.fetchQuestion(selectedClass, unitDescription, useCache);

            if (data.error) {
                this.ui.showError('Error: ' + data.error);
                return;
            }

            this.processQuestionData(data);
            this.questionManager.markFirstShown();
            
            setTimeout(() => this.prefetchNext(selectedClass, selectedUnit), 100);
        } catch (error) {
            console.error('Request error:', error);
            this.ui.showError('Request failed: ' + error.message);
        }
    }

    getRandomUnit(selectedUnit) {
        if (selectedUnit && selectedUnit.startsWith('__custom__')) {
            const parts = selectedUnit.split('|');
            const from = parseInt(parts[1]);
            const to = parseInt(parts[2]);
            const randomIndex = from + Math.floor(Math.random() * (to - from + 1));
            return this.currentUnits[randomIndex];
        } else if (!selectedUnit && this.currentUnits.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.currentUnits.length);
            return this.currentUnits[randomIndex];
        }
        return selectedUnit || '';
    }

    async fetchQuestion(className, unit, useCache = false) {
        const preferred = this.ui.elements.providerSelect?.value || 'local';
        // Skip database cache unless specifically requested (first question only)
        const skipCache = !useCache;

        let response = await fetch('/api/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, unit, provider: preferred, skipCache })
        });

        let data = await response.json();

        // Fallback to OpenAI if local fails
        if (preferred === 'local' && data.shouldFallback && !response.ok) {
            console.warn('Local failed, falling back to OpenAI:', data?.error);
            response = await fetch('/api/question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ className, unit, provider: 'openai', skipCache })
            });
            
            if (response.ok) {
                data = await response.json();
                if (this.ui.elements.providerSelect) {
                    this.ui.elements.providerSelect.value = 'openai';
                }
            }
        }

        return data;
    }

    processQuestionData(data) {
        try {
            let raw = data.answer.trim();
            if (raw.startsWith('```')) {
                raw = raw.replace(/```json|```/g, '').trim();
            }

            const questionData = JSON.parse(raw);
            
            // Add questionId from API response to question data
            if (data.questionId) {
                questionData.questionId = data.questionId;
            }
            
            // Add current class and unit to question data for recording
            questionData.apClass = this.currentClass || questionData.apClass || 'Unknown';
            questionData.unit = this.currentUnit || questionData.unit || 'Unknown';
            
            this.questionManager.setCurrentQuestion(questionData);

            this.ui.renderQuestion(questionData);
            
            // Track when question starts for timing
            this.questionStartTime = Date.now();
            
            this.attachQuestionListeners(questionData);
            
            // Activate AI Tutor if available
            this.activateAITutor(questionData);
            
            this.updateProgressPanel();
        } catch (error) {
            console.error('Invalid question data:', error);
            this.ui.showError('Invalid response format');
        }
    }

    attachQuestionListeners(questionData) {
        // Option buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleAnswer(btn.dataset.option));
        });

        // Skip button
        document.querySelector('.skip-btn')?.addEventListener('click', () => {
            this.ui.elements.form?.dispatchEvent(new Event('submit'));
        });

        // Not learned button
        document.querySelector('.not-learned-btn')?.addEventListener('click', () => {
            this.ui.showLoading('Generating a different question...');
            setTimeout(() => {
                this.ui.elements.form?.dispatchEvent(new Event('submit'));
            }, 300);
        });

        // Report bug button
        document.querySelector('.report-bug-btn')?.addEventListener('click', () => {
            this.ui.elements.bugReportModal?.classList.add('show');
        });

        // Focus mode button
        /*
        document.querySelector('.focus-mode-btn')?.addEventListener('click', () => {
            this.saveFocusQuestion(questionData);
        });
        */
    }

    saveFocusQuestion(questionData) {
        try {
            const payload = {
                questionData,
                provider: 'local',
                model: '',
                selectedClass: this.ui.elements.classSelect?.value,
                selectedUnit: this.ui.elements.unitSelect?.value
            };
            localStorage.setItem('focusQuestion', JSON.stringify(payload));
            window.location.href = '/practice/';
        } catch (error) {
            console.warn('Could not save focus question:', error);
        }
    }

    activateAITutor(questionData) {
        if (window.aiTutor) {
            const answerChoices = {
                A: questionData.optionA,
                B: questionData.optionB,
                C: questionData.optionC,
                D: questionData.optionD
            };
            
            window.aiTutor.setQuestionContext(
                questionData.question,
                questionData.correctAnswer,
                questionData.explanation,
                this.ui.elements.classSelect?.value,
                this.ui.elements.unitSelect?.options[this.ui.elements.unitSelect.selectedIndex]?.text,
                answerChoices
            );
        }
    }

    handleAnswer(selected) {
        const questionData = this.questionManager.getCurrentQuestion();
        if (!questionData) return;

        const correct = questionData.correctAnswer;
        const isCorrect = selected === correct;

        this.ui.disableOptions(correct, selected);
        this.ui.addAnswerActions(questionData, selected, () => {
            this.ui.elements.form?.dispatchEvent(new Event('submit'));
        });

        this.progressTracker?.increment(isCorrect);
        this.updateProgressPanel();
        
        // Record attempt to backend if user is logged in
        this.recordAttempt(questionData, selected, isCorrect);
    }
    
    async recordAttempt(questionData, selectedAnswer, wasCorrect) {
        // Only record if user is logged in
        if (typeof isLoggedIn !== 'function' || !isLoggedIn()) {
            return;
        }
        
        try {
            const timeTakenMs = Date.now() - (this.questionStartTime || Date.now());
            
            const payload = {
                questionId: questionData.questionId,
                apClass: questionData.apClass,
                unit: questionData.unit,
                selectedAnswer,
                wasCorrect,
                timeTakenMs
            };
            
            const response = await authFetch('/api/auth/record-attempt', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to record attempt:', error);
            }
        } catch (error) {
            console.error('Failed to record attempt:', error);
            // Continue anyway - don't block user experience
        }
    }

    prefetchNext(selectedClass, selectedUnit) {
        this.questionManager.prefetch(
            selectedClass,
            selectedUnit,
            this.currentUnits,
            this.ui.elements.providerSelect
        );
    }

    updateProgressPanel() {
        if (!this.ui.elements.progressPanel || !this.progressTracker) return;

        const cls = this.ui.elements.classSelect?.value || 'Select AP Class';
        const unitDisplay = this.progressTracker.getUnitDisplay();
        const { answered, correct } = this.progressTracker.getCurrent();
        const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;

        this.ui.elements.progressPanel.innerHTML = `
            <div class="progress-show-text">Show Progress</div>
            <div class="progress-content">
                <div class="progress-header">
                    <h3>Progress</h3>
                    <button class="progress-hide-btn" aria-label="Hide progress">✕</button>
                </div>
                <div class="progress-row">
                    <span>${cls}</span>
                    <span>${correct}/${answered} (${percentage}%)</span>
                </div>
                <div class="progress-subtext">${unitDisplay}</div>
            </div>
        `;

        // Attach hide button click handler
        const hideBtn = this.ui.elements.progressPanel.querySelector('.progress-hide-btn');
        if (hideBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                StorageManager.setProgressHidden(true);
                this.setProgressVisibility();
            });
        }

        this.setProgressVisibility();
    }

    setProgressVisibility() {
        if (!this.ui.elements.progressPanel || !this.ui.elements.answerOutput) return;

        const manualHidden = StorageManager.isProgressHidden();
        const hasQuestion = !!this.ui.elements.answerOutput.querySelector('.question-container');
        const hasClassSelected = this.ui.elements.classSelect?.value;

        // Remove both classes first
        this.ui.elements.progressPanel.classList.remove('hidden', 'show');

        if (!hasQuestion || !hasClassSelected) {
            // No question or no class selected: don't show the panel at all
            return;
        }

        if (manualHidden) {
            // Show in minimized/hidden state
            this.ui.elements.progressPanel.classList.add('hidden');
        } else {
            // Show in expanded state
            this.ui.elements.progressPanel.classList.add('show');
        }
    }

    exposeGlobalFunctions() {
        window.initQuestionSection = () => this.initQuestionSection();
        
        window.renderFocusQuestion = (payload) => {
            try {
                const questionData = payload?.questionData || payload;
                if (!questionData) return;

                this.questionManager.setCurrentQuestion(questionData);
                
                const focusContainer = document.getElementById('focusContent') || 
                                     document.getElementById('answerOutput');
                if (!focusContainer) return;

                this.ui.elements.answerOutput = focusContainer;
                this.ui.renderQuestion(questionData);
                this.attachQuestionListeners(questionData);
                this.updateProgressPanel();
            } catch (error) {
                console.error('renderFocusQuestion error:', error);
            }
        };
    }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

const app = new APStudyApp();
app.initialize();

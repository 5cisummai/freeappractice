/**
 * KaTeX Renderer - Properly render mathematical expressions
 * Dependencies: utils.js, KaTeX library, Highlight.js library
 */

const KaTeXRenderer = {
    /**
     * Render mathematical expressions in text with proper KaTeX formatting
     * Handles both display and inline math, plus code blocks
     */
    render(text) {
        if (!window.katex || !text) return Utils.escapeHTML(text || '');

        // First pass: extract and protect code blocks
        const codeBlocks = [];
        let textWithPlaceholders = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `___CODE_BLOCK_${codeBlocks.length}___`;
            codeBlocks.push({ lang: lang || 'plaintext', code });
            return placeholder;
        });

        // Second pass: render math expressions
        const mathRendered = this.renderMathExpressions(textWithPlaceholders);

        // Third pass: restore code blocks with syntax highlighting
        let result = mathRendered;
        codeBlocks.forEach((block, index) => {
            const placeholder = `___CODE_BLOCK_${index}___`;
            const highlighted = this.highlightCode(block.code, block.lang);
            result = result.replace(placeholder, highlighted);
        });

        return result;
    },

    /**
     * Render only mathematical expressions (no code blocks)
     */
    renderMathExpressions(text) {
        if (!window.katex) return Utils.escapeHTML(text);

        // Define delimiters in order of priority (longest first to avoid conflicts)
        const delimiters = [
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
        ];

        let result = '';
        let position = 0;

        while (position < text.length) {
            let nearestMatch = null;
            let nearestDelimiter = null;

            // Find the nearest math delimiter
            for (const delimiter of delimiters) {
                const index = text.indexOf(delimiter.left, position);
                if (index !== -1 && (!nearestMatch || index < nearestMatch.index)) {
                    nearestMatch = { index, delimiter };
                }
            }

            // No more math expressions found
            if (!nearestMatch) {
                result += Utils.escapeHTML(text.slice(position));
                break;
            }

            // Add text before math expression
            result += Utils.escapeHTML(text.slice(position, nearestMatch.index));

            // Find closing delimiter
            const { delimiter } = nearestMatch;
            const mathStart = nearestMatch.index + delimiter.left.length;
            const mathEnd = text.indexOf(delimiter.right, mathStart);

            // No closing delimiter found - treat as regular text
            if (mathEnd === -1) {
                result += Utils.escapeHTML(text.slice(nearestMatch.index));
                break;
            }

            // Extract and render math expression
            const mathContent = text.slice(mathStart, mathEnd);
            
            try {
                const rendered = katex.renderToString(mathContent, {
                    displayMode: delimiter.display,
                    throwOnError: false,
                    strict: false,
                    trust: false,
                    macros: {
                        "\\f": "f(#1)",
                        "\\R": "\\mathbb{R}",
                        "\\N": "\\mathbb{N}",
                        "\\Z": "\\mathbb{Z}",
                        "\\Q": "\\mathbb{Q}",
                        "\\C": "\\mathbb{C}"
                    }
                });
                result += rendered;
            } catch (error) {
                // Fallback: show original expression if rendering fails
                console.warn('KaTeX rendering error:', error);
                result += Utils.escapeHTML(delimiter.left + mathContent + delimiter.right);
            }

            position = mathEnd + delimiter.right.length;
        }

        return result;
    },

    /**
     * Highlight code with syntax highlighting
     */
    highlightCode(code, language) {
        try {
            if (window.hljs && language !== 'plaintext') {
                const highlighted = hljs.highlight(code, { 
                    language, 
                    ignoreIllegals: true 
                }).value;
                return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
            }
        } catch (error) {
            console.warn('Syntax highlighting error:', error);
        }
        return `<pre><code class="hljs">${Utils.escapeHTML(code)}</code></pre>`;
    }
};

// Expose to global so other scripts/components can call it safely
if (typeof window !== 'undefined') {
    window.KaTeXRenderer = KaTeXRenderer;
    // Helper to render KaTeX into an element or return rendered HTML
    window.renderKaTeX = function targetRenderKaTeX(target) {
        if (!window.KaTeXRenderer) return null;
        try {
            if (typeof target === 'string') {
                return KaTeXRenderer.render(target);
            }
            if (target && target.innerHTML !== undefined) {
                // Render the element's textContent (preserve markup if already HTML)
                const source = target.getAttribute && target.getAttribute('data-raw') ? target.getAttribute('data-raw') : (target.textContent || target.innerHTML || '');
                target.innerHTML = KaTeXRenderer.render(source);
                return target;
            }
        } catch (err) {
            console.warn('renderKaTeX failed', err);
        }
        return null;
    };
}

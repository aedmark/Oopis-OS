/**
 * @file A modular, regex-based syntax highlighter for OopisOS.
 * This version is stateful and optimized for viewport-based rendering.
 * @module SyntaxHighlighter
 * @author The Engineer
 */
const SyntaxHighlighter = (() => {
    "use strict";

    let tokenizedLines = [];

    // Utility to escape HTML special characters remains the same.
    function escapeHtml(text) {
        if (text === undefined || text === null) return '';
        return text.replace(/[&<>"']/g, (match) => {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return match;
            }
        });
    }

    const tokenPatterns = {
        javascript: [
            { type: 'comment', pattern: /(?:\/\*[\s\S]*?\*\/|\/\/.*)/ },
            { type: 'string', pattern: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/ },
            { type: 'keyword', pattern: /\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|new|try|catch|finally|class|extends|super|async|await|import|export|from|default|of|in|instanceof|typeof|void|delete)\b/ },
            { type: 'number', pattern: /\b(?:\d+(?:\.\d*)?|\.\d+)\b/ },
            { type: 'operator', pattern: /(?:[+\-*/%<>=!&|?:]+|=>)/ },
            { type: 'punctuation', pattern: /(?:[;,{}()[\]])/ }
        ],
        shell: [
            { type: 'comment', pattern: /(?:#.*)/ },
            { type: 'string', pattern: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
            { type: 'keyword', pattern: /\b(?:echo|cd|ls|rm|mv|cp|mkdir|grep|find|xargs|if|then|else|fi|for|while|do|done|case|esac|function|return)\b/ },
            { type: 'operator', pattern: /(?:[|&;><])/ },
            { type: 'variable', pattern: /(?:\$[a-zA-Z_][a-zA-Z0-9_]*|\$@|\$#|\$[0-9])/ }
        ],
        css: [
            { type: 'comment', pattern: /(?:\/\*[\s\S]*?\*\/)/ },
            { type: 'selector', pattern: /(?:(?:^|[\s,}{])(?:[.#]?-?[_a-zA-Z]+[_a-zA-Z0-9-]*|\[[^\]]+\]|:+[:_a-zA-Z]+[_a-zA-Z0-9-]*)(?=[\s,{]))/m },
            { type: 'property', pattern: /(?:[a-zA-Z-]+)(?=\s*:)/ },
            { type: 'number', pattern: /(?:-?\d*\.?\d+(?:px|%|em|rem|vw|vh|s)?)/ },
            { type: 'string', pattern: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
        ],
        markdown: [
            { type: 'markdown-heading', pattern: /^(?:#{1,6}\s+.+)/m },
            { type: 'markdown-list-marker', pattern: /^(?:\s*(?:[-*+]|\d+\.)\s)/m },
            { type: 'comment', pattern: /(?:```[\s\S]*?```)/ },
            { type: 'string', pattern: /(?:`[^`\n]+?`)/ },
            { type: 'markdown-bold', pattern: /(?:\*\*(?:.*?)\*\*|__(?:.*?)__)/ },
            { type: 'markdown-italic', pattern: /(?:\*(?:.*?)\*|_(?:.*?)_)/ },
            { type: 'markdown-link-text', pattern: /(?:\[[^\]]+\])(?=\()/ },
            { type: 'markdown-link-url', pattern: /(?:\]\()(?:[^)]+)(?:\))/ },
        ],
        html: [
            { type: 'comment', pattern: // },
                    { type: 'tag', pattern: /<\/?([a-zA-Z0-9\-]+)/ },
            { type: 'tag', pattern: />/ },
            { type: 'attribute', pattern: /\b([a-zA-Z\-]+)(?=\s*=)/ },
            { type: 'value', pattern: /"([^"]*)"|'([^']*)'/ },
            { type: 'operator', pattern: /=/ }
        ]
    };

    /**
     * Tokenizes a single line of text.
     * @private
     */
    function _tokenizeLine(line, mode) {
        const patterns = tokenPatterns[mode] || [];
        if (patterns.length === 0 || line.trim() === '') {
            return [{ type: 'plain', content: line }];
        }

        const combinedPattern = new RegExp(patterns.map(p => `(${p.pattern.source})`).join('|'), 'g');
        const tokens = [];
        let lastIndex = 0;
        let match;

        while ((match = combinedPattern.exec(line)) !== null) {
            // *** FIX STARTS HERE ***
            // If we have a zero-length match, manually advance the index to avoid an infinite loop.
            if (match.index === combinedPattern.lastIndex) {
                combinedPattern.lastIndex++;
            }
            // *** FIX ENDS HERE ***

            const matchIndex = match.index;
            if (matchIndex > lastIndex) {
                tokens.push({ type: 'plain', content: line.substring(lastIndex, matchIndex) });
            }

            const matchText = match[0];
            const tokenGroupIndex = match.slice(1).findIndex(m => m !== undefined);
            const tokenType = tokenGroupIndex !== -1 ? patterns[tokenGroupIndex].type : 'plain';

            tokens.push({ type: tokenType, content: matchText });
            lastIndex = combinedPattern.lastIndex;
        }

        if (lastIndex < line.length) {
            tokens.push({ type: 'plain', content: line.substring(lastIndex) });
        }
        return tokens;
    }

    /**
     * Tokenizes an entire document and stores it in the module's state.
     */
    function tokenizeDocument(text, mode) {
        const lines = text.split('\n');
        tokenizedLines = lines.map(line => _tokenizeLine(line, mode));
    }

    /**
     * Gets the total number of lines currently tokenized.
     */
    function getLineCount() {
        return tokenizedLines.length;
    }

    /**
     * Renders a range of lines into an HTML string, incorporating find/replace highlights.
     */
    function getRenderedLinesHTML(startLine, endLine, findMatches = [], findActiveIndex = -1) {
        const visibleLines = tokenizedLines.slice(startLine, endLine);

        // Map each line of tokens to a string of HTML spans.
        const htmlLines = visibleLines.map((lineTokens, index) => {
            const renderedTokens = lineTokens.map(token => {
                const escapedContent = escapeHtml(token.content);
                return `<span class="sh-${token.type}">${escapedContent}</span>`;
            }).join('');
            // Each line is now wrapped in a <div>.
            // An empty line gets a non-breaking space (&nbsp;) to maintain its height.
            return `<div>${renderedTokens || '&nbsp;'}</div>`;
        });

        // The lines are now joined with a newline character. The container's CSS
        // (`white-space: pre-wrap`) will render this correctly, matching the textarea.
        return htmlLines.join('\n');
    }

    function highlight(text, mode, findMatches = [], findActiveIndex = -1) {
        tokenizeDocument(text, mode);
        const lineCount = getLineCount();
        // This is a full-document render, used for non-scrolling updates like toggling syntax on/off.
        return getRenderedLinesHTML(0, lineCount, findMatches, findActiveIndex);
    }

    // Public API
    return {
        tokenizeDocument,
        getRenderedLinesHTML,
        highlight,
        getLineCount
    };
})();
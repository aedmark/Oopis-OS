/**
 * @file A modular, regex-based syntax highlighter for OopisOS.
 * @module SyntaxHighlighter
 * @author The Engineer
 */
const SyntaxHighlighter = (() => {
    "use strict";

    // Utility to escape HTML special characters
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
            { type: 'comment', pattern: /(\/\*[\s\S]*?\*\/|\/\/.*)/ },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/ },
            { type: 'keyword', pattern: /\b(const|let|var|function|return|if|else|for|while|switch|case|break|new|try|catch|finally|class|extends|super|async|await|import|export|from|default|of|in|instanceof|typeof|void|delete)\b/ },
            // FIX: Inner group for decimal part is now non-capturing
            { type: 'number', pattern: /\b(\d+(?:\.\d*)?|\.\d+)\b/ },
            { type: 'operator', pattern: /([+\-*/%<>=!&|?:]+|=>)/ },
            { type: 'punctuation', pattern: /([;,{}()[\]])/ }
        ],
        shell: [
            { type: 'comment', pattern: /(#.*)/ },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
            { type: 'keyword', pattern: /\b(echo|cd|ls|rm|mv|cp|mkdir|grep|find|xargs|if|then|else|fi|for|while|do|done|case|esac|function|return)\b/ },
            { type: 'operator', pattern: /([|&;><])/ },
            { type: 'variable', pattern: /(\$[a-zA-Z_][a-zA-Z0-9_]*|\$@|\$#|\$[0-9])/ }
        ],
        css: [
            { type: 'comment', pattern: /(\/\*[\s\S]*?\*\/)/ },
            // FIX: Changed leading group to be non-capturing
            { type: 'selector', pattern: /(?:^|[\s,}{])([.#]?-?[_a-zA-Z]+[_a-zA-Z0-9-]*|\[[^\]]+\]|:+[:_a-zA-Z]+[_a-zA-Z0-9-]*)(?=[\s,{])/m },
            { type: 'property', pattern: /([a-zA-Z-]+)(?=\s*:)/ },
            // FIX: Changed unit group to be non-capturing
            { type: 'number', pattern: /(-?\d*\.?\d+)(?:px|%|em|rem|vw|vh|s)?/ },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
        ],
        markdown: [
            { type: 'markdown-heading', pattern: /^(#{1,6}\s+.+)/m },
            { type: 'markdown-list-marker', pattern: /^(\s*(?:[-*+]|\d+\.)\s)/m },
            { type: 'comment', pattern: /(```[\s\S]*?```)/ },
            { type: 'string', pattern: /(`[^`\n]+?`)/ },
            { type: 'markdown-bold', pattern: /(\*\*(?:.*?)\*\*|__(?:.*?)__)/ },
            { type: 'markdown-italic', pattern: /(\*(?:.*?)\*|_(?:.*?)_)/ },
            // --- CORRECTED PATTERN ---
            { type: 'markdown-link-text', pattern: /(\[[^\]]+\])(?=\()/ },
            // --- CORRECTED PATTERN ---
            { type: 'markdown-link-url', pattern: /(?:\]\()([^)]+)(?:\))/ },
        ]
    };

    /**
     * The main highlighting function.
     * @param {string} text - The plain text to highlight.
     * @param {string} mode - The language mode ('javascript', 'markdown', etc.).
     * @param {Array} findMatches - An array of match objects from the find-and-replace feature.
     * @param {number} findActiveIndex - The index of the currently active find match.
     * @returns {string} An HTML string with syntax and find/replace highlights.
     */
    function highlight(text, mode, findMatches = [], findActiveIndex = -1) {
        const patterns = tokenPatterns[mode] || [];
        const baseTokens = _tokenize(text, patterns);
        const mergedTokens = _mergeWithFindTokens(text, baseTokens, findMatches, findActiveIndex);

        return mergedTokens.map(token => {
            const escapedContent = escapeHtml(token.content);
            return `<span class="${token.class}">${escapedContent}</span>`;
        }).join('');
    }

    function _tokenize(text, patterns) {
        if (!patterns || patterns.length === 0) {
            return [{ type: 'plain', content: text, start: 0, end: text.length }];
        }

        const combinedPattern = new RegExp(patterns.map(p => `(${p.pattern.source})`).join('|'), 'g');
        let tokens = [];
        let lastIndex = 0;
        let match;

        while ((match = combinedPattern.exec(text)) !== null) {
            const matchText = match[0];
            const matchIndex = match.index;
            const tokenGroupIndex = match.slice(1).findIndex(m => m !== undefined);

            if (tokenGroupIndex === -1) {
                if (matchText.length > 0) {
                    if (match.Index > lastIndex) {
                        tokens.push({ type: 'plain', content: text.substring(lastIndex, matchIndex), start: lastIndex, end: matchIndex });
                    }
                    tokens.push({ type: 'plain', content: matchText, start: matchIndex, end: matchIndex + matchText.length });
                    lastIndex = matchIndex + matchText.length;
                } else {
                    combinedPattern.lastIndex++;
                }
                continue;
            }

            const tokenType = patterns[tokenGroupIndex].type;

            if (matchIndex > lastIndex) {
                tokens.push({ type: 'plain', content: text.substring(lastIndex, matchIndex), start: lastIndex, end: matchIndex });
            }

            tokens.push({ type: tokenType, content: matchText, start: matchIndex, end: matchIndex + matchText.length });
            lastIndex = combinedPattern.lastIndex;
        }

        if (lastIndex < text.length) {
            tokens.push({ type: 'plain', content: text.substring(lastIndex), start: lastIndex, end: text.length });
        }
        return tokens;
    }

    function _mergeWithFindTokens(text, baseTokens, findMatches, findActiveIndex) {
        if (findMatches.length === 0) {
            return baseTokens.map(token => ({ ...token, class: token.type === 'plain' ? '' : `sh sh-${token.type}` }));
        }

        const findTokens = findMatches.map((match, index) => ({
            type: 'find-match',
            content: match[0],
            start: match.index,
            end: match.index + match[0].length,
            class: index === findActiveIndex ? 'highlight-match--active' : 'highlight-match'
        }));

        const allTokens = [...baseTokens, ...findTokens].sort((a, b) => a.start - b.start || b.end - a.end);

        const merged = [];
        let lastEnd = 0;

        for (const token of allTokens) {
            if (token.start < lastEnd) continue;

            if (token.start > lastEnd) {
                merged.push({ class: '', content: text.substring(lastEnd, token.start) });
            }

            merged.push({
                class: token.type === 'find-match' ? token.class : `sh sh-${token.type}`,
                content: token.content
            });
            lastEnd = token.end;
        }

        if (lastEnd < text.length) {
            merged.push({ class: '', content: text.substring(lastEnd) });
        }

        return merged;
    }

    return {
        highlight
    };
})();
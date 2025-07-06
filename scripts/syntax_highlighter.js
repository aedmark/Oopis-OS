/**
 * @file A modular, regex-based syntax highlighter for OopisOS.
 * @module SyntaxHighlighter
 * @author The Engineer
 */
const SyntaxHighlighter = (() => {
    "use strict";

    // Utility to escape HTML special characters
    function escapeHtml(text) {
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
            { type: 'comment', pattern: /(\/\*[\s\S]*?\*\/|\/\/.*)/g },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g },
            { type: 'keyword', pattern: /\b(const|let|var|function|return|if|else|for|while|switch|case|break|new|try|catch|finally|class|extends|super|async|await|import|export|from|default|of|in|instanceof|typeof|void|delete)\b/g },
            { type: 'number', pattern: /\b(\d+(\.\d*)?|\.\d+)\b/g },
            { type: 'operator', pattern: /([+\-*/%<>=!&|?:]+|=>)/g },
            { type: 'punctuation', pattern: /([;,{}()[\]])/g }
        ],
        shell: [
            { type: 'comment', pattern: /(#.*)/g },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g },
            { type: 'keyword', pattern: /\b(echo|cd|ls|rm|mv|cp|mkdir|grep|find|xargs|if|then|else|fi|for|while|do|done|case|esac)\b/g },
            { type: 'operator', pattern: /([|&;><])/g },
            { type: 'variable', pattern: /(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\@|\$#|\$[0-9])/g }
        ],
        css: [
            { type: 'comment', pattern: /(\/\*[\s\S]*?\*\/)/g },
            { type: 'selector', pattern: /(^|[\s,}{])([.#]?-?[_a-zA-Z]+[_a-zA-Z0-9-]*|\[[^\]]+\]|:+[:_a-zA-Z]+[_a-zA-Z0-9-]*)(?=[\s,{])/gm },
            { type: 'property', pattern: /([a-zA-Z-]+)(?=\s*:)/g },
            { type: 'value', pattern: /:\s*(.+?)(;|\})/g }, // Simplified
            { type: 'number', pattern: /(-?\d*\.?\d+)(px|%|em|rem|vw|vh|s)?/g },
            { type: 'string', pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g },
        ],
        markdown: [
            { type: 'markdown-heading', pattern: /^(#{1,6}\s+.+)/gm },
            { type: 'markdown-bold', pattern: /(\*\*(.*?)\*\*|__(.*?)__)/g },
            { type: 'markdown-italic', pattern: /(\*(.*?)\*|_(.*?)_)/g },
            { type: 'markdown-list-marker', pattern: /^(\s*[-*+]\s|\s*\d+\.\s)/gm },
            { type: 'string', pattern: /(`.+?`)/g }, // Inline code
            { type: 'markdown-link-text', pattern: /(\[([^\]]+)\])(?=\()/g },
            { type: 'markdown-link-url', pattern: /(\]\()([^)]+)(\))/g },
            { type: 'comment', pattern: /(```[\s\S]*?```)/g }, // Code blocks
        ]
    };

    function highlight(text, mode) {
        const patterns = tokenPatterns[mode] || [];
        if (patterns.length === 0) {
            return escapeHtml(text);
        }

        const tokens = [];
        let lastIndex = 0;

        // Create a combined regex to find all possible tokens
        const allPatterns = patterns.map(p => `(${p.pattern.source})`).join('|');
        const globalRegex = new RegExp(allPatterns, 'g');

        text.replace(globalRegex, (match, ...args) => {
            const offset = args[args.length - 2];
            const tokenIndex = args.findIndex((arg, i) => i < args.length - 2 && arg === match);
            const tokenType = patterns[tokenIndex].type;

            // Add any text before this match as a plain token
            if (offset > lastIndex) {
                tokens.push({ type: 'plain', content: text.substring(lastIndex, offset) });
            }

            tokens.push({ type: tokenType, content: match });
            lastIndex = offset + match.length;
            return match; // necessary for .replace
        });

        // Add any remaining text after the last match
        if (lastIndex < text.length) {
            tokens.push({ type: 'plain', content: text.substring(lastIndex) });
        }

        // Build the final HTML string
        return tokens.map(token => {
            const escapedContent = escapeHtml(token.content);
            if (token.type === 'plain') {
                return escapedContent;
            }
            return `<span class="sh sh-${token.type}">${escapedContent}</span>`;
        }).join('');
    }

    return {
        highlight
    };
})();
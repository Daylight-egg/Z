const fs = require('fs');
const content = fs.readFileSync('src/contents/App.vue', 'utf8');

const styleStart = content.indexOf('<style scoped>');
const styleEnd = content.lastIndexOf('</style>');
const style = content.substring(styleStart + 14, styleEnd);

// Check for balanced braces in CSS
let balance = 0;
for (let i = 0; i < style.length; i++) {
    if (style[i] === '{') balance++;
    if (style[i] === '}') balance--;
    if (balance < 0) {
        const snippet = style.substring(Math.max(0, i - 50), Math.min(style.length, i + 50));
        console.error(`Mismatched closing brace at character ${i}. Snippet: \n${snippet}`);
        process.exit(1);
    }
}
if (balance !== 0) {
    console.error(`Unbalanced braces: ${balance}`);
} else {
    console.log("Braces are balanced.");
}

// Check for duplicate selectors (basic)
const selectors = style.match(/[.a-z0-9_-]+\s*\{/gi) || [];
const seen = new Set();
selectors.forEach(s => {
    if (seen.has(s)) {
        console.warn(`Duplicate selector found: ${s}`);
    }
    seen.add(s);
});

// Look for suspicious characters
for (let i = 0; i < style.length; i++) {
    if (style.charCodeAt(i) > 127 && style[i] !== '\n' && style[i] !== '\r') {
        const snippet = style.substring(Math.max(0, i - 20), Math.min(style.length, i + 20));
        console.warn(`Non-ASCII character found at ${i}: "${style[i]}" (Code: ${style.charCodeAt(i)}). Snippet: ${snippet}`);
    }
}

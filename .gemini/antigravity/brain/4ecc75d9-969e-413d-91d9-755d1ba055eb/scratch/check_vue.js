const fs = require('fs');
const content = fs.readFileSync('src/contents/App.vue', 'utf8');

const templateStart = content.indexOf('<template>');
const templateEnd = content.lastIndexOf('</template>');
const template = content.substring(templateStart + 10, templateEnd);

// Check for unclosed tags (naive check)
const tags = [];
const tagRegex = /<(\/)?([a-z0-9-]+)[^>]*>/gi;
let match;
while ((match = tagRegex.exec(template)) !== null) {
    const isClosing = !!match[1];
    const tagName = match[2].toLowerCase();
    if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) continue;
    if (isClosing) {
        const last = tags.pop();
        if (last !== tagName) {
            console.error(`Mismatched tag: expected closing for ${last}, but found ${tagName} at position ${match.index}`);
        }
    } else {
        tags.push(tagName);
    }
}
if (tags.length > 0) {
    console.error(`Unclosed tags: ${tags.join(', ')}`);
} else {
    console.log("Tags seem balanced.");
}

// Check for {{ }} inside attributes
const attrRegex = /([a-z-]+)="([^"]*{{[^"]*}}[^"]*)"/gi;
while ((match = attrRegex.exec(template)) !== null) {
    console.warn(`Potential interpolation issue in attribute ${match[1]}: ${match[2]}`);
}

const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, 'style.css');
const responsivePath = path.join(__dirname, 'responsive_fix.css');

let styleContent = fs.readFileSync(stylePath, 'utf8');

// Find the end of the valid content (before the corruption)
// The corruption starts with "/ * " with spaces
const corruptionStart = styleContent.indexOf('/ *');

if (corruptionStart !== -1) {
    styleContent = styleContent.substring(0, corruptionStart);
    console.log("Truncated corrupted content.");
} else {
    // If we can't find it easily, let's look for the last closing brace and newline of the previous valid block
    const lastValidBlock = `.newsletter-form button {
    width: 100%;
  }
}`;
    const idx = styleContent.indexOf(lastValidBlock);
    if (idx !== -1) {
        styleContent = styleContent.substring(0, idx + lastValidBlock.length);
        console.log("Truncated after last valid block.");
    }
}

const responsiveContent = fs.readFileSync(responsivePath, 'utf8');

fs.writeFileSync(stylePath, styleContent + '\n' + responsiveContent);
console.log("Fixed style.css successfully.");

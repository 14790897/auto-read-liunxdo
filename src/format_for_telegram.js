import fs from 'fs';

const inputFilePath = 'parsed_rss_data.json';
const outputFilePath = 'telegram_message.txt';

// Function to strip HTML tags
function stripHtml(html) {
    if (!html) return '';
    // First, try to extract content from the first <p> tag
    const pMatch = html.match(/<p>(.*?)<\/p>/i);
    if (pMatch && pMatch[1]) {
        // Remove any nested tags within the first <p>
        return pMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    // Fallback: remove all HTML tags if no <p> or if it's empty
    return html.replace(/<[^>]+>/g, '').trim();
}

fs.readFile(inputFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Failed to read ${inputFilePath}:`, err);
        return;
    }

    try {
        const jsonData = JSON.parse(data);
        let telegramMessage = `*New Posts from "${jsonData.channelTitle}"*\n`;
        telegramMessage += `${jsonData.channelLink}\n\n`;
        telegramMessage += `Channel Description:\n${jsonData.channelDescription.replace(/\*\*(.*?)\*\*/g, '*$1*')}\n\n`; // Keep markdown bold
        telegramMessage += "---\n\n";


        if (jsonData.items && Array.isArray(jsonData.items)) {
            jsonData.items.forEach(item => {
                const descriptionSnippet = stripHtml(item.description);
                telegramMessage += `*${item.title}*\n`;
                telegramMessage += `By: ${item.creator}\n`;
                if (descriptionSnippet) {
                    telegramMessage += `Content: ${descriptionSnippet}\n`;
                }
                telegramMessage += `Read more: ${item.link}\n`;
                telegramMessage += "---\n\n";
            });
        }

        fs.writeFile(outputFilePath, telegramMessage, (writeErr) => {
            if (writeErr) {
                console.error(`Failed to write ${outputFilePath}:`, writeErr);
                return;
            }
            console.log(`Successfully formatted message and wrote to ${outputFilePath}`);
        });

    } catch (parseErr) {
        console.error(`Failed to parse JSON from ${inputFilePath}:`, parseErr);
    }
});
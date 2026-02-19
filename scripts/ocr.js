import { FOOD_STATUS_KEYS } from "./constants.js";
import { updateSessionStatus } from "./view.js";

export async function processImage(file) {
    if (!file) return null;

    updateSessionStatus("Initializing OCR...");

    try {
        const { data: { text } } = await Tesseract.recognize(
            file,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        updateSessionStatus(`Reading image... ${(m.progress * 100).toFixed(0)}%`);
                    } else {
                        updateSessionStatus(m.status);
                    }
                }
            }
        );
        return text;
    } catch (error) {
        console.error("OCR Error:", error);
        updateSessionStatus("Error reading image.");
        throw error;
    }
}

export function parseOCRText(text) {
    const lines = text.split('\n');
    const results = [];
    let currentStatus = null;

    const statusMap = {
        "Delicious": FOOD_STATUS_KEYS.DELICIOUS,
        "Good": FOOD_STATUS_KEYS.GOOD,
        "Ok": FOOD_STATUS_KEYS.OK,
        "Bad": FOOD_STATUS_KEYS.BAD,
        "Horrible": FOOD_STATUS_KEYS.HORRIBLE
    };

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Check for Favorite/Worst
        const favMatch = line.match(/^Favorite:\s*(.+)/i);
        if (favMatch) {
            const food = favMatch[1].trim();
            if (food && food.toLowerCase() !== 'unknown') {
                 results.push({ foodName: food, isFavorite: true });
            }
            continue;
        }

        const worstMatch = line.match(/^Worst:\s*(.+)/i);
        if (worstMatch) {
            const food = worstMatch[1].trim();
            if (food && food.toLowerCase() !== 'unknown') {
                 results.push({ foodName: food, isWorst: true });
            }
            continue;
        }

        // Check for Section Header
        const headerMatch = line.match(/[-—]+ *(\w+) *[-—]+/);
        if (headerMatch) {
            const statusText = headerMatch[1];
            if (statusMap[statusText]) {
                currentStatus = statusMap[statusText];
                continue;
            }
        }

        if (currentStatus) {
            // Clean up food name (remove icons/bullets)
            const cleanName = line.replace(/^[^a-zA-Z0-9]+/, '').trim();
            if (cleanName.length > 2) {
                results.push({
                    foodName: cleanName,
                    status: currentStatus
                });
            }
        }
    }
    return results;
}

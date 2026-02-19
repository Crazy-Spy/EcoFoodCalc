import { FOOD_STATUS_KEYS } from "./constants.js";
import { updateSessionStatus } from "./view.js";

export async function processImage(file) {
    if (!file) return null;

    updateSessionStatus("Preprocessing image...");

    try {
        let imageToProcess = file;
        try {
             imageToProcess = await preprocessImage(file);
        } catch (e) {
             console.error("Preprocessing failed, using original.", e);
        }

        updateSessionStatus("Initializing OCR...");

        const { data: { text } } = await Tesseract.recognize(
            imageToProcess,
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

function preprocessImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Invert Colors (Eco dark mode -> light mode for Tesseract)
                // Also convert to grayscale and increase contrast
                const contrast = 1.5; // enhance contrast
                const intercept = 128 * (1 - contrast);

                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    let inverted = 255 - avg;

                    // Apply contrast
                    inverted = (inverted * contrast) + intercept;
                    // Clamp
                    inverted = Math.max(0, Math.min(255, inverted));

                    data[i] = inverted;
                    data[i + 1] = inverted;
                    data[i + 2] = inverted;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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

        // Check for Section Header (Flexible matching)
        // Clean line of non-alpha characters from start and end
        const cleanLine = line.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim();

        if (statusMap[cleanLine]) {
            currentStatus = statusMap[cleanLine];
            continue;
        }

        if (currentStatus) {
            // Clean up food name (remove icons/bullets at start)
            // Food names in Eco generally don't start with numbers, so we strip anything that isn't a letter.
            const cleanName = line.replace(/^[^a-zA-Z]+/, '').trim();

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

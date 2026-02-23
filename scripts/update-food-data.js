import fs from 'fs';
import path from 'path';

const FOOD_DIR = './Food';
const JSON_FILE = './foodsource.json';

// Tier Mapping
const SKILL_TIERS = {
    'CuttingEdgeCookingSkill': 4,
    'AdvancedCookingSkill': 3,
    'AdvancedBakingSkill': 3,
    'CookingSkill': 2,
    'BakingSkill': 2,
    'CampfireCookingSkill': 1
};

function getSkillData(content) {
    // Looks for: [RequiresSkill(typeof(SkillName), Level)]
    // Regex: \[RequiresSkill\(typeof\(([^)]+)\),\s*(\d+)\)\]
    const regex = /\[RequiresSkill\(typeof\(([^)]+)\),\s*(\d+)\)\]/;
    const match = content.match(regex);

    if (match) {
        const skillName = match[1].trim();
        const level = parseInt(match[2], 10);

        // Handle cases where the skill name might be fully qualified or just the class name
        const simpleSkillName = skillName.split('.').pop();
        const tier = SKILL_TIERS[simpleSkillName] || 0;

        return { tier, level };
    }

    return { tier: 0, level: 0 }; // Default if not found
}

function getNameFromContent(content) {
    const nameMatch = content.match(/\[LocDisplayName\("(.+?)"\)\]/);
    return nameMatch ? nameMatch[1] : null;
}

function updateFoodData() {
    console.log('Reading food files from:', FOOD_DIR);

    if (!fs.existsSync(FOOD_DIR)) {
        console.error('Food directory not found!');
        return;
    }

    const files = fs.readdirSync(FOOD_DIR).filter(file => file.endsWith('.cs'));
    const foodMap = new Map();

    files.forEach(file => {
        const content = fs.readFileSync(path.join(FOOD_DIR, file), 'utf-8');
        const name = getNameFromContent(content);
        if (name) {
            const data = getSkillData(content);
            foodMap.set(name, data);
            // console.log(`Found: ${name} -> Tier ${data.tier}, Level ${data.level}`);
        }
    });

    console.log(`Parsed ${foodMap.size} food items from C# files.`);

    // Read existing JSON
    let foodData = [];
    try {
        if (fs.existsSync(JSON_FILE)) {
            const rawContent = fs.readFileSync(JSON_FILE, 'utf-8');
            foodData = JSON.parse(rawContent.replace(/^\uFEFF/, ''));
        } else {
            console.error(`${JSON_FILE} not found!`);
            return;
        }
    } catch (e) {
        console.error('Error reading JSON:', e);
        return;
    }

    // Update JSON
    let updatedCount = 0;
    foodData.forEach(item => {
        const data = foodMap.get(item.Food_Name);
        if (data) {
            item.Tier = data.tier;
            item.Level = data.level; // Store level too
            updatedCount++;
        } else {
            console.warn(`Warning: No C# file found for "${item.Food_Name}". Setting Tier/Level to 0.`);
            item.Tier = 0;
            item.Level = 0;
        }
    });

    // Write back to JSON
    fs.writeFileSync(JSON_FILE, JSON.stringify(foodData, null, 4), 'utf-8');
    console.log(`Updated ${updatedCount} items in ${JSON_FILE}.`);
}

updateFoodData();

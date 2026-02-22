import fs from 'fs';
import path from 'path';

const FOOD_DIR = './Food';
const JSON_FILE = './new-foodsource.json';
const JSON_FILE_BACKUP = './foodsource.json'; // Also update the original just in case

// Tier Mapping
const SKILL_TIERS = {
    'CuttingEdgeCookingSkill': 4,
    'AdvancedCookingSkill': 3,
    'AdvancedBakingSkill': 3,
    'CookingSkill': 2,
    'BakingSkill': 2,
    'CampfireCookingSkill': 1
};

function getTierFromContent(content) {
    const skillMatch = content.match(/\[RequiresSkill\(typeof\(([^)]+)\)/);
    if (skillMatch) {
        const skillName = skillMatch[1].trim();
        // Handle cases where the skill name might be fully qualified or just the class name
        // We just need the last part if it has dots, but typically it's just the class name in these files
        const simpleSkillName = skillName.split('.').pop();
        return SKILL_TIERS[simpleSkillName] || 0; // Default to 0 if skill is found but not in our list (shouldn't happen for these tiers, but safe)
    }
    return 0; // No skill requirement found -> Tier 0
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
            const tier = getTierFromContent(content);
            foodMap.set(name, tier);
            // console.log(`Found: ${name} -> Tier ${tier}`);
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
        const tier = foodMap.get(item.Food_Name);
        if (tier !== undefined) {
            item.Tier = tier;
            updatedCount++;
        } else {
            console.warn(`Warning: No C# file found for "${item.Food_Name}". Setting Tier to 0.`);
            item.Tier = 0;
        }
    });

    // Write back to JSON
    fs.writeFileSync(JSON_FILE, JSON.stringify(foodData, null, 4), 'utf-8');
    console.log(`Updated ${updatedCount} items in ${JSON_FILE}.`);

    // Sync backup
    fs.writeFileSync(JSON_FILE_BACKUP, JSON.stringify(foodData, null, 4), 'utf-8');
    console.log(`Synced changes to ${JSON_FILE_BACKUP}.`);
}

updateFoodData();

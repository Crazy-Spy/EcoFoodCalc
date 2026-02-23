import { test } from 'node:test';
import assert from 'node:assert';
import {
    setFoodData,
    setUserPreferences,
    setStomachSize,
    setMealQuantity,
    setWorstFood
} from '../scripts/state.js';
import { getSuggestedDiets } from '../scripts/logic.js';
import { FOOD_STATUS_KEYS } from '../scripts/constants.js';

test('Balance Priority: Balanced Low Tier > Unbalanced High Tier', async (t) => {
    // T4_Unbalanced_Delicious: High Quality Score (4*16 + 3*10 + 0 = 94). Variance > 15.
    // T1_Balanced_Ok: Low Quality Score (1*16 + 1*10 + 0 = 26). Variance 0.
    // Expected: T1_Balanced_Ok

    setStomachSize(1000);
    setMealQuantity(1);
    setWorstFood('');

    const foods = [
        { Food_Name: 'T4_Unbalanced', Carbs: 100, Fat: 0, Protein: 0, Vitamins: 0, Official_Calories_Game: 500, Tier: 4, Level: 0 },
        { Food_Name: 'T1_Balanced', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 1, Level: 0 }
    ];
    setFoodData(foods);

    const prefs = {
        'T4_Unbalanced': { status: FOOD_STATUS_KEYS.DELICIOUS },
        'T1_Balanced': { status: FOOD_STATUS_KEYS.OK }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'T1_Balanced', 'Should pick balanced low-tier over unbalanced high-tier');
});

test('Quality Tie-Breaker: T3 Good > T2 Delicious', async (t) => {
    // Both Balanced (Variance 0).
    // T3 Good (Score: 3*16 + 2*10 = 48 + 20 = 68)
    // T2 Delicious (Score: 2*16 + 3*10 = 32 + 30 = 62)
    // Expected: T3 Good (68 > 62)

    const foods = [
        { Food_Name: 'T3_Good', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 3, Level: 0 },
        { Food_Name: 'T2_Delicious', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 2, Level: 0 }
    ];
    setFoodData(foods);

    const prefs = {
        'T3_Good': { status: FOOD_STATUS_KEYS.GOOD },
        'T2_Delicious': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'T3_Good', 'T3 Good should beat T2 Delicious');
});

test('Quality Tie-Breaker: T2 Delicious > T3 Ok', async (t) => {
    // Both Balanced.
    // T3 Ok (Score: 3*16 + 1*10 = 48 + 10 = 58)
    // T2 Delicious (Score: 2*16 + 3*10 = 32 + 30 = 62)
    // Expected: T2 Delicious (62 > 58)

    const foods = [
        { Food_Name: 'T3_Ok', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 3, Level: 0 },
        { Food_Name: 'T2_Delicious', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 2, Level: 0 }
    ];
    setFoodData(foods);

    const prefs = {
        'T3_Ok': { status: FOOD_STATUS_KEYS.OK },
        'T2_Delicious': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'T2_Delicious', 'T2 Delicious should beat T3 Ok');
});

test('Level Consideration: Same Tier/Taste, Higher Level Wins', async (t) => {
    // Both T2 Good.
    // T2_Lvl5 (Score: 2*16 + 2*10 + 5*1 = 32 + 20 + 5 = 57)
    // T2_Lvl1 (Score: 2*16 + 2*10 + 1*1 = 32 + 20 + 1 = 53)
    // Expected: T2_Lvl5

    const foods = [
        { Food_Name: 'T2_Lvl5', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 2, Level: 5 },
        { Food_Name: 'T2_Lvl1', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 2, Level: 1 }
    ];
    setFoodData(foods);

    const prefs = {
        'T2_Lvl5': { status: FOOD_STATUS_KEYS.GOOD },
        'T2_Lvl1': { status: FOOD_STATUS_KEYS.GOOD }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'T2_Lvl5', 'Higher level should win tie-breaker');
});

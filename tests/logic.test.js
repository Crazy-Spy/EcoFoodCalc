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

test('Tier Prioritization: Should select highest Tier', async (t) => {
    setStomachSize(1000);
    setMealQuantity(1);
    setWorstFood('');

    const foods = [
        { Food_Name: 'T4_Food', Carbs: 10, Fat: 10, Protein: 10, Vitamins: 10, Official_Calories_Game: 500, Tier: 4 },
        { Food_Name: 'T3_Food', Carbs: 10, Fat: 10, Protein: 10, Vitamins: 10, Official_Calories_Game: 500, Tier: 3 }
    ];
    setFoodData(foods);

    const prefs = {
        'T4_Food': { status: FOOD_STATUS_KEYS.DELICIOUS },
        'T3_Food': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    assert.ok(!result.error, 'Should return a result');
    assert.strictEqual(result.diets[0].diet[0].Food_Name, 'T4_Food', 'Should choose Tier 4 food');
});

test('Balance Filtering: Balanced Good vs Unbalanced Delicious', async (t) => {
    // T4_Balanced_Good: Variance 0. Taste 3.
    // T4_Unbalanced_Delicious: Variance high. Taste 5.
    // Expect: T4_Balanced_Good because balanced is prioritized filter.

    const foods = [
        { Food_Name: 'Balanced_Good', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 4 },
        { Food_Name: 'Unbalanced_Delicious', Carbs: 100, Fat: 0, Protein: 0, Vitamins: 0, Official_Calories_Game: 500, Tier: 4 }
    ];
    setFoodData(foods);

    const prefs = {
        'Balanced_Good': { status: FOOD_STATUS_KEYS.GOOD },
        'Unbalanced_Delicious': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    // Balance score for 25,25,25,25 is 0.
    // Balance score for 100,0,0,0 is > 15.

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'Balanced_Good', 'Should choose Balanced Good over Unbalanced Delicious');
});

test('Taste Sorting: Two Balanced diets, pick tastier', async (t) => {
    const foods = [
        { Food_Name: 'Balanced_Good', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 4 },
        { Food_Name: 'Balanced_Delicious', Carbs: 25, Fat: 25, Protein: 25, Vitamins: 25, Official_Calories_Game: 500, Tier: 4 }
    ];
    setFoodData(foods);

    const prefs = {
        'Balanced_Good': { status: FOOD_STATUS_KEYS.GOOD },
        'Balanced_Delicious': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    assert.strictEqual(bestDiet.diet[0].Food_Name, 'Balanced_Delicious', 'Should choose Delicious over Good when both balanced');
});

test('Fallback: Only Unbalanced available, pick best balance', async (t) => {
    // Unbalanced_Bad: Variance VERY high.
    // Unbalanced_Better: Variance high but better.

    const foods = [
        { Food_Name: 'Unbalanced_Bad', Carbs: 100, Fat: 0, Protein: 0, Vitamins: 0, Official_Calories_Game: 500, Tier: 4 }, // Score ~43
        { Food_Name: 'Unbalanced_Better', Carbs: 50, Fat: 50, Protein: 0, Vitamins: 0, Official_Calories_Game: 500, Tier: 4 } // Score ~25 (still > 15)
    ];
    setFoodData(foods);

    const prefs = {
        'Unbalanced_Bad': { status: FOOD_STATUS_KEYS.DELICIOUS },
        'Unbalanced_Better': { status: FOOD_STATUS_KEYS.DELICIOUS }
    };
    setUserPreferences(prefs);

    const result = getSuggestedDiets();
    const bestDiet = result.diets[0];

    // Both are > 15 variance. So fallback sort by score (asc) should pick Unbalanced_Better.
    assert.strictEqual(bestDiet.diet[0].Food_Name, 'Unbalanced_Better', 'Should choose Better Balance in fallback');
});

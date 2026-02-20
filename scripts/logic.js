import { FOOD_STATUS_KEYS } from "./constants.js";
import {
  getFoodData,
  getUserPreferences,
  getStomachSize,
  getWorstFood,
} from "./state.js";

export function calculateDietScore(totals) {
  const totalSum = totals.Carbs + totals.Fat + totals.Protein + totals.Vitamins;
  if (totalSum === 0) return Infinity;
  const percentages = [
    (totals.Carbs / totalSum) * 100,
    (totals.Fat / totalSum) * 100,
    (totals.Protein / totalSum) * 100,
    (totals.Vitamins / totalSum) * 100,
  ];
  const variance =
    percentages.reduce((sum, val) => sum + Math.pow(val - 25, 2), 0) / 4;
  return Math.sqrt(variance);
}

export function calculateBalanceModifier(totals) {
  const score = calculateDietScore(totals);
  let modifier = 2.0 - score * 0.03;
  return `${Math.max(0.5, Math.min(2.0, modifier)).toFixed(2)}x`;
}

export function getSuggestedDiets() {
  const foodData = getFoodData();
  const userPreferences = getUserPreferences();
  const stomachSize = getStomachSize();
  const worstFood = getWorstFood();

  // Step 1: Filter Available and Acceptable Foods
  const availableFoods = foodData.filter((item) => {
    const name = item.Food_Name;
    const prefs = userPreferences[name];

    // Exclusion Rules (Taste Filter)
    if (!prefs) return false;

    // Exclude if the player removed it, hasn't evaluated it, or rated it poorly
    if (
      prefs.status === FOOD_STATUS_KEYS.REMOVE_FROM_LIST ||
      prefs.status === FOOD_STATUS_KEYS.SELECT_STATUS ||
      prefs.status === FOOD_STATUS_KEYS.BAD ||
      prefs.status === FOOD_STATUS_KEYS.HORRIBLE ||
      name === worstFood
    ) {
      return false;
    }

    // Exclude if food calories exceed current stomach size
    if (item.Official_Calories_Game > stomachSize) {
      return false;
    }

    return true;
  });

  if (availableFoods.length === 0) {
    return { error: "NO_SUITABLE_FOODS" };
  }

  // Step 2: Optimization via Combination Search
  let bestDiets = [];
  const MAX_ITEMS_TYPES = 6;
  const MAX_ITERATIONS = 5000;

  const generateRandomDiet = () => {
    let diet = [];
    let currentCalories = 0;
    const uniqueFoodCount = Math.min(
      availableFoods.length,
      2 + Math.floor(Math.random() * (MAX_ITEMS_TYPES - 1))
    );
    const foodsToDrawFrom = [];

    // Prefer non-raw foods when selecting available types
    // Split foods into raw and cooked using the Is_Raw property from the JSON
    const rawFoods = availableFoods.filter(f => f.Is_Raw);
    const cookedFoods = availableFoods.filter(f => !f.Is_Raw);

    // Bias selection: Try to pick from cooked foods first.
    // Only pick raw foods if we need more variety than cooked foods can offer,
    // or with a low probability to allow for optimal solutions where raw is needed.

    while (foodsToDrawFrom.length < uniqueFoodCount) {
      let pool = cookedFoods;
      // If we ran out of cooked foods, or 10% chance, allow raw foods
      if (cookedFoods.length === 0 || (rawFoods.length > 0 && Math.random() < 0.1)) {
           pool = availableFoods;
      }

      if (pool.length === 0) break; // Should not happen given checks above

      const randomIndex = Math.floor(Math.random() * pool.length);
      const food = pool[randomIndex];
      if (!foodsToDrawFrom.includes(food)) foodsToDrawFrom.push(food);
    }

    let availableDraws = [...foodsToDrawFrom];
    let attemptLimit = 100;

    while (
      currentCalories < stomachSize &&
      availableDraws.length > 0 &&
      attemptLimit > 0
    ) {
      const foodIndex = Math.floor(Math.random() * availableDraws.length);
      const foodToRepeat = availableDraws[foodIndex];

      if (
        currentCalories + foodToRepeat.Official_Calories_Game <=
        stomachSize
      ) {
        diet.push(foodToRepeat);
        currentCalories += foodToRepeat.Official_Calories_Game;
      } else {
        availableDraws.splice(foodIndex, 1);
      }
      attemptLimit--;
    }
    return diet;
  };

  const analyzeDiet = (diet) => {
    let totals = {
      Carbs: 0,
      Fat: 0,
      Protein: 0,
      Vitamins: 0,
      TotalCalories: 0,
    };
    if (diet.length === 0) return { score: Infinity, totals: totals };

    diet.forEach((food) => {
      totals.Carbs += food.Carbs;
      totals.Fat += food.Fat;
      totals.Protein += food.Protein;
      totals.Vitamins += food.Vitamins;
      totals.TotalCalories += food.Official_Calories_Game;
    });

    return { diet, score: calculateDietScore(totals), totals };
  };

  const resultsMap = new Map();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const diet = generateRandomDiet();
    if (diet.length < 2) continue;

    const uniqueFoodCounts = diet.reduce((acc, food) => {
      acc[food.Food_Name] = (acc[food.Food_Name] || 0) + 1;
      return acc;
    }, {});

    const dietKey = Object.keys(uniqueFoodCounts)
      .sort()
      .map((name) => `${name}:${uniqueFoodCounts[name]}`)
      .join("|");

    if (!resultsMap.has(dietKey)) {
      const analysis = analyzeDiet(diet);
      resultsMap.set(dietKey, analysis);
      bestDiets.push(analysis);
    }
  }

  // Sort by Balance Score primarily, then by Raw Food Penalty, then by Total Calories
  bestDiets.sort((a, b) => {
    const scoreDiff = Math.abs(a.score - b.score);
    if (scoreDiff > 0.05) {
        return a.score - b.score;
    }

    // Secondary Sort: Avoid Raw Foods
    const countRaw = (diet) => diet.diet.filter(f => f.Is_Raw).length;
    const rawA = countRaw(a);
    const rawB = countRaw(b);

    if (rawA !== rawB) {
        return rawA - rawB; // Fewer raw foods is better
    }

    // Tertiary Sort: Higher Calories
    return b.totals.TotalCalories - a.totals.TotalCalories;
  });

  const top3Diets = bestDiets.slice(0, 3);

  if (top3Diets.length === 0) {
    return { error: "NO_COMBINATION_FOUND" };
  }

  return { diets: top3Diets };
}

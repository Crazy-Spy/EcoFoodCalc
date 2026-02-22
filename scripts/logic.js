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

  // --- Optimization Logic ---

  // NOTE: Tier filtering removed. We use ALL available foods to maximize Balance probability.

  let bestDiets = [];
  const MAX_ITEMS_TYPES = 6;
  const MAX_ITERATIONS = 5000;

  const generateRandomDiet = () => {
    let diet = [];
    let currentCalories = 0;

    // Sample from entire pool
    const uniqueFoodCount = Math.min(
      availableFoods.length,
      2 + Math.floor(Math.random() * (MAX_ITEMS_TYPES - 1))
    );
    const foodsToDrawFrom = [];

    while (foodsToDrawFrom.length < uniqueFoodCount) {
      const randomIndex = Math.floor(Math.random() * availableFoods.length);
      const food = availableFoods[randomIndex];
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

  const getTasteValue = (foodName) => {
    const status = userPreferences[foodName]?.status;
    if (status === FOOD_STATUS_KEYS.DELICIOUS) return 3;
    if (status === FOOD_STATUS_KEYS.GOOD) return 2;
    if (status === FOOD_STATUS_KEYS.OK) return 1;
    return 0;
  };

  // Quality Score Calculation
  // Formula: (Tier * 16) + (Taste * 10) + (Level * 1)
  const getQualityScore = (food) => {
      const tier = food.Tier || 0;
      const level = food.Level || 0;
      const taste = getTasteValue(food.Food_Name);

      return (tier * 16) + (taste * 10) + (level * 1);
  };

  const analyzeDiet = (diet) => {
    let totals = {
      Carbs: 0,
      Fat: 0,
      Protein: 0,
      Vitamins: 0,
      TotalCalories: 0,
    };
    if (diet.length === 0) return { score: Infinity, qualityScore: 0, totals: totals };

    let totalQuality = 0;

    diet.forEach((food) => {
      totals.Carbs += food.Carbs;
      totals.Fat += food.Fat;
      totals.Protein += food.Protein;
      totals.Vitamins += food.Vitamins;
      totals.TotalCalories += food.Official_Calories_Game;
      totalQuality += getQualityScore(food);
    });

    return {
        diet,
        score: calculateDietScore(totals),
        qualityScore: totalQuality / diet.length,
        totals
    };
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

  // --- Sorting Strategy ---
  // Priority 1: Balance Score (Variance) - Lower is better.
  // Priority 2: Quality Score - Higher is better.
  // We use a threshold for Balance. If the difference is negligible, we pick the higher Quality.

  bestDiets.sort((a, b) => {
      const balanceDiff = Math.abs(a.score - b.score);

      // If variance difference is less than 1.0, considered "equal" balance-wise.
      // Use Quality as tie-breaker.
      if (balanceDiff < 1.0) {
          return b.qualityScore - a.qualityScore;
      }

      // Otherwise strict Balance sort
      return a.score - b.score;
  });

  const top3Diets = bestDiets.slice(0, 3);

  if (top3Diets.length === 0) {
    return { error: "NO_COMBINATION_FOUND" };
  }

  return { diets: top3Diets };
}

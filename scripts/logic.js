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

  // Step 2: Prioritize by Tier
  // Find the highest available Tier
  const maxTier = Math.max(...availableFoods.map((f) => f.Tier || 0));

  // Filter foods to only include those from the highest Tier
  const tierFoods = availableFoods.filter((f) => (f.Tier || 0) === maxTier);

  // Step 3: Optimization via Combination Search
  let bestDiets = [];
  const MAX_ITEMS_TYPES = 6;
  const MAX_ITERATIONS = 5000;

  const generateRandomDiet = () => {
    let diet = [];
    let currentCalories = 0;
    // Use tierFoods instead of availableFoods
    const uniqueFoodCount = Math.min(
      tierFoods.length,
      2 + Math.floor(Math.random() * (MAX_ITEMS_TYPES - 1))
    );
    const foodsToDrawFrom = [];

    while (foodsToDrawFrom.length < uniqueFoodCount) {
      const randomIndex = Math.floor(Math.random() * tierFoods.length);
      const food = tierFoods[randomIndex];
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

  const getTasteScore = (foodName) => {
    const status = userPreferences[foodName]?.status;
    if (status === FOOD_STATUS_KEYS.DELICIOUS) return 5;
    if (status === FOOD_STATUS_KEYS.GOOD) return 3;
    if (status === FOOD_STATUS_KEYS.OK) return 2;
    return 1; // Fallback, though filters prevent this
  };

  const analyzeDiet = (diet) => {
    let totals = {
      Carbs: 0,
      Fat: 0,
      Protein: 0,
      Vitamins: 0,
      TotalCalories: 0,
    };
    if (diet.length === 0) return { score: Infinity, tasteScore: 0, totals: totals };

    let totalTaste = 0;

    diet.forEach((food) => {
      totals.Carbs += food.Carbs;
      totals.Fat += food.Fat;
      totals.Protein += food.Protein;
      totals.Vitamins += food.Vitamins;
      totals.TotalCalories += food.Official_Calories_Game;
      totalTaste += getTasteScore(food.Food_Name);
    });

    return {
        diet,
        score: calculateDietScore(totals),
        tasteScore: totalTaste / diet.length,
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

  // Step 4: Selection Logic
  // Filter for Good Balance (Variance Score < 15)
  const balancedDiets = bestDiets.filter(d => d.score < 15);

  let finalSelection = [];

  if (balancedDiets.length > 0) {
      // If balanced diets exist, sort by Taste Score (Descending)
      // Secondary sort: Balance Score (Ascending) for ties
      balancedDiets.sort((a, b) => {
          if (Math.abs(b.tasteScore - a.tasteScore) > 0.01) return b.tasteScore - a.tasteScore;
          return a.score - b.score;
      });
      finalSelection = balancedDiets;
  } else {
      // Fallback: If no balanced diets, take ALL diets and sort by Balance Score (Ascending)
      bestDiets.sort((a, b) => a.score - b.score);
      finalSelection = bestDiets;
  }

  const top3Diets = finalSelection.slice(0, 3);

  if (top3Diets.length === 0) {
    return { error: "NO_COMBINATION_FOUND" };
  }

  return { diets: top3Diets };
}

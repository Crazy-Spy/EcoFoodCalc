import {
  FOOD_SOURCE_URL,
  FOOD_STATUS_KEYS,
  COLUMN_MAPPING,
  FAVORITE_KEY,
  WORST_KEY,
  SORT_COLUMN_KEY,
  SORT_ORDER_KEY,
  LAST_STATUS_KEY,
} from "./constants.js";

import {
  getFoodData,
  setFoodData,
  getUserPreferences,
  setUserPreferences,
  getStomachSize,
  setStomachSize,
  getMealQuantity,
  setMealQuantity,
  getFavoriteFood,
  setFavoriteFood,
  getWorstFood,
  setWorstFood,
  getLastSelectedStatus,
  setLastSelectedStatus,
  getLastDietResult,
  setLastDietResult,
  getCurrentSortColumn,
  setCurrentSortColumn,
  getCurrentSortOrder,
  setCurrentSortOrder,
} from "./state.js";

import {
  loadUserPreferences,
  loadStomachSize,
  loadMealQuantity,
  loadGlobalTags,
  loadUIState,
  saveUserPreferences,
  saveStomachSize,
  saveMealQuantity,
  saveGlobalTag,
  saveLastSelectedStatus,
  checkVersionUpgrade,
} from "./storage.js";

import { getSuggestedDiets } from "./logic.js";

import {
  renderDietControls,
  renderSuggestedDiet,
  renderSearchInterface,
  renderEvaluatedTableComponent,
  generateSelectHtml,
  updateSessionStatus,
  updateFoodContainerStatus,
  updateLastCommitDate,
} from "./view.js";

import { processImage, parseOCRText } from "./ocr.js";
import { findBestMatch } from "./utils.js";

// --- Controller Functions ---

export async function handleScreenshotUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await processImage(file);
    if (!text) {
      alert("Could not read text from image.");
      updateSessionStatus("Failed to read image.");
      return;
    }

    const results = parseOCRText(text);
    if (results.length === 0) {
      alert("No recognizable food preferences found in the image.");
      updateSessionStatus("No preferences found.");
      return;
    }

    const foodData = getFoodData();
    const foodNames = foodData.map((f) => f.Food_Name);
    const userPreferences = getUserPreferences();
    let updatedCount = 0;
    let unknownCount = 0;
    let unknownFoods = [];

    // Reset sort to show latest updates
    setCurrentSortColumn("ORDER_PRIORITY");
    setCurrentSortOrder("desc");
    localStorage.setItem(SORT_COLUMN_KEY, "ORDER_PRIORITY");
    localStorage.setItem(SORT_ORDER_KEY, "desc");

    results.forEach((item) => {
      // Fuzzy match
      const bestMatch = findBestMatch(item.foodName, foodNames);

      if (bestMatch) {
        const foodName = bestMatch.match;

        // Handle Favorite/Worst tags
        if (item.isFavorite) {
          setFavoriteFood(foodName);
          saveGlobalTag(FAVORITE_KEY, foodName);
        } else if (item.isWorst) {
          setWorstFood(foodName);
          saveGlobalTag(WORST_KEY, foodName);
        } else {
          // Update status if different
          if (!userPreferences[foodName] || userPreferences[foodName].status !== item.status) {
            if (!userPreferences[foodName]) {
                 userPreferences[foodName] = {};
            }
            userPreferences[foodName].status = item.status;
            userPreferences[foodName].timestamp = Date.now();
            updatedCount++;
          }
        }
      } else {
        unknownCount++;
        if (!unknownFoods.includes(item.foodName)) {
            unknownFoods.push(item.foodName);
        }
      }
    });

    if (updatedCount > 0) {
      setUserPreferences(userPreferences);
      saveUserPreferences();
      refreshUI();
    }

    let message = `Successfully updated ${updatedCount} food preferences!`;
    if (unknownCount > 0) {
      message += `\n\n${unknownCount} foods from the screenshot were not found in the database (or name mismatch):\n- ${unknownFoods
        .slice(0, 5)
        .join("\n- ")}`;
      if (unknownFoods.length > 5)
        message += `\n...and ${unknownFoods.length - 5} more.`;
    }

    alert(message);
    updateSessionStatus("Screenshot processed successfully.");
  } catch (error) {
    console.error(error);
    alert("Error processing screenshot.");
    updateSessionStatus("Error processing screenshot.");
  } finally {
    event.target.value = "";
  }
}

export function refreshUI() {
  const foodData = getFoodData();
  const userPreferences = getUserPreferences();

  const evaluatedFoods = foodData.filter(
    (item) =>
      userPreferences[item.Food_Name]?.status !==
      FOOD_STATUS_KEYS.REMOVE_FROM_LIST
  );
  const unevaluatedFoods = foodData.filter(
    (item) =>
      !userPreferences[item.Food_Name] ||
      userPreferences[item.Food_Name].status ===
        FOOD_STATUS_KEYS.REMOVE_FROM_LIST
  );

  // 1. Calculate and Render Suggested Diet
  renderDietControls();
  const dietResult = getSuggestedDiets();
  setLastDietResult(dietResult);
  renderSuggestedDiet(dietResult);

  // 2. Render Selects
  const favSelect = document.querySelector("#favorite-food");
  if (favSelect) favSelect.innerHTML = generateSelectHtml("favorite", evaluatedFoods);

  const worstSelect = document.querySelector("#worst-food");
  if (worstSelect) worstSelect.innerHTML = generateSelectHtml("worst", evaluatedFoods);

  // 3. Render Search Interface
  renderSearchInterface(unevaluatedFoods);

  // 4. Render Table
  // Check filter
  const filterElement = document.getElementById("status-filter");
  const filterValue = filterElement ? filterElement.value : "ALL";

  let foodsToShow = evaluatedFoods;
  if (filterValue !== "ALL") {
      foodsToShow = foodsToShow.filter(item => userPreferences[item.Food_Name].status === filterValue);
  }

  renderEvaluatedTableComponent(foodsToShow);
}

export function sortTable(columnName) {
  const dataKey = COLUMN_MAPPING[columnName];
  if (!dataKey) return;

  let currentSortColumn = getCurrentSortColumn();
  let currentSortOrder = getCurrentSortOrder();

  if (currentSortColumn === dataKey) {
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = dataKey;
    currentSortOrder = "asc";
  }

  setCurrentSortColumn(currentSortColumn);
  setCurrentSortOrder(currentSortOrder);

  localStorage.setItem(SORT_COLUMN_KEY, currentSortColumn);
  localStorage.setItem(SORT_ORDER_KEY, currentSortOrder);

  // We can just call refreshUI, or optimize to just render table.
  // Using refreshUI for simplicity and consistency, although it recalculates diet.
  // If performance is an issue, we can just call renderEvaluatedTableComponent.
  // But wait, refreshUI does filter logic.
  // Let's replicate the filter logic or extract it.
  // For now, let's just call renderEvaluatedTableComponent with the right data.

  const foodData = getFoodData();
  const userPreferences = getUserPreferences();
  const evaluatedFoods = foodData.filter(
    (item) =>
      userPreferences[item.Food_Name]?.status !==
      FOOD_STATUS_KEYS.REMOVE_FROM_LIST
  );

  const filterElement = document.getElementById("status-filter");
  const filterValue = filterElement ? filterElement.value : "ALL";
  let foodsToShow = evaluatedFoods;
  if (filterValue !== "ALL") {
      foodsToShow = foodsToShow.filter(item => userPreferences[item.Food_Name].status === filterValue);
  }

  renderEvaluatedTableComponent(foodsToShow);
}

export function updateStomachSize(newValue) {
  const size = parseInt(newValue) || 3000;
  setStomachSize(size);
  saveStomachSize();
  console.log(`Stomach size updated to ${size} kcal.`);
  refreshUI();
}

export function updateMealQuantity(newValue) {
  const qty = parseInt(newValue) || 1;
  setMealQuantity(qty);
  saveMealQuantity();

  const lastDietResult = getLastDietResult();
  if (lastDietResult) {
    renderSuggestedDiet(lastDietResult);
  } else {
    refreshUI();
  }
}

export function setGlobalTag(selectElement) {
  const tagType = selectElement.dataset.tagType;
  const foodName = selectElement.value;

  if (tagType === "favorite") {
    setFavoriteFood(foodName);
    saveGlobalTag(FAVORITE_KEY, foodName);
  } else if (tagType === "worst") {
    setWorstFood(foodName);
    saveGlobalTag(WORST_KEY, foodName);
  }

  if (!foodName) {
    if (tagType === "favorite") setFavoriteFood("");
    if (tagType === "worst") setWorstFood("");
    saveGlobalTag(tagType === "favorite" ? FAVORITE_KEY : WORST_KEY, "");
  }

  refreshUI();
  console.log(`${tagType} food set to: ${foodName}`);
}

export function updateFoodStatus(foodName, newStatus) {
  const userPreferences = getUserPreferences();
  const oldStatus = userPreferences[foodName].status;

  userPreferences[foodName].status = newStatus;
  userPreferences[foodName].timestamp = Date.now();
  setUserPreferences(userPreferences);

  const isMovingList =
    (oldStatus === FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      newStatus !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST) ||
    (oldStatus !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      newStatus === FOOD_STATUS_KEYS.REMOVE_FROM_LIST);

  saveUserPreferences();

  if (isMovingList) {
    refreshUI();
  } else {
    const dietResult = getSuggestedDiets();
    setLastDietResult(dietResult);
    renderSuggestedDiet(dietResult);

    // Also re-render table to update selects and order if sorted by priority
    // Ideally we should just refresh table
     const foodData = getFoodData();
    const evaluatedFoods = foodData.filter(
        (item) =>
        userPreferences[item.Food_Name]?.status !==
        FOOD_STATUS_KEYS.REMOVE_FROM_LIST
    );
    const filterElement = document.getElementById("status-filter");
    const filterValue = filterElement ? filterElement.value : "ALL";
    let foodsToShow = evaluatedFoods;
    if (filterValue !== "ALL") {
        foodsToShow = foodsToShow.filter(item => userPreferences[item.Food_Name].status === filterValue);
    }
    renderEvaluatedTableComponent(foodsToShow);
  }
}

export function removeItemFromPreferences(foodName) {
  const userPreferences = getUserPreferences();
  userPreferences[foodName] = {
    status: FOOD_STATUS_KEYS.REMOVE_FROM_LIST,
    timestamp: 0,
  };
  setUserPreferences(userPreferences);
  saveUserPreferences();
  refreshUI();
}

export function addFoodToEvaluatedList(event) {
  event.preventDefault();
  const foodName = document.getElementById("food").value.trim();
  const foodData = getFoodData();
  const userPreferences = getUserPreferences();

  const itemKey = foodData.find(
    (item) => item.Food_Name === foodName
  )?.Food_Name;

  if (
    !itemKey ||
    userPreferences[itemKey].status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST
  ) {
    alert(`Food "${foodName}" not found or already evaluated.`);
    return;
  }

  const selectedStatus = document.getElementById("food-status").value;

  if (
    selectedStatus === FOOD_STATUS_KEYS.SELECT_STATUS ||
    selectedStatus === FOOD_STATUS_KEYS.REMOVE_FROM_LIST
  ) {
    alert(
      "Please select a valid rating (Delicious, Good, Ok, etc.) before adding the food."
    );
    return;
  }

  setCurrentSortColumn("ORDER_PRIORITY");
  setCurrentSortOrder("desc");
  localStorage.setItem(SORT_COLUMN_KEY, "ORDER_PRIORITY");
  localStorage.setItem(SORT_ORDER_KEY, "desc");

  userPreferences[itemKey].status = selectedStatus;
  userPreferences[itemKey].timestamp = Date.now();
  setUserPreferences(userPreferences);

  saveLastSelectedStatus(selectedStatus);
  saveUserPreferences();
  refreshUI();

  document.getElementById("food").value = "";
}

export function handleFilterChange() {
    // Just re-render table part
    const foodData = getFoodData();
    const userPreferences = getUserPreferences();
    const evaluatedFoods = foodData.filter(
        (item) =>
        userPreferences[item.Food_Name]?.status !==
        FOOD_STATUS_KEYS.REMOVE_FROM_LIST
    );
    const filterElement = document.getElementById("status-filter");
    const filterValue = filterElement ? filterElement.value : "ALL";
    let foodsToShow = evaluatedFoods;
    if (filterValue !== "ALL") {
        foodsToShow = foodsToShow.filter(item => userPreferences[item.Food_Name].status === filterValue);
    }
    renderEvaluatedTableComponent(foodsToShow);
}

// --- Init ---

export async function initApp() {
  checkVersionUpgrade();
  updateSessionStatus("Checking preferences...");

  try {
    const response = await fetch(FOOD_SOURCE_URL);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    setFoodData(data);

    const msg = loadUserPreferences();
    if(msg) updateSessionStatus(msg);

    loadStomachSize();
    loadMealQuantity();
    loadGlobalTags();
    loadUIState();

    // Update Input Fields from State
    const stomachSizeInput = document.getElementById("stomach-size-input");
    if (stomachSizeInput) stomachSizeInput.value = getStomachSize();

    // mealQuantityInput is handled by renderDietControls inside refreshUI

    refreshUI();
    updateFoodContainerStatus("");

  } catch (error) {
    console.error("Error starting app:", error);
    updateFoodContainerStatus(`<p style="color: red;">Error loading data.</p>`);
    updateSessionStatus("Failed to start session.");
  }

  fetchLastCommitDate();
}

async function fetchLastCommitDate() {
  try {
    const response = await fetch(`https://api.github.com/repos/Crazy-Spy/EcoFoodCalc/commits/main`);
    const data = await response.json();
    updateLastCommitDate(new Date(data.commit.author.date).toLocaleDateString("pt-BR"));
  } catch (e) {
      updateLastCommitDate("N/A");
  }
}

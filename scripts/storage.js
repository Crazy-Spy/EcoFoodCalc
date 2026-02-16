import {
  DATA_STORAGE_KEY,
  STOMACH_SIZE_KEY,
  FAVORITE_KEY,
  WORST_KEY,
  LAST_STATUS_KEY,
  SORT_COLUMN_KEY,
  SORT_ORDER_KEY,
  EXPORT_VERSION,
  CURRENT_VERSION,
  VERSION_STORAGE_KEY,
  FOOD_STATUS_KEYS,
} from "./constants.js";

import {
  getFoodData,
  getUserPreferences,
  setUserPreferences,
  getStomachSize,
  setStomachSize,
  getFavoriteFood,
  setFavoriteFood,
  getWorstFood,
  setWorstFood,
  getLastSelectedStatus,
  setLastSelectedStatus,
  getCurrentSortColumn,
  setCurrentSortColumn,
  getCurrentSortOrder,
  setCurrentSortOrder,
} from "./state.js";

export function saveUserPreferences() {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(getUserPreferences()));
}

export function saveGlobalTag(key, val) {
  localStorage.setItem(key, val);
}

export function saveStomachSize() {
  localStorage.setItem(STOMACH_SIZE_KEY, getStomachSize());
}

export function saveLastSelectedStatus(status) {
  localStorage.setItem(LAST_STATUS_KEY, status);
  setLastSelectedStatus(status);
}

export function loadUserPreferences() {
  const storedData = localStorage.getItem(DATA_STORAGE_KEY);
  let preferences = {};

  if (storedData) {
    preferences = JSON.parse(storedData);

    // Check for missing timestamps in old data
    let needsSave = false;
    for (const name in preferences) {
      if (
        preferences[name].status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
        preferences[name].timestamp === undefined
      ) {
        preferences[name].timestamp = Date.now();
        needsSave = true;
      }
    }
    setUserPreferences(preferences);
    if (needsSave) saveUserPreferences();
    return "Preferences loaded.";
  } else {
    // Initialize new session
    const foodData = getFoodData();
    foodData.forEach((item) => {
      preferences[item.Food_Name] = {
        status: FOOD_STATUS_KEYS.REMOVE_FROM_LIST,
        timestamp: 0,
      };
    });
    setUserPreferences(preferences);
    saveUserPreferences();
    return "New session initialized.";
  }
}

export function loadStomachSize() {
  const size = parseInt(localStorage.getItem(STOMACH_SIZE_KEY)) || 3000;
  setStomachSize(size);
}

export function loadGlobalTags() {
  setFavoriteFood(localStorage.getItem(FAVORITE_KEY) || "");
  setWorstFood(localStorage.getItem(WORST_KEY) || "");
}

export function loadUIState() {
  setLastSelectedStatus(localStorage.getItem(LAST_STATUS_KEY) || FOOD_STATUS_KEYS.DELICIOUS);
  setCurrentSortColumn(localStorage.getItem(SORT_COLUMN_KEY) || "ORDER_PRIORITY");
  setCurrentSortOrder(localStorage.getItem(SORT_ORDER_KEY) || "desc");
}

export function checkVersionUpgrade() {
  const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (lastSeenVersion !== CURRENT_VERSION) {
    const msg =
      "🚀 ECO FOODCALC UPGRADE!\n\n" +
      "I've updated the food database to use proper names with spaces. " +
      "To ensure everything works perfectly, I STRONGLY recommend clicking 'RESET DATA'.\n\n" +
      "Using the app without resetting is not recommended and has NOT been tested. " +
      "Proceed at your own risk!\n\n" +
      "Click OK to acknowledge. This message won't appear again until the next major update.";

    alert(msg);

    localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_VERSION);
  }
}

export function resetPreferences() {
  if (
    confirm(
      "Are you sure you want to delete ALL saved preferences (food status, tags, and stomach size)? This action cannot be undone."
    )
  ) {
    localStorage.removeItem(DATA_STORAGE_KEY);
    localStorage.removeItem(STOMACH_SIZE_KEY);
    localStorage.removeItem(FAVORITE_KEY);
    localStorage.removeItem(WORST_KEY);
    localStorage.removeItem(LAST_STATUS_KEY);
    localStorage.removeItem(SORT_COLUMN_KEY);
    localStorage.removeItem(SORT_ORDER_KEY);
    localStorage.removeItem("last-commit-date");
    localStorage.removeItem("last-commit-etag");

    window.location.reload();
  }
}

export function exportUserData() {
  const exportData = {
    version: EXPORT_VERSION,
    timestamp: new Date().toISOString(),
    preferences: localStorage.getItem(DATA_STORAGE_KEY),
    stomachSize: localStorage.getItem(STOMACH_SIZE_KEY),
    favoriteFood: localStorage.getItem(FAVORITE_KEY),
    worstFood: localStorage.getItem(WORST_KEY),
    lastSelectedStatus: localStorage.getItem(LAST_STATUS_KEY),
    sortColumn: localStorage.getItem(SORT_COLUMN_KEY),
    sortOrder: localStorage.getItem(SORT_ORDER_KEY),
  };

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `EcoFoodCalc_Data_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function importUserData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const importedData = JSON.parse(event.target.result);
      if (!importedData.preferences) throw new Error("Invalid format");

      localStorage.setItem(DATA_STORAGE_KEY, importedData.preferences);
      if (importedData.stomachSize)
        localStorage.setItem(STOMACH_SIZE_KEY, importedData.stomachSize);
      if (importedData.favoriteFood)
        localStorage.setItem(FAVORITE_KEY, importedData.favoriteFood);
      if (importedData.worstFood)
        localStorage.setItem(WORST_KEY, importedData.worstFood);

      alert("Data imported successfully!");
      window.location.reload();
    } catch (e) {
      alert("Error importing file.");
    }
  };
  reader.readAsText(file);
}

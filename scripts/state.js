import { FOOD_STATUS_KEYS } from "./constants.js";

let foodData = [];
let userPreferences = {};
let stomachSize = 3000;
let mealQuantity = 1;
let favoriteFood = "";
let worstFood = "";
let lastSelectedStatus = FOOD_STATUS_KEYS.DELICIOUS;
let currentSortColumn = "ORDER_PRIORITY";
let currentSortOrder = "desc";
let lastDietResult = null;

export const getFoodData = () => foodData;
export const setFoodData = (data) => { foodData = data; };

export const getUserPreferences = () => userPreferences;
export const setUserPreferences = (prefs) => { userPreferences = prefs; };

export const getStomachSize = () => stomachSize;
export const setStomachSize = (size) => { stomachSize = size; };

export const getMealQuantity = () => mealQuantity;
export const setMealQuantity = (qty) => { mealQuantity = qty; };

export const getFavoriteFood = () => favoriteFood;
export const setFavoriteFood = (food) => { favoriteFood = food; };

export const getWorstFood = () => worstFood;
export const setWorstFood = (food) => { worstFood = food; };

export const getLastSelectedStatus = () => lastSelectedStatus;
export const setLastSelectedStatus = (status) => { lastSelectedStatus = status; };

export const getCurrentSortColumn = () => currentSortColumn;
export const setCurrentSortColumn = (col) => { currentSortColumn = col; };

export const getCurrentSortOrder = () => currentSortOrder;
export const setCurrentSortOrder = (order) => { currentSortOrder = order; };

export const getLastDietResult = () => lastDietResult;
export const setLastDietResult = (result) => { lastDietResult = result; };

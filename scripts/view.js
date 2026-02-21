import {
  FOOD_STATUS_KEYS,
  PIE_COLORS,
  COLUMN_MAPPING,
  SORTABLE_COLUMNS,
  STATUS_OPTIONS,
} from "./constants.js";

import {
  getUserPreferences,
  getMealQuantity,
  getFavoriteFood,
  getWorstFood,
  getLastSelectedStatus,
  getCurrentSortColumn,
  getCurrentSortOrder,
  getStomachSize,
} from "./state.js";

import { calculateBalanceModifier } from "./logic.js";

// --- HTML Generators ---

function renderNutrientDistribution(dietAnalysis) {
  const totalNutrients =
    dietAnalysis.totals.Carbs +
    dietAnalysis.totals.Fat +
    dietAnalysis.totals.Protein +
    dietAnalysis.totals.Vitamins;

  if (totalNutrients === 0) return "";

  const analysis = {
    Carbs: (dietAnalysis.totals.Carbs / totalNutrients) * 100,
    Protein: (dietAnalysis.totals.Protein / totalNutrients) * 100,
    Fat: (dietAnalysis.totals.Fat / totalNutrients) * 100,
    Vitamins: (dietAnalysis.totals.Vitamins / totalNutrients) * 100,
  };

  const data = [
    { label: "Carbs", percent: analysis.Carbs, color: PIE_COLORS.Carbs },
    { label: "Protein", percent: analysis.Protein, color: PIE_COLORS.Protein },
    { label: "Fat", percent: analysis.Fat, color: PIE_COLORS.Fat },
    {
      label: "Vitamins",
      percent: analysis.Vitamins,
      color: PIE_COLORS.Vitamins,
    },
  ];

  const balanceModifier = calculateBalanceModifier(dietAnalysis.totals);
  let currentAngle = 0;
  let gradientStops = data.map((slice) => {
    const start = currentAngle;
    currentAngle += (slice.percent / 100) * 360;
    return `${slice.color} ${start.toFixed(1)}deg ${currentAngle.toFixed(1)}deg`;
  });

  return `
     <div class="nutrient-distribution-container">
         <h5 class="balance-modifier">
             Balance Modifier: <span class="balance-modifier-value">${balanceModifier}</span>
         </h5>
         <p class="nutrient-title">Nutrients (Goal: 25% each):</p>
         <div class="nutrient-chart" style="background: conic-gradient(${gradientStops.join(
           ", "
         )})"></div>
         <div>
             <ul class="nutrient-list">
                 ${data
                   .map((slice) => {
                     const isUnbalanced =
                       slice.percent > 28 || slice.percent < 22;
                     const colorStyle = `color: ${
                       isUnbalanced ? "#f44336" : "#4CAF50"
                     };`;
                     return `<li>
                        <span style="display: inline-block; width: 10px; height: 10px; background-color: ${
                          slice.color
                        }; margin-right: 4px;"></span>
                        <div class="nutrient-item">
                          <span class="nutrient-label" style="${colorStyle}">${
                       slice.label
                     }:</span>
                          <span class="nutrient-percentage" style="${colorStyle}">${slice.percent.toFixed(
                       1
                     )}%</span>
                        </div>
                    </li>`;
                   })
                   .join("")}
             </ul>
         </div>
     </div>`;
}

function renderDietOption(dietAnalysis, optionNumber) {
  const isOptimal = optionNumber === 1;
  const title = isOptimal
    ? `Optimal Meal (Best Balance):`
    : `Option ${optionNumber}`;
  const itemClass = isOptimal ? "optimal-diet-box" : "alternative-diet-box";
  const userPreferences = getUserPreferences();
  const mealQuantity = getMealQuantity() || 1;

  // Group repeated foods
  const foodCounts = dietAnalysis.diet.reduce((acc, food) => {
    const key = food.Food_Name;
    if (!acc[key]) acc[key] = { count: 0, food: food };
    acc[key].count++;
    return acc;
  }, {});

  const foods = Object.values(foodCounts);

  // 1. Eat List (Per Meal)
  const eatListHtml = foods
    .map((item) => {
      const perMeal = item.count;
      const status = userPreferences[item.food.Food_Name]?.status || "Unknown";
      return `<li><strong>${perMeal}x</strong> ${item.food.Food_Name} - <span class="u-bold">${status}</span></li>`;
    })
    .join("");

  // 2. Shopping List (Total)
  const shopListHtml = foods
    .map((item) => {
      const totalBatch = item.count * mealQuantity;
      return `<li><strong>${totalBatch}x</strong> ${item.food.Food_Name}</li>`;
    })
    .join("");

  let recommendedTag = isOptimal
    ? `<span class="recommended-tag"><i class="ph-fill ph-star icon"></i>Recommended</span>`
    : "";

  return `
     <div class="${itemClass} diet-option-box">
        <div class="diet-option-header">
         <h4 class="diet-option-title">${title}</h4>
         ${recommendedTag}
        </div>
         <div class="diet-option-content">
             <div class="diet-option-food-container">
                <div class='diet-option-metadata'>
                  <p class='total-calories'>Total Diet Calories: ${
                    dietAnalysis.totals.TotalCalories
                  } Kcal</p>
                  <p class='balance-score'>Balance Score: ${dietAnalysis.score.toFixed(
                    2
                  )}</p>
                 </div>

                 <div class="diet-cards-container">
                    <!-- EAT CARD -->
                    <div class="diet-card eat-card">
                        <h5>Eat<br>(Per Meal)</h5>
                        <ul>
                            ${eatListHtml}
                        </ul>
                    </div>
                    <!-- SHOPPING CARD -->
                    <div class="diet-card shop-card">
                        <h5>Shopping List<br>(For ${mealQuantity} Meals)</h5>
                        <ul>
                            ${shopListHtml}
                        </ul>
                    </div>
                 </div>

             </div>
             ${renderNutrientDistribution(dietAnalysis)}
         </div>
     </div>`;
}

function renderEvaluatedTable(foods) {
  const currentSortColumn = getCurrentSortColumn();
  const currentSortOrder = getCurrentSortOrder();
  const userPreferences = getUserPreferences();
  const favoriteFood = getFavoriteFood();
  const worstFood = getWorstFood();

  if (foods.length === 0) {
    return "<p>No foods evaluated yet. Use the search field above to add your first item!</p>";
  }

  // --- SORTING LOGIC ---
  foods.sort((a, b) => {
    const key = currentSortColumn;
    const timeA = userPreferences[a.Food_Name]?.timestamp || 0;
    const timeB = userPreferences[b.Food_Name]?.timestamp || 0;
    if (key === "ORDER_PRIORITY") return timeB - timeA;
    const valA = a[key],
      valB = b[key];
    let comp =
      typeof valA === "number"
        ? valA - valB
        : String(valA).localeCompare(String(valB));
    return currentSortOrder === "asc" ? comp : -comp;
  });

  // --- TABLE RENDERING WITH DESIGN CLASSES ---
  let tableHtml = '<table class="food-table">'; // Use food-table instead of food-list
  tableHtml += "<thead><tr>";

  const headers = [
    "Food Name",
    "Carbs",
    "Fat",
    "Protein",
    "Vitamins",
    "Calories (Game)",
  ];

  headers.forEach((headerName) => {
    const dataKey = COLUMN_MAPPING[headerName];
    const isSortable = SORTABLE_COLUMNS.includes(headerName);

    if (!isSortable) {
      tableHtml += `<th class="no-sort"><div class="th-content">${headerName}</div></th>`;
      return;
    }

    const isSorted = dataKey === currentSortColumn;
    const icon = isSorted
      ? currentSortOrder === "asc"
        ? "<i class='ph ph-arrow-up sort-icon'></i>"
        : "<i class='ph ph-arrow-down sort-icon'></i>"
      : "<i class='ph ph-arrows-down-up sort-icon'></i>";
    const sortedClass = isSorted ? `sorted-${currentSortOrder}` : "";

    tableHtml += `<th onclick="window.sortTable('${headerName}')" class="${sortedClass}">
    <div class="th-content">${headerName}${icon}</div></th>`;
  });

  tableHtml +=
    '<th class="no-sort"><div class="th-content">Status</div></th>';
  tableHtml +=
    '<th class="no-sort"><div class="th-content"></div></th></tr></thead><tbody>';

  foods.forEach((item) => {
    const name = item.Food_Name;
    const prefs = userPreferences[name];
    const isFavorite = name === favoriteFood;
    const isWorst = name === worstFood;

    // Apply highlighting classes (row-favorite, row-worst, row-attention)
    let rowClass = "";
    if (isFavorite) rowClass = "row-favorite";
    else if (isWorst) rowClass = "row-worst";
    else if (prefs.status === FOOD_STATUS_KEYS.SELECT_STATUS)
      rowClass = "row-attention";

    tableHtml += `<tr class="${rowClass}">
         <td>${name}</td>
         <td>${item.Carbs}</td>
         <td>${item.Fat}</td>
         <td>${item.Protein}</td>
         <td>${item.Vitamins}</td>
         <td>${item.Official_Calories_Game}</td>
         <td>
             <select class="status-select" onchange="window.updateFoodStatus('${name}', this.value)">
                 ${STATUS_OPTIONS.filter(
                   (s) =>
                     s !== FOOD_STATUS_KEYS.SELECT_STATUS &&
                     s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST
                 )
                   .map(
                     (s) =>
                       `<option value="${s}" ${
                         s === prefs.status ? "selected" : ""
                       }>${s}</option>`
                   )
                   .join("")}
             </select>
         </td>
         <td>
             <button onclick="window.removeItemFromPreferences('${name}')" class="button button-danger">
                 <i class="ph ph-trash icon"></i>Remove
             </button>
         </td>
     </tr>`;
  });

  tableHtml += "</tbody></table>";
  return tableHtml;
}

export function generateSelectHtml(tagType, foods) {
  const currentValue = tagType === "favorite" ? getFavoriteFood() : getWorstFood();
  const options = foods
    .map(
      (item) =>
        `<option value="${item.Food_Name}" ${
          item.Food_Name === currentValue ? "selected" : ""
        }>${item.Food_Name}</option>`
    )
    .join("");
  return `<option value="">--- Select ---</option>${options}<option value="">(None)</option>`;
}

// --- DOM Manipulation ---

export function renderDietControls() {
  const controlsContainer = document.getElementById("diet-controls-container");
  if (!controlsContainer) return;

  const mealQuantity = getMealQuantity() || 1;

  // Check if controls already exist to avoid replacing them (and losing focus)
  const existingInput = document.getElementById("meal-quantity-input");
  if (existingInput) {
      if (existingInput.value != mealQuantity) {
          existingInput.value = mealQuantity;
      }
      return;
  }

  controlsContainer.innerHTML = `
        <div class="diet-controls">
            <div class="form-group-row">
                <label for="meal-quantity-input">Number of meals:</label>
                <input
                    type="number"
                    id="meal-quantity-input"
                    value="${mealQuantity}"
                    min="1"
                    max="100"
                    onchange="window.updateMealQuantity(this.value)"
                />
                <button onclick="window.refreshUI()" class="button button-primary">
                    <i class="ph ph-arrows-clockwise icon"></i> New Diet Suggestion
                </button>
            </div>
        </div>`;
}

export function renderSuggestedDiet(result) {
  const listContainer = document.getElementById("diet-suggestion-container");
  if (!listContainer) return;

  let contentHtml = `<div class="diet-options-container">`;

  if (result.error) {
    if (result.error === "NO_SUITABLE_FOODS") {
      contentHtml += `<p style="color: red;">No suitable foods available based on your current evaluation. Please evaluate some items as GOOD, OK, or DELICIOUS.</p>`;
    } else if (result.error === "NO_COMBINATION_FOUND") {
      contentHtml += `<p style="color: red;">Could not find any diet combination that fits the stomach size limit.</p>`;
    }
  } else {
    // Render Results
    result.diets.forEach((diet, index) => {
      contentHtml += renderDietOption(diet, index + 1);
    });
  }

  contentHtml += "</div>";
  listContainer.innerHTML = contentHtml;
}

export function renderSearchInterface(foods) {
  const lastSelectedStatus = getLastSelectedStatus();
  const ratingOptions = STATUS_OPTIONS.filter(
    (s) =>
      s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      s !== FOOD_STATUS_KEYS.SELECT_STATUS
  );
  document.querySelector("#food-status").innerHTML = ratingOptions
    .map(
      (s) =>
        `<option value="${s}" ${
          s === lastSelectedStatus ? "selected" : ""
        }>${s}</option>`
    )
    .join("");
  document.querySelector("#food-datalist").innerHTML = foods
    .map((item) => `<option value="${item.Food_Name}">`)
    .join("");
}

export function renderEvaluatedTableComponent(foods) {
  const html = renderEvaluatedTable(foods);
  const foodTable = document.getElementById("food-table");
  if (foodTable) foodTable.innerHTML = html;
}

export function updateSessionStatus(message) {
  const sessionElement = document.getElementById("session-status");
  if (sessionElement) sessionElement.textContent = message;
}

export function updateFoodContainerStatus(html) {
  const foodContainerStatus = document.getElementById("food-container-status");
  if (foodContainerStatus) foodContainerStatus.innerHTML = html;
}

export function updateLastCommitDate(dateStr) {
  const dateElement = document.getElementById("last-update-date");
  if (dateElement) dateElement.textContent = dateStr;
}

export function renderImportDialog(items) {
    const dialog = document.getElementById("import-dialog");
    const tbody = document.querySelector("#import-table tbody");
    if (!dialog || !tbody) return;

    tbody.innerHTML = items.map((item, index) => {
        // Status Select
        const statusOptions = STATUS_OPTIONS.filter(s =>
            s !== FOOD_STATUS_KEYS.SELECT_STATUS &&
            s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST
        ).map(s =>
            `<option value="${s}" ${s === item.status ? "selected" : ""}>${s}</option>`
        ).join("");

        const matchedName = item.matchedName || item.originalName;
        const noMatchStyle = !item.matchedName ? "color: red; font-weight: bold;" : "";

        return `
            <tr data-index="${index}">
                <td>${item.originalName}</td>
                <td style="${noMatchStyle}">
                    <input type="text" class="matched-name-input" value="${matchedName}" />
                </td>
                <td>
                    <select class="status-input">
                        ${statusOptions}
                    </select>
                </td>
                <td>
                    <input type="checkbox" class="favorite-input" ${item.isFavorite ? "checked" : ""} />
                </td>
                <td>
                    <input type="checkbox" class="worst-input" ${item.isWorst ? "checked" : ""} />
                </td>
                <td>
                    <button class="button button-danger delete-row-btn" onclick="this.closest('tr').remove()">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    dialog.showModal();

    // Bind footer buttons
    document.getElementById("cancel-import").onclick = () => dialog.close();
    document.getElementById("confirm-import").onclick = () => window.confirmImportData(); // We will define this globally in main.js or bind it differently
}

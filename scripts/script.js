const FOOD_SOURCE_URL = "foodsource.json";

// --- VERSION CONTROL ---
const CURRENT_VERSION = "0.5"; // Versão que introduziu os nomes com espaços
const VERSION_STORAGE_KEY = "eco_app_version";

// Define ALL possible status states.
const FOOD_STATUS_KEYS = {
  REMOVE_FROM_LIST: "Remove from list",
  SELECT_STATUS: "--- SELECT STATUS ---",
  DELICIOUS: "Delicious",
  GOOD: "Good",
  OK: "Ok",
  BAD: "Bad",
  HORRIBLE: "Horrible",
};

// Cores para o Gráfico de Pizza (PADRÃO DO JOGO ECO)
const PIE_COLORS = {
  Carbs: "#d54131", // Vermelho
  Protein: "#e0983e", // Laranja/Amarelo Escuro
  Fat: "#e2bb4a", // Amarelo Ouro
  Vitamins: "#90b13e", // Verde
};

const STATUS_OPTIONS = Object.values(FOOD_STATUS_KEYS);
const DATA_STORAGE_KEY = "eco_food_preferences";
const STOMACH_SIZE_KEY = "eco_stomach_size";
const FAVORITE_KEY = "eco_favorite_food";
const WORST_KEY = "eco_worst_food";
const LAST_STATUS_KEY = "eco_last_selected_status";
const SORT_COLUMN_KEY = "eco_table_sort_column";
const SORT_ORDER_KEY = "eco_table_sort_order";
const EXPORT_VERSION = "1.1";

// Global variables
let foodData = [];
let userPreferences = {};
let stomachSize = 3000;
let favoriteFood = "";
let worstFood = "";
let lastSelectedStatus = FOOD_STATUS_KEYS.DELICIOUS;
let currentSortColumn = "ORDER_PRIORITY";
let currentSortOrder = "desc";
let mealQuantity = 1;

// Elementos da UI (variáveis para serem usadas em várias funções)
let sessionElement;
let foodContainer;
let foodContainerStatus;
let columnRightContainer;
let dietSuggestionContainer;

// Mapeamento de cabeçalhos de coluna para chaves do JSON
const COLUMN_MAPPING = {
  "Food Name": "Food_Name",
  Carbs: "Carbs",
  Fat: "Fat",
  Protein: "Protein",
  Vitamins: "Vitamins",
  "Calories (Game)": "Official_Calories_Game",
  ORDER_PRIORITY: "timestamp", // Chave virtual para a ordenação de UX
};

// Nomes das colunas que podem ser ordenadas (excluindo Food Name e Status)
const SORTABLE_COLUMNS = [
  "Carbs",
  "Fat",
  "Protein",
  "Vitamins",
  "Calories (Game)",
];

// --- GLOBAL FUNCTIONS (Must be defined first for HTML onclicks) ---

/**
 * Clears all saved data (preferences and stomach size) and reloads the app.
 */
function resetPreferences() {
  if (
    confirm(
      "Are you sure you want to delete ALL saved preferences (food status, tags, and stomach size)? This action cannot be undone.",
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

    // Recarrega o app para iniciar do zero
    window.location.reload();
  }
}

/**
 * Atualiza o estado de ordenação da tabela e salva no localStorage.
 */
function sortTable(columnName) {
  const dataKey = COLUMN_MAPPING[columnName];
  if (!dataKey) return;

  if (currentSortColumn === dataKey) {
    // Se for a mesma coluna, inverte a ordem
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
  } else {
    // Se for uma nova coluna, define a coluna e reseta a ordem para 'asc'
    currentSortColumn = dataKey;
    currentSortOrder = "asc";
  }

  // Salva as novas preferências de ordenação
  localStorage.setItem(SORT_COLUMN_KEY, currentSortColumn);
  localStorage.setItem(SORT_ORDER_KEY, currentSortOrder);

  // Re-renderiza APENAS a tabela com a nova ordem.
  renderEvaluatedTableComponent();
}

/**
 * Updates the stomach size variable and saves it.
 */
function updateStomachSize(newValue) {
  stomachSize = parseInt(newValue) || 3000;
  saveStomachSize();
  console.log(`Stomach size updated to ${stomachSize} kcal.`);
  renderFoodLists(); // Re-render para atualizar a sugestão
}

function updateMealQuantity(newValue) {
    mealQuantity = parseInt(newValue) || 1;
    renderFoodLists(); // Re-renderiza para atualizar os números na dieta sugerida
}

/**
 * Sets a new Favorite or Worst food and re-renders the list.
 */
function setGlobalTag(selectElement) {
  const tagType = selectElement.dataset.tagType;
  const foodName = selectElement.value;

  if (tagType === "favorite") {
    favoriteFood = foodName;
    saveGlobalTag(FAVORITE_KEY, foodName);
  } else if (tagType === "worst") {
    worstFood = foodName;
    saveGlobalTag(WORST_KEY, foodName);
  }

  // Limpa a tag se a opção "--- Select ---" ou "(None)" for escolhida
  if (!foodName) {
    if (tagType === "favorite") favoriteFood = "";
    if (tagType === "worst") worstFood = "";
    saveGlobalTag(tagType === "favorite" ? FAVORITE_KEY : WORST_KEY, "");
  }

  // Re-renderizar para atualizar as cores e a outra lista de tags e a dieta
  renderFoodLists();
  console.log(`${tagType} food set to: ${foodName}`);
}

/**
 * Updates the status (Delicious, Good, etc.) for a food item and re-renders if needed.
 */
function updateFoodStatus(foodName, newStatus) {
  const oldStatus = userPreferences[foodName].status;
  userPreferences[foodName].status = newStatus;

  // Atualiza o timestamp ao mudar o status (isso re-ordena o item para o topo)
  userPreferences[foodName].timestamp = Date.now();

  // Apenas re-renderiza TUDO se o item entrar ou sair da lista principal
  const isMovingList =
    (oldStatus === FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      newStatus !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST) ||
    (oldStatus !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      newStatus === FOOD_STATUS_KEYS.REMOVE_FROM_LIST);

  saveUserPreferences();

  if (isMovingList) {
    renderFoodLists();
  } else {
    // Se o item não saiu da lista, apenas recalcula a dieta e re-renderiza a tabela
    calculateSuggestedDiet();
    renderEvaluatedTableComponent();
  }
}

function removeItemFromPreferences(foodName) {
  userPreferences[foodName] = {
    status: FOOD_STATUS_KEYS.REMOVE_FROM_LIST,
    timestamp: 0,
  };
  saveUserPreferences();
  renderFoodLists();
}

/**
 * Saves the last selected status to localStorage.
 */
function saveLastSelectedStatus(status) {
  localStorage.setItem(LAST_STATUS_KEY, status);
  lastSelectedStatus = status;
}

/**
 * Adds a selected food from the search box to the evaluated list by updating its status.
 */
function addFoodToEvaluatedList(event) {
  event.preventDefault();
  const foodName = document.getElementById("food").value.trim();
  // Encontra o item (case sensitive) e garante que ele existe e ainda não foi avaliado
  const itemKey = foodData.find(
    (item) => item.Food_Name === foodName,
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
      "Please select a valid rating (Delicious, Good, Ok, etc.) before adding the food.",
    );
    return;
  }

  // Define a coluna de ordenação como ORDER_PRIORITY para que o novo item vá para o topo
  currentSortColumn = "ORDER_PRIORITY";
  currentSortOrder = "desc";
  localStorage.setItem(SORT_COLUMN_KEY, currentSortColumn);
  localStorage.setItem(SORT_ORDER_KEY, currentSortOrder);

  // Adiciona o timestamp (garante que ele vá para o topo, mesmo com ordenação de coluna)
  userPreferences[itemKey].status = selectedStatus;
  userPreferences[itemKey].timestamp = Date.now();

  // Salva o status recém-selecionado para persistência na próxima busca
  saveLastSelectedStatus(selectedStatus);

  // Salva e re-renderiza as duas listas
  saveUserPreferences();
  renderFoodLists();

  document.getElementById("food").value = ""; // Limpa a caixa de busca
}

// --- NOVIDADE: EXPORTAR E IMPORTAR DADOS ---

function exportUserData() {
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

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `EcoFoodCalc_Data_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function importUserData() {
  const fileInput = document.getElementById("import-file-input");
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const importedData = JSON.parse(event.target.result);
      if (!importedData.preferences) throw new Error("Invalid format");
      
      localStorage.setItem(DATA_STORAGE_KEY, importedData.preferences);
      if (importedData.stomachSize) localStorage.setItem(STOMACH_SIZE_KEY, importedData.stomachSize);
      if (importedData.favoriteFood) localStorage.setItem(FAVORITE_KEY, importedData.favoriteFood);
      if (importedData.worstFood) localStorage.setItem(WORST_KEY, importedData.worstFood);

      alert("Data imported successfully!");
      window.location.reload();
    } catch (e) {
      alert("Error importing file.");
    }
  };
  reader.readAsText(file);
}

// --- Algorithmic Core ---

function calculateDietScore(totals) {
  const totalSum = totals.Carbs + totals.Fat + totals.Protein + totals.Vitamins;
  if (totalSum === 0) return Infinity;
  const percentages = [(totals.Carbs / totalSum) * 100, (totals.Fat / totalSum) * 100, (totals.Protein / totalSum) * 100, (totals.Vitamins / totalSum) * 100];
  const variance = percentages.reduce((sum, val) => sum + Math.pow(val - 25, 2), 0) / 4;
  return Math.sqrt(variance);
}

function calculateBalanceModifier(analysis) {
  const score = calculateDietScore(analysis);
  let modifier = 2.0 - score * 0.03;
  return `${Math.max(0.5, Math.min(2.0, modifier)).toFixed(2)}x`;
}

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
    { label: "Vitamins", percent: analysis.Vitamins, color: PIE_COLORS.Vitamins },
  ];

  const balanceModifier = calculateBalanceModifier(dietAnalysis.totals);
  let currentAngle = 0;
  let gradientStops = data.map(slice => {
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
         <div class="nutrient-chart" style="background: conic-gradient(${gradientStops.join(", ")})"></div>
         <div>
             <ul class="nutrient-list">
                 ${data.map(slice => {
                    const isUnbalanced = slice.percent > 28 || slice.percent < 22;
                    const colorStyle = `color: ${isUnbalanced ? "#f44336" : "#4CAF50"};`;
                    return `<li>
                        <span style="display: inline-block; width: 10px; height: 10px; background-color: ${slice.color}; margin-right: 4px;"></span>
                        <div class="nutrient-item">
                          <span class="nutrient-label" style="${colorStyle}">${slice.label}:</span>
                          <span class="nutrient-percentage" style="${colorStyle}">${slice.percent.toFixed(1)}%</span>
                        </div>
                    </li>`;
                 }).join("")}
             </ul>
         </div>
     </div>`;
}
function renderDietOption(dietAnalysis, optionNumber) {
  const isOptimal = optionNumber === 1;
  const title = isOptimal ? `Optimal Meal (Best Balance):` : `Option ${optionNumber}`;
  const itemClass = isOptimal ? "optimal-diet-box" : "alternative-diet-box";

  // Agrupa os alimentos repetidos para o visual de tags do design
  const foodCounts = dietAnalysis.diet.reduce((acc, food) => {
    const key = food.Food_Name;
    if (!acc[key]) acc[key] = { count: 0, food: food };
    acc[key].count++;
    return acc;
  }, {});

  // Aqui está o pulo do gato: multiplicamos o item.count pela quantidade de refeições desejada
  const foodListHtml = Object.values(foodCounts).map(item => {
    const totalQuantity = item.count * (typeof mealQuantity !== 'undefined' ? mealQuantity : 1);
    
    return `
    <li class='food-tag'>
        <div class='food-tag-name'>${totalQuantity}x ${item.food.Food_Name}</div>
        <div class='food-tag-calories'>Calories: <span class="food-tag-calories-value">${item.food.Official_Calories_Game} Kcal</span></div>
        <div class='food-tag-status'>Status: <span class="food-tag-status-value">${userPreferences[item.food.Food_Name]?.status}</span></div>
    </li>`;
  }).join("");

  let recommendedTag = isOptimal ? `<span class="recommended-tag"><i class="ph-fill ph-star icon"></i>Recommended</span>` : "";

  return `
     <div class="${itemClass} diet-option-box">
        <div class="diet-option-header">
         <h4 class="diet-option-title">${title}</h4>
         ${recommendedTag}
        </div>
         <div class="diet-option-content">
             <div class="diet-option-food-container">
                <div class='diet-option-metadata'>
                  <p class='total-calories'>Total Diet Calories: ${dietAnalysis.totals.TotalCalories} Kcal</p>
                  <p class='balance-score'>Balance Score: ${dietAnalysis.score.toFixed(2)}</p>
                 </div>
                 <ul class='food-tags'>
                     ${foodListHtml}
                 </ul>
             </div>
             ${renderNutrientDistribution(dietAnalysis)}
         </div>
     </div>`;
}

function calculateSuggestedDiet() {
  const listContainer = dietSuggestionContainer;

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

  // Render the header with Goal Calories exactly as the UI design
  let finalHtml = `<p class="calorie-goal">Goal Calories: <strong>${stomachSize} Kcal</strong></p><div class="diet-options-container">`;

  if (availableFoods.length === 0) {
    listContainer.innerHTML = finalHtml + `<p style="color: red;">No suitable foods available based on your current evaluation. Please evaluate some items as GOOD, OK, or DELICIOUS.</p></div>`;
    return;
  }

  // Step 2: Optimization via Combination Search
  let bestDiets = [];
  const MAX_ITEMS_TYPES = 6; 
  const MAX_ITERATIONS = 5000;

  const generateRandomDiet = () => {
    let diet = [];
    let currentCalories = 0;
    const uniqueFoodCount = Math.min(availableFoods.length, 2 + Math.floor(Math.random() * (MAX_ITEMS_TYPES - 1)));
    const foodsToDrawFrom = [];

    while (foodsToDrawFrom.length < uniqueFoodCount) {
      const randomIndex = Math.floor(Math.random() * availableFoods.length);
      const food = availableFoods[randomIndex];
      if (!foodsToDrawFrom.includes(food)) foodsToDrawFrom.push(food);
    }

    let availableDraws = [...foodsToDrawFrom];
    let attemptLimit = 100;

    while (currentCalories < stomachSize && availableDraws.length > 0 && attemptLimit > 0) {
      const foodIndex = Math.floor(Math.random() * availableDraws.length);
      const foodToRepeat = availableDraws[foodIndex];

      if (currentCalories + foodToRepeat.Official_Calories_Game <= stomachSize) {
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
    let totals = { Carbs: 0, Fat: 0, Protein: 0, Vitamins: 0, TotalCalories: 0 };
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

    const dietKey = Object.keys(uniqueFoodCounts).sort().map((name) => `${name}:${uniqueFoodCounts[name]}`).join("|");

    if (!resultsMap.has(dietKey)) {
      const analysis = analyzeDiet(diet);
      resultsMap.set(dietKey, analysis);
      bestDiets.push(analysis);
    }
  }

  // Sort by Balance Score primarily, then by Total Calories
  bestDiets.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.05) return a.score - b.score;
    return b.totals.TotalCalories - a.totals.TotalCalories;
  });

  const top3Diets = bestDiets.slice(0, 3);

  if (top3Diets.length === 0) {
    listContainer.innerHTML = finalHtml + `<p style="color: red;">Could not find any diet combination that fits the stomach size limit.</p></div>`;
    return;
  }

  // Step 3: Render Results
  top3Diets.forEach((diet, index) => {
    finalHtml += renderDietOption(diet, index + 1);
  });

  finalHtml += "</div>";
  listContainer.innerHTML = finalHtml;
}

// --- Core Functions ---
function checkVersionUpgrade() {
  const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  // Se a versão gravada for diferente da atual (ou não existir)
  if (lastSeenVersion !== CURRENT_VERSION) {
    const msg = "🚀 ECO FOODCALC UPGRADE!\n\n" +
                "I've updated the food database to use proper names with spaces. " +
                "To ensure everything works perfectly, I STRONGLY recommend clicking 'RESET DATA'.\n\n" +
                "Using the app without resetting is not recommended and has NOT been tested. " +
                "Proceed at your own risk!\n\n" +
                "Click OK to acknowledge. This message won't appear again until the next major update.";

    alert(msg);
    
    // Grava que o usuário já viu este aviso desta versão
    localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_VERSION);
  }
}
async function initApp() {
  checkVersionUpgrade();
  sessionElement = document.getElementById("session-status");
  foodContainerStatus = document.getElementById("food-container-status");
  dietSuggestionContainer = document.getElementById("diet-suggestion-container");

  if (sessionElement) sessionElement.textContent = "Checking preferences...";

  try {
    // 1. Load the JSON file
    const response = await fetch(FOOD_SOURCE_URL);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    foodData = await response.json();

    // 2. Load preferences and update session status
    loadUserPreferences(); // Essa função internamente já define o texto do sessionElement
    loadStomachSize();
    loadGlobalTags();

    // Load UI persistent states
    lastSelectedStatus = localStorage.getItem(LAST_STATUS_KEY) || FOOD_STATUS_KEYS.DELICIOUS;
    currentSortColumn = localStorage.getItem(SORT_COLUMN_KEY) || "ORDER_PRIORITY";
    currentSortOrder = localStorage.getItem(SORT_ORDER_KEY) || "desc";

    // 3. Render initial lists
    renderFoodLists();
    if (foodContainerStatus) foodContainerStatus.innerHTML = ""; 
    
  } catch (error) {
    console.error("Error starting app:", error);
    if (foodContainerStatus) foodContainerStatus.innerHTML = `<p style="color: red;">Error loading data.</p>`;
    if (sessionElement) sessionElement.textContent = "Failed to start session.";
  }

  // 4. Fetch the last commit date
  fetchLastCommitDate();
}
function renderFoodLists() {
  const evaluatedFoods = foodData.filter(item => userPreferences[item.Food_Name]?.status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST);
  const unevaluatedFoods = foodData.filter(item => !userPreferences[item.Food_Name] || userPreferences[item.Food_Name].status === FOOD_STATUS_KEYS.REMOVE_FROM_LIST);

  calculateSuggestedDiet();

  document.querySelector("#favorite-food").innerHTML = generateSelectHtml("favorite", evaluatedFoods);
  document.querySelector("#worst-food").innerHTML = generateSelectHtml("worst", evaluatedFoods);

  renderSearchInterface(unevaluatedFoods);
  renderEvaluatedTableComponent(evaluatedFoods);
}

// --- FUNÇÃO COM A LOGICA DE FILTRO INJETADA ---
function renderEvaluatedTableComponent(foodsOverride) {
  // Pega o valor do filtro no HTML (se não existir, assume ALL)
  const filterElement = document.getElementById("status-filter");
  const filterValue = filterElement ? filterElement.value : "ALL";

  let foods = foodsOverride || foodData.filter((item) => {
      const prefs = userPreferences[item.Food_Name];
      return prefs && prefs.status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST;
  });

  // Filtra pelo status se o usuário selecionou algo específico
  if (filterValue !== "ALL") {
    foods = foods.filter(item => userPreferences[item.Food_Name].status === filterValue);
  }

  const html = renderEvaluatedTable(foods);
  const foodTable = document.getElementById("food-table");
  if (foodTable) foodTable.innerHTML = html;
}

/**
 * Renders the table for foods with all UX/UI styles restored.
 */
function renderEvaluatedTable(foods) {
  if (foods.length === 0) {
    return "<p>No foods evaluated yet. Use the search field above to add your first item!</p>";
  }

  // --- SORTING LOGIC ---
  foods.sort((a, b) => {
    const key = currentSortColumn;
    const timeA = userPreferences[a.Food_Name]?.timestamp || 0;
    const timeB = userPreferences[b.Food_Name]?.timestamp || 0;
    if (key === "ORDER_PRIORITY") return timeB - timeA;
    const valA = a[key], valB = b[key];
    let comp = typeof valA === "number" ? valA - valB : String(valA).localeCompare(String(valB));
    return currentSortOrder === "asc" ? comp : -comp;
  });

  // --- TABLE RENDERING WITH DESIGN CLASSES ---
  let tableHtml = '<table class="food-table">'; // Use food-table instead of food-list
  tableHtml += "<thead><tr>";

  const headers = ["Food Name", "Carbs", "Fat", "Protein", "Vitamins", "Calories (Game)"];

  headers.forEach((headerName) => {
    const dataKey = COLUMN_MAPPING[headerName];
    const isSortable = SORTABLE_COLUMNS.includes(headerName);

    if (!isSortable) {
      tableHtml += `<th class="no-sort"><div class="th-content">${headerName}</div></th>`;
      return;
    }

    const isSorted = dataKey === currentSortColumn;
    const icon = isSorted
      ? (currentSortOrder === "asc" ? "<i class='ph ph-arrow-up sort-icon'></i>" : "<i class='ph ph-arrow-down sort-icon'></i>")
      : "<i class='ph ph-arrows-down-up sort-icon'></i>";
    const sortedClass = isSorted ? `sorted-${currentSortOrder}` : "";

    tableHtml += `<th onclick="sortTable('${headerName}')" class="${sortedClass}">
    <div class="th-content">${headerName}${icon}</div></th>`;
  });

  tableHtml += '<th class="no-sort"><div class="th-content">Status</div></th>';
  tableHtml += '<th class="no-sort"><div class="th-content"></div></th></tr></thead><tbody>';

  foods.forEach((item) => {
    const name = item.Food_Name;
    const prefs = userPreferences[name];
    const isFavorite = name === favoriteFood;
    const isWorst = name === worstFood;

    // Apply highlighting classes (row-favorite, row-worst, row-attention)
    let rowClass = "";
    if (isFavorite) rowClass = "row-favorite";
    else if (isWorst) rowClass = "row-worst";
    else if (prefs.status === FOOD_STATUS_KEYS.SELECT_STATUS) rowClass = "row-attention";

    tableHtml += `<tr class="${rowClass}">
         <td>${name}</td>
         <td>${item.Carbs}</td>
         <td>${item.Fat}</td>
         <td>${item.Protein}</td>
         <td>${item.Vitamins}</td>
         <td>${item.Official_Calories_Game}</td>
         <td>
             <select class="status-select" onchange="updateFoodStatus('${name}', this.value)">
                 ${STATUS_OPTIONS.filter(s => s !== FOOD_STATUS_KEYS.SELECT_STATUS && s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST)
                   .map(s => `<option value="${s}" ${s === prefs.status ? "selected" : ""}>${s}</option>`).join("")}
             </select>
         </td>
         <td>
             <button onclick="removeItemFromPreferences('${name}')" class="button button-danger">
                 <i class="ph ph-trash icon"></i>Remove
             </button>
         </td>
     </tr>`;
  });

  tableHtml += "</tbody></table>";
  return tableHtml;
}

function generateSelectHtml(tagType, foods) {
  const currentValue = tagType === "favorite" ? favoriteFood : worstFood;
  const options = foods.map(item => `<option value="${item.Food_Name}" ${item.Food_Name === currentValue ? "selected" : ""}>${item.Food_Name}</option>`).join("");
  return `<option value="">--- Select ---</option>${options}<option value="">(None)</option>`;
}

function renderSearchInterface(foods) {
  const ratingOptions = STATUS_OPTIONS.filter(s => s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST && s !== FOOD_STATUS_KEYS.SELECT_STATUS);
  document.querySelector("#food-status").innerHTML = ratingOptions.map(s => `<option value="${s}" ${s === lastSelectedStatus ? "selected" : ""}>${s}</option>`).join("");
  document.querySelector("#food-datalist").innerHTML = foods.map(item => `<option value="${item.Food_Name}">`).join("");
}

function loadUserPreferences() {
  const storedData = localStorage.getItem(DATA_STORAGE_KEY);

  if (storedData) {
    userPreferences = JSON.parse(storedData);
    if (sessionElement) sessionElement.textContent = "Preferences loaded.";
    
    // Check for missing timestamps in old data
    let needsSave = false;
    for (const name in userPreferences) {
      if (userPreferences[name].status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST && userPreferences[name].timestamp === undefined) {
        userPreferences[name].timestamp = Date.now();
        needsSave = true;
      }
    }
    if (needsSave) saveUserPreferences();
  } else {
    // Initialize new session
    foodData.forEach((item) => {
      userPreferences[item.Food_Name] = {
        status: FOOD_STATUS_KEYS.REMOVE_FROM_LIST,
        timestamp: 0,
      };
    });
    saveUserPreferences();
    if (sessionElement) sessionElement.textContent = "New session initialized.";
  }
}
function loadStomachSize() {
  stomachSize = parseInt(localStorage.getItem(STOMACH_SIZE_KEY)) || 3000;
  if (document.getElementById("stomach-size-input")) document.getElementById("stomach-size-input").value = stomachSize;
}

function loadGlobalTags() {
  favoriteFood = localStorage.getItem(FAVORITE_KEY) || "";
  worstFood = localStorage.getItem(WORST_KEY) || "";
}

function saveUserPreferences() { localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(userPreferences)); }
function saveGlobalTag(key, val) { localStorage.setItem(key, val); }
function saveStomachSize() { localStorage.setItem(STOMACH_SIZE_KEY, stomachSize); }

async function fetchLastCommitDate() {
  const dateElement = document.getElementById("last-update-date");
  try {
    const response = await fetch(`https://api.github.com/repos/Crazy-Spy/EcoFoodCalc/commits/main`);
    const data = await response.json();
    dateElement.textContent = new Date(data.commit.author.date).toLocaleDateString("pt-BR");
  } catch (e) { dateElement.textContent = "N/A"; }
}

document.addEventListener("DOMContentLoaded", initApp);
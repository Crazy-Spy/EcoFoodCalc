const FOOD_SOURCE_URL = "foodsource.json";

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
  const oldStatus = userPreferences[foodName].status;
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
    document.getElementById("food-search-input").value = ""; // Clear input
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

  // Salva e re-renderiza as duas listas (a comida "salta" de um para o outro)
  saveUserPreferences();
  renderFoodLists();

  document.getElementById("food").value = ""; // Limpa a caixa de busca
}

// --- NOVIDADE: EXPORTAR E IMPORTAR DADOS ---

/**
 * Prepares all user data from localStorage and triggers a JSON download.
 */
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

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `EcoFoodCalc_Data_CrazySpy_${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();

  console.log("Data exported successfully.");
}

/**
 * Reads a JSON file uploaded by the user and loads preferences into localStorage.
 */
function importUserData() {
  const fileInput = document.getElementById("import-file-input");
  const file = fileInput.files[0];

  if (!file) {
    console.log("No file selected for import.");
    return;
  }

  if (file.type !== "application/json") {
    alert("Error: Please select a valid JSON file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const importedData = JSON.parse(event.target.result);

      // Validação mínima para garantir que é o formato esperado
      if (!importedData.version || !importedData.preferences) {
        alert("Error: Invalid Eco FoodCalc data format in the file.");
        return;
      }

      // Carregar dados de volta para o localStorage
      localStorage.setItem(DATA_STORAGE_KEY, importedData.preferences);

      if (importedData.stomachSize) {
        localStorage.setItem(STOMACH_SIZE_KEY, importedData.stomachSize);
      }
      if (importedData.favoriteFood) {
        localStorage.setItem(FAVORITE_KEY, importedData.favoriteFood);
      }
      if (importedData.worstFood) {
        localStorage.setItem(WORST_KEY, importedData.worstFood);
      }
      if (importedData.lastSelectedStatus) {
        localStorage.setItem(LAST_STATUS_KEY, importedData.lastSelectedStatus);
      }
      if (importedData.sortColumn) {
        localStorage.setItem(SORT_COLUMN_KEY, importedData.sortColumn);
      }
      if (importedData.sortOrder) {
        localStorage.setItem(SORT_ORDER_KEY, importedData.sortOrder);
      }

      alert("Data imported successfully! The app will now reload.");
      window.location.reload();
    } catch (error) {
      alert(
        "Error: Could not parse the JSON file. It might be corrupted or malformed.",
      );
      console.error("Import Error:", error);
    }
  };

  reader.readAsText(file);
}

// --- Algorithmic Core (The Real Deal) ---

/**
 * Calcula o score de balanceamento da dieta (baseado no Desvio Padrão).
 * Quanto menor o score, mais equilibrada a dieta.
 */
function calculateDietScore(totals) {
  const totalSum = totals.Carbs + totals.Fat + totals.Protein + totals.Vitamins;
  if (totalSum === 0) return Infinity;

  const percentages = [
    (totals.Carbs / totalSum) * 100,
    (totals.Fat / totalSum) * 100,
    (totals.Protein / totalSum) * 100,
    (totals.Vitamins / totalSum) * 100,
  ];

  const ideal = 25;
  const variance =
    percentages.reduce((sum, val) => sum + Math.pow(val - ideal, 2), 0) / 4;
  return Math.sqrt(variance); // Score é o Desvio Padrão
}

/**
 * Calculates the Balance Modifier (0.5x to 2.0x) based on the diet score (StdDev).
 * O Desvio Padrão (Score) 50 é o pior (0.5x), Desvio 0 é o melhor (2.0x).
 */
function calculateBalanceModifier(analysis) {
  const score = calculateDietScore(analysis);
  // Regra simplificada:
  // Score 0 (perfeito) -> Modifier 2.0
  // Score 50 (pior) -> Modifier 0.5

  // Mapeamento linear: f(score) = 2.0 - (score * 0.03)
  let modifier = 2.0 - score * 0.03;
  if (modifier < 0.5) modifier = 0.5;
  if (modifier > 2.0) modifier = 2.0;

  return `${modifier.toFixed(2)}x`;
}

/**
 * Gera o HTML da distribuição de nutrientes (Nutrient Distribution)
 */
function renderNutrientDistribution(dietAnalysis) {
  const totalNutrients =
    dietAnalysis.totals.Carbs +
    dietAnalysis.totals.Fat +
    dietAnalysis.totals.Protein +
    dietAnalysis.totals.Vitamins;

  if (totalNutrients === 0) return "";

  // NOTE: Mapeamos Carbs/Protein/Fat/Vitamins para as chaves do objeto totals e cores.
  const analysis = {
    Carbs: (dietAnalysis.totals.Carbs / totalNutrients) * 100,
    Protein: (dietAnalysis.totals.Protein / totalNutrients) * 100,
    Fat: (dietAnalysis.totals.Fat / totalNutrients) * 100,
    Vitamins: (dietAnalysis.totals.Vitamins / totalNutrients) * 100,
  };

  const data = [
    {
      label: "Carbs",
      percent: analysis.Carbs,
      color: PIE_COLORS.Carbs,
      goal: 25,
    },
    {
      label: "Protein",
      percent: analysis.Protein,
      color: PIE_COLORS.Protein,
      goal: 25,
    },
    {
      label: "Fat",
      percent: analysis.Fat,
      color: PIE_COLORS.Fat,
      goal: 25,
    },
    {
      label: "Vitamins",
      percent: analysis.Vitamins,
      color: PIE_COLORS.Vitamins,
      goal: 25,
    },
  ];

  const balanceModifier = calculateBalanceModifier(analysis);

  // --- Lógica do Círculo (Conic Gradient) ---
  let currentAngle = 0;
  let gradientStops = [];

  data.forEach((slice) => {
    const angleSize = (slice.percent / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSize;

    // Define o início e fim da cor no gradiente
    gradientStops.push(
      `${slice.color} ${startAngle.toFixed(1)}deg ${endAngle.toFixed(1)}deg`,
    );

    currentAngle = endAngle;
  });

  const conicGradientStyle = `background: conic-gradient(${gradientStops.join(", ")});`;

  // --- Lógica da Lista de Porcentagens com Destaque de Cor ---

  let html = `
     <div class="nutrient-distribution-container">
         <h5 class="balance-modifier">
             Balance Modifier: <span class="balance-modifier-value">${balanceModifier}</span>
         </h5>
         <p class="nutrient-title">Nutrients (Goal: 25% each):</p>

         <div class="nutrient-chart" style="${conicGradientStyle}">
             </div>

         <div>
             <ul class="nutrient-list">
                 ${data
                   .map((slice) => {
                     // Regra de destaque: Vermelho se muito fora (22% a 28% é a margem ideal)
                     const isUnbalanced =
                       slice.percent > 28 || slice.percent < 22;
                     const colorStyle = `color: ${isUnbalanced ? "#f44336" : "#4CAF50"};`;

                     return `<li style="font-weight: ${isUnbalanced ? "bold" : "normal"};">
                         <span style="display: inline-block; width: 10px; height: 10px; background-color: ${slice.color}; margin-right: 4px;"></span>
                         <div class="nutrient-item">
                          <span class="nutrient-label" style="${colorStyle}">${slice.label}:</span>
                          <span class="nutrient-percentage" style="${colorStyle}">${slice.percent.toFixed(1)}%</span>
                         </div>
                     </li>`;
                   })
                   .join("")}
             </ul>
         </div>
     </div>
 `;
  return html;
}

/**
 * Gera o HTML completo para uma opção de dieta (lista + distribuição).
 */
function renderDietOption(dietAnalysis, optionNumber) {
  const isOptimal = optionNumber === 1;
  const title = isOptimal
    ? `Optimal Meal (Best Balance):`
    : `Option ${optionNumber}`;
  const itemClass = isOptimal ? "optimal-diet-box" : "alternative-diet-box";

  let foodListHtml = "";

  // Agrupa os alimentos repetidos para melhor visualização
  const foodCounts = dietAnalysis.diet.reduce((acc, food) => {
    const key = food.Food_Name;
    if (!acc[key]) {
      acc[key] = { count: 0, food: food };
    }
    acc[key].count++;
    return acc;
  }, {});

  for (const key in foodCounts) {
    const item = foodCounts[key];
    // 🚨 CORREÇÃO: Mostra sempre o multiplicador 1x quando a contagem é 1.
    const multiplier = `${item.count}x `;
    foodListHtml += `<li class='food-tag'><div class='food-tag-name'>${multiplier}${item.food.Food_Name}</div><div class='food-tag-calories'>Calories: <span class="food-tag-calories-value">${item.food.Official_Calories_Game} Kcal</span></div><div class='food-tag-status'>Status: <span class="food-tag-status-value">${userPreferences[item.food.Food_Name].status}</span></div></li>`;
  }
  let recommendedTag = "";
  if (isOptimal) {
    recommendedTag = `<span class="recommended-tag"><i class="ph-fill ph-star icon"></i>Recommended</span>`;
  }
  let html = `
     <div class="${itemClass} diet-option-box">
        <div class="diet-option-header">
         <h4 class="diet-option-title">${title}</h4>
         ${recommendedTag}
        </div>
         <div class="diet-option-content">
             <div class="diet-option-food-container">
                <div class='diet-option-metadata'>
                  <p class='total-calories'>Total Diet Calories: ${dietAnalysis.totals.TotalCalories} Kcal</p><p class='balance-score'>Balance Score: ${dietAnalysis.score.toFixed(2)}</p>
                 </div>
                 <ul class='food-tags'>
                     ${foodListHtml}
                 </ul>
             </div>
             ${renderNutrientDistribution(dietAnalysis)}
         </div>
     </div>
 `;
  return html;
}

/**
 * Calculates the suggested diet based on user preferences and nutrient balance.
 */
function calculateSuggestedDiet() {
  const listContainer = dietSuggestionContainer;

  // Passo 1: Filtrar Alimentos Disponíveis e Aceitáveis
  const availableFoods = foodData.filter((item) => {
    const name = item.Food_Name;
    const prefs = userPreferences[name];

    // --- Regras de Exclusão (Filtro de Gosto) ---
    if (!prefs) return false;

    // Excluir se o jogador removeu, não avaliou, ou deu nota ruim (BAD, HORRIBLE, WORST)
    if (
      prefs.status === FOOD_STATUS_KEYS.REMOVE_FROM_LIST ||
      prefs.status === FOOD_STATUS_KEYS.SELECT_STATUS ||
      prefs.status === FOOD_STATUS_KEYS.BAD ||
      prefs.status === FOOD_STATUS_KEYS.HORRIBLE ||
      name === worstFood
    ) {
      return false;
    }

    // Excluir se a caloria da comida for maior que o estômago
    if (item.Official_Calories_Game > stomachSize) {
      return false;
    }

    return true;
  });

  if (availableFoods.length === 0) {
    listContainer.innerHTML = `<p style="color: red;">Goal Calories: ${stomachSize} Kcal</p><p style="color: red;">No suitable foods available based on your current evaluation. Please evaluate some items as GOOD, OK, or DELICIOUS (and not BAD/HORRIBLE).</p>`;
    return;
  }

  // --- Passo 2: OTIMIZAÇÃO POR BUSCA DE COMBINAÇÃO (Com Repetição e Maximização Calórica) ---

  let bestDiets = [];
  const MAX_ITEMS_TYPES = 6; // Máximo de TIPOS diferentes de alimentos na dieta
  const MAX_ITERATIONS = 5000;

  /**
   * Gera uma dieta aleatória (pode ter repetição) que preenche o estômago.
   */
  const generateRandomDiet = () => {
    let diet = [];
    let currentCalories = 0;

    // 1. Seleciona aleatoriamente um POOL de alimentos (max 6 tipos diferentes)
    const uniqueFoodCount = Math.min(
      availableFoods.length,
      2 + Math.floor(Math.random() * (MAX_ITEMS_TYPES - 1)),
    );

    const foodsToDrawFrom = [];
    while (foodsToDrawFrom.length < uniqueFoodCount) {
      const randomIndex = Math.floor(Math.random() * availableFoods.length);
      const food = availableFoods[randomIndex];
      if (!foodsToDrawFrom.includes(food)) {
        foodsToDrawFrom.push(food);
      }
    }

    // 2. Tenta preencher o estômago até o limite, usando repetição
    let availableDraws = [...foodsToDrawFrom]; // Lista de itens que ainda podem ser adicionados
    let attemptLimit = 100; // Limite de tentativas para evitar loop infinito

    // Otimização: Sempre tenta adicionar o item, mas se não couber, remove ele do pool temporariamente.
    while (
      currentCalories < stomachSize &&
      availableDraws.length > 0 &&
      attemptLimit > 0
    ) {
      // Escolhe um item aleatoriamente do pool restante
      const foodIndex = Math.floor(Math.random() * availableDraws.length);
      const foodToRepeat = availableDraws[foodIndex];

      if (
        currentCalories + foodToRepeat.Official_Calories_Game <=
        stomachSize
      ) {
        diet.push(foodToRepeat);
        currentCalories += foodToRepeat.Official_Calories_Game;
        // Mantém o item no pool, permitindo a repetição
      } else {
        // Remove do pool de draws, pois não cabe mais
        availableDraws.splice(foodIndex, 1);
      }
      attemptLimit--;
    }

    return diet;
  };

  /**
   * Calcula os totais e o score de uma dieta.
   */
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

    const score = calculateDietScore(totals);

    // Retorna o resultado completo
    return { diet, score, totals };
  };

  const resultsMap = new Map();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const diet = generateRandomDiet();
    if (diet.length < 2) continue; // Ignora dietas de 0 ou 1 item

    // Cria a chave única baseada em NOME + CONTAGEM (para dietas com repetição)
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

  // 3. Ordenar as dietas pelo menor score (melhor balanceamento)

  // Critério de Ordenação OTIMIZADO:
  // Ordem Primária: Score (menor é melhor)
  // Ordem Secundária (Desempate): Total Calories (maior é melhor, pois enche mais o estômago)
  bestDiets.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.05) {
      // Diferença de Score significativa (0.05 é um bom limite)
      return a.score - b.score; // Prioriza o melhor Score
    } else {
      return b.totals.TotalCalories - a.totals.TotalCalories; // Se o Score é parecido, prioriza mais Calorias (melhor SP)
    }
  });

  // Pegar as 3 melhores
  const top3Diets = bestDiets.slice(0, 3);

  if (top3Diets.length === 0) {
    listContainer.innerHTML = `<p style="color: red;">Goal Calories: ${stomachSize} Kcal</p><p style="color: red;">Could not find any diet combination that fits the stomach size limit and preferences.</p>`;
    return;
  }

  // --- Passo 3: Renderizar Resultados ---

  let finalHtml = `<p class="calorie-goal">Goal Calories: <strong>${stomachSize} Kcal</strong></p><div class="diet-options-container">`;

  top3Diets.forEach((diet, index) => {
    finalHtml += renderDietOption(diet, index + 1);
  });
  finalHtml += "</div>";
  dietSuggestionContainer.innerHTML = finalHtml;
}

// --- Core Functions (Non-Global) ---

/**
 * Initializes the application.
 */
async function initApp() {
  sessionElement = document.getElementById("session-status");
  foodContainerStatus = document.getElementById("food-container-status");
  foodContainer = document.getElementById("food-container");
  columnRightContainer = document.getElementById("column-right");
  dietSuggestionContainer = document.getElementById(
    "diet-suggestion-container",
  );
  sessionElement.textContent = "Checking preferences...";
  foodContainerStatus.innerHTML = "Loading food data..."; // Dynamic loading message

  try {
    // 1. Load the JSON file
    const response = await fetch(FOOD_SOURCE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    foodData = await response.json();

    // 2. Load user preferences, stomach size, and global tags
    loadUserPreferences();
    loadStomachSize();
    loadGlobalTags();

    // Carrega estados persistentes de UI
    lastSelectedStatus =
      localStorage.getItem(LAST_STATUS_KEY) || FOOD_STATUS_KEYS.DELICIOUS;
    currentSortColumn =
      localStorage.getItem(SORT_COLUMN_KEY) || "ORDER_PRIORITY"; // Usar ORDER_PRIORITY como default
    currentSortOrder = localStorage.getItem(SORT_ORDER_KEY) || "desc";

    // 3. Render the two main components (Evaluated List + Search)
    renderFoodLists();
    foodContainerStatus.innerHTML = ""; // Clear loading message
  } catch (error) {
    console.error("Error loading or processing JSON:", error);
    foodContainerStatus.innerHTML = `<p style="color: red;">Error loading ${FOOD_SOURCE_URL}. Please check the file name and format.</p>`;
    sessionElement.textContent = "Failed to start session.";
  }

  // 4. Fetch the last commit date (footer/header)
  fetchLastCommitDate();
}

/**
 * Renders the two main lists: Evaluated Foods Table and Search Box.
 */
function renderFoodLists() {
  // Separa as comidas em avaliadas e não avaliadas
  const allFoods = [...foodData];
  const evaluatedFoods = allFoods.filter((item) => {
    const prefs = userPreferences[item.Food_Name];
    return prefs && prefs.status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST;
  });
  const unevaluatedFoods = allFoods.filter((item) => {
    const prefs = userPreferences[item.Food_Name];
    return !prefs || prefs.status === FOOD_STATUS_KEYS.REMOVE_FROM_LIST;
  });

  // CHAMA O ALGORITMO (Colunba Esquerda)
  calculateSuggestedDiet();

  // --- COLUNA DIREITA (Tags + Busca) ---
  document.querySelector("#favorite-food").innerHTML = generateSelectHtml(
    "favorite",
    evaluatedFoods,
  );
  document.querySelector("#worst-food").innerHTML = generateSelectHtml(
    "worst",
    evaluatedFoods,
  );

  renderSearchInterface(unevaluatedFoods);

  // --- TABELA DE AVALIADAS (Abaixo das colunas) ---
  renderEvaluatedTableComponent(evaluatedFoods);
}

/**
 * Renderiza o componente principal da tabela, separado do renderFoodLists.
 * Isso permite que a ordenação e a atualização de status a renderizem de forma independente.
 */
function renderEvaluatedTableComponent(foodsOverride) {
  // Recalcula a lista de avaliados, caso não tenha sido passada
  const foods =
    foodsOverride ||
    foodData.filter((item) => {
      const prefs = userPreferences[item.Food_Name];
      return prefs && prefs.status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST;
    });

  const html = renderEvaluatedTable(foods);
  const foodTable = document.getElementById("food-table");
  foodTable.innerHTML = html;
}

/**
 * Renders the table for foods that have an explicit status set.
 */
function renderEvaluatedTable(foods) {
  if (foods.length === 0) {
    return "<p>No foods evaluated yet. Use the search field above to add your first item!</p>";
  }

  // --- LÓGICA DE ORDENAÇÃO FINAL ---
  foods.sort((a, b) => {
    const key = currentSortColumn;
    const order = currentSortOrder;

    // Pega os timestamps para o desempate
    const timeA = userPreferences[a.Food_Name]?.timestamp || 0;
    const timeB = userPreferences[b.Food_Name]?.timestamp || 0;

    // 1. ORDENAÇÃO PRINCIPAL (Pode ser uma Coluna Numérica ou ORDER_PRIORITY/Timestamp)
    let comparison = 0;

    if (key === "ORDER_PRIORITY") {
      // Se a ordenação é a default (UX: Recém-adicionado no topo), ordena por timestamp
      comparison = timeA - timeB;
      // A ordem é sempre Decrescente para o timestamp, então invertemos.
      return -comparison;
    }

    // Se for uma coluna numérica ou alfabética (o usuário clicou)
    const valA = a[key];
    const valB = b[key];

    // Verifica o tipo de dado para a comparação (Números vs. Strings)
    if (typeof valA === "number" && typeof valB === "number") {
      comparison = valA - valB;
    } else {
      comparison = String(valA).localeCompare(String(valB));
    }

    // Aplica a ordem ASC/DESC
    let finalComparison = order === "asc" ? comparison : -comparison;

    // 2. Desempate pelo timestamp (sempre Decrescente)
    // Se a ordenação da coluna resultar em empate (0), o item mais novo sobe.
    if (finalComparison === 0) {
      return timeB - timeA;
    }
    return finalComparison;
  });

  // --- RENDERIZAÇÃO DA TABELA ---
  let tableHtml = '<table class="food-list">';
  tableHtml += "<thead><tr>";

  // Cabeçalhos
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

    // Se não for ordenável, não permite o clique
    if (!isSortable) {
      // Food Name
      tableHtml += `<th class="no-sort"><div class= "th-content">${headerName}</div></th>`;
      return;
    }

    const isSorted = dataKey === currentSortColumn;
    const icon = isSorted
      ? currentSortOrder === "asc"
        ? "<i class='ph ph-arrow-up sort-icon'></i>"
        : "<i class='ph ph-arrow-down sort-icon'></i>"
      : "<i class='ph ph-arrows-down-up sort-icon'></i>";
    const sortedClass = isSorted ? `sorted-${currentSortOrder}` : "";

    tableHtml += `<th onclick="sortTable('${headerName}')" class="${sortedClass}">
    <div class= "th-content">${headerName}${icon}</div>
     </th>`;
  });

  // Coluna Status (Não Ordenável)
  tableHtml += '<th class="no-sort"><div class= "th-content">Status</div></th>';
  tableHtml += '<th class="no-sort"><div class= "th-content"></div></th>';
  tableHtml += "</tr></thead><tbody>";

  foods.forEach((item) => {
    const name = item.Food_Name;
    const prefs = userPreferences[name];

    // Variáveis para a tag global
    const isFavorite = name === favoriteFood;
    const isWorst = name === worstFood;
    const needsAttention = prefs.status === FOOD_STATUS_KEYS.SELECT_STATUS;

    // Aplica a classe de destaque
    let rowClass = "";
    let statusCellContent;

    if (isFavorite) {
      rowClass = "row-favorite";
      statusCellContent = `<span class="status-tag favorite">★ FAVORITE</span>`;
    } else if (isWorst) {
      rowClass = "row-worst";
      statusCellContent = `<span class="status-tag worst">☠ WORST</span>`;
    } else {
      // Se não for Favorite/Worst, mostra o dropdown normal
      if (needsAttention) {
        rowClass = "row-attention";
      }
      statusCellContent = `
             <select class="status-select" onchange="updateFoodStatus('${name}', this.value)">
                 ${STATUS_OPTIONS.map((s) => {
                   // Não mostra 'Remove from list' ou '--- SELECT STATUS ---' na tabela (só no dropdown de ação)
                   if (s === FOOD_STATUS_KEYS.SELECT_STATUS) return "";
                   if (s === FOOD_STATUS_KEYS.REMOVE_FROM_LIST) return "";

                   return `<option value="${s}" ${s === prefs.status ? "selected" : ""}>${s}</option>`;
                 }).join("")}
             </select>
         `;
    }

    tableHtml += `<tr class="${rowClass}">
         <td>${name}</td>
         <td>${item.Carbs}</td>
         <td>${item.Fat}</td>
         <td>${item.Protein}</td>
         <td>${item.Vitamins}</td>
         <td>${item.Official_Calories_Game}</td>
         <td>${statusCellContent}</td>
         <td><button onclick="removeItemFromPreferences('${name}')" class="reset-button button button-danger">
             <i class="ph ph-trash icon"></i>Remove
         </button></td>
     </tr>`;
  });

  tableHtml += "</tbody></table>";
  return tableHtml;
}
const generateSelectHtml = (tagType, foods) => {
  const currentValue = tagType === "favorite" ? favoriteFood : worstFood;
  // Lista de opções, garantindo que o item CURRENTLY SELECIONADO seja marcado
  const options = foods
    .map((item) => {
      const name = item.Food_Name;
      const isSelected = name === currentValue;
      return `<option value="${name}" ${isSelected ? "selected" : ""}>${name}</option>`;
    })
    .join("");

  return `
      <option value="" ${currentValue === "" ? "selected" : ""}>--- Select ---</option>
      ${options}
      <option value="" disabled>---</option>
      <option value="">(None)</option>
   `;
};
/**
 * Renders the search/selection interface (using datalist for type-ahead search).
 */
function renderSearchInterface(foods) {
  // Filtra as opções que queremos para o dropdown de Status (excluindo Remove/Select)
  const ratingOptions = STATUS_OPTIONS.filter(
    (s) =>
      s !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
      s !== FOOD_STATUS_KEYS.SELECT_STATUS,
  );

  // Cria o HTML para o dropdown de Status
  const statusSelect = document.querySelector("#food-status");
  statusSelect.innerHTML = ratingOptions
    .map((s) => {
      const isSelected = s === lastSelectedStatus;
      const defaultLabel = s === FOOD_STATUS_KEYS.DELICIOUS ? " (Default)" : "";
      return `<option value="${s}" ${isSelected ? "selected" : ""}>${s}${defaultLabel}</option>`;
    })
    .join("");

  // Cria a lista de opções para o datalist
  const options = foods
    .map((item) => `<option value="${item.Food_Name}">`)
    .join("");
  const foodDatalist = document.querySelector("#food-datalist");
  foodDatalist.innerHTML = options;
}

// --- Core Functions (Non-Global) ---

/**
 * Loads preferences from localStorage or sets initial 'Remove from list' status.
 */
function loadUserPreferences() {
  const storedData = localStorage.getItem(DATA_STORAGE_KEY);

  if (storedData) {
    userPreferences = JSON.parse(storedData);
    sessionElement.textContent = "Preferences loaded.";

    // Adiciona timestamp a itens antigos que não têm (para garantir a ordenação)
    let needsSave = false;
    for (const name in userPreferences) {
      if (
        userPreferences[name].status !== FOOD_STATUS_KEYS.REMOVE_FROM_LIST &&
        userPreferences[name].timestamp === undefined
      ) {
        userPreferences[name].timestamp = Date.now();
        needsSave = true;
      }
    }
    if (needsSave) saveUserPreferences();
  } else {
    // Initialize preferences: every item starts as 'Remove from list'
    foodData.forEach((item) => {
      const name = item.Food_Name;
      userPreferences[name] = {
        status: FOOD_STATUS_KEYS.REMOVE_FROM_LIST,
        timestamp: 0,
      };
    });
    saveUserPreferences();
    sessionElement.textContent =
      "New session initialized (All set to Remove from list).";
  }
}

/**
 * Saves current user preferences to localStorage.
 */
function saveUserPreferences() {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(userPreferences));
}

/**
 * Loads global tags (Favorite/Worst) from localStorage.
 */
function loadGlobalTags() {
  favoriteFood = localStorage.getItem(FAVORITE_KEY) || "";
  worstFood = localStorage.getItem(WORST_KEY) || "";
}

/**
 * Saves the global favorite/worst tag to localStorage.
 */
function saveGlobalTag(tagKey, foodName) {
  localStorage.setItem(tagKey, foodName);
}

/**
 * Loads the Stomach Size from localStorage or defaults to 3000.
 */
function loadStomachSize() {
  const storedSize = localStorage.getItem(STOMACH_SIZE_KEY);
  if (storedSize) {
    stomachSize = parseInt(storedSize);
  }
  // Update the input field with the loaded/default value
  const inputElement = document.getElementById("stomach-size-input");
  if (inputElement) inputElement.value = stomachSize;
}

/**
 * Saves the Stomach Size to localStorage.
 */
function saveStomachSize() {
  localStorage.setItem(STOMACH_SIZE_KEY, stomachSize);
}

/**
 * Fetches the date of the last commit from the GitHub API.
 */
async function fetchLastCommitDate() {
  const dateElement = document.getElementById("last-update-date");
  dateElement.textContent = "fetching commit data..."; // Dynamic loading

  const repoOwner = "Crazy-Spy";
  const repoName = "EcoFoodCalc";
  const branchName = "main";
  const apiURL = `https://api.github.com/repos/${repoOwner}/${repoName}/commits/${branchName}`;

  try {
    // Check local storage for cached data (using ETag for efficiency)
    const cachedDate = localStorage.getItem("last-commit-date");
    const etag = localStorage.getItem("last-commit-etag") || "";

    const response = await fetch(apiURL, {
      headers: {
        "If-None-Match": etag,
      },
    });

    if (response.status === 304) {
      // Not Modified: use cached date
      if (cachedDate) {
        dateElement.textContent = cachedDate;
        return;
      }
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const lastCommitDate = new Date(data.commit.author.date);

    // Format: DD/MM/YYYY HH:MM (24h format)
    const formattedDate = lastCommitDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    dateElement.textContent = formattedDate;

    // Save new data to localStorage
    localStorage.setItem("last-commit-date", formattedDate);
    localStorage.setItem("last-commit-etag", response.headers.get("ETag"));
  } catch (error) {
    console.error("Failed to fetch GitHub commit date:", error);
    dateElement.textContent = "Error fetching date.";
  }
}

document.addEventListener("DOMContentLoaded", initApp);

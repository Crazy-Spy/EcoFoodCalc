export const FOOD_SOURCE_URL = "new-foodsource.json";

// --- VERSION CONTROL ---
export const CURRENT_VERSION = "0.5"; // Versão que introduziu os nomes com espaços
export const VERSION_STORAGE_KEY = "eco_app_version";

// Define ALL possible status states.
export const FOOD_STATUS_KEYS = {
  REMOVE_FROM_LIST: "Remove from list",
  SELECT_STATUS: "--- SELECT STATUS ---",
  DELICIOUS: "Delicious",
  GOOD: "Good",
  OK: "Ok",
  BAD: "Bad",
  HORRIBLE: "Horrible",
};

// Cores para o Gráfico de Pizza (PADRÃO DO JOGO ECO)
export const PIE_COLORS = {
  Carbs: "#d54131", // Vermelho
  Protein: "#e0983e", // Laranja/Amarelo Escuro
  Fat: "#e2bb4a", // Amarelo Ouro
  Vitamins: "#90b13e", // Verde
};

export const STATUS_OPTIONS = Object.values(FOOD_STATUS_KEYS);
export const DATA_STORAGE_KEY = "eco_food_preferences";
export const STOMACH_SIZE_KEY = "eco_stomach_size";
export const FAVORITE_KEY = "eco_favorite_food";
export const WORST_KEY = "eco_worst_food";
export const LAST_STATUS_KEY = "eco_last_selected_status";
export const SORT_COLUMN_KEY = "eco_table_sort_column";
export const SORT_ORDER_KEY = "eco_table_sort_order";
export const EXPORT_VERSION = "1.1";

// Mapeamento de cabeçalhos de coluna para chaves do JSON
export const COLUMN_MAPPING = {
  "Food Name": "Food_Name",
  Carbs: "Carbs",
  Fat: "Fat",
  Protein: "Protein",
  Vitamins: "Vitamins",
  "Calories (Game)": "Official_Calories_Game",
  ORDER_PRIORITY: "timestamp", // Chave virtual para a ordenação de UX
};

// Nomes das colunas que podem ser ordenadas (excluindo Food Name e Status)
export const SORTABLE_COLUMNS = [
  "Carbs",
  "Fat",
  "Protein",
  "Vitamins",
  "Calories (Game)",
];

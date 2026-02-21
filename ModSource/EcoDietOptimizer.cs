namespace Eco.Mods.TechTree
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Reflection;
    using System.IO;
    using Eco.Core.Plugins.Interfaces;
    using Eco.Gameplay.Items;
    using Eco.Gameplay.Players;
    using Eco.Gameplay.Systems.Messaging.Chat.Commands;
    using Eco.Gameplay.Systems.TextLinks;
    using Eco.Shared.Localization;
    using Eco.Shared.Math;
    using Eco.Shared.Utils;
    using Eco.Core.Utils;

    public class DietPlan
    {
        public Dictionary<string, int> Foods { get; set; } = new Dictionary<string, int>();
        public double Score { get; set; }
        public float TotalCalories { get; set; }
        public float Carbs { get; set; }
        public float Fat { get; set; }
        public float Protein { get; set; }
        public float Vitamins { get; set; }
        public float AverageTier { get; set; }
    }

    public class DietResult
    {
        public DateTime GeneratedAt { get; set; }
        public DietPlan Plan { get; set; }
    }

    [ChatCommandHandler]
    public class EcoDietOptimizer : IModKitPlugin, IInitializablePlugin
    {
        public string GetStatus() => "Active";
        public string GetCategory() => "User";

        private static string CacheFilePath = "EcoDietOptimizer_Cache.txt";
        private static string LogFilePath = "EcoDietOptimizer_Log.txt";
        private static Dictionary<string, DietResult> DietCache = new Dictionary<string, DietResult>();
        private static readonly object _lock = new object();
        private static Random rng = new Random();
        private static int CooldownMinutes = 1440;
        private static bool DebugMode = false;
        private static bool StrictMode = true;

        public void Initialize(TimedTask timer)
        {
            LoadData();
        }

        private static void Log(string message)
        {
            if (!DebugMode) return;
            try
            {
                lock(_lock)
                {
                    File.AppendAllText(LogFilePath, $"{DateTime.Now}: {message}{Environment.NewLine}");
                }
            }
            catch {}
        }

        private static void LoadData()
        {
            lock(_lock)
            {
                try
                {
                    if (File.Exists(CacheFilePath))
                    {
                        var lines = File.ReadAllLines(CacheFilePath);
                        foreach(var line in lines)
                        {
                            var parts = line.Split(new[] { ";;" }, StringSplitOptions.None);
                            if (parts.Length < 9) continue;

                            string userId = parts[0];
                            long ticks = long.Parse(parts[1]);
                            var foods = new Dictionary<string, int>();
                            foreach(var f in parts[2].Split(','))
                            {
                                var fp = f.Split(':');
                                if (fp.Length == 2) foods[fp[0]] = int.Parse(fp[1]);
                            }

                            var plan = new DietPlan
                            {
                                Foods = foods,
                                Score = double.Parse(parts[3]),
                                TotalCalories = float.Parse(parts[4]),
                                Carbs = float.Parse(parts[5]),
                                Fat = float.Parse(parts[6]),
                                Protein = float.Parse(parts[7]),
                                Vitamins = float.Parse(parts[8])
                            };

                            // Attempt to parse new fields if available, otherwise default
                            float tier = 0;
                            if (parts.Length > 9) float.TryParse(parts[9], out tier);
                            plan.AverageTier = tier;

                            DietCache[userId] = new DietResult { GeneratedAt = new DateTime(ticks), Plan = plan };
                        }
                    }
                }
                catch { }
            }
        }

        private static void SaveData()
        {
            lock(_lock)
            {
                try
                {
                    var lines = new List<string>();
                    foreach(var kvp in DietCache)
                    {
                        var r = kvp.Value;
                        var p = r.Plan;
                        string foodStr = string.Join(",", p.Foods.Select(f => $"{f.Key}:{f.Value}"));
                        lines.Add($"{kvp.Key};;{r.GeneratedAt.Ticks};;{foodStr};;{p.Score};;{p.TotalCalories};;{p.Carbs};;{p.Fat};;{p.Protein};;{p.Vitamins};;{p.AverageTier}");
                    }
                    File.WriteAllLines(CacheFilePath, lines);
                }
                catch { }
            }
        }

        [ChatCommand("Suggests an optimal diet based on your stomach size and tastes.", "diet")]
        public static void SuggestDiet(User user, string arg = "")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(arg))
                {
                    HandleDietRequest(user, 0);
                    return;
                }

                if (int.TryParse(arg, out int meals))
                {
                    HandleDietRequest(user, meals);
                    return;
                }

                switch (arg.ToLower())
                {
                    case "clear":
                        lock(_lock)
                        {
                            if (DietCache.ContainsKey(user.Name))
                            {
                                DietCache.Remove(user.Name);
                                SaveData();
                                user.Player.MsgLocStr("Diet cache cleared.");
                            }
                            else
                            {
                                user.Player.MsgLocStr("No cached diet found.");
                            }
                        }
                        break;
                    case "debug":
                        if (!user.IsAdmin) { user.Player.MsgLocStr("Permission Denied: This command is for admins only."); return; }
                        DebugMode = !DebugMode;
                        user.Player.MsgLocStr($"Debug mode is now {(DebugMode ? "ON" : "OFF")}.");
                        Log("Debug mode enabled via chat.");
                        break;
                    case "strict":
                        StrictMode = !StrictMode;
                        user.Player.MsgLocStr($"Strict Discovery Mode (Only Tasted Foods) is now {(StrictMode ? "ON" : "OFF")}.");
                        break;
                    case "probe":
                        ProbeReflection(user);
                        break;
                    case "taste":
                        ShowTasteList(user);
                        break;
                    case "help":
                        ShowHelp(user);
                        break;
                    default:
                        if (arg.StartsWith("config "))
                        {
                            if (!user.IsAdmin) { user.Player.MsgLocStr("Permission Denied: This command is for admins only."); return; }
                            var parts = arg.Split(' ');
                            if (parts.Length > 1 && int.TryParse(parts[1], out int mins))
                            {
                                CooldownMinutes = mins;
                                user.Player.MsgLocStr($"Diet cooldown set to {CooldownMinutes} minutes (Global).");
                            }
                            else
                            {
                                user.Player.MsgLocStr("Usage: /diet config <minutes>");
                            }
                        }
                        else
                        {
                            user.Player.MsgLocStr("Usage: /diet [meals | clear | strict | taste | help]");
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                user.Player.MsgLocStr($"Error: {ex.Message}");
                Log($"Error in SuggestDiet: {ex}");
            }
        }

        private static void ShowHelp(User user)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("<b>Eco Diet Optimizer</b>");
            sb.AppendLine("This mod helps you maximize your skill gain by suggesting the best balanced diet based on your stomach size and known food preferences. It prioritizes balanced nutrition (25% each of Carbs, Fat, Protein, Vitamins).");
            sb.AppendLine();
            sb.AppendLine("<b>User Commands:</b>");
            sb.AppendLine("- <b>/diet</b>: Suggests the best balanced diet for 1 meal (Uses only tasted foods by default).");
            sb.AppendLine("- <b>/diet &lt;N&gt;</b>: Generates a shopping list for N meals based on the current suggestion.");
            sb.AppendLine("- <b>/diet taste</b>: Lists your discovered foods grouped by taste preference.");
            sb.AppendLine("- <b>/diet clear</b>: Clears the currently cached diet suggestion, forcing a recalculation.");
            sb.AppendLine("- <b>/diet strict</b>: Toggles strict discovery mode (On: Only known/tasted foods. Off: Includes all foods).");
            sb.AppendLine();
            sb.AppendLine("<b>Admin Commands:</b>");
            sb.AppendLine("- <b>/diet config &lt;minutes&gt;</b>: Sets the global cooldown period for diet recalculation.");
            sb.AppendLine("- <b>/diet debug</b>: Toggles verbose logging to 'EcoDietOptimizer_Log.txt'.");

            user.Player.MsgLocStr(sb.ToString());
        }

        private static string GenerateTasteListString(User user, bool richText)
        {
            // Key: Preference (String), Value: List of Food Names
            var groupedFoods = GetGroupedFoodTypesFromTasteBuds(user);
            bool favDiscovered = IsFavoriteDiscovered(user);
            bool worstDiscovered = IsWorstDiscovered(user);

            StringBuilder sb = new StringBuilder();
            int totalCount = 0;

            // Colors
            string cFavDel = "#00ff00";
            string cGood   = "#7fff7f";
            string cOk     = "#7f7f7f";
            string cBad    = "#ff7f7f";
            string cHorr   = "#f50000";

            string ColorText(string text, string hex) => richText ? $"<color={hex}>{text}</color>" : text;
            string Bold(string text) => richText ? $"<b>{text}</b>" : text;

            // Favorite
            string favName = "Unknown";
            if (favDiscovered && groupedFoods.ContainsKey("Favorite") && groupedFoods["Favorite"].Any())
            {
                favName = groupedFoods["Favorite"].First(); // Should be item link now from helper
                totalCount += groupedFoods["Favorite"].Count;
            }
            sb.AppendLine($"{Bold(ColorText("Favorite", cFavDel))}: {favName}");

            // Worst
            string worstName = "Unknown";
            if (worstDiscovered && groupedFoods.ContainsKey("Worst") && groupedFoods["Worst"].Any())
            {
                worstName = groupedFoods["Worst"].First();
                totalCount += groupedFoods["Worst"].Count;
            }
            sb.AppendLine($"{Bold(ColorText("Worst", cHorr))}: {worstName}");

            // Group Output Helper
            void AppendGroup(string key, string colorHex)
            {
                if (groupedFoods.ContainsKey(key) && groupedFoods[key].Count > 0)
                {
                    sb.AppendLine($"--- {Bold(ColorText(key, colorHex))} ---");
                    foreach(var food in groupedFoods[key])
                    {
                        sb.AppendLine($"- {food}");
                        totalCount++;
                    }
                }
            }

            AppendGroup("Delicious", cFavDel);
            AppendGroup("Good", cGood);
            AppendGroup("Ok", cOk);
            AppendGroup("Bad", cBad);
            AppendGroup("Horrible", cHorr);

            sb.AppendLine();
            sb.AppendLine($"Total of known foods: {totalCount}");

            return sb.ToString();
        }

        private static void ShowTasteList(User user)
        {
            string result = GenerateTasteListString(user, true);
            Log(result);
            user.Player.MsgLocStr(result);
        }

        private static void HandleDietRequest(User user, int meals)
        {
            if (user == null || user.Player == null) return;

            string userId = user.Name;
            DietResult cached = null;

            lock(_lock)
            {
                if (DietCache.ContainsKey(userId))
                {
                    cached = DietCache[userId];
                }
            }

            if (cached != null)
            {
                if ((DateTime.Now - cached.GeneratedAt).TotalMinutes < CooldownMinutes)
                {
                     if (meals > 0)
                         DisplayShoppingList(user, cached.Plan, meals);
                     else
                         DisplayDiet(user, cached.Plan);

                     var remaining = TimeSpan.FromMinutes(CooldownMinutes) - (DateTime.Now - cached.GeneratedAt);
                     if (remaining.TotalMinutes < 1)
                     {
                         user.Player.MsgLocStr($"Diet updated recently. Next update in {remaining.Seconds} seconds.");
                     }
                     else
                     {
                         user.Player.MsgLocStr($"Next diet update available in {remaining.Hours}h {remaining.Minutes}m.");
                     }
                     return;
                }
            }

            if (meals > 0 && cached == null)
            {
                 user.Player.MsgLocStr("No cached diet found. Calculating new one...");
            }
            else if (meals > 0)
            {
                 user.Player.MsgLocStr("Diet cache expired. Recalculating...");
            }
            else
            {
                 // Default case: /diet with no args and no cache
                 user.Player.MsgLocStr("Calculating diet...");
            }

            DietPlan newPlan = FindBestDiet(user);

            if (newPlan != null)
            {
                lock(_lock)
                {
                    DietCache[userId] = new DietResult { GeneratedAt = DateTime.Now, Plan = newPlan };
                    SaveData();
                }

                if (meals > 0)
                    DisplayShoppingList(user, newPlan, meals);
                else
                    DisplayDiet(user, newPlan);
            }
            else
            {
                user.Player.MsgLocStr("Could not find a suitable diet. Try discovering/tasting more foods or toggling Strict Mode (/diet strict)!");
            }
        }

        private static DietPlan FindBestDiet(User user)
        {
            Log($"Starting diet calculation for {user.Name}. StrictMode: {StrictMode}");
            float stomachSize = 3000;
            try {
                var stomachProp = user.GetType().GetProperty("Stomach");
                if (stomachProp != null)
                {
                    var stomach = stomachProp.GetValue(user);
                    if (stomach != null)
                    {
                        var capProp = stomach.GetType().GetProperty("Capacity");
                        if (capProp != null) stomachSize = (float)capProp.GetValue(stomach);
                    }
                }
            } catch { }
            Log($"Stomach size: {stomachSize}");

            var availableFoods = new List<(FoodItem Item, int Tier)>();

            // Get Known Tastes (Reliable Source)
            var tasteData = GetTasteData(user);
            Log($"Taste Data Found: {tasteData.Count} items.");

            // Cold Start Fix: If tasteData is empty, the game might not have initialized TasteBuds yet.
            // We force a "touch" of the stomach contents or inventory to wake up the system.
            if (tasteData.Count == 0)
            {
                Log("TasteBuds returned 0 items. Attempting to wake up the system...");
                try {
                     var stomach = user.GetType().GetProperty("Stomach")?.GetValue(user);
                     if (stomach != null) {
                         var contents = stomach.GetType().GetProperty("Contents")?.GetValue(stomach);
                         if (contents == null) stomach.GetType().GetField("Contents")?.GetValue(stomach);
                     }
                     // Retry fetching taste data
                     tasteData = GetTasteData(user);
                     Log($"Retry Taste Data Found: {tasteData.Count} items.");
                } catch {}
            }

            // Determine exclusions based on taste
            var knownBadTypes = new HashSet<Type>();
            var knownGoodTypes = new HashSet<Type>();
            bool favDiscovered = IsFavoriteDiscovered(user);

            foreach(var t in tasteData)
            {
                if (t.Preference.Equals("Bad", StringComparison.OrdinalIgnoreCase) ||
                    t.Preference.Equals("Horrible", StringComparison.OrdinalIgnoreCase))
                {
                    knownBadTypes.Add(t.Type);
                }
                else if (t.Preference.Equals("Favorite", StringComparison.OrdinalIgnoreCase) && !favDiscovered)
                {
                    // If favorite isn't "discovered", treat it as unknown/hidden for Strict purposes?
                    // Actually, if it's in the list, the engine knows about it.
                    // But standard game logic hides the "Favorite" unless discovered.
                    knownBadTypes.Add(t.Type); // Treat as excluded for safety until discovered
                }
                else
                {
                    knownGoodTypes.Add(t.Type);
                }
            }

            void AddFoodIfValid(FoodItem food)
            {
                if (IsHiddenOrBlacklisted(food)) return;
                if (food.Calories <= 0) return;
                if (food.Calories > stomachSize) return;

                // Heuristic: Filter out raw ingredients unless requested?
                // For now, we filter things tagged as "Ingredient" or similar if possible.
                // We check the name for "Raw" as a basic heuristic.
                string name = food.DisplayName.ToString();
                if (name.StartsWith("Raw ") || name.Contains(" Yeast") || name.Contains("Flour"))
                {
                     // Could be refined by checking IsIngredient helper
                     if (IsIngredient(food)) return;
                }

                int tier = GetFoodTier(food);
                availableFoods.Add((food, tier));
            }

            if (StrictMode)
            {
                // Strict Mode: Only use known GOOD foods.
                foreach(var type in knownGoodTypes)
                {
                     try
                     {
                         var item = Item.Get(type);
                         if (item is FoodItem food) AddFoodIfValid(food);
                     } catch {}
                }
            }
            else
            {
                // Non-Strict Mode: Use ALL foods, excluding Known Bad ones.
                IEnumerable<FoodItem> allFoods = null;
                try
                {
                     allFoods = Item.AllItemsIncludingHidden.OfType<FoodItem>();
                }
                catch
                {
                     try {
                         var itemType = typeof(Item);
                         var prop = itemType.GetProperty("AllItems", BindingFlags.Public | BindingFlags.Static);
                         if (prop == null) prop = itemType.GetProperty("AllItemsIncludingHidden", BindingFlags.Public | BindingFlags.Static);

                         if (prop != null)
                         {
                             var items = prop.GetValue(null) as IEnumerable<Item>;
                             if (items != null) allFoods = items.OfType<FoodItem>();
                         }
                     } catch {}
                }

                if (allFoods != null)
                {
                    foreach(var food in allFoods)
                    {
                        if (knownBadTypes.Contains(food.Type)) continue; // Skip known bad
                        AddFoodIfValid(food);
                    }
                }
            }

            Log($"Total available foods for calculation: {availableFoods.Count}");
            if (availableFoods.Count == 0) return null;

            int MAX_ITERATIONS = 5000;
            int MAX_ITEMS_TYPES = 6;
            List<DietPlan> bestDiets = new List<DietPlan>();

            // Tier-Biased Selection
            // Instead of pure random, we create a weighted pool where high-tier items appear more often?
            // Or we sort by Tier and bias the selection towards the top.

            // Let's use a "Candidate Pool" strategy.
            // 1. Sort foods by Tier (Desc) then Calories (Desc).
            var sortedFoods = availableFoods.OrderByDescending(f => f.Tier).ThenByDescending(f => f.Item.Calories).ToList();

            // We want to favor high tiers.
            // Let's allow the randomizer to pick from the top N% more often.

            for(int i=0; i < MAX_ITERATIONS; i++)
            {
                int maxUnique = Math.Min(sortedFoods.Count, MAX_ITEMS_TYPES);
                int uniqueCount = rng.Next(Math.Min(2, maxUnique), maxUnique + 1);

                var selectedItems = new List<(FoodItem Item, int Tier)>();
                var pool = new List<(FoodItem Item, int Tier)>(sortedFoods); // Copy

                // Selection Phase: High probability to pick high-tier items
                for(int k=0; k<uniqueCount; k++)
                {
                    // Bias index towards 0 (High tier)
                    // Using a power curve: idx = floor(pool.Count * (1 - sqrt(1 - random))) ?
                    // Simple weighted random: Pick from top half 70% of time?
                    // Let's use a simple geometric distribution-ish approach
                    // Or just pick randomly from a pool that is NOT shuffled? No, need randomness.

                    int idx = 0;
                    double r = rng.NextDouble();
                    if (r < 0.5) // 50% chance to pick from top 20%
                        idx = rng.Next((int)(pool.Count * 0.2) + 1);
                    else if (r < 0.8) // 30% chance to pick from next 30%
                         idx = rng.Next((int)(pool.Count * 0.5) + 1);
                    else
                         idx = rng.Next(pool.Count);

                    if (idx >= pool.Count) idx = pool.Count - 1;

                    selectedItems.Add(pool[idx]);
                    pool.RemoveAt(idx);
                }

                float currentCals = 0;
                var dietList = new List<FoodItem>();

                // Filling Phase
                // Try to fill with the selected types.
                // We want to maximize stomach usage.

                var drawPool = new List<FoodItem>(selectedItems.Select(x => x.Item));
                int attemptLimit = 100;

                while(currentCals < stomachSize && drawPool.Count > 0 && attemptLimit > 0)
                {
                    // Prioritize adding the highest calorie/tier item from the selected set that fits?
                    // Or keep it random to allow finding combinations?
                    int idx = rng.Next(drawPool.Count);
                    var food = drawPool[idx];

                    if (currentCals + food.Calories <= stomachSize)
                    {
                        dietList.Add(food);
                        currentCals += food.Calories;
                    }
                    else
                    {
                        // If it doesn't fit, remove it from this specific fill attempt
                        // (assuming we can't fit another one of this type, which is true if all units are same size.
                        // But wait, "stomach usage" is calories.
                        // If we have 100 space left, and food is 500, we can't eat it.
                        drawPool.RemoveAt(idx);
                    }
                    attemptLimit--;
                }

                // Check if we utilized the stomach well (e.g., > 80%)
                if (currentCals < stomachSize * 0.8) continue;
                if (dietList.Count < 2) continue;

                bestDiets.Add(AnalyzeDiet(dietList));
            }

            // Sorting Final Results
            // 1. Maximize Average Tier
            // 2. Minimize Variance (Score)
            // 3. Maximize Total Calories

            var sorted = bestDiets
                .OrderByDescending(d => d.AverageTier)
                .ThenBy(d => d.Score)
                .ThenByDescending(d => d.TotalCalories)
                .ToList();

            return sorted.FirstOrDefault();
        }

        private static int GetFoodTier(FoodItem food)
        {
            try
            {
                // 1. Try Direct Property "Tier" on Item
                var tierProp = food.GetType().GetProperty("Tier");
                if (tierProp != null)
                {
                    return Convert.ToInt32(tierProp.GetValue(food));
                }

                var skillAttrs = food.GetType().GetCustomAttributes(false);
                // Eco uses RequiresSkillAttribute which might be generic or not depending on version.
                // We'll inspect via string to be safe.

                foreach(var attr in skillAttrs)
                {
                    string typeName = attr.GetType().Name;
                    if (typeName.Contains("RequiresSkill"))
                    {
                        // Try to get the skill type
                        // Usually [RequiresSkill(typeof(AdvancedCookingSkill), 1)]
                        // We need to inspect the constructor arguments or properties
                        // But reflection on attributes is tricky if we don't have the type.
                        // However, we can use `attr.ToString()`?

                        // Better approach: Look for property "SkillType" on the attribute instance
                        var skillTypeProp = attr.GetType().GetProperty("SkillItemType") ?? attr.GetType().GetProperty("SkillType");
                        if (skillTypeProp != null)
                        {
                            var skillType = skillTypeProp.GetValue(attr) as Type;
                            if (skillType != null)
                            {
                                string skillName = skillType.Name;
                                if (skillName.Contains("CuttingEdgeCooking")) return 4;
                                if (skillName.Contains("AdvancedCooking") || skillName.Contains("AdvancedBaking")) return 3;
                                if (skillName.Contains("Cooking") || skillName.Contains("Baking")) return 2;
                                if (skillName.Contains("Campfire")) return 1;
                            }
                        }
                    }
                }

                // Fallback: Check if item tags contain skill info? Unlikely.
            }
            catch {}
            return 0; // Default Tier
        }

        private static DietPlan AnalyzeDiet(List<FoodItem> diet)
        {
            if (diet.Count == 0) return new DietPlan { Score = double.MaxValue };

            float c = 0, f = 0, p = 0, v = 0, cals = 0;
            float totalTier = 0;
            var counts = new Dictionary<string, int>();

            foreach(var item in diet)
            {
                c += item.Nutrition.Carbs;
                f += item.Nutrition.Fat;
                p += item.Nutrition.Protein;
                v += item.Nutrition.Vitamins;
                cals += item.Calories;
                totalTier += GetFoodTier(item);

                string name = item.UILink(); // Use UILink for interactive chat tags
                if (!counts.ContainsKey(name)) counts[name] = 0;
                counts[name]++;
            }

            float totalNutrients = c + f + p + v;
            double score = double.MaxValue;

            if (totalNutrients > 0)
            {
                double cp = (c / totalNutrients) * 100;
                double fp = (f / totalNutrients) * 100;
                double pp = (p / totalNutrients) * 100;
                double vp = (v / totalNutrients) * 100;

                double variance = (Math.Pow(cp - 25, 2) + Math.Pow(fp - 25, 2) + Math.Pow(pp - 25, 2) + Math.Pow(vp - 25, 2)) / 4;
                score = Math.Sqrt(variance);
            }

            return new DietPlan
            {
                Foods = counts,
                Score = score,
                TotalCalories = cals,
                Carbs = c,
                Fat = f,
                Protein = p,
                Vitamins = v,
                AverageTier = totalTier / diet.Count
            };
        }

        private static void DisplayDiet(User user, DietPlan plan)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine($"<b>Recommended Diet</b> (Score: {plan.Score:F2}, Cals: {plan.TotalCalories:F0}, Tier: {plan.AverageTier:F1})");
            sb.AppendLine("<b>Eat (Per Meal):</b>");
            foreach(var kvp in plan.Foods)
            {
                sb.AppendLine($"- {kvp.Key}: {kvp.Value}");
            }

            float total = plan.Carbs + plan.Fat + plan.Protein + plan.Vitamins;
            if (total > 0)
            {
                float cp = (plan.Carbs / total) * 100;
                float pp = (plan.Protein / total) * 100;
                float fp = (plan.Fat / total) * 100;
                float vp = (plan.Vitamins / total) * 100;

                string cCarbs = "#e64a17";
                string cProt  = "#e69d08";
                string cFat   = "#deb719";
                string cVit   = "#9fc80d";
                string ColorText(string t, string h) => $"<color={h}>{t}</color>";

                sb.AppendLine($"Expected balance: {ColorText("Carbs", cCarbs)}: {cp:F1}%, {ColorText("Protein", cProt)}: {pp:F1}%, {ColorText("Fat", cFat)}: {fp:F1}%, {ColorText("Vitamins", cVit)}: {vp:F1}%");
            }
            else
            {
                sb.AppendLine("Expected balance: Carbs: 0.0%, Protein: 0.0%, Fat: 0.0%, Vitamins: 0.0%");
            }

            Log(sb.ToString());
            user.Player.MsgLocStr(sb.ToString());
        }

        private static void DisplayShoppingList(User user, DietPlan plan, int meals)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine($"<b>Shopping List for {meals} Meals</b>");
            foreach(var kvp in plan.Foods)
            {
                sb.AppendLine($"- {kvp.Key}: {kvp.Value * meals}");
            }
            Log(sb.ToString());
            user.Player.MsgLocStr(sb.ToString());
        }

        private static bool IsHiddenOrBlacklisted(FoodItem food)
        {
            // Blacklist for Safe Mode (Preventing Spoilers)
            var name = food.DisplayName.ToString().ToLower();
            if (name.Contains("ecoylent") ||
                name.Contains("admin") ||
                name.Contains("dev tool") ||
                name.Contains("creative") ||
                name.Contains("spawn")) return true;

            try
            {
                var prop = food.GetType().GetProperty("Hidden");
                if (prop != null && (bool)prop.GetValue(food)) return true;

                // Check Tags
                var tagsProp = food.GetType().GetProperty("Tags");
                if (tagsProp != null)
                {
                    var tags = tagsProp.GetValue(food) as IEnumerable<string>;
                    if (tags != null)
                    {
                        foreach(var t in tags)
                        {
                            if (t.Equals("Dev", StringComparison.OrdinalIgnoreCase) ||
                                t.Equals("Hidden", StringComparison.OrdinalIgnoreCase) ||
                                t.Equals("Admin", StringComparison.OrdinalIgnoreCase)) return true;
                        }
                    }
                }
            }
            catch {}
            return false;
        }

        private static bool IsIngredient(FoodItem food)
        {
            try
            {
                var tagsProp = food.GetType().GetProperty("Tags");
                if (tagsProp != null)
                {
                    var tags = tagsProp.GetValue(food) as IEnumerable<string>;
                    if (tags != null)
                    {
                        foreach(var t in tags)
                        {
                            if (t.Equals("Ingredient", StringComparison.OrdinalIgnoreCase)) return true;
                        }
                    }
                }
            }
            catch {}
            return false;
        }

        private static void ProbeReflection(User user)
        {
             // Enhanced probe
             var sb = new StringBuilder();
             sb.AppendLine("Reflection Probe V4:");
             try {
                 var tastes = GetTasteData(user);
                 sb.AppendLine($"Found {tastes.Count} taste entries.");

                 // Inspect a sample food item
                 if (tastes.Count > 0)
                 {
                     var type = tastes.First().Type;
                     var item = Item.Get(type);
                     if (item != null)
                     {
                         sb.AppendLine($"Inspecting {item.DisplayName}:");
                         foreach(var prop in item.GetType().GetProperties())
                         {
                             try {
                                 var val = prop.GetValue(item);
                                 sb.AppendLine($"- {prop.Name}: {val}");
                             } catch {}
                         }
                     }
                 }
             } catch (Exception ex) { sb.AppendLine($"Error: {ex.Message}"); }
             Log(sb.ToString());
             user.Player.MsgLocStr("Probe results logged to file (too large for chat).");
        }

        private static bool IsFavoriteDiscovered(User user)
        {
            try
            {
                var stomach = user.GetType().GetProperty("Stomach")?.GetValue(user);
                var tasteBuds = stomach?.GetType().GetProperty("TasteBuds")?.GetValue(stomach);
                if (tasteBuds != null)
                {
                    var favProp = tasteBuds.GetType().GetProperty("FavoriteDiscovered");
                    if (favProp != null) return (bool)favProp.GetValue(tasteBuds);
                }
            } catch {}
            return false;
        }

        private static bool IsWorstDiscovered(User user)
        {
            try
            {
                var stomach = user.GetType().GetProperty("Stomach")?.GetValue(user);
                var tasteBuds = stomach?.GetType().GetProperty("TasteBuds")?.GetValue(stomach);
                if (tasteBuds != null)
                {
                    var worstProp = tasteBuds.GetType().GetProperty("WorstDiscovered");
                    if (worstProp != null) return (bool)worstProp.GetValue(tasteBuds);
                }
            } catch {}
            return false;
        }

        // --- NEW HELPER METHOD ---
        // Returns list of (FoodType, PreferenceString)
        private static List<(Type Type, string Preference)> GetTasteData(User user)
        {
            var results = new List<(Type Type, string Preference)>();
            try
            {
                var stomachProp = user.GetType().GetProperty("Stomach");
                if (stomachProp == null) return results;
                var stomach = stomachProp.GetValue(user);
                if (stomach == null) return results;
                var tasteBudsProp = stomach.GetType().GetProperty("TasteBuds");
                if (tasteBudsProp == null) return results;
                var tasteBuds = tasteBudsProp.GetValue(stomach);
                if (tasteBuds == null) return results;

                var foodToTasteProp = tasteBuds.GetType().GetProperty("FoodToTaste") ?? tasteBuds.GetType().GetField("FoodToTaste") as MemberInfo;
                if (foodToTasteProp == null) return results;

                object foodToTasteDict = null;
                if (foodToTasteProp is PropertyInfo pInfo) foodToTasteDict = pInfo.GetValue(tasteBuds);
                else if (foodToTasteProp is FieldInfo fInfo) foodToTasteDict = fInfo.GetValue(tasteBuds);

                if (foodToTasteDict == null) return results;

                var enumerable = foodToTasteDict as System.Collections.IEnumerable;
                if (enumerable != null)
                {
                     foreach (var entry in enumerable)
                     {
                         try
                         {
                             var entryType = entry.GetType();
                             var keyProp = entryType.GetProperty("Key");
                             var valueProp = entryType.GetProperty("Value");

                             if (keyProp == null || valueProp == null) continue;

                             object keyObj = keyProp.GetValue(entry);
                             object valueObj = valueProp.GetValue(entry);

                             if (keyObj == null || valueObj == null) continue;

                             var type = keyObj as Type;
                             if (type == null) continue;

                             object enumVal = null;
                             var prefProp = valueObj.GetType().GetProperty("Preference");
                             if (prefProp != null) enumVal = prefProp.GetValue(valueObj);
                             else
                             {
                                 var prefField = valueObj.GetType().GetField("Preference");
                                 if (prefField != null) enumVal = prefField.GetValue(valueObj);
                             }

                             if (enumVal != null)
                             {
                                 results.Add((type, enumVal.ToString()));
                             }
                         }
                         catch { }
                     }
                }
            }
            catch (Exception ex) { Log($"GetTasteData Error: {ex}"); }
            return results;
        }

        private static List<Type> GetDiscoveredFoodTypesFromTasteBuds(User user)
        {
             // Refactored to wrapper using GetTasteData
             var list = new List<Type>();
             try {
                 var data = GetTasteData(user);
                 var allowed = new[] { "Favorite", "Delicious", "Good", "Ok" };
                 bool favDisc = IsFavoriteDiscovered(user);

                 foreach(var d in data)
                 {
                     if (d.Preference.Equals("Favorite", StringComparison.OrdinalIgnoreCase) && !favDisc) continue;
                     if (allowed.Any(a => a.Equals(d.Preference, StringComparison.OrdinalIgnoreCase)))
                     {
                         list.Add(d.Type);
                     }
                 }
             } catch {}
             return list;
        }

        private static Dictionary<string, List<string>> GetGroupedFoodTypesFromTasteBuds(User user)
        {
            var grouped = new Dictionary<string, List<string>>();
            var data = GetTasteData(user);

            foreach(var d in data)
            {
                string foodName = "Unknown";
                try {
                     var item = Item.Get(d.Type);
                     if (item != null) foodName = item.UILink();
                } catch {}

                if (!grouped.ContainsKey(d.Preference)) grouped[d.Preference] = new List<string>();
                grouped[d.Preference].Add(foodName);
            }
            return grouped;
        }
    }
}

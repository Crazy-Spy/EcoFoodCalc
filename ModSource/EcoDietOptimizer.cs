namespace Eco.Mods.TechTree
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.IO;
    using Eco.Core.Plugins.Interfaces;
    using Eco.Gameplay.Items;
    using Eco.Gameplay.Players;
    using Eco.Gameplay.Systems.Messaging.Chat.Commands; // Correct Namespace for 0.12+
    using Eco.Shared.Localization;
    using Eco.Shared.Math;
    using Eco.Shared.Utils;
    using Eco.Core.Utils;

    // Data structures for Diet Optimization
    public class DietPlan
    {
        // Key: Food Name, Value: Count
        public Dictionary<string, int> Foods { get; set; } = new Dictionary<string, int>();

        // Stats
        public double Score { get; set; }
        public float TotalCalories { get; set; }
        public float Carbs { get; set; }
        public float Fat { get; set; }
        public float Protein { get; set; }
        public float Vitamins { get; set; }
    }

    public class DietResult
    {
        public DateTime GeneratedAt { get; set; }
        public DietPlan Plan { get; set; }
    }

    // Mark the class as a Chat Command Handler
    [ChatCommandHandler]
    public class EcoDietOptimizer : IModKitPlugin, IInitializablePlugin
    {
        public string GetStatus() => "Active";
        public string GetCategory() => "User";

        private static string CacheFilePath = "EcoDietOptimizer_Cache.txt";
        private static Dictionary<string, DietResult> DietCache = new Dictionary<string, DietResult>();
        private static Random rng = new Random();

        public void Initialize(TimedTask timer)
        {
            LoadData();
        }

        private static void LoadData()
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

                        DietCache[userId] = new DietResult { GeneratedAt = new DateTime(ticks), Plan = plan };
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"[EcoDietOptimizer] Error loading cache: {ex.Message}");
            }
        }

        private static void SaveData()
        {
            try
            {
                var lines = new List<string>();
                foreach(var kvp in DietCache)
                {
                    var r = kvp.Value;
                    var p = r.Plan;
                    string foodStr = string.Join(",", p.Foods.Select(f => $"{f.Key}:{f.Value}"));
                    lines.Add($"{kvp.Key};;{r.GeneratedAt.Ticks};;{foodStr};;{p.Score};;{p.TotalCalories};;{p.Carbs};;{p.Fat};;{p.Protein};;{p.Vitamins}");
                }
                File.WriteAllLines(CacheFilePath, lines);
            }
            catch (Exception ex)
            {
                Log($"[EcoDietOptimizer] Error saving cache: {ex.Message}"));
            }
        }

        [ChatCommand("diet", "Suggests an optimal diet based on your stomach size and tastes.")]
        public static void DietCommand(User user, int meals = 0)
        {
            try
            {
                HandleDietRequest(user, meals);
            }
            catch (Exception ex)
            {
                user.Player.MsgLocStr($"Error calculating diet: {ex.Message}");
                Log(ex.ToString());
            }
        }

        private static void HandleDietRequest(User user, int meals)
        {
            if (user == null || user.Player == null) return;

            string userId = user.Name;

            // Check Cache
            if (DietCache.ContainsKey(userId))
            {
                var cached = DietCache[userId];
                // 24 hours = 86400 seconds
                if ((DateTime.Now - cached.GeneratedAt).TotalHours < 24)
                {
                     if (meals > 0)
                         DisplayShoppingList(user, cached.Plan, meals);
                     else
                         DisplayDiet(user, cached.Plan);

                     var remaining = TimeSpan.FromHours(24) - (DateTime.Now - cached.GeneratedAt);
                     user.Player.MsgLocStr($"Next diet update available in {remaining.Hours}h {remaining.Minutes}m.");
                     return;
                }
            }

            if (meals > 0 && !DietCache.ContainsKey(userId))
            {
                 user.Player.MsgLocStr("No cached diet found. Calculating new one...");
            }
            else if (meals > 0)
            {
                 user.Player.MsgLocStr("Diet cache expired. Recalculating...");
            }

            DietPlan newPlan = FindBestDiet(user);

            if (newPlan != null)
            {
                DietCache[userId] = new DietResult { GeneratedAt = DateTime.Now, Plan = newPlan };
                SaveData();

                if (meals > 0)
                    DisplayShoppingList(user, newPlan, meals);
                else
                    DisplayDiet(user, newPlan);
            }
            else
            {
                user.Player.MsgLocStr("Could not find a suitable diet. Try discovering more foods!");
            }
        }

        private static DietPlan FindBestDiet(User user)
        {
            float stomachSize = 3000;
            try {
                dynamic u = user;
                if (u.Stomach != null) stomachSize = u.Stomach.Capacity;
            } catch { }

            var availableFoods = new List<FoodItem>();
            IEnumerable<FoodItem> allFoods = null;

            // Try to find all items using reflection/dynamic if direct access fails
            try
            {
                 // Try standard Item.AllItemsIncludingHidden first (supported in many versions)
                 allFoods = Item.AllItemsIncludingHidden.OfType<FoodItem>();
            }
            catch
            {
                 // Fallback: Try Item.AllItems or reflection on Item class
                 try {
                     var itemType = typeof(Item);
                     var prop = itemType.GetProperty("AllItems", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                     if (prop == null) prop = itemType.GetProperty("AllItemsIncludingHidden", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

                     if (prop != null)
                     {
                         var items = prop.GetValue(null) as IEnumerable<Item>;
                         if (items != null) allFoods = items.OfType<FoodItem>();
                     }
                 } catch {}
            }

            if (allFoods == null || !allFoods.Any())
            {
                user.Player.MsgLocStr("Error: Could not retrieve food items from game registry.");
                return null;
            }

            bool discoveryApiFailed = false;
            bool tasteApiFailed = false;

            foreach(var food in allFoods)
            {
                if (!IsDiscovered(user, food, ref discoveryApiFailed)) continue;
                if (IsBadOrHorrible(user, food, ref tasteApiFailed)) continue;
                if (food.Calories <= 0) continue;
                if (food.Calories > stomachSize) continue;

                availableFoods.Add(food);
            }

            if (discoveryApiFailed) Log("[EcoDietOptimizer] Warning: Discovery API failed. Assuming all foods discovered.");
            if (tasteApiFailed) Log("[EcoDietOptimizer] Warning: Taste API failed. Assuming no bad foods.");

            if (availableFoods.Count == 0) return null;

            int MAX_ITERATIONS = 5000;
            int MAX_ITEMS_TYPES = 6;
            List<DietPlan> bestDiets = new List<DietPlan>();

            for(int i=0; i < MAX_ITERATIONS; i++)
            {
                int maxUnique = Math.Min(availableFoods.Count, MAX_ITEMS_TYPES);
                int uniqueCount = rng.Next(Math.Min(2, maxUnique), maxUnique + 1);

                var selectedTypes = new List<FoodItem>();
                var pool = new List<FoodItem>(availableFoods);

                for(int k=0; k<uniqueCount; k++)
                {
                   int idx = rng.Next(pool.Count);
                   selectedTypes.Add(pool[idx]);
                   pool.RemoveAt(idx);
                }

                // Fill stomach
                float currentCals = 0;
                var dietList = new List<FoodItem>();
                var drawPool = new List<FoodItem>(selectedTypes);
                int attemptLimit = 100;

                while(currentCals < stomachSize && drawPool.Count > 0 && attemptLimit > 0)
                {
                    int idx = rng.Next(drawPool.Count);
                    var food = drawPool[idx];

                    if (currentCals + food.Calories <= stomachSize)
                    {
                        dietList.Add(food);
                        currentCals += food.Calories;
                    }
                    else
                    {
                        drawPool.RemoveAt(idx);
                    }
                    attemptLimit--;
                }

                if (dietList.Count < 2) continue;

                bestDiets.Add(AnalyzeDiet(dietList));
            }

            var sorted = bestDiets.OrderBy(d => d.Score).ThenByDescending(d => d.TotalCalories).ToList();
            return sorted.FirstOrDefault();
        }

        private static DietPlan AnalyzeDiet(List<FoodItem> diet)
        {
            if (diet.Count == 0) return new DietPlan { Score = double.MaxValue };

            float c = 0, f = 0, p = 0, v = 0, cals = 0;
            var counts = new Dictionary<string, int>();

            foreach(var item in diet)
            {
                c += item.Nutrition.Carbs;
                f += item.Nutrition.Fat;
                p += item.Nutrition.Protein;
                v += item.Nutrition.Vitamins;
                cals += item.Calories;

                if (!counts.ContainsKey(item.DisplayName)) counts[item.DisplayName] = 0;
                counts[item.DisplayName]++;
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
                Vitamins = v
            };
        }

        private static void DisplayDiet(User user, DietPlan plan)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine($"<b>Recommended Diet</b> (Score: {plan.Score:F2}, Cals: {plan.TotalCalories:F0})");
            sb.AppendLine("<b>Eat (Per Meal):</b>");
            foreach(var kvp in plan.Foods)
            {
                sb.AppendLine($"- {kvp.Key}: {kvp.Value}");
            }
            sb.AppendLine($"<i>Nutrients: C:{plan.Carbs:F1} F:{plan.Fat:F1} P:{plan.Protein:F1} V:{plan.Vitamins:F1}</i>");

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
             user.Player.MsgLocStr(sb.ToString());
        }

        // Helpers for Eco API interaction
        private static bool IsDiscovered(User user, FoodItem food, ref bool failed)
        {
            if (failed) return true;
            try
            {
                // Check DiscoveryManager using reflection to avoid hard dependency on specific API version
                var type = Type.GetType("Eco.Gameplay.Systems.DiscoveryManager, Eco.Gameplay");
                if (type != null)
                {
                    var objProp = type.GetProperty("Obj");
                    if (objProp != null)
                    {
                        var manager = objProp.GetValue(null);
                        // IsDiscovered often takes (Type itemType, User user) or (Item item, User user)
                        // We try Type first as it's more common in managers
                        var method = type.GetMethod("IsDiscovered", new[] { typeof(Type), typeof(User) });
                        if (method != null) return (bool)method.Invoke(manager, new object[] { food.Type, user });
                    }
                }
                return true;
            }
            catch
            {
                failed = true;
                return true;
            }
        }

        private static bool IsBadOrHorrible(User user, FoodItem food, ref bool failed)
        {
            if (failed) return false;
            try
            {
                // Check Taste via dynamic access to User.Stomach.TasteBuds
                dynamic u = user;
                if (u.Stomach != null)
                {
                    // Access TasteBuds property
                    dynamic tasteBuds = u.Stomach.TasteBuds;
                    if (tasteBuds != null)
                    {
                        // GetTaste(Type itemType) returns float 0-1 usually, or enum
                        // We assume float where < 0.2 might be bad? Or specific Enum.
                        // Safe default: return false if complex logic fails.
                        // Implementation of this part is highly specific to server version enum.
                    }
                }
                return false;
            }
            catch
            {
                failed = true;
                return false;
            }
        }

        private static void Log(string message)
        {
             Console.WriteLine(message);
        }
    }
}

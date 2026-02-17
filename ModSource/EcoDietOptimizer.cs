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
        private static Dictionary<string, DietResult> DietCache = new Dictionary<string, DietResult>();
        private static readonly object _lock = new object();
        private static Random rng = new Random();
        private static int CooldownMinutes = 1440;
        private static bool DebugMode = false;
        private static bool StrictMode = false; // Default to False (Assume Discovered if API fails)

        public void Initialize(TimedTask timer)
        {
            LoadData();
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
                        lines.Add($"{kvp.Key};;{r.GeneratedAt.Ticks};;{foodStr};;{p.Score};;{p.TotalCalories};;{p.Carbs};;{p.Fat};;{p.Protein};;{p.Vitamins}");
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
                                SaveData(); // SaveData locks internally, but we hold lock. Re-entrant lock is okay.
                                user.Player.MsgLocStr("Diet cache cleared.");
                            }
                            else
                            {
                                user.Player.MsgLocStr("No cached diet found.");
                            }
                        }
                        break;
                    case "debug":
                        DebugMode = !DebugMode;
                        user.Player.MsgLocStr($"Debug mode is now {(DebugMode ? "ON" : "OFF")}.");
                        break;
                    case "strict":
                        StrictMode = !StrictMode;
                        user.Player.MsgLocStr($"Strict Discovery Mode is now {(StrictMode ? "ON" : "OFF")}.");
                        if (StrictMode) user.Player.MsgLocStr("Only explicitly discovered items will be shown.");
                        else user.Player.MsgLocStr("All non-developer food items will be shown (Fallback enabled).");
                        break;
                    case "probe":
                        ProbeReflection(user);
                        break;
                    default:
                        if (arg.StartsWith("config "))
                        {
                            var parts = arg.Split(' ');
                            if (parts.Length > 1 && int.TryParse(parts[1], out int mins))
                            {
                                CooldownMinutes = mins;
                                user.Player.MsgLocStr($"Diet cooldown set to {CooldownMinutes} minutes.");
                            }
                            else
                            {
                                user.Player.MsgLocStr("Usage: /diet config <minutes>");
                            }
                        }
                        else
                        {
                            user.Player.MsgLocStr("Usage: /diet [meals | clear | debug | strict | config <minutes>]");
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                user.Player.MsgLocStr($"Error: {ex.Message}");
            }
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
                     user.Player.MsgLocStr($"Next diet update available in {remaining.Hours}h {remaining.Minutes}m.");
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

            DietPlan newPlan = FindBestDiet(user);

            if (newPlan != null)
            {
                lock(_lock)
                {
                    DietCache[userId] = new DietResult { GeneratedAt = DateTime.Now, Plan = newPlan };
                    SaveData(); // Re-entrant lock OK
                }

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

            var availableFoods = new List<FoodItem>();
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

            if (allFoods == null || !allFoods.Any())
            {
                user.Player.MsgLocStr("Error: Could not retrieve food items from game registry.");
                return null;
            }

            bool discoveryApiFailed = false;
            bool tasteApiFailed = false;

            // Pre-fetch bad foods
            HashSet<Type> badFoodTypes = GetBadFoodTypes(user, ref tasteApiFailed);

            foreach(var food in allFoods)
            {
                if (IsHiddenOrBlacklisted(food)) continue;

                if (!IsDiscovered(user, food, ref discoveryApiFailed)) continue;

                // If taste API worked, exclude bad foods. If failed, allow all.
                if (!tasteApiFailed && badFoodTypes.Contains(food.Type)) continue;

                if (food.Calories <= 0) continue;
                if (food.Calories > stomachSize) continue;

                availableFoods.Add(food);
            }

            if (discoveryApiFailed && !StrictMode)
                user.Player.MsgLocStr("Warning: Discovery API unreachable. Showing all foods (excluding dev items). Use '/diet strict' to enforce strict discovery.");

            if (tasteApiFailed) user.Player.MsgLocStr("Warning: Taste API failed. Assuming no bad foods.");

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

                string name = item.DisplayName.ToString();
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

            float total = plan.Carbs + plan.Fat + plan.Protein + plan.Vitamins;
            if (total > 0)
            {
                float cp = (plan.Carbs / total) * 100;
                float pp = (plan.Protein / total) * 100;
                float fp = (plan.Fat / total) * 100;
                float vp = (plan.Vitamins / total) * 100;
                sb.AppendLine($"Expected balance: Carbs: {cp:F0} %, Protein: {pp:F0} %, Fat: {fp:F0} %, Vitamins: {vp:F0} %");
            }
            else
            {
                sb.AppendLine("Expected balance: Carbs: 0 %, Protein: 0 %, Fat: 0 %, Vitamins: 0 %");
            }

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

        private static void ProbeReflection(User user)
        {
             var sb = new StringBuilder();
             sb.AppendLine("Reflection Probe V2:");

             try {
                 sb.AppendLine("User Properties:");
                 foreach(var p in user.GetType().GetProperties()) sb.Append(p.Name + ", ");
                 sb.AppendLine();

                 sb.AppendLine("User Fields:");
                 foreach(var f in user.GetType().GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)) sb.Append(f.Name + ", ");
                 sb.AppendLine();

                 var stomach = user.GetType().GetProperty("Stomach")?.GetValue(user);
                 if (stomach != null)
                 {
                     sb.AppendLine("Stomach Properties:");
                     foreach(var p in stomach.GetType().GetProperties()) sb.Append(p.Name + ", ");
                     sb.AppendLine();

                     sb.AppendLine("Stomach Fields:");
                     foreach(var f in stomach.GetType().GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)) sb.Append(f.Name + ", ");
                     sb.AppendLine();
                 }

                 // Check DiscoveryManager candidates
                 var candidates = new[] {
                    "Eco.Gameplay.Systems.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.Components.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.DynamicLayers.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.Systems.Discovery.DiscoveryManager, Eco.Gameplay"
                 };
                 foreach(var c in candidates)
                 {
                     var t = Type.GetType(c);
                     if (t != null) sb.AppendLine($"Found Manager: {c}");
                 }

             } catch (Exception ex) { sb.AppendLine($"Probe Error: {ex.Message}"); }

             user.Player.MsgLocStr(sb.ToString());
        }

        private static bool IsDiscovered(User user, FoodItem food, ref bool failed)
        {
            // 1. Check Inventory (Possession)
            try
            {
                var invProp = user.GetType().GetProperty("Inventory");
                if (invProp != null)
                {
                    var inv = invProp.GetValue(user);
                    if (inv != null)
                    {
                        var allItemsProp = inv.GetType().GetProperty("AllItems") ?? inv.GetType().GetProperty("Stacks");
                        if (allItemsProp != null)
                        {
                            var items = allItemsProp.GetValue(inv) as System.Collections.IEnumerable;
                            if (items != null)
                            {
                                foreach(var item in items)
                                {
                                    // Handle ItemStack vs Item
                                    var itemProp = item.GetType().GetProperty("Item");
                                    var obj = itemProp != null ? itemProp.GetValue(item) : item;

                                    if (obj != null)
                                    {
                                        var typeProp = obj.GetType().GetProperty("Type");
                                        if (typeProp != null && (Type)typeProp.GetValue(obj) == food.Type) return true;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {}

            // 2. Check Stomach Contents (Recent History) - Check Properties AND Fields
            try
            {
                 var stomach = user.GetType().GetProperty("Stomach")?.GetValue(user);
                 if (stomach != null)
                 {
                     System.Collections.IEnumerable contents = null;

                     var contentsProp = stomach.GetType().GetProperty("Contents");
                     if (contentsProp != null) contents = contentsProp.GetValue(stomach) as System.Collections.IEnumerable;

                     if (contents == null)
                     {
                         var contentsField = stomach.GetType().GetField("Contents", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                         if (contentsField != null) contents = contentsField.GetValue(stomach) as System.Collections.IEnumerable;
                     }

                     if (contents != null)
                     {
                         foreach (var entry in contents)
                         {
                             var typeProp = entry.GetType().GetProperty("FoodType") ?? entry.GetType().GetProperty("Type");
                             if (typeProp != null)
                             {
                                 var type = typeProp.GetValue(entry) as Type;
                                 if (type == food.Type) return true;
                             }
                         }
                     }
                 }
            }
            catch { }

            if (failed && !StrictMode) return true; // Fail safe: Assume discovered if API broken (unless StrictMode)

            try
            {
                var managerTypeNames = new[] {
                    "Eco.Gameplay.Systems.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.Components.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.DynamicLayers.DiscoveryManager, Eco.Gameplay",
                    "Eco.Gameplay.Systems.Discovery.DiscoveryManager, Eco.Gameplay"
                };

                foreach(var typeName in managerTypeNames)
                {
                    var type = Type.GetType(typeName);
                    if (type != null)
                    {
                        var objProp = type.GetProperty("Obj");
                        if (objProp == null) objProp = type.GetProperty("Instance");

                        if (objProp != null)
                        {
                            var manager = objProp.GetValue(null);
                            var method = type.GetMethod("IsDiscovered", new[] { typeof(Type), typeof(User) });
                            if (method == null) method = type.GetMethod("IsDiscovered", new[] { typeof(User), typeof(Type) });

                            if (method != null)
                            {
                                var args = method.GetParameters()[0].ParameterType == typeof(Type)
                                           ? new object[] { food.Type, user }
                                           : new object[] { user, food.Type };

                                var result = (bool)method.Invoke(manager, args);
                                if (DebugMode && !result) user.Player.MsgLocStr($"Debug: {food.DisplayName.ToString()} is NOT discovered.");
                                return result;
                            }
                        }
                    }
                }

                // If we reach here, we couldn't access DiscoveryManager.
                failed = true;
                if (StrictMode)
                {
                    if (DebugMode) user.Player.MsgLocStr("Debug: DiscoveryManager not found. StrictMode=ON -> Defaulting to FALSE.");
                    return false;
                }
                else
                {
                    if (DebugMode) user.Player.MsgLocStr("Debug: DiscoveryManager not found. StrictMode=OFF -> Defaulting to TRUE.");
                    return true;
                }
            }
            catch (Exception ex)
            {
                if (DebugMode) user.Player.MsgLocStr($"Debug: Discovery check error: {ex.Message}");
                failed = true;
                return !StrictMode; // Default true if not strict
            }
        }

        private static HashSet<Type> GetBadFoodTypes(User user, ref bool failed)
        {
            var badFoods = new HashSet<Type>();

            try
            {
                var stomachProp = user.GetType().GetProperty("Stomach");
                if (stomachProp == null) { failed = true; return badFoods; }

                var stomach = stomachProp.GetValue(user);
                if (stomach == null) { failed = true; return badFoods; }

                var tasteBudsProp = stomach.GetType().GetProperty("TasteBuds");
                if (tasteBudsProp == null) { failed = true; return badFoods; }

                var tasteBuds = tasteBudsProp.GetValue(stomach);
                if (tasteBuds == null) { failed = true; return badFoods; }

                // Reflect over "FoodToTaste" dictionary
                var foodToTasteProp = tasteBuds.GetType().GetProperty("FoodToTaste") ?? tasteBuds.GetType().GetField("FoodToTaste") as MemberInfo;
                if (foodToTasteProp == null) { failed = true; return badFoods; }

                object foodToTasteDict = null;
                if (foodToTasteProp is PropertyInfo pInfo) foodToTasteDict = pInfo.GetValue(tasteBuds);
                else if (foodToTasteProp is FieldInfo fInfo) foodToTasteDict = fInfo.GetValue(tasteBuds);

                if (foodToTasteDict is System.Collections.IDictionary dict)
                {
                     foreach (System.Collections.DictionaryEntry entry in dict)
                     {
                         // entry.Key is Type (Food Type), entry.Value is TasteData (or similar)
                         var type = entry.Key as Type;
                         var tasteData = entry.Value;

                         if (type != null && tasteData != null)
                         {
                             // Check "Preference" enum property on TasteData
                             var prefProp = tasteData.GetType().GetProperty("Preference");
                             if (prefProp != null)
                             {
                                 var enumVal = prefProp.GetValue(tasteData);
                                 string prefName = enumVal.ToString(); // e.g., "Horrible", "Bad"

                                 // Add logic to exclude bad foods
                                 if (prefName.Equals("Horrible", StringComparison.OrdinalIgnoreCase) ||
                                     prefName.Equals("Bad", StringComparison.OrdinalIgnoreCase) ||
                                     prefName.Equals("Worst", StringComparison.OrdinalIgnoreCase) ||
                                     prefName.Equals("TotalDisgust", StringComparison.OrdinalIgnoreCase))
                                 {
                                     badFoods.Add(type);
                                 }
                             }
                         }
                     }
                }
            }
            catch (Exception ex)
            {
                failed = true;
                if (DebugMode) user.Player.MsgLocStr($"Debug: Taste API Error: {ex.Message}");
            }

            return badFoods;
        }
    }
}

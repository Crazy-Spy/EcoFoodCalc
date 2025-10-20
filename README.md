# 🥦 Eco Food Calculator (EcoFoodCalc)

## Project Overview

Welcome to **EcoFoodCalc**! This project is a web application designed to help players of the survival game **Eco** (developed by Strange Loop Games) optimize their in-game diet to achieve the maximum possible **Nutrition Bonus** for skill point gain.

The player's **Skill Point gain rate is a product of both Housing Quality and Nutritional Balance.** By using the official game data extracted directly from the server files, this tool provides players with data-driven insights to manage their food consumption efficiently, ensuring their **Nutrition Bonus** is maximized, directly boosting the speed at which they level up professions.

## Goal

To provide an easy-to-use interface where players can manage their available food sources and receive **suggested recipes and meal plans** that maximize the player's nutritional balance (Carbs, Fat, Protein, Vitamins) for an optimal skill point multiplier.

## Key Features (Planned)

* **Food Availability Filter:** Allow users to flag which food items they **have**, **dislike**, or are **available for purchase** from other players' stores.
* **Diet Optimization Engine:** Based on user input and the official game data, the app will suggest the most efficient combination of available foods to achieve a balanced diet.
* **Official Game Data:** Built using the precise nutrient (`Carbs`, `Fat`, `Protein`, `Vitamins`) and calorie values (`Official_Calories_Game`) extracted from the official Eco game server files.
* **Interactive UI:** A clear and intuitive interface to visualize nutrient balance in real-time.

## Data Source

The core data used by this application is located in the `foodsource.json` file within this repository. This data was derived by analyzing the C# source files (`.cs`) from the Eco server (specifically the `public override Nutrients` and `public override float Calories` fields) to ensure absolute accuracy with in-game mechanics.

## Contribution

This project is open-source! Whether you want to help with the **frontend** (React/Vue/Svelte), improve the **optimization algorithm** (the real math puzzle!), or enhance the **data extraction** process, all contributions are welcome.

Feel free to fork the repository, open an issue, or submit a pull request!

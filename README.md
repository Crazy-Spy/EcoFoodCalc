# 🥦 Eco Food Calculator (EcoFoodCalc)

## 🚧 Project Status: Feature Complete (Functional Dev UI)

Welcome to **EcoFoodCalc**! This project is a robust, functional web application designed to help players of **Eco** (developed by Strange Loop Games) optimize their in-game diet to achieve the maximum possible **Nutrition Bonus** for skill point gain.

The core of the application utilizes a highly refined **optimization algorithm** to find the ideal nutritional balance (25% Carbs, 25% Fat, 25% Protein, 25% Vitamins) based on the player's dietary preferences and stomach capacity.

---

## ✨ Achieved Milestones

The core engine and all complex functionalities are fully implemented. We have achieved a powerful V1 optimization tool:

* **Optimal Balance Engine:** The tool uses a search algorithm based on **Standard Deviation** and **Caloric Maximization** to suggest the 3 best meal plans, aiming for perfect $25/25/25/25$ nutrient distribution.
* **Max Calorie Usage:** The algorithm correctly handles the repetition of food items (e.g., $3\times$ Bread) to fill the player's stomach capacity precisely.
* **Game Visuals Integration:** The nutritional breakdown is displayed with a **circular segment meter** using the official Eco game colors for instant feedback.
* **Data Persistence & Portability:** Complete functionality to **Export/Import** user preferences, custom tags, and dietary exclusions.
* **Taste Profile Respect:** Suggested diets automatically exclude foods flagged by the user as `BAD`, `HORRIBLE`, or the globally set `WORST` food.
* **User Interface:** The user interface was created by **Maarten494** (https://www.reddit.com/user/Maarten494/). He generously donated his time and skills to design and implement the UI used in this project.

---

## 🎯 Next Steps: Priorities for Collaboration

The project now needs community involvement to transition from a strong technical tool into a polished, game-ready application.

| Priority | Focus Area | Description |
| :---: | :---: | :--- |
| ~~**1**~~ | ~~**User Interface (UI/UX)**~~ | ~~The current interface is a **functional development shell**. We need a complete, modern, and aesthetically pleasing **User Interface** that matches the quality of the optimization engine.~~ **DONE.** Maarten already did an **amazing job** delivering a clean, functional, and game-appropriate UI. |
| **2** | **In-Game Validation** | Thorough testing and cross-referencing of the final suggested diets to confirm that the calculated `Balance Modifier` and $SP$ gains align perfectly with the actual game mechanics and engine output. |
| **3** | **Deterministic Algorithm** | Replace the current random-search algorithm (which is fast, but not exhaustive) with a **Deterministic Method**, ideally using **Integer Linear Programming (ILP)**, to guarantee the absolute globally optimal combination of foods. |
| **4** | **Server Integration** | Implement a method to automatically generate or update the `foodsource.json` data based on a specific custom server's files, addressing custom recipes and altered nutrient values. |
---

## 📂 Data Source

The core data used by this application is located in the `foodsource.json` file within this repository. This data was derived by analyzing the C# source files (`.cs`) from the Eco server (specifically the `public override Nutrients` and `public override float Calories` fields) to ensure absolute accuracy with in-game mechanics.

---

## 🤝 Contribution

This project is open-source! Contribute to the **complex math** (Priority 3), or enhance the **data extraction** process (Priority 4), all contributions are welcome.

Feel free to fork the repository, open an issue detailing your intended changes, or submit a pull request!

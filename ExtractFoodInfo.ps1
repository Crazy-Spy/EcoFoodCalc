Clear-Host

# Source folder containing the .cs files from Eco Server
$SourceFolder = "D:\SteamLibrary\steamapps\common\Eco Server\Mods\__core__\AutoGen\Food"

# Output file path for the generated JSON
$OutputFile = ".\foodsource.json" 

# Array to hold all food objects
$FoodData = @()

# Regular Expressions (Regex)
# Captures friendly name with spaces from [LocDisplayName("...")]
$RegexDisplayName = '\[LocDisplayName\("(.+?)"\)\]' 
# Captures Calories value
$RegexCalories    = 'public override float Calories\s*=>\s*(\d+)'
# Captures Nutrients: Carbs, Fat, Protein, Vitamins
$RegexNutrients   = 'Nutrients\(\) \{ Carbs = (\d+), Fat = (\d+), Protein = (\d+), Vitamins = (\d+)\};'

Write-Host "Starting data extraction from: $SourceFolder" -ForegroundColor Cyan

Get-ChildItem -Path $SourceFolder -Filter "*.cs" -File -Recurse | ForEach-Object {
    $Content = Get-Content $_.FullName -Raw
    
    $FoodName = $null
    $Calories = $null
    $Carbs = 0
    $Fat = 0
    $Protein = 0
    $Vitamins = 0
    
    # Extracting data using Regex
    if ($Content -match $RegexDisplayName) { $FoodName = $Matches[1] }
    if ($Content -match $RegexCalories)    { $Calories = [int]$Matches[1] }
    if ($Content -match $RegexNutrients) {
        $Carbs    = [int]$Matches[1]
        $Fat      = [int]$Matches[2]
        $Protein  = [int]$Matches[3]
        $Vitamins = [int]$Matches[4]
    }
    
    # Validation: Food Name and Calories are mandatory
    if ($FoodName -and ($null -ne $Calories)) {
        $FoodObject = [PSCustomObject]@{
            Food_Name              = $FoodName
            Carbs                  = $Carbs
            Fat                    = $Fat
            Protein                = $Protein
            Vitamins               = $Vitamins
            Official_Calories_Game = $Calories
        }
        $FoodData += $FoodObject
        Write-Host "✅ Processed: $FoodName ($Calories Kcal)" -ForegroundColor Green
    } else {
        # Warning if essential information is missing
        Write-Host "⚠️ Skipped: $($_.Name) - Incomplete data." -ForegroundColor Yellow
    }
}

# Export to JSON using UTF8 encoding (essential for spaces and special characters)
$FoodData | ConvertTo-Json -Depth 10 | Out-File $OutputFile -Encoding UTF8

Write-Host "`nFinished! Total items processed: $($FoodData.Count)" -ForegroundColor Cyan
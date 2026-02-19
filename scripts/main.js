import {
    initApp,
    sortTable,
    refreshUI,
    updateStomachSize,
    updateMealQuantity,
    setGlobalTag,
    updateFoodStatus,
    removeItemFromPreferences,
    addFoodToEvaluatedList,
    handleFilterChange,
    handleScreenshotUpload
} from './controller.js';

import {
    resetPreferences,
    exportUserData,
    importUserData
} from './storage.js';

// Expose functions to global scope for HTML event handlers
window.resetPreferences = resetPreferences;
window.exportUserData = exportUserData;
window.importUserData = () => {
    const file = document.getElementById('import-file-input').files[0];
    importUserData(file);
};
window.refreshUI = refreshUI;
window.updateStomachSize = updateStomachSize;
window.updateMealQuantity = updateMealQuantity;
window.setGlobalTag = setGlobalTag;
window.addFoodToEvaluatedList = addFoodToEvaluatedList;
window.renderEvaluatedTableComponent = handleFilterChange;
window.sortTable = sortTable;
window.updateFoodStatus = updateFoodStatus;
window.removeItemFromPreferences = removeItemFromPreferences;
window.handleScreenshotUpload = handleScreenshotUpload;

document.addEventListener("DOMContentLoaded", initApp);

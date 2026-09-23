// =========================================
// VANTYX FX — LIVE ANALYSIS
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const scanButton = document.querySelector("[data-scan-button]");

    if (!scanButton) return;

    scanButton.addEventListener("click", () => {
        console.log("VANTYX Live Analysis scan requested.");
    });
});
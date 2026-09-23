// =========================================
// VANTYX FX — AI ASSISTANT
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.querySelector("[data-ai-trigger]");
    const panel = document.querySelector("[data-ai-panel]");
    const close = document.querySelector("[data-ai-close]");

    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
        panel.classList.toggle("is-open");
    });

    if (close) {
        close.addEventListener("click", () => {
            panel.classList.remove("is-open");
        });
    }
});
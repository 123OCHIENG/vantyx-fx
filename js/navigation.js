// =========================================
// VANTYX FX — NAVIGATION
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector("[data-menu-toggle]");
    const mobileMenu = document.querySelector("[data-mobile-menu]");

    if (!menuButton || !mobileMenu) return;

    menuButton.addEventListener("click", () => {
        mobileMenu.classList.toggle("is-open");
        menuButton.classList.toggle("is-active");
    });
});
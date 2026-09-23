// =========================================
// VANTYX FX — SEARCH
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.querySelector("[data-search-input]");
    const searchResults = document.querySelector("[data-search-results]");

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();

        if (!query) {
            searchResults.innerHTML = "";
            searchResults.classList.remove("is-visible");
            return;
        }

        searchResults.classList.add("is-visible");
    });
});
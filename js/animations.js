// =========================================
// VANTYX FX — ANIMATIONS
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll("[data-reveal]");

    if (!("IntersectionObserver" in window)) {
        elements.forEach(el => el.classList.add("animate-fade-up"));
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("animate-fade-up");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.12
        }
    );

    elements.forEach(element => observer.observe(element));
});
document.addEventListener("DOMContentLoaded", () => {

    async function updateMarkets() {

        try {

            const response = await fetch("/api/prices");
            const data = await response.json();

            if (!data.connected) {
                console.log("VANTYX FX: Deriv disconnected");
                return;
            }

            Object.entries(data.markets).forEach(
                ([marketName, market]) => {

                    const priceElement =
                        document.querySelector(
                            `[data-market-price="${marketName}"]`
                        );

                    if (!priceElement) return;

                    if (market.price !== null) {

                        priceElement.textContent =
                            Number(market.price).toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 5
                                }
                            );

                    } else {

                        priceElement.textContent = "--";

                    }

                }
            );

        }
        catch (error) {

            console.error(
                "VANTYX FX: Market update error:",
                error
            );

        }

    }

    updateMarkets();

    setInterval(
        updateMarkets,
        1000
    );

});
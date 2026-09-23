// ============================================================
// VANTYX.live — FRONTEND MARKET ENGINE
// ============================================================

(() => {

    "use strict";

    console.log("VANTYX.live frontend starting...");


    // ========================================================
    // CONFIG
    // ========================================================

    const API_BASE = "/api";

    const WS_URL =
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;


    // ========================================================
    // STATE
    // ========================================================

    let socket = null;

    let reconnectTimer = null;

    let currentMarket = "EURUSD";

    let currentTimeframe = 60;

    let candles = [];


    // ========================================================
    // ELEMENTS
    // ========================================================

    const chartBody =
        document.getElementById("chartBody");

    const chartStatus =
        document.getElementById("chartStatus");

    const connectionText =
        document.getElementById("connectionText");

    const selectedSymbol =
        document.getElementById("selectedSymbol");

    const tradeMarket =
        document.getElementById("tradeMarket");

    const summaryMarket =
        document.getElementById("summaryMarket");


    // ========================================================
    // MARKET NAMES
    // ========================================================

    const marketNames = {

        EURUSD: "EUR/USD",

        GBPUSD: "GBP/USD",

        XAUUSD: "XAU/USD",

        BTCUSD: "BTC/USD"

    };


    // ========================================================
    // PRICE FORMAT
    // ========================================================

    function formatPrice(price) {

        const value =
            Number(price);

        if (!Number.isFinite(value)) {
            return "--";
        }

        if (value >= 10000) {

            return value.toLocaleString(
                undefined,
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

        }

        if (value >= 1000) {
            return value.toFixed(2);
        }

        if (value >= 100) {
            return value.toFixed(3);
        }

        return value.toFixed(5);

    }


    // ========================================================
    // PERCENTAGE CHANGE
    // ========================================================

    function calculateChange(
        current,
        previous
    ) {

        const c =
            Number(current);

        const p =
            Number(previous);

        if (
            !Number.isFinite(c) ||
            !Number.isFinite(p) ||
            p === 0
        ) {
            return null;
        }

        return (
            (
                (c - p) /
                p
            ) * 100
        );

    }


    // ========================================================
    // CONNECTION UI
    // ========================================================

    function setConnection(
        connected,
        message
    ) {

        if (connectionText) {

            connectionText.textContent =
                message;

        }

        if (chartStatus) {

            chartStatus.textContent =
                connected
                    ? "LIVE"
                    : "CONNECTING";

        }

    }


    // ========================================================
    // UPDATE MARKET CARD
    // ========================================================

    function updateMarketCard(
        market,
        price,
        previous
    ) {

        const priceElement =
            document.getElementById(
                `price-${market}`
            );

        const changeElement =
            document.getElementById(
                `change-${market}`
            );


        if (priceElement) {

            priceElement.textContent =
                formatPrice(price);

        }


        if (!changeElement) {
            return;
        }


        const change =
            calculateChange(
                price,
                previous
            );


        if (change === null) {

            changeElement.textContent =
                "--";

            changeElement.classList.remove(
                "text-success",
                "text-danger"
            );

            return;

        }


        changeElement.textContent =
            (
                change >= 0
                    ? "+"
                    : ""
            ) +
            change.toFixed(2) +
            "%";


        changeElement.classList.toggle(
            "text-success",
            change >= 0
        );

        changeElement.classList.toggle(
            "text-danger",
            change < 0
        );

    }


    // ========================================================
    // STATUS BADGE
    // ========================================================

    function updateMarketStatus(
        market,
        status
    ) {

        const chip =
            document.querySelector(
                `.market-chip[data-symbol="${market}"]`
            );


        if (!chip) {
            return;
        }


        let badge =
            chip.querySelector(
                ".market-status"
            );


        if (!badge) {

            badge =
                document.createElement("span");

            badge.className =
                "market-status";

            chip.appendChild(
                badge
            );

        }


        const labels = {

            live:
                "LIVE",

            closed:
                "CLOSED",

            suspended:
                "SUSPENDED",

            unavailable:
                "UNAVAILABLE",

            subscribing:
                "CONNECTING",

            waiting:
                "WAITING"

        };


        badge.dataset.status =
            status || "waiting";


        badge.textContent =
            labels[status] ||
            "WAITING";

    }


    // ========================================================
    // SELECT MARKET
    // ========================================================

    function selectMarket(
        market
    ) {

        currentMarket =
            market;


        const displayName =
            marketNames[market] ||
            market;


        if (selectedSymbol) {

            selectedSymbol.textContent =
                displayName;

        }


        if (tradeMarket) {

            tradeMarket.value =
                market;

        }


        if (summaryMarket) {

            summaryMarket.textContent =
                displayName;

        }


        document
            .querySelectorAll(".market-chip")
            .forEach(
                chip => {

                    chip.classList.toggle(
                        "active",
                        chip.dataset.symbol ===
                        market
                    );

                }
            );


        requestHistory();

    }


    // ========================================================
    // REMOVE EMPTY CHART MESSAGE
    // ========================================================

    function removeChartPlaceholder() {

        if (!chartBody) {
            return;
        }


        const placeholder =
            chartBody.querySelector(
                ".chart-empty"
            );


        if (placeholder) {

            placeholder.remove();

        }

    }


    // ========================================================
    // MARKET CLOSED / WAITING MESSAGE
    // ========================================================

    function showChartMessage(
        title,
        description
    ) {

        if (!chartBody) {
            return;
        }


        let message =
            chartBody.querySelector(
                ".vantyx-chart-message"
            );


        if (!message) {

            message =
                document.createElement(
                    "div"
                );

            message.className =
                "vantyx-chart-message";


            chartBody.appendChild(
                message
            );

        }


        message.innerHTML = `

            <div class="chart-empty-icon">
                <i data-lucide="activity"></i>
            </div>

            <strong>
                ${title}
            </strong>

            <span>
                ${description}
            </span>

        `;


        if (
            window.lucide
        ) {

            lucide.createIcons();

        }

    }


    // ========================================================
    // LIVE PRICE DISPLAY
    // ========================================================

    function showLivePrice(
        price
    ) {

        if (!chartBody) {
            return;
        }


        let box =
            chartBody.querySelector(
                ".vantyx-live-price"
            );


        if (!box) {

            box =
                document.createElement(
                    "div"
                );

            box.className =
                "vantyx-live-price";


            box.innerHTML = `

                <span>
                    LIVE PRICE
                </span>

                <strong>
                    --
                </strong>

                <small>
                    ● VANTYX MARKET ENGINE
                </small>

            `;


            chartBody.appendChild(
                box
            );

        }


        const value =
            box.querySelector(
                "strong"
            );


        if (value) {

            value.textContent =
                formatPrice(price);

        }

    }


    // ========================================================
    // PROCESS MARKET STATE
    // ========================================================

    function processMarkets(
        data
    ) {

        console.log(
            "VANTYX.live market state:",
            data
        );


        const incoming =
            data.markets || {};


        Object.entries(
            incoming
        )
        .forEach(
            ([marketName, state]) => {

                updateMarketCard(
                    marketName,
                    state.price,
                    state.previous
                );


                updateMarketStatus(
                    marketName,
                    state.status
                );


                if (
                    marketName ===
                    currentMarket
                ) {

                    if (
                        state.price !== null &&
                        state.price !== undefined
                    ) {

                        showLivePrice(
                            state.price
                        );

                    }


                    if (
                        state.status ===
                        "closed"
                    ) {

                        removeChartPlaceholder();


                        showChartMessage(
                            "Market Closed",
                            `${marketNames[marketName] || marketName} is currently closed. Waiting for the market to reopen.`
                        );

                    }

                }

            }
        );


        setConnection(
            true,
            data.connected
                ? "VANTYX market engine connected"
                : "VANTYX server connected"
        );

    }


    // ========================================================
    // PROCESS TICK
    // ========================================================

    function processTick(
        data
    ) {

        console.log(
            "VANTYX.live tick:",
            data
        );


        if (!data.market) {
            return;
        }


        updateMarketCard(
            data.market,
            data.price,
            data.previous
        );


        updateMarketStatus(
            data.market,
            "live"
        );


        if (
            data.market !==
            currentMarket
        ) {

            return;

        }


        removeChartMessage();

        showLivePrice(
            data.price
        );


        /*
        | Update latest candle.
        */

        if (
            candles.length
        ) {

            const latest =
                candles[
                    candles.length - 1
                ];


            const price =
                Number(
                    data.price
                );


            if (
                Number.isFinite(price)
            ) {

                latest.close =
                    price;


                latest.high =
                    Math.max(
                        latest.high,
                        price
                    );


                latest.low =
                    Math.min(
                        latest.low,
                        price
                    );


                drawChart();

            }

        }

    }


    // ========================================================
    // REMOVE CHART MESSAGE
    // ========================================================

    function removeChartMessage() {

        if (!chartBody) {
            return;
        }


        const message =
            chartBody.querySelector(
                ".vantyx-chart-message"
            );


        if (message) {

            message.remove();

        }

    }


    // ========================================================
    // REQUEST HISTORY
    // ========================================================

    function requestHistory() {

        if (
            !socket ||
            socket.readyState !==
            WebSocket.OPEN
        ) {

            return;

        }


        console.log(
            "VANTYX.live requesting history:",
            currentMarket,
            currentTimeframe
        );


        socket.send(

            JSON.stringify({

                type:
                    "get_history",

                market:
                    currentMarket,

                count:
                    200,

                granularity:
                    currentTimeframe

            })

        );

    }


    // ========================================================
    // PROCESS HISTORY
    // ========================================================

    function processHistory(
        data
    ) {

        console.log(
            "VANTYX.live history:",
            data
        );


        if (
            !Array.isArray(
                data.candles
            ) ||
            data.candles.length === 0
        ) {

            return;

        }


        candles =
            data.candles
                .map(
                    candle => ({

                        epoch:
                            Number(
                                candle.epoch
                            ),

                        open:
                            Number(
                                candle.open
                            ),

                        high:
                            Number(
                                candle.high
                            ),

                        low:
                            Number(
                                candle.low
                            ),

                        close:
                            Number(
                                candle.close
                            )

                    })
                )
                .filter(
                    candle =>
                        Number.isFinite(
                            candle.epoch
                        ) &&
                        Number.isFinite(
                            candle.open
                        ) &&
                        Number.isFinite(
                            candle.high
                        ) &&
                        Number.isFinite(
                            candle.low
                        ) &&
                        Number.isFinite(
                            candle.close
                        )
                );


        if (
            candles.length
        ) {

            removeChartPlaceholder();

            removeChartMessage();

            drawChart();

        }

    }


    // ========================================================
    // DRAW CHART
    // ========================================================

    function drawChart() {

        if (
            !chartBody ||
            !candles.length
        ) {

            return;

        }


        let canvas =
            chartBody.querySelector(
                ".vantyx-chart"
            );


        if (!canvas) {

            canvas =
                document.createElement(
                    "canvas"
                );

            canvas.className =
                "vantyx-chart";

            chartBody.appendChild(
                canvas
            );

        }


        const rect =
            chartBody.getBoundingClientRect();


        const width =
            Math.max(
                300,
                Math.floor(
                    rect.width
                )
            );


        const height =
            Math.max(
                300,
                Math.floor(
                    rect.height
                )
            );


        const dpr =
            window.devicePixelRatio ||
            1;


        canvas.width =
            width * dpr;


        canvas.height =
            height * dpr;


        canvas.style.width =
            `${width}px`;


        canvas.style.height =
            `${height}px`;


        const ctx =
            canvas.getContext(
                "2d"
            );


        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        const visible =
            candles.slice(
                -90
            );


        const values = [];


        visible.forEach(
            candle => {

                values.push(
                    candle.high,
                    candle.low
                );

            }
        );


        if (!values.length) {
            return;
        }


        const high =
            Math.max(
                ...values
            );


        const low =
            Math.min(
                ...values
            );


        const range =
            high - low ||
            1;


        const left = 45;

        const right = 65;

        const top = 25;

        const bottom = 30;


        const chartWidth =
            width -
            left -
            right;


        const chartHeight =
            height -
            top -
            bottom;


        function y(price) {

            return (
                top +
                (
                    (high - price) /
                    range
                ) *
                chartHeight
            );

        }


        /*
        | Grid
        */

        ctx.strokeStyle =
            "rgba(255,255,255,0.045)";

        ctx.lineWidth = 1;


        for (
            let i = 0;
            i <= 5;
            i++
        ) {

            const gy =
                top +
                (
                    chartHeight /
                    5
                ) *
                i;


            ctx.beginPath();

            ctx.moveTo(
                left,
                gy
            );

            ctx.lineTo(
                width - right,
                gy
            );

            ctx.stroke();

        }


        /*
        | Price labels
        */

        ctx.fillStyle =
            "rgba(169,178,192,0.75)";

        ctx.font =
            "10px Inter, sans-serif";


        for (
            let i = 0;
            i <= 5;
            i++
        ) {

            const price =
                high -
                (
                    range /
                    5
                ) *
                i;


            ctx.fillText(
                formatPrice(price),
                width - right + 8,
                y(price) + 3
            );

        }


        /*
        | Candles
        */

        const slot =
            chartWidth /
            visible.length;


        const bodyWidth =
            Math.max(
                2,
                slot * 0.60
            );


        visible.forEach(
            (
                candle,
                index
            ) => {

                const open =
                    candle.open;

                const close =
                    candle.close;

                const candleHigh =
                    candle.high;

                const candleLow =
                    candle.low;


                const x =
                    left +
                    index *
                    slot +
                    slot / 2;


                const rising =
                    close >= open;


                const color =
                    rising
                        ? "#39d98a"
                        : "#ff5c6c";


                ctx.strokeStyle =
                    color;

                ctx.lineWidth =
                    1;


                /*
                | Wick
                */

                ctx.beginPath();

                ctx.moveTo(
                    x,
                    y(candleHigh)
                );

                ctx.lineTo(
                    x,
                    y(candleLow)
                );

                ctx.stroke();


                /*
                | Body
                */

                const bodyTop =
                    y(
                        Math.max(
                            open,
                            close
                        )
                    );


                const bodyBottom =
                    y(
                        Math.min(
                            open,
                            close
                        )
                    );


                const bodyHeight =
                    Math.max(
                        1,
                        bodyBottom -
                        bodyTop
                    );


                ctx.fillStyle =
                    color;


                ctx.fillRect(
                    x -
                    bodyWidth / 2,
                    bodyTop,
                    bodyWidth,
                    bodyHeight
                );

            }
        );

    }


    // ========================================================
    // REST FALLBACK
    // ========================================================

    async function loadMarketsREST() {

        try {

            const response =
                await fetch(
                    `${API_BASE}/markets`,
                    {
                        cache:
                            "no-store"
                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            processMarkets(
                data
            );


        }
        catch (error) {

            console.warn(
                "VANTYX REST market error:",
                error.message
            );

            setConnection(
                false,
                "Waiting for VANTYX API"
            );

        }

    }


    // ========================================================
    // WEBSOCKET
    // ========================================================

    function connectWebSocket() {

        console.log(
            "VANTYX.live opening WebSocket:",
            WS_URL
        );


        try {

            socket =
                new WebSocket(
                    WS_URL
                );

        }
        catch (error) {

            console.error(
                "VANTYX WebSocket creation failed:",
                error
            );

            return;

        }


        socket.onopen =
            () => {

                console.log(
                    "VANTYX.live WebSocket connected."
                );


                setConnection(
                    true,
                    "VANTYX market engine connected"
                );


                socket.send(

                    JSON.stringify({

                        type:
                            "get_markets"

                    })

                );


                requestHistory();

            };


        socket.onmessage =
            event => {

                try {

                    const data =
                        JSON.parse(
                            event.data
                        );


                    if (
                        data.type ===
                        "initial_state"
                    ) {

                        processMarkets(
                            data
                        );

                    }


                    if (
                        data.type ===
                        "markets"
                    ) {

                        processMarkets(
                            data
                        );

                    }


                    if (
                        data.type ===
                        "tick"
                    ) {

                        processTick(
                            data
                        );

                    }


                    if (
                        data.type ===
                        "history"
                    ) {

                        processHistory(
                            data
                        );

                    }


                    if (
                        data.type ===
                        "connection"
                    ) {

                        setConnection(
                            Boolean(
                                data.connected
                            ),
                            data.connected
                                ? "VANTYX market engine connected"
                                : "Waiting for Deriv market feed"
                        );

                    }


                    if (
                        data.type ===
                        "error"
                    ) {

                        console.error(
                            "VANTYX.live API error:",
                            data
                        );

                    }

                }
                catch (error) {

                    console.error(
                        "VANTYX.live message error:",
                        error
                    );

                }

            };


        socket.onerror =
            error => {

                console.error(
                    "VANTYX.live WebSocket error:",
                    error
                );

                setConnection(
                    false,
                    "Market WebSocket error"
                );

            };


        socket.onclose =
            () => {

                console.warn(
                    "VANTYX.live WebSocket closed."
                );


                setConnection(
                    false,
                    "Reconnecting to VANTYX market engine..."
                );


                clearTimeout(
                    reconnectTimer
                );


                reconnectTimer =
                    setTimeout(
                        connectWebSocket,
                        4000
                    );

            };

    }


    // ========================================================
    // MARKET BUTTONS
    // ========================================================

    document
        .querySelectorAll(
            ".market-chip"
        )
        .forEach(
            chip => {

                chip.addEventListener(
                    "click",
                    () => {

                        selectMarket(
                            chip.dataset.symbol
                        );

                    }
                );

            }
        );


    // ========================================================
    // TRADE SELECT
    // ========================================================

    if (
        tradeMarket
    ) {

        tradeMarket.addEventListener(
            "change",
            () => {

                selectMarket(
                    tradeMarket.value
                );

            }
        );

    }


    // ========================================================
    // TIMEFRAMES
    // ========================================================

    const timeframeMap = {

        "1m":
            60,

        "5m":
            300,

        "15m":
            900,

        "30m":
            1800,

        "1H":
            3600,

        "4H":
            14400,

        "1D":
            86400

    };


    document
        .querySelectorAll(
            ".timeframe"
        )
        .forEach(
            button => {

                const label =
                    button.textContent.trim();


                if (
                    !timeframeMap[label]
                ) {

                    return;

                }


                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".timeframe"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        currentTimeframe =
                            timeframeMap[
                                label
                            ];


                        requestHistory();

                    }
                );

            }
        );


    // ========================================================
    // RESIZE
    // ========================================================

    window.addEventListener(
        "resize",
        () => {

            drawChart();

        }
    );


    // ========================================================
    // START
    // ========================================================

    loadMarketsREST();

    connectWebSocket();


    /*
    | REST fallback refresh.
    | This is especially useful while debugging
    | the WebSocket layer.
    */

    setInterval(
        loadMarketsREST,
        3000
    );


})();
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| SERVE VANTYX FX
|--------------------------------------------------------------------------
*/

app.use(
    express.static(
        path.join(__dirname, "..")
    )
);

/*
|--------------------------------------------------------------------------
| DERIV
|--------------------------------------------------------------------------
*/

const DERIV_WS_URL =
    "wss://api.derivws.com/trading/v1/options/ws/public";

let derivSocket = null;
let derivConnected = false;
let reconnectTimer = null;
let nextRequestId = 100;

/*
|--------------------------------------------------------------------------
| VANTYX.live browser connections
|--------------------------------------------------------------------------
*/

const browserClients = new Set();

/*
|--------------------------------------------------------------------------
| Requested markets
|--------------------------------------------------------------------------
*/

const requestedMarkets = {
    XAUUSD: null,
    EURUSD: null,
    GBPUSD: null,
    BTCUSD: null
};

/*
|--------------------------------------------------------------------------
| Market state
|--------------------------------------------------------------------------
*/

const markets = {

    XAUUSD: {
        displayName: "Gold / USD",
        symbol: null,
        price: null,
        previous: null,
        timestamp: null,
        pipSize: null,
        market: "commodities",
        exchangeOpen: false,
        suspended: false,
        status: "waiting"
    },

    EURUSD: {
        displayName: "EUR / USD",
        symbol: null,
        price: null,
        previous: null,
        timestamp: null,
        pipSize: null,
        market: "forex",
        exchangeOpen: false,
        suspended: false,
        status: "waiting"
    },

    GBPUSD: {
        displayName: "GBP / USD",
        symbol: null,
        price: null,
        previous: null,
        timestamp: null,
        pipSize: null,
        market: "forex",
        exchangeOpen: false,
        suspended: false,
        status: "waiting"
    },

    BTCUSD: {
        displayName: "BTC / USD",
        symbol: null,
        price: null,
        previous: null,
        timestamp: null,
        pipSize: null,
        market: "cryptocurrency",
        exchangeOpen: false,
        suspended: false,
        status: "waiting"
    }

};

/*
|--------------------------------------------------------------------------
| BROWSER BROADCAST
|--------------------------------------------------------------------------
*/

function sendBrowser(client, payload) {

    if (
        client.readyState ===
        WebSocket.OPEN
    ) {

        client.send(
            JSON.stringify(payload)
        );

    }

}

function broadcast(payload) {

    for (
        const client of browserClients
    ) {

        sendBrowser(
            client,
            payload
        );

    }

}

/*
|--------------------------------------------------------------------------
| FIND SYMBOL
|--------------------------------------------------------------------------
*/

function findSymbol(
    activeSymbols,
    wanted
) {

    const target =
        String(wanted)
            .toUpperCase()
            .replace(/\//g, "")
            .replace(/\s/g, "");

    return activeSymbols.find(
        item => {

            const symbol =
                String(
                    item.underlying_symbol ||
                    ""
                )
                .toUpperCase()
                .replace(/\//g, "")
                .replace(/\s/g, "");

            const name =
                String(
                    item.underlying_symbol_name ||
                    ""
                )
                .toUpperCase()
                .replace(/\//g, "")
                .replace(/\s/g, "");

            return (
                symbol === target ||
                name === target ||
                symbol.includes(target) ||
                name.includes(target)
            );

        }
    );

}

/*
|--------------------------------------------------------------------------
| RESET MARKET STATE
|--------------------------------------------------------------------------
*/

function resetMarkets() {

    Object.keys(markets)
        .forEach(name => {

            markets[name].symbol = null;
            markets[name].price = null;
            markets[name].previous = null;
            markets[name].timestamp = null;
            markets[name].pipSize = null;
            markets[name].exchangeOpen = false;
            markets[name].suspended = false;
            markets[name].status = "waiting";

            requestedMarkets[name] = null;

        });

}

/*
|--------------------------------------------------------------------------
| REQUEST ACTIVE SYMBOLS
|--------------------------------------------------------------------------
*/

function requestActiveSymbols() {

    if (
        !derivSocket ||
        derivSocket.readyState !==
        WebSocket.OPEN
    ) {

        return;

    }

    console.log(
        "VANTYX FX: Requesting active symbols..."
    );

    derivSocket.send(

        JSON.stringify({

            active_symbols: "brief",

            req_id:
                nextRequestId++

        })

    );

}

/*
|--------------------------------------------------------------------------
| VALIDATE MARKETS
|--------------------------------------------------------------------------
*/

function subscribeToValidatedMarkets(
    activeSymbols
) {

    resetMarkets();

    console.log(
        "VANTYX FX: Validating requested markets..."
    );

    Object.keys(requestedMarkets)
        .forEach(wanted => {

            const match =
                findSymbol(
                    activeSymbols,
                    wanted
                );

            if (!match) {

                markets[wanted].status =
                    "unavailable";

                console.log(
                    `VANTYX FX: ${wanted} not found.`
                );

                return;

            }

            const symbol =
                match.underlying_symbol;

            const open =
                Number(
                    match.exchange_is_open
                ) === 1;

            const suspended =
                Number(
                    match.is_trading_suspended
                ) === 1;

            requestedMarkets[wanted] =
                symbol;

            markets[wanted].displayName =
                match.underlying_symbol_name ||
                wanted;

            markets[wanted].symbol =
                symbol;

            markets[wanted].pipSize =
                match.pip_size ??
                null;

            markets[wanted].market =
                match.market ||
                null;

            markets[wanted].exchangeOpen =
                open;

            markets[wanted].suspended =
                suspended;

            if (suspended) {

                markets[wanted].status =
                    "suspended";

            }
            else if (open) {

                markets[wanted].status =
                    "subscribing";

            }
            else {

                markets[wanted].status =
                    "closed";

            }

            console.log(
                `VANTYX FX: ${wanted} -> ${symbol} | ${
                    suspended
                        ? "SUSPENDED"
                        : open
                            ? "OPEN"
                            : "CLOSED"
                }`
            );

        });

    /*
    |--------------------------------------------------------------------------
    | Subscribe ONLY to open markets
    |--------------------------------------------------------------------------
    */

    Object.entries(requestedMarkets)
        .forEach(
            ([wanted, symbol]) => {

                if (!symbol) {
                    return;
                }

                const state =
                    markets[wanted];

                if (
                    state.status !==
                    "subscribing"
                ) {

                    console.log(
                        `VANTYX FX: ${wanted} not subscribed. Status: ${state.status}`
                    );

                    return;

                }

                console.log(
                    `VANTYX FX: Subscribing ${wanted} (${symbol})`
                );

                derivSocket.send(

                    JSON.stringify({

                        ticks:
                            symbol,

                        subscribe:
                            1,

                        req_id:
                            nextRequestId++

                    })

                );

            }
        );

    broadcast({

        type:
            "markets",

        connected:
            derivConnected,

        markets

    });

}

/*
|--------------------------------------------------------------------------
| HISTORICAL TICKS
|--------------------------------------------------------------------------
|
| Used by VANTYX.live to initialise its chart.
|
*/

function requestHistory(
    client,
    symbol,
    count = 200
) {

    if (
        !derivSocket ||
        derivSocket.readyState !==
        WebSocket.OPEN
    ) {

        return;

    }

    const target =
        Object.entries(
            requestedMarkets
        )
        .find(
            ([, value]) =>
                value === symbol
        );

    if (!target) {
        return;
    }

    const marketName =
        target[0];

    console.log(
        `VANTYX FX: Requesting history for ${marketName} (${symbol})`
    );

    derivSocket.send(

        JSON.stringify({

            ticks_history:
                symbol,

            end:
                "latest",

            count:
                Number(count) || 200,

            style:
                "candles",

            granularity:
                60,

            subscribe:
                0,

            req_id:
                nextRequestId++

        })

    );

    /*
    |------------------------------------------------------------
    | Link the request back to the browser.
    |------------------------------------------------------------
    */

    pendingHistory.set(
        nextHistoryRequestId,
        client
    );

}

/*
|--------------------------------------------------------------------------
| HISTORY REQUEST TRACKING
|--------------------------------------------------------------------------
*/

const pendingHistory = new Map();
let nextHistoryRequestId = 5000;

/*
|--------------------------------------------------------------------------
| CONNECT TO DERIV
|--------------------------------------------------------------------------
*/

function connectDeriv() {

    if (
        derivSocket &&
        (
            derivSocket.readyState ===
            WebSocket.OPEN ||
            derivSocket.readyState ===
            WebSocket.CONNECTING
        )
    ) {

        return;

    }

    console.log(
        "VANTYX FX: Connecting to Deriv..."
    );

    derivSocket =
        new WebSocket(
            DERIV_WS_URL
        );

    /*
    |--------------------------------------------------------------------------
    | OPEN
    |--------------------------------------------------------------------------
    */

    derivSocket.on(
        "open",
        () => {

            derivConnected = true;

            console.log(
                "VANTYX FX: Deriv WebSocket connected."
            );

            broadcast({

                type:
                    "connection",

                connected:
                    true,

                provider:
                    "Deriv"

            });

            requestActiveSymbols();

        }
    );

    /*
    |--------------------------------------------------------------------------
    | MESSAGE
    |--------------------------------------------------------------------------
    */

    derivSocket.on(
        "message",
        raw => {

            try {

                const message =
                    JSON.parse(
                        raw.toString()
                    );

                /*
                |--------------------------------------------------------------------------
                | ERROR
                |--------------------------------------------------------------------------
                */

                if (message.error) {

                    console.error(
                        "VANTYX FX: Deriv API error:",
                        message.error
                    );

                    broadcast({

                        type:
                            "error",

                        error:
                            message.error.message ||
                            "Deriv API error",

                        code:
                            message.error.code ||
                            null

                    });

                    return;

                }

                /*
                |--------------------------------------------------------------------------
                | ACTIVE SYMBOLS
                |--------------------------------------------------------------------------
                */

                if (
                    message.msg_type ===
                    "active_symbols"
                ) {

                    const activeSymbols =
                        Array.isArray(
                            message.active_symbols
                        )
                            ? message.active_symbols
                            : [];

                    console.log("");
                    console.log(
                        "=========================================="
                    );
                    console.log(
                        "VANTYX FX: DERIV ACTIVE SYMBOLS"
                    );
                    console.log(
                        "=========================================="
                    );
                    console.log(
                        `Total symbols returned: ${activeSymbols.length}`
                    );
                    console.log("");

                    /*
                    |--------------------------------------------------------------------------
                    | Print only relevant markets
                    |--------------------------------------------------------------------------
                    */

                    Object.keys(
                        requestedMarkets
                    )
                    .forEach(wanted => {

                        const match =
                            findSymbol(
                                activeSymbols,
                                wanted
                            );

                        if (match) {

                            console.log(
                                `${wanted}: ${match.underlying_symbol} | ${match.underlying_symbol_name}`
                            );

                        }
                        else {

                            console.log(
                                `${wanted}: NOT FOUND`
                            );

                        }

                    });

                    console.log("");
                    console.log(
                        "=========================================="
                    );
                    console.log("");

                    if (
                        activeSymbols.length ===
                        0
                    ) {

                        console.log(
                            "VANTYX FX: No active symbols returned."
                        );

                        broadcast({

                            type:
                                "markets_unavailable",

                            connected:
                                derivConnected,

                            message:
                                "Deriv returned no active symbols."

                        });

                        setTimeout(
                            requestActiveSymbols,
                            15000
                        );

                        return;

                    }

                    subscribeToValidatedMarkets(
                        activeSymbols
                    );

                    return;

                }

                /*
                |--------------------------------------------------------------------------
                | TICK
                |--------------------------------------------------------------------------
                */

                if (
                    message.msg_type ===
                    "tick" &&
                    message.tick
                ) {

                    const tick =
                        message.tick;

                    const symbol =
                        tick.symbol;

                    const quote =
                        Number(
                            tick.quote
                        );

                    const epoch =
                        Number(
                            tick.epoch
                        );

                    if (
                        !symbol ||
                        !Number.isFinite(
                            quote
                        ) ||
                        !Number.isFinite(
                            epoch
                        )
                    ) {

                        return;

                    }

                    const marketEntry =
                        Object.entries(
                            requestedMarkets
                        )
                        .find(
                            ([, value]) =>
                                value === symbol
                        );

                    if (!marketEntry) {
                        return;
                    }

                    const marketName =
                        marketEntry[0];

                    const market =
                        markets[
                            marketName
                        ];

                    market.previous =
                        market.price;

                    market.price =
                        quote;

                    market.timestamp =
                        epoch;

                    market.status =
                        "live";

                    broadcast({

                        type:
                            "tick",

                        market:
                            marketName,

                        displayName:
                            market.displayName,

                        symbol:
                            symbol,

                        price:
                            market.price,

                        previous:
                            market.previous,

                        timestamp:
                            market.timestamp,

                        status:
                            market.status

                    });

                    return;

                }

                /*
                |--------------------------------------------------------------------------
                | HISTORICAL DATA
                |--------------------------------------------------------------------------
                */

                if (
    message.msg_type ===
    "candles"
) {

    const requestId =
        message.req_id;

    const client =
        pendingHistory.get(
            requestId
        );

    if (client) {

        pendingHistory.delete(
            requestId
        );

        sendBrowser(
            client,
            {

                type:
                    "history",

                candles:
                    Array.isArray(
                        message.candles
                    )
                        ? message.candles
                        : []

            }
        );

    }

    return;
} {

                    const requestId =
                        message.req_id;

                    const client =
                        pendingHistory.get(
                            requestId
                        );

                    if (
                        client
                    ) {

                        pendingHistory.delete(
                            requestId
                        );

                        sendBrowser(
                            client,
                            {

                                type:
                                    "history",

                                history:
                                    message.history ||
                                    null,

                                candles:
                                    message.candles ||
                                    null

                            }
                        );

                    }

                    return;

                }

            }
            catch (error) {

                console.error(
                    "VANTYX FX: Message error:",
                    error.message
                );

            }

        }
    );

    /*
    |--------------------------------------------------------------------------
    | ERROR
    |--------------------------------------------------------------------------
    */

    derivSocket.on(
        "error",
        error => {

            derivConnected =
                false;

            console.error(
                "VANTYX FX: WebSocket error:",
                error.message
            );

            broadcast({

                type:
                    "connection",

                connected:
                    false,

                provider:
                    "Deriv",

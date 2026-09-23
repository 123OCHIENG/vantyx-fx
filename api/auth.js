// ============================================================
// VANTYX FX — AUTHENTICATION SYSTEM
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(
    __dirname,
    "data",
    "users.json"
);


// ============================================================
// FILE HELPERS
// ============================================================

function ensureUsersFile() {

    const directory =
        path.dirname(USERS_FILE);

    if (!fs.existsSync(directory)) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );

    }

    if (!fs.existsSync(USERS_FILE)) {

        fs.writeFileSync(
            USERS_FILE,
            "[]",
            "utf8"
        );

    }

}


function readUsers() {

    ensureUsersFile();

    try {

        const data =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        return JSON.parse(data || "[]");

    } catch (error) {

        console.error(
            "VANTYX AUTH: Failed to read users:",
            error
        );

        return [];

    }

}


function writeUsers(users) {

    ensureUsersFile();

    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        ),
        "utf8"
    );

}


// ============================================================
// PASSWORD HASHING
// ============================================================

function hashPassword(password) {

    return new Promise(
        (resolve, reject) => {

            const salt =
                crypto.randomBytes(16)
                .toString("hex");

            crypto.scrypt(
                password,
                salt,
                64,
                (error, derivedKey) => {

                    if (error) {

                        reject(error);

                        return;

                    }

                    resolve(
                        `${salt}:${derivedKey.toString("hex")}`
                    );

                }
            );

        }
    );

}


function verifyPassword(
    password,
    storedPassword
) {

    return new Promise(
        (resolve, reject) => {

            try {

                const parts =
                    storedPassword.split(":");

                if (parts.length !== 2) {

                    resolve(false);

                    return;

                }

                const salt =
                    parts[0];

                const storedHash =
                    Buffer.from(
                        parts[1],
                        "hex"
                    );

                crypto.scrypt(
                    password,
                    salt,
                    64,
                    (error, derivedKey) => {

                        if (error) {

                            reject(error);

                            return;

                        }

                        const isValid =
                            crypto.timingSafeEqual(
                                storedHash,
                                derivedKey
                            );

                        resolve(isValid);

                    }
                );

            } catch (error) {

                reject(error);

            }

        }
    );

}


// ============================================================
// USER SANITIZATION
// Never send password information to browser.
// ============================================================

function sanitizeUser(user) {

    return {

        id:
            user.id,

        fullName:
            user.fullName,

        email:
            user.email,

        createdAt:
            user.createdAt

    };

}


// ============================================================
// AUTH ROUTES
// ============================================================

function setupAuthRoutes(
    app,
    session
) {


    // ========================================================
    // SIGN UP
    // ========================================================

    app.post(
        "/api/auth/signup",
        async (req, res) => {

            try {

                const {
                    fullName,
                    email,
                    password
                } = req.body;


                if (
                    !fullName ||
                    !email ||
                    !password
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Full name, email and password are required."

                    });

                }


                const cleanName =
                    String(fullName).trim();


                const cleanEmail =
                    String(email)
                        .trim()
                        .toLowerCase();


                if (
                    cleanName.length < 2
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Please enter a valid full name."

                    });

                }


                if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                        .test(cleanEmail)
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Please enter a valid email address."

                    });

                }


                if (
                    password.length < 8
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Password must contain at least 8 characters."

                    });

                }


                const users =
                    readUsers();


                const existingUser =
                    users.find(
                        user =>
                            user.email ===
                            cleanEmail
                    );


                if (existingUser) {

                    return res.status(409).json({

                        success: false,

                        message:
                            "An account with this email already exists."

                    });

                }


                const passwordHash =
                    await hashPassword(
                        password
                    );


                const user = {

                    id:
                        crypto.randomUUID(),

                    fullName:
                        cleanName,

                    email:
                        cleanEmail,

                    passwordHash:

                        passwordHash,

                    createdAt:
                        new Date()
                            .toISOString()

                };


                users.push(user);

                writeUsers(users);


                req.session.user = {

                    id:
                        user.id,

                    email:
                        user.email,

                    fullName:
                        user.fullName

                };


                return res.status(201).json({

                    success: true,

                    message:
                        "Account created successfully.",

                    user:
                        sanitizeUser(user)

                });

            } catch (error) {

                console.error(
                    "VANTYX AUTH SIGNUP ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to create your account."

                });

            }

        }
    );


    // ========================================================
    // SIGN IN
    // ========================================================

    app.post(
        "/api/auth/signin",
        async (req, res) => {

            try {

                const {
                    email,
                    password
                } = req.body;


                if (
                    !email ||
                    !password
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Email and password are required."

                    });

                }


                const cleanEmail =
                    String(email)
                        .trim()
                        .toLowerCase();


                const users =
                    readUsers();


                const user =
                    users.find(
                        item =>
                            item.email ===
                            cleanEmail
                    );


                if (!user) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "Invalid email or password."

                    });

                }


                const valid =
                    await verifyPassword(
                        password,
                        user.passwordHash
                    );


                if (!valid) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "Invalid email or password."

                    });

                }


                req.session.user = {

                    id:
                        user.id,

                    email:
                        user.email,

                    fullName:
                        user.fullName

                };


                return res.json({

                    success: true,

                    message:
                        "Signed in successfully.",

                    user:
                        sanitizeUser(user)

                });

            } catch (error) {

                console.error(
                    "VANTYX AUTH SIGNIN ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to sign in."

                });

            }

        }
    );


    // ========================================================
    // CURRENT USER
    // ========================================================

    app.get(
        "/api/auth/me",
        (req, res) => {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.json({

                    authenticated:
                        false,

                    user:
                        null

                });

            }


            return res.json({

                authenticated:
                    true,

                user:
                    req.session.user

            });

        }
    );


    // ========================================================
    // LOGOUT
    // ========================================================

    app.post(
        "/api/auth/logout",
        (req, res) => {

            req.session.destroy(
                error => {

                    if (error) {

                        console.error(
                            "VANTYX AUTH LOGOUT ERROR:",
                            error
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to log out."

                        });

                    }


                    res.clearCookie(
                        "vantyx.sid"
                    );


                    return res.json({

                        success: true,

                        message:
                            "Logged out successfully."

                    });

                }
            );

        }
    );


    // ========================================================
    // PROTECTED ROUTE EXAMPLE
    // ========================================================

    app.get(
        "/api/auth/protected",
        (req, res) => {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Authentication required."

                });

            }


            return res.json({

                success: true,

                message:
                    "You have access to this protected area.",

                user:
                    req.session.user

            });

        }
    );

}


module.exports = {
    setupAuthRoutes
};
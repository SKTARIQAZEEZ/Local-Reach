const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../database");

const router = express.Router();


// =========================
// SIGNUP
// =========================

router.post("/signup", async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone,
            password,
            role
        } = req.body;

        if (!full_name || !email || !password || !role) {
            return res.status(400).json({
                message: "Please fill all required fields"
            });
        }

        if (!["advertiser", "screen_owner"].includes(role)) {
            return res.status(400).json({
                message: "Invalid account type"
            });
        }

        const existingUser = await db.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users
            (full_name, email, phone, password_hash, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, full_name, email, phone, role, created_at`,
            [
                full_name,
                email,
                phone || null,
                passwordHash,
                role
            ]
        );

        const user = result.rows[0];

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(201).json({
            message: "Account created successfully",
            user,
            token
        });

    } catch (error) {
        console.error("Signup error:", error);

        res.status(500).json({
            message: "Server error during signup"
        });
    }
});


// =========================
// LOGIN
// =========================

router.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            message: "Login successful",
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            token
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Server error during login"
        });
    }
});

// =========================
// FORGOT PASSWORD
// =========================

router.post("/forgot-password", async (req, res) => {
    try {

        const {
            phone,
            newPassword
        } = req.body;

        if (!phone || !newPassword) {
            return res.status(400).json({
                message: "Mobile number and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        // Find user using mobile number
        const result = await db.query(
            "SELECT id FROM users WHERE phone = $1",
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "No account found with this mobile number"
            });
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(
            newPassword,
            10
        );

        // Update password
        await db.query(
            `UPDATE users
             SET password_hash = $1
             WHERE phone = $2`,
            [
                passwordHash,
                phone
            ]
        );

        res.json({
            message: "Password reset successfully"
        });

    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );

        res.status(500).json({
            message: "Server error while resetting password"
        });
    }
});
module.exports = router;
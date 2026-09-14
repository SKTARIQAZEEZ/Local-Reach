const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// GET ALL USERS
router.get(
    "/users",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    role,
                    created_at
                FROM users
                ORDER BY created_at DESC
                `
            );

            res.json({
                users: result.rows
            });

        } catch (error) {

            console.error(
                "Admin users fetch error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading users"
            });

        }
    }
);


module.exports = router;
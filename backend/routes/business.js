const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


/*
    CREATE BUSINESS
    POST /api/business
*/

router.post(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const {
            name,
            category,
            address,
            city,
            area,
            phone,
            website
        } = req.body;

        try {

            // Check required fields

            if (!name || !category || !address || !city) {

                return res.status(400).json({
                    message: "Please fill in all required fields"
                });

            }


            // Insert business into database

            const result = await db.query(
                `
                INSERT INTO businesses
                (
                    owner_id,
                    name,
                    category,
                    address,
                    city,
                    area,
                    phone,
                    website
                )
                VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
                `,
                [
                    req.user.id,
                    name,
                    category,
                    address,
                    city,
                    area || null,
                    phone || null,
                    website || null
                ]
            );


            res.status(201).json({
                message: "Business created successfully",
                business: result.rows[0]
            });

        } catch (error) {

            console.error("Business creation error:", error);

            res.status(500).json({
                message: "Server error while creating business"
            });

        }
    }
);

// Get logged-in advertiser's business

router.get(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {
        try {
            const result = await db.query(
                `
                SELECT
                    id,
                    owner_id,
                    name,
                    category,
                    address,
                    city,
                    area
                FROM businesses
                WHERE owner_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                `,
                [req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Business not found"
                });
            }

            res.json({
                business: result.rows[0]
            });

        } catch (error) {
            console.error("Business fetch error:", error);

            res.status(500).json({
                message: "Server error while fetching business"
            });
        }
    }
);
module.exports = router;
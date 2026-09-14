const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// REGISTER NEW SCREEN
// SCREEN OWNER ONLY
// ============================================================

router.post(
    "/",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        try {

            const {
                screenId,
                screenName,
                businessName,
                businessCategory,
                address,
                city,
                area,
                latitude,
                longitude,
                screenType,
                screenSize,
                operatingStart,
                operatingEnd,
                availableAdStart,
                availableAdEnd,
                pricePerWeek,
                estimatedDailyPlays
            } = req.body;


            // ----------------------------------------------------
            // REQUIRED FIELD VALIDATION
            // ----------------------------------------------------

            if (
                !screenId ||
                !screenName ||
                !businessName ||
                !city ||
                !area ||
                !screenType ||
                !screenSize
            ) {

                return res.status(400).json({
                    message:
                        "Screen ID, screen name, business name, city, area, screen type and screen size are required"
                });

            }


            // ----------------------------------------------------
            // CHECK DUPLICATE SCREEN ID
            // ----------------------------------------------------

            const existingScreen = await db.query(
                `
                SELECT
                    id,
                    screen_id,
                    status
                FROM screens
                WHERE screen_id = $1
                `,
                [screenId]
            );


            if (existingScreen.rows.length > 0) {

                return res.status(400).json({
                    message:
                        "A screen with this Screen ID already exists"
                });

            }


            // ----------------------------------------------------
            // VALIDATE PRICE
            // ----------------------------------------------------

            const finalPrice =
                pricePerWeek === undefined ||
                pricePerWeek === null ||
                pricePerWeek === ""
                    ? 99
                    : Number(pricePerWeek);


            if (
                !Number.isFinite(finalPrice) ||
                finalPrice < 0
            ) {

                return res.status(400).json({
                    message:
                        "Price per week must be a valid positive number"
                });

            }


            // ----------------------------------------------------
            // VALIDATE ESTIMATED DAILY PLAYS
            // ----------------------------------------------------

            const finalDailyPlays =
                estimatedDailyPlays === undefined ||
                estimatedDailyPlays === null ||
                estimatedDailyPlays === ""
                    ? 100
                    : Number(estimatedDailyPlays);


            if (
                !Number.isInteger(finalDailyPlays) ||
                finalDailyPlays < 0
            ) {

                return res.status(400).json({
                    message:
                        "Estimated daily plays must be a valid whole number"
                });

            }


            // ----------------------------------------------------
            // VALIDATE LATITUDE / LONGITUDE IF PROVIDED
            // ----------------------------------------------------

            let finalLatitude = null;
            let finalLongitude = null;


            if (
                latitude !== undefined &&
                latitude !== null &&
                latitude !== ""
            ) {

                finalLatitude = Number(latitude);

                if (
                    !Number.isFinite(finalLatitude) ||
                    finalLatitude < -90 ||
                    finalLatitude > 90
                ) {

                    return res.status(400).json({
                        message:
                            "Latitude must be between -90 and 90"
                    });

                }

            }


            if (
                longitude !== undefined &&
                longitude !== null &&
                longitude !== ""
            ) {

                finalLongitude = Number(longitude);

                if (
                    !Number.isFinite(finalLongitude) ||
                    finalLongitude < -180 ||
                    finalLongitude > 180
                ) {

                    return res.status(400).json({
                        message:
                            "Longitude must be between -180 and 180"
                    });

                }

            }


            // ----------------------------------------------------
            // INSERT SCREEN
            // ----------------------------------------------------
            //
            // IMPORTANT:
            // New screens always start as "pending".
            // They must be approved by admin before becoming online.
            //
            // ----------------------------------------------------

            const result = await db.query(
                `
                INSERT INTO screens
                (
                    owner_id,
                    screen_id,
                    screen_name,
                    business_name,
                    business_category,
                    address,
                    city,
                    area,
                    latitude,
                    longitude,
                    screen_type,
                    screen_size,
                    operating_start,
                    operating_end,
                    available_ad_start,
                    available_ad_end,
                    price_per_week,
                    estimated_daily_plays,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    'pending'
                )
                RETURNING *
                `,
                [
                    req.user.id,
                    screenId,
                    screenName,
                    businessName,
                    businessCategory || null,
                    address || null,
                    city,
                    area,
                    finalLatitude,
                    finalLongitude,
                    screenType,
                    screenSize,
                    operatingStart || null,
                    operatingEnd || null,
                    availableAdStart || null,
                    availableAdEnd || null,
                    finalPrice,
                    finalDailyPlays
                ]
            );


            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            res.status(201).json({

                message:
                    "Screen registered successfully and submitted for admin approval",

                screen:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Screen registration error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while registering screen"
            });

        }

    }
);



// ============================================================
// GET AVAILABLE SCREENS
// ADVERTISER ONLY
// ============================================================

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
                    screen_id,
                    screen_name,
                    business_name,
                    business_category,
                    address,
                    city,
                    area,
                    latitude,
                    longitude,
                    screen_type,
                    screen_size,
                    operating_start,
                    operating_end,
                    available_ad_start,
                    available_ad_end,
                    price_per_week,
                    estimated_daily_plays,
                    status

                FROM screens

                WHERE status = 'online'

                ORDER BY created_at DESC
                `
            );

            res.json({
                screens: result.rows
            });

        } catch (error) {

            console.error(
                "Screen fetch error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while fetching screens"
            });

        }

    }
);



// ============================================================
// GET ONE SCREEN
// ADVERTISER ONLY
// ============================================================

router.get(
    "/:id",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    id,
                    screen_id,
                    screen_name,
                    business_name,
                    business_category,
                    address,
                    city,
                    area,
                    latitude,
                    longitude,
                    screen_type,
                    screen_size,
                    operating_start,
                    operating_end,
                    available_ad_start,
                    available_ad_end,
                    price_per_week,
                    estimated_daily_plays,
                    status

                FROM screens

                WHERE id = $1
                  AND status = 'online'
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Screen not found"
                });

            }


            res.json({
                screen:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Screen details error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while fetching screen"
            });

        }

    }
);


module.exports = router;
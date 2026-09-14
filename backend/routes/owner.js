const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// SCREEN OWNER DASHBOARD
// ============================================================

router.get(
    "/dashboard",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        try {

            // --------------------------------------------------
            // Get owner's screens
            // --------------------------------------------------

            const screensResult = await db.query(
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
                    price_per_week,
                    estimated_daily_plays,
                    status
                FROM screens
                WHERE owner_id = $1
                ORDER BY created_at DESC
                `,
                [req.user.id]
            );


            const screens = screensResult.rows;


            // --------------------------------------------------
            // Total screens
            // --------------------------------------------------

            const totalScreens =
                screens.length;


            // --------------------------------------------------
            // Online screens
            // --------------------------------------------------

            const onlineScreens =
                screens.filter(
                    screen => screen.status === "online"
                ).length;


            // --------------------------------------------------
            // Campaigns currently running
            // --------------------------------------------------

            const campaignsResult = await db.query(
                `
                SELECT COUNT(DISTINCT c.id) AS count
                FROM campaigns c
                JOIN campaign_screens cs
                    ON c.id = cs.campaign_id
                JOIN screens s
                    ON cs.screen_id = s.id
                WHERE s.owner_id = $1
                  AND c.status = 'active'
                `,
                [req.user.id]
            );


            const campaignsRunning =
                Number(
                    campaignsResult.rows[0].count
                );


            // --------------------------------------------------
            // Total earnings
            // --------------------------------------------------

            const earningsResult = await db.query(
                `
                SELECT
                    COALESCE(
                        SUM(se.amount),
                        0
                    ) AS total_earnings
                FROM screen_earnings se
                JOIN screens s
                    ON se.screen_id = s.id
                WHERE s.owner_id = $1
                `,
                [req.user.id]
            );


            const totalEarnings =
                Number(
                    earningsResult.rows[0].total_earnings
                );


            // --------------------------------------------------
            // Send dashboard data
            // --------------------------------------------------

            res.json({

                totalScreens,

                onlineScreens,

                campaignsRunning,

                totalEarnings,

                screens

            });


        } catch (error) {

            console.error(
                "Owner dashboard error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading owner dashboard"
            });

        }

    }
);


module.exports = router;
const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// GET OWNER EARNINGS
// ============================================================

router.get(
    "/earnings",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // TOTAL EARNINGS
            // ----------------------------------------------------

            const totalResult = await db.query(
                `
                SELECT
                    COALESCE(SUM(se.amount), 0) AS total_earnings
                FROM screen_earnings se

                JOIN screens s
                    ON se.screen_id = s.id

                WHERE s.owner_id = $1
                `,
                [req.user.id]
            );


            // ----------------------------------------------------
            // THIS MONTH'S EARNINGS
            // ----------------------------------------------------

            const monthlyResult = await db.query(
                `
                SELECT
                    COALESCE(SUM(se.amount), 0) AS monthly_earnings
                FROM screen_earnings se

                JOIN screens s
                    ON se.screen_id = s.id

                WHERE s.owner_id = $1

                AND se.created_at >=
                    DATE_TRUNC('month', CURRENT_DATE)
                `,
                [req.user.id]
            );


            // ----------------------------------------------------
            // PAID PAYOUTS
            // ----------------------------------------------------

            const paidResult = await db.query(
                `
                SELECT
                    COALESCE(SUM(amount), 0) AS paid_amount

                FROM payouts

                WHERE owner_id = $1
                  AND status = 'paid'
                `,
                [req.user.id]
            );


            // ----------------------------------------------------
            // PENDING PAYOUTS
            // ----------------------------------------------------

            const pendingResult = await db.query(
                `
                SELECT
                    COALESCE(SUM(amount), 0) AS pending_amount

                FROM payouts

                WHERE owner_id = $1
                  AND status = 'pending'
                `,
                [req.user.id]
            );


            // ----------------------------------------------------
            // EARNINGS HISTORY
            // ----------------------------------------------------

            const earningsResult = await db.query(
                `
                SELECT

                    se.id,

                    se.amount,

                    se.created_at,

                    c.name AS campaign_name,

                    s.screen_name,

                    'earned' AS status

                FROM screen_earnings se

                JOIN screens s
                    ON se.screen_id = s.id

                LEFT JOIN campaigns c
                    ON se.campaign_id = c.id

                WHERE s.owner_id = $1

                ORDER BY se.created_at DESC
                `,
                [req.user.id]
            );


            // ----------------------------------------------------
            // RESPONSE
            // ----------------------------------------------------

            const totalEarnings =
                Number(
                    totalResult.rows[0].total_earnings
                );


            const monthlyEarnings =
                Number(
                    monthlyResult.rows[0].monthly_earnings
                );


            const paidEarnings =
                Number(
                    paidResult.rows[0].paid_amount
                );


            const pendingEarnings =
                Number(
                    pendingResult.rows[0].pending_amount
                );


            res.json({

                totalEarnings,

                monthlyEarnings,

                paidEarnings,

                pendingEarnings,

                earnings:
                    earningsResult.rows

            });


        } catch (error) {

            console.error(
                "Owner earnings error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading owner earnings"
            });

        }

    }
);


module.exports = router;
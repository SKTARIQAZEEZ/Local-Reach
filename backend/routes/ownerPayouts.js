const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// GET OWNER PAYOUTS
// ============================================================

router.get(
    "/payouts",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // TOTAL EARNINGS
            // ----------------------------------------------------

            const earningsResult = await db.query(
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
            // PAYOUT HISTORY
            // ----------------------------------------------------

            const payoutsResult = await db.query(
                `
                SELECT
                    id,
                    amount,
                    status,
                    created_at
                FROM payouts
                WHERE owner_id = $1
                ORDER BY created_at DESC
                `,
                [req.user.id]
            );


            const totalEarnings =
                Number(
                    earningsResult.rows[0].total_earnings
                );

            const paidAmount =
                Number(
                    paidResult.rows[0].paid_amount
                );

            const pendingAmount =
                Number(
                    pendingResult.rows[0].pending_amount
                );


            // Money that has not already been paid
            // or placed into a pending payout

            const availableAmount =
                Math.max(
                    0,
                    totalEarnings -
                    paidAmount -
                    pendingAmount
                );


            res.json({

                availableAmount,

                pendingAmount,

                paidAmount,

                payouts:
                    payoutsResult.rows

            });


        } catch (error) {

            console.error(
                "Owner payout error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading payouts"
            });

        }

    }
);
// ============================================================
// REQUEST PAYOUT
// ============================================================

router.post(
    "/payouts",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        const client = await db.connect();

        try {

            await client.query("BEGIN");


            // ----------------------------------------------------
            // CALCULATE TOTAL EARNINGS
            // ----------------------------------------------------

            const earningsResult = await client.query(
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
            // CALCULATE ALREADY PAID
            // ----------------------------------------------------

            const paidResult = await client.query(
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
            // CALCULATE PENDING
            // ----------------------------------------------------

            const pendingResult = await client.query(
                `
                SELECT
                    COALESCE(SUM(amount), 0) AS pending_amount
                FROM payouts
                WHERE owner_id = $1
                  AND status = 'pending'
                `,
                [req.user.id]
            );


            const totalEarnings =
                Number(
                    earningsResult.rows[0].total_earnings
                );

            const paidAmount =
                Number(
                    paidResult.rows[0].paid_amount
                );

            const pendingAmount =
                Number(
                    pendingResult.rows[0].pending_amount
                );


            const availableAmount =
                totalEarnings -
                paidAmount -
                pendingAmount;


            // ----------------------------------------------------
            // CHECK AVAILABLE BALANCE
            // ----------------------------------------------------

            if (availableAmount <= 0) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        "No earnings available for payout"
                });

            }


            // ----------------------------------------------------
            // CREATE PENDING PAYOUT
            // ----------------------------------------------------

            const payoutResult = await client.query(
                `
                INSERT INTO payouts
                (
                    owner_id,
                    amount,
                    status
                )
                VALUES
                ($1, $2, 'pending')
                RETURNING *
                `,
                [
                    req.user.id,
                    availableAmount
                ]
            );


            await client.query("COMMIT");


            res.status(201).json({

                message:
                    "Payout request submitted successfully",

                payout:
                    payoutResult.rows[0]

            });


        } catch (error) {

            await client.query("ROLLBACK");

            console.error(
                "Request payout error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while requesting payout"
            });

        } finally {

            client.release();

        }

    }
);

module.exports = router;
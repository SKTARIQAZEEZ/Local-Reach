const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
    notifyPayoutApproved
} = require("../notificationHelper");


// GET ALL PAYOUTS
router.get(
    "/payouts",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    p.id,
                    p.amount,
                    p.status,
                    p.created_at,

                    u.full_name AS owner_name,
                    u.email AS owner_email,
                    u.phone AS owner_phone

                FROM payouts p

                JOIN users u
                    ON p.owner_id = u.id

                ORDER BY p.created_at DESC
                `
            );

            res.json({
                payouts: result.rows
            });

        } catch (error) {

            console.error(
                "Admin payout fetch error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading payouts"
            });

        }
    }
);


// APPROVE PAYOUT
// APPROVE PAYOUT
router.patch(
    "/payouts/:id/approve",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                UPDATE payouts

                SET status = 'paid'

                WHERE id = $1
                  AND status = 'pending'

                RETURNING *
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Pending payout not found"
                });

            }


            const payout = result.rows[0];


            // ==========================================
            // CREATE OWNER NOTIFICATION
            // ==========================================

            await notifyPayoutApproved(
                payout.owner_id,
                payout.id,
                payout.amount
            );


            res.json({

                message:
                    "Payout approved successfully",

                payout:
                    payout

            });


        } catch (error) {

            console.error(
                "Payout approval error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while approving payout"

            });

        }

    }
);

module.exports = router;
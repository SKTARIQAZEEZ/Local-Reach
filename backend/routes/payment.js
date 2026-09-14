const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
    notifyPaymentCompleted
} = require("../notificationHelper");


// ============================================================
// CREATE DEMO PAYMENT
// ============================================================

router.post(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const { campaignId, amount } = req.body;

        const client = await db.connect();

        try {

            // Validate input
            if (
                !campaignId ||
                amount === undefined ||
                amount === null ||
                Number(amount) <= 0
            ) {
                return res.status(400).json({
                    message:
                        "Campaign ID and a valid payment amount are required"
                });
            }


            // ====================================================
            // GET CAMPAIGN
            // ====================================================

            const campaignResult = await client.query(
                `
                SELECT
                    id,
                    name,
                    budget,
                    status
                FROM campaigns
                WHERE id = $1
                  AND advertiser_id = $2
                `,
                [
                    campaignId,
                    req.user.id
                ]
            );


            if (campaignResult.rows.length === 0) {

                return res.status(404).json({
                    message: "Campaign not found"
                });

            }


            const campaign =
                campaignResult.rows[0];


            // ====================================================
            // ONLY ACTIVE CAMPAIGNS CAN BE PAID
            // ====================================================

            if (campaign.status !== "active") {

                return res.status(400).json({
                    message:
                        "Only approved active campaigns can be paid for"
                });

            }


            // ====================================================
            // CHECK IF ALREADY PAID
            // ====================================================

            const existingPayment =
                await client.query(
                    `
                    SELECT
                        id,
                        amount,
                        status,
                        created_at
                    FROM payments
                    WHERE campaign_id = $1
                      AND advertiser_id = $2
                      AND status = 'paid'
                    ORDER BY created_at DESC
                    LIMIT 1
                    `,
                    [
                        campaignId,
                        req.user.id
                    ]
                );


            if (existingPayment.rows.length > 0) {

                return res.status(400).json({
                    message:
                        "This campaign has already been paid for",
                    payment:
                        existingPayment.rows[0]
                });

            }


            // ====================================================
            // PAYMENT MUST MATCH CAMPAIGN BUDGET
            // ====================================================

            if (
                Number(amount) !==
                Number(campaign.budget)
            ) {

                return res.status(400).json({
                    message:
                        "Payment amount must match the campaign budget"
                });

            }


            // ====================================================
            // START TRANSACTION
            // ====================================================

            await client.query("BEGIN");


            // ====================================================
            // CREATE PAYMENT
            // ====================================================

            const paymentResult =
                await client.query(
                    `
                    INSERT INTO payments
                    (
                        advertiser_id,
                        campaign_id,
                        amount,
                        status
                    )
                    VALUES
                    ($1, $2, $3, 'paid')
                    RETURNING *
                    `,
                    [
                        req.user.id,
                        campaignId,
                        amount
                    ]
                );


            // ====================================================
            // COMMIT
            // ====================================================

            await client.query("COMMIT");


// ==========================================
// CREATE PAYMENT NOTIFICATION
// ==========================================

await notifyPaymentCompleted(
    req.user.id,
    campaign.id,
    campaign.name,
    amount
);


res.status(201).json({
    message: "Demo payment successful",
    payment: paymentResult.rows[0],
    campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status
    }
});

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Payment rollback error:",
                    rollbackError
                );

            }


            console.error(
                "Payment error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while processing payment"
            });


        } finally {

            client.release();

        }

    }
);


// ============================================================
// GET ADVERTISER PAYMENT HISTORY
// ============================================================

router.get(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT
                        p.id,
                        p.campaign_id,
                        p.amount,
                        p.status,
                        p.created_at,
                        c.name AS campaign_name
                    FROM payments p
                    LEFT JOIN campaigns c
                        ON p.campaign_id = c.id
                    WHERE p.advertiser_id = $1
                    ORDER BY p.created_at DESC
                    `,
                    [
                        req.user.id
                    ]
                );


            res.json({
                payments:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Payment fetch error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching payments"
            });

        }

    }
);


module.exports = router;
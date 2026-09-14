const express = require("express");
const router = express.Router();

const db = require("../database");

const authenticateToken =
    require("../middleware/authMiddleware");

const requireRole =
    require("../middleware/roleMiddleware");

const {
    notifyScreenApproved,
    notifyScreenRejected
} = require("../notificationHelper");


// ============================================================
// GET ALL SCREENS
// ============================================================

router.get(
    "/screens",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    s.id,
                    s.screen_id,
                    s.screen_name,
                    s.business_name,
                    s.business_category,
                    s.address,
                    s.city,
                    s.area,
                    s.screen_type,
                    s.screen_size,
                    s.price_per_week,
                    s.estimated_daily_plays,
                    s.status,
                    s.created_at,

                    u.full_name AS owner_name,
                    u.email AS owner_email

                FROM screens s

                JOIN users u
                    ON s.owner_id = u.id

                ORDER BY s.created_at DESC
                `
            );


            res.json({
                screens: result.rows
            });


        } catch (error) {

            console.error(
                "Admin screens fetch error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while loading screens"
            });

        }

    }
);


// ============================================================
// APPROVE SCREEN
// ============================================================

router.patch(
    "/screens/:id/approve",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                UPDATE screens
                SET status = 'online'

                WHERE id = $1
                  AND status = 'pending'

                RETURNING *
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Screen not found or is not pending"
                });

            }


            const screen = result.rows[0];


            // ==================================================
            // CREATE OWNER NOTIFICATION
            // ==================================================

            await notifyScreenApproved(
                screen.owner_id,
                screen.id,
                screen.screen_name
            );


            res.json({

                message:
                    "Screen approved successfully",

                screen:
                    screen

            });


        } catch (error) {

            console.error(
                "Approve screen error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while approving screen"

            });

        }

    }
);


// ============================================================
// REJECT SCREEN
// ============================================================

router.patch(
    "/screens/:id/reject",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                UPDATE screens
                SET status = 'suspended'

                WHERE id = $1
                  AND status = 'pending'

                RETURNING *
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Screen not found or is not pending"
                });

            }


            const screen = result.rows[0];


            // ==================================================
            // CREATE OWNER NOTIFICATION
            // ==================================================

            await notifyScreenRejected(
                screen.owner_id,
                screen.id,
                screen.screen_name
            );


            res.json({

                message:
                    "Screen rejected successfully",

                screen:
                    screen

            });


        } catch (error) {

            console.error(
                "Reject screen error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while rejecting screen"

            });

        }

    }
);


module.exports = router;
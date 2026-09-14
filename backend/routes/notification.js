const express = require("express");

const router = express.Router();

const db = require("../database");

const authenticateToken =
    require("../middleware/authMiddleware");


/*
==================================================
GET ALL NOTIFICATIONS
==================================================
*/

router.get(
    "/",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        type,
                        title,
                        message,
                        related_campaign_id,
                        related_screen_id,
                        is_read,
                        created_at
                    FROM notifications
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    `,
                    [req.user.id]
                );


            res.json({
                notifications:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Fetch notifications error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching notifications"
            });

        }

    }
);


/*
==================================================
GET UNREAD NOTIFICATION COUNT
==================================================
*/

router.get(
    "/unread-count",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT COUNT(*) AS unread_count
                    FROM notifications
                    WHERE user_id = $1
                      AND is_read = FALSE
                    `,
                    [req.user.id]
                );


            res.json({
                unreadCount:
                    Number(
                        result.rows[0].unread_count
                    )
            });


        } catch (error) {

            console.error(
                "Unread notification count error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching unread notifications"
            });

        }

    }
);


/*
==================================================
MARK ONE NOTIFICATION AS READ
==================================================
*/

router.patch(
    "/:id/read",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    UPDATE notifications
                    SET is_read = TRUE
                    WHERE id = $1
                      AND user_id = $2
                    RETURNING *
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Notification not found"
                });

            }


            res.json({
                message:
                    "Notification marked as read",

                notification:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Mark notification read error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while updating notification"
            });

        }

    }
);


/*
==================================================
MARK ALL NOTIFICATIONS AS READ
==================================================
*/

router.patch(
    "/read-all",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    UPDATE notifications
                    SET is_read = TRUE
                    WHERE user_id = $1
                      AND is_read = FALSE
                    RETURNING id
                    `,
                    [req.user.id]
                );


            res.json({
                message:
                    "All notifications marked as read",

                updatedCount:
                    result.rows.length
            });


        } catch (error) {

            console.error(
                "Mark all notifications read error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while updating notifications"
            });

        }

    }
);


module.exports = router;
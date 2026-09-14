const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// GET CAMPAIGNS RUNNING ON OWNER'S SCREENS
// ============================================================

router.get(
    "/campaigns",
    authenticateToken,
    requireRole("screen_owner"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    c.id AS campaign_id,
                    c.name AS campaign_name,
                    c.status,
                    c.start_date,
                    c.end_date,

                    u.full_name AS advertiser_name,

                    s.screen_name,
                    s.screen_id,

                    /* ====================================================
                       PLAYBACK ANALYTICS
                       ==================================================== */

                    COUNT(DISTINCT pe.id) AS total_plays,

                    COUNT(
                        DISTINCT CASE
                            WHEN pe.status = 'verified'
                            THEN pe.id
                        END
                    ) AS verified_plays,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN pe.status = 'verified'
                                THEN pe.duration_seconds
                                ELSE 0
                            END
                        ),
                        0
                    ) AS verified_play_time_seconds,

                    /* ====================================================
                       OWNER EARNINGS
                       Calculated separately to avoid duplicate multiplication
                       from playback_events JOIN screen_earnings.
                       ==================================================== */

                    COALESCE(
                        (
                            SELECT SUM(se.amount)
                            FROM screen_earnings se
                            WHERE se.campaign_id = c.id
                              AND se.screen_id = s.id
                        ),
                        0
                    ) AS earnings

                FROM campaign_screens cs

                JOIN campaigns c
                    ON cs.campaign_id = c.id

                JOIN screens s
                    ON cs.screen_id = s.id

                JOIN users u
                    ON c.advertiser_id = u.id

                LEFT JOIN playback_events pe
                    ON pe.campaign_id = c.id
                    AND pe.screen_id = s.id

                WHERE s.owner_id = $1

                GROUP BY
    c.id,
    c.name,
    c.status,
    c.start_date,
    c.end_date,
    c.created_at,
    u.full_name,
    s.id,
    s.screen_name,
    s.screen_id

                ORDER BY c.created_at DESC
                `,
                [req.user.id]
            );


            res.json({
                campaigns: result.rows
            });


        } catch (error) {

            console.error(
                "Owner campaigns error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading owner campaigns"
            });

        }

    }
);


module.exports = router;
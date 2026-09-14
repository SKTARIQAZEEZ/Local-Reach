const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
    notifyCampaignApproved,
    notifyCampaignRejected
} = require("../notificationHelper");


// GET ALL CAMPAIGNS
router.get(
    "/campaigns",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    c.id,
                    c.name,
                    c.status,
                    c.start_date,
                    c.end_date,
                    c.budget,
                    c.target_city,
                    c.target_area,
                    c.created_at,

                    u.full_name AS advertiser_name,
                    u.email AS advertiser_email,

                    a.title AS advertisement_title,

                    COUNT(DISTINCT cs.screen_id)
                        AS screens_count,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN pe.status = 'verified'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS verified_plays

                FROM campaigns c

                JOIN users u
                    ON c.advertiser_id = u.id

                LEFT JOIN advertisements a
                    ON c.advertisement_id = a.id

                LEFT JOIN campaign_screens cs
                    ON c.id = cs.campaign_id

                LEFT JOIN playback_events pe
                    ON c.id = pe.campaign_id

                GROUP BY
                    c.id,
                    c.name,
                    c.status,
                    c.start_date,
                    c.end_date,
                    c.budget,
                    c.target_city,
                    c.target_area,
                    c.created_at,
                    u.full_name,
                    u.email,
                    a.title

                ORDER BY c.created_at DESC
                `
            );

            res.json({
                campaigns: result.rows
            });

        } catch (error) {

            console.error(
                "Admin campaigns fetch error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading campaigns"
            });

        }
    }
);
// Approve campaign
// Approve campaign
router.patch(
    "/campaigns/:id/approve",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                UPDATE campaigns
                SET status = 'active'
                WHERE id = $1
                  AND status = 'pending'
                RETURNING *
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Campaign not found or is not pending"
                });

            }


            const campaign = result.rows[0];


            // Create notification for advertiser
            await notifyCampaignApproved(
                campaign.advertiser_id,
                campaign.id,
                campaign.name
            );


            res.json({

                message:
                    "Campaign approved successfully",

                campaign:
                    campaign

            });


        } catch (error) {

            console.error(
                "Approve campaign error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while approving campaign"

            });

        }

    }
);

// Reject campaign
// Reject campaign
router.patch(
    "/campaigns/:id/reject",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                UPDATE campaigns
                SET status = 'rejected'
                WHERE id = $1
                  AND status = 'pending'
                RETURNING *
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Campaign not found or is not pending"
                });

            }


            const campaign = result.rows[0];


            // Create notification for advertiser
            await notifyCampaignRejected(
                campaign.advertiser_id,
                campaign.id,
                campaign.name
            );


            res.json({

                message:
                    "Campaign rejected successfully",

                campaign:
                    campaign

            });


        } catch (error) {

            console.error(
                "Reject campaign error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while rejecting campaign"

            });

        }

    }
);
// ============================================================
// GET CAMPAIGN DETAILS
// ============================================================

router.get(
    "/campaigns/:id",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    c.id,
                    c.name,
                    c.status,
                    c.start_date,
                    c.end_date,
                    c.budget,
                    c.target_city,
                    c.target_area,
                    c.radius_km,
                    c.created_at,

                    a.id AS advertisement_id,
                    a.title AS advertisement_title,
                    a.status AS advertisement_status,
                    a.duration_seconds,
                    a.file_type,

                    u.id AS advertiser_id,
                    u.full_name AS advertiser_name,
                    u.email AS advertiser_email,

                    COALESCE(
                        (
                            SELECT COUNT(*)
                            FROM playback_events pe
                            WHERE pe.campaign_id = c.id
                              AND pe.status = 'verified'
                        ),
                        0
                    ) AS verified_plays,

                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'id', s.id,
                                'screen_id', s.screen_id,
                                'screen_name', s.screen_name,
                                'business_name', s.business_name,
                                'city', s.city,
                                'area', s.area,
                                'status', s.status,
                                'price_per_week', s.price_per_week
                            )
                        ) FILTER (
                            WHERE s.id IS NOT NULL
                        ),
                        '[]'::json
                    ) AS screens

                FROM campaigns c

                LEFT JOIN advertisements a
                    ON c.advertisement_id = a.id

                LEFT JOIN users u
                    ON c.advertiser_id = u.id

                LEFT JOIN campaign_screens cs
                    ON c.id = cs.campaign_id

                LEFT JOIN screens s
                    ON cs.screen_id = s.id

                WHERE c.id = $1

                GROUP BY
                    c.id,
                    a.id,
                    u.id

                LIMIT 1
                `,
                [req.params.id]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Campaign not found"
                });

            }


            res.json({
                campaign: result.rows[0]
            });


        } catch (error) {

            console.error(
                "Admin campaign details error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while fetching campaign details"
            });

        }
    }
);

module.exports = router;
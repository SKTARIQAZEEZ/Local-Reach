const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// ADMIN PLATFORM DASHBOARD / ANALYTICS
// ============================================================

router.get(
    "/dashboard",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(`
                SELECT

                    /* =================================================
                       USERS
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM users
                    )::INTEGER
                        AS total_users,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE role = 'advertiser'
                    )::INTEGER
                        AS total_advertisers,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE role = 'screen_owner'
                    )::INTEGER
                        AS total_screen_owners,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE role = 'admin'
                    )::INTEGER
                        AS total_admins,


                    /* =================================================
                       SCREENS
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM screens
                    )::INTEGER
                        AS total_screens,

                    (
                        SELECT COUNT(*)
                        FROM screens
                        WHERE status = 'online'
                    )::INTEGER
                        AS online_screens,

                    (
                        SELECT COUNT(*)
                        FROM screens
                        WHERE status = 'offline'
                    )::INTEGER
                        AS offline_screens,

                    (
                        SELECT COUNT(*)
                        FROM screens
                        WHERE status = 'pending'
                    )::INTEGER
                        AS pending_screens,

                    (
                        SELECT COUNT(*)
                        FROM screens
                        WHERE status = 'suspended'
                    )::INTEGER
                        AS suspended_screens,


                    /* =================================================
                       CAMPAIGNS
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                    )::INTEGER
                        AS total_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'draft'
                    )::INTEGER
                        AS draft_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'pending'
                    )::INTEGER
                        AS pending_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'active'
                    )::INTEGER
                        AS active_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'paused'
                    )::INTEGER
                        AS paused_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'completed'
                    )::INTEGER
                        AS completed_campaigns,

                    (
                        SELECT COUNT(*)
                        FROM campaigns
                        WHERE status = 'rejected'
                    )::INTEGER
                        AS rejected_campaigns,


                    /* =================================================
                       PAYMENTS / REVENUE
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM payments
                    )::INTEGER
                        AS total_payment_count,

                    (
                        SELECT COUNT(*)
                        FROM payments
                        WHERE status = 'paid'
                    )::INTEGER
                        AS paid_payment_count,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM payments
                        WHERE status = 'paid'
                    )::NUMERIC(12,2)
                        AS total_revenue,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM payments
                        WHERE status = 'pending'
                    )::NUMERIC(12,2)
                        AS pending_payment_amount,


                    /* =================================================
                       PAYOUTS
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM payouts
                        WHERE status = 'pending'
                    )::INTEGER
                        AS pending_payout_count,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM payouts
                        WHERE status = 'pending'
                    )::NUMERIC(12,2)
                        AS pending_payouts,

                    (
                        SELECT COUNT(*)
                        FROM payouts
                        WHERE status = 'paid'
                    )::INTEGER
                        AS paid_payout_count,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM payouts
                        WHERE status = 'paid'
                    )::NUMERIC(12,2)
                        AS total_paid_out,


                    /* =================================================
                       PLAYBACK
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM playback_events
                    )::INTEGER
                        AS total_plays,

                    (
                        SELECT COUNT(*)
                        FROM playback_events
                        WHERE status = 'verified'
                    )::INTEGER
                        AS verified_plays,

                    (
                        SELECT COUNT(*)
                        FROM playback_events
                        WHERE status = 'failed'
                    )::INTEGER
                        AS failed_plays,

                    (
                        SELECT COALESCE(
                            SUM(duration_seconds),
                            0
                        )
                        FROM playback_events
                        WHERE status = 'verified'
                    )::INTEGER
                        AS verified_play_seconds,


                    /* =================================================
                       SCREEN BOOKINGS
                    ================================================= */

                    (
                        SELECT COUNT(*)
                        FROM campaign_screens
                    )::INTEGER
                        AS total_screen_bookings,


                    /* =================================================
                       OWNER EARNINGS
                    ================================================= */

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM screen_earnings
                    )::NUMERIC(12,2)
                        AS total_owner_earnings

            `);


            const analytics = result.rows[0];


            // --------------------------------------------------------
            // CALCULATE PLAYBACK SUCCESS RATE
            // --------------------------------------------------------

            const totalPlays =
                Number(analytics.total_plays || 0);

            const verifiedPlays =
                Number(analytics.verified_plays || 0);

            let playbackSuccessRate = 0;

            if (totalPlays > 0) {

                playbackSuccessRate =
                    Number(
                        (
                            verifiedPlays /
                            totalPlays
                        ) *
                        100
                    ).toFixed(1);
            }


            // --------------------------------------------------------
            // CALCULATE VERIFIED PLAY TIME
            // --------------------------------------------------------

            const verifiedPlaySeconds =
                Number(
                    analytics.verified_play_seconds || 0
                );

            const verifiedPlayMinutes =
                Math.floor(
                    verifiedPlaySeconds / 60
                );

            const verifiedPlayHours =
                Math.floor(
                    verifiedPlayMinutes / 60
                );

            const remainingMinutes =
                verifiedPlayMinutes % 60;


            // --------------------------------------------------------
            // RETURN DASHBOARD DATA
            // --------------------------------------------------------

           res.json({

    // ----------------------------------------------------
    // EXISTING DASHBOARD FIELDS
    // ----------------------------------------------------

    total_users:
        Number(
            analytics.total_users || 0
        ),

    total_screens:
        Number(
            analytics.total_screens || 0
        ),

    total_campaigns:
        Number(
            analytics.total_campaigns || 0
        ),

    pending_payouts:
        Number(
            analytics.pending_payouts || 0
        ),

    total_revenue:
        Number(
            analytics.total_revenue || 0
        ),

    // ----------------------------------------------------
    // FRONTEND DASHBOARD FIELDS
    // ----------------------------------------------------

    totalUsers:
        Number(
            analytics.total_users || 0
        ),

    totalScreens:
        Number(
            analytics.total_screens || 0
        ),

    totalCampaigns:
        Number(
            analytics.total_campaigns || 0
        ),

    pendingPayouts:
        Number(
            analytics.pending_payouts || 0
        ),

    totalRevenue:
        Number(
            analytics.total_revenue || 0
        ),

                // ----------------------------------------------------
                // USER ANALYTICS
                // ----------------------------------------------------

                users: {

                    total:
                        Number(
                            analytics.total_users || 0
                        ),

                    advertisers:
                        Number(
                            analytics.total_advertisers || 0
                        ),

                    screen_owners:
                        Number(
                            analytics.total_screen_owners || 0
                        ),

                    admins:
                        Number(
                            analytics.total_admins || 0
                        )
                },


                // ----------------------------------------------------
                // SCREEN ANALYTICS
                // ----------------------------------------------------

                screens: {

                    total:
                        Number(
                            analytics.total_screens || 0
                        ),

                    online:
                        Number(
                            analytics.online_screens || 0
                        ),

                    offline:
                        Number(
                            analytics.offline_screens || 0
                        ),

                    pending:
                        Number(
                            analytics.pending_screens || 0
                        ),

                    suspended:
                        Number(
                            analytics.suspended_screens || 0
                        )
                },


                // ----------------------------------------------------
                // CAMPAIGN ANALYTICS
                // ----------------------------------------------------

                campaigns: {

                    total:
                        Number(
                            analytics.total_campaigns || 0
                        ),

                    draft:
                        Number(
                            analytics.draft_campaigns || 0
                        ),

                    pending:
                        Number(
                            analytics.pending_campaigns || 0
                        ),

                    active:
                        Number(
                            analytics.active_campaigns || 0
                        ),

                    paused:
                        Number(
                            analytics.paused_campaigns || 0
                        ),

                    completed:
                        Number(
                            analytics.completed_campaigns || 0
                        ),

                    rejected:
                        Number(
                            analytics.rejected_campaigns || 0
                        )
                },


                // ----------------------------------------------------
                // PAYMENT ANALYTICS
                // ----------------------------------------------------

                payments: {

                    count:
                        Number(
                            analytics.total_payment_count || 0
                        ),

                    paid_count:
                        Number(
                            analytics.paid_payment_count || 0
                        ),

                    total_revenue:
                        Number(
                            analytics.total_revenue || 0
                        ),

                    pending_amount:
                        Number(
                            analytics.pending_payment_amount || 0
                        )
                },


                // ----------------------------------------------------
                // PAYOUT ANALYTICS
                // ----------------------------------------------------

                payouts: {

                    pending_count:
                        Number(
                            analytics.pending_payout_count || 0
                        ),

                    pending_amount:
                        Number(
                            analytics.pending_payouts || 0
                        ),

                    paid_count:
                        Number(
                            analytics.paid_payout_count || 0
                        ),

                    total_paid_out:
                        Number(
                            analytics.total_paid_out || 0
                        )
                },


                // ----------------------------------------------------
                // PLAYBACK ANALYTICS
                // ----------------------------------------------------

                playback: {

                    total_plays:
                        totalPlays,

                    verified_plays:
                        verifiedPlays,

                    failed_plays:
                        Number(
                            analytics.failed_plays || 0
                        ),

                    success_rate:
                        Number(
                            playbackSuccessRate
                        ),

                    verified_play_seconds:
                        verifiedPlaySeconds,

                    verified_play_minutes:
                        verifiedPlayMinutes,

                    verified_play_time:
                        `${verifiedPlayHours}h ${remainingMinutes}m`
                },


                // ----------------------------------------------------
                // BOOKING ANALYTICS
                // ----------------------------------------------------

                bookings: {

                    total:
                        Number(
                            analytics.total_screen_bookings || 0
                        )
                },


                // ----------------------------------------------------
                // OWNER EARNINGS
                // ----------------------------------------------------

                owner_earnings: {

                    total:
                        Number(
                            analytics.total_owner_earnings || 0
                        )
                }

            });

        } catch (error) {

            console.error(
                "Admin dashboard analytics error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading admin analytics"
            });
        }
    }
);


// ============================================================
// ADMIN ANALYTICS ENDPOINT
// ============================================================

router.get(
    "/analytics",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(`
                SELECT

                    /* Campaign status */
                    COUNT(*) FILTER (
                        WHERE status = 'draft'
                    )::INTEGER AS draft,

                    COUNT(*) FILTER (
                        WHERE status = 'pending'
                    )::INTEGER AS pending,

                    COUNT(*) FILTER (
                        WHERE status = 'active'
                    )::INTEGER AS active,

                    COUNT(*) FILTER (
                        WHERE status = 'paused'
                    )::INTEGER AS paused,

                    COUNT(*) FILTER (
                        WHERE status = 'completed'
                    )::INTEGER AS completed,

                    COUNT(*) FILTER (
                        WHERE status = 'rejected'
                    )::INTEGER AS rejected

                FROM campaigns
            `);


            const campaignStats =
                result.rows[0];


            const playbackResult =
                await db.query(`
                    SELECT

                        COUNT(*)::INTEGER
                            AS total_plays,

                        COUNT(*) FILTER (
                            WHERE status = 'verified'
                        )::INTEGER
                            AS verified_plays,

                        COUNT(*) FILTER (
                            WHERE status = 'failed'
                        )::INTEGER
                            AS failed_plays,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN status = 'verified'
                                    THEN duration_seconds
                                    ELSE 0
                                END
                            ),
                            0
                        )::INTEGER
                            AS verified_seconds

                    FROM playback_events
                `);


            const playbackStats =
                playbackResult.rows[0];


            res.json({

                campaigns: {

                    draft:
                        Number(
                            campaignStats.draft || 0
                        ),

                    pending:
                        Number(
                            campaignStats.pending || 0
                        ),

                    active:
                        Number(
                            campaignStats.active || 0
                        ),

                    paused:
                        Number(
                            campaignStats.paused || 0
                        ),

                    completed:
                        Number(
                            campaignStats.completed || 0
                        ),

                    rejected:
                        Number(
                            campaignStats.rejected || 0
                        )
                },

                playback: {

                    total_plays:
                        Number(
                            playbackStats.total_plays || 0
                        ),

                    verified_plays:
                        Number(
                            playbackStats.verified_plays || 0
                        ),

                    failed_plays:
                        Number(
                            playbackStats.failed_plays || 0
                        ),

                    verified_seconds:
                        Number(
                            playbackStats.verified_seconds || 0
                        )
                }

            });


        } catch (error) {

            console.error(
                "Admin analytics error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading analytics"
            });
        }
    }
);


module.exports = router;
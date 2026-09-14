const express = require("express");

const router = express.Router();

const db = require("../database");


// =====================================================
// DIRECT PLAYBACK RECORDING
// =====================================================
// This route supports the current TV Player:
//
// POST /api/player/playback
//
// It creates and completes one verified playback event.
// =====================================================

router.post(
    "/",
    async (req, res) => {

        try {

            const {
                screenId,
                advertisementId,
                campaignId,
                durationSeconds
            } = req.body;


            // -----------------------------
            // VALIDATION
            // -----------------------------

            if (
                !screenId ||
                !advertisementId ||
                !campaignId
            ) {

                return res.status(400).json({
                    message:
                        "screenId, advertisementId and campaignId are required"
                });

            }


            // -----------------------------
            // VERIFY SCREEN + CAMPAIGN +
            // ADVERTISEMENT ASSIGNMENT
            // -----------------------------

            const check = await db.query(
                `
                SELECT
                    s.id AS screen_id,
                    s.screen_id AS screen_code,
                    s.screen_name,
                    s.status AS screen_status,

                    c.id AS campaign_id,
                    c.name AS campaign_name,
                    c.status AS campaign_status,
                    c.start_date,
                    c.end_date,

                    a.id AS advertisement_id,
                    a.title AS advertisement_title,
                    a.status AS advertisement_status

                FROM screens s

                JOIN campaign_screens cs
                    ON cs.screen_id = s.id

                JOIN campaigns c
                    ON c.id = cs.campaign_id

                JOIN advertisements a
                    ON a.id = c.advertisement_id

                WHERE s.screen_id = $1
                  AND c.id = $2
                  AND a.id = $3
                `,
                [
                    screenId,
                    campaignId,
                    advertisementId
                ]
            );


            if (check.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Screen, campaign or advertisement assignment not found"
                });

            }


            const record =
                check.rows[0];


            // -----------------------------
            // SCREEN MUST BE ONLINE
            // -----------------------------

            if (
                record.screen_status !== "online"
            ) {

                return res.status(400).json({
                    message:
                        "Screen is not online"
                });

            }


            // -----------------------------
            // CAMPAIGN MUST BE ACTIVE
            // -----------------------------

            if (
                record.campaign_status !== "active"
            ) {

                return res.status(400).json({
                    message:
                        "Campaign is not active"
                });

            }


            // -----------------------------
            // ADVERTISEMENT MUST BE APPROVED
            // -----------------------------

            if (
                record.advertisement_status !== "approved"
            ) {

                return res.status(400).json({
                    message:
                        "Advertisement is not approved"
                });

            }


            // -----------------------------
            // CAMPAIGN DATE CHECK
            // -----------------------------

            const today =
                new Date();

            const startDate =
                new Date(
                    record.start_date
                );

            const endDate =
                new Date(
                    record.end_date
                );


            today.setHours(
                0,
                0,
                0,
                0
            );

            startDate.setHours(
                0,
                0,
                0,
                0
            );

            endDate.setHours(
                0,
                0,
                0,
                0
            );


            if (
                today < startDate ||
                today > endDate
            ) {

                return res.status(400).json({
                    message:
                        "Campaign is outside its scheduled dates"
                });

            }


            // -----------------------------
            // VALIDATE DURATION
            // -----------------------------

            const duration =
                Math.max(
                    0,
                    Number(
                        durationSeconds
                    ) || 0
                );


            // -----------------------------
            // CREATE VERIFIED PLAYBACK
            // -----------------------------

            const result =
                await db.query(
                    `
                    INSERT INTO playback_events
                    (
                        advertisement_id,
                        campaign_id,
                        screen_id,
                        started_at,
                        ended_at,
                        duration_seconds,
                        status
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        NOW() - ($4 * INTERVAL '1 second'),
                        NOW(),
                        $4,
                        'verified'
                    )
                    RETURNING *
                    `,
                    [
                        advertisementId,
                        campaignId,
                        record.screen_id,
                        duration
                    ]
                );


            // -----------------------------
            // RESPONSE
            // -----------------------------

            res.status(201).json({

                message:
                    "Playback recorded successfully",

                playback:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Direct playback recording error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while recording playback"

            });

        }

    }
);


// =====================================================
// START PLAYBACK
// =====================================================

router.post(
    "/start",
    async (req, res) => {

        try {

            const {
                screenId,
                advertisementId,
                campaignId
            } = req.body;


            if (
                !screenId ||
                !advertisementId ||
                !campaignId
            ) {

                return res.status(400).json({
                    message:
                        "screenId, advertisementId and campaignId are required"
                });

            }


            const check =
                await db.query(
                    `
                    SELECT
                        s.id AS screen_id,
                        s.screen_id AS screen_code,
                        s.status AS screen_status,

                        c.id AS campaign_id,
                        c.status AS campaign_status,
                        c.start_date,
                        c.end_date,

                        a.id AS advertisement_id,
                        a.status AS advertisement_status

                    FROM screens s

                    JOIN campaign_screens cs
                        ON cs.screen_id = s.id

                    JOIN campaigns c
                        ON c.id = cs.campaign_id

                    JOIN advertisements a
                        ON a.id = c.advertisement_id

                    WHERE s.screen_id = $1
                      AND c.id = $2
                      AND a.id = $3
                    `,
                    [
                        screenId,
                        campaignId,
                        advertisementId
                    ]
                );


            if (
                check.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Screen, campaign or advertisement assignment not found"
                });

            }


            const record =
                check.rows[0];


            if (
                record.screen_status !== "online"
            ) {

                return res.status(400).json({
                    message:
                        "Screen is not online"
                });

            }


            if (
                record.campaign_status !== "active"
            ) {

                return res.status(400).json({
                    message:
                        "Campaign is not active"
                });

            }


            if (
                record.advertisement_status !== "approved"
            ) {

                return res.status(400).json({
                    message:
                        "Advertisement is not approved"
                });

            }


            const today =
                new Date();

            const startDate =
                new Date(
                    record.start_date
                );

            const endDate =
                new Date(
                    record.end_date
                );


            today.setHours(
                0,
                0,
                0,
                0
            );

            startDate.setHours(
                0,
                0,
                0,
                0
            );

            endDate.setHours(
                0,
                0,
                0,
                0
            );


            if (
                today < startDate ||
                today > endDate
            ) {

                return res.status(400).json({
                    message:
                        "Campaign is outside its scheduled dates"
                });

            }


            const result =
                await db.query(
                    `
                    INSERT INTO playback_events
                    (
                        advertisement_id,
                        campaign_id,
                        screen_id,
                        started_at,
                        status
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        NOW(),
                        'verified'
                    )
                    RETURNING *
                    `,
                    [
                        advertisementId,
                        campaignId,
                        record.screen_id
                    ]
                );


            res.status(201).json({

                message:
                    "Playback started successfully",

                playback:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Playback start error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while starting playback"

            });

        }

    }
);


// =====================================================
// END PLAYBACK
// =====================================================

router.post(
    "/end",
    async (req, res) => {

        try {

            const {
                playbackId
            } = req.body;


            if (!playbackId) {

                return res.status(400).json({
                    message:
                        "playbackId is required"
                });

            }


            const result =
                await db.query(
                    `
                    UPDATE playback_events

                    SET
                        ended_at = NOW(),

                        duration_seconds =
                            GREATEST(
                                0,
                                EXTRACT(
                                    EPOCH
                                    FROM
                                    (
                                        NOW()
                                        - started_at
                                    )
                                )::INTEGER
                            )

                    WHERE id = $1
                      AND ended_at IS NULL

                    RETURNING *
                    `,
                    [
                        playbackId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Active playback event not found"
                });

            }


            res.json({

                message:
                    "Playback completed successfully",

                playback:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Playback end error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while ending playback"

            });

        }

    }
);
// GET PLAYBACK ANALYTICS FOR A SCREEN
router.get(
    "/analytics/:screenId",
    async (req, res) => {
        try {
            const { screenId } = req.params;

            const screenResult = await db.query(
                `
                SELECT
                    id,
                    screen_id,
                    screen_name,
                    status
                FROM screens
                WHERE screen_id = $1
                `,
                [screenId]
            );

            if (screenResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Screen not found"
                });
            }

            const screen = screenResult.rows[0];

            const result = await db.query(
                `
                SELECT
                    COUNT(*) AS total_plays,
                    COUNT(DISTINCT advertisement_id)
                        AS advertisements_played,
                    COUNT(DISTINCT campaign_id)
                        AS campaigns_played,
                    COUNT(DISTINCT screen_id)
                        AS screens_reached,
                    COALESCE(
                        SUM(duration_seconds),
                        0
                    ) AS total_play_time_seconds
                FROM playback_events
                WHERE screen_id = $1
                  AND status = 'verified'
                `,
                [screen.id]
            );

            const analytics = result.rows[0];

            res.json({
                screen: {
                    screenId: screen.screen_id,
                    screenName: screen.screen_name,
                    status: screen.status
                },
                analytics: {
                    totalPlays:
                        Number(analytics.total_plays),

                    advertisementsPlayed:
                        Number(
                            analytics.advertisements_played
                        ),

                    campaignsPlayed:
                        Number(
                            analytics.campaigns_played
                        ),

                    screensReached:
                        Number(
                            analytics.screens_reached
                        ),

                    totalPlayTimeSeconds:
                        Number(
                            analytics.total_play_time_seconds
                        )
                }
            });
        } catch (error) {
            console.error(
                "Player analytics error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading playback analytics"
            });
        }
    }
);

module.exports = router;
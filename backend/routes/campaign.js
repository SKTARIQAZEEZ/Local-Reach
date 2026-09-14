const express = require("express");
const router = express.Router();

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// CREATE CAMPAIGN
// ============================================================

router.post(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const {
            name,
            advertisementTitle,
            startDate,
            endDate,
            targetCity,
            targetArea,
            radiusKm,
            targetLatitude,
        targetLongitude,
            budget
        } = req.body;

        try {

            // ----------------------------------------------------
            // VALIDATION
            // ----------------------------------------------------

            if (
                !name ||
                !advertisementTitle ||
                !startDate ||
                !endDate ||
                !targetCity ||
                budget === undefined ||
                budget === null ||
                budget === ""
            ) {

                return res.status(400).json({
                    message:
                        "Please fill in all required fields"
                });
            }


            const start = new Date(startDate);
            const end = new Date(endDate);


            if (
                isNaN(start.getTime()) ||
                isNaN(end.getTime())
            ) {

                return res.status(400).json({
                    message:
                        "Invalid campaign dates"
                });
            }


            if (end < start) {

                return res.status(400).json({
                    message:
                        "Campaign end date cannot be before start date"
                });
            }


            const numericBudget =
                Number(budget);


            if (
                isNaN(numericBudget) ||
                numericBudget < 0
            ) {

                return res.status(400).json({
                    message:
                        "Campaign budget must be a valid non-negative number"
                });
            }


            // ----------------------------------------------------
            // CREATE ADVERTISEMENT
            // ----------------------------------------------------

            const advertisementResult =
                await db.query(
                    `
                    INSERT INTO advertisements
                    (
                        advertiser_id,
                        title,
                        duration_seconds,
                        status
                    )
                    VALUES
                    ($1, $2, $3, $4)
                    RETURNING *
                    `,
                    [
                        req.user.id,
                        advertisementTitle,
                        30,
                        "pending"
                    ]
                );


            const advertisement =
                advertisementResult.rows[0];


            // ----------------------------------------------------
            // CREATE CAMPAIGN
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    INSERT INTO campaigns
                    (
                        advertiser_id,
                        advertisement_id,
                        name,
                        status,
                        start_date,
                        end_date,
                        budget,
                        target_city,
                        target_area,
                        radius_km,
                        target_latitude,
                        target_longitude,
                    )
                    VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12)
                    RETURNING *
                    `,
                    [
    req.user.id,
    advertisement.id,
    name,
    "pending",
    startDate,
    endDate,
    numericBudget,
    targetCity,
    targetArea || null,
    radiusKm || null,
    targetLatitude || null,
    targetLongitude || null
]
                );


            res.status(201).json({
                message:
                    "Campaign created successfully and submitted for admin approval",

                campaign:
                    campaignResult.rows[0]
            });


        } catch (error) {

            console.error(
                "Campaign creation error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while creating campaign"
            });
        }
    }
);


// ============================================================
// WEEKLY ANALYTICS
// IMPORTANT: THIS MUST COME BEFORE /:id
// ============================================================

router.get(
    "/analytics/weekly",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    DATE_TRUNC(
                        'week',
                        pe.started_at
                    ) AS week,

                    COUNT(*) AS verified_plays,

                    COALESCE(
                        SUM(
                            pe.duration_seconds
                        ),
                        0
                    ) AS total_play_time

                FROM playback_events pe

                INNER JOIN campaigns c
                    ON pe.campaign_id = c.id

                WHERE c.advertiser_id = $1

                  AND pe.status = 'verified'

                GROUP BY
                    DATE_TRUNC(
                        'week',
                        pe.started_at
                    )

                ORDER BY
                    week ASC
                `,
                [req.user.id]
            );


            res.json({
                weeklyAnalytics: result.rows
            });


        } catch (error) {

            console.error(
                "Weekly analytics error:",
                error
            );

            res.status(500).json({
                message:
                    error.message ||
                    "Server error while fetching weekly analytics"
            });

        }

    }
);

// ============================================================
// GET LOGGED-IN ADVERTISER'S CAMPAIGNS
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

                        c.id,
                        c.name,
                        c.status,
                        c.start_date,
                        c.end_date,
                        c.budget,
                        c.target_city,
                        c.target_area,
                        c.radius_km,

                        a.id AS advertisement_id,
                        a.title AS advertisement_title,
                        a.duration_seconds,
                        a.status AS advertisement_status,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                            ),
                            0
                        )::INTEGER AS total_plays,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                                  AND pe.status = 'verified'
                            ),
                            0
                        )::INTEGER AS verified_plays,

                        COALESCE(
                            (
                                SELECT SUM(
                                    pe.duration_seconds
                                )
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                                  AND pe.status = 'verified'
                            ),
                            0
                        )::INTEGER AS verified_play_seconds,

                        COALESCE(
                            (
                                SELECT COUNT(
                                    DISTINCT cs.screen_id
                                )
                                FROM campaign_screens cs
                                WHERE cs.campaign_id = c.id
                            ),
                            0
                        )::INTEGER AS screens_reached,

                        COALESCE(
                            (
                                SELECT SUM(p.amount)
                                FROM payments p
                                WHERE p.campaign_id = c.id
                                  AND p.advertiser_id =
                                      c.advertiser_id
                                  AND p.status = 'paid'
                            ),
                            0
                        ) AS amount_spent

                    FROM campaigns c

                    LEFT JOIN advertisements a
                        ON c.advertisement_id = a.id

                    WHERE c.advertiser_id = $1

                    ORDER BY
                        c.created_at DESC
                    `,
                    [
                        req.user.id
                    ]
                );


            res.json({
                campaigns:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Campaign fetch error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching campaigns"
            });
        }
    }
);


// ============================================================
// GET ONE CAMPAIGN BY ID
// ============================================================

router.get(
    "/:id",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT

                        c.id,
                        c.advertiser_id,
                        c.advertisement_id,
                        c.business_id,
                        c.name,
                        c.status,
                        c.start_date,
                        c.end_date,
                        c.budget,
                        c.target_city,
                        c.target_area,
                        c.radius_km,
                        c.created_at,

                        a.title AS advertisement_title,
                        a.file_url AS advertisement_file_url,
                        a.file_type AS advertisement_file_type,
                        a.duration_seconds
                            AS advertisement_duration,
                        a.status
                            AS advertisement_status,

                        b.name AS business_name,

                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(

                                        'id',
                                        s.id,

                                        'screen_id',
                                        s.screen_id,

                                        'name',
                                        s.screen_name,

                                        'city',
                                        s.city,

                                        'area',
                                        s.area,

                                        'business_name',
                                        s.business_name,

                                        'status',
                                        s.status,

                                        'operating_start',
                                        s.operating_start,

                                        'operating_end',
                                        s.operating_end,

                                        'available_ad_start',
                                        s.available_ad_start,

                                        'available_ad_end',
                                        s.available_ad_end,

                                        'price_per_week',
                                        s.price_per_week,

                                        'estimated_daily_plays',
                                        s.estimated_daily_plays

                                    )
                                    ORDER BY
                                        s.screen_name
                                )

                                FROM campaign_screens cs

                                INNER JOIN screens s
                                    ON s.id = cs.screen_id

                                WHERE cs.campaign_id = c.id
                            ),
                            '[]'::json
                        ) AS screens

                    FROM campaigns c

                    LEFT JOIN advertisements a
                        ON a.id =
                           c.advertisement_id

                    LEFT JOIN businesses b
                        ON b.id =
                           c.business_id

                    WHERE c.id = $1
                      AND c.advertiser_id = $2
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
                        "Campaign not found"
                });
            }


            res.json({
                campaign:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Get campaign details error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching campaign details"
            });
        }
    }
);


// ============================================================
// UPDATE CAMPAIGN
// ============================================================

router.put(
    "/:id",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const {
            name,
            advertisementTitle,
            startDate,
            endDate,
            targetCity,
            targetArea,
            budget
        } = req.body;


        const client =
            await db.connect();


        try {

            // ----------------------------------------------------
            // VALIDATION
            // ----------------------------------------------------

            if (
                !name ||
                !advertisementTitle ||
                !startDate ||
                !endDate ||
                !targetCity ||
                budget === undefined ||
                budget === null ||
                budget === ""
            ) {

                return res.status(400).json({
                    message:
                        "Please fill in all required fields"
                });
            }


            const start =
                new Date(startDate);

            const end =
                new Date(endDate);


            if (
                isNaN(start.getTime()) ||
                isNaN(end.getTime())
            ) {

                return res.status(400).json({
                    message:
                        "Invalid campaign dates"
                });
            }


            if (end < start) {

                return res.status(400).json({
                    message:
                        "Campaign end date cannot be before start date"
                });
            }


            const numericBudget =
                Number(budget);


            if (
                isNaN(numericBudget) ||
                numericBudget < 0
            ) {

                return res.status(400).json({
                    message:
                        "Campaign budget must be a valid non-negative number"
                });
            }


            // ----------------------------------------------------
            // FIND CAMPAIGN
            // ----------------------------------------------------

            const campaignCheck =
                await client.query(
                    `
                    SELECT
                        id,
                        name,
                        status,
                        advertisement_id
                    FROM campaigns
                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignCheck.rows[0];


            // ----------------------------------------------------
            // PROTECT REJECTED / COMPLETED
            // ----------------------------------------------------

            if (
                campaign.status === "rejected"
            ) {

                return res.status(400).json({
                    message:
                        "Rejected campaigns cannot be modified"
                });
            }


            if (
                campaign.status === "completed"
            ) {

                return res.status(400).json({
                    message:
                        "Completed campaigns cannot be modified"
                });
            }


            // ----------------------------------------------------
            // DETERMINE NEW STATUS
            // ----------------------------------------------------

            let newStatus =
                campaign.status;


            if (
                campaign.status === "active" ||
                campaign.status === "paused"
            ) {

                newStatus = "pending";
            }


            // ----------------------------------------------------
            // BEGIN TRANSACTION
            // ----------------------------------------------------

            await client.query(
                "BEGIN"
            );


            // ----------------------------------------------------
            // UPDATE ADVERTISEMENT
            // ----------------------------------------------------

            if (
                campaign.advertisement_id
            ) {

                await client.query(
                    `
                    UPDATE advertisements

                    SET title = $1

                    WHERE id = $2
                      AND advertiser_id = $3
                    `,
                    [
                        advertisementTitle,
                        campaign.advertisement_id,
                        req.user.id
                    ]
                );

            } else {

                const advertisementResult =
                    await client.query(
                        `
                        INSERT INTO advertisements
                        (
                            advertiser_id,
                            title,
                            duration_seconds,
                            status
                        )
                        VALUES
                        (
                            $1,
                            $2,
                            30,
                            'pending'
                        )
                        RETURNING id
                        `,
                        [
                            req.user.id,
                            advertisementTitle
                        ]
                    );


                await client.query(
                    `
                    UPDATE campaigns

                    SET advertisement_id = $1

                    WHERE id = $2
                      AND advertiser_id = $3
                    `,
                    [
                        advertisementResult
                            .rows[0].id,

                        req.params.id,

                        req.user.id
                    ]
                );
            }


            // ----------------------------------------------------
            // UPDATE CAMPAIGN
            // ----------------------------------------------------

            const result =
                await client.query(
                    `
                    UPDATE campaigns

                    SET
                        name = $1,
                        start_date = $2,
                        end_date = $3,
                        target_city = $4,
                        target_area = $5,
                        budget = $6,
                        status = $7

                    WHERE id = $8
                      AND advertiser_id = $9

                    RETURNING *
                    `,
                    [
                        name,
                        startDate,
                        endDate,
                        targetCity,
                        targetArea || null,
                        numericBudget,
                        newStatus,
                        req.params.id,
                        req.user.id
                    ]
                );


            await client.query(
                "COMMIT"
            );


            let message =
                "Campaign updated successfully";


            if (
                campaign.status === "active" ||
                campaign.status === "paused"
            ) {

                message =
                    "Campaign updated and submitted for admin approval";
            }


            res.json({
                message,

                campaign:
                    result.rows[0]
            });


        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (
                rollbackError
            ) {
                console.error(
                    "Rollback error:",
                    rollbackError
                );
            }


            console.error(
                "Campaign update error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while updating campaign"
            });


        } finally {

            client.release();
        }
    }
);


// ============================================================
// UPDATE CAMPAIGN STATUS
// Advertiser cannot directly activate campaigns.
// ============================================================

router.patch(
    "/:id/status",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const {
            status
        } = req.body;


        try {

            const campaignResult =
                await db.query(
                    `
                    SELECT
                        id,
                        name,
                        status

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            if (
                campaign.status === "rejected"
            ) {

                return res.status(400).json({
                    message:
                        "Rejected campaigns cannot be modified"
                });
            }


            if (
                campaign.status === "completed"
            ) {

                return res.status(400).json({
                    message:
                        "Completed campaigns cannot be modified"
                });
            }


            if (
                status === "active"
            ) {

                return res.status(403).json({
                    message:
                        "Only admin can activate a campaign. Submit the campaign for approval instead."
                });
            }


            if (
                status === "paused" &&
                campaign.status !== "active"
            ) {

                return res.status(400).json({
                    message:
                        "Only active campaigns can be paused"
                });
            }


            if (
                status === "pending" &&
                campaign.status !== "draft" &&
                campaign.status !== "paused"
            ) {

                return res.status(400).json({
                    message:
                        "Only draft or paused campaigns can be submitted for approval"
                });
            }


            const allowedTransitions = {

                draft: [
                    "pending"
                ],

                pending: [],

                active: [
                    "paused"
                ],

                paused: [
                    "pending"
                ]
            };


            const currentStatus =
                campaign.status;


            if (
                !allowedTransitions[
                    currentStatus
                ] ||
                !allowedTransitions[
                    currentStatus
                ].includes(status)
            ) {

                return res.status(400).json({
                    message:
                        `Campaign cannot change from ${currentStatus} to ${status}`
                });
            }


            const result =
                await db.query(
                    `
                    UPDATE campaigns

                    SET status = $1

                    WHERE id = $2
                      AND advertiser_id = $3

                    RETURNING *
                    `,
                    [
                        status,
                        req.params.id,
                        req.user.id
                    ]
                );


            let message;


            if (
                status === "pending"
            ) {

                message =
                    "Campaign submitted for admin approval";

            } else if (
                status === "paused"
            ) {

                message =
                    "Campaign paused successfully";
            }


            res.json({
                message,

                campaign:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Campaign status update error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while updating campaign status"
            });
        }
    }
);


// ============================================================
// DELETE CAMPAIGN
// ============================================================

router.delete(
    "/:id",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const campaignCheck =
                await db.query(
                    `
                    SELECT
                        id,
                        status

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignCheck.rows[0];


            if (
                campaign.status === "active"
            ) {

                return res.status(400).json({
                    message:
                        "Active campaigns cannot be deleted. Pause the campaign first."
                });
            }


            const result =
                await db.query(
                    `
                    DELETE FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2

                    RETURNING *
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            res.json({
                message:
                    "Campaign deleted successfully",

                campaign:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Campaign deletion error:",
                error
            );


            if (
                error.code === "23503"
            ) {

                return res.status(400).json({
                    message:
                        "This campaign cannot be deleted because it has related records such as payments, screen assignments, or playback data."
                });
            }


            res.status(500).json({
                message:
                    "Server error while deleting campaign"
            });
        }
    }
);
// ============================================================
// GET AVAILABLE SCREENS FOR A CAMPAIGN
// ============================================================

router.get(
    "/:id/available-screens",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN OWNERSHIP
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    SELECT
                        id,
                        name,
                        status,
                        start_date,
                        end_date,
                        budget

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // SCREEN BOOKING IS ONLY ALLOWED FOR ACTIVE CAMPAIGNS
            // ----------------------------------------------------

            if (
                campaign.status !== "active"
            ) {

                return res.json({
                    screens: [],
                    message:
                        "Only active campaigns can select screens"
                });
            }


            // ----------------------------------------------------
            // CHECK PAYMENT
            // ----------------------------------------------------

            const paymentResult =
                await db.query(
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
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                paymentResult.rows.length === 0
            ) {

                return res.json({
                    screens: [],
                    message:
                        "Complete payment before selecting a screen"
                });
            }


            const payment =
                paymentResult.rows[0];


            // ----------------------------------------------------
            // PAYMENT MUST MATCH CAMPAIGN BUDGET
            // ----------------------------------------------------

            if (
                Number(payment.amount) !==
                Number(campaign.budget)
            ) {

                return res.json({
                    screens: [],
                    message:
                        "Payment amount does not match campaign budget"
                });
            }


            // ----------------------------------------------------
            // FIND AVAILABLE ONLINE SCREENS
            //
            // A screen is available when:
            // 1. It is online
            // 2. It is not already assigned to this campaign
            //
            // Different campaigns are allowed to use the same screen.
            // The TV player will decide which active advertisements
            // to play for that screen.
            // ----------------------------------------------------

            const result =
                await db.query(
                    `
                    SELECT

                        s.id,
                        s.screen_id,
                        s.screen_name,
                        s.business_name,
                        s.city,
                        s.area,
                        s.screen_type,
                        s.screen_size,
                        s.operating_start,
                        s.operating_end,
                        s.available_ad_start,
                        s.available_ad_end,
                        s.price_per_week,
                        s.estimated_daily_plays,
                        s.status

                    FROM screens s

                    WHERE s.status = 'online'

                      AND NOT EXISTS (
                          SELECT 1

                          FROM campaign_screens
                          existing_assignment

                          WHERE
                              existing_assignment.campaign_id =
                              $1

                            AND
                              existing_assignment.screen_id =
                              s.id
                      )

                    ORDER BY
                        s.city,
                        s.area,
                        s.screen_name
                    `,
                    [
                        req.params.id
                    ]
                );


            res.json({
                screens:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Available screens error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching available screens"
            });
        }
    }
);


// ============================================================
// ASSIGN / BOOK SCREEN TO CAMPAIGN
//
// IMPORTANT BOOKING RULE:
//
// Campaign
//     ↓
// Admin approves
//     ↓
// Active
//     ↓
// Payment completed
//     ↓
// Screen selected
//     ↓
// Booking created
// ============================================================

router.post(
    "/:id/screens",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const {
            screenId
        } = req.body;


        const client =
            await db.connect();


        try {

            // ----------------------------------------------------
            // VALIDATION
            // ----------------------------------------------------

            if (!screenId) {

                return res.status(400).json({
                    message:
                        "Screen ID is required"
                });
            }


            // ----------------------------------------------------
            // GET CAMPAIGN
            // ----------------------------------------------------

            const campaignResult =
                await client.query(
                    `
                    SELECT

                        id,
                        name,
                        status,
                        start_date,
                        end_date,
                        budget

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // ONLY ACTIVE CAMPAIGNS CAN BOOK SCREENS
            // ----------------------------------------------------

            if (
                campaign.status !== "active"
            ) {

                return res.status(400).json({
                    message:
                        "Only active campaigns can book screens"
                });
            }


            // ----------------------------------------------------
            // CAMPAIGN DATES MUST EXIST
            // ----------------------------------------------------

            if (
                !campaign.start_date ||
                !campaign.end_date
            ) {

                return res.status(400).json({
                    message:
                        "Campaign start and end dates are required before booking a screen"
                });
            }


            // ----------------------------------------------------
            // PAYMENT MUST BE COMPLETED
            // ----------------------------------------------------

            const paymentResult =
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
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                paymentResult.rows.length === 0
            ) {

                return res.status(400).json({
                    message:
                        "Complete payment before booking a screen"
                });
            }


            const payment =
                paymentResult.rows[0];


            // ----------------------------------------------------
            // PAYMENT MUST MATCH BUDGET
            // ----------------------------------------------------

            if (
                Number(payment.amount) !==
                Number(campaign.budget)
            ) {

                return res.status(400).json({
                    message:
                        "Payment amount must match the campaign budget"
                });
            }


            // ----------------------------------------------------
            // GET SCREEN
            // ----------------------------------------------------

            const screenResult =
                await client.query(
                    `
                    SELECT

                        id,
                        screen_id,
                        screen_name,
                        business_name,
                        city,
                        area,
                        operating_start,
                        operating_end,
                        available_ad_start,
                        available_ad_end,
                        price_per_week,
                        estimated_daily_plays,
                        status

                    FROM screens

                    WHERE id = $1
                    `,
                    [
                        screenId
                    ]
                );


            if (
                screenResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Screen not found"
                });
            }


            const screen =
                screenResult.rows[0];


            // ----------------------------------------------------
            // SCREEN MUST BE ONLINE
            // ----------------------------------------------------

            if (
                screen.status !== "online"
            ) {

                return res.status(400).json({
                    message:
                        "Only online screens can be booked"
                });
            }


            // ----------------------------------------------------
            // CHECK DUPLICATE ASSIGNMENT
            // ----------------------------------------------------

            const duplicateResult =
                await client.query(
                    `
                    SELECT
                        id

                    FROM campaign_screens

                    WHERE campaign_id = $1
                      AND screen_id = $2

                    LIMIT 1
                    `,
                    [
                        req.params.id,
                        screenId
                    ]
                );


            if (
                duplicateResult.rows.length > 0
            ) {

                return res.status(400).json({
                    message:
                        "This screen is already booked for this campaign"
                });
            }


            // ----------------------------------------------------
            // BEGIN TRANSACTION
            // ----------------------------------------------------

            await client.query(
                "BEGIN"
            );


            // ----------------------------------------------------
            // CREATE SCREEN BOOKING
            // ----------------------------------------------------

            const bookingResult =
                await client.query(
                    `
                    INSERT INTO campaign_screens
                    (
                        campaign_id,
                        screen_id,
                        price
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3
                    )

                    RETURNING *
                    `,
                    [
                        req.params.id,
                        screenId,
                        screen.price_per_week
                    ]
                );


            await client.query(
                "COMMIT"
            );


            // ----------------------------------------------------
            // SUCCESS RESPONSE
            // ----------------------------------------------------

            res.status(201).json({

                message:
                    "Screen booked successfully",

                booking:
                    bookingResult.rows[0],

                campaign: {
                    id:
                        campaign.id,

                    name:
                        campaign.name,

                    status:
                        campaign.status,

                    start_date:
                        campaign.start_date,

                    end_date:
                        campaign.end_date
                },

                screen: {
                    id:
                        screen.id,

                    screen_id:
                        screen.screen_id,

                    screen_name:
                        screen.screen_name,

                    business_name:
                        screen.business_name,

                    city:
                        screen.city,

                    area:
                        screen.area
                },

                payment: {
                    id:
                        payment.id,

                    amount:
                        payment.amount,

                    status:
                        payment.status
                }
            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "Booking rollback error:",
                    rollbackError
                );
            }


            console.error(
                "Screen booking error:",
                error
            );


            // PostgreSQL unique / constraint errors
            if (
                error.code === "23505"
            ) {

                return res.status(409).json({
                    message:
                        "This screen is already booked for this campaign"
                });
            }


            res.status(500).json({
                message:
                    "Server error while booking screen"
            });


        } finally {

            client.release();
        }
    }
);


// ============================================================
// GET ASSIGNED SCREENS FOR CAMPAIGN
// ============================================================

router.get(
    "/:id/screens",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN OWNERSHIP
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    SELECT
                        id,
                        name,
                        status,
                        start_date,
                        end_date

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            // ----------------------------------------------------
            // GET ASSIGNED SCREENS
            // ----------------------------------------------------

            const result =
                await db.query(
                    `
                    SELECT

                        cs.id AS booking_id,

                        cs.price AS booking_price,

                        cs.created_at AS booked_at,

                        s.id,

                        s.screen_id,

                        s.screen_name AS name,

                        s.screen_name,

                        s.business_name,

                        s.city,

                        s.area,

                        s.display_type,

                        s.screen_size,

                        s.operating_start,

                        s.operating_end,

                        s.available_ad_start,

                        s.available_ad_end,

                        s.price_per_week,

                        s.estimated_daily_plays,

                        s.status

                    FROM campaign_screens cs

                    INNER JOIN screens s
                        ON s.id = cs.screen_id

                    WHERE cs.campaign_id = $1

                    ORDER BY
                        cs.created_at DESC
                    `,
                    [
                        req.params.id
                    ]
                );


            res.json({
                screens:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Assigned screens error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching assigned screens"
            });
        }
    }
);


// ============================================================
// REMOVE SCREEN FROM CAMPAIGN
// ============================================================

router.delete(
    "/:id/screens/:screenId",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        const client =
            await db.connect();


        try {

            // ----------------------------------------------------
            // GET CAMPAIGN
            // ----------------------------------------------------

            const campaignResult =
                await client.query(
                    `
                    SELECT

                        id,
                        name,
                        status

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // PROTECT REJECTED / COMPLETED
            // ----------------------------------------------------

            if (
                campaign.status === "rejected"
            ) {

                return res.status(400).json({
                    message:
                        "Rejected campaigns cannot be modified"
                });
            }


            if (
                campaign.status === "completed"
            ) {

                return res.status(400).json({
                    message:
                        "Completed campaigns cannot be modified"
                });
            }


            // ----------------------------------------------------
            // VERIFY SCREEN ASSIGNMENT
            // ----------------------------------------------------

            const assignmentResult =
                await client.query(
                    `
                    SELECT
                        id

                    FROM campaign_screens

                    WHERE campaign_id = $1
                      AND screen_id = $2

                    LIMIT 1
                    `,
                    [
                        req.params.id,
                        req.params.screenId
                    ]
                );


            if (
                assignmentResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Screen is not assigned to this campaign"
                });
            }


            // ----------------------------------------------------
            // BEGIN TRANSACTION
            // ----------------------------------------------------

            await client.query(
                "BEGIN"
            );


            // ----------------------------------------------------
            // REMOVE BOOKING
            // ----------------------------------------------------

            await client.query(
                `
                DELETE FROM campaign_screens

                WHERE campaign_id = $1
                  AND screen_id = $2
                `,
                [
                    req.params.id,
                    req.params.screenId
                ]
            );


            // ----------------------------------------------------
            // IF ACTIVE / PAUSED, REQUIRE RE-APPROVAL
            //
            // Removing an already-booked screen changes the
            // campaign configuration, so it goes back to pending.
            // ----------------------------------------------------

            let newStatus =
                campaign.status;


            if (
                campaign.status === "active" ||
                campaign.status === "paused"
            ) {

                newStatus = "pending";


                await client.query(
                    `
                    UPDATE campaigns

                    SET status = 'pending'

                    WHERE id = $1
                    `,
                    [
                        req.params.id
                    ]
                );
            }


            await client.query(
                "COMMIT"
            );


            let message =
                "Screen removed successfully";


            if (
                newStatus === "pending" &&
                campaign.status !== "pending"
            ) {

                message =
                    "Screen removed successfully. Campaign has been submitted for admin re-approval.";
            }


            res.json({

                message,

                campaign_status:
                    newStatus
            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "Remove screen rollback error:",
                    rollbackError
                );
            }


            console.error(
                "Remove screen error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while removing screen"
            });


        } finally {

            client.release();
        }
    }
);


// ============================================================
// CAMPAIGN ANALYTICS
// ============================================================

router.get(
    "/:id/analytics",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    SELECT

                        c.id,
                        c.name,
                        c.status,
                        c.start_date,
                        c.end_date,
                        c.budget,

                        a.title
                            AS advertisement_title,

                        a.duration_seconds

                    FROM campaigns c

                    LEFT JOIN advertisements a
                        ON a.id =
                           c.advertisement_id

                    WHERE c.id = $1
                      AND c.advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // PLAYBACK ANALYTICS
            // ----------------------------------------------------

            const analyticsResult =
                await db.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                            AS total_plays,

                        COUNT(
                            CASE
                                WHEN pe.status =
                                     'verified'
                                THEN 1
                            END
                        )::INTEGER
                            AS verified_plays,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN pe.status =
                                         'verified'
                                    THEN pe.duration_seconds
                                    ELSE 0
                                END
                            ),
                            0
                        )::INTEGER
                            AS verified_play_seconds,

                        COUNT(
                            DISTINCT pe.screen_id
                        )::INTEGER
                            AS screens_reached

                    FROM playback_events pe

                    WHERE pe.campaign_id = $1
                    `,
                    [
                        req.params.id
                    ]
                );


            // ----------------------------------------------------
            // DAILY PLAYBACK DATA
            // ----------------------------------------------------

            const dailyResult =
                await db.query(
                    `
                    SELECT

                        DATE(pe.started_at)
                            AS play_date,

                        COUNT(*)::INTEGER
                            AS total_plays,

                        COUNT(
                            CASE
                                WHEN pe.status =
                                     'verified'
                                THEN 1
                            END
                        )::INTEGER
                            AS verified_plays,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN pe.status =
                                         'verified'
                                    THEN pe.duration_seconds
                                    ELSE 0
                                END
                            ),
                            0
                        )::INTEGER
                            AS play_seconds

                    FROM playback_events pe

                    WHERE pe.campaign_id = $1

                    GROUP BY
                        DATE(pe.started_at)

                    ORDER BY
                        play_date ASC
                    `,
                    [
                        req.params.id
                    ]
                );


            // ----------------------------------------------------
            // SCREEN PERFORMANCE
            // ----------------------------------------------------

            const screenResult =
                await db.query(
                    `
                    SELECT

                        s.id,

                        s.screen_id,

                        s.screen_name,

                        s.business_name,

                        s.city,

                        s.area,

                        COUNT(pe.id)::INTEGER
                            AS total_plays,

                        COUNT(
                            CASE
                                WHEN pe.status =
                                     'verified'
                                THEN 1
                            END
                        )::INTEGER
                            AS verified_plays,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN pe.status =
                                         'verified'
                                    THEN pe.duration_seconds
                                    ELSE 0
                                END
                            ),
                            0
                        )::INTEGER
                            AS play_seconds

                    FROM campaign_screens cs

                    INNER JOIN screens s
                        ON s.id = cs.screen_id

                    LEFT JOIN playback_events pe
                        ON pe.screen_id = s.id

                       AND pe.campaign_id = $1

                    WHERE cs.campaign_id = $1

                    GROUP BY

                        s.id,
                        s.screen_id,
                        s.screen_name,
                        s.business_name,
                        s.city,
                        s.area

                    ORDER BY
                        verified_plays DESC
                    `,
                    [
                        req.params.id
                    ]
                );


            res.json({

                campaign,

                summary:
                    analyticsResult.rows[0],

                daily:
                    dailyResult.rows,

                screens:
                    screenResult.rows
            });


        } catch (error) {

            console.error(
                "Campaign analytics error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching campaign analytics"
            });
        }
    }
);
// ============================================================
// EXPORT CAMPAIGN DATA
// ============================================================

router.get(
    "/:id/export",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN OWNERSHIP
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
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

                        a.title
                            AS advertisement_title,

                        a.duration_seconds,

                        b.name
                            AS business_name

                    FROM campaigns c

                    LEFT JOIN advertisements a
                        ON a.id =
                           c.advertisement_id

                    LEFT JOIN businesses b
                        ON b.id =
                           c.business_id

                    WHERE c.id = $1
                      AND c.advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // GET CAMPAIGN PLAYBACK SUMMARY
            // ----------------------------------------------------

            const playbackResult =
                await db.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                            AS total_plays,

                        COUNT(
                            CASE
                                WHEN pe.status =
                                     'verified'
                                THEN 1
                            END
                        )::INTEGER
                            AS verified_plays,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN pe.status =
                                         'verified'
                                    THEN pe.duration_seconds
                                    ELSE 0
                                END
                            ),
                            0
                        )::INTEGER
                            AS verified_play_seconds,

                        COUNT(
                            DISTINCT pe.screen_id
                        )::INTEGER
                            AS screens_reached

                    FROM playback_events pe

                    WHERE pe.campaign_id = $1
                    `,
                    [
                        req.params.id
                    ]
                );


            // ----------------------------------------------------
            // GET PAYMENTS
            // ----------------------------------------------------

            const paymentResult =
                await db.query(
                    `
                    SELECT

                        id,
                        amount,
                        status,
                        created_at

                    FROM payments

                    WHERE campaign_id = $1
                      AND advertiser_id = $2

                    ORDER BY
                        created_at DESC
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            // ----------------------------------------------------
            // GET ASSIGNED SCREENS
            // ----------------------------------------------------

            const screenResult =
                await db.query(
                    `
                    SELECT

                        cs.id
                            AS booking_id,

                        cs.price
                            AS booking_price,

                        cs.created_at
                            AS booked_at,

                        s.id,

                        s.screen_id,

                        s.screen_name,

                        s.business_name,

                        s.city,

                        s.area,

                        s.status

                    FROM campaign_screens cs

                    INNER JOIN screens s
                        ON s.id =
                           cs.screen_id

                    WHERE cs.campaign_id = $1

                    ORDER BY
                        cs.created_at DESC
                    `,
                    [
                        req.params.id
                    ]
                );


            // ----------------------------------------------------
            // RESPONSE
            // ----------------------------------------------------

            res.json({

                campaign,

                analytics:
                    playbackResult.rows[0],

                payments:
                    paymentResult.rows,

                screens:
                    screenResult.rows
            });


        } catch (error) {

            console.error(
                "Campaign export error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while exporting campaign data"
            });
        }
    }
);


// ============================================================
// CAMPAIGN PLAYBACK DETAILS
// ============================================================

router.get(
    "/:id/playback",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN OWNERSHIP
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    SELECT
                        id,
                        name

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            // ----------------------------------------------------
            // GET PLAYBACK EVENTS
            // ----------------------------------------------------

            const result =
                await db.query(
                    `
                    SELECT

                        pe.id,

                        pe.advertisement_id,

                        pe.campaign_id,

                        pe.screen_id,

                        pe.started_at,

                        pe.ended_at,

                        pe.duration_seconds,

                        pe.status,

                        pe.created_at,

                        s.screen_id
                            AS screen_code,

                        s.screen_name,

                        s.business_name,

                        s.city,

                        s.area

                    FROM playback_events pe

                    LEFT JOIN screens s
                        ON s.id =
                           pe.screen_id

                    WHERE pe.campaign_id = $1

                    ORDER BY
                        pe.started_at DESC
                    `,
                    [
                        req.params.id
                    ]
                );


            res.json({
                playback:
                    result.rows
            });


        } catch (error) {

            console.error(
                "Campaign playback error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching playback data"
            });
        }
    }
);


// ============================================================
// GET CAMPAIGN PAYMENT STATUS
// ============================================================

router.get(
    "/:id/payment",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // VERIFY CAMPAIGN OWNERSHIP
            // ----------------------------------------------------

            const campaignResult =
                await db.query(
                    `
                    SELECT

                        id,
                        name,
                        status,
                        budget

                    FROM campaigns

                    WHERE id = $1
                      AND advertiser_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                campaignResult.rows.length === 0
            ) {

                return res.status(404).json({
                    message:
                        "Campaign not found"
                });
            }


            const campaign =
                campaignResult.rows[0];


            // ----------------------------------------------------
            // FIND PAID PAYMENT
            // ----------------------------------------------------

            const paymentResult =
                await db.query(
                    `
                    SELECT

                        id,
                        campaign_id,
                        amount,
                        status,
                        created_at

                    FROM payments

                    WHERE campaign_id = $1
                      AND advertiser_id = $2
                      AND status = 'paid'

                    ORDER BY
                        created_at DESC

                    LIMIT 1
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                paymentResult.rows.length === 0
            ) {

                return res.json({

                    paid: false,

                    campaign: {
                        id:
                            campaign.id,

                        name:
                            campaign.name,

                        status:
                            campaign.status,

                        budget:
                            campaign.budget
                    },

                    payment:
                        null
                });
            }


            const payment =
                paymentResult.rows[0];


            // ----------------------------------------------------
            // VERIFY PAYMENT AMOUNT
            // ----------------------------------------------------

            const amountMatches =
                Number(payment.amount) ===
                Number(campaign.budget);


            res.json({

                paid:
                    amountMatches,

                campaign: {
                    id:
                        campaign.id,

                    name:
                        campaign.name,

                    status:
                        campaign.status,

                    budget:
                        campaign.budget
                },

                payment,

                amount_matches:
                    amountMatches
            });


        } catch (error) {

            console.error(
                "Campaign payment status error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while checking campaign payment"
            });
        }
    }
);


// ============================================================
// GET CAMPAIGN SCREEN COUNT
// ============================================================

router.get(
    "/:id/screen-count",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                            AS screen_count

                    FROM campaign_screens cs

                    INNER JOIN campaigns c
                        ON c.id =
                           cs.campaign_id

                    WHERE cs.campaign_id = $1
                      AND c.advertiser_id = $2
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
                        "Campaign not found"
                });
            }


            res.json({
                screen_count:
                    result.rows[0].screen_count
            });


        } catch (error) {

            console.error(
                "Screen count error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching screen count"
            });
        }
    }
);


// ============================================================
// GET CAMPAIGN SUMMARY
// ============================================================

router.get(
    "/:id/summary",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result =
                await db.query(
                    `
                    SELECT

                        c.id,
                        c.name,
                        c.status,
                        c.start_date,
                        c.end_date,
                        c.budget,

                        a.title
                            AS advertisement_title,

                        a.duration_seconds,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM campaign_screens cs
                                WHERE cs.campaign_id = c.id
                            ),
                            0
                        )::INTEGER
                            AS screen_count,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                            ),
                            0
                        )::INTEGER
                            AS total_plays,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                                  AND pe.status = 'verified'
                            ),
                            0
                        )::INTEGER
                            AS verified_plays,

                        COALESCE(
                            (
                                SELECT SUM(
                                    pe.duration_seconds
                                )
                                FROM playback_events pe
                                WHERE pe.campaign_id = c.id
                                  AND pe.status = 'verified'
                            ),
                            0
                        )::INTEGER
                            AS verified_play_seconds

                    FROM campaigns c

                    LEFT JOIN advertisements a
                        ON a.id =
                           c.advertisement_id

                    WHERE c.id = $1
                      AND c.advertiser_id = $2
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
                        "Campaign not found"
                });
            }


            res.json({
                summary:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Campaign summary error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error while fetching campaign summary"
            });
        }
    }
);


// ============================================================
// FINAL ROUTE CHECK
// ============================================================

router.get(
    "/health/check",
    async (req, res) => {

        res.json({
            message:
                "Campaign routes are working"
        });
    }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
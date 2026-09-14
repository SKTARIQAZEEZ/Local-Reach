const express = require("express");

const router = express.Router();

const db = require("../database");


// REGISTER TV PLAYER
router.post(
    "/register",
    async (req, res) => {

        try {

            const { screenId } = req.body;


            // Validate screen ID
            if (!screenId) {

                return res.status(400).json({
                    message: "Screen ID is required"
                });

            }


            // Check whether screen exists
            const result = await db.query(
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


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Screen not found"
                });

            }


            const screen = result.rows[0];


            // Player can only register an online screen
            if (screen.status !== "online") {

                return res.status(400).json({
                    message:
                        `Screen is not available. Current status: ${screen.status}`
                });

            }


            // Registration successful
            res.json({

                message:
                    "TV player registered successfully",

                player: {
                    screenId: screen.screen_id,
                    screenName: screen.screen_name,
                    status: "registered"
                }

            });


        } catch (error) {

            console.error(
                "Player registration error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while registering player"
            });

        }

    }
);
// REGISTER A PHYSICAL TV DEVICE
router.post(
    "/device/register",
    async (req, res) => {
        try {
            const {
                deviceId,
                screenId,
                deviceName,
                deviceType
            } = req.body;

            if (!deviceId || !screenId) {
                return res.status(400).json({
                    message:
                        "Device ID and Screen ID are required"
                });
            }

            // Find the registered screen
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
                    message:
                        "Screen not found"
                });
            }

            const screen = screenResult.rows[0];

            // Only approved/online screens can register devices
            if (screen.status !== "online") {
                return res.status(400).json({
                    message:
                        `Screen is not available. Current status: ${screen.status}`
                });
            }

            // Check whether this device already exists
            const existingDevice =
                await db.query(
                    `
                    SELECT
                        id,
                        device_id,
                        screen_id,
                        device_name,
                        device_type,
                        status
                    FROM player_devices
                    WHERE device_id = $1
                    `,
                    [deviceId]
                );

            if (existingDevice.rows.length > 0) {
                const device =
                    existingDevice.rows[0];

                // Update the device's screen and heartbeat
                const updatedDevice =
                    await db.query(
                        `
                        UPDATE player_devices
                        SET
                            screen_id = $1,
                            device_name = $2,
                            device_type = $3,
                            status = 'online',
                            last_seen_at = NOW()
                        WHERE device_id = $4
                        RETURNING *
                        `,
                        [
                            screen.id,
                            deviceName || device.device_name,
                            deviceType || device.device_type,
                            deviceId
                        ]
                    );

                return res.json({
                    message:
                        "TV device already registered",
                    device:
                        updatedDevice.rows[0]
                });
            }

            // Register a new device
            const result = await db.query(
                `
                INSERT INTO player_devices
                (
                    device_id,
                    screen_id,
                    device_name,
                    device_type,
                    status,
                    last_seen_at
                )
                VALUES
                ($1, $2, $3, $4, 'online', NOW())
                RETURNING *
                `,
                [
                    deviceId,
                    screen.id,
                    deviceName || null,
                    deviceType || "tv"
                ]
            );

            res.status(201).json({
                message:
                    "TV device registered successfully",
                device:
                    result.rows[0]
            });

        } catch (error) {
            console.error(
                "Device registration error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while registering TV device"
            });
        }
    }
);
// ======================================================
// GET ADVERTISEMENTS FOR A TV SCREEN
// GET /api/player/ads/:screenId
// ======================================================

router.get(
    "/ads/:screenId",
    async (req, res) => {

        try {

            const { screenId } = req.params;


            // --------------------------------------------------
            // Check screen
            // --------------------------------------------------

            const screenResult = await db.query(
                `
               SELECT
    id,
    screen_id,
    screen_name,
    status,
    city,
    area,
    latitude,
    longitude
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


            // --------------------------------------------------
            // Screen must be online
            // --------------------------------------------------

            if (screen.status !== "online") {

                return res.status(403).json({
                    message:
                        "Screen is not online",
                    status:
                        screen.status
                });

            }


            // --------------------------------------------------
            // Find active campaigns assigned to this screen
            // --------------------------------------------------
const result = await db.query(
    `
    SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.start_date,
        c.end_date,

        a.id AS advertisement_id,
        a.title AS advertisement_title,
        a.file_url,
        a.file_type,
        a.duration_seconds

    FROM campaign_screens cs

    JOIN campaigns c
        ON cs.campaign_id = c.id

    JOIN advertisements a
        ON c.advertisement_id = a.id

    JOIN screens s
        ON cs.screen_id = s.id

    WHERE cs.screen_id = $1

      AND c.status = 'active'

      AND a.status = 'approved'

      AND a.file_url IS NOT NULL

      AND a.file_url <> ''

      AND CURRENT_DATE >= c.start_date

      AND CURRENT_DATE <= c.end_date

      AND
      (
          /*
           * LOCATION TARGETING
           *
           * If campaign has latitude/longitude,
           * use radius-based targeting.
           */
          (
              c.target_latitude IS NOT NULL
              AND c.target_longitude IS NOT NULL
              AND s.latitude IS NOT NULL
              AND s.longitude IS NOT NULL
              AND c.radius_km IS NOT NULL

              AND
              (
                  6371 * 2 * ASIN(
                      SQRT(
                          POWER(
                              SIN(
                                  RADIANS(
                                      s.latitude
                                      - c.target_latitude
                                  ) / 2
                              ),
                              2
                          )
                          +
                          COS(
                              RADIANS(
                                  c.target_latitude
                              )
                          )
                          *
                          COS(
                              RADIANS(
                                  s.latitude
                              )
                          )
                          *
                          POWER(
                              SIN(
                                  RADIANS(
                                      s.longitude
                                      - c.target_longitude
                                  ) / 2
                              ),
                              2
                          )
                      )
                  )
              ) <= c.radius_km
          )

          OR

          /*
           * Fallback:
           * If coordinates are not available,
           * use city and area targeting.
           */
          (
              (
                  c.target_latitude IS NULL
                  OR c.target_longitude IS NULL
              )

              AND
              (
                  c.target_city IS NULL
                  OR LOWER(TRIM(s.city))
                     = LOWER(TRIM(c.target_city))
              )

              AND
              (
                  c.target_area IS NULL
                  OR LOWER(TRIM(s.area))
                     = LOWER(TRIM(c.target_area))
              )
          )

          OR

          /*
           * No location targeting:
           * campaign can run on any assigned screen.
           */
          (
              c.target_city IS NULL
              AND c.target_area IS NULL
              AND c.target_latitude IS NULL
              AND c.target_longitude IS NULL
          )
      )

    ORDER BY c.created_at ASC
    `,
    [screen.id]
);

            // --------------------------------------------------
            // Return advertisements
            // --------------------------------------------------

            res.json({

                screen: {
                    screenId:
                        screen.screen_id,

                    screenName:
                        screen.screen_name,

                    status:
                        screen.status
                },

                advertisements:
                    result.rows

            });


        } catch (error) {

            console.error(
                "Player advertisements error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while fetching player advertisements"
            });

        }

    }
);
// ============================================================
// DEVICE HEARTBEAT
// POST /api/player/heartbeat
// ============================================================

router.post(
    "/heartbeat",
    async (req, res) => {
        try {
            const {
                deviceId,
                screenId
            } = req.body;

            if (!deviceId || !screenId) {
                return res.status(400).json({
                    message:
                        "deviceId and screenId are required"
                });
            }

            const result = await db.query(
                `
                UPDATE player_devices pd
                SET
                    status = 'online',
                    last_seen_at = NOW()
                FROM screens s
                WHERE pd.device_id = $1
                  AND pd.screen_id = s.id
                  AND s.screen_id = $2
                RETURNING
                    pd.id,
                    pd.device_id,
                    pd.screen_id,
                    pd.device_name,
                    pd.device_type,
                    pd.status,
                    pd.last_seen_at
                `,
                [
                    deviceId,
                    screenId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Registered player device not found"
                });
            }

            res.json({
                message:
                    "Heartbeat received successfully",
                device:
                    result.rows[0]
            });

        } catch (error) {
            console.error(
                "Device heartbeat error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while processing heartbeat"
            });
        }
    }
);
module.exports = router;
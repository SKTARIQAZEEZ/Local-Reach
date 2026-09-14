const express = require("express");

const router = express.Router();

const db = require("../database");

const authenticateToken =
    require("../middleware/authMiddleware");

const requireRole =
    require("../middleware/roleMiddleware");


// ======================================================
// GET ALL ADVERTISEMENTS
// ======================================================

router.get(
    "/advertisements",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(`
                SELECT
                    a.id,
                    a.title,
                    a.file_url,
                    a.file_type,
                    a.duration_seconds,
                    a.status,
                    a.created_at,

                    u.full_name AS advertiser_name,
                    u.email AS advertiser_email

                FROM advertisements a

                JOIN users u
                    ON a.advertiser_id = u.id

                ORDER BY a.created_at DESC
            `);


            res.json({
                advertisements: result.rows
            });


        } catch (error) {

            console.error(
                "Admin advertisement fetch error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while loading advertisements"
            });

        }

    }
);


// ======================================================
// APPROVE ADVERTISEMENT
// ======================================================

router.patch(
    "/advertisements/:id/approve",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(`
                UPDATE advertisements

                SET status = 'approved'

                WHERE id = $1
                  AND status = 'pending'

                RETURNING *
            `, [
                req.params.id
            ]);


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Pending advertisement not found"
                });

            }


            res.json({
                message:
                    "Advertisement approved successfully",

                advertisement:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Advertisement approval error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while approving advertisement"
            });

        }

    }
);


// ======================================================
// REJECT ADVERTISEMENT
// ======================================================

router.patch(
    "/advertisements/:id/reject",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {

        try {

            const result = await db.query(`
                UPDATE advertisements

                SET status = 'rejected'

                WHERE id = $1
                  AND status = 'pending'

                RETURNING *
            `, [
                req.params.id
            ]);


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Pending advertisement not found"
                });

            }


            res.json({
                message:
                    "Advertisement rejected successfully",

                advertisement:
                    result.rows[0]
            });


        } catch (error) {

            console.error(
                "Advertisement rejection error:",
                error
            );

            res.status(500).json({
                message:
                    "Server error while rejecting advertisement"
            });

        }

    }
);


module.exports = router;
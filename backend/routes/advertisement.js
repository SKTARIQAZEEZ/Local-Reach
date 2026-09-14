const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");

const db = require("../database");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");


// ============================================================
// MULTER STORAGE
// ============================================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, path.join(__dirname, "../uploads"));

    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});


// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = function (req, file, cb) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/webm"
    ];

    if (allowedTypes.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Only JPG, PNG, WEBP, MP4 and WEBM files are allowed"
            )
        );

    }

};


// ============================================================
// UPLOAD CONFIGURATION
// ============================================================

const upload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {
        fileSize: 50 * 1024 * 1024
    }

});


// ============================================================
// CREATE ADVERTISEMENT
// ============================================================

router.post(
    "/upload",
    authenticateToken,
    requireRole("advertiser"),
    upload.single("advertisement"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    message: "Please select an advertisement file"
                });

            }

            const {
                title,
                durationSeconds
            } = req.body;


            if (!title) {

                return res.status(400).json({
                    message: "Advertisement title is required"
                });

            }


            const fileUrl =
                `/uploads/${req.file.filename}`;


            const fileType =
                req.file.mimetype;


            const duration =
                Number(durationSeconds) || 30;


            const result = await db.query(
                `
                INSERT INTO advertisements
                (
                    advertiser_id,
                    title,
                    file_url,
                    file_type,
                    duration_seconds,
                    status
                )
                VALUES
                ($1, $2, $3, $4, $5, $6)
                RETURNING *
                `,
                [
                    req.user.id,
                    title,
                    fileUrl,
                    fileType,
                    duration,
                    "pending"
                ]
            );


            res.status(201).json({

                message: "Advertisement uploaded successfully",

                advertisement: result.rows[0]

            });


        } catch (error) {

            console.error(
                "Advertisement upload error:",
                error
            );


            if (
                error instanceof multer.MulterError &&
                error.code === "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({
                    message: "File size must be 50MB or less"
                });

            }


            res.status(500).json({

                message:
                    error.message ||
                    "Server error while uploading advertisement"

            });

        }

    }
);


// ============================================================
// GET ADVERTISEMENTS
// ============================================================

router.get(
    "/",
    authenticateToken,
    requireRole("advertiser"),
    async (req, res) => {

        try {

            const result = await db.query(
                `
                SELECT
                    id,
                    title,
                    file_url,
                    file_type,
                    duration_seconds,
                    status,
                    created_at

                FROM advertisements

                WHERE advertiser_id = $1

                ORDER BY created_at DESC
                `,
                [req.user.id]
            );


            res.json({

                advertisements: result.rows

            });


        } catch (error) {

            console.error(
                "Advertisement fetch error:",
                error
            );


            res.status(500).json({

                message:
                    "Server error while fetching advertisements"

            });

        }

    }
);


module.exports = router;
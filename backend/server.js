const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth");
const businessRoutes = require("./routes/business");
const campaignRoutes = require("./routes/campaign");
const paymentRoutes = require("./routes/payment");
const advertisementRoutes = require("./routes/advertisement");
const screenRoutes = require("./routes/screen");
const ownerRoutes = require("./routes/owner");
const ownerCampaignRoutes = require("./routes/ownerCampaign");
const ownerEarningsRoutes = require("./routes/ownerEarnings");
const ownerPayoutsRoutes = require("./routes/ownerPayouts");
const adminPayoutRoutes = require("./routes/adminPayouts");

const adminAdvertisementsRoutes =
    require("./routes/adminAdvertisements");

const adminUsersRoutes = require("./routes/adminUsers");
const adminScreensRoutes = require("./routes/adminScreens");
const adminCampaignsRoutes = require("./routes/adminCampaigns");
const adminDashboardRoutes = require("./routes/adminDashboard");
const playerRoutes = require("./routes/player");

const playerPlaybackRoutes =
    require("./routes/playerPlayback");




const db = require("./database");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/payments", paymentRoutes);

app.use(
    "/api/notifications",
    require("./routes/notification")
);
app.use("/api/owner", ownerRoutes);
app.use("/api/owner", ownerCampaignRoutes);
app.use("/api/owner", ownerEarningsRoutes);
app.use("/api/owner", ownerPayoutsRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/advertisements", advertisementRoutes);
app.use("/api/screens", screenRoutes);
app.use(
    "/api/player/playback",
    playerPlaybackRoutes
);
app.use("/api/player", require("./routes/player"));
app.use("/api/admin", adminDashboardRoutes);

app.use("/api/admin", adminCampaignsRoutes);
app.use("/api/admin", adminScreensRoutes);
app.use("/api/admin", adminPayoutRoutes);

app.use(
    "/api/admin",
    adminAdvertisementsRoutes
);

// Test API
app.get("/api", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");

        res.json({
            message: "LocalReach API is running successfully!",
            database: "Connected",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`LocalReach server running at http://localhost:${PORT}`);
});
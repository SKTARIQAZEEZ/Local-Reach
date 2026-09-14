const db = require("./database");

/*
==================================================
CREATE NOTIFICATION
==================================================
*/

async function createNotification({
    userId,
    type,
    title,
    message,
    campaignId = null,
    screenId = null
}) {
    try {

        if (!userId || !type || !title || !message) {
            console.error(
                "Notification requires userId, type, title and message"
            );

            return null;
        }

        const result = await db.query(
            `
            INSERT INTO notifications
            (
                user_id,
                type,
                title,
                message,
                related_campaign_id,
                related_screen_id
            )
            VALUES
            ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [
                userId,
                type,
                title,
                message,
                campaignId,
                screenId
            ]
        );

        return result.rows[0];

    } catch (error) {

        console.error(
            "Create notification error:",
            error
        );

        return null;
    }
}


/*
==================================================
CAMPAIGN NOTIFICATIONS
==================================================
*/

async function notifyCampaignSubmitted(
    advertiserId,
    campaignId,
    campaignName
) {
    return createNotification({
        userId: advertiserId,

        type: "campaign_submitted",

        title: "Campaign Submitted",

        message:
            `Your campaign "${campaignName}" has been submitted for admin approval.`,

        campaignId
    });
}


async function notifyCampaignApproved(
    advertiserId,
    campaignId,
    campaignName
) {
    return createNotification({
        userId: advertiserId,

        type: "campaign_approved",

        title: "Campaign Approved",

        message:
            `Your campaign "${campaignName}" has been approved and is now active.`,

        campaignId
    });
}


async function notifyCampaignRejected(
    advertiserId,
    campaignId,
    campaignName
) {
    return createNotification({
        userId: advertiserId,

        type: "campaign_rejected",

        title: "Campaign Rejected",

        message:
            `Your campaign "${campaignName}" has been rejected by the admin.`,

        campaignId
    });
}


/*
==================================================
SCREEN NOTIFICATIONS
==================================================
*/

async function notifyScreenApproved(
    ownerId,
    screenId,
    screenName
) {
    return createNotification({
        userId: ownerId,

        type: "screen_approved",

        title: "Screen Approved",

        message:
            `Your screen "${screenName}" has been approved and is now online.`,

        screenId
    });
}


async function notifyScreenRejected(
    ownerId,
    screenId,
    screenName
) {
    return createNotification({
        userId: ownerId,

        type: "screen_rejected",

        title: "Screen Rejected",

        message:
            `Your screen "${screenName}" has been rejected by the admin.`,

        screenId
    });
}


/*
==================================================
PAYMENT NOTIFICATION
==================================================
*/

async function notifyPaymentCompleted(
    advertiserId,
    campaignId,
    campaignName,
    amount
) {
    return createNotification({
        userId: advertiserId,

        type: "payment_completed",

        title: "Payment Completed",

        message:
            `Payment of ₹${Number(amount).toFixed(2)} for "${campaignName}" was completed successfully.`,

        campaignId
    });
}


/*
==================================================
PAYOUT NOTIFICATION
==================================================
*/

async function notifyPayoutApproved(
    ownerId,
    payoutId,
    amount
) {
    return createNotification({
        userId: ownerId,

        type: "payout_approved",

        title: "Payout Approved",

        message:
            `Your payout of ₹${Number(amount).toFixed(2)} has been approved.`,

        campaignId: null,
        screenId: null
    });
}


/*
==================================================
EXPORT
==================================================
*/

module.exports = {
    createNotification,

    notifyCampaignSubmitted,
    notifyCampaignApproved,
    notifyCampaignRejected,

    notifyScreenApproved,
    notifyScreenRejected,

    notifyPaymentCompleted,

    notifyPayoutApproved
};
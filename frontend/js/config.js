// ============================================================
// LocalReach Frontend Configuration
// ============================================================

window.SPOTLOCAL_API = "/api";


// ============================================================
// AUTH HEADERS
// ============================================================

function authHeaders() {

    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}


// ============================================================
// LOGIN PROTECTION
// ============================================================

function requireLogin(requiredRole = null) {

    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    // No login information
    if (!token || !userData) {

        window.location.href = "../login.html";

        return false;
    }

    let user;

    try {

        user = JSON.parse(userData);

    } catch (error) {

        console.error("Invalid user data in localStorage");

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "../login.html";

        return false;
    }


    // ========================================================
    // ROLE CHECK
    // ========================================================

    if (requiredRole && user.role !== requiredRole) {

        alert(
            "You do not have permission to access this page."
        );


        if (user.role === "admin") {

            window.location.href =
                "dashboard.html";

        } else if (user.role === "advertiser") {

            window.location.href =
                "../advertiser/dashboard.html";

        } else if (user.role === "screen_owner") {

            window.location.href =
                "../owner/dashboard.html";

        } else {

            window.location.href =
                "../login.html";
        }

        return false;
    }


    return true;
}
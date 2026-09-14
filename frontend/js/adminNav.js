/* =========================================================
   LOCALREACH - COMMON ADMIN NAVIGATION
========================================================= */

(function () {

    /* =========================================================
       AUTHENTICATION
    ========================================================= */

    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
        window.location.href = "../login.html";
        return;
    }

    let currentUser = null;

    try {
        currentUser = JSON.parse(userData);
    } catch (error) {
        console.error("Invalid user data:", error);

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "../login.html";
        return;
    }


    /* =========================================================
       ADMIN ROLE CHECK
    ========================================================= */

    if (!currentUser || currentUser.role !== "admin") {

        alert("You do not have permission to access the Admin Dashboard.");

        if (currentUser && currentUser.role === "advertiser") {

            window.location.href = "../advertiser/dashboard.html";

        } else if (currentUser && currentUser.role === "screen_owner") {

            window.location.href = "../owner/dashboard.html";

        } else {

            window.location.href = "../login.html";
        }

        return;
    }


    /* =========================================================
       LOGOUT
    ========================================================= */

    window.adminLogout = function () {

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "../login.html";
    };


    /* =========================================================
       ADMIN MENU
    ========================================================= */

    const menuItems = [
        {
            name: "Dashboard",
            icon: "🏠",
            file: "dashboard.html"
        },
        {
            name: "Users",
            icon: "👥",
            file: "users.html"
        },
        {
            name: "Screens",
            icon: "📺",
            file: "screens.html"
        },
        {
            name: "Campaigns",
            icon: "📢",
            file: "campaigns.html"
        },
        {
            name: "Advertisements",
            icon: "🎬",
            file: "advertisements.html"
        },
        {
            name: "Payouts",
            icon: "💳",
            file: "payouts.html"
        },
        {
            name: "Analytics",
            icon: "📊",
            file: "analytics.html"
        }
    ];


    /* =========================================================
       FIND CURRENT PAGE
    ========================================================= */

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    /* =========================================================
       REMOVE OLD SIDEBARS
       
       This also fixes pages that currently contain
       duplicate sidebar HTML.
    ========================================================= */

    document.querySelectorAll(".sidebar").forEach(function (sidebar) {
        sidebar.remove();
    });


    /* =========================================================
       CREATE SIDEBAR
    ========================================================= */

    const sidebar = document.createElement("aside");

    sidebar.className = "sidebar";


    /* =========================================================
       LOGO
    ========================================================= */

    const logo = document.createElement("div");

    logo.className = "logo";
    logo.textContent = "LocalReach";

    sidebar.appendChild(logo);


    /* =========================================================
       NAVIGATION
    ========================================================= */

    const nav = document.createElement("nav");

    nav.className = "admin-nav";


    menuItems.forEach(function (item) {

        const link = document.createElement("a");

        link.href = item.file;

        link.className = "admin-nav-link";


        /* Active page */

        if (currentPage === item.file) {
            link.classList.add("active");
        }


        link.innerHTML = `
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-text">${item.name}</span>
        `;


        nav.appendChild(link);
    });


    sidebar.appendChild(nav);


    /* =========================================================
       LOGOUT
    ========================================================= */

    const logoutLink = document.createElement("a");

    logoutLink.href = "../login.html";

    logoutLink.className = "admin-nav-link logout-link";

    logoutLink.innerHTML = `
        <span class="nav-icon">🚪</span>
        <span class="nav-text">Logout</span>
    `;

    logoutLink.addEventListener("click", function (event) {

        event.preventDefault();

        window.adminLogout();
    });

    sidebar.appendChild(logoutLink);


    /* =========================================================
       INSERT SIDEBAR
    ========================================================= */

    const main =
        document.querySelector(".main") ||
        document.querySelector(".content");

    if (main) {

        document.body.insertBefore(sidebar, main);

    } else {

        document.body.prepend(sidebar);
    }


    /* =========================================================
       MAKE ADMIN USER AVAILABLE
    ========================================================= */

    window.currentAdminUser = currentUser;
    window.adminToken = token;

})();
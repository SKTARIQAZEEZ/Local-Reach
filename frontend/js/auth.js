const API_URL = "http://localhost:5000/api";


// =============================
// SIGNUP
// =============================

const signupForm = document.getElementById("signupForm");

if (signupForm) {

    signupForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const full_name =
            document.getElementById("full_name").value;

        const email =
            document.getElementById("email").value;

        const phone =
            document.getElementById("phone").value;

        const password =
            document.getElementById("password").value;

        const role =
            document.getElementById("role").value;

        const message =
            document.getElementById("signupMessage");

        try {

            const response = await fetch(
                `${API_URL}/auth/signup`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        full_name,
                        email,
                        phone,
                        password,
                        role
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message;
                return;
            }

            // Save login information
            localStorage.setItem(
                "token",
                data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            message.textContent =
                "Account created successfully!";

            // Redirect according to role
            redirectUser(data.user.role);

        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to connect to server.";

        }

    });

}


// =============================
// LOGIN
// =============================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value;

        const password =
            document.getElementById("loginPassword").value;

        const message =
            document.getElementById("loginMessage");

        try {

            const response = await fetch(
                `${API_URL}/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message;
                return;
            }

            localStorage.setItem(
                "token",
                data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            message.textContent =
                "Login successful!";

            redirectUser(data.user.role);

        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to connect to server.";

        }

    });

}


// =============================
// ROLE REDIRECTION
// =============================

function redirectUser(role) {

    if (role === "advertiser") {

        window.location.href =
            "advertiser/dashboard.html";

    } else if (role === "screen_owner") {

        window.location.href =
            "owner/dashboard.html";

    } else if (role === "admin") {

        window.location.href =
            "admin/dashboard.html";

    }

}
// =============================
// FORGOT PASSWORD
// =============================

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");

if (forgotPasswordForm) {

    forgotPasswordForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const phone =
            document.getElementById("resetPhone").value.trim();

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const message =
            document.getElementById("forgotPasswordMessage");

        // Check passwords
        if (newPassword !== confirmPassword) {

            message.textContent =
                "Passwords do not match.";

            return;
        }

        try {

            const response = await fetch(
                `${API_URL}/auth/forgot-password`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        phone,
                        newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {

                message.textContent =
                    data.message;

                return;
            }

            message.textContent =
                "Password reset successfully! Redirecting to login...";

            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 1500);

        } catch (error) {

            console.error(
                "Forgot password error:",
                error
            );

            message.textContent =
                "Unable to connect to server.";

        }

    });

}
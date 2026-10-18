// Honeybadger Media Admin
// Shared application controller.
// Page-specific logic should remain inside this file or be delegated
// to shared API/components. Do not create page-specific JS files.

import { API } from "./api.js";
import { ROUTES, APP } from "./constants.js";


const Admin = (() => {

    /* =========================
       STATE
       ========================= */

    const state = {
        currentRoute: ROUTES.DASHBOARD,
        currentUser: null,
        initialized: false
    };


    /* =========================
       DOM
       ========================= */

    const get = (selector, parent = document) => {
        return parent.querySelector(selector);
    };

    const getAll = (selector, parent = document) => {
        return [...parent.querySelectorAll(selector)];
    };


    /* =========================
       ROUTING
       ========================= */

    function getRoute() {
        const hash = window.location.hash.replace("#", "").trim();

        if (!hash) {
            return ROUTES.DASHBOARD;
        }

        const validRoutes = Object.values(ROUTES);

        return validRoutes.includes(hash)
            ? hash
            : ROUTES.DASHBOARD;
    }


    function navigate(route) {
        if (!Object.values(ROUTES).includes(route)) {
            route = ROUTES.DASHBOARD;
        }

        window.location.hash = route;
    }


    function handleRouteChange() {
        const route = getRoute();

        state.currentRoute = route;

        setActiveNavigation(route);
        updatePageHeader(route);
        renderRoute(route);
    }


    /* =========================
       NAVIGATION
       ========================= */

    function setActiveNavigation(route) {
        getAll("[data-route]").forEach(link => {
            const linkRoute = link.dataset.route;

            link.classList.toggle(
                "active",
                linkRoute === route
            );
        });
    }


    function bindNavigation() {
        getAll("[data-route]").forEach(link => {
            link.addEventListener("click", event => {
                const route = link.dataset.route;

                if (!route) {
                    return;
                }

                event.preventDefault();

                navigate(route);

                if (window.Header?.closeSidebar) {
                    window.Header.closeSidebar();
                }

                if (window.Sidebar?.close) {
                    window.Sidebar.close();
                }
            });
        });
    }


    /* =========================
       PAGE HEADER
       ========================= */

    const pageMeta = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Honeybadger Media administration"
        },

        clients: {
            title: "Clients",
            subtitle: "Manage production companies and clients"
        },

        movies: {
            title: "Movies",
            subtitle: "Manage movies and production projects"
        },

        campaigns: {
            title: "Campaigns",
            subtitle: "Manage movie marketing campaigns"
        },

        venues: {
            title: "Venues",
            subtitle: "Manage activation locations"
        },

        activations: {
            title: "Activations",
            subtitle: "Manage campaign activations"
        },

        leads: {
            title: "Leads",
            subtitle: "Manage audience leads and interactions"
        },

        expenses: {
            title: "Expenses",
            subtitle: "Track campaign expenses"
        },

        invoices: {
            title: "Invoices",
            subtitle: "Manage client invoices and payments"
        },

        reports: {
            title: "Reports",
            subtitle: "Campaign and business reports"
        }
    };


    function updatePageHeader(route) {
        const meta = pageMeta[route] || pageMeta.dashboard;

        const title = get("#pageTitle");
        const subtitle = get("#pageSubtitle");

        if (title) {
            title.textContent = meta.title;
        }

        if (subtitle) {
            subtitle.textContent = meta.subtitle;
        }
    }


    /* =========================
       AUTHENTICATION
       ========================= */

    async function checkSession() {
        if (!window.supabaseClient && !window.supabase) {
            console.error("Supabase client is not available.");
            return false;
        }

        try {
            const client = window.supabaseClient;

            if (!client) {
                console.error("Supabase client is not initialized.");
                return false;
            }

            const {
                data: { user },
                error
            } = await client.auth.getUser();

            if (error || !user) {
                window.location.href = "login.html";
                return false;
            }

            if (user.app_metadata?.role !== "admin") {
                await client.auth.signOut();
                window.location.href = "login.html";
                return false;
            }

            state.currentUser = user;

            setUserDetails(user);

            return true;

        } catch (error) {
            console.error("Authentication check failed:", error);

            window.location.href = "login.html";

            return false;
        }
    }


    function setUserDetails(user) {
        const email = user?.email || "Admin";

        const emailElement = get("#userEmail");
        const avatarElement = get("#avatar");

        if (emailElement) {
            emailElement.textContent = email;
        }

        if (avatarElement) {
            avatarElement.textContent =
                email.charAt(0).toUpperCase();
        }
    }


    /* =========================
       LOGOUT
       ========================= */

    async function logout() {
        try {
            const client = window.supabaseClient;

            if (client) {
                await client.auth.signOut();
            }

            window.location.href = "login.html";

        } catch (error) {
            console.error("Logout failed:", error);
        }
    }


    function bindLogout() {
        const logoutButton = get("#logoutButton");

        if (!logoutButton) {
            return;
        }

        logoutButton.addEventListener("click", logout);
    }


    /* =========================
       PAGE RENDERING
       ========================= */

    function getAppContainer() {
        return (
            get("#app") ||
            get("#pageContent") ||
            get(".content")
        );
    }


    function renderRoute(route) {
        switch (route) {

            case ROUTES.DASHBOARD:
                renderDashboard();
                break;

            case ROUTES.CLIENTS:
                renderClients();
                break;

            case ROUTES.MOVIES:
                renderMovies();
                break;

            case ROUTES.CAMPAIGNS:
                renderCampaigns();
                break;

            case ROUTES.VENUES:
                renderVenues();
                break;

            case ROUTES.ACTIVATIONS:
                renderActivations();
                break;

            case ROUTES.LEADS:
                renderLeads();
                break;

            case ROUTES.EXPENSES:
                renderExpenses();
                break;

            case ROUTES.INVOICES:
                renderInvoices();
                break;

            case ROUTES.REPORTS:
                renderReports();
                break;

            default:
                renderDashboard();
        }
    }


    /* =========================
       DASHBOARD
       ========================= */

    async function renderDashboard() {
        // The initial dashboard HTML is kept as the visual baseline.
        // Dashboard data will be connected through API.js.

        if (typeof window.loadDashboard === "function") {
            await window.loadDashboard();
        }
    }


    /* =========================
       CLIENTS
       ========================= */

    async function renderClients() {
        // Client page implementation will be added here.
        // It will use API.clients and shared Table/Form/Modal components.

        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderClientsPage === "function") {
            await window.renderClientsPage(container);
        }
    }


    /* =========================
       MOVIES
       ========================= */

    async function renderMovies() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderMoviesPage === "function") {
            await window.renderMoviesPage(container);
        }
    }


    /* =========================
       CAMPAIGNS
       ========================= */

    async function renderCampaigns() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderCampaignsPage === "function") {
            await window.renderCampaignsPage(container);
        }
    }


    /* =========================
       VENUES
       ========================= */

    async function renderVenues() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderVenuesPage === "function") {
            await window.renderVenuesPage(container);
        }
    }


    /* =========================
       ACTIVATIONS
       ========================= */

    async function renderActivations() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderActivationsPage === "function") {
            await window.renderActivationsPage(container);
        }
    }


    /* =========================
       LEADS
       ========================= */

    async function renderLeads() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderLeadsPage === "function") {
            await window.renderLeadsPage(container);
        }
    }


    /* =========================
       EXPENSES
       ========================= */

    async function renderExpenses() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderExpensesPage === "function") {
            await window.renderExpensesPage(container);
        }
    }


    /* =========================
       INVOICES
       ========================= */

    async function renderInvoices() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderInvoicesPage === "function") {
            await window.renderInvoicesPage(container);
        }
    }


    /* =========================
       REPORTS
       ========================= */

    async function renderReports() {
        const container = getAppContainer();

        if (!container) {
            return;
        }

        if (typeof window.renderReportsPage === "function") {
            await window.renderReportsPage(container);
        }
    }


    /* =========================
       AUTH STATE
       ========================= */

    function bindAuthState() {
        const client = window.supabaseClient;

        if (!client) {
            return;
        }

        client.auth.onAuthStateChange((event, session) => {

            if (event === "SIGNED_OUT") {
                window.location.href = "login.html";
                return;
            }

            if (
                session?.user &&
                session.user.app_metadata?.role === "admin"
            ) {
                state.currentUser = session.user;
                setUserDetails(session.user);
            }
        });
    }


    /* =========================
       INITIALIZATION
       ========================= */

    async function init() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;

        bindNavigation();
        bindLogout();
        bindAuthState();

        const authenticated = await checkSession();

        if (!authenticated) {
            return;
        }

        window.addEventListener(
            "hashchange",
            handleRouteChange
        );

        handleRouteChange();
    }


    /* =========================
       PUBLIC API
       ========================= */

    return {
        init,
        navigate,
        getRoute,
        getState: () => ({ ...state }),
        logout,
        renderRoute
    };

})();


/* =========================
   GLOBAL ACCESS
   ========================= */

window.Admin = Admin;


/* =========================
   START APPLICATION
   ========================= */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        Admin.init();
    });
} else {
    Admin.init();
}

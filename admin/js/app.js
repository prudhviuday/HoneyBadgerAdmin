// Honeybadger Media Admin
// Main application controller
//
// Responsibilities:
// 1. Authentication / current user
// 2. Hash routing
// 3. Page initialization
// 4. Sidebar navigation
// 5. Shared shell interactions
// 6. Shared Add-button -> modal routing
//
// Page-specific UI and logic lives in:
// ../pages/*.js


import { API } from "./api.js";


import { showDashboard } from "../pages/dashboard.js";

import {
    showClients,
    openClientModal
} from "../pages/clients.js";

import {
    showMovies,
    openMovieModal
} from "../pages/movies.js";

import {
    showCampaigns,
    openCampaignModal
} from "../pages/campaigns.js";

import {
    showVenues,
    openVenueModal
} from "../pages/venues.js";

import {
    showActivations,
    openActivationModal
} from "../pages/activations.js";

import {
    showLeads,
    openLeadModal
} from "../pages/leads.js";

import {
    showExpenses,
    openExpenseModal
} from "../pages/expenses.js";

import {
    showInvoices,
    openInvoiceModal
} from "../pages/invoices.js";

import {
    showReports
} from "../pages/reports.js";


import {
    bindModals
} from "../components/modal.js";


/* =========================================================
   STATE
   ========================================================= */

const state = {

    currentRoute: "dashboard",

    initialized: false

};


/* =========================================================
   PAGE MAP
   ========================================================= */

const pages = {

    dashboard: {
        show: showDashboard,
        title: "Dashboard",
        subtitle: "Honeybadger Media administration"
    },


    clients: {
        show: showClients,
        title: "Clients",
        subtitle: "Manage production houses and marketing clients"
    },


    movies: {
        show: showMovies,
        title: "Movies",
        subtitle: "Manage movie projects"
    },


    campaigns: {
        show: showCampaigns,
        title: "Campaigns",
        subtitle: "Manage movie marketing campaigns"
    },


    venues: {
        show: showVenues,
        title: "Venues",
        subtitle: "Manage activation venues"
    },


    activations: {
        show: showActivations,
        title: "Activations",
        subtitle: "Manage campaign activations"
    },


    leads: {
        show: showLeads,
        title: "Leads",
        subtitle: "Manage audience leads"
    },


    expenses: {
        show: showExpenses,
        title: "Expenses",
        subtitle: "Track campaign expenses"
    },


    invoices: {
        show: showInvoices,
        title: "Invoices",
        subtitle: "Manage client invoices"
    },


    reports: {
        show: showReports,
        title: "Reports",
        subtitle: "Campaign performance and financial reports"
    }

};


/* =========================================================
   ADD BUTTON -> MODAL MAP
   ========================================================= */

/*
 * Every page can use:
 *
 * data-add="client"
 * data-add="movie"
 * data-add="campaign"
 * data-add="venue"
 * data-add="activation"
 * data-add="lead"
 * data-add="expense"
 * data-add="invoice"
 *
 * The corresponding modal function is called automatically.
 */

const addModalHandlers = {

    client: openClientModal,

    movie: openMovieModal,

    campaign: openCampaignModal,

    venue: openVenueModal,

    activation: openActivationModal,

    lead: openLeadModal,

    expense: openExpenseModal,

    invoice: openInvoiceModal

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {

    return document.querySelector(selector);

}


function $all(selector) {

    return document.querySelectorAll(selector);

}


/* =========================================================
   AUTH
   ========================================================= */

async function loadUser() {

    try {

        const result =
            await API.auth.getUser();


        /*
         * Depending on api.js, getUser() may return:
         *
         * {
         *     data: {
         *         user: ...
         *     }
         * }
         */

        const user =
            result?.data?.user;


        const emailElement =
            $("#userEmail");


        const avatarElement =
            $("#avatar");


        if (!user) {

            if (emailElement) {

                emailElement.textContent =
                    "Not signed in";

            }


            if (avatarElement) {

                avatarElement.textContent =
                    "?";

            }


            return;

        }


        const email =
            user.email ||
            "Admin";


        if (emailElement) {

            emailElement.textContent =
                email;

        }


        if (avatarElement) {

            avatarElement.textContent =
                email
                    .charAt(0)
                    .toUpperCase();

        }


    } catch (error) {

        console.error(
            "Unable to load current user:",
            error
        );

    }

}


/* =========================================================
   ROUTER
   ========================================================= */

async function navigate(route) {

    /*
     * If an invalid route is supplied,
     * fall back to dashboard.
     */

    if (!pages[route]) {

        route =
            "dashboard";

    }


    state.currentRoute =
        route;


    updateNavigation(route);


    updatePageShell(route);


    const content =
        $("#content");


    if (!content) {

        console.error(
            "Content container #content was not found."
        );

        return;

    }


    const page =
        pages[route];


    /*
     * Show a loading state while the
     * page module initializes.
     */

    content.innerHTML = `
        <div class="loading">
            Loading...
        </div>
    `;


    try {

        /*
         * Every page module receives
         * the main content container.
         */

        await page.show(content);


    } catch (error) {

        console.error(
            `Error loading ${route} page:`,
            error
        );


        content.innerHTML = `

            <div class="panel">

                <div class="panel-body">

                    <div class="empty">

                        Unable to load this page.

                        <br>

                        <small>
                            ${escapeHTML(
                                error?.message ||
                                "Unknown error"
                            )}
                        </small>

                    </div>

                </div>

            </div>

        `;

    }

}


/* =========================================================
   UPDATE SIDEBAR
   ========================================================= */

function updateNavigation(route) {

    $all(".nav-link").forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.route === route
        );

    });

}


/* =========================================================
   UPDATE TOPBAR
   ========================================================= */

function updatePageShell(route) {

    const page =
        pages[route];


    if (!page) {

        return;

    }


    const titleElement =
        $("#topbarPageTitle") ||
        $(".page-title");


    const subtitleElement =
        $("#topbarPageSubtitle") ||
        $(".page-subtitle");


    if (titleElement) {

        titleElement.textContent =
            page.title;

    }


    if (subtitleElement) {

        subtitleElement.textContent =
            page.subtitle;

    }

}


/* =========================================================
   HASH ROUTING
   ========================================================= */

function getRouteFromHash() {

    const hash =
        window.location.hash
            .replace("#", "")
            .trim()
            .toLowerCase();


    if (!hash) {

        return "dashboard";

    }


    if (!pages[hash]) {

        return "dashboard";

    }


    return hash;

}


/* =========================================================
   HASH CHANGE
   ========================================================= */

window.addEventListener(
    "hashchange",
    async () => {

        await navigate(
            getRouteFromHash()
        );

    }
);


/* =========================================================
   NAVIGATION CLICK HANDLER
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest(
                "[data-route]"
            );


        if (!link) {

            return;

        }


        const route =
            link.dataset.route;


        if (!route) {

            return;

        }


        /*
         * If it is a normal hash link,
         * allow the browser to update the hash.
         */

        const href =
            link.getAttribute("href");


        if (
            href ===
            `#${route}`
        ) {

            closeMobileSidebar();

            return;

        }


        /*
         * For elements that use data-route
         * without a normal hash href.
         */

        event.preventDefault();


        window.location.hash =
            route;


        closeMobileSidebar();

    }
);


/* =========================================================
   SHARED ADD-BUTTON HANDLER
   ========================================================= */

/*
 * This is the important shared event-binding pattern.
 *
 * Example:
 *
 * <button data-add="client">
 *     + Add Client
 * </button>
 *
 * will automatically call:
 *
 * openClientModal()
 *
 * Likewise:
 *
 * data-add="movie"
 * data-add="campaign"
 * data-add="venue"
 * data-add="activation"
 * data-add="lead"
 * data-add="expense"
 * data-add="invoice"
 */

function bindGlobalAddButtons() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-add]"
                );


            if (!button) {

                return;

            }


            const type =
                button.dataset.add;


            if (!type) {

                return;

            }


            const handler =
                addModalHandlers[type];


            if (!handler) {

                console.warn(
                    `No Add modal registered for: ${type}`
                );

                return;

            }


            /*
             * Prevent accidental duplicate
             * navigation/form behavior.
             */

            if (
                button.tagName ===
                "BUTTON"
            ) {

                event.preventDefault();

            }


            /*
             * Open the appropriate modal.
             *
             * No ID means "create new record".
             */

            try {

                handler();

            } catch (error) {

                console.error(
                    `Unable to open ${type} modal:`,
                    error
                );

            }

        }
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "#logoutButton"
            );


        if (!button) {

            return;

        }


        try {

            button.disabled =
                true;


            button.textContent =
                "Signing out...";


            await API.auth.signOut();


            /*
             * index.html is inside /admin/
             * and login.html is one level above.
             */

            window.location.href =
                "../login.html";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );


            button.disabled =
                false;


            button.textContent =
                "Sign out";

        }

    }
);


/* =========================================================
   MOBILE MENU
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "#mobileMenu"
            );


        if (!button) {

            return;

        }


        const sidebar =
            $("#sidebar");


        if (sidebar) {

            sidebar.classList.toggle(
                "open"
            );

        }

    }
);


function closeMobileSidebar() {

    const sidebar =
        $("#sidebar");


    if (!sidebar) {

        return;

    }


    sidebar.classList.remove(
        "open"
    );

}


/* =========================================================
   MODAL SUPPORT
   ========================================================= */

bindModals();


/* =========================================================
   UTILITIES
   ========================================================= */

function escapeHTML(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

    if (state.initialized) {

        return;

    }


    state.initialized =
        true;


    console.log(
        "Honeybadger Admin initializing..."
    );


    try {

        /*
         * Bind shared Add buttons once.
         *
         * This must happen before pages
         * start rendering their buttons.
         */

        bindGlobalAddButtons();


        /*
         * Load logged-in user.
         */

        await loadUser();


        /*
         * Read URL hash and load
         * the appropriate page.
         */

        const route =
            getRouteFromHash();


        /*
         * If there is no hash, put
         * #dashboard in the URL.
         *
         * hashchange will then load
         * the dashboard.
         */

        if (!window.location.hash) {

            window.location.hash =
                "dashboard";

        } else {

            await navigate(route);

        }


        console.log(
            "Honeybadger Admin ready."
        );


    } catch (error) {

        console.error(
            "Application initialization failed:",
            error
        );


        const content =
            $("#content");


        if (content) {

            content.innerHTML = `

                <div class="panel">

                    <div class="panel-body">

                        <div class="empty">

                            Application failed to initialize.

                            <br>

                            <small>
                                ${escapeHTML(
                                    error?.message ||
                                    "Unknown error"
                                )}
                            </small>

                        </div>

                    </div>

                </div>

            `;

        }

    }

}


/* =========================================================
   START APPLICATION
   ========================================================= */

init();

import { API } from "../js/api.js";


/*
 * Normalize API results.
 *
 * Supports:
 *   [ ...rows ]
 *
 * and:
 *   { data: [ ...rows ], error: null }
 */
function getRows(result) {

    if (Array.isArray(result)) {
        return result;
    }

    if (Array.isArray(result?.data)) {
        return result.data;
    }

    return [];
}


/*
 * Escape HTML
 */
function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
 * Format number
 */
function formatNumber(value) {

    return Number(value || 0).toLocaleString("en-IN");
}


/*
 * Format currency
 */
function formatCurrency(value) {

    const number = Number(value || 0);

    return "₹" + number.toLocaleString("en-IN", {
        maximumFractionDigits: 0
    });
}


/*
 * Format date
 */
function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/*
 * Status class
 */
function getStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();

    if (
        value === "active" ||
        value === "completed" ||
        value === "released" ||
        value === "paid" ||
        value === "won"
    ) {
        return "active";
    }

    if (
        value === "inactive" ||
        value === "cancelled" ||
        value === "lost"
    ) {
        return "danger";
    }

    return "";
}


/*
 * Main dashboard
 */
export async function showDashboard(content) {

    content.innerHTML = `

        <div class="page-header">

            <div>

                <h1>Dashboard</h1>

                <p>
                    Overview of your Honeybadger Media operations.
                </p>

            </div>


            <button
                type="button"
                class="btn"
                id="refreshDashboardButton"
            >
                Refresh
            </button>

        </div>


        <!-- Statistics -->

        <div class="stats">

            <div class="stat-card">

                <div class="stat-label">
                    Campaigns
                </div>

                <div
                    class="stat-value"
                    id="dashboardCampaigns"
                >
                    —
                </div>

                <div class="stat-description">
                    Total campaigns
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Active Campaigns
                </div>

                <div
                    class="stat-value"
                    id="dashboardActiveCampaigns"
                >
                    —
                </div>

                <div class="stat-description">
                    Currently running
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Activations
                </div>

                <div
                    class="stat-value"
                    id="dashboardActivations"
                >
                    —
                </div>

                <div class="stat-description">
                    Total activations
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Leads
                </div>

                <div
                    class="stat-value"
                    id="dashboardLeads"
                >
                    —
                </div>

                <div class="stat-description">
                    Total leads generated
                </div>

            </div>

        </div>


        <!-- Recent sections -->

        <div
            class="dashboard-grid"
            style="
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 20px;
                align-items: start;
            "
        >


            <!-- Recent Campaigns -->

            <div class="panel">

                <div class="panel-header">

                    <div class="panel-title">
                        Recent Campaigns
                    </div>

                    <button
                        type="button"
                        class="panel-link"
                        data-route="campaigns"
                    >
                        View All
                    </button>

                </div>


                <div
                    class="panel-body"
                    id="recentCampaigns"
                >

                    <div class="loading">
                        Loading campaigns...
                    </div>

                </div>

            </div>


            <!-- Recent Leads -->

            <div class="panel">

                <div class="panel-header">

                    <div class="panel-title">
                        Recent Leads
                    </div>

                    <button
                        type="button"
                        class="panel-link"
                        data-route="leads"
                    >
                        View All
                    </button>

                </div>


                <div
                    class="panel-body"
                    id="recentLeads"
                >

                    <div class="loading">
                        Loading leads...
                    </div>

                </div>

            </div>


        </div>


        <!-- Quick Overview -->

        <div class="panel dashboard-overview">

            <div class="panel-header">

                <div class="panel-title">
                    Quick Overview
                </div>

            </div>


            <div
                class="panel-body"
                id="dashboardOverview"
            >

                <div class="loading">
                    Loading overview...
                </div>

            </div>

        </div>

    `;


    /*
     * Refresh dashboard
     */
    document
        .getElementById("refreshDashboardButton")
        ?.addEventListener(
            "click",
            () => showDashboard(content)
        );


    /*
     * Load dashboard data
     */
    await Promise.all([

        loadDashboardStats(),

        loadRecentCampaigns(),

        loadRecentLeads(),

        loadDashboardOverview()

    ]);
}


/*
 * Dashboard statistics
 */
async function loadDashboardStats() {

    try {

        const result =
            await API.dashboard.getStats();


        if (result?.error) {
            throw result.error;
        }


        const stats =
            result?.data ||
            result ||
            {};


        const campaigns =
            Number(
                stats.campaigns ||
                stats.totalCampaigns ||
                0
            );


        const activeCampaigns =
            Number(
                stats.activeCampaigns ||
                stats.active_campaigns ||
                0
            );


        const activations =
            Number(
                stats.activations ||
                stats.totalActivations ||
                0
            );


        const leads =
            Number(
                stats.leads ||
                stats.totalLeads ||
                0
            );


        const campaignElement =
            document.getElementById(
                "dashboardCampaigns"
            );


        const activeCampaignElement =
            document.getElementById(
                "dashboardActiveCampaigns"
            );


        const activationElement =
            document.getElementById(
                "dashboardActivations"
            );


        const leadElement =
            document.getElementById(
                "dashboardLeads"
            );


        if (campaignElement) {

            campaignElement.textContent =
                formatNumber(campaigns);

        }


        if (activeCampaignElement) {

            activeCampaignElement.textContent =
                formatNumber(activeCampaigns);

        }


        if (activationElement) {

            activationElement.textContent =
                formatNumber(activations);

        }


        if (leadElement) {

            leadElement.textContent =
                formatNumber(leads);

        }


    } catch (error) {

        console.error(
            "Dashboard stats error:",
            error
        );

    }
}


/*
 * Recent campaigns
 */
async function loadRecentCampaigns() {

    const container =
        document.getElementById(
            "recentCampaigns"
        );


    if (!container) return;


    try {

        const result =
            await API.dashboard.recentCampaigns(5);


        if (result?.error) {
            throw result.error;
        }


        const campaigns =
            getRows(result);


        if (!campaigns.length) {

            container.innerHTML = `

                <div class="empty">
                    No campaigns found.
                </div>

            `;

            return;
        }


        container.innerHTML = `

            <div
                class="dashboard-list"
                style="
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                "
            >

                ${campaigns.map(campaign => `

                    <div
                        class="dashboard-list-row"
                        style="
                            display: flex;
                            flex-direction: row;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            gap: 16px;
                        "
                    >

                        <div
                            style="
                                min-width: 0;
                                flex: 1;
                            "
                        >

                            <div class="primary-text">

                                ${escapeHtml(
                                    campaign.name ||
                                    campaign.campaign_name ||
                                    "Untitled Campaign"
                                )}

                            </div>


                            <div class="dashboard-meta">

                                ${escapeHtml(
                                    campaign.movie_name ||
                                    campaign.movie?.title ||
                                    campaign.movie?.name ||
                                    "No movie"
                                )}

                            </div>

                        </div>


                        <div
                            class="dashboard-list-right"
                            style="
                                display: flex;
                                flex-direction: column;
                                align-items: flex-end;
                                justify-content: center;
                                flex-shrink: 0;
                                text-align: right;
                            "
                        >

                            <span
                                class="status ${getStatusClass(
                                    campaign.status
                                )}"
                            >

                                ${escapeHtml(
                                    campaign.status ||
                                    "Active"
                                )}

                            </span>


                            <div class="dashboard-date">

                                ${formatDate(
                                    campaign.start_date ||
                                    campaign.created_at
                                )}

                            </div>

                        </div>

                    </div>

                `).join("")}

            </div>

        `;


    } catch (error) {

        console.error(
            "Recent campaigns error:",
            error
        );


        container.innerHTML = `

            <div class="empty">
                Unable to load recent campaigns.
            </div>

        `;
    }
}


/*
 * Recent leads
 */
async function loadRecentLeads() {

    const container =
        document.getElementById(
            "recentLeads"
        );


    if (!container) return;


    try {

        const result =
            await API.dashboard.recentLeads(5);


        if (result?.error) {
            throw result.error;
        }


        const leads =
            getRows(result);


        if (!leads.length) {

            container.innerHTML = `

                <div class="empty">
                    No leads found.
                </div>

            `;

            return;
        }


        container.innerHTML = `

            <div
                class="dashboard-list"
                style="
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                "
            >

                ${leads.map(lead => `

                    <div
                        class="dashboard-list-row"
                        style="
                            display: flex;
                            flex-direction: row;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            gap: 16px;
                        "
                    >

                        <div
                            style="
                                min-width: 0;
                                flex: 1;
                            "
                        >

                            <div class="primary-text">

                                ${escapeHtml(
                                    lead.name ||
                                    lead.lead_name ||
                                    lead.full_name ||
                                    "Unnamed Lead"
                                )}

                            </div>


                            <div class="dashboard-meta">

                                ${escapeHtml(
                                    lead.source ||
                                    lead.lead_source ||
                                    "Unknown source"
                                )}

                            </div>

                        </div>


                        <div
                            class="dashboard-list-right"
                            style="
                                display: flex;
                                flex-direction: column;
                                align-items: flex-end;
                                justify-content: center;
                                flex-shrink: 0;
                                text-align: right;
                            "
                        >

                            <span
                                class="status ${getStatusClass(
                                    lead.status
                                )}"
                            >

                                ${escapeHtml(
                                    lead.status ||
                                    "New"
                                )}

                            </span>


                            <div class="dashboard-date">

                                ${formatDate(
                                    lead.created_at
                                )}

                            </div>

                        </div>

                    </div>

                `).join("")}

            </div>

        `;


    } catch (error) {

        console.error(
            "Recent leads error:",
            error
        );


        container.innerHTML = `

            <div class="empty">
                Unable to load recent leads.
            </div>

        `;
    }
}


/*
 * Dashboard overview
 *
 * Uses the existing resource APIs so this
 * remains independent of the dashboard stats
 * endpoint.
 */
async function loadDashboardOverview() {

    const container =
        document.getElementById(
            "dashboardOverview"
        );


    if (!container) return;


    try {

        const results =
            await Promise.all([

                API.clients.list(),

                API.movies.list(),

                API.venues.list(),

                API.invoices.list()

            ]);


        const clients =
            getRows(results[0]);


        const movies =
            getRows(results[1]);


        const venues =
            getRows(results[2]);


        const invoices =
            getRows(results[3]);


        const totalClients =
            clients.length;


        const totalMovies =
            movies.length;


        const totalVenues =
            venues.length;


        const totalInvoiced =
            invoices.reduce(
                (sum, invoice) =>
                    sum +
                    Number(
                        invoice.total_amount ??
                        invoice.amount ??
                        invoice.total ??
                        0
                    ),
                0
            );


        const totalPaid =
            invoices.reduce(
                (sum, invoice) =>
                    sum +
                    Number(
                        invoice.paid_amount ??
                        invoice.amount_paid ??
                        invoice.paid ??
                        0
                    ),
                0
            );


        const outstanding =
            Math.max(
                0,
                totalInvoiced -
                totalPaid
            );


        container.innerHTML = `

            <div
                class="dashboard-overview-grid"
                style="
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 16px;
                "
            >


                <div class="overview-item">

                    <div class="overview-label">
                        Clients
                    </div>

                    <div class="overview-value">
                        ${formatNumber(totalClients)}
                    </div>

                </div>


                <div class="overview-item">

                    <div class="overview-label">
                        Movies
                    </div>

                    <div class="overview-value">
                        ${formatNumber(totalMovies)}
                    </div>

                </div>


                <div class="overview-item">

                    <div class="overview-label">
                        Venues
                    </div>

                    <div class="overview-value">
                        ${formatNumber(totalVenues)}
                    </div>

                </div>


                <div class="overview-item">

                    <div class="overview-label">
                        Invoiced
                    </div>

                    <div class="overview-value">
                        ${formatCurrency(totalInvoiced)}
                    </div>

                </div>


                <div class="overview-item">

                    <div class="overview-label">
                        Paid
                    </div>

                    <div class="overview-value">
                        ${formatCurrency(totalPaid)}
                    </div>

                </div>


                <div class="overview-item">

                    <div class="overview-label">
                        Outstanding
                    </div>

                    <div class="overview-value">
                        ${formatCurrency(outstanding)}
                    </div>

                </div>


            </div>

        `;


    } catch (error) {

        console.error(
            "Dashboard overview error:",
            error
        );


        container.innerHTML = `

            <div class="empty">
                Unable to load overview.
            </div>

        `;
    }
}
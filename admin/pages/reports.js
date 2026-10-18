import { API } from "../js/api.js";

let reportData = {
    clients: [],
    movies: [],
    campaigns: [],
    activations: [],
    leads: [],
    expenses: [],
    invoices: []
};

let currentPeriod = "all";


export async function showReports(content) {

    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Reports</h1>
                <p class="page-subtitle">
                    Business performance, campaign activity and financial overview.
                </p>
            </div>

            <div class="page-header-actions">
                <select id="reportPeriod" class="report-select">
                    <option value="all">All time</option>
                    <option value="month">This month</option>
                    <option value="quarter">This quarter</option>
                    <option value="year">This year</option>
                </select>

                <button class="btn secondary" id="refreshReports">
                    ↻ Refresh
                </button>
            </div>
        </div>


        <div id="reportsContent">

            <div class="loading">
                Loading reports...
            </div>

        </div>
    `;


    document
        .getElementById("refreshReports")
        ?.addEventListener(
            "click",
            loadReports
        );


    document
        .getElementById("reportPeriod")
        ?.addEventListener(
            "change",
            event => {

                currentPeriod =
                    event.target.value;

                renderReports();

            }
        );


    await loadReports();
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadReports() {

    const container =
        document.getElementById(
            "reportsContent"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="loading">
            Loading reports...
        </div>
    `;


    try {

        const results =
            await Promise.all([

                API.clients.list(),
                API.movies.list(),
                API.campaigns.list(),
                API.activations.list(),
                API.leads.list(),
                API.expenses.list(),
                API.invoices.list()

            ]);


        reportData = {

            clients:
                safeArray(results[0]),

            movies:
                safeArray(results[1]),

            campaigns:
                safeArray(results[2]),

            activations:
                safeArray(results[3]),

            leads:
                safeArray(results[4]),

            expenses:
                safeArray(results[5]),

            invoices:
                safeArray(results[6])

        };


        renderReports();

    } catch (error) {

        console.error(
            "Failed to load reports:",
            error
        );


        container.innerHTML = `
            <div class="empty">
                Failed to load reports.
            </div>
        `;
    }
}


/* =========================================================
   MAIN REPORT
========================================================= */

function renderReports() {

    const container =
        document.getElementById(
            "reportsContent"
        );


    if (!container) return;


    const data =
        getFilteredData();


    const financial =
        calculateFinancials(
            data
        );


    const campaignStats =
        calculateCampaignStats(
            data
        );


    const activationStats =
        calculateActivationStats(
            data
        );


    const leadStats =
        calculateLeadStats(
            data
        );


    container.innerHTML = `

        <!-- FINANCIAL -->

        <section class="report-section">

            <div class="report-section-head">
                <div>
                    <h2>Financial Overview</h2>
                    <p>
                        Revenue, payments and campaign expenses.
                    </p>
                </div>
            </div>


            <div class="stats-grid">

                ${statCard(
                    "Invoiced",
                    formatCurrency(
                        financial.invoiced
                    )
                )}

                ${statCard(
                    "Collected",
                    formatCurrency(
                        financial.paid
                    )
                )}

                ${statCard(
                    "Outstanding",
                    formatCurrency(
                        financial.outstanding
                    )
                )}

                ${statCard(
                    "Expenses",
                    formatCurrency(
                        financial.expenses
                    )
                )}

            </div>


            <div class="report-grid">

                ${reportPanel(
                    "Gross Position",
                    `
                        <div class="report-big-number">
                            ${formatCurrency(
                                financial.grossPosition
                            )}
                        </div>

                        <div class="report-muted">
                            Collected revenue minus recorded expenses
                        </div>
                    `
                )}


                ${reportPanel(
                    "Outstanding Invoices",
                    `
                        <div class="report-big-number">
                            ${financial.outstandingInvoices}
                        </div>

                        <div class="report-muted">
                            Invoices with unpaid balances
                        </div>
                    `
                )}

            </div>

        </section>


        <!-- CAMPAIGNS -->

        <section class="report-section">

            <div class="report-section-head">

                <div>
                    <h2>Campaign Performance</h2>
                    <p>
                        Current campaign activity and completion.
                    </p>
                </div>

            </div>


            <div class="stats-grid">

                ${statCard(
                    "Total Campaigns",
                    campaignStats.total
                )}

                ${statCard(
                    "Active",
                    campaignStats.active
                )}

                ${statCard(
                    "Upcoming",
                    campaignStats.upcoming
                )}

                ${statCard(
                    "Completed",
                    campaignStats.completed
                )}

            </div>


            <div class="panel">

                <div class="panel-header">
                    <strong>Campaign Summary</strong>
                </div>


                ${renderCampaignTable(
                    data.campaigns
                )}

            </div>

        </section>


        <!-- ACTIVATIONS -->

        <section class="report-section">

            <div class="report-section-head">

                <div>
                    <h2>Activation Activity</h2>
                    <p>
                        On-ground promotional activity.
                    </p>
                </div>

            </div>


            <div class="stats-grid">

                ${statCard(
                    "Total Activations",
                    activationStats.total
                )}

                ${statCard(
                    "Upcoming",
                    activationStats.upcoming
                )}

                ${statCard(
                    "Active",
                    activationStats.active
                )}

                ${statCard(
                    "Completed",
                    activationStats.completed
                )}

            </div>


            <div class="panel">

                <div class="panel-header">
                    <strong>Recent Activations</strong>
                </div>


                ${renderActivationTable(
                    data.activations
                )}

            </div>

        </section>


        <!-- LEADS -->

        <section class="report-section">

            <div class="report-section-head">

                <div>
                    <h2>Lead Pipeline</h2>
                    <p>
                        Business enquiries and conversion activity.
                    </p>
                </div>

            </div>


            <div class="stats-grid">

                ${statCard(
                    "Total Leads",
                    leadStats.total
                )}

                ${statCard(
                    "New",
                    leadStats.newLeads
                )}

                ${statCard(
                    "Qualified",
                    leadStats.qualified
                )}

                ${statCard(
                    "Converted",
                    leadStats.converted
                )}

            </div>


            <div class="panel">

                <div class="panel-header">
                    <strong>Lead Sources</strong>
                </div>


                ${renderLeadSources(
                    data.leads
                )}

            </div>

        </section>


        <!-- CLIENTS + MOVIES -->

        <section class="report-section">

            <div class="report-section-head">

                <div>
                    <h2>Business Overview</h2>
                    <p>
                        Clients, movies and campaign pipeline.
                    </p>
                </div>

            </div>


            <div class="report-grid">

                ${reportPanel(
                    "Clients",
                    `
                        <div class="report-big-number">
                            ${data.clients.length}
                        </div>

                        <div class="report-muted">
                            Total clients in the system
                        </div>
                    `
                )}


                ${reportPanel(
                    "Movies",
                    `
                        <div class="report-big-number">
                            ${data.movies.length}
                        </div>

                        <div class="report-muted">
                            Movies currently tracked
                        </div>
                    `
                )}

            </div>

        </section>

    `;
}


/* =========================================================
   FILTER DATA
========================================================= */

function getFilteredData() {

    if (currentPeriod === "all") {
        return {
            ...reportData
        };
    }


    return {

        clients:
            filterByDate(
                reportData.clients
            ),

        movies:
            filterByDate(
                reportData.movies
            ),

        campaigns:
            filterByDate(
                reportData.campaigns
            ),

        activations:
            filterByDate(
                reportData.activations
            ),

        leads:
            filterByDate(
                reportData.leads
            ),

        expenses:
            filterByDate(
                reportData.expenses
            ),

        invoices:
            filterByDate(
                reportData.invoices
            )

    };
}


function filterByDate(rows) {

    const now =
        new Date();


    let start;


    if (
        currentPeriod ===
        "month"
    ) {

        start =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

    } else if (
        currentPeriod ===
        "quarter"
    ) {

        const quarter =
            Math.floor(
                now.getMonth() / 3
            );

        start =
            new Date(
                now.getFullYear(),
                quarter * 3,
                1
            );

    } else if (
        currentPeriod ===
        "year"
    ) {

        start =
            new Date(
                now.getFullYear(),
                0,
                1
            );

    } else {

        return rows;
    }


    return rows.filter(
        row => {

            const date =
                getRowDate(row);


            if (!date) {
                return false;
            }


            const parsed =
                new Date(date);


            return (
                !Number.isNaN(
                    parsed.getTime()
                ) &&
                parsed >= start
            );
        }
    );
}


/* =========================================================
   FINANCIAL CALCULATIONS
========================================================= */

function calculateFinancials(
    data
) {

    let invoiced = 0;
    let paid = 0;
    let expenses = 0;

    let outstandingInvoices = 0;


    data.invoices.forEach(
        invoice => {

            const total =
                getInvoiceTotal(
                    invoice
                );


            const amountPaid =
                getInvoicePaid(
                    invoice
                );


            invoiced += total;
            paid += amountPaid;


            if (
                total >
                amountPaid
            ) {
                outstandingInvoices++;
            }

        }
    );


    data.expenses.forEach(
        expense => {

            expenses +=
                getExpenseAmount(
                    expense
                );

        }
    );


    return {

        invoiced,

        paid,

        outstanding:
            Math.max(
                invoiced - paid,
                0
            ),

        expenses,

        grossPosition:
            paid - expenses,

        outstandingInvoices

    };
}


/* =========================================================
   CAMPAIGN STATS
========================================================= */

function calculateCampaignStats(
    data
) {

    return {

        total:
            data.campaigns.length,

        active:
            countStatus(
                data.campaigns,
                "active"
            ),

        upcoming:
            countStatus(
                data.campaigns,
                "upcoming"
            ),

        completed:
            countStatus(
                data.campaigns,
                "completed"
            )

    };
}


/* =========================================================
   ACTIVATION STATS
========================================================= */

function calculateActivationStats(
    data
) {

    return {

        total:
            data.activations.length,

        active:
            countStatus(
                data.activations,
                "active"
            ),

        upcoming:
            countStatus(
                data.activations,
                "upcoming"
            ),

        completed:
            countStatus(
                data.activations,
                "completed"
            )

    };
}


/* =========================================================
   LEAD STATS
========================================================= */

function calculateLeadStats(
    data
) {

    return {

        total:
            data.leads.length,

        newLeads:
            countStatus(
                data.leads,
                "new"
            ),

        qualified:
            countStatus(
                data.leads,
                "qualified"
            ),

        converted:
            countStatus(
                data.leads,
                "converted"
            )

    };
}


/* =========================================================
   CAMPAIGN TABLE
========================================================= */

function renderCampaignTable(
    campaigns
) {

    if (!campaigns.length) {

        return `
            <div class="empty">
                No campaign data available.
            </div>
        `;
    }


    const rows =
        [...campaigns]
            .sort(
                (a, b) =>
                    new Date(
                        getRowDate(b) || 0
                    ) -
                    new Date(
                        getRowDate(a) || 0
                    )
            )
            .slice(0, 10);


    return `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>
                        <th>Campaign</th>
                        <th>Client</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Budget</th>
                        <th>Status</th>
                    </tr>

                </thead>


                <tbody>

                    ${rows.map(
                        campaign => {

                            const name =
                                campaign.name ||
                                campaign.campaign_name ||
                                "Untitled";

                            const client =
                                campaign.client_name ||
                                campaign.client?.name ||
                                "—";

                            const budget =
                                Number(
                                    campaign.budget
                                ) || 0;

                            const status =
                                getStatus(
                                    campaign
                                );


                            return `

                                <tr>

                                    <td>
                                        <div class="primary-text">
                                            ${esc(name)}
                                        </div>
                                    </td>

                                    <td>
                                        ${esc(client)}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            campaign.start_date
                                        )}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            campaign.end_date
                                        )}
                                    </td>

                                    <td>
                                        ${formatCurrency(
                                            budget
                                        )}
                                    </td>

                                    <td>

                                        <span
                                            class="status ${getStatusClass(
                                                status
                                            )}">

                                            ${esc(
                                                capitalize(
                                                    status
                                                )
                                            )}

                                        </span>

                                    </td>

                                </tr>

                            `;

                        }
                    ).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   ACTIVATION TABLE
========================================================= */

function renderActivationTable(
    activations
) {

    if (!activations.length) {

        return `
            <div class="empty">
                No activation data available.
            </div>
        `;
    }


    const rows =
        [...activations]
            .sort(
                (a, b) =>
                    new Date(
                        getRowDate(b) || 0
                    ) -
                    new Date(
                        getRowDate(a) || 0
                    )
            )
            .slice(0, 10);


    return `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>
                        <th>Activation</th>
                        <th>Campaign</th>
                        <th>Venue</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>

                </thead>


                <tbody>

                    ${rows.map(
                        activation => {

                            const name =
                                activation.name ||
                                activation.activation_name ||
                                "Untitled";

                            const campaign =
                                activation.campaign_name ||
                                activation.campaign?.name ||
                                "—";

                            const venue =
                                activation.venue_name ||
                                activation.venue?.name ||
                                "—";

                            const status =
                                getStatus(
                                    activation
                                );


                            return `

                                <tr>

                                    <td>
                                        <div class="primary-text">
                                            ${esc(name)}
                                        </div>
                                    </td>

                                    <td>
                                        ${esc(campaign)}
                                    </td>

                                    <td>
                                        ${esc(venue)}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            getRowDate(
                                                activation
                                            )
                                        )}
                                    </td>

                                    <td>

                                        <span
                                            class="status ${getStatusClass(
                                                status
                                            )}">

                                            ${esc(
                                                capitalize(
                                                    status
                                                )
                                            )}

                                        </span>

                                    </td>

                                </tr>

                            `;

                        }
                    ).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   LEAD SOURCES
========================================================= */

function renderLeadSources(
    leads
) {

    if (!leads.length) {

        return `
            <div class="empty">
                No lead data available.
            </div>
        `;
    }


    const sources = {};


    leads.forEach(
        lead => {

            const source =
                lead.source ||
                "Unknown";


            sources[source] =
                (sources[source] || 0) +
                1;

        }
    );


    const sorted =
        Object.entries(
            sources
        ).sort(
            (a, b) =>
                b[1] - a[1]
        );


    const total =
        leads.length;


    return `

        <div class="report-list">

            ${sorted.map(
                ([source, count]) => {

                    const percentage =
                        Math.round(
                            count /
                            total *
                            100
                        );


                    return `

                        <div class="report-list-row">

                            <div>

                                <div class="primary-text">
                                    ${esc(source)}
                                </div>

                                <div class="report-muted">
                                    ${count} lead${count === 1 ? "" : "s"}
                                </div>

                            </div>


                            <div class="report-percentage">
                                ${percentage}%
                            </div>

                        </div>

                    `;

                }
            ).join("")}

        </div>
    `;
}


/* =========================================================
   UI HELPERS
========================================================= */

function statCard(
    label,
    value
) {

    return `

        <div class="stat-card">

            <div class="stat-label">
                ${esc(label)}
            </div>

            <div class="stat-value">
                ${esc(value)}
            </div>

        </div>
    `;
}


function reportPanel(
    title,
    body
) {

    return `

        <div class="panel report-panel">

            <div class="panel-header">
                <strong>
                    ${esc(title)}
                </strong>
            </div>

            <div class="report-panel-body">
                ${body}
            </div>

        </div>
    `;
}


/* =========================================================
   HELPERS
========================================================= */

function safeArray(value) {

    return Array.isArray(value)
        ? value
        : [];
}


function countStatus(
    rows,
    status
) {

    return rows.filter(
        row =>
            getStatus(row) ===
            status
    ).length;
}


function getStatus(row) {

    return String(
        row.status ||
        "unknown"
    ).toLowerCase();
}


function getRowDate(row) {

    return (
        row.created_at ||
        row.date ||
        row.start_date ||
        row.activation_date ||
        row.expense_date ||
        row.invoice_date ||
        row.event_date ||
        null
    );
}


function getInvoiceTotal(
    invoice
) {

    return Number(
        invoice.total_amount ??
        invoice.amount ??
        invoice.total ??
        0
    ) || 0;
}


function getInvoicePaid(
    invoice
) {

    return Number(
        invoice.paid_amount ??
        invoice.amount_paid ??
        invoice.paid ??
        0
    ) || 0;
}


function getExpenseAmount(
    expense
) {

    return Number(
        expense.amount ??
        expense.total_amount ??
        expense.cost ??
        0
    ) || 0;
}


function formatCurrency(
    value
) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(
        Number(value) || 0
    );
}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return esc(
            String(value)
        );
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


function getStatusClass(
    status
) {

    switch (
        String(status).toLowerCase()
    ) {

        case "active":
            return "success";

        case "completed":
            return "success";

        case "upcoming":
            return "warning";

        case "paid":
            return "success";

        case "sent":
            return "success";

        case "partial":
            return "warning";

        case "pending":
            return "warning";

        case "cancelled":
        case "canceled":
        case "lost":
            return "danger";

        case "draft":
            return "muted";

        default:
            return "";
    }
}


function capitalize(value) {

    if (!value) return "";

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function esc(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

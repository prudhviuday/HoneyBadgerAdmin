import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea } from "../components/form.js";

let allCampaigns = [];


/* =========================================================
   HELPERS
========================================================= */

function getRows(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (Array.isArray(result?.data)) {
        return result.data;
    }

    return [];
}


/* =========================================================
   SHOW PAGE
========================================================= */

export async function showCampaigns(content) {

    content.innerHTML = `
        <div class="page-header">

            <div>
                <h1>Campaigns</h1>

                <p>
                    Manage movie marketing campaigns and their progress.
                </p>
            </div>


            <button
                type="button"
                class="btn"
                data-add="campaign"
            >
                + Add Campaign
            </button>

        </div>


        <div class="stats">

            <div class="stat-card">

                <div class="stat-label">
                    Total Campaigns
                </div>

                <div
                    class="stat-value"
                    id="campaignTotal"
                >
                    —
                </div>

                <div class="stat-description">
                    All campaigns
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Active
                </div>

                <div
                    class="stat-value"
                    id="campaignActive"
                >
                    —
                </div>

                <div class="stat-description">
                    Currently running
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Upcoming
                </div>

                <div
                    class="stat-value"
                    id="campaignUpcoming"
                >
                    —
                </div>

                <div class="stat-description">
                    Yet to start
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Completed
                </div>

                <div
                    class="stat-value"
                    id="campaignCompleted"
                >
                    —
                </div>

                <div class="stat-description">
                    Completed campaigns
                </div>

            </div>

        </div>


        <div class="panel">

            <div class="panel-header">

                <div class="panel-title">
                    Campaigns
                </div>


                <button
                    type="button"
                    class="panel-link"
                    id="refreshCampaignsButton"
                >
                    Refresh
                </button>

            </div>


            <div class="panel-body">

                <div class="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>Campaign</th>
                                <th>Movie</th>
                                <th>Client</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Budget</th>
                                <th>Status</th>
                                <th>Actions</th>

                            </tr>

                        </thead>


                        <tbody id="campaignsTable">

                            <tr>

                                <td colspan="8">

                                    <div class="loading">
                                        Loading campaigns...
                                    </div>

                                </td>

                            </tr>

                        </tbody>

                    </table>

                </div>

            </div>

        </div>
    `;


    document
        .getElementById(
            "refreshCampaignsButton"
        )
        ?.addEventListener(
            "click",
            loadCampaigns
        );


    await loadCampaigns();
}


/* =========================================================
   LOAD CAMPAIGNS
========================================================= */

async function loadCampaigns() {

    const tbody =
        document.getElementById(
            "campaignsTable"
        );


    if (!tbody) return;


    tbody.innerHTML = `
        <tr>

            <td colspan="8">

                <div class="loading">
                    Loading campaigns...
                </div>

            </td>

        </tr>
    `;


    try {

        const result =
            await API.campaigns.list();


        if (result?.error) {
            throw result.error;
        }


        allCampaigns =
            getRows(result);


        updateCampaignStats(
            allCampaigns
        );


        if (!allCampaigns.length) {

            tbody.innerHTML = `
                <tr>

                    <td colspan="8">

                        <div class="empty">
                            No campaigns found.
                        </div>

                    </td>

                </tr>
            `;

            return;
        }


        tbody.innerHTML =
            allCampaigns
                .map(
                    renderCampaignRow
                )
                .join("");


        bindCampaignActions();

    } catch (error) {

        console.error(
            "Campaigns loading error:",
            error
        );


        allCampaigns = [];


        tbody.innerHTML = `
            <tr>

                <td colspan="8">

                    <div class="error">
                        Unable to load campaigns.
                    </div>

                </td>

            </tr>
        `;
    }
}


/* =========================================================
   CAMPAIGN ROW
========================================================= */

function renderCampaignRow(
    campaign
) {

    const name =
        campaign.name ||
        campaign.campaign_name ||
        "Unnamed Campaign";


    const movie =
        campaign.movie_name ||
        campaign.movie?.title ||
        campaign.movie?.name ||
        "—";


    const client =
        campaign.client_name ||
        campaign.client?.name ||
        "—";


    const status =
        campaign.status ||
        "Draft";


    return `
        <tr>

            <td>

                <div class="primary-text">

                    ${escapeHtml(name)}

                </div>

                ${
                    campaign.description
                        ? `
                            <div class="movie-meta">
                                ${escapeHtml(
                                    campaign.description
                                )}
                            </div>
                          `
                        : ""
                }

            </td>


            <td>

                ${escapeHtml(movie)}

            </td>


            <td>

                ${escapeHtml(client)}

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
                    campaign.budget
                )}

            </td>


            <td>

                <span
                    class="status ${getStatusClass(status)}"
                >

                    ${escapeHtml(status)}

                </span>

            </td>


            <td>

                <div class="actions">

                    <button
                        type="button"
                        class="icon-btn"
                        data-action="edit-campaign"
                        data-id="${escapeHtml(
                            campaign.id
                        )}"
                    >
                        Edit
                    </button>


                    <button
                        type="button"
                        class="icon-btn delete"
                        data-action="delete-campaign"
                        data-id="${escapeHtml(
                            campaign.id
                        )}"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}


/* =========================================================
   CAMPAIGN STATISTICS
========================================================= */

function updateCampaignStats(
    campaigns = []
) {

    const total =
        document.getElementById(
            "campaignTotal"
        );


    const active =
        document.getElementById(
            "campaignActive"
        );


    const upcoming =
        document.getElementById(
            "campaignUpcoming"
        );


    const completed =
        document.getElementById(
            "campaignCompleted"
        );


    if (!total) return;


    total.textContent =
        campaigns.length;


    active.textContent =
        campaigns.filter(
            campaign =>
                String(
                    campaign.status ||
                    ""
                ).toLowerCase() ===
                "active"
        ).length;


    upcoming.textContent =
        campaigns.filter(
            campaign =>
                String(
                    campaign.status ||
                    ""
                ).toLowerCase() ===
                "upcoming"
        ).length;


    completed.textContent =
        campaigns.filter(
            campaign =>
                String(
                    campaign.status ||
                    ""
                ).toLowerCase() ===
                "completed"
        ).length;
}


/* =========================================================
   CAMPAIGN ACTIONS
========================================================= */

function bindCampaignActions() {

    const tbody =
        document.getElementById(
            "campaignsTable"
        );


    if (!tbody) return;


    tbody.onclick =
        event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );


            if (!button) return;


            const id =
                button.dataset.id;


            const action =
                button.dataset.action;


            if (
                action ===
                "edit-campaign"
            ) {

                openCampaignModal(id);

            }


            if (
                action ===
                "delete-campaign"
            ) {

                deleteCampaign(id);

            }

        };
}


/* =========================================================
   ADD / EDIT MODAL
========================================================= */

export async function openCampaignModal(
    id = null
) {

    let campaign = {};


    if (id) {

        try {

            const result =
                await API.campaigns.get(id);


            if (result?.error) {
                throw result.error;
            }


            campaign =
                result?.data ||
                result ||
                {};

        } catch (error) {

            console.error(
                "Failed to load campaign:",
                error
            );


            alert(
                error?.message ||
                "Failed to load campaign."
            );


            return;
        }
    }


    const isEdit =
        Boolean(id);


    const movies =
        await getMovieOptions(
            campaign.movie_id
        );


    const clients =
        await getClientOptions(
            campaign.client_id
        );


    const body = `

        <form id="campaignForm">

            ${input(
                "name",
                "Campaign Name",
                "text",
                campaign.name ||
                campaign.campaign_name ||
                "",
                true
            )}


            ${select(
                "movie_id",
                "Movie",
                movies,
                campaign.movie_id ||
                "",
                true
            )}


            ${select(
                "client_id",
                "Client",
                clients,
                campaign.client_id ||
                "",
                true
            )}


            ${textarea(
                "description",
                "Description",
                campaign.description ||
                ""
            )}


            ${input(
                "start_date",
                "Start Date",
                "date",
                campaign.start_date ||
                "",
                true
            )}


            ${input(
                "end_date",
                "End Date",
                "date",
                campaign.end_date ||
                "",
                true
            )}


            ${input(
                "budget",
                "Budget",
                "number",
                campaign.budget ??
                "",
                false,
                'min="0" step="0.01"'
            )}


            ${select(
                "status",
                "Status",
                [
                    {
                        value: "draft",
                        label: "Draft"
                    },
                    {
                        value: "upcoming",
                        label: "Upcoming"
                    },
                    {
                        value: "active",
                        label: "Active"
                    },
                    {
                        value: "completed",
                        label: "Completed"
                    },
                    {
                        value: "cancelled",
                        label: "Cancelled"
                    }
                ],
                campaign.status ||
                "draft",
                true
            )}


            <div class="form-actions">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="campaignModal"
                >
                    Cancel
                </button>


                <button
                    type="submit"
                    class="btn"
                >
                    ${
                        isEdit
                            ? "Save Changes"
                            : "Create Campaign"
                    }
                </button>

            </div>

        </form>
    `;


    const existing =
        document.getElementById(
            "campaignModal"
        );


    if (existing) {
        existing.remove();
    }


    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "campaignModal",
            isEdit
                ? "Edit Campaign"
                : "Add Campaign",
            body
        )
    );


    document
        .getElementById(
            "campaignModal"
        )
        ?.classList.add("show");


    document
        .getElementById(
            "campaignForm"
        )
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await saveCampaign(id);

            }
        );
}


/* =========================================================
   SAVE CAMPAIGN
========================================================= */

async function saveCampaign(id) {

    const form =
        document.getElementById(
            "campaignForm"
        );


    if (!form) return;


    const formData =
        new FormData(form);


    const data = {

        name:
            formData
                .get("name")
                ?.trim() ||
            null,


        movie_id:
            formData.get(
                "movie_id"
            ) || null,


        client_id:
            formData.get(
                "client_id"
            ) || null,


        description:
            formData
                .get("description")
                ?.trim() ||
            null,


        start_date:
            formData.get(
                "start_date"
            ) || null,


        end_date:
            formData.get(
                "end_date"
            ) || null,


        budget:
            formData.get(
                "budget"
            )
                ? Number(
                    formData.get(
                        "budget"
                    )
                )
                : null,


        status:
            formData.get(
                "status"
            ) || "draft"

    };


    try {

        let result;


        if (id) {

            result =
                await API.campaigns.update(
                    id,
                    data
                );

        } else {

            result =
                await API.campaigns.create(
                    data
                );

        }


        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "campaignModal"
            )
            ?.classList.remove(
                "show"
            );


        await loadCampaigns();

    } catch (error) {

        console.error(
            "Failed to save campaign:",
            error
        );


        alert(
            error?.message ||
            "Failed to save campaign."
        );
    }
}


/* =========================================================
   DELETE CAMPAIGN
========================================================= */

async function deleteCampaign(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Are you sure you want to delete this campaign?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.campaigns.remove(id);


        if (result?.error) {
            throw result.error;
        }


        await loadCampaigns();

    } catch (error) {

        console.error(
            "Failed to delete campaign:",
            error
        );


        alert(
            error?.message ||
            "Failed to delete campaign."
        );
    }
}


/* =========================================================
   MOVIE OPTIONS
========================================================= */

async function getMovieOptions(
    selectedId = ""
) {

    try {

        const result =
            await API.movies.list();


        if (result?.error) {
            throw result.error;
        }


        const movies =
            getRows(result);


        return movies.map(
            movie => ({

                value:
                    movie.id,

                label:
                    movie.title ||
                    movie.name ||
                    movie.movie_name ||
                    "Untitled Movie"

            })
        );

    } catch (error) {

        console.error(
            "Failed to load movies:",
            error
        );


        return [];
    }
}


/* =========================================================
   CLIENT OPTIONS
========================================================= */

async function getClientOptions(
    selectedId = ""
) {

    try {

        const result =
            await API.clients.list();


        if (result?.error) {
            throw result.error;
        }


        const clients =
            getRows(result);


        return clients.map(
            client => ({

                value:
                    client.id,

                label:
                    client.name ||
                    "Unnamed Client"

            })
        );

    } catch (error) {

        console.error(
            "Failed to load clients:",
            error
        );


        return [];
    }
}


/* =========================================================
   FORMAT CURRENCY
========================================================= */

function formatCurrency(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";
    }


    const amount =
        Number(value);


    if (Number.isNaN(amount)) {
        return "—";
    }


    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(amount);
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {

    if (!value) return "—";


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

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


/* =========================================================
   STATUS CSS CLASS
========================================================= */

function getStatusClass(status) {

    const value =
        String(
            status || ""
        )
            .toLowerCase();


    if (
        value === "active" ||
        value === "completed" ||
        value === "approved" ||
        value === "paid" ||
        value === "won"
    ) {

        return "active";
    }


    if (
        value === "cancelled" ||
        value === "canceled"
    ) {

        return "danger";
    }


    if (
        value === "upcoming"
    ) {

        return "warning";
    }


    return "";
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

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

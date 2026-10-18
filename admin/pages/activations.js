import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea } from "../components/form.js";

let allActivations = [];
let currentFilter = "all";


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

export async function showActivations(content) {

    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Activations</h1>
                <p class="page-subtitle">
                    Manage campaign activations, events and on-ground promotional activities.
                </p>
            </div>

            <div class="page-header-actions">

                <button
                    class="btn secondary"
                    id="refreshActivations">
                    ↻ Refresh
                </button>

                <button
                    class="btn"
                    data-add="activation">
                    + Add Activation
                </button>

            </div>
        </div>


        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-label">Total Activations</div>
                <div class="stat-value" id="totalActivations">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">Active</div>
                <div class="stat-value" id="activeActivations">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">Completed</div>
                <div class="stat-value" id="completedActivations">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">Upcoming</div>
                <div class="stat-value" id="upcomingActivations">0</div>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">

                <div class="venue-toolbar">

                    <button
                        class="venue-filter active"
                        data-filter="all">
                        All activations
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="active">
                        Active
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="upcoming">
                        Upcoming
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="completed">
                        Completed
                    </button>

                </div>


                <div class="venue-search">

                    <input
                        type="text"
                        id="activationSearch"
                        placeholder="Search activations..."
                    >

                </div>

            </div>


            <div id="activationsTable">
                <div class="loading">
                    Loading activations...
                </div>
            </div>

        </div>
    `;


    currentFilter = "all";


    document
        .getElementById("refreshActivations")
        ?.addEventListener(
            "click",
            loadActivations
        );


    document
        .querySelectorAll(".venue-filter")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentFilter =
                        button.dataset.filter;

                    document
                        .querySelectorAll(".venue-filter")
                        .forEach(btn =>
                            btn.classList.remove("active")
                        );

                    button.classList.add("active");

                    renderActivations();

                }
            );

        });


    document
        .getElementById("activationSearch")
        ?.addEventListener(
            "input",
            renderActivations
        );


    await loadActivations();
}


/* =========================================================
   LOAD
========================================================= */

async function loadActivations() {

    const table =
        document.getElementById(
            "activationsTable"
        );

    if (!table) return;


    table.innerHTML = `
        <div class="loading">
            Loading activations...
        </div>
    `;


    try {

        const result =
            await API.activations.list();


        if (result?.error) {
            throw result.error;
        }


        allActivations =
            getRows(result);


        updateStats();
        renderActivations();

    } catch (error) {

        console.error(
            "Failed to load activations:",
            error
        );


        allActivations = [];


        table.innerHTML = `
            <div class="empty">
                Failed to load activations.
            </div>
        `;
    }
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const total =
        allActivations.length;


    const active =
        allActivations.filter(
            activation =>
                getStatus(activation) ===
                "active"
        ).length;


    const completed =
        allActivations.filter(
            activation =>
                getStatus(activation) ===
                "completed"
        ).length;


    const upcoming =
        allActivations.filter(
            activation =>
                getStatus(activation) ===
                "upcoming"
        ).length;


    setText(
        "totalActivations",
        total
    );

    setText(
        "activeActivations",
        active
    );

    setText(
        "completedActivations",
        completed
    );

    setText(
        "upcomingActivations",
        upcoming
    );
}


/* =========================================================
   FILTER + SEARCH
========================================================= */

function renderActivations() {

    const container =
        document.getElementById(
            "activationsTable"
        );

    if (!container) return;


    const search =
        document
            .getElementById("activationSearch")
            ?.value
            ?.trim()
            .toLowerCase() || "";


    let rows =
        [...allActivations];


    if (currentFilter !== "all") {

        rows =
            rows.filter(
                activation =>
                    getStatus(activation) ===
                    currentFilter
            );

    }


    if (search) {

        rows =
            rows.filter(activation => {

                const text = [

                    activation.name,
                    activation.activation_name,

                    activation.campaign_name,
                    activation.campaign?.name,
                    activation.campaign?.campaign_name,

                    activation.venue_name,
                    activation.venue?.name,

                    activation.city,

                    activation.type,
                    activation.activation_type,

                    activation.status

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                return text.includes(search);

            });

    }


    if (!rows.length) {

        container.innerHTML = `
            <div class="empty">
                No activations found.
            </div>
        `;

        return;
    }


    container.innerHTML = `
        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Activation</th>
                        <th>Campaign</th>
                        <th>Venue</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${rows
                        .map(renderRow)
                        .join("")}

                </tbody>

            </table>

        </div>
    `;


    container
        .querySelectorAll(
            "[data-edit-activation]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openActivationModal(
                        button.dataset.editActivation
                    );

                }
            );

        });


    container
        .querySelectorAll(
            "[data-delete-activation]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteActivation(
                        button.dataset.deleteActivation
                    );

                }
            );

        });
}


/* =========================================================
   TABLE ROW
========================================================= */

function renderRow(activation) {

    const name =
        activation.name ||
        activation.activation_name ||
        "Untitled Activation";


    const campaign =
        activation.campaign_name ||
        activation.campaign?.name ||
        activation.campaign?.campaign_name ||
        "—";


    const venue =
        activation.venue_name ||
        activation.venue?.name ||
        "—";


    const date =
        activation.activation_date ||
        activation.date ||
        activation.start_date ||
        activation.event_date;


    const type =
        activation.type ||
        activation.activation_type ||
        "—";


    const status =
        getStatus(activation);


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
                ${formatDate(date)}
            </td>


            <td>
                ${esc(type)}
            </td>


            <td>

                <span
                    class="status ${getStatusClass(status)}">

                    ${esc(
                        capitalize(status)
                    )}

                </span>

            </td>


            <td class="actions">

                <button
                    class="icon-btn"
                    title="Edit"
                    data-edit-activation="${escAttr(
                        activation.id
                    )}">
                    Edit
                </button>


                <button
                    class="icon-btn danger"
                    title="Delete"
                    data-delete-activation="${escAttr(
                        activation.id
                    )}">
                    Delete
                </button>

            </td>

        </tr>
    `;
}


/* =========================================================
   ADD / EDIT MODAL
========================================================= */

export async function openActivationModal(id = null) {

    let activation = {};


    if (id) {

        try {

            const result =
                await API.activations.get(id);


            if (result?.error) {
                throw result.error;
            }


            activation =
                result?.data ||
                result ||
                {};

        } catch (error) {

            console.error(
                "Failed to load activation:",
                error
            );


            alert(
                error?.message ||
                "Failed to load activation."
            );

            return;
        }

    }


    const isEdit =
        Boolean(id);


    const campaigns =
        await getCampaignOptions(
            activation.campaign_id
        );


    const venues =
        await getVenueOptions(
            activation.venue_id
        );


    const body = `

        <form id="activationForm">

            ${input(
                "name",
                "Activation Name",
                "text",
                activation.name ||
                activation.activation_name ||
                "",
                true
            )}


            ${select(
                "campaign_id",
                "Campaign",
                campaigns,
                activation.campaign_id ||
                "",
                true
            )}


            ${select(
                "venue_id",
                "Venue",
                venues,
                activation.venue_id ||
                "",
                true
            )}


            ${input(
                "activation_date",
                "Activation Date",
                "date",
                activation.activation_date ||
                activation.date ||
                activation.event_date ||
                "",
                true
            )}


            ${select(
                "type",
                "Activation Type",
                [
                    {
                        value: "Mall",
                        label: "Mall"
                    },
                    {
                        value: "College",
                        label: "College"
                    },
                    {
                        value: "Theatre",
                        label: "Theatre"
                    },
                    {
                        value: "Cafe",
                        label: "Cafe"
                    },
                    {
                        value: "Public Event",
                        label: "Public Event"
                    },
                    {
                        value: "Corporate",
                        label: "Corporate"
                    },
                    {
                        value: "Outdoor",
                        label: "Outdoor"
                    },
                    {
                        value: "Other",
                        label: "Other"
                    }
                ],
                activation.type ||
                activation.activation_type ||
                ""
            )}


            ${input(
                "expected_footfall",
                "Expected Footfall",
                "number",
                activation.expected_footfall ||
                ""
            )}


            ${input(
                "actual_footfall",
                "Actual Footfall",
                "number",
                activation.actual_footfall ||
                ""
            )}


            ${input(
                "budget",
                "Budget",
                "number",
                activation.budget ||
                ""
            )}


            ${input(
                "contact_person",
                "Contact Person",
                "text",
                activation.contact_person ||
                ""
            )}


            ${input(
                "contact_phone",
                "Contact Phone",
                "text",
                activation.contact_phone ||
                activation.phone ||
                ""
            )}


            ${textarea(
                "notes",
                "Notes",
                activation.notes ||
                ""
            )}


            <div class="form-actions">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="activationModal">
                    Cancel
                </button>


                <button
                    type="submit"
                    class="btn">

                    ${
                        isEdit
                            ? "Save Changes"
                            : "Create Activation"
                    }

                </button>

            </div>

        </form>
    `;


    const existing =
        document.getElementById(
            "activationModal"
        );


    if (existing) {
        existing.remove();
    }


    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "activationModal",
            isEdit
                ? "Edit Activation"
                : "Add Activation",
            body
        )
    );


    document
        .getElementById("activationModal")
        ?.classList.add("show");


    document
        .getElementById("activationForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await saveActivation(id);

            }
        );
}


/* =========================================================
   SAVE
========================================================= */

async function saveActivation(id) {

    const form =
        document.getElementById(
            "activationForm"
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

        campaign_id:
            formData.get(
                "campaign_id"
            ) || null,

        venue_id:
            formData.get(
                "venue_id"
            ) || null,

        activation_date:
            formData.get(
                "activation_date"
            ) || null,

        type:
            formData.get(
                "type"
            ) || null,

        expected_footfall:
            formData.get(
                "expected_footfall"
            )
                ? Number(
                    formData.get(
                        "expected_footfall"
                    )
                )
                : null,

        actual_footfall:
            formData.get(
                "actual_footfall"
            )
                ? Number(
                    formData.get(
                        "actual_footfall"
                    )
                )
                : null,

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

        contact_person:
            formData
                .get("contact_person")
                ?.trim() ||
            null,

        contact_phone:
            formData
                .get("contact_phone")
                ?.trim() ||
            null,

        notes:
            formData
                .get("notes")
                ?.trim() ||
            null

    };


    try {

        let result;


        if (id) {

            result =
                await API.activations.update(
                    id,
                    data
                );

        } else {

            result =
                await API.activations.create(
                    data
                );

        }


        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "activationModal"
            )
            ?.classList.remove(
                "show"
            );


        await loadActivations();

    } catch (error) {

        console.error(
            "Failed to save activation:",
            error
        );


        alert(
            error?.message ||
            "Failed to save activation."
        );
    }
}


/* =========================================================
   DELETE
========================================================= */

async function deleteActivation(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Are you sure you want to delete this activation?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.activations.remove(id);


        if (result?.error) {
            throw result.error;
        }


        await loadActivations();

    } catch (error) {

        console.error(
            "Failed to delete activation:",
            error
        );


        alert(
            error?.message ||
            "Failed to delete activation."
        );
    }
}


/* =========================================================
   OPTIONS
========================================================= */

async function getCampaignOptions(
    selectedId = ""
) {

    try {

        const result =
            await API.campaigns.list();


        if (result?.error) {
            throw result.error;
        }


        const campaigns =
            getRows(result);


        return campaigns.map(
            campaign => ({

                value:
                    campaign.id,

                label:
                    campaign.name ||
                    campaign.campaign_name ||
                    "Untitled Campaign"

            })
        );

    } catch (error) {

        console.error(
            "Failed to load campaigns:",
            error
        );

        return [];
    }
}


async function getVenueOptions(
    selectedId = ""
) {

    try {

        const result =
            await API.venues.list();


        if (result?.error) {
            throw result.error;
        }


        const venues =
            getRows(result);


        return venues.map(
            venue => ({

                value:
                    venue.id,

                label:
                    venue.name ||
                    venue.venue_name ||
                    "Unnamed Venue"

            })
        );

    } catch (error) {

        console.error(
            "Failed to load venues:",
            error
        );

        return [];
    }
}


/* =========================================================
   HELPERS
========================================================= */

function getStatus(activation) {

    if (activation?.status) {

        return String(
            activation.status
        ).toLowerCase();

    }


    const date =
        activation?.activation_date ||
        activation?.date ||
        activation?.event_date ||
        activation?.start_date;


    if (!date) {
        return "active";
    }


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const activationDate =
        new Date(date);

    activationDate.setHours(
        0,
        0,
        0,
        0
    );


    if (activationDate > today) {
        return "upcoming";
    }


    if (activationDate < today) {
        return "completed";
    }


    return "active";
}


function getStatusClass(status) {

    switch (
        String(status).toLowerCase()
    ) {

        case "active":
            return "success";

        case "completed":
            return "muted";

        case "upcoming":
            return "warning";

        case "cancelled":
        case "canceled":
            return "danger";

        default:
            return "";
    }
}


function formatDate(value) {

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


function capitalize(value) {

    if (!value) return "";


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent =
            value;
    }
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


function escAttr(value) {
    return esc(value);
}

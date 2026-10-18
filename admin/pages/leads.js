import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea } from "../components/form.js";

let allLeads = [];
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

export async function showLeads(content) {

    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Leads</h1>
                <p class="page-subtitle">
                    Manage enquiries, prospects and business leads generated through campaigns.
                </p>
            </div>

            <div class="page-header-actions">

                <button
                    class="btn secondary"
                    id="refreshLeads">
                    ↻ Refresh
                </button>

                <button
                    class="btn"
                    data-add="lead">
                    + Add Lead
                </button>

            </div>
        </div>


        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-label">Total Leads</div>
                <div class="stat-value" id="totalLeads">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">New</div>
                <div class="stat-value" id="newLeads">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">Contacted</div>
                <div class="stat-value" id="contactedLeads">0</div>
            </div>

            <div class="stat-card">
                <div class="stat-label">Converted</div>
                <div class="stat-value" id="convertedLeads">0</div>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">

                <div class="venue-toolbar">

                    <button
                        class="venue-filter active"
                        data-filter="all">
                        All leads
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="new">
                        New
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="contacted">
                        Contacted
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="qualified">
                        Qualified
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="converted">
                        Converted
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="lost">
                        Lost
                    </button>

                </div>


                <div class="venue-search">

                    <input
                        type="text"
                        id="leadSearch"
                        placeholder="Search leads..."
                    >

                </div>

            </div>


            <div id="leadsTable">
                <div class="loading">
                    Loading leads...
                </div>
            </div>

        </div>
    `;


    currentFilter = "all";


    document
        .getElementById("refreshLeads")
        ?.addEventListener(
            "click",
            loadLeads
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

                    renderLeads();

                }
            );

        });


    document
        .getElementById("leadSearch")
        ?.addEventListener(
            "input",
            renderLeads
        );


    await loadLeads();
}


/* =========================================================
   LOAD
========================================================= */

async function loadLeads() {

    const table =
        document.getElementById("leadsTable");

    if (!table) return;


    table.innerHTML = `
        <div class="loading">
            Loading leads...
        </div>
    `;


    try {

        const result =
            await API.leads.list();


        if (result?.error) {
            throw result.error;
        }


        allLeads =
            getRows(result);


        updateStats();
        renderLeads();

    } catch (error) {

        console.error(
            "Failed to load leads:",
            error
        );


        allLeads = [];


        table.innerHTML = `
            <div class="empty">
                Failed to load leads.
            </div>
        `;
    }
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const total =
        allLeads.length;


    const newLeads =
        allLeads.filter(
            lead =>
                getStatus(lead) === "new"
        ).length;


    const contacted =
        allLeads.filter(
            lead =>
                getStatus(lead) === "contacted"
        ).length;


    const converted =
        allLeads.filter(
            lead =>
                getStatus(lead) === "converted"
        ).length;


    setText(
        "totalLeads",
        total
    );

    setText(
        "newLeads",
        newLeads
    );

    setText(
        "contactedLeads",
        contacted
    );

    setText(
        "convertedLeads",
        converted
    );
}


/* =========================================================
   FILTER + SEARCH
========================================================= */

function renderLeads() {

    const container =
        document.getElementById("leadsTable");

    if (!container) return;


    const search =
        document
            .getElementById("leadSearch")
            ?.value
            ?.trim()
            .toLowerCase() || "";


    let rows =
        [...allLeads];


    if (currentFilter !== "all") {

        rows =
            rows.filter(
                lead =>
                    getStatus(lead) ===
                    currentFilter
            );

    }


    if (search) {

        rows =
            rows.filter(lead => {

                const text = [

                    lead.name,
                    lead.full_name,
                    lead.contact_name,

                    lead.email,
                    lead.phone,

                    lead.company,
                    lead.company_name,

                    lead.campaign_name,
                    lead.campaign?.name,

                    lead.client_name,
                    lead.client?.name,

                    lead.source,
                    lead.city,

                    lead.status

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
                No leads found.
            </div>
        `;

        return;
    }


    container.innerHTML = `
        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Lead</th>
                        <th>Contact</th>
                        <th>Campaign</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Created</th>
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
            "[data-edit-lead]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    openLeadModal(
                        button.dataset.editLead
                    )
            );

        });


    container
        .querySelectorAll(
            "[data-delete-lead]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteLead(
                        button.dataset.deleteLead
                    )
            );

        });
}


/* =========================================================
   TABLE ROW
========================================================= */

function renderRow(lead) {

    const name =
        lead.name ||
        lead.full_name ||
        lead.contact_name ||
        "Unnamed Lead";


    const email =
        lead.email || "";


    const phone =
        lead.phone || "";


    const campaign =
        lead.campaign_name ||
        lead.campaign?.name ||
        "—";


    const source =
        lead.source ||
        "—";


    const status =
        getStatus(lead);


    return `
        <tr>

            <td>

                <div class="primary-text">
                    ${esc(name)}
                </div>

                ${
                    lead.company ||
                    lead.company_name
                        ? `
                            <div class="muted">
                                ${esc(
                                    lead.company ||
                                    lead.company_name
                                )}
                            </div>
                          `
                        : ""
                }

            </td>


            <td>

                ${
                    email
                        ? `
                            <div>
                                ${esc(email)}
                            </div>
                          `
                        : ""
                }

                ${
                    phone
                        ? `
                            <div class="muted">
                                ${esc(phone)}
                            </div>
                          `
                        : ""
                }

                ${
                    !email && !phone
                        ? "—"
                        : ""
                }

            </td>


            <td>
                ${esc(campaign)}
            </td>


            <td>
                ${esc(source)}
            </td>


            <td>

                <span
                    class="status ${getStatusClass(status)}">

                    ${esc(
                        capitalize(status)
                    )}

                </span>

            </td>


            <td>
                ${formatDate(
                    lead.created_at
                )}
            </td>


            <td class="actions">

                <button
                    class="icon-btn"
                    title="Edit"
                    data-edit-lead="${escAttr(
                        lead.id
                    )}">
                    Edit
                </button>


                <button
                    class="icon-btn danger"
                    title="Delete"
                    data-delete-lead="${escAttr(
                        lead.id
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

export async function openLeadModal(id = null) {

    let lead = {};


    if (id) {

        try {

            const result =
                await API.leads.get(id);


            if (result?.error) {
                throw result.error;
            }


            lead =
                result?.data ||
                result ||
                {};

        } catch (error) {

            console.error(
                "Failed to load lead:",
                error
            );


            alert(
                error?.message ||
                "Failed to load lead."
            );

            return;
        }

    }


    const isEdit =
        Boolean(id);


    const campaigns =
        await getCampaignOptions(
            lead.campaign_id
        );


    const clients =
        await getClientOptions(
            lead.client_id
        );


    const body = `

        <form id="leadForm">

            ${input(
                "name",
                "Lead Name",
                "text",
                lead.name ||
                lead.full_name ||
                "",
                true
            )}


            ${input(
                "email",
                "Email",
                "email",
                lead.email ||
                ""
            )}


            ${input(
                "phone",
                "Phone",
                "text",
                lead.phone ||
                ""
            )}


            ${input(
                "company",
                "Company",
                "text",
                lead.company ||
                lead.company_name ||
                ""
            )}


            ${select(
                "client_id",
                "Client",
                clients,
                lead.client_id ||
                "",
                false
            )}


            ${select(
                "campaign_id",
                "Campaign",
                campaigns,
                lead.campaign_id ||
                "",
                false
            )}


            ${select(
                "source",
                "Lead Source",
                [
                    {
                        value: "Website",
                        label: "Website"
                    },
                    {
                        value: "WhatsApp",
                        label: "WhatsApp"
                    },
                    {
                        value: "Phone",
                        label: "Phone"
                    },
                    {
                        value: "Email",
                        label: "Email"
                    },
                    {
                        value: "Social Media",
                        label: "Social Media"
                    },
                    {
                        value: "Event",
                        label: "Event"
                    },
                    {
                        value: "Referral",
                        label: "Referral"
                    },
                    {
                        value: "Other",
                        label: "Other"
                    }
                ],
                lead.source ||
                "",
                false
            )}


            ${select(
                "status",
                "Status",
                [
                    {
                        value: "new",
                        label: "New"
                    },
                    {
                        value: "contacted",
                        label: "Contacted"
                    },
                    {
                        value: "qualified",
                        label: "Qualified"
                    },
                    {
                        value: "converted",
                        label: "Converted"
                    },
                    {
                        value: "lost",
                        label: "Lost"
                    }
                ],
                lead.status ||
                "new",
                true
            )}


            ${input(
                "city",
                "City",
                "text",
                lead.city ||
                ""
            )}


            ${textarea(
                "notes",
                "Notes",
                lead.notes ||
                ""
            )}


            <div class="form-actions">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="leadModal">
                    Cancel
                </button>


                <button
                    type="submit"
                    class="btn">

                    ${
                        isEdit
                            ? "Save Changes"
                            : "Create Lead"
                    }

                </button>

            </div>

        </form>
    `;


    const existing =
        document.getElementById(
            "leadModal"
        );


    if (existing) {
        existing.remove();
    }


    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "leadModal",
            isEdit
                ? "Edit Lead"
                : "Add Lead",
            body
        )
    );


    document
        .getElementById("leadModal")
        ?.classList.add("show");


    document
        .getElementById("leadForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await saveLead(id);

            }
        );
}


/* =========================================================
   SAVE
========================================================= */

async function saveLead(id) {

    const form =
        document.getElementById(
            "leadForm"
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

        email:
            formData
                .get("email")
                ?.trim() ||
            null,

        phone:
            formData
                .get("phone")
                ?.trim() ||
            null,

        company:
            formData
                .get("company")
                ?.trim() ||
            null,

        client_id:
            formData.get(
                "client_id"
            ) || null,

        campaign_id:
            formData.get(
                "campaign_id"
            ) || null,

        source:
            formData.get(
                "source"
            ) || null,

        status:
            formData.get(
                "status"
            ) || "new",

        city:
            formData
                .get("city")
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
                await API.leads.update(
                    id,
                    data
                );

        } else {

            result =
                await API.leads.create(
                    data
                );

        }


        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "leadModal"
            )
            ?.classList.remove(
                "show"
            );


        await loadLeads();

    } catch (error) {

        console.error(
            "Failed to save lead:",
            error
        );


        alert(
            error?.message ||
            "Failed to save lead."
        );
    }
}


/* =========================================================
   DELETE
========================================================= */

async function deleteLead(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Are you sure you want to delete this lead?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.leads.remove(id);


        if (result?.error) {
            throw result.error;
        }


        await loadLeads();

    } catch (error) {

        console.error(
            "Failed to delete lead:",
            error
        );


        alert(
            error?.message ||
            "Failed to delete lead."
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
   HELPERS
========================================================= */

function getStatus(lead) {

    return String(
        lead?.status ||
        "new"
    ).toLowerCase();
}


function getStatusClass(status) {

    switch (
        String(status).toLowerCase()
    ) {

        case "new":
            return "warning";

        case "contacted":
            return "success";

        case "qualified":
            return "success";

        case "converted":
            return "success";

        case "lost":
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

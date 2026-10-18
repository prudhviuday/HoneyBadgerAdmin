import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, textarea } from "../components/form.js";


/**
 * Normalize API list results.
 * Supports both:
 *   [...]
 * and:
 *   { data: [...] }
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


/**
 * Render Clients page
 */
export async function showClients(content) {

    content.innerHTML = `
        <div class="page-header">

            <div>
                <h1>Clients</h1>
                <p>Manage your movie production and marketing clients.</p>
            </div>

            <button
                type="button"
                class="btn"
                data-add="client"
            >
                + Add Client
            </button>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div class="panel-title">
                    All Clients
                </div>
            </div>


            <div class="panel-body">

                <div class="table-wrapper">

                    <table>

                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Contact Person</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>


                        <tbody id="clientsTable">

                            <tr>
                                <td colspan="7">

                                    <div class="loading">
                                        Loading clients...
                                    </div>

                                </td>
                            </tr>

                        </tbody>

                    </table>

                </div>

            </div>

        </div>
    `;


    bindClientEvents();

    await loadClients();
}


/**
 * Load clients from Supabase
 */
async function loadClients() {

    const tbody = document.getElementById("clientsTable");

    if (!tbody) return;


    tbody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="loading">
                    Loading clients...
                </div>
            </td>
        </tr>
    `;


    try {

        const result = await API.clients.list();

        if (result?.error) {
            throw result.error;
        }


        const clients = getRows(result);


        if (!clients.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7">

                        <div class="empty">
                            No clients found.
                        </div>

                    </td>
                </tr>
            `;

            return;
        }


        tbody.innerHTML = clients.map(client => `

            <tr>

                <td>

                    <div class="primary-text">

                        ${escapeHtml(
                            client.name ||
                            client.company_name ||
                            "Unnamed Client"
                        )}

                    </div>


                    ${
                        client.city
                            ? `
                                <div class="movie-meta">
                                    ${escapeHtml(client.city)}
                                </div>
                            `
                            : ""
                    }

                </td>


                <td>
                    ${escapeHtml(
                        client.contact_person ||
                        client.contact_name ||
                        "—"
                    )}
                </td>


                <td>
                    ${escapeHtml(client.email || "—")}
                </td>


                <td>
                    ${escapeHtml(client.phone || "—")}
                </td>


                <td>

                    <span class="status ${getStatusClass(client.status)}">

                        ${escapeHtml(
                            client.status || "Active"
                        )}

                    </span>

                </td>


                <td>
                    ${formatDate(client.created_at)}
                </td>


                <td>

                    <div class="actions">

                        <button
                            type="button"
                            class="icon-btn"
                            data-action="edit-client"
                            data-id="${escapeHtml(client.id)}"
                        >
                            Edit
                        </button>


                        <button
                            type="button"
                            class="icon-btn delete"
                            data-action="delete-client"
                            data-id="${escapeHtml(client.id)}"
                        >
                            Delete
                        </button>

                    </div>

                </td>

            </tr>

        `).join("");


    } catch (error) {

        console.error(
            "Clients loading error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td colspan="7">

                    <div class="error">
                        ${escapeHtml(
                            error?.message ||
                            "Unable to load clients."
                        )}
                    </div>

                </td>
            </tr>
        `;
    }
}


/**
 * Bind Clients page events
 *
 * IMPORTANT:
 * The Add Client button is handled globally
 * by app.js using data-add="client".
 *
 * Only Edit/Delete remain page-specific.
 */
function bindClientEvents() {

    const tbody =
        document.getElementById("clientsTable");


    if (!tbody) return;


    tbody.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest("[data-action]");


            if (!button) return;


            const id =
                button.dataset.id;


            const action =
                button.dataset.action;


            if (!id) return;


            if (action === "edit-client") {

                await openEditClient(id);

            }


            if (action === "delete-client") {

                await deleteClient(id);

            }

        }
    );
}


/**
 * Open Add Client modal
 *
 * Exported so app.js can call it through
 * the centralized data-add system.
 */
export function openClientModal() {

    const existing =
        document.getElementById("clientModal");


    if (existing) {
        existing.remove();
    }


    const body = `

        <div class="modal-body">

            <form id="clientForm">

                <div id="clientFormError"></div>


                ${input(
                    "name",
                    "Client / Company Name",
                    "text",
                    "",
                    true,
                    'placeholder="Example: XYZ Productions"'
                )}


                <div class="field-row">

                    ${input(
                        "contact_person",
                        "Contact Person",
                        "text",
                        "",
                        false,
                        'placeholder="Example: Raj Kumar"'
                    )}


                    ${input(
                        "phone",
                        "Phone",
                        "tel",
                        "",
                        false,
                        'placeholder="Phone number"'
                    )}

                </div>


                ${input(
                    "email",
                    "Email",
                    "email",
                    "",
                    false,
                    'placeholder="client@example.com"'
                )}


                <div class="field-row">

                    ${input(
                        "city",
                        "City",
                        "text",
                        "",
                        false,
                        'placeholder="Chennai"'
                    )}


                    ${input(
                        "state",
                        "State",
                        "text",
                        "",
                        false,
                        'placeholder="Tamil Nadu"'
                    )}

                </div>


                ${textarea(
                    "address",
                    "Address",
                    "",
                    'placeholder="Client address"'
                )}


                ${textarea(
                    "notes",
                    "Notes",
                    "",
                    'placeholder="Additional notes..."'
                )}


                <label class="check">

                    <input
                        type="checkbox"
                        name="active"
                        checked
                    >

                    <span>
                        Active client
                    </span>

                </label>

            </form>

        </div>


        <div class="modal-footer">

            <button
                type="button"
                class="btn secondary"
                data-close="clientModal"
            >
                Cancel
            </button>


            <button
                type="button"
                class="btn"
                id="saveClientButton"
            >
                Save Client
            </button>

        </div>

    `;


    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "clientModal",
            "Add Client",
            body
        )
    );


    document
        .getElementById("clientModal")
        ?.classList.add("show");


    document
        .getElementById("saveClientButton")
        ?.addEventListener(
            "click",
            saveClient
        );
}


/**
 * Save new client
 */
async function saveClient() {

    const form =
        document.getElementById("clientForm");


    const errorBox =
        document.getElementById("clientFormError");


    const saveButton =
        document.getElementById("saveClientButton");


    if (!form || !saveButton) return;


    const formData =
        new FormData(form);


    const name =
        String(
            formData.get("name") || ""
        ).trim();


    if (!name) {

        errorBox.innerHTML = `
            <div class="error">
                Client / Company Name is required.
            </div>
        `;

        return;
    }


    const data = {

        name,

        contact_person:
            String(
                formData.get("contact_person") || ""
            ).trim() || null,


        phone:
            String(
                formData.get("phone") || ""
            ).trim() || null,


        email:
            String(
                formData.get("email") || ""
            ).trim() || null,


        city:
            String(
                formData.get("city") || ""
            ).trim() || null,


        state:
            String(
                formData.get("state") || ""
            ).trim() || null,


        address:
            String(
                formData.get("address") || ""
            ).trim() || null,


        notes:
            String(
                formData.get("notes") || ""
            ).trim() || null,


        status:
            formData.get("active") === "on"
                ? "active"
                : "inactive"

    };


    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    errorBox.innerHTML = "";


    try {

        const result =
            await API.clients.create(data);


        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById("clientModal")
            ?.remove();


        await loadClients();


    } catch (error) {

        console.error(
            "Create client error:",
            error
        );


        errorBox.innerHTML = `
            <div class="error">

                ${escapeHtml(
                    error?.message ||
                    "Unable to create client."
                )}

            </div>
        `;


        saveButton.disabled = false;
        saveButton.textContent = "Save Client";
    }
}


/**
 * Open Edit Client modal
 */
async function openEditClient(id) {

    try {

        const result =
            await API.clients.get(id);


        if (result?.error) {
            throw result.error;
        }


        const client =
            result?.data ||
            result ||
            null;


        if (!client) {

            alert(
                "Client not found."
            );

            return;
        }


        const existing =
            document.getElementById("clientModal");


        if (existing) {
            existing.remove();
        }


        const body = `

            <div class="modal-body">

                <form id="clientForm">

                    <div id="clientFormError"></div>


                    ${input(
                        "name",
                        "Client / Company Name",
                        "text",
                        client.name ||
                        client.company_name ||
                        "",
                        true
                    )}


                    <div class="field-row">

                        ${input(
                            "contact_person",
                            "Contact Person",
                            "text",
                            client.contact_person ||
                            client.contact_name ||
                            ""
                        )}


                        ${input(
                            "phone",
                            "Phone",
                            "tel",
                            client.phone || ""
                        )}

                    </div>


                    ${input(
                        "email",
                        "Email",
                        "email",
                        client.email || ""
                    )}


                    <div class="field-row">

                        ${input(
                            "city",
                            "City",
                            "text",
                            client.city || ""
                        )}


                        ${input(
                            "state",
                            "State",
                            "text",
                            client.state || ""
                        )}

                    </div>


                    ${textarea(
                        "address",
                        "Address",
                        client.address || ""
                    )}


                    ${textarea(
                        "notes",
                        "Notes",
                        client.notes || ""
                    )}


                    <label class="check">

                        <input
                            type="checkbox"
                            name="active"
                            ${
                                String(
                                    client.status ||
                                    "active"
                                ).toLowerCase() === "active"
                                    ? "checked"
                                    : ""
                            }
                        >

                        <span>
                            Active client
                        </span>

                    </label>

                </form>

            </div>


            <div class="modal-footer">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="clientModal"
                >
                    Cancel
                </button>


                <button
                    type="button"
                    class="btn"
                    id="saveClientButton"
                >
                    Save Changes
                </button>

            </div>

        `;


        document.body.insertAdjacentHTML(
            "beforeend",
            modal(
                "clientModal",
                "Edit Client",
                body
            )
        );


        document
            .getElementById("clientModal")
            ?.classList.add("show");


        document
            .getElementById("saveClientButton")
            ?.addEventListener(
                "click",
                () => updateClient(id)
            );


    } catch (error) {

        console.error(
            "Edit client error:",
            error
        );


        alert(
            error?.message ||
            "Unable to load client."
        );
    }
}


/**
 * Update existing client
 */
async function updateClient(id) {

    const form =
        document.getElementById("clientForm");


    const errorBox =
        document.getElementById("clientFormError");


    const saveButton =
        document.getElementById("saveClientButton");


    if (!form || !saveButton) return;


    const formData =
        new FormData(form);


    const name =
        String(
            formData.get("name") || ""
        ).trim();


    if (!name) {

        errorBox.innerHTML = `
            <div class="error">
                Client / Company Name is required.
            </div>
        `;

        return;
    }


    const data = {

        name,

        contact_person:
            String(
                formData.get("contact_person") || ""
            ).trim() || null,


        phone:
            String(
                formData.get("phone") || ""
            ).trim() || null,


        email:
            String(
                formData.get("email") || ""
            ).trim() || null,


        city:
            String(
                formData.get("city") || ""
            ).trim() || null,


        state:
            String(
                formData.get("state") || ""
            ).trim() || null,


        address:
            String(
                formData.get("address") || ""
            ).trim() || null,


        notes:
            String(
                formData.get("notes") || ""
            ).trim() || null,


        status:
            formData.get("active") === "on"
                ? "active"
                : "inactive"

    };


    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    errorBox.innerHTML = "";


    try {

        const result =
            await API.clients.update(
                id,
                data
            );


        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById("clientModal")
            ?.remove();


        await loadClients();


    } catch (error) {

        console.error(
            "Update client error:",
            error
        );


        errorBox.innerHTML = `
            <div class="error">

                ${escapeHtml(
                    error?.message ||
                    "Unable to update client."
                )}

            </div>
        `;


        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}


/**
 * Delete client
 */
async function deleteClient(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this client?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.clients.remove(id);


        if (result?.error) {
            throw result.error;
        }


        await loadClients();


    } catch (error) {

        console.error(
            "Delete client error:",
            error
        );


        alert(
            error?.message ||
            "Unable to delete client."
        );
    }
}


/**
 * Format database date
 */
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


/**
 * Status CSS class
 */
function getStatusClass(status) {

    const value =
        String(
            status || ""
        ).toLowerCase();


    if (
        value === "active" ||
        value === "completed" ||
        value === "approved" ||
        value === "paid" ||
        value === "won"
    ) {
        return "active";
    }


    return "";
}


/**
 * Escape HTML
 */
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
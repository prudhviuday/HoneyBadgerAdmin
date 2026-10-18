import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea, checkbox } from "../components/form.js";


let allVenues = [];
let currentFilter = "all";


/* =========================================================
   HELPERS
   ========================================================= */


/*
 * Normalize API results.
 *
 * Supports:
 *
 *   [ ...rows ]
 *
 * and:
 *
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


/* =========================================================
   SHOW VENUES
   ========================================================= */

export async function showVenues(content) {

    /*
     * Reset page-level filter when entering the page.
     */
    currentFilter = "all";
    allVenues = [];


    content.innerHTML = `
        <div class="page-header">

            <div>

                <h1>Venues</h1>

                <p>
                    Manage locations where Honeybadger campaigns
                    and activations take place.
                </p>

            </div>


            <div class="page-header-actions">

                <button
                    type="button"
                    class="btn secondary"
                    id="refreshVenuesButton"
                >
                    Refresh
                </button>


                <button
                    type="button"
                    class="btn"
                    data-add="venue"
                >
                    + Add Venue
                </button>

            </div>

        </div>


        <!-- Statistics -->

        <div class="stats">

            <div class="stat-card">

                <div class="stat-label">
                    Total Venues
                </div>

                <div
                    class="stat-value"
                    id="venueTotal"
                >
                    —
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Active
                </div>

                <div
                    class="stat-value"
                    id="venueActive"
                >
                    —
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Inactive
                </div>

                <div
                    class="stat-value"
                    id="venueInactive"
                >
                    —
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Cities
                </div>

                <div
                    class="stat-value"
                    id="venueCities"
                >
                    —
                </div>

            </div>

        </div>


        <!-- Venue panel -->

        <div class="panel">

            <div class="panel-header">

                <div class="venue-toolbar">

                    <button
                        type="button"
                        class="venue-filter active"
                        data-filter="all"
                    >
                        All venues
                    </button>


                    <button
                        type="button"
                        class="venue-filter"
                        data-filter="active"
                    >
                        Active
                    </button>


                    <button
                        type="button"
                        class="venue-filter"
                        data-filter="inactive"
                    >
                        Inactive
                    </button>

                </div>


                <div class="venue-search">

                    <input
                        type="search"
                        id="venueSearch"
                        placeholder="Search venues..."
                    >

                </div>

            </div>


            <div class="panel-body">

                <div class="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Venue
                                </th>

                                <th>
                                    Location
                                </th>

                                <th>
                                    Type
                                </th>

                                <th>
                                    Contact
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Created
                                </th>

                                <th>
                                    Actions
                                </th>

                            </tr>

                        </thead>


                        <tbody id="venuesTable">

                            <tr>

                                <td colspan="7">

                                    <div class="loading">
                                        Loading venues...
                                    </div>

                                </td>

                            </tr>

                        </tbody>

                    </table>

                </div>

            </div>

        </div>
    `;


    bindVenueEvents();


    await loadVenues();

}


/* =========================================================
   LOAD VENUES
   ========================================================= */

async function loadVenues() {

    const tbody =
        document.getElementById(
            "venuesTable"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>

            <td colspan="7">

                <div class="loading">
                    Loading venues...
                </div>

            </td>

        </tr>
    `;


    try {

        const result =
            await API.venues.list();


        /*
         * Explicit API error check.
         */
        if (result?.error) {
            throw result.error;
        }


        allVenues =
            getRows(result);


        updateVenueStats();


        renderVenues();


    } catch (error) {

        console.error(
            "Venues loading error:",
            error
        );


        allVenues = [];


        tbody.innerHTML = `
            <tr>

                <td colspan="7">

                    <div class="error">
                        Unable to load venues.
                    </div>

                </td>

            </tr>
        `;

    }

}


/* =========================================================
   VENUE STATISTICS
   ========================================================= */

function updateVenueStats() {

    const total =
        document.getElementById(
            "venueTotal"
        );


    const active =
        document.getElementById(
            "venueActive"
        );


    const inactive =
        document.getElementById(
            "venueInactive"
        );


    const cities =
        document.getElementById(
            "venueCities"
        );


    if (!total) {
        return;
    }


    total.textContent =
        allVenues.length;


    active.textContent =
        allVenues.filter(
            venue =>
                getVenueStatus(venue) ===
                "active"
        ).length;


    inactive.textContent =
        allVenues.filter(
            venue =>
                getVenueStatus(venue) ===
                "inactive"
        ).length;


    const uniqueCities =
        new Set(
            allVenues
                .map(
                    venue =>
                        String(
                            venue.city || ""
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
        );


    cities.textContent =
        uniqueCities.size;

}


/* =========================================================
   RENDER VENUES
   ========================================================= */

function renderVenues() {

    const tbody =
        document.getElementById(
            "venuesTable"
        );


    if (!tbody) {
        return;
    }


    const searchInput =
        document.getElementById(
            "venueSearch"
        );


    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    let venues =
        [...allVenues];


    /* ---------- STATUS FILTER ---------- */

    if (
        currentFilter !==
        "all"
    ) {

        venues =
            venues.filter(
                venue =>
                    getVenueStatus(venue) ===
                    currentFilter
            );

    }


    /* ---------- SEARCH ---------- */

    if (search) {

        venues =
            venues.filter(
                venue => {

                    const text = [

                        venue.name,

                        venue.venue_name,

                        venue.city,

                        venue.state,

                        venue.address,

                        venue.type,

                        venue.venue_type,

                        venue.contact_person,

                        venue.contact_name,

                        venue.email,

                        venue.phone

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return text.includes(
                        search
                    );

                }
            );

    }


    /* ---------- EMPTY ---------- */

    if (!venues.length) {

        tbody.innerHTML = `
            <tr>

                <td colspan="7">

                    <div class="empty">
                        No venues found.
                    </div>

                </td>

            </tr>
        `;

        return;

    }


    /* ---------- TABLE ---------- */

    tbody.innerHTML =
        venues
            .map(
                venue => `

                    <tr>


                        <!-- Venue -->

                        <td>

                            <div class="primary-text">

                                ${escapeHtml(
                                    venue.name ||
                                    venue.venue_name ||
                                    "Unnamed Venue"
                                )}

                            </div>

                        </td>


                        <!-- Location -->

                        <td>

                            <div>

                                ${escapeHtml(
                                    venue.city ||
                                    "—"
                                )}

                            </div>


                            ${
                                venue.state
                                    ? `
                                        <div class="movie-meta">
                                            ${escapeHtml(
                                                venue.state
                                            )}
                                        </div>
                                    `
                                    : ""
                            }


                            ${
                                venue.pincode ||
                                venue.pin_code
                                    ? `
                                        <div class="movie-meta">
                                            ${escapeHtml(
                                                venue.pincode ||
                                                venue.pin_code
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </td>


                        <!-- Type -->

                        <td>

                            ${escapeHtml(
                                venue.type ||
                                venue.venue_type ||
                                "—"
                            )}

                        </td>


                        <!-- Contact -->

                        <td>

                            <div class="primary-text">

                                ${escapeHtml(
                                    venue.contact_person ||
                                    venue.contact_name ||
                                    "—"
                                )}

                            </div>


                            ${
                                venue.email
                                    ? `
                                        <div class="movie-meta">
                                            ${escapeHtml(
                                                venue.email
                                            )}
                                        </div>
                                    `
                                    : ""
                            }


                            ${
                                venue.phone
                                    ? `
                                        <div class="movie-meta">
                                            ${escapeHtml(
                                                venue.phone
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </td>


                        <!-- Status -->

                        <td>

                            <span
                                class="status ${getVenueStatus(
                                    venue
                                )}"
                            >

                                ${escapeHtml(
                                    capitalize(
                                        getVenueStatus(
                                            venue
                                        )
                                    )
                                )}

                            </span>

                        </td>


                        <!-- Created -->

                        <td>

                            ${formatDate(
                                venue.created_at
                            )}

                        </td>


                        <!-- Actions -->

                        <td>

                            <div class="actions">


                                <button
                                    type="button"
                                    class="icon-btn"
                                    data-action="edit-venue"
                                    data-id="${escapeHtml(
                                        venue.id
                                    )}"
                                >
                                    Edit
                                </button>


                                <button
                                    type="button"
                                    class="icon-btn delete"
                                    data-action="delete-venue"
                                    data-id="${escapeHtml(
                                        venue.id
                                    )}"
                                >
                                    Delete
                                </button>


                            </div>

                        </td>


                    </tr>

                `
            )
            .join("");

}


/* =========================================================
   VENUE EVENTS
   ========================================================= */

function bindVenueEvents() {


    /* ---------- REFRESH ---------- */

    document
        .getElementById(
            "refreshVenuesButton"
        )
        ?.addEventListener(
            "click",
            loadVenues
        );


    /*
     * IMPORTANT:
     *
     * There is intentionally NO Add Venue
     * click listener here.
     *
     * app.js handles:
     *
     *     [data-add="venue"]
     *
     * and calls:
     *
     *     openVenueModal()
     */


    /* ---------- SEARCH ---------- */

    document
        .getElementById(
            "venueSearch"
        )
        ?.addEventListener(
            "input",
            renderVenues
        );


    /* ---------- FILTERS ---------- */

    document
        .querySelectorAll(
            ".venue-filter"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        currentFilter =
                            button.dataset.filter ||
                            "all";


                        document
                            .querySelectorAll(
                                ".venue-filter"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        renderVenues();

                    }
                );

            }
        );


    /* ---------- TABLE ACTIONS ---------- */

    document
        .getElementById(
            "venuesTable"
        )
        ?.addEventListener(
            "click",
            async event => {

                const button =
                    event.target.closest(
                        "[data-action]"
                    );


                if (!button) {
                    return;
                }


                const id =
                    button.dataset.id;


                if (!id) {
                    return;
                }


                const action =
                    button.dataset.action;


                if (
                    action ===
                    "edit-venue"
                ) {

                    await openVenueModal(
                        id
                    );


                    return;

                }


                if (
                    action ===
                    "delete-venue"
                ) {

                    await deleteVenue(
                        id
                    );

                }

            }
        );

}


/* =========================================================
   ADD / EDIT VENUE MODAL
   ========================================================= */

/*
 * IMPORTANT:
 *
 * Exported because app.js imports:
 *
 *     openVenueModal
 *
 * For ADD:
 *
 *     openVenueModal()
 *
 * For EDIT:
 *
 *     openVenueModal(id)
 */
export async function openVenueModal(
    id = null
) {

    let venue = null;


    /* ---------- EDIT MODE ---------- */

    if (id) {

        try {

            const result =
                await API.venues.get(
                    id
                );


            if (result?.error) {
                throw result.error;
            }


            venue =
                result?.data ||
                null;


            if (!venue) {

                alert(
                    "Venue not found."
                );


                return;

            }

        } catch (error) {

            console.error(
                "Unable to load venue:",
                error
            );


            alert(
                error?.message ||
                "Unable to load venue."
            );


            return;

        }

    }


    /* ---------- REMOVE OLD MODAL ---------- */

    document
        .getElementById(
            "venueModal"
        )
        ?.remove();


    /* ---------- MODAL BODY ---------- */

    const body = `

        <div class="modal-body">

            <form id="venueForm">

                <div id="venueFormError"></div>


                ${input(
                    "name",
                    "Venue Name",
                    "text",
                    venue?.name ||
                    venue?.venue_name ||
                    "",
                    true,
                    'placeholder="Example: VR Mall, Chennai"'
                )}


                <div class="field-row">

                    ${input(
                        "city",
                        "City",
                        "text",
                        venue?.city ||
                        "",
                        true,
                        'placeholder="Chennai"'
                    )}


                    ${input(
                        "state",
                        "State",
                        "text",
                        venue?.state ||
                        "",
                        true,
                        'placeholder="Tamil Nadu"'
                    )}

                </div>


                ${input(
                    "pincode",
                    "PIN Code",
                    "text",
                    venue?.pincode ||
                    venue?.pin_code ||
                    "",
                    false,
                    'placeholder="600006"'
                )}


                ${textarea(
                    "address",
                    "Address",
                    venue?.address ||
                    "",
                    'placeholder="Full venue address"'
                )}


                ${select(
                    "type",
                    "Venue Type",
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
                            label: "Café / Restaurant"
                        },
                        {
                            value: "Public Space",
                            label: "Public Space"
                        },
                        {
                            value: "Corporate",
                            label: "Corporate"
                        },
                        {
                            value: "Hotel",
                            label: "Hotel"
                        },
                        {
                            value: "Event Venue",
                            label: "Event Venue"
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
                    venue?.type ||
                    venue?.venue_type ||
                    "",
                    true
                )}


                <div class="field-row">

                    ${input(
                        "contact_person",
                        "Contact Person",
                        "text",
                        venue?.contact_person ||
                        venue?.contact_name ||
                        "",
                        false,
                        'placeholder="Venue manager"'
                    )}


                    ${input(
                        "phone",
                        "Contact Phone",
                        "tel",
                        venue?.phone ||
                        "",
                        false,
                        'placeholder="Phone number"'
                    )}

                </div>


                ${input(
                    "email",
                    "Contact Email",
                    "email",
                    venue?.email ||
                    "",
                    false,
                    'placeholder="manager@example.com"'
                )}


                ${checkbox(
                    "active",
                    "Active venue",
                    venue
                        ? getVenueStatus(venue) ===
                          "active"
                        : true
                )}

            </form>

        </div>


        <div class="modal-footer">

            <button
                type="button"
                class="btn secondary"
                data-close="venueModal"
            >
                Cancel
            </button>


            <button
                type="button"
                class="btn"
                id="saveVenueButton"
            >
                ${
                    id
                        ? "Save Changes"
                        : "Save Venue"
                }
            </button>

        </div>
    `;


    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "venueModal",
            id
                ? "Edit Venue"
                : "Add Venue",
            body
        )
    );


    document
        .getElementById(
            "venueModal"
        )
        ?.classList.add(
            "show"
        );


    /* ---------- SAVE BUTTON ---------- */

    document
        .getElementById(
            "saveVenueButton"
        )
        ?.addEventListener(
            "click",
            async () => {

                if (id) {

                    await updateVenue(
                        id
                    );

                } else {

                    await saveVenue();

                }

            }
        );

}


/* =========================================================
   SAVE NEW VENUE
   ========================================================= */

async function saveVenue() {

    const form =
        document.getElementById(
            "venueForm"
        );


    const errorBox =
        document.getElementById(
            "venueFormError"
        );


    const saveButton =
        document.getElementById(
            "saveVenueButton"
        );


    if (
        !form ||
        !saveButton
    ) {
        return;
    }


    const formData =
        new FormData(form);


    const name =
        String(
            formData.get(
                "name"
            ) ||
            ""
        ).trim();


    const city =
        String(
            formData.get(
                "city"
            ) ||
            ""
        ).trim();


    const state =
        String(
            formData.get(
                "state"
            ) ||
            ""
        ).trim();


    const type =
        String(
            formData.get(
                "type"
            ) ||
            ""
        ).trim();


    /* ---------- VALIDATION ---------- */

    if (
        !name ||
        !city ||
        !state ||
        !type
    ) {

        errorBox.innerHTML = `
            <div class="error">
                Venue name, city, state and type are required.
            </div>
        `;


        return;

    }


    const data = {

        name,

        city,

        state,

        pincode:
            String(
                formData.get(
                    "pincode"
                ) ||
                ""
            ).trim() ||
            null,

        address:
            String(
                formData.get(
                    "address"
                ) ||
                ""
            ).trim() ||
            null,

        type,

        contact_person:
            String(
                formData.get(
                    "contact_person"
                ) ||
                ""
            ).trim() ||
            null,

        phone:
            String(
                formData.get(
                    "phone"
                ) ||
                ""
            ).trim() ||
            null,

        email:
            String(
                formData.get(
                    "email"
                ) ||
                ""
            ).trim() ||
            null,

        status:
            formData.has(
                "active"
            )
                ? "active"
                : "inactive"

    };


    saveButton.disabled =
        true;


    saveButton.textContent =
        "Saving...";


    errorBox.innerHTML =
        "";


    try {

        const result =
            await API.venues.create(
                data
            );


        /*
         * IMPORTANT:
         *
         * Explicitly check Supabase error.
         */
        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "venueModal"
            )
            ?.remove();


        await loadVenues();


    } catch (error) {

        console.error(
            "Create venue error:",
            error
        );


        errorBox.innerHTML = `
            <div class="error">
                ${escapeHtml(
                    error?.message ||
                    "Unable to create venue."
                )}
            </div>
        `;


        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Venue";

    }

}


/* =========================================================
   UPDATE VENUE
   ========================================================= */

async function updateVenue(
    id
) {

    const form =
        document.getElementById(
            "venueForm"
        );


    const errorBox =
        document.getElementById(
            "venueFormError"
        );


    const saveButton =
        document.getElementById(
            "saveVenueButton"
        );


    if (
        !form ||
        !saveButton
    ) {
        return;
    }


    const formData =
        new FormData(form);


    const name =
        String(
            formData.get(
                "name"
            ) ||
            ""
        ).trim();


    const city =
        String(
            formData.get(
                "city"
            ) ||
            ""
        ).trim();


    const state =
        String(
            formData.get(
                "state"
            ) ||
            ""
        ).trim();


    const type =
        String(
            formData.get(
                "type"
            ) ||
            ""
        ).trim();


    /* ---------- VALIDATION ---------- */

    if (
        !name ||
        !city ||
        !state ||
        !type
    ) {

        errorBox.innerHTML = `
            <div class="error">
                Venue name, city, state and type are required.
            </div>
        `;


        return;

    }


    const data = {

        name,

        city,

        state,

        pincode:
            String(
                formData.get(
                    "pincode"
                ) ||
                ""
            ).trim() ||
            null,

        address:
            String(
                formData.get(
                    "address"
                ) ||
                ""
            ).trim() ||
            null,

        type,

        contact_person:
            String(
                formData.get(
                    "contact_person"
                ) ||
                ""
            ).trim() ||
            null,

        phone:
            String(
                formData.get(
                    "phone"
                ) ||
                ""
            ).trim() ||
            null,

        email:
            String(
                formData.get(
                    "email"
                ) ||
                ""
            ).trim() ||
            null,

        status:
            formData.has(
                "active"
            )
                ? "active"
                : "inactive"

    };


    saveButton.disabled =
        true;


    saveButton.textContent =
        "Saving...";


    errorBox.innerHTML =
        "";


    try {

        const result =
            await API.venues.update(
                id,
                data
            );


        /*
         * Explicit Supabase error check.
         */
        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "venueModal"
            )
            ?.remove();


        await loadVenues();


    } catch (error) {

        console.error(
            "Update venue error:",
            error
        );


        errorBox.innerHTML = `
            <div class="error">
                ${escapeHtml(
                    error?.message ||
                    "Unable to update venue."
                )}
            </div>
        `;


        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Changes";

    }

}


/* =========================================================
   DELETE VENUE
   ========================================================= */

async function deleteVenue(
    id
) {

    if (!id) {
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this venue?"
        );


    if (!confirmed) {
        return;
    }


    try {

        let result;


        if (
            typeof API.venues.remove ===
            "function"
        ) {

            result =
                await API.venues.remove(
                    id
                );

        } else {

            result =
                await API.venues.delete(
                    id
                );

        }


        /*
         * Explicit Supabase error check.
         */
        if (result?.error) {
            throw result.error;
        }


        await loadVenues();


    } catch (error) {

        console.error(
            "Delete venue error:",
            error
        );


        alert(
            error?.message ||
            "Unable to delete venue."
        );

    }

}


/* =========================================================
   VENUE STATUS
   ========================================================= */

function getVenueStatus(
    venue
) {

    const value =
        String(
            venue?.status ||
            "active"
        )
            .toLowerCase()
            .trim();


    return value === "inactive"
        ? "inactive"
        : "active";

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

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
   CAPITALIZE
   ========================================================= */

function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    const text =
        String(value);


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
    value
) {

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

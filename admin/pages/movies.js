import { API } from "../js/api.js";
import { modal, bindModals } from "../components/modal.js";
import { input, textarea, select, checkbox } from "../components/form.js";


/*
 * Normalize API results.
 *
 * Supports both:
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
   MOVIES PAGE
   ========================================================= */

export async function showMovies(content) {

    content.innerHTML = `
        <div class="page-header">

            <div>
                <h1>Movies</h1>
                <p>Manage movies associated with your campaigns.</p>
            </div>

            <button
                type="button"
                class="btn"
                data-add="movie"
            >
                + Add Movie
            </button>

        </div>


        <div class="stats">

            <div class="stat-card">

                <div class="stat-label">
                    Total Movies
                </div>

                <div
                    class="stat-value"
                    id="movieTotal"
                >
                    —
                </div>

                <div class="stat-description">
                    Movies in the system
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Active
                </div>

                <div
                    class="stat-value"
                    id="movieActive"
                >
                    —
                </div>

                <div class="stat-description">
                    Currently active
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Upcoming
                </div>

                <div
                    class="stat-value"
                    id="movieUpcoming"
                >
                    —
                </div>

                <div class="stat-description">
                    Upcoming releases
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Released
                </div>

                <div
                    class="stat-value"
                    id="movieReleased"
                >
                    —
                </div>

                <div class="stat-description">
                    Movies already released
                </div>

            </div>

        </div>


        <div class="panel">

            <div class="panel-header">

                <div class="panel-title">
                    All Movies
                </div>

                <div>

                    <button
                        type="button"
                        class="panel-link"
                        id="refreshMoviesButton"
                    >
                        Refresh
                    </button>

                </div>

            </div>


            <div class="panel-body">

                <div class="table-wrapper">

                    <table>

                        <thead>

                            <tr>
                                <th>Movie</th>
                                <th>Client</th>
                                <th>Language</th>
                                <th>Release Date</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>

                        </thead>


                        <tbody id="moviesTable">

                            <tr>

                                <td colspan="7">

                                    <div class="loading">
                                        Loading movies...
                                    </div>

                                </td>

                            </tr>

                        </tbody>

                    </table>

                </div>

            </div>

        </div>
    `;


    /*
     * Refresh button.
     */
    document
        .getElementById("refreshMoviesButton")
        ?.addEventListener(
            "click",
            loadMovies
        );


    /*
     * IMPORTANT:
     *
     * There is deliberately NO Add Movie click listener here.
     *
     * app.js handles every [data-add] button globally:
     *
     *     data-add="movie"
     *
     * and calls:
     *
     *     openMovieModal()
     */


    bindModals();


    await loadMovies();

}


/* =========================================================
   LOAD MOVIES
   ========================================================= */

async function loadMovies() {

    const tbody =
        document.getElementById("moviesTable");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>

            <td colspan="7">

                <div class="loading">
                    Loading movies...
                </div>

            </td>

        </tr>
    `;


    try {

        const result =
            await API.movies.list();


        /*
         * Always convert API response into
         * a real array before filter/map.
         */
        const movies =
            getRows(result);


        /*
         * Check API-level errors.
         */
        if (result?.error) {

            throw result.error;

        }


        updateMovieStats(
            movies
        );


        if (!movies.length) {

            tbody.innerHTML = `
                <tr>

                    <td colspan="7">

                        <div class="empty">
                            No movies found.
                        </div>

                    </td>

                </tr>
            `;

            return;
        }


        tbody.innerHTML =
            movies
                .map(
                    movie => `

                        <tr>

                            <td>

                                <div class="primary-text">

                                    ${escapeHtml(
                                        movie.title ||
                                        movie.name ||
                                        "Untitled Movie"
                                    )}

                                </div>


                                ${
                                    movie.genre
                                        ? `
                                            <div class="movie-meta">
                                                ${escapeHtml(
                                                    movie.genre
                                                )}
                                            </div>
                                        `
                                        : ""
                                }

                            </td>


                            <td>

                                ${escapeHtml(
                                    movie.client_name ||
                                    movie.client?.name ||
                                    "—"
                                )}

                            </td>


                            <td>

                                ${escapeHtml(
                                    movie.language ||
                                    "—"
                                )}

                            </td>


                            <td>

                                ${formatDate(
                                    movie.release_date
                                )}

                            </td>


                            <td>

                                <span
                                    class="status ${getStatusClass(
                                        movie.status
                                    )}"
                                >

                                    ${escapeHtml(
                                        movie.status ||
                                        "Active"
                                    )}

                                </span>

                            </td>


                            <td>

                                ${formatDate(
                                    movie.created_at
                                )}

                            </td>


                            <td>

                                <div class="actions">

                                    <button
                                        type="button"
                                        class="icon-btn"
                                        data-action="edit-movie"
                                        data-id="${escapeHtml(
                                            movie.id
                                        )}"
                                    >
                                        Edit
                                    </button>


                                    <button
                                        type="button"
                                        class="icon-btn delete"
                                        data-action="delete-movie"
                                        data-id="${escapeHtml(
                                            movie.id
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


        bindMovieActions();


    } catch (error) {

        console.error(
            "Movies loading error:",
            error
        );


        tbody.innerHTML = `
            <tr>

                <td colspan="7">

                    <div class="error">
                        Unable to load movies.
                    </div>

                </td>

            </tr>
        `;

    }

}


/* =========================================================
   MOVIE STATISTICS
   ========================================================= */

function updateMovieStats(
    movies = []
) {

    movies =
        getRows(movies);


    const total =
        document.getElementById(
            "movieTotal"
        );


    const active =
        document.getElementById(
            "movieActive"
        );


    const upcoming =
        document.getElementById(
            "movieUpcoming"
        );


    const released =
        document.getElementById(
            "movieReleased"
        );


    if (!total) {
        return;
    }


    total.textContent =
        movies.length;


    active.textContent =
        movies.filter(
            movie =>
                String(
                    movie.status || ""
                )
                    .toLowerCase() === "active"
        ).length;


    upcoming.textContent =
        movies.filter(
            movie =>
                String(
                    movie.status || ""
                )
                    .toLowerCase() === "upcoming"
        ).length;


    released.textContent =
        movies.filter(
            movie =>
                String(
                    movie.status || ""
                )
                    .toLowerCase() === "released"
        ).length;

}


/* =========================================================
   MOVIE ACTIONS
   ========================================================= */

function bindMovieActions() {

    const tbody =
        document.getElementById(
            "moviesTable"
        );


    if (!tbody) {
        return;
    }


    tbody.onclick =
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


            const action =
                button.dataset.action;


            if (!id) {
                return;
            }


            if (
                action === "edit-movie"
            ) {

                await openMovieModal(
                    id
                );

                return;
            }


            if (
                action === "delete-movie"
            ) {

                await deleteMovie(
                    id
                );

            }

        };

}


/* =========================================================
   ADD / EDIT MOVIE MODAL
   ========================================================= */

/*
 * IMPORTANT:
 *
 * This function is exported because app.js imports it:
 *
 *     import { openMovieModal } from "./pages/movies.js";
 *
 * The global Add button handler then calls:
 *
 *     openMovieModal()
 *
 */
export async function openMovieModal(
    id = null
) {

    let movie = null;


    /* ---------- EDIT MODE ---------- */

    if (id) {

        try {

            const result =
                await API.movies.get(
                    id
                );


            if (result?.error) {

                throw result.error;

            }


            movie =
                result?.data ||
                result ||
                null;


        } catch (error) {

            console.error(
                "Unable to load movie:",
                error
            );


            alert(
                "Unable to load movie."
            );


            return;

        }

    }


    /* ---------- LOAD CLIENTS ---------- */

    let clients = [];


    try {

        const result =
            await API.clients.list();


        if (result?.error) {

            throw result.error;

        }


        clients =
            getRows(result);


    } catch (error) {

        console.error(
            "Unable to load clients:",
            error
        );

    }


    const clientOptions =
        clients.map(
            client => ({

                value:
                    client.id,

                label:
                    client.name ||
                    client.company_name ||
                    "Unnamed Client"

            })
        );


    const modalId =
        "movieModal";


    /*
     * Remove old modal if one exists.
     */
    document
        .getElementById(modalId)
        ?.remove();


    const modalHtml =
        modal(
            modalId,
            id
                ? "Edit Movie"
                : "Add Movie",
            `

                <form id="movieForm">

                    <div class="form-grid">


                        ${input(
                            "title",
                            "Movie Title",
                            "text",
                            movie?.title ||
                            movie?.name ||
                            "",
                            true
                        )}


                        ${select(
                            "client_id",
                            "Client",
                            clientOptions,
                            movie?.client_id ||
                            "",
                            false
                        )}


                        ${input(
                            "genre",
                            "Genre",
                            "text",
                            movie?.genre ||
                            ""
                        )}


                        ${input(
                            "language",
                            "Language",
                            "text",
                            movie?.language ||
                            ""
                        )}


                        ${input(
                            "release_date",
                            "Release Date",
                            "date",
                            movie?.release_date
                                ? String(
                                    movie.release_date
                                ).slice(0, 10)
                                : ""
                        )}


                        ${select(
                            "status",
                            "Status",
                            [
                                {
                                    value: "active",
                                    label: "Active"
                                },
                                {
                                    value: "upcoming",
                                    label: "Upcoming"
                                },
                                {
                                    value: "released",
                                    label: "Released"
                                },
                                {
                                    value: "completed",
                                    label: "Completed"
                                }
                            ],
                            movie?.status ||
                            "active",
                            true
                        )}

                    </div>


                    ${textarea(
                        "description",
                        "Description",
                        movie?.description ||
                        ""
                    )}


                    ${checkbox(
                        "active",
                        "Movie is active",
                        movie
                            ? movie.active !== false
                            : true
                    )}


                    <div class="modal-actions">

                        <button
                            type="button"
                            class="btn secondary"
                            data-close="${modalId}"
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            class="btn"
                        >
                            ${
                                id
                                    ? "Save Changes"
                                    : "Add Movie"
                            }
                        </button>

                    </div>

                </form>

            `
        );


    document.body.insertAdjacentHTML(
        "beforeend",
        modalHtml
    );


    const movieModal =
        document.getElementById(
            modalId
        );


    movieModal?.classList.add(
        "show"
    );


    /* ---------- FORM SUBMIT ---------- */

    document
        .getElementById("movieForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const submitButton =
                    event.target.querySelector(
                        'button[type="submit"]'
                    );


                /*
                 * Prevent accidental double-clicks.
                 */
                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        id
                            ? "Saving..."
                            : "Adding...";

                }


                try {

                    await saveMovie(
                        event.target,
                        id
                    );

                } finally {

                    /*
                     * Only restore the button if
                     * the modal is still open.
                     */
                    if (
                        submitButton &&
                        document.getElementById(
                            modalId
                        )
                    ) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            id
                                ? "Save Changes"
                                : "Add Movie";

                    }

                }

            }
        );

}


/* =========================================================
   SAVE MOVIE
   ========================================================= */

async function saveMovie(
    form,
    id = null
) {

    const formData =
        new FormData(form);


    const data = {

        title:
            formData
                .get("title")
                ?.trim() ||
            "",


        client_id:
            formData.get(
                "client_id"
            ) ||
            null,


        genre:
            formData
                .get("genre")
                ?.trim() ||
            null,


        language:
            formData
                .get("language")
                ?.trim() ||
            null,


        release_date:
            formData.get(
                "release_date"
            ) ||
            null,


        status:
            formData.get(
                "status"
            ) ||
            "active",


        description:
            formData
                .get("description")
                ?.trim() ||
            null,


        active:
            formData.has(
                "active"
            )

    };


    /*
     * Basic validation.
     */
    if (!data.title) {

        alert(
            "Movie title is required."
        );


        return;

    }


    try {

        let result;


        /* ---------- UPDATE ---------- */

        if (id) {

            result =
                await API.movies.update(
                    id,
                    data
                );


        /* ---------- CREATE ---------- */

        } else {

            result =
                await API.movies.create(
                    data
                );

        }


        /*
         * IMPORTANT:
         *
         * Supabase normally returns:
         *
         *     { data, error }
         *
         * Check error explicitly.
         */
        if (result?.error) {

            throw result.error;

        }


        /*
         * Close modal only after successful
         * database operation.
         */
        document
            .getElementById(
                "movieModal"
            )
            ?.classList.remove(
                "show"
            );


        /*
         * Reload table.
         */
        await loadMovies();


    } catch (error) {

        console.error(
            "Movie save error:",
            error
        );


        /*
         * Show the actual database error
         * in the browser console.
         *
         * User gets a simple message.
         */
        alert(
            error?.message
                ? `Unable to save movie.\n\n${error.message}`
                : "Unable to save movie."
        );

    }

}


/* =========================================================
   DELETE MOVIE
   ========================================================= */

async function deleteMovie(
    id
) {

    if (!id) {
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this movie?"
        );


    if (!confirmed) {
        return;
    }


    try {

        let result;


        /*
         * Prefer remove().
         */
        if (
            typeof API.movies.remove ===
            "function"
        ) {

            result =
                await API.movies.remove(
                    id
                );


        } else {

            result =
                await API.movies.delete(
                    id
                );

        }


        /*
         * Explicit Supabase error check.
         */
        if (result?.error) {

            throw result.error;

        }


        await loadMovies();


    } catch (error) {

        console.error(
            "Movie delete error:",
            error
        );


        alert(
            error?.message
                ? `Unable to delete movie.\n\n${error.message}`
                : "Unable to delete movie."
        );

    }

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
   STATUS CSS CLASS
   ========================================================= */

function getStatusClass(
    status
) {

    const value =
        String(status || "")
            .toLowerCase();


    if (
        value === "active" ||
        value === "released" ||
        value === "completed" ||
        value === "paid" ||
        value === "won"
    ) {

        return "active";

    }


    return "";

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

// Honeybadger Media Admin
// Centralized Supabase data-access layer.
// Page code should use API.* instead of calling Supabase directly.

import { supabaseClient } from "./config.js";
import { TABLES } from "./constants.js";


/* =========================================================
   HELPERS
   ========================================================= */


/*
 * Make a Supabase list response compatible with BOTH:
 *
 *     const rows = await API.movies.list();
 *     rows.filter(...)
 *
 * AND:
 *
 *     const result = await API.movies.list();
 *     result.data
 *
 * The returned value is still an Array, but it also exposes
 * .data and .error for backwards compatibility.
 */
function normalizeListResult(result) {

    /*
     * Handle both:
     *
     * 1. Supabase response:
     *    { data: [...], error: null }
     *
     * 2. Already-normalized/raw array:
     *    [...]
     */
    const data = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
            ? result.data
            : [];


    /*
     * Arrays are objects in JavaScript, so we can attach
     * compatibility properties without changing their
     * normal array behavior.
     */
    data.data = data;


    data.error =
        result?.error || null;


    /*
     * Preserve useful Supabase response properties
     * when available.
     */
    if (result?.count !== undefined) {

        data.count = result.count;

    }


    if (result?.status !== undefined) {

        data.status = result.status;

    }


    if (result?.statusText !== undefined) {

        data.statusText = result.statusText;

    }


    return data;

}


/* =========================================================
   GENERIC LIST
   ========================================================= */

async function list(
    table,
    options = {}
) {

    let query =
        supabaseClient
            .from(table)
            .select(
                options.select || "*"
            );


    /* ---------- FILTERS ---------- */

    if (options.filters) {

        Object.entries(
            options.filters
        ).forEach(
            ([column, value]) => {

                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {

                    query =
                        query.eq(
                            column,
                            value
                        );

                }

            }
        );

    }


    /* ---------- SEARCH ---------- */

    if (options.search) {

        const {
            column,
            value
        } = options.search;


        if (
            column &&
            value
        ) {

            query =
                query.ilike(
                    column,
                    `%${value}%`
                );

        }

    }


    /* ---------- ORDER ---------- */

    if (options.orderBy) {

        query =
            query.order(
                options.orderBy,
                {
                    ascending:
                        options.ascending !== false
                }
            );

    }


    /* ---------- LIMIT ---------- */

    if (options.limit) {

        query =
            query.limit(
                options.limit
            );

    }


    /* ---------- RANGE ---------- */

    if (
        Number.isInteger(options.from) &&
        Number.isInteger(options.to)
    ) {

        query =
            query.range(
                options.from,
                options.to
            );

    }


    const result =
        await query;


    return normalizeListResult(
        result
    );

}


/* =========================================================
   GET BY ID
   ========================================================= */

async function getById(
    table,
    id,
    select = "*"
) {

    if (!id) {

        return {

            data: null,

            error:
                new Error(
                    "Record ID is required."
                )

        };

    }


    return await supabaseClient
        .from(table)
        .select(select)
        .eq("id", id)
        .maybeSingle();

}


/* =========================================================
   CREATE
   ========================================================= */

async function create(
    table,
    payload
) {

    return await supabaseClient
        .from(table)
        .insert(payload)
        .select()
        .single();

}


/* =========================================================
   UPDATE
   ========================================================= */

async function update(
    table,
    id,
    payload
) {

    if (!id) {

        return {

            data: null,

            error:
                new Error(
                    "Record ID is required."
                )

        };

    }


    return await supabaseClient
        .from(table)
        .update(payload)
        .eq("id", id)
        .select()
        .single();

}


/* =========================================================
   DELETE
   ========================================================= */

async function remove(
    table,
    id
) {

    if (!id) {

        return {

            data: null,

            error:
                new Error(
                    "Record ID is required."
                )

        };

    }


    /*
     * Do not use .single() here.
     *
     * After a successful DELETE, Supabase may return
     * zero or multiple rows depending on the request/RLS.
     *
     * Returning an array keeps deletion handling simple.
     */
    return await supabaseClient
        .from(table)
        .delete()
        .eq("id", id)
        .select();

}


/* =========================================================
   COUNT
   ========================================================= */

async function count(
    table,
    filters = {}
) {

    let query =
        supabaseClient
            .from(table)
            .select("*", {
                count: "exact",
                head: true
            });


    Object.entries(
        filters
    ).forEach(
        ([column, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {

                query =
                    query.eq(
                        column,
                        value
                    );

            }

        }
    );


    return await query;

}


/* =========================================================
   CLIENTS
   ========================================================= */

const clients = {

    list(options = {}) {

        return list(
            TABLES.CLIENTS,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.CLIENTS,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.CLIENTS,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.CLIENTS,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.CLIENTS,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.CLIENTS,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.CLIENTS,
            filters
        );

    }

};


/* =========================================================
   MOVIES
   ========================================================= */

const movies = {

    list(options = {}) {

        return list(
            TABLES.MOVIES,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.MOVIES,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.MOVIES,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.MOVIES,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.MOVIES,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.MOVIES,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.MOVIES,
            filters
        );

    }

};


/* =========================================================
   CAMPAIGNS
   ========================================================= */

const campaigns = {

    list(options = {}) {

        return list(
            TABLES.CAMPAIGNS,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.CAMPAIGNS,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.CAMPAIGNS,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.CAMPAIGNS,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.CAMPAIGNS,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.CAMPAIGNS,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.CAMPAIGNS,
            filters
        );

    },


    activeCount() {

        return count(
            TABLES.CAMPAIGNS,
            {
                active: true
            }
        );

    }

};


/* =========================================================
   VENUES
   ========================================================= */

const venues = {

    list(options = {}) {

        return list(
            TABLES.VENUES,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.VENUES,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.VENUES,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.VENUES,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.VENUES,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.VENUES,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.VENUES,
            filters
        );

    }

};


/* =========================================================
   ACTIVATIONS
   ========================================================= */

const activations = {

    list(options = {}) {

        return list(
            TABLES.ACTIVATIONS,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.ACTIVATIONS,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.ACTIVATIONS,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.ACTIVATIONS,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.ACTIVATIONS,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.ACTIVATIONS,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.ACTIVATIONS,
            filters
        );

    }

};


/* =========================================================
   LEADS
   ========================================================= */

const leads = {

    list(options = {}) {

        return list(
            TABLES.LEADS,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.LEADS,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.LEADS,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.LEADS,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.LEADS,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.LEADS,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.LEADS,
            filters
        );

    }

};


/* =========================================================
   CAMPAIGN ASSETS
   ========================================================= */

const campaignAssets = {

    list(options = {}) {

        return list(
            TABLES.CAMPAIGN_ASSETS,
            {
                orderBy: "created_at",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.CAMPAIGN_ASSETS,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.CAMPAIGN_ASSETS,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.CAMPAIGN_ASSETS,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.CAMPAIGN_ASSETS,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.CAMPAIGN_ASSETS,
            id
        );

    }

};


/* =========================================================
   EXPENSES
   ========================================================= */

const expenses = {

    list(options = {}) {

        return list(
            TABLES.EXPENSES,
            {
                orderBy: "expense_date",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.EXPENSES,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.EXPENSES,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.EXPENSES,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.EXPENSES,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.EXPENSES,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.EXPENSES,
            filters
        );

    }

};


/* =========================================================
   INVOICES
   ========================================================= */

const invoices = {

    list(options = {}) {

        return list(
            TABLES.INVOICES,
            {
                orderBy: "issue_date",
                ascending: false,
                ...options
            }
        );

    },


    get(id) {

        return getById(
            TABLES.INVOICES,
            id
        );

    },


    create(payload) {

        return create(
            TABLES.INVOICES,
            payload
        );

    },


    update(id, payload) {

        return update(
            TABLES.INVOICES,
            id,
            payload
        );

    },


    delete(id) {

        return remove(
            TABLES.INVOICES,
            id
        );

    },


    remove(id) {

        return remove(
            TABLES.INVOICES,
            id
        );

    },


    count(filters = {}) {

        return count(
            TABLES.INVOICES,
            filters
        );

    }

};


/* =========================================================
   DASHBOARD
   ========================================================= */

const dashboard = {

    async getStats() {

        const [
            campaignsResult,
            activeCampaignsResult,
            activationsResult,
            leadsResult
        ] = await Promise.all([

            campaigns.count(),

            campaigns.activeCount(),

            activations.count(),

            leads.count()

        ]);


        return {

            data: {

                campaigns:
                    campaignsResult.count || 0,

                activeCampaigns:
                    activeCampaignsResult.count || 0,

                activations:
                    activationsResult.count || 0,

                leads:
                    leadsResult.count || 0

            },

            error:

                campaignsResult.error ||
                activeCampaignsResult.error ||
                activationsResult.error ||
                leadsResult.error ||
                null

        };

    },


    async recentCampaigns(
        limit = 5
    ) {

        return await campaigns.list({

            limit,

            select: `
                *,
                clients (
                    name
                ),
                movies (
                    title
                )
            `

        });

    },


    async recentLeads(
        limit = 5
    ) {

        return await leads.list({

            limit,

            select: `
                *,
                campaigns (
                    name
                ),
                activations (
                    name
                )
            `

        });

    }

};


/* =========================================================
   AUTH
   ========================================================= */

const auth = {

    async getUser() {

        return await supabaseClient
            .auth
            .getUser();

    },


    async getSession() {

        return await supabaseClient
            .auth
            .getSession();

    },


    async signOut() {

        return await supabaseClient
            .auth
            .signOut();

    },


    onAuthStateChange(
        callback
    ) {

        return supabaseClient
            .auth
            .onAuthStateChange(
                callback
            );

    }

};


/* =========================================================
   API
   ========================================================= */

export const API = {

    clients,

    movies,

    campaigns,

    venues,

    activations,

    leads,

    campaignAssets,

    expenses,

    invoices,

    dashboard,

    auth,


    /* ---------- Generic access ---------- */

    raw: {

        list,

        getById,

        create,

        update,

        remove,

        count

    }

};


/* =========================================================
   GLOBAL ACCESS
   ========================================================= */

window.API = API;

// Shared application constants
// No Supabase/database logic belongs in this file.

/* =========================
   ROUTES
   ========================= */

export const ROUTES = {
    DASHBOARD: "dashboard",
    CLIENTS: "clients",
    MOVIES: "movies",
    CAMPAIGNS: "campaigns",
    VENUES: "venues",
    ACTIVATIONS: "activations",
    LEADS: "leads",
    EXPENSES: "expenses",
    INVOICES: "invoices",
    REPORTS: "reports"
};


/* =========================
   TABLE NAMES
   ========================= */

export const TABLES = {
    CLIENTS: "clients",
    MOVIES: "movies",
    CAMPAIGNS: "campaigns",
    VENUES: "venues",
    ACTIVATIONS: "activations",
    LEADS: "leads",
    CAMPAIGN_ASSETS: "campaign_assets",
    EXPENSES: "expenses",
    INVOICES: "invoices"
};


/* =========================
   CAMPAIGNS
   ========================= */

export const CAMPAIGN_STATUSES = {
    ACTIVE: "Active",
    INACTIVE: "Inactive"
};


/* =========================
   INVOICES
   ========================= */

export const INVOICE_STATUSES = {
    DRAFT: "Draft",
    SENT: "Sent",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    CANCELLED: "Cancelled"
};


/* =========================
   VENUES
   ========================= */

export const VENUE_TYPES = {
    MALL: "Mall",
    COLLEGE: "College",
    CAFE: "Café",
    THEATRE: "Theatre",
    PUBLIC_SPACE: "Public Space",
    CORPORATE: "Corporate",
    OTHER: "Other"
};


/* =========================
   ACTIVATIONS
   ========================= */

export const ACTIVATION_STATUSES = {
    ACTIVE: "Active",
    INACTIVE: "Inactive"
};


/* =========================
   LEADS
   ========================= */

export const LEAD_VERIFICATION_METHODS = {
    MANUAL: "manual",
    GOOGLE: "google"
};


/* =========================
   CAMPAIGN ASSETS
   ========================= */

export const ASSET_TYPES = {
    POSTER: "Poster",
    VIDEO: "Video",
    BANNER: "Banner",
    IMAGE: "Image",
    DOCUMENT: "Document",
    OTHER: "Other"
};


/* =========================
   EXPENSES
   ========================= */

export const EXPENSE_CATEGORIES = {
    VENUE: "Venue",
    TRAVEL: "Travel",
    STAFF: "Staff",
    PRODUCTION: "Production",
    PRINTING: "Printing",
    EQUIPMENT: "Equipment",
    FOOD: "Food",
    TRANSPORT: "Transport",
    PROMOTION: "Promotion",
    OTHER: "Other"
};


/* =========================
   PAGINATION
   ========================= */

export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
};


/* =========================
   APPLICATION
   ========================= */

export const APP = {
    NAME: "Honeybadger Media",
    ADMIN_TITLE: "Honeybadger Media Admin"
};

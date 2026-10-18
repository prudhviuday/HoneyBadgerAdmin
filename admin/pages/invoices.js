import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea } from "../components/form.js";

let allInvoices = [];
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

export async function showInvoices(content) {

    content.innerHTML = `
        <div class="page-header">

            <div>
                <h1>Invoices</h1>

                <p class="page-subtitle">
                    Manage client invoices, payments and outstanding balances.
                </p>
            </div>

            <div class="page-header-actions">

                <button
                    class="btn secondary"
                    id="refreshInvoices">
                    ↻ Refresh
                </button>

                <button
                    class="btn"
                    data-add="invoice">
                    + Add Invoice
                </button>

            </div>

        </div>


        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-label">
                    Total Invoiced
                </div>

                <div
                    class="stat-value"
                    id="totalInvoiced">
                    ₹0
                </div>
            </div>


            <div class="stat-card">
                <div class="stat-label">
                    Paid
                </div>

                <div
                    class="stat-value"
                    id="totalPaid">
                    ₹0
                </div>
            </div>


            <div class="stat-card">
                <div class="stat-label">
                    Outstanding
                </div>

                <div
                    class="stat-value"
                    id="totalOutstanding">
                    ₹0
                </div>
            </div>


            <div class="stat-card">
                <div class="stat-label">
                    Overdue
                </div>

                <div
                    class="stat-value"
                    id="totalOverdue">
                    ₹0
                </div>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">

                <div class="venue-toolbar">

                    <button
                        class="venue-filter active"
                        data-filter="all">
                        All invoices
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="draft">
                        Draft
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="sent">
                        Sent
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="partial">
                        Partial
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="paid">
                        Paid
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="overdue">
                        Overdue
                    </button>

                </div>


                <div class="venue-search">

                    <input
                        type="text"
                        id="invoiceSearch"
                        placeholder="Search invoices..."
                    >

                </div>

            </div>


            <div id="invoicesTable">

                <div class="loading">
                    Loading invoices...
                </div>

            </div>

        </div>
    `;


    currentFilter = "all";


    /* Refresh */

    document
        .getElementById("refreshInvoices")
        ?.addEventListener(
            "click",
            loadInvoices
        );


    /* Filters */

    document
        .querySelectorAll(
            ".venue-filter"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentFilter =
                        button.dataset.filter;


                    document
                        .querySelectorAll(
                            ".venue-filter"
                        )
                        .forEach(btn =>
                            btn.classList.remove(
                                "active"
                            )
                        );


                    button.classList.add(
                        "active"
                    );


                    renderInvoices();
                }
            );

        });


    /* Search */

    document
        .getElementById("invoiceSearch")
        ?.addEventListener(
            "input",
            renderInvoices
        );


    await loadInvoices();
}


/* =========================================================
   LOAD
========================================================= */

async function loadInvoices() {

    const table =
        document.getElementById(
            "invoicesTable"
        );


    if (!table) return;


    table.innerHTML = `
        <div class="loading">
            Loading invoices...
        </div>
    `;


    try {

        const result =
            await API.invoices.list();


        if (result?.error) {
            throw result.error;
        }


        allInvoices =
            getRows(result);


        updateStats();
        renderInvoices();

    } catch (error) {

        console.error(
            "Failed to load invoices:",
            error
        );


        allInvoices = [];


        table.innerHTML = `
            <div class="empty">
                Failed to load invoices.
                ${esc(error?.message || "")}
            </div>
        `;
    }
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    let invoiced = 0;
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;


    allInvoices.forEach(
        invoice => {

            const total =
                getTotal(invoice);


            const paidAmount =
                getPaidAmount(invoice);


            const balance =
                Math.max(
                    total - paidAmount,
                    0
                );


            invoiced += total;
            paid += paidAmount;
            outstanding += balance;


            if (
                isOverdue(invoice) &&
                balance > 0
            ) {

                overdue += balance;

            }

        }
    );


    setText(
        "totalInvoiced",
        formatCurrency(invoiced)
    );


    setText(
        "totalPaid",
        formatCurrency(paid)
    );


    setText(
        "totalOutstanding",
        formatCurrency(outstanding)
    );


    setText(
        "totalOverdue",
        formatCurrency(overdue)
    );
}


/* =========================================================
   FILTER + SEARCH
========================================================= */

function renderInvoices() {

    const container =
        document.getElementById(
            "invoicesTable"
        );


    if (!container) return;


    const search =
        document
            .getElementById(
                "invoiceSearch"
            )
            ?.value
            ?.trim()
            .toLowerCase() || "";


    let rows =
        [...allInvoices];


    /* Filter */

    if (
        currentFilter ===
        "overdue"
    ) {

        rows =
            rows.filter(
                invoice =>
                    isOverdue(invoice)
            );

    } else if (
        currentFilter !==
        "all"
    ) {

        rows =
            rows.filter(
                invoice =>
                    getStatus(invoice) ===
                    currentFilter
            );

    }


    /* Search */

    if (search) {

        rows =
            rows.filter(
                invoice => {

                    const text = [

                        invoice.invoice_number,
                        invoice.number,
                        invoice.reference_number,

                        invoice.client_name,
                        invoice.client?.name,

                        invoice.campaign_name,
                        invoice.campaign?.name,

                        invoice.status,

                        invoice.notes

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


    /* Empty */

    if (!rows.length) {

        container.innerHTML = `
            <div class="empty">
                No invoices found.
            </div>
        `;

        return;
    }


    /* Sort newest first */

    rows.sort(
        (a, b) => {

            const da =
                new Date(
                    a.invoice_date ||
                    a.date ||
                    a.created_at ||
                    0
                );


            const db =
                new Date(
                    b.invoice_date ||
                    b.date ||
                    b.created_at ||
                    0
                );


            return db - da;
        }
    );


    container.innerHTML = `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Invoice</th>
                        <th>Client</th>
                        <th>Campaign</th>
                        <th>Invoice Date</th>
                        <th>Due Date</th>
                        <th>Amount</th>
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


    /* Edit buttons */

    container
        .querySelectorAll(
            "[data-edit-invoice]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    openInvoiceModal(
                        button.dataset.editInvoice
                    )
            );

        });


    /* Delete buttons */

    container
        .querySelectorAll(
            "[data-delete-invoice]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteInvoice(
                        button.dataset.deleteInvoice
                    )
            );

        });
}


/* =========================================================
   TABLE ROW
========================================================= */

function renderRow(invoice) {

    const number =
        invoice.invoice_number ||
        invoice.number ||
        invoice.reference_number ||
        "Draft";


    const client =
        invoice.client_name ||
        invoice.client?.name ||
        "—";


    const campaign =
        invoice.campaign_name ||
        invoice.campaign?.name ||
        "—";


    const invoiceDate =
        invoice.invoice_date ||
        invoice.date ||
        invoice.created_at;


    const dueDate =
        invoice.due_date ||
        invoice.payment_due_date;


    const total =
        getTotal(invoice);


    const paid =
        getPaidAmount(invoice);


    const balance =
        Math.max(
            total - paid,
            0
        );


    const status =
        getDisplayStatus(invoice);


    return `

        <tr>

            <td>

                <div class="primary-text">
                    ${esc(number)}
                </div>

            </td>


            <td>
                ${esc(client)}
            </td>


            <td>
                ${esc(campaign)}
            </td>


            <td>
                ${formatDate(invoiceDate)}
            </td>


            <td>
                ${formatDate(dueDate)}
            </td>


            <td>

                <div>
                    <strong>
                        ${formatCurrency(total)}
                    </strong>
                </div>

                ${
                    balance > 0
                        ? `
                            <div class="muted">
                                Due:
                                ${formatCurrency(balance)}
                            </div>
                          `
                        : ""
                }

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
                    data-edit-invoice="${escAttr(invoice.id)}">
                    Edit
                </button>


                <button
                    class="icon-btn danger"
                    title="Delete"
                    data-delete-invoice="${escAttr(invoice.id)}">
                    Delete
                </button>

            </td>

        </tr>
    `;
}


/* =========================================================
   ADD / EDIT MODAL
========================================================= */

export async function openInvoiceModal(
    id = null
) {

    let invoice = {};


    /* Load existing invoice */

    if (id) {

        try {

            const result =
                await API.invoices.get(id);


            if (result?.error) {
                throw result.error;
            }


            invoice =
                result?.data ||
                result ||
                {};


        } catch (error) {

            console.error(
                "Failed to load invoice:",
                error
            );


            alert(
                error?.message ||
                "Failed to load invoice."
            );


            return;
        }
    }


    const isEdit =
        Boolean(id);


    /* Load clients */

    const clients =
        await getClientOptions(
            invoice.client_id
        );


    /* Load campaigns */

    const campaigns =
        await getCampaignOptions(
            invoice.campaign_id
        );


    const body = `

        <form id="invoiceForm">

            ${input(
                "invoice_number",
                "Invoice Number",
                "text",
                invoice.invoice_number ||
                invoice.number ||
                "",
                true
            )}


            ${select(
                "client_id",
                "Client",
                clients,
                invoice.client_id ||
                "",
                true
            )}


            ${select(
                "campaign_id",
                "Campaign",
                campaigns,
                invoice.campaign_id ||
                "",
                false
            )}


            ${input(
                "invoice_date",
                "Invoice Date",
                "date",
                invoice.invoice_date ||
                invoice.date ||
                "",
                true
            )}


            ${input(
                "due_date",
                "Due Date",
                "date",
                invoice.due_date ||
                invoice.payment_due_date ||
                "",
                true
            )}


            ${input(
                "amount",
                "Invoice Amount",
                "number",
                getTotal(invoice) ||
                "",
                true,
                'step="0.01" min="0"'
            )}


            ${input(
                "tax_amount",
                "Tax Amount",
                "number",
                invoice.tax_amount ||
                "",
                false,
                'step="0.01" min="0"'
            )}


            ${input(
                "paid_amount",
                "Paid Amount",
                "number",
                getPaidAmount(invoice) ||
                "",
                false,
                'step="0.01" min="0"'
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
                        value: "sent",
                        label: "Sent"
                    },
                    {
                        value: "partial",
                        label: "Partially Paid"
                    },
                    {
                        value: "paid",
                        label: "Paid"
                    },
                    {
                        value: "cancelled",
                        label: "Cancelled"
                    }
                ],
                invoice.status ||
                "draft",
                true
            )}


            ${input(
                "payment_date",
                "Payment Date",
                "date",
                invoice.payment_date ||
                invoice.paid_date ||
                ""
            )}


            ${input(
                "payment_reference",
                "Payment Reference",
                "text",
                invoice.payment_reference ||
                ""
            )}


            ${textarea(
                "notes",
                "Notes",
                invoice.notes ||
                ""
            )}


            <div class="form-actions">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="invoiceModal">
                    Cancel
                </button>


                <button
                    type="submit"
                    class="btn">

                    ${
                        isEdit
                            ? "Save Changes"
                            : "Create Invoice"
                    }

                </button>

            </div>

        </form>
    `;


    /* Remove existing modal */

    const existing =
        document.getElementById(
            "invoiceModal"
        );


    if (existing) {
        existing.remove();
    }


    /* Add modal */

    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "invoiceModal",
            isEdit
                ? "Edit Invoice"
                : "Add Invoice",
            body
        )
    );


    document
        .getElementById(
            "invoiceModal"
        )
        ?.classList.add("show");


    /* Submit */

    document
        .getElementById(
            "invoiceForm"
        )
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await saveInvoice(id);

            }
        );
}


/* =========================================================
   SAVE
========================================================= */

async function saveInvoice(id) {

    const form =
        document.getElementById(
            "invoiceForm"
        );


    if (!form) return;


    const formData =
        new FormData(form);


    const data = {

        invoice_number:
            formData
                .get("invoice_number")
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

        invoice_date:
            formData.get(
                "invoice_date"
            ) || null,

        due_date:
            formData.get(
                "due_date"
            ) || null,

        amount:
            Number(
                formData.get("amount")
            ) || 0,

        tax_amount:
            Number(
                formData.get("tax_amount")
            ) || 0,

        paid_amount:
            Number(
                formData.get("paid_amount")
            ) || 0,

        status:
            formData.get("status") ||
            "draft",

        payment_date:
            formData.get(
                "payment_date"
            ) || null,

        payment_reference:
            formData
                .get("payment_reference")
                ?.trim() ||
            null,

        notes:
            formData
                .get("notes")
                ?.trim() ||
            null
    };


    /* Basic validation */

    if (!data.invoice_number) {
        alert("Invoice number is required.");
        return;
    }


    if (!data.client_id) {
        alert("Please select a client.");
        return;
    }


    if (!data.invoice_date) {
        alert("Invoice date is required.");
        return;
    }


    if (!data.due_date) {
        alert("Due date is required.");
        return;
    }


    if (data.amount < 0) {
        alert("Invoice amount cannot be negative.");
        return;
    }


    try {

        let result;


        if (id) {

            result =
                await API.invoices.update(
                    id,
                    data
                );

        } else {

            result =
                await API.invoices.create(
                    data
                );

        }


        /* IMPORTANT:
           Supabase usually returns { data, error }
           instead of throwing an exception.
        */

        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "invoiceModal"
            )
            ?.classList.remove(
                "show"
            );


        await loadInvoices();


    } catch (error) {

        console.error(
            "Failed to save invoice:",
            error
        );


        alert(
            error?.message ||
            "Failed to save invoice."
        );
    }
}


/* =========================================================
   DELETE
========================================================= */

async function deleteInvoice(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Are you sure you want to delete this invoice?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.invoices.remove(id);


        if (result?.error) {
            throw result.error;
        }


        await loadInvoices();


    } catch (error) {

        console.error(
            "Failed to delete invoice:",
            error
        );


        alert(
            error?.message ||
            "Failed to delete invoice."
        );
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
   CAMPAIGN OPTIONS
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


/* =========================================================
   INVOICE HELPERS
========================================================= */

function getTotal(invoice) {

    const value =
        invoice.total_amount ??
        invoice.amount ??
        invoice.total ??
        0;


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : 0;
}


function getPaidAmount(invoice) {

    const value =
        invoice.paid_amount ??
        invoice.amount_paid ??
        invoice.paid ??
        0;


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : 0;
}


function getStatus(invoice) {

    return String(
        invoice.status ||
        "draft"
    ).toLowerCase();
}


function isOverdue(invoice) {

    if (
        getStatus(invoice) ===
        "paid"
    ) {
        return false;
    }


    const dueDate =
        invoice.due_date ||
        invoice.payment_due_date;


    if (!dueDate) {
        return false;
    }


    const due =
        new Date(dueDate);


    if (
        Number.isNaN(
            due.getTime()
        )
    ) {
        return false;
    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    due.setHours(
        0,
        0,
        0,
        0
    );


    return (
        due < today &&
        getTotal(invoice) >
        getPaidAmount(invoice)
    );
}


function getDisplayStatus(invoice) {

    if (
        isOverdue(invoice)
    ) {
        return "overdue";
    }


    return getStatus(invoice);
}


function getStatusClass(status) {

    switch (
        String(status).toLowerCase()
    ) {

        case "paid":
            return "success";

        case "sent":
            return "success";

        case "partial":
            return "warning";

        case "overdue":
            return "danger";

        case "cancelled":
        case "canceled":
            return "danger";

        case "draft":
            return "muted";

        default:
            return "";
    }
}


/* =========================================================
   FORMATTING
========================================================= */

function formatCurrency(value) {

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


function setText(id, value) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent =
            value;
    }
}


/* =========================================================
   ESCAPE HELPERS
========================================================= */

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

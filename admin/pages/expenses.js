import { API } from "../js/api.js";
import { modal } from "../components/modal.js";
import { input, select, textarea } from "../components/form.js";

let allExpenses = [];
let currentFilter = "all";


/* =========================================================
   NORMALIZE API LIST RESULT
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

export async function showExpenses(content) {

    content.innerHTML = `
        <div class="page-header">

            <div>
                <h1>Expenses</h1>

                <p class="page-subtitle">
                    Track campaign expenses, operational costs and payments.
                </p>
            </div>

            <div class="page-header-actions">

                <button
                    class="btn secondary"
                    id="refreshExpenses">
                    ↻ Refresh
                </button>

                <button
                    class="btn"
                    data-add="expense">
                    + Add Expense
                </button>

            </div>

        </div>


        <div class="stats-grid">

            <div class="stat-card">

                <div class="stat-label">
                    Total Expenses
                </div>

                <div
                    class="stat-value"
                    id="totalExpenses">
                    ₹0
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    This Month
                </div>

                <div
                    class="stat-value"
                    id="monthlyExpenses">
                    ₹0
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Paid
                </div>

                <div
                    class="stat-value"
                    id="paidExpenses">
                    ₹0
                </div>

            </div>


            <div class="stat-card">

                <div class="stat-label">
                    Pending
                </div>

                <div
                    class="stat-value"
                    id="pendingExpenses">
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
                        All expenses
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="paid">
                        Paid
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="pending">
                        Pending
                    </button>

                    <button
                        class="venue-filter"
                        data-filter="cancelled">
                        Cancelled
                    </button>

                </div>


                <div class="venue-search">

                    <input
                        type="text"
                        id="expenseSearch"
                        placeholder="Search expenses..."
                    >

                </div>

            </div>


            <div id="expensesTable">

                <div class="loading">
                    Loading expenses...
                </div>

            </div>

        </div>
    `;


    currentFilter = "all";


    /* =====================================================
       REFRESH
    ===================================================== */

    document
        .getElementById(
            "refreshExpenses"
        )
        ?.addEventListener(
            "click",
            loadExpenses
        );


    /* =====================================================
       FILTERS
    ===================================================== */

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


                    renderExpenses();
                }
            );

        });


    /* =====================================================
       SEARCH
    ===================================================== */

    document
        .getElementById(
            "expenseSearch"
        )
        ?.addEventListener(
            "input",
            renderExpenses
        );


    await loadExpenses();
}


/* =========================================================
   LOAD
========================================================= */

async function loadExpenses() {

    const table =
        document.getElementById(
            "expensesTable"
        );


    if (!table) return;


    table.innerHTML = `
        <div class="loading">
            Loading expenses...
        </div>
    `;


    try {

        const result =
            await API.expenses.list();


        if (result?.error) {
            throw result.error;
        }


        allExpenses =
            getRows(result);


        updateStats();
        renderExpenses();


    } catch (error) {

        console.error(
            "Failed to load expenses:",
            error
        );


        allExpenses = [];


        table.innerHTML = `
            <div class="empty">
                Failed to load expenses.
                ${esc(error?.message || "")}
            </div>
        `;
    }
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const total =
        sumExpenses(
            allExpenses
        );


    const now =
        new Date();


    const monthly =
        sumExpenses(
            allExpenses.filter(
                expense => {

                    const date =
                        getExpenseDate(
                            expense
                        );


                    if (!date) {
                        return false;
                    }


                    const d =
                        new Date(date);


                    if (
                        Number.isNaN(
                            d.getTime()
                        )
                    ) {
                        return false;
                    }


                    return (
                        d.getMonth() ===
                        now.getMonth()
                        &&
                        d.getFullYear() ===
                        now.getFullYear()
                    );

                }
            )
        );


    const paid =
        sumExpenses(
            allExpenses.filter(
                expense =>
                    getStatus(expense) ===
                    "paid"
            )
        );


    const pending =
        sumExpenses(
            allExpenses.filter(
                expense =>
                    getStatus(expense) ===
                    "pending"
            )
        );


    setText(
        "totalExpenses",
        formatCurrency(total)
    );


    setText(
        "monthlyExpenses",
        formatCurrency(monthly)
    );


    setText(
        "paidExpenses",
        formatCurrency(paid)
    );


    setText(
        "pendingExpenses",
        formatCurrency(pending)
    );
}


/* =========================================================
   FILTER + SEARCH
========================================================= */

function renderExpenses() {

    const container =
        document.getElementById(
            "expensesTable"
        );


    if (!container) return;


    const search =
        document
            .getElementById(
                "expenseSearch"
            )
            ?.value
            ?.trim()
            .toLowerCase() || "";


    let rows =
        [...allExpenses];


    /* FILTER */

    if (
        currentFilter !==
        "all"
    ) {

        rows =
            rows.filter(
                expense =>
                    getStatus(expense) ===
                    currentFilter
            );

    }


    /* SEARCH */

    if (search) {

        rows =
            rows.filter(
                expense => {

                    const text = [

                        expense.description,
                        expense.name,

                        expense.category,
                        expense.expense_category,

                        expense.vendor,
                        expense.vendor_name,

                        expense.campaign_name,
                        expense.campaign?.name,

                        expense.invoice_number,

                        expense.payment_method,

                        expense.status

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


    /* EMPTY */

    if (!rows.length) {

        container.innerHTML = `
            <div class="empty">
                No expenses found.
            </div>
        `;

        return;
    }


    /* SORT */

    rows.sort(
        (a, b) => {

            const da =
                new Date(
                    getExpenseDate(a) ||
                    0
                );


            const db =
                new Date(
                    getExpenseDate(b) ||
                    0
                );


            return db - da;
        }
    );


    /* TABLE */

    container.innerHTML = `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Expense</th>
                        <th>Campaign</th>
                        <th>Category</th>
                        <th>Date</th>
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


    /* EDIT */

    container
        .querySelectorAll(
            "[data-edit-expense]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    openExpenseModal(
                        button.dataset.editExpense
                    )
            );

        });


    /* DELETE */

    container
        .querySelectorAll(
            "[data-delete-expense]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteExpense(
                        button.dataset.deleteExpense
                    )
            );

        });
}


/* =========================================================
   TABLE ROW
========================================================= */

function renderRow(expense) {

    const name =
        expense.description ||
        expense.name ||
        "Expense";


    const campaign =
        expense.campaign_name ||
        expense.campaign?.name ||
        "—";


    const category =
        expense.category ||
        expense.expense_category ||
        "—";


    const date =
        getExpenseDate(
            expense
        );


    const amount =
        getAmount(
            expense
        );


    const status =
        getStatus(
            expense
        );


    return `

        <tr>

            <td>

                <div class="primary-text">
                    ${esc(name)}
                </div>

                ${
                    expense.vendor ||
                    expense.vendor_name
                        ? `
                            <div class="muted">
                                ${esc(
                                    expense.vendor ||
                                    expense.vendor_name
                                )}
                            </div>
                          `
                        : ""
                }

            </td>


            <td>
                ${esc(campaign)}
            </td>


            <td>
                ${esc(category)}
            </td>


            <td>
                ${formatDate(date)}
            </td>


            <td>

                <strong>
                    ${formatCurrency(amount)}
                </strong>

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
                    data-edit-expense="${escAttr(
                        expense.id
                    )}">
                    Edit
                </button>


                <button
                    class="icon-btn danger"
                    title="Delete"
                    data-delete-expense="${escAttr(
                        expense.id
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

export async function openExpenseModal(
    id = null
) {

    let expense = {};


    /* LOAD EXISTING */

    if (id) {

        try {

            const result =
                await API.expenses.get(id);


            if (result?.error) {
                throw result.error;
            }


            expense =
                result?.data ||
                result ||
                {};


        } catch (error) {

            console.error(
                "Failed to load expense:",
                error
            );


            alert(
                error?.message ||
                "Failed to load expense."
            );


            return;
        }
    }


    const isEdit =
        Boolean(id);


    /* CAMPAIGNS */

    const campaigns =
        await getCampaignOptions(
            expense.campaign_id
        );


    const body = `

        <form id="expenseForm">

            ${input(
                "description",
                "Description",
                "text",
                expense.description ||
                expense.name ||
                "",
                true
            )}


            ${select(
                "campaign_id",
                "Campaign",
                campaigns,
                expense.campaign_id ||
                "",
                false
            )}


            ${select(
                "category",
                "Category",
                [
                    {
                        value: "Venue",
                        label: "Venue"
                    },
                    {
                        value: "Staff",
                        label: "Staff"
                    },
                    {
                        value: "Travel",
                        label: "Travel"
                    },
                    {
                        value: "Printing",
                        label: "Printing"
                    },
                    {
                        value: "Production",
                        label: "Production"
                    },
                    {
                        value: "Equipment",
                        label: "Equipment"
                    },
                    {
                        value: "Food",
                        label: "Food"
                    },
                    {
                        value: "Transport",
                        label: "Transport"
                    },
                    {
                        value: "Advertising",
                        label: "Advertising"
                    },
                    {
                        value: "Other",
                        label: "Other"
                    }
                ],
                expense.category ||
                expense.expense_category ||
                "",
                true
            )}


            ${input(
                "amount",
                "Amount",
                "number",
                getAmount(expense) ||
                "",
                true,
                'step="0.01" min="0"'
            )}


            ${input(
                "expense_date",
                "Expense Date",
                "date",
                getExpenseDate(expense) ||
                "",
                true
            )}


            ${select(
                "status",
                "Status",
                [
                    {
                        value: "pending",
                        label: "Pending"
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
                expense.status ||
                "pending",
                true
            )}


            ${input(
                "vendor",
                "Vendor",
                "text",
                expense.vendor ||
                expense.vendor_name ||
                ""
            )}


            ${select(
                "payment_method",
                "Payment Method",
                [
                    {
                        value: "Cash",
                        label: "Cash"
                    },
                    {
                        value: "Bank Transfer",
                        label: "Bank Transfer"
                    },
                    {
                        value: "UPI",
                        label: "UPI"
                    },
                    {
                        value: "Card",
                        label: "Card"
                    },
                    {
                        value: "Cheque",
                        label: "Cheque"
                    },
                    {
                        value: "Other",
                        label: "Other"
                    }
                ],
                expense.payment_method ||
                ""
            )}


            ${input(
                "invoice_number",
                "Invoice / Bill Number",
                "text",
                expense.invoice_number ||
                ""
            )}


            ${textarea(
                "notes",
                "Notes",
                expense.notes ||
                ""
            )}


            <div class="form-actions">

                <button
                    type="button"
                    class="btn secondary"
                    data-close="expenseModal">
                    Cancel
                </button>


                <button
                    type="submit"
                    class="btn">

                    ${
                        isEdit
                            ? "Save Changes"
                            : "Create Expense"
                    }

                </button>

            </div>

        </form>
    `;


    /* REMOVE OLD MODAL */

    const existing =
        document.getElementById(
            "expenseModal"
        );


    if (existing) {
        existing.remove();
    }


    /* INSERT */

    document.body.insertAdjacentHTML(
        "beforeend",
        modal(
            "expenseModal",
            isEdit
                ? "Edit Expense"
                : "Add Expense",
            body
        )
    );


    document
        .getElementById(
            "expenseModal"
        )
        ?.classList.add(
            "show"
        );


    /* SUBMIT */

    document
        .getElementById(
            "expenseForm"
        )
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await saveExpense(id);

            }
        );
}


/* =========================================================
   SAVE
========================================================= */

async function saveExpense(id) {

    const form =
        document.getElementById(
            "expenseForm"
        );


    if (!form) return;


    const formData =
        new FormData(form);


    const amountValue =
        formData.get(
            "amount"
        );


    const data = {

        description:
            formData
                .get("description")
                ?.trim() ||
            null,

        campaign_id:
            formData.get(
                "campaign_id"
            ) || null,

        category:
            formData.get(
                "category"
            ) || null,

        amount:
            amountValue
                ? Number(amountValue)
                : 0,

        expense_date:
            formData.get(
                "expense_date"
            ) || null,

        status:
            formData.get(
                "status"
            ) || "pending",

        vendor:
            formData
                .get("vendor")
                ?.trim() ||
            null,

        payment_method:
            formData.get(
                "payment_method"
            ) || null,

        invoice_number:
            formData
                .get("invoice_number")
                ?.trim() ||
            null,

        notes:
            formData
                .get("notes")
                ?.trim() ||
            null
    };


    /* VALIDATION */

    if (!data.description) {

        alert(
            "Description is required."
        );

        return;
    }


    if (!data.category) {

        alert(
            "Please select an expense category."
        );

        return;
    }


    if (!data.expense_date) {

        alert(
            "Expense date is required."
        );

        return;
    }


    if (
        !Number.isFinite(data.amount) ||
        data.amount < 0
    ) {

        alert(
            "Please enter a valid expense amount."
        );

        return;
    }


    try {

        let result;


        if (id) {

            result =
                await API.expenses.update(
                    id,
                    data
                );

        } else {

            result =
                await API.expenses.create(
                    data
                );
        }


        /* IMPORTANT:
           Supabase returns { data, error }.
        */

        if (result?.error) {
            throw result.error;
        }


        document
            .getElementById(
                "expenseModal"
            )
            ?.classList.remove(
                "show"
            );


        await loadExpenses();


    } catch (error) {

        console.error(
            "Failed to save expense:",
            error
        );


        alert(
            error?.message ||
            "Failed to save expense."
        );
    }
}


/* =========================================================
   DELETE
========================================================= */

async function deleteExpense(id) {

    if (!id) return;


    const confirmed =
        confirm(
            "Are you sure you want to delete this expense?"
        );


    if (!confirmed) return;


    try {

        const result =
            await API.expenses.remove(
                id
            );


        if (result?.error) {
            throw result.error;
        }


        await loadExpenses();


    } catch (error) {

        console.error(
            "Failed to delete expense:",
            error
        );


        alert(
            error?.message ||
            "Failed to delete expense."
        );
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
   DATA HELPERS
========================================================= */

function getAmount(expense) {

    const value =
        expense.amount ??
        expense.total_amount ??
        expense.cost ??
        0;


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : 0;
}


function sumExpenses(expenses) {

    return expenses.reduce(
        (total, expense) =>
            total +
            getAmount(expense),
        0
    );
}


function getExpenseDate(expense) {

    return (
        expense.expense_date ||
        expense.date ||
        expense.incurred_on ||
        expense.created_at ||
        null
    );
}


function getStatus(expense) {

    return String(
        expense.status ||
        "pending"
    ).toLowerCase();
}


function getStatusClass(status) {

    switch (
        String(status).toLowerCase()
    ) {

        case "paid":
            return "success";

        case "pending":
            return "warning";

        case "cancelled":
        case "canceled":
            return "danger";

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
   ESCAPE
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

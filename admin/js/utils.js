// Honeybadger Media Admin
// Shared utility functions.
// No Supabase/database logic belongs in this file.

const Utils = (() => {

    /* =========================
       DOM
       ========================= */

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function $$(selector, parent = document) {
        return [...parent.querySelectorAll(selector)];
    }

    function createElement(tag, options = {}) {
        const element = document.createElement(tag);

        if (options.className) {
            element.className = options.className;
        }

        if (options.id) {
            element.id = options.id;
        }

        if (options.text !== undefined) {
            element.textContent = options.text;
        }

        if (options.html !== undefined) {
            element.innerHTML = options.html;
        }

        if (options.attributes) {
            Object.entries(options.attributes).forEach(
                ([name, value]) => {
                    element.setAttribute(name, value);
                }
            );
        }

        return element;
    }


    /* =========================
       STRING
       ========================= */

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function truncate(value, length = 50) {
        if (!value) {
            return "";
        }

        const text = String(value);

        if (text.length <= length) {
            return text;
        }

        return '${text.substring(0, length)}...';
    }


    function capitalize(value) {
        if (!value) {
            return "";
        }

        const text = String(value);

        return (
            text.charAt(0).toUpperCase() +
            text.slice(1)
        );
    }


    function titleCase(value) {
        if (!value) {
            return "";
        }

        return String(value)
            .toLowerCase()
            .split(/\s+/)
            .map(word => capitalize(word))
            .join(" ");
    }


    /* =========================
       DATE
       ========================= */

    function formatDate(value, options = {}) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(
            options.locale || "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                ...options
            }
        ).format(date);
    }


    function formatDateTime(value, options = {}) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(
            options.locale || "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                ...options
            }
        ).format(date);
    }


    function toInputDate(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toISOString().split("T")[0];
    }


    /* =========================
       NUMBER / CURRENCY
       ========================= */

    function formatNumber(value, options = {}) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "0";
        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return "0";
        }

        return new Intl.NumberFormat(
            options.locale || "en-IN",
            options
        ).format(number);
    }


    function formatCurrency(
        value,
        currency = "INR",
        options = {}
    ) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "₹0";
        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return "₹0";
        }

        return new Intl.NumberFormat(
            options.locale || "en-IN",
            {
                style: "currency",
                currency,
                maximumFractionDigits: 2,
                ...options
            }
        ).format(number);
    }


    function parseNumber(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return 0;
        }

        const cleaned = String(value)
            .replace(/,/g, "")
            .replace(/[₹$€£]/g, "")
            .trim();

        const number = Number(cleaned);

        return Number.isNaN(number)
            ? 0
            : number;
    }


    /* =========================
       VALUES
       ========================= */

    function valueOrDash(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        return value;
    }


    function valueOrZero(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return 0;
        }

        return value;
    }


    /* =========================
       STATUS
       ========================= */

    function statusClass(status) {
        if (!status) {
            return "";
        }

        return String(status)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }


    function statusBadge(status) {
        if (!status) {
            return "—";
        }

        const safeStatus = escapeHtml(status);
        const className = statusClass(status);

        return `
            <span class="status ${className}">
                ${safeStatus}
            </span>
        `;
    }


    /* =========================
       SEARCH
       ========================= */

    function matchesSearch(
        value,
        searchTerm
    ) {
        if (!searchTerm) {
            return true;
        }

        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        return String(value)
            .toLowerCase()
            .includes(
                String(searchTerm).toLowerCase()
            );
    }


    function filterBySearch(
        items,
        searchTerm,
        fields = []
    ) {
        if (!Array.isArray(items)) {
            return [];
        }

        if (!searchTerm) {
            return items;
        }

        const term = String(searchTerm)
            .toLowerCase()
            .trim();

        if (!term) {
            return items;
        }

        return items.filter(item => {
            return fields.some(field => {
                return matchesSearch(
                    item?.[field],
                    term
                );
            });
        });
    }


    /* =========================
       OBJECT
       ========================= */

    function getNestedValue(
        object,
        path,
        fallback = ""
    ) {
        if (!object || !path) {
            return fallback;
        }

        const result = String(path)
            .split(".")
            .reduce(
                (current, key) =>
                    current?.[key],
                object
            );

        return result === undefined ||
            result === null
            ? fallback
            : result;
    }


    function omit(object, keys = []) {
        if (!object || typeof object !== "object") {
            return {};
        }

        const excluded = new Set(keys);

        return Object.fromEntries(
            Object.entries(object).filter(
                ([key]) => !excluded.has(key)
            )
        );
    }


    /* =========================
       FORM
       ========================= */

    function formToObject(form) {
        if (!form) {
            return {};
        }

        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {

            if (
                Object.prototype.hasOwnProperty.call(
                    data,
                    key
                )
            ) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }

                data[key].push(value);
            } else {
                data[key] = value;
            }
        }

        return data;
    }


    function setFormData(
        form,
        data = {}
    ) {
        if (!form || !data) {
            return;
        }

        Object.entries(data).forEach(
            ([name, value]) => {

                const field =
                    form.elements[name];

                if (!field) {
                    return;
                }

                if (field.type === "checkbox") {
                    field.checked = Boolean(value);
                    return;
                }

                if (field.type === "radio") {
                    const radio =
                        form.querySelector(
                            '[name="${CSS.escape(name)}"][value="${CSS.escape(String(value))}"]'
                        );

                    if (radio) {
                        radio.checked = true;
                    }

                    return;
                }

                field.value =
                    value === null ||
                    value === undefined
                        ? ""
                        : value;
            }
        );
    }


    /* =========================
       URL
       ========================= */

    function getQueryParam(
        name,
        url = window.location.href
    ) {
        const params =
            new URL(url).searchParams;

        return params.get(name);
    }


    function setQueryParam(
        name,
        value
    ) {
        const url =
            new URL(window.location.href);

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            url.searchParams.delete(name);
        } else {
            url.searchParams.set(
                name,
                value
            );
        }

        window.history.replaceState(
            {},
            "",
            url
        );
    }


    function getHash() {
        return window.location.hash
            .replace("#", "")
            .trim();
    }


    /* =========================
       VALIDATION
       ========================= */

    function isRequired(value) {
        return !(
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        );
    }


    function isValidEmail(value) {
        if (!value) {
            return false;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(String(value).trim());
    }


    function isValidPhone(value) {
        if (!value) {
            return false;
        }

        const digits =
            String(value).replace(/\D/g, "");

        return digits.length >= 10;
    }


    /* =========================
       DEBOUNCE / THROTTLE
       ========================= */

    function debounce(
        callback,
        delay = 300
    ) {
        let timeout;

        return function (...args) {
            clearTimeout(timeout);

            timeout = setTimeout(
                () => callback.apply(this, args),
                delay
            );
        };
    }


    function throttle(
        callback,
        delay = 300
    ) {
        let lastCall = 0;

        return function (...args) {
            const now = Date.now();

            if (
                now - lastCall >= delay
            ) {
                lastCall = now;
                callback.apply(this, args);
            }
        };
    }


    /* =========================
       ASYNC
       ========================= */

    function sleep(milliseconds) {
        return new Promise(resolve => {
            setTimeout(
                resolve,
                milliseconds
            );
        });
    }


    /* =========================
       ERROR HANDLING
       ========================= */

    function getErrorMessage(error) {
        if (!error) {
            return "Something went wrong.";
        }

        if (typeof error === "string") {
            return error;
        }

        return (
            error.message ||
            error.error_description ||
            error.details ||
            error.hint ||
            "Something went wrong."
        );
    }


    /* =========================
       EXPORT
       ========================= */

    return {

        // DOM
        $,
        $$,
        createElement,

        // String
        escapeHtml,
        truncate,
        capitalize,
        titleCase,

        // Date
        formatDate,
        formatDateTime,
        toInputDate,

        // Number / Currency
        formatNumber,
        formatCurrency,
        parseNumber,

        // Values
        valueOrDash,
        valueOrZero,

        // Status
        statusClass,
        statusBadge,

        // Search
        matchesSearch,
        filterBySearch,

        // Object
        getNestedValue,
        omit,

        // Forms
        formToObject,
        setFormData,

        // URL
        getQueryParam,
        setQueryParam,
        getHash,

        // Validation
        isRequired,
        isValidEmail,
        isValidPhone,

        // Timing
        debounce,
        throttle,
        sleep,

        // Errors
        getErrorMessage
    };

})();


/* =========================
   GLOBAL ACCESS
   ========================= */

window.Utils = Utils;


/* =========================
   ES MODULE EXPORT
   ========================= */

export { Utils };

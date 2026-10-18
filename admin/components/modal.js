/**
 * Create a modal HTML structure
 */
export function modal(id, title, body) {

    return `
        <div
            class="modal-overlay"
            id="${id}"
        >

            <div class="modal">

                <div class="modal-head">

                    <div>
                        <h2>${title}</h2>
                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        data-close="${id}"
                        aria-label="Close"
                    >
                        ×
                    </button>

                </div>

                ${body}

            </div>

        </div>
    `;
}


/**
 * Bind modal close buttons
 *
 * This should be called once from app.js.
 */
export function bindModals() {

    if (window.__honeybadgerModalsBound) {
        return;
    }

    window.__honeybadgerModalsBound = true;


    document.addEventListener("click", event => {

        const closeButton =
            event.target.closest("[data-close]");


        if (!closeButton) {
            return;
        }


        const id =
            closeButton.dataset.close;


        if (!id) {
            return;
        }


        const modalElement =
            document.getElementById(id);


        if (modalElement) {

            modalElement.classList.remove("show");

        }

    });
}

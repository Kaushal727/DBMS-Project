const API = "/api";

const $ = selector => document.querySelector(selector);

const message = $("#message");

let vehicles = [];
let customers = [];
let rentals = [];
let payments = [];

function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = type;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function api(url, options = {}) {
    const response = await fetch(API + url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function money(value) {
    return Number(value).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
    });
}

function formatDate(value) {
    if (!value) return "-";

    const date = String(value).slice(0, 10);

    return date;
}

function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// LOAD VEHICLES
async function loadVehicles() {
    vehicles = await api("/vehicles");

    $("#vehicleList").innerHTML = vehicles.map(vehicle => `
        <div class="card">
            <h3>${escapeHTML(vehicle.brand)} ${escapeHTML(vehicle.model)}</h3>

            <p>Registration: ${escapeHTML(vehicle.registration_no)}</p>

            <p>Type: ${escapeHTML(vehicle.vehicle_type)}</p>

            <p>Daily Rate: ${money(vehicle.daily_rate)}</p>

            <p class="${
                vehicle.availability === "Available"
                    ? "available"
                    : "rented"
            }">
                ${escapeHTML(vehicle.availability)}
            </p>
        </div>
    `).join("");

    const available = vehicles.filter(
        vehicle => vehicle.availability === "Available"
    );

    $("#vehicle_id").innerHTML =
        '<option value="">Select Vehicle</option>' +
        available.map(vehicle => `
            <option value="${vehicle.vehicle_id}">
                ${escapeHTML(vehicle.brand)}
                ${escapeHTML(vehicle.model)}
                - ${money(vehicle.daily_rate)}/day
            </option>
        `).join("");

    updateCost();
}

// LOAD CUSTOMERS
async function loadCustomers() {
    customers = await api("/customers");

    $("#customer_id").innerHTML =
        '<option value="">Select Customer</option>' +
        customers.map(customer => `
            <option value="${customer.customer_id}">
                ${escapeHTML(customer.full_name)}
                - ID ${customer.customer_id}
            </option>
        `).join("");
}

// ADD VEHICLE
$("#vehicleForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    data.daily_rate = Number(data.daily_rate);

    try {
        const result = await api("/vehicles", {
            method: "POST",
            body: JSON.stringify(data)
        });

        form.reset();

        await loadVehicles();

        showMessage(result.message);
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// REGISTER CUSTOMER
$("#customerForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
        const result = await api("/customers", {
            method: "POST",
            body: JSON.stringify(data)
        });

        form.reset();

        await loadCustomers();

        showMessage(result.message);
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// CALCULATE RENTAL COST
function updateCost() {
    const vehicleId = Number($("#vehicle_id").value);

    const start = $("#rental_date").value;
    const end = $("#expected_return").value;

    const vehicle = vehicles.find(
        item => item.vehicle_id === vehicleId
    );

    if (!vehicle || !start || !end || end <= start) {
        $("#costPreview").textContent =
            "Estimated Cost: ₹0.00";
        return;
    }

    const startDate = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");

    const days = Math.round(
        (endDate - startDate) / 86400000
    );

    const total = days * Number(vehicle.daily_rate);

    $("#costPreview").textContent =
        `Estimated Cost: ${money(total)} (${days} days)`;
}

$("#vehicle_id").addEventListener("change", updateCost);
$("#rental_date").addEventListener("change", updateCost);
$("#expected_return").addEventListener("change", updateCost);

// CREATE RENTAL
$("#rentalForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    data.customer_id = Number(data.customer_id);
    data.vehicle_id = Number(data.vehicle_id);

    try {
        const result = await api("/rentals", {
            method: "POST",
            body: JSON.stringify(data)
        });

        form.reset();

        $("#rental_date").value = localDate();

        await Promise.all([
            loadVehicles(),
            loadRentals(),
            loadPayments()
        ]);

        $("#costPreview").textContent =
            "Estimated Cost: ₹0.00";

        showMessage(
            `${result.message} Rental ID: ${result.rental_id}. ` +
            `Duration: ${result.rental_days} days. ` +
            `Total: ${money(result.total_cost)}`
        );
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// LOAD RENTALS
async function loadRentals() {
    rentals = await api("/rentals");

    if (!rentals.length) {
        $("#rentalList").innerHTML = "<p>No rentals found.</p>";
        return;
    }

    $("#rentalList").innerHTML = `
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Rental Date</th>
                    <th>Expected Return</th>
                    <th>Days</th>
                    <th>Cost</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                ${rentals.map(rental => `
                    <tr>
                        <td>${rental.rental_id}</td>

                        <td>${escapeHTML(rental.full_name)}</td>

                        <td>
                            ${escapeHTML(rental.brand)}
                            ${escapeHTML(rental.model)}
                        </td>

                        <td>${formatDate(rental.rental_date)}</td>

                        <td>${formatDate(rental.expected_return)}</td>

                        <td>${rental.rental_days}</td>

                        <td>${money(rental.total_cost)}</td>

                        <td>${escapeHTML(rental.rental_status)}</td>

                        <td>
                            ${
                                rental.rental_status === "Active"
                                ? `<button type="button"
                                     data-return="${rental.rental_id}">
                                     Return
                                   </button>`
                                : "Completed"
                            }
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        </div>
    `;
}

// RETURN VEHICLE
$("#rentalList").addEventListener("click", async event => {
    const button = event.target.closest("[data-return]");

    if (!button) return;

    const rentalId = button.dataset.return;

    if (!confirm(`Confirm return for Rental #${rentalId}?`)) {
        return;
    }

    button.disabled = true;

    try {
        const result = await api(`/rentals/${rentalId}/return`, {
            method: "POST",
            body: JSON.stringify({})
        });

        await Promise.all([
            loadVehicles(),
            loadRentals()
        ]);

        showMessage(result.message);
    } catch (error) {
        button.disabled = false;
        showMessage(error.message, "error");
    }
});

// LOAD PAYMENTS
async function loadPayments() {
    payments = await api("/payments");

    if (!payments.length) {
        $("#paymentList").innerHTML = "<p>No payments found.</p>";
        return;
    }

    $("#paymentList").innerHTML = `
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>Payment ID</th>
                    <th>Rental ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Status</th>
                </tr>
            </thead>

            <tbody>
                ${payments.map(payment => `
                    <tr>
                        <td>${payment.payment_id}</td>
                        <td>${payment.rental_id}</td>
                        <td>${escapeHTML(payment.full_name)}</td>
                        <td>${money(payment.amount)}</td>
                        <td>${escapeHTML(payment.payment_date)}</td>
                        <td>${escapeHTML(payment.payment_method)}</td>
                        <td>${escapeHTML(payment.payment_status)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        </div>
    `;
}

// REFRESH BUTTONS
$("#refreshRentals").addEventListener("click", async () => {
    try {
        await loadRentals();
        showMessage("Rentals refreshed.");
    } catch (error) {
        showMessage(error.message, "error");
    }
});

$("#refreshPayments").addEventListener("click", async () => {
    try {
        await loadPayments();
        showMessage("Payments refreshed.");
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// INITIALIZE APPLICATION
async function initialize() {
    $("#rental_date").value = localDate();

    try {
        await api("/health");

        await Promise.all([
            loadVehicles(),
            loadCustomers(),
            loadRentals(),
            loadPayments()
        ]);
    } catch (error) {
        showMessage(
            "Cannot connect to the server or database. " +
            "Check your MySQL configuration and restart the server.",
            "error"
        );
    }
}

initialize();
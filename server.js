const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "CarRentalDB",
    waitForConnections: true,
    connectionLimit: 10
});

// TEST DATABASE CONNECTION
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ message: "Server and MySQL connected successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL VEHICLES
app.get("/api/vehicles", async (req, res) => {
    try {
        const [vehicles] = await pool.query(
            "SELECT * FROM Vehicles ORDER BY vehicle_id DESC"
        );

        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD A VEHICLE
app.post("/api/vehicles", async (req, res) => {
    const {
        registration_no,
        brand,
        model,
        vehicle_type,
        daily_rate
    } = req.body;

    if (
        !registration_no?.trim() ||
        !brand?.trim() ||
        !model?.trim() ||
        !vehicle_type?.trim() ||
        !Number.isFinite(Number(daily_rate)) ||
        Number(daily_rate) <= 0
    ) {
        return res.status(400).json({
            error: "Enter valid vehicle details and a positive daily rate."
        });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO Vehicles
            (registration_no, brand, model, vehicle_type, daily_rate)
            VALUES (?, ?, ?, ?, ?)`,
            [
                registration_no.trim(),
                brand.trim(),
                model.trim(),
                vehicle_type.trim(),
                Number(daily_rate)
            ]
        );

        res.status(201).json({
            message: "Vehicle added successfully",
            vehicle_id: result.insertId
        });
    } catch (error) {
        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            error: error.code === "ER_DUP_ENTRY"
                ? "Registration number already exists."
                : "Could not add vehicle."
        });
    }
});

// REGISTER A CUSTOMER
app.post("/api/customers", async (req, res) => {
    const { full_name, phone, email, license_no } = req.body;

    if (
        !full_name?.trim() ||
        !phone?.trim() ||
        !license_no?.trim()
    ) {
        return res.status(400).json({
            error: "Name, phone and license number are required."
        });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO Customers
            (full_name, phone, email, license_no)
            VALUES (?, ?, ?, ?)`,
            [
                full_name.trim(),
                phone.trim(),
                email?.trim() || null,
                license_no.trim()
            ]
        );

        res.status(201).json({
            message: "Customer registered successfully",
            customer_id: result.insertId
        });
    } catch (error) {
    console.error("Customer registration error:", error);

    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
        error: error.code === "ER_DUP_ENTRY"
            ? "This license number already exists."
            : error.message
    });
}
});

// GET ALL CUSTOMERS
app.get("/api/customers", async (req, res) => {
    try {
        const [customers] = await pool.query(
            `SELECT customer_id, full_name, phone, email, license_no
             FROM Customers
             ORDER BY customer_id DESC`
        );

        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE RENTAL
app.post("/api/rentals", async (req, res) => {
    const { customer_id, vehicle_id, rental_date, expected_return,
            payment_method } = req.body;

    const validDate = value =>
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value;

    if (
        !Number.isInteger(Number(customer_id)) ||
        !Number.isInteger(Number(vehicle_id)) ||
        !validDate(rental_date) ||
        !validDate(expected_return) ||
        expected_return <= rental_date ||
        !["Cash", "Card", "UPI"].includes(payment_method)
    ) {
        return res.status(400).json({
            error: "Enter valid customer, vehicle, dates and payment method."
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Lock the vehicle row to prevent simultaneous rentals.
        const [vehicles] = await connection.execute(
            `SELECT vehicle_id, daily_rate, availability
             FROM Vehicles
             WHERE vehicle_id = ?
             FOR UPDATE`,
            [vehicle_id]
        );

        if (!vehicles.length) {
            throw new Error("Vehicle not found.");
        }

        if (vehicles[0].availability !== "Available") {
            throw new Error("Vehicle is not available.");
        }

        const [customers] = await connection.execute(
            "SELECT customer_id FROM Customers WHERE customer_id = ?",
            [customer_id]
        );

        if (!customers.length) {
            throw new Error("Customer not found.");
        }

        const start = new Date(rental_date + "T00:00:00Z");
        const end = new Date(expected_return + "T00:00:00Z");

        const rentalDays = Math.round(
            (end - start) / (1000 * 60 * 60 * 24)
        );

        if (rentalDays <= 0) {
            throw new Error("Return date must be after rental date.");
        }

        const dailyRate = Number(vehicles[0].daily_rate);
        const totalCost = Number((dailyRate * rentalDays).toFixed(2));

        const [rental] = await connection.execute(
            `INSERT INTO Rentals
            (customer_id, vehicle_id, rental_date, expected_return,
             rental_days, total_cost, rental_status)
             VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
            [
                customer_id,
                vehicle_id,
                rental_date,
                expected_return,
                rentalDays,
                totalCost
            ]
        );

        await connection.execute(
            `UPDATE Vehicles
             SET availability = 'Rented'
             WHERE vehicle_id = ?`,
            [vehicle_id]
        );

        await connection.execute(
            `INSERT INTO Payments
            (rental_id, amount, payment_method, payment_status)
            VALUES (?, ?, ?, 'Paid')`,
            [rental.insertId, totalCost, payment_method]
        );

        await connection.commit();

        res.status(201).json({
            message: "Vehicle rented successfully",
            rental_id: rental.insertId,
            rental_days: rentalDays,
            daily_rate: dailyRate,
            total_cost: totalCost
        });
    } catch (error) {
        await connection.rollback();

        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// GET ALL RENTALS
app.get("/api/rentals", async (req, res) => {
    try {
        const [rentals] = await pool.query(`
            SELECT
                r.rental_id,
                c.full_name,
                v.brand,
                v.model,
                r.rental_date,
                r.expected_return,
                r.actual_return,
                r.rental_days,
                r.total_cost,
                r.rental_status
            FROM Rentals r
            JOIN Customers c ON r.customer_id = c.customer_id
            JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
            ORDER BY r.rental_id DESC
        `);

        res.json(rentals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RECORD A VEHICLE RETURN
app.post("/api/rentals/:id/return", async (req, res) => {
    const rentalId = Number(req.params.id);

    if (!Number.isInteger(rentalId) || rentalId <= 0) {
        return res.status(400).json({ error: "Invalid rental ID." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [rentals] = await connection.execute(
            `SELECT rental_id, vehicle_id, rental_status
             FROM Rentals
             WHERE rental_id = ?
             FOR UPDATE`,
            [rentalId]
        );

        if (!rentals.length) {
            throw new Error("Rental not found.");
        }

        const rental = rentals[0];

        if (rental.rental_status === "Returned") {
            throw new Error("This vehicle has already been returned.");
        }

        await connection.execute(
            `UPDATE Rentals
             SET actual_return = CURRENT_DATE(),
                 rental_status = 'Returned'
             WHERE rental_id = ?`,
            [rentalId]
        );

        await connection.execute(
            `UPDATE Vehicles
             SET availability = 'Available'
             WHERE vehicle_id = ?`,
            [rental.vehicle_id]
        );

        await connection.commit();

        res.json({ message: "Vehicle returned successfully." });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// GET PAYMENTS
app.get("/api/payments", async (req, res) => {
    try {
        const [payments] = await pool.query(`
            SELECT
                p.payment_id,
                p.rental_id,
                c.full_name,
                p.amount,
                p.payment_date,
                p.payment_method,
                p.payment_status
            FROM Payments p
            JOIN Rentals r ON p.rental_id = r.rental_id
            JOIN Customers c ON r.customer_id = c.customer_id
            ORDER BY p.payment_id DESC
        `);

        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Car Rental System running at http://localhost:${PORT}`);
});
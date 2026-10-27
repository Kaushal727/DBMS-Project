CREATE DATABASE IF NOT EXISTS CarRentalDB;

USE CarRentalDB;

-- VEHICLES TABLE
CREATE TABLE IF NOT EXISTS Vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    registration_no VARCHAR(20) UNIQUE NOT NULL,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(30) NOT NULL,
    daily_rate DECIMAL(10,2) NOT NULL,
    availability ENUM('Available', 'Rented')
        NOT NULL DEFAULT 'Available'
);

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    license_no VARCHAR(50) NOT NULL UNIQUE
);

-- RENTALS TABLE
CREATE TABLE IF NOT EXISTS Rentals (
    rental_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    rental_date DATE NOT NULL,
    expected_return DATE NOT NULL,
    actual_return DATE DEFAULT NULL,
    rental_days INT NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    rental_status ENUM('Active', 'Returned')
        NOT NULL DEFAULT 'Active',

    FOREIGN KEY (customer_id)
        REFERENCES Customers(customer_id),

    FOREIGN KEY (vehicle_id)
        REFERENCES Vehicles(vehicle_id),

    CHECK (rental_days > 0),
    CHECK (total_cost >= 0),
    CHECK (expected_return >= rental_date)
);

-- PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method ENUM('Cash', 'Card', 'UPI')
        NOT NULL DEFAULT 'Cash',
    payment_status ENUM('Paid', 'Pending')
        NOT NULL DEFAULT 'Paid',

    FOREIGN KEY (rental_id)
        REFERENCES Rentals(rental_id),

    CHECK (amount >= 0)
);

-- SAMPLE VEHICLES
INSERT IGNORE INTO Vehicles
(registration_no, brand, model, vehicle_type, daily_rate)
VALUES
('GJ01AB1234', 'Maruti Suzuki', 'Swift', 'Hatchback', 1500.00),
('GJ01CD5678', 'Hyundai', 'Creta', 'SUV', 2500.00),
('GJ01EF9012', 'Tata', 'Nexon', 'SUV', 2200.00),
('GJ01GH3456', 'Honda', 'City', 'Sedan', 2000.00),
('GJ01IJ7890', 'Toyota', 'Innova', 'MUV', 3000.00);

-- CHECK VEHICLES
SELECT * FROM Vehicles;

-- CHECK CUSTOMERS
SELECT * FROM Customers;

-- CHECK RENTALS
SELECT * FROM Rentals;

-- CHECK PAYMENTS
SELECT * FROM Payments;
SHOW DATABASES;
USE CarRentalDB;

SHOW TABLES;
SELECT * FROM Vehicles;
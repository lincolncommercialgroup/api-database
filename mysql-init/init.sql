CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INT NOT NULL,  -- duration in minutes
    price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

INSERT INTO bookings (user_id, service_id, booking_date, start_time, end_time, status)
   VALUES (1, 1, '2024-10-15', '14:00:00', '15:00:00', 'pending');

   -- Verify the insertion
   SELECT * FROM bookings;
   
   INSERT INTO availability (day_of_week, start_time, end_time)
   VALUES 
   ('Monday', '09:00:00', '17:00:00'),
   ('Tuesday', '09:00:00', '17:00:00'),
   ('Wednesday', '09:00:00', '17:00:00'),
   ('Thursday', '09:00:00', '17:00:00'),
   ('Friday', '09:00:00', '17:00:00');

   -- Verify the insertion
   SELECT * FROM availability;
   
   -- Check if the duration column exists, if not, add it
SET @exist := (SELECT COUNT(*) 
               FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'services' 
               AND COLUMN_NAME = 'duration');

SET @sqlstmt := IF(@exist = 0,
    'ALTER TABLE services ADD COLUMN duration INT NOT NULL COMMENT "Duration in minutes"',
    'SELECT "Duration column already exists" AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if the buffer_time column exists, if not, add it
SET @exist := (SELECT COUNT(*) 
               FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'services' 
               AND COLUMN_NAME = 'buffer_time');

SET @sqlstmt := IF(@exist = 0,
    'ALTER TABLE services ADD COLUMN buffer_time INT NOT NULL DEFAULT 0 COMMENT "Buffer time between bookings in minutes"',
    'SELECT "Buffer_time column already exists" AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create the service_availability table if it doesn't exist
CREATE TABLE IF NOT EXISTS service_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Insert sample data (only if the tables are empty)
INSERT INTO services (name, description, duration, buffer_time, price)
SELECT * FROM (SELECT 'Haircut' as name, 'Standard haircut service' as description, 30 as duration, 5 as buffer_time, 25.00 as price) AS tmp
WHERE NOT EXISTS (
    SELECT name FROM services WHERE name = 'Haircut'
) LIMIT 1;

INSERT INTO services (name, description, duration, buffer_time, price)
SELECT * FROM (SELECT 'Massage' as name, '60-minute full body massage' as description, 60 as duration, 10 as buffer_time, 80.00 as price) AS tmp
WHERE NOT EXISTS (
    SELECT name FROM services WHERE name = 'Massage'
) LIMIT 1;

-- Insert availability data (only if the table is empty)
INSERT INTO service_availability (service_id, day_of_week, start_time, end_time)
SELECT s.id, 'Monday', '09:00:00', '17:00:00'
FROM services s
WHERE s.name = 'Haircut'
  AND NOT EXISTS (
    SELECT 1 FROM service_availability sa
    WHERE sa.service_id = s.id AND sa.day_of_week = 'Monday'
  );

INSERT INTO service_availability (service_id, day_of_week, start_time, end_time)
SELECT s.id, 'Tuesday', '09:00:00', '17:00:00'
FROM services s
WHERE s.name = 'Haircut'
  AND NOT EXISTS (
    SELECT 1 FROM service_availability sa
    WHERE sa.service_id = s.id AND sa.day_of_week = 'Tuesday'
  );

-- Repeat for other days and services as needed

-- Verify the data
SELECT * FROM services;
SELECT * FROM service_availability;
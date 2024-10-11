const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Middleware to parse JSON bodies
app.use(express.json());

// Create a new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { user_id, service_id, booking_date, start_time, end_time } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO bookings (user_id, service_id, booking_date, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [user_id, service_id, booking_date, start_time, end_time]
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Booking created successfully' });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM bookings');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available time slots for a specific date and service
app.get('/api/availability/:date/:serviceId', async (req, res) => {
  try {
    const { date, serviceId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    // Get service details
    const [serviceRows] = await connection.execute(
      'SELECT * FROM services WHERE id = ?',
      [serviceId]
    );
    const service = serviceRows[0];

    // Get service availability
    const [availabilityRows] = await connection.execute(
      'SELECT * FROM service_availability WHERE service_id = ? AND day_of_week = DAYNAME(?)',
      [serviceId, date]
    );
    
    // Get existing bookings for the date
    const [bookingsRows] = await connection.execute(
      'SELECT start_time, end_time FROM bookings WHERE service_id = ? AND booking_date = ?',
      [serviceId, date]
    );

    await connection.end();

    const availableSlots = calculateAvailableSlots(service, availabilityRows[0], bookingsRows);
    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM services');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function calculateAvailableSlots(service, availability, bookings) {
  if (!availability) {
    return [];
  }

  const { start_time, end_time } = availability;
  const { duration, buffer_time } = service;
  const totalSlotDuration = duration + buffer_time;

  const startTime = new Date(`1970-01-01T${start_time}`);
  const endTime = new Date(`1970-01-01T${end_time}`);

  const availableSlots = [];
  let currentSlot = new Date(startTime);

  while (currentSlot.getTime() + duration * 60000 <= endTime.getTime()) {
    const slotEndTime = new Date(currentSlot.getTime() + duration * 60000);
    const isAvailable = !bookings.some(booking => {
      const bookingStart = new Date(`1970-01-01T${booking.start_time}`);
      const bookingEnd = new Date(`1970-01-01T${booking.end_time}`);
      return (
        (currentSlot >= bookingStart && currentSlot < bookingEnd) ||
        (slotEndTime > bookingStart && slotEndTime <= bookingEnd)
      );
    });

    if (isAvailable) {
      availableSlots.push(currentSlot.toTimeString().slice(0, 5));
    }

    currentSlot = new Date(currentSlot.getTime() + totalSlotDuration * 60000);
  }

  return availableSlots;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
const express = require('express');
const mysql = require('mysql2/promise');
const Joi = require('joi');

const app = express();
const port = process.env.PORT || 3000;

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lincoln_db',
};

// Middleware to parse JSON bodies
app.use(express.json());

// Validation schemas
const bookingSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  service_id: Joi.number().integer().positive().required(),
  booking_date: Joi.date().iso().required(),
  start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required()
});

// Middleware for input validation
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

// Create a new booking
app.post('/api/bookings', validateInput(bookingSchema), async (req, res) => {
  try {
    const { user_id, service_id, booking_date, start_time, end_time } = req.body;
    
    const connection = await mysql.createConnection(dbConfig);

    // Check for overlapping bookings
    const [overlappingBookings] = await connection.execute(
      'SELECT * FROM bookings WHERE service_id = ? AND booking_date = ? AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))',
      [service_id, booking_date, end_time, start_time, end_time, start_time, start_time, end_time]
    );

    if (overlappingBookings.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'This time slot overlaps with an existing booking' });
    }

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
    console.log('Availability request received:', req.params);
    const { date, serviceId } = req.params;
    
    // Validate input
    const schema = Joi.object({
      date: Joi.date().iso().required(),
      serviceId: Joi.number().integer().positive().required()
    });
    const { error } = schema.validate({ date, serviceId });
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    console.log('Connecting to database...');
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('Fetching service details...');
    // Get service details
    const [serviceRows] = await connection.execute('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (serviceRows.length === 0) {
      console.log('Service not found');
      await connection.end();
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRows[0];

    console.log('Fetching existing bookings...');
    // Get existing bookings for the date
    const [bookingsRows] = await connection.execute(
      'SELECT start_time, end_time FROM bookings WHERE service_id = ? AND booking_date = ?',
      [serviceId, date]
    );

    console.log('Fetching service availability...');
    // Get service availability
    const [availabilityRows] = await connection.execute(
      'SELECT * FROM service_availability WHERE service_id = ? AND day_of_week = DAYNAME(?)',
      [serviceId, date]
    );

    await connection.end();

    console.log('Calculating available slots...');
    // Calculate available slots
    const availableSlots = calculateAvailableSlots(service, availabilityRows[0], bookingsRows, date);
    console.log('Available slots:', availableSlots);
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

function calculateAvailableSlots(service, availability, bookings, date) {
  console.log('Calculating slots for:', { service, availability, bookings, date });

  if (!availability) {
    console.log('No availability found for this date');
    return [];
  }

  // Check if the date is a holiday (e.g., Christmas)
  const holidayDates = ['2023-12-25', '2024-12-25']; // Add more holiday dates as needed
  if (holidayDates.includes(date)) {
    console.log('Date is a holiday');
    return [];
  }

  const { start_time, end_time } = availability;
  const { duration, buffer_time } = service;
  const totalSlotDuration = duration + buffer_time;

  const startTime = new Date(`1970-01-01T${start_time}`);
  const endTime = new Date(`1970-01-01T${end_time}`);

  console.log('Service hours:', { startTime: startTime.toTimeString(), endTime: endTime.toTimeString(), duration, buffer_time });

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

  console.log('Calculated available slots:', availableSlots);

  return availableSlots;
}

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = { app, server };
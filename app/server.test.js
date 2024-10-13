const request = require('supertest');
const mysql = require('mysql2/promise');
const { app, server } = require('./server');

// Increase the timeout for all tests
jest.setTimeout(30000);

// Database configuration for tests
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lincoln_db',
};

// Function to clear the database and reset auto-increment
async function resetDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute('DELETE FROM bookings');
  await connection.execute('DELETE FROM service_availability');
  await connection.execute('DELETE FROM services');
  await connection.execute('ALTER TABLE services AUTO_INCREMENT = 1');
  await connection.execute('ALTER TABLE service_availability AUTO_INCREMENT = 1');
  await connection.execute('ALTER TABLE bookings AUTO_INCREMENT = 1');
  await connection.end();
}

// Clear database before each test
beforeEach(async () => {
  await resetDatabase();
});

// Close the server and database connection after all tests
afterAll(done => {
  server.close(async () => {
    const connection = await mysql.createConnection(dbConfig);
    await connection.end();
    done();
  });
});

describe('API Endpoints', () => {
  it('POST /api/bookings - valid input', async () => {
    // First, create a service
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO services (name, description, duration, buffer_time, price) VALUES (?, ?, ?, ?, ?)',
      ['Test Service', 'Test Description', 60, 15, 100.00]
    );
    await connection.end();

    const res = await request(app)
      .post('/api/bookings')
      .send({
        user_id: 1,
        service_id: 1,
        booking_date: '2023-10-15',
        start_time: '14:00:00',
        end_time: '15:00:00'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message', 'Booking created successfully');
  });

  it('POST /api/bookings - invalid input', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        user_id: 'invalid',
        service_id: 1,
        booking_date: '2023-10-15',
        start_time: '14:00:00',
        end_time: '15:00:00'
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/bookings', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  it('GET /api/availability/:date/:serviceId - valid input', async () => {
    // First, ensure we have a service and availability data
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO services (name, description, duration, buffer_time, price) VALUES (?, ?, ?, ?, ?)',
      ['Test Service', 'Test Description', 60, 15, 100.00]
    );
    await connection.execute(
      'INSERT INTO service_availability (service_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
      [1, 'Sunday', '09:00:00', '17:00:00']
    );
    await connection.end();

    const res = await request(app).get('/api/availability/2023-10-15/1'); // Note: 2023-10-15 is a Sunday
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    console.log('Available slots:', res.body);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatch(/^\d{2}:\d{2}$/); // Check if the time format is correct
  });

  it('GET /api/availability/:date/:serviceId - invalid input', async () => {
    const res = await request(app).get('/api/availability/invalid-date/abc');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/services', async () => {
    const res = await request(app).get('/api/services');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  it('GET /api/bookings - empty result', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/bookings - overlapping booking', async () => {
    // First, create a service
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO services (name, description, duration, buffer_time, price) VALUES (?, ?, ?, ?, ?)',
      ['Test Service', 'Test Description', 60, 15, 100.00]
    );
    await connection.end();

    // Create a booking
    await request(app)
      .post('/api/bookings')
      .send({
        user_id: 1,
        service_id: 1,
        booking_date: '2023-10-16',
        start_time: '10:00:00',
        end_time: '11:00:00'
      });

    // Try to create an overlapping booking
    const res = await request(app)
      .post('/api/bookings')
      .send({
        user_id: 2,
        service_id: 1,
        booking_date: '2023-10-16',
        start_time: '10:30:00',
        end_time: '11:30:00'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('overlaps');
  });

  it('GET /api/availability/:date/:serviceId - no availability on holiday', async () => {
    // First, create a service and availability
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO services (name, description, duration, buffer_time, price) VALUES (?, ?, ?, ?, ?)',
      ['Test Service', 'Test Description', 60, 15, 100.00]
    );
    await connection.execute(
      'INSERT INTO service_availability (service_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
      [1, 'Monday', '09:00:00', '17:00:00']
    );
    await connection.end();

    const res = await request(app).get('/api/availability/2023-12-25/1'); // Christmas
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });
});
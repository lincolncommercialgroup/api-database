const request = require('supertest');
const { app, server } = require('./server');

// Increase the timeout for all tests
jest.setTimeout(30000);

// Close the server after all tests
afterAll(done => {
  server.close(done);
});

describe('API Endpoints', () => {
  it('POST /api/bookings - valid input', async () => {
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
    const res = await request(app).get('/api/availability/2023-10-15/1');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    // Add more specific expectations based on your implementation
    // For example:
    // expect(res.body.length).toBeGreaterThan(0);
    // expect(res.body[0]).toMatch(/^\d{2}:\d{2}$/); // Check if the time format is correct
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

  // Additional tests you might want to add:

  it('GET /api/bookings - empty result', async () => {
    // You might need to clear the database before this test
    const res = await request(app).get('/api/bookings');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/bookings - overlapping booking', async () => {
    // First, create a booking
    await request(app)
      .post('/api/bookings')
      .send({
        user_id: 1,
        service_id: 1,
        booking_date: '2023-10-16',
        start_time: '10:00:00',
        end_time: '11:00:00'
      });

    // Then, try to create an overlapping booking
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
    expect(res.body.error).toContain('overlapping');
  });

  it('GET /api/availability/:date/:serviceId - no availability', async () => {
    // You might need to set up a scenario where there's no availability
    const res = await request(app).get('/api/availability/2023-12-25/1'); // Assuming no availability on Christmas
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });
});
const { test, describe, before, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let app;
let currentUserId = 1;

beforeEach(async () => {
  await prisma.urlShortener.deleteMany({});
  await prisma.user.deleteMany({});

  await prisma.user.create({
    data: { id: 1, email: 'enterprise@gmail.com', api_key: 'KEY123', tier: 'enterprise' }
  });
  currentUserId = 1
});

before(() => {
  const express = require('express');
  const originalApp = require('./server');

  app = express();

  app.use((req, res, next) => {
    req.user = { id: currentUserId };
    next();
  });

  app.use(originalApp);
});

afterEach(async () => {
  await prisma.urlShortener.deleteMany({});
});

describe('URL Shortener Integration Test', () => {
  test("should not allow creating a code if url is not provided", async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: '' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'URL is required');
  });

  test('should shorten and redirect correctly', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const redirectRes = await request(app)
      .get(`/redirect?code=${shortCode}`)
      .set('x-api-key', 'KEY123')
      .redirects(0);

    assert.strictEqual(redirectRes.status, 302);
    assert.strictEqual(redirectRes.headers.location, 'https://example.com');
  });

  test('should set the expiry date for the code', async () => {
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com', expiryDate: expiredDate});

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);
    const newCreatedRecord = await prisma.urlShortener.findUnique({
      where: { short_code: res.body.short_code },
    });
    assert.deepStrictEqual(newCreatedRecord.expiry_date, new Date(expiredDate))
  });

  test('should return error if the the user is trying to create custom code but its already present', async () => {
    const oldRes = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com'});

    assert.strictEqual(oldRes.status, 200);
    assert.ok(oldRes.body.short_code);

   const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example-two.com', customCode: oldRes.body.short_code});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Code already exists.')

  });

  test('should create using the custom code', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com',  customCode: 'awesome-article'});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.short_code, 'awesome-article');
  });

  test('should return not found if that code is not present', async () => {
    const randomCode = 'abcdef'

    const redirectRes = await request(app)
      .get(`/redirect?code=${randomCode}`)
      .set('x-api-key', 'KEY123')
      .redirects(0);

    assert.strictEqual(redirectRes.status, 404);
    assert.strictEqual(redirectRes.text, 'Not found')
  });

  test('should return not found if that the code is expired', async () => {
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com', expiryDate: expiredDate});

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const redirectRes = await request(app)
      .get(`/redirect?code=${shortCode}`)
      .set('x-api-key', 'KEY123')
      .redirects(0);

    assert.strictEqual(redirectRes.status, 404);
    assert.strictEqual(redirectRes.text, 'Not found')
  });

  test('should delete a short code', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const deleteRes = await request(app).delete(`/shorten/${shortCode}`).set('x-api-key', 'KEY123');

    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.message, 'Short code deleted successfully');
    assert.strictEqual(deleteRes.body.short_code, shortCode);

    const recordAfterDelete = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode },
    });
    assert.ok(recordAfterDelete, 'Record should exist after soft delete');
      assert.ok(recordAfterDelete.deleted_at instanceof Date);

  });

  test('should return analytics with latest 10 shortened URLs', async () => {
    const url1 = `https://example-one.com`;
    const url2 = `https://example-two.com`;

    const res1 = await request(app).post('/shorten').set('x-api-key', 'KEY123').send({ url: url1 });

    const res2 = await request(app).post('/shorten').set('x-api-key', 'KEY123').send({ url: url2 });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const analyticsRes = await request(app).get('/analytics').set('x-api-key', 'KEY123');
    const records = analyticsRes.body.records;

    assert.strictEqual(analyticsRes.status, 200);
    assert.ok(records.length, 'records should be an array');

    const urlsReturned = records.map(r => r.original_url);
    assert.ok(urlsReturned.includes(url1));
    assert.ok(urlsReturned.includes(url2));
  });

  test('should fail for all if any URL is missing in batch creation', async () => {
    const res = await request(app)
      .post('/shorten/batch')
      .set('x-api-key', 'KEY123')
      .send({
        urls: [
          'https://example1.com',
          '' 
        ]
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'URL is required for every entry');

    const count = await prisma.urlShortener.count();
    assert.strictEqual(count, 0);
  });

  test('should shorten multiple URLs in one batch request', async () => {
    const res = await request(app)
      .post('/shorten/batch')
      .set('x-api-key', 'KEY123')
      .send({
        urls: [
          'https://example1.com',
          'https://example2.com'
        ]
      });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.urls));
    assert.strictEqual(res.body.urls.length, 2);

    const records = await prisma.urlShortener.findMany({ where: { user_id: 1 } });
    assert.strictEqual(records.length, 2);
  });

  test('should forbid bulk creation for hobby users', async () => {
    const user = await prisma.user.create({
      data: { email: 'hobby@gamil.com', api_key: 'KEY231', tier: 'hobby' }
    });
    currentUserId = 2
    
    app.use((req, res, next) => {
      req.user = { id: user.id }; 
      next();
    });

    const res = await request(app)
      .post('/shorten/batch')
      .set('x-api-key', 'KEY231')
      .send({ urls: ['https://a.com', 'https://b.com'] });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Bulk creation not allowed.');

    const count = await prisma.urlShortener.count();
    assert.strictEqual(count, 0);
  });

  test('should allow editing of the expiry date', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example.com', expiryDate:  new Date(Date.now()).toISOString() });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const prevRecord = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode},
    });

    const updateRes = await request(app)
      .put(`/shorten/${shortCode}`)
      .set('x-api-key', 'KEY123')
      .send({expiryDate: new Date(Date.now() - 60 * 60 * 1000).toISOString()});

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.message, 'Short code updated successfully');
    assert.strictEqual(updateRes.body.short_code, shortCode);

    const updatedRecord = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode},
    });

    assert.strictEqual(updatedRecord.short_code, prevRecord.short_code);
    assert.notStrictEqual(updatedRecord.expiry_date, prevRecord.expiry_date)
  })

  test('should allow creating a short code with a password', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({
        url: 'https://secured.com',
        password: 'mypassword123'
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.short_code);

      const record = await prisma.urlShortener.findUnique({
        where: { short_code: res.body.short_code }
      });

      assert.strictEqual(record.password, 'mypassword123');
  });

  test('should allow updating the password', async () => {
    const createRes = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example-protected.com' });

    assert.strictEqual(createRes.status, 200);
    const shortCode = createRes.body.short_code;

    const prevRecord = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode },
    });

    assert.strictEqual(prevRecord.password, null);

    const updateRes = await request(app)
      .put(`/shorten/${shortCode}`)
      .set('x-api-key', 'KEY123')
      .send({ password: 'new-password', expiryDate:  new Date(Date.now()).toISOString() });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.message, 'Short code updated successfully');

    const updatedRecord = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode },
    });

    assert.strictEqual(updatedRecord.password, 'new-password');
  });


  test('should not allow redirect when password is required but not provided', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({
        url: 'https://locked.com',
        password: '"incorrect-password'
      });

    const shortCode = res.body.short_code;
    assert.ok(shortCode);

    const redirectRes = await request(app)
      .get(`/redirect?code=${shortCode}`)
      .set('x-api-key', 'KEY123')
      .redirects(0);

    assert.strictEqual(redirectRes.status, 403);
    assert.strictEqual(redirectRes.text, 'Password required or incorrect');
  });

  test('should allow redirect when correct password is provided', async () => {
    const res = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({
        url: 'https://secret-url.com',
        password: 'open-sesame'
      });

    const shortCode = res.body.short_code;
    assert.ok(shortCode);

    const redirectRes = await request(app)
      .get(`/redirect?code=${shortCode}&password=open-sesame`)
      .set('x-api-key', 'KEY123')
      .redirects(0);

    assert.strictEqual(redirectRes.status, 302);
    assert.strictEqual(redirectRes.headers.location, 'https://secret-url.com');
  });

  test('should list all URLs of the user', async () => {
    const res1 = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example-one.com' });

    const res2 = await request(app)
      .post('/shorten')
      .set('x-api-key', 'KEY123')
      .send({ url: 'https://example-two.com' });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    await request(app)
      .delete(`/shorten/${res1.body.short_code}`)
      .set('x-api-key', 'KEY123');

    const listRes = await request(app)
      .get('/list')
      .set('x-api-key', 'KEY123');

    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.urls));

    const urls = listRes.body.urls.map(item => item.original_url);

    assert.ok(urls.includes('https://example-two.com')); 
    assert.ok(!urls.includes('https://example-one.com')); 
  });

  test('should block requests with a blacklisted API key', async () => {
    const configPath = path.join(__dirname, 'config', 'blacklist.json');
    fs.writeFileSync(configPath, JSON.stringify({ blockedKeys: ['KEY321'] }));

    const res = await request(app)
      .get('/health')
      .set('x-api-key', 'KEY321');

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'This API key is blacklisted.');
  });

  test('should include X-Response-Time header in the response', async () => {
    const res = await request(app)
      .get('/health')
      .set('x-api-key', 'KEY123');

    assert.ok(res.headers['x-response-time'], 'X-Response-Time header is missing');
    assert.match(res.headers['x-response-time'], /^\d+ms$/, 'Invalid X-Response-Time format');
    const time = parseInt(res.headers['x-response-time'].replace('ms', ''), 10);
    assert.ok(time >= 0, 'X-Response-Time should be non-negative');
  });


});


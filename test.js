const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('./server');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('URL Shortener Integration Test', () => {
  test("should not allow creating a code if url is not provided", async () => {
    const res = await request(app).post('/shorten').send({url: ''})
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'URL is required');
  });

  test('should shorten and redirect correctly', async () => {
    const res = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const redirectRes = await request(app)
      .get(`/redirect?code=${shortCode}`)
      .redirects(0);

    assert.strictEqual(redirectRes.status, 302);
    assert.strictEqual(redirectRes.headers.location, 'https://example.com');
  });

  test('should return not found if that code is not present', async () => {
    const randomCode = 'abcdef'

    const redirectRes = await request(app)
      .get(`/redirect?code=${randomCode}`)
      .redirects(0);

    assert.strictEqual(redirectRes.status, 404);
    assert.strictEqual(redirectRes.text, 'Not found')
  });

  test('should delete a short code', async () => {
    const res = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.short_code);

    const shortCode = res.body.short_code;

    const deleteRes =  await request(app).delete('/shorten/' + shortCode) 
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.message, 'Short code deleted successfully');
    assert.strictEqual(deleteRes.body.short_code, shortCode);

    const recordAfterDelete = await prisma.urlShortener.findUnique({
      where: { short_code: shortCode },
    });
    assert.strictEqual(recordAfterDelete, null, 'Record should be null after deletion');
  });

  test('should return analytics with latest 10 shortened URLs', async () => {
    const url1 = `https://example-one.com`;
    const url2 = `https://example-two.com`;

    const res1 = await request(app).post('/shorten').send({ url: url1 });
    const res2 = await request(app).post('/shorten').send({ url: url2 });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const analyticsRes = await request(app).get('/analytics');
    const records = analyticsRes.body.records;

    assert.strictEqual(analyticsRes.status, 200);
    assert.ok(records.length, 'records should be an array');

    const urlsReturned = records.map(r => r.original_url);
    assert.ok(urlsReturned.includes(url1));
    assert.ok(urlsReturned.includes(url2));
  });

});


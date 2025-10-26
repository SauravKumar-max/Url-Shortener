const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('./server');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('URL Shortener Integration Test', () => {
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

  test('should return same short code for duplicate URLs', async () => {
    const randomUrl = `https://example-${Math.random().toString(36).substring(7)}.com`;

    const firstRes = await request(app)
      .post('/shorten')
      .send({ url: randomUrl });

    assert.strictEqual(firstRes.status, 200);
    assert.ok(firstRes.body.short_code);
    const firstShortCode = firstRes.body.short_code;

    const secondRes = await request(app)
      .post('/shorten')
      .send({ url: randomUrl });

    assert.strictEqual(secondRes.status, 200);
    assert.ok(secondRes.body.short_code);
    const secondShortCode = secondRes.body.short_code;

    assert.strictEqual(firstShortCode, secondShortCode);

    const redirectRes = await request(app)
      .get(`/redirect?code=${firstShortCode}`)
      .redirects(0);

    assert.strictEqual(redirectRes.status, 302);
    assert.strictEqual(redirectRes.headers.location, randomUrl);
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
});


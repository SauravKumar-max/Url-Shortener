const express = require('express');
const { PrismaClient } = require('@prisma/client');
const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to URL Shortener' });
});

app.get('/analytics', async (req, res) => {
  try {
    const records = await prisma.urlShortener.findMany({orderBy: { created_at: 'desc' }, take: 10})
    return res.json({ records });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error');
  }
});

app.post('/shorten', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const presentUrl = await prisma.urlShortener.findFirst({ where: {original_url: url} })
    if(presentUrl){
      return res.json({ short_code: presentUrl.short_code });
    }

    const code = Math.random().toString(36).substring(2, 8);
    const newRecord = await prisma.urlShortener.create({
      data: { original_url: url, short_code: code},
    });
    return res.json({ short_code: newRecord.short_code });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to shorten URL' });
  }
});

app.get('/redirect', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Code is required');
  try {
    const record = await prisma.urlShortener.findUnique({ where: { short_code: code } });
    if (!record) return res.status(404).send('Not found');
    await prisma.urlShortener.update({where: {short_code: code}, data: {
      visit_count: { increment: 1 },
      last_accessed_at: new Date()
    }})
    return res.redirect(record.original_url);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

app.delete('/shorten/:code', async (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).json({ error: 'Short code is required' });
  }
  try {
   const record = await prisma.urlShortener.findUnique({
      where: { short_code: code },
    });

     if (!record) {
      return res.status(404).json({ error: 'Short code not found' });
    }

    await prisma.urlShortener.delete({
      where: { short_code: code },
    });

    return res.json({ 
      message: 'Short code deleted successfully',
      short_code: code 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

if (require.main === module) {
  app.listen(7070, () => console.log('Server - http://localhost:7070'));
}

module.exports = app;

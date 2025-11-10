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
    const records = await prisma.urlShortener.findMany({where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 10})
    return res.json({ records });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error');
  }
});

app.post('/shorten', async (req, res) => {
  const { url, expiryDate, customCode, password } = req.body;
  const user = req.user;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    if (customCode) {
      const existingCode = await prisma.urlShortener.findFirst({where: { short_code: customCode }});
      if (existingCode) {
        return res.status(400).json({ error: 'Code already exists.' });
      }
    }

    const code = customCode || Math.random().toString(36).substring(2, 8);
    const newRecord = await prisma.urlShortener.create({
      data: { original_url: url, short_code: code, user_id: user.id, expiry_date: expiryDate ? new Date(expiryDate) : null, password: password || null }
    });

    return res.json({ short_code: newRecord.short_code });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to shorten URL' });
  }
});


app.post('/shorten/batch', async (req, res) => {
  const { urls } = req.body;
  const user = req.user;

  const users = await prisma.user.findUnique({ where: { id: user.id } });
  if (!users || users.tier !== 'enterprise') {
    return res.status(403).json({ error: 'Bulk creation not allowed.' });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs are required' });
  }

  try {
    for (const url of urls) {
      if (!url) {
        return res.status(400).json({ error: 'URL is required for every entry' });
      }
    }

    const created = await Promise.all(
      urls.map(url => {
        const code = Math.random().toString(36).substring(2, 8);
        return prisma.urlShortener.create({
          data: { original_url: url, short_code: code, user_id: user.id }
        });
      })
    );

    const newUrls = created.map(record => ({
      url: record.original_url,
      short_code: record.short_code
    }));

    return res.json({ urls: newUrls });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to shorten URLs' });
  }
});


app.get('/redirect', async (req, res) => {
  const { code, password } = req.query;
  if (!code) return res.status(400).send('Code is required');
  try {
    const record = await prisma.urlShortener.findUnique({ where: { short_code: code } });
    if (!record || record.deleted_at || (record.expiry_date && record.expiry_date < new Date())) return res.status(404).send('Not found');

    if (record.password && record.password !== password) {
      return res.status(403).send('Password required or incorrect');
    }

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
  const user = req.user;
  if (!code) {
    return res.status(400).json({ error: 'Short code is required' });
  }
  try {
   const record = await prisma.urlShortener.findUnique({
      where: { short_code: code },
    });

     if (!record || record.deleted_at) {
      return res.status(404).json({ error: 'Short code not found' });
    }
    
    if (record.user_id !== user.id) {
      return res.status(403).json({ error: 'Not allowed to delete this short code' });
    }

    await prisma.urlShortener.update({where: {short_code: code}, data: {
      deleted_at: new Date()
    }})

    return res.json({ 
      message: 'Short code deleted successfully',
      short_code: code 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/shorten/:code', async (req, res) => {
  const { code } = req.params;
  const { expiryDate, password } = req.body;
  const user = req.user;

  if (!code) {
    return res.status(400).json({ error: 'Short code is required' });
  }

  if(!expiryDate){
    return res.status(400).json({ error: 'Expiry date is required' });
  }

  try {
   const record = await prisma.urlShortener.findUnique({
      where: { short_code: code },
    });

     if (!record || record.deleted_at) {
      return res.status(404).json({ error: 'Short code not found' });
    }
    
    if (record.user_id !== user.id) {
      return res.status(403).json({ error: 'Not allowed to update this short code' });
    }

    await prisma.urlShortener.update({where: {short_code: code}, data: {
      expiry_date: new Date(expiryDate),
      password: password || record.password
    }})

    return res.json({ 
      message: 'Short code updated successfully',
      short_code: code 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update' });
  }
});

app.get('/list', async (req, res) => {
  const user = req.user;

  try {
    const records = await prisma.urlShortener.findMany({where: { user_id: user.id, deleted_at: null }})
    res.json({ urls: records })
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load the list' });
  }
})

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', server: 'running', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({ status: 'error', server: 'running', database: 'disconnected' });
  }
});

if (require.main === module) {
  app.listen(7070, () => console.log('Server - http://localhost:7070'));
}

module.exports = app;

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS configuration
app.use(cors());
app.use(express.json());

// ===============================
// OPTIMASI #1: Connection Pooling & Singleton Pattern
// ===============================
let cachedConnection = null;
let isConnecting = false;

const connectionOptions = {
  serverSelectionTimeoutMS: 8000, // Naik dari 5000 ke 8000ms
  socketTimeoutMS: 45000,
  maxPoolSize: 10, // Connection pooling
  minPoolSize: 2,
  retryWrites: true,
  w: 'majority'
};

async function connectToDatabase() {
  // Jika sudah terkoneksi, gunakan cache
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // Jika sedang proses connecting, tunggu sebentar
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return connectToDatabase();
  }

  try {
    isConnecting = true;
    
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MongoDB URI tidak ditemukan, mode fallback aktif');
      cachedConnection = null;
      return null;
    }

    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    cachedConnection = mongoose.connection;
    console.log('✅ MongoDB Connected (Cached)');
    return cachedConnection;
    
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    cachedConnection = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

// Schema
const ComicMapSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true, index: true },
  slug: { type: String, required: true, index: true },
  type: { type: String, enum: ['series', 'chapter'], required: true }
}, { timestamps: true });

const ComicMap = mongoose.models.ComicMap || mongoose.model('ComicMap', ComicMapSchema);

// ===============================
// OPTIMASI #2: In-Memory Cache dengan TTL
// ===============================
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

function setCache(key, value) {
  cache.set(key, {
    value,
    expiry: Date.now() + CACHE_TTL
  });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

// ===============================
// OPTIMASI #3: Fallback ke slug jika DB gagal
// ===============================

// Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    cache_size: cache.size,
    timestamp: new Date().toISOString()
  });
});

// Get UUID from slug
app.post('/api/get-id', async (req, res) => {
  try {
    const { slug, type } = req.body;
    
    if (!slug || !type) {
      return res.status(400).json({ error: 'Slug dan type diperlukan' });
    }

    // Cek cache dulu
    const cacheKey = `uuid:${type}:${slug}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json({ uuid: cached });
    }

    // Coba connect ke database
    const db = await connectToDatabase();
    
    if (!db) {
      // Fallback: gunakan slug langsung jika DB gagal
      console.log('⚠️  DB unavailable, using slug as UUID fallback');
      return res.json({ uuid: slug });
    }

    // Cari atau buat UUID baru
    let map = await ComicMap.findOne({ slug, type });
    
    if (!map) {
      const uuid = require('crypto').randomUUID();
      map = new ComicMap({ uuid, slug, type });
      await map.save();
    }

    // Simpan ke cache
    setCache(cacheKey, map.uuid);
    
    res.json({ uuid: map.uuid });
    
  } catch (err) {
    console.error('Error get-id:', err.message);
    // Fallback ke slug
    res.json({ uuid: req.body.slug });
  }
});

// Get slug from UUID
app.get('/api/get-slug/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Cek cache
    const cacheKey = `slug:${uuid}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = await connectToDatabase();
    
    if (!db) {
      // Fallback: anggap uuid adalah slug
      return res.json({ slug: uuid, type: 'series' });
    }

    const map = await ComicMap.findOne({ uuid });
    
    if (!map) {
      return res.status(404).json({ error: 'UUID tidak ditemukan' });
    }

    const result = { slug: map.slug, type: map.type };
    setCache(cacheKey, result);
    
    res.json(result);
    
  } catch (err) {
    console.error('Error get-slug:', err.message);
    res.json({ slug: req.params.uuid, type: 'series' });
  }
});

// Export untuk Vercel
module.exports = app;

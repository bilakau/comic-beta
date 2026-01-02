const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Hubungkan ke MongoDB Atlas (Setting di Environment Variable Vercel)
const MONGO_URI = process.env.MONGODB_URI; 
mongoose.connect(MONGO_URI).catch(err => console.log("DB Error:", err));

const Mapping = mongoose.model('Mapping', new mongoose.Schema({
    uuid: { type: String, unique: true },
    slug: { type: String },
    type: { type: String } // 'series' atau 'chapter'
}));

// API Sinkronisasi Massal (Bulk Sync) - Agar Cepat
app.post('/api/bulk-sync', async (req, res) => {
    try {
        const { slugs, type } = req.body;
        if (!slugs || !Array.isArray(slugs)) return res.status(400).send("Invalid input");

        const existing = await Mapping.find({ slug: { $in: slugs }, type });
        const existingSlugs = existing.map(e => e.slug);
        const newSlugs = slugs.filter(s => !existingSlugs.includes(s));

        if (newSlugs.length > 0) {
            const newMappings = newSlugs.map(s => ({ uuid: uuidv4(), slug: s, type: type }));
            await Mapping.insertMany(newMappings);
        }

        const allData = await Mapping.find({ slug: { $in: slugs }, type });
        const mapRes = {};
        allData.forEach(item => { mapRes[item.slug] = item.uuid; });
        res.json(mapRes);
    } catch (e) { res.status(500).send(e.message); }
});

// API Cari Slug dari UUID (Untuk handle Refresh/Link Share)
app.get('/api/get-slug/:uuid', async (req, res) => {
    try {
        const data = await Mapping.findOne({ uuid: req.params.uuid });
        if (data) res.json(data);
        else res.status(404).json({ error: "Not Found" });
    } catch (e) { res.status(500).send(e.message); }
});

module.exports = app;

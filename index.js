const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── ROBUST PATH RESOLUTION ──────────────────────────────
console.log('--- Render Path Diagnostics ---');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

const searchPaths = [
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public'),
  path.resolve('./public'),
  path.join(__dirname, '../public'), // In case it's in a subfolder like 'api'
  '/opt/render/project/src/public', // Common Render path
];

let publicPath = '';
for (const p of searchPaths) {
  if (fs.existsSync(p)) {
    publicPath = p;
    console.log('✅ FOUND public directory at:', publicPath);
    break;
  }
}

if (!publicPath) {
  console.error('❌ ERROR: "public" folder not found! Listing root content...');
  try {
    fs.readdirSync(process.cwd()).forEach(f => console.log(' ->', f));
  } catch(e) {}
  // Default fallback
  publicPath = path.join(__dirname, 'public');
}

const indexPath = path.join(publicPath, 'index.html');
console.log('-> Resolved index.html path:', indexPath);
console.log('-------------------------------');

// ─── MIDDLEWARE & DB ─────────────────────────────────────
app.use(cors());
app.use(express.json());

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  return cachedDb = await mongoose.connect(process.env.MONGODB_URI);
}

// ─── MODELS ──────────────────────────────────────────────
const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', new mongoose.Schema({
  name: String, category: String, price: Number, emoji: String, available: { type: Boolean, default: true }, discount: { type: Number, default: 0 }
}));

const FoodBooking = mongoose.models.FoodBooking || mongoose.model('FoodBooking', new mongoose.Schema({
  name: String, phone: String, address: String, km: Number, mapUrl: String, items: Array, subtotal: Number, discount: Number, delivery: Number, total: Number, date: { type: Date, default: Date.now }
}));

const HallBooking = mongoose.models.HallBooking || mongoose.model('HallBooking', new mongoose.Schema({
  name: String, phone: String, functionType: String, date: String, time: String, hours: Number, members: Number, cabin: Number, total: Number, bookedAt: { type: Date, default: Date.now }
}));

const Settings = mongoose.models.Settings || mongoose.model('Settings', new mongoose.Schema({
  upi: String, name: String, other: String, adminContact: String, address: String, kmPrices: Array, hallPricingMode: String, hallPriceAmount: Number, foodBookingOpen: { type: Boolean, default: true }, hallBookingOpen: { type: Boolean, default: true }
}));

// ─── SEED ────────────────────────────────────────────────
async function seedData() {
  try {
    let s = await Settings.findOne();
    if (!s) await Settings.create({ upi: 'test@upi', name: 'Restaurant', kmPrices: [], hallPriceAmount: 500 });
  } catch (err) {}
}

// ─── API ROUTES ──────────────────────────────────────────
app.get('/api/menu', async (req, res) => { try { res.json(await MenuItem.find()); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/menu', async (req, res) => { try { res.json(await new MenuItem(req.body).save()); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/settings', async (req, res) => { try { res.json(await Settings.findOne() || {}); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/settings', async (req, res) => { try { res.json(await Settings.findOneAndUpdate({}, req.body, { upsert: true, new: true })); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/bookings/food', async (req, res) => { try { res.json(await new FoodBooking(req.body).save()); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/bookings/hall', async (req, res) => { try { res.json(await new HallBooking(req.body).save()); } catch (err) { res.status(500).send(err.message); } });

// ─── STATIC FILES ────────────────────────────────────────
app.use(express.static(publicPath));

// ─── CATCH-ALL ───────────────────────────────────────────
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Error: Cannot find frontend files. Looking at ${indexPath}. Please ensure your "public" folder is in the root of your repository.`);
  }
});

// START
const start = async () => {
  try {
    await connectToDatabase();
    await seedData();
    app.listen(PORT, () => console.log(`🚀 Server on port ${PORT} with DB connected`));
  } catch (err) {
    console.error('Startup Error:', err);
    // Start server anyway so logs are visible
    app.listen(PORT, () => console.log(`🚀 Server on ${PORT} (DB Connection Failed)`));
  }
};
start();

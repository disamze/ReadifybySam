require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const MemoryStoreFactory = require('memorystore');

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const MemoryStore = MemoryStoreFactory(session);
const MONGODB_URI = process.env.MONGODB_URI;
let dbReady = false;

['uploads/books', 'uploads/payments', 'uploads/qr'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'readify-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
};

if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 60 * 60 * 24,
    autoRemove: 'native'
  });
} else {
  sessionConfig.store = new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 4 });
  console.warn('MONGODB_URI missing: using fallback memory session store (development-only).');
}

app.use(session(sessionConfig));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password_hash: String, role: { type: String, enum: ['user', 'admin'] } }, { timestamps: true });
const SettingsSchema = new mongoose.Schema({ site_name: { type: String, default: 'ReadifyBySam' }, upi_qr_path: { type: String, default: '' }, upi_id: { type: String, default: '' } }, { timestamps: true });
const BookSchema = new mongoose.Schema({ title: String, author: String, description: String, price: Number, cover_url: String, cover_image_path: String, preview_pages: [String], pdf_path: String }, { timestamps: true });
const TestimonialSchema = new mongoose.Schema({ name: String, content: String, rating: { type: Number, default: 5 } }, { timestamps: true });
const OrderSchema = new mongoose.Schema({ user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, total: Number, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, payment_screenshot: String, items: [{ book_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' }, quantity: Number, price: Number }] }, { timestamps: true });
const ContactSchema = new mongoose.Schema({ name: String, email: String, message: String }, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Book = mongoose.model('Book', BookSchema);
const Testimonial = mongoose.model('Testimonial', TestimonialSchema);
const Order = mongoose.model('Order', OrderSchema);
const ContactMessage = mongoose.model('ContactMessage', ContactSchema);

const storageBooks = multer.diskStorage({ destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/books')), filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`) });
const storageBookImages = multer.diskStorage({ destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/books')), filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`) });
const storagePayments = multer.diskStorage({ destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/payments')), filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`) });
const storageQR = multer.diskStorage({ destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/qr')), filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`) });
const uploadBook = multer({ storage: storageBooks });
const uploadBookImages = multer({ storage: storageBookImages });
const uploadPayment = multer({ storage: storagePayments });
const uploadQR = multer({ storage: storageQR });

const isAuth = (req, res, next) => (req.session.user ? next() : res.status(401).json({ error: 'Unauthorized' }));
const isAdmin = (req, res, next) => (req.session.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Forbidden' }));
const requireDb = (_, res, next) => (dbReady ? next() : res.status(503).json({ error: 'Database initializing. Try again shortly.' }));

async function seedMongo() {
  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@readifybysam.com').toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Readify Admin';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    await User.create({ name: adminName, email: adminEmail, password_hash: hash, role: 'admin' });
    console.log(`Seeded admin: ${adminEmail}`);
  }

  if (!(await Settings.findOne())) await Settings.create({});

  if ((await Testimonial.countDocuments()) === 0) {
    await Testimonial.insertMany([
      { name: 'Aanya Sharma', content: 'Loved the premium notes and beginner-friendly books!', rating: 5 },
      { name: 'Raghav Mehta', content: 'Super smooth checkout and instant approval by admin.', rating: 5 },
      { name: 'Priya Nair', content: 'Design is beautiful and books are very practical.', rating: 4 }
    ]);
  }
}

async function connectMongoWithRetry() {
  if (!MONGODB_URI) return;
  let attempts = 0;
  while (!dbReady && attempts < 20) {
    try {
      attempts += 1;
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      await seedMongo();
      dbReady = true;
      console.log('MongoDB connected.');
      return;
    } catch (err) {
      console.error(`MongoDB connect attempt ${attempts} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, dbReady, uptime: process.uptime() });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });
  if (!dbReady) return res.status(503).json({ error: 'Please wait. Server is initializing.' });
  await ContactMessage.create({ name: String(name).trim(), email: String(email).trim().toLowerCase(), message: String(message).trim() });
  res.json({ message: 'Message sent successfully. Admin will contact you soon.' });
});

app.use('/api', requireDb);

async function publicStats() {
  const approvedOrders = await Order.find({ status: 'approved' }, { items: 1 });
  const purchased = approvedOrders.reduce((sum, order) => sum + order.items.reduce((acc, i) => acc + i.quantity, 0), 0);
  const testimonials = await Testimonial.find({}, { name: 1, content: 1, rating: 1 }).sort({ createdAt: -1 }).lean();
  const books = await Book.find({}, { title: 1, author: 1, description: 1, price: 1, cover_url: 1, cover_image_path: 1, preview_pages: 1 }).sort({ createdAt: -1 }).lean();
  const settings = await Settings.findOne({}, { site_name: 1, upi_qr_path: 1, upi_id: 1 }).lean();
  return { purchased, testimonials, books, settings };
}

app.get('/api/public-data', async (_, res) => res.json(await publicStats()));
app.get('/api/recent-purchases', async (_, res) => {
  const orders = await Order.find({ status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('user_id', 'name')
    .populate('items.book_id', 'title')
    .lean();

  const events = [];
  orders.forEach((order) => {
    const buyer = order.user_id?.name || 'A Reader';
    order.items.forEach((item) => {
      const title = item.book_id?.title;
      if (title) events.push({ buyer, title, at: order.createdAt });
    });
  });

  res.json(events.slice(0, 30));
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid signup details.' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already registered.' });
  const hash = bcrypt.hashSync(password, 10);
  await User.create({ name, email: email.toLowerCase(), password_hash: hash, role });
  res.json({ message: 'Signup successful. Please login.' });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  if (role && role !== user.role) return res.status(403).json({ error: `This account is registered as ${user.role}.` });
  req.session.user = { id: user._id.toString(), name: user.name, role: user.role, email: user.email };
  res.json({ user: req.session.user });
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ message: 'Logged out' })));
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

app.get('/api/books', async (_, res) => res.json(await Book.find({}, { title: 1, author: 1, description: 1, price: 1, cover_url: 1, cover_image_path: 1, preview_pages: 1 }).sort({ createdAt: -1 }).lean()));

app.post('/api/orders', isAuth, uploadPayment.single('payment_screenshot'), async (req, res) => {
  if (req.session.user.role !== 'user') return res.status(403).json({ error: 'Only users can place orders' });
  const items = JSON.parse(req.body.items || '[]');
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });

  const ids = items.map((i) => i.bookId);
  const books = await Book.find({ _id: { $in: ids } }, { price: 1 }).lean();
  const map = new Map(books.map((b) => [b._id.toString(), b]));
  const sanitized = [];
  let total = 0;
  for (const item of items) {
    const b = map.get(item.bookId);
    if (!b) continue;
    const quantity = Math.max(1, Number(item.quantity || 1));
    total += b.price * quantity;
    sanitized.push({ book_id: b._id, quantity, price: b.price });
  }
  if (!sanitized.length) return res.status(400).json({ error: 'No valid books in cart' });
  const order = await Order.create({ user_id: req.session.user.id, total, payment_screenshot: req.file ? `/uploads/payments/${req.file.filename}` : null, items: sanitized });
  res.json({ message: 'Order placed and pending admin approval.', orderId: order._id });
});


app.post('/api/user/testimonials', isAuth, async (req, res) => {
  if (req.session.user.role !== 'user') return res.status(403).json({ error: 'Only users can submit reviews' });
  const { content, rating } = req.body;
  if (!content || String(content).trim().length < 8) return res.status(400).json({ error: 'Please write at least 8 characters.' });

  const hasPurchase = await Order.exists({ user_id: req.session.user.id, status: 'approved' });
  if (!hasPurchase) return res.status(403).json({ error: 'You can review only after purchasing an approved book.' });

  await Testimonial.create({
    name: req.session.user.name || 'Reader',
    content: String(content).trim(),
    rating: Math.min(5, Math.max(1, Number(rating || 5)))
  });

  res.json({ message: 'Thanks! Your review has been added.' });
});

app.get('/api/my-library', isAuth, async (req, res) => {
  if (req.session.user.role !== 'user') return res.status(403).json({ error: 'Only users can access library' });
  const orders = await Order.find({ user_id: req.session.user.id, status: 'approved' }).populate('items.book_id').sort({ createdAt: -1 }).lean();
  const books = orders.flatMap((o) => o.items.map((i) => i.book_id ? ({ id: i.book_id._id, title: i.book_id.title, author: i.book_id.author, pdf_path: i.book_id.pdf_path, status: o.status, created_at: o.createdAt }) : null).filter(Boolean));
  res.json(books);
});

app.get('/api/admin/dashboard', isAuth, isAdmin, async (_, res) => {
  const users = await User.find({}, { name: 1, email: 1, role: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
  const books = await Book.find({}).sort({ createdAt: -1 }).lean();
  const orders = await Order.find({}).populate('user_id').sort({ createdAt: -1 }).lean();
  const testimonials = await Testimonial.find({}).sort({ createdAt: -1 }).lean();
  const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).lean();
  const settings = await Settings.findOne().lean();
  res.json({
    users: users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, created_at: u.createdAt })),
    books,
    orders: orders.map((o) => ({ ...o, id: o._id, user_name: o.user_id?.name || 'Unknown', user_email: o.user_id?.email || '-' })),
    testimonials,
    messages: messages.map((m) => ({ id: m._id, name: m.name, email: m.email, message: m.message, created_at: m.createdAt })),
    settings
  });
});

app.post('/api/admin/books', isAuth, isAdmin, uploadBookImages.fields([{ name: 'cover_image', maxCount: 1 }, { name: 'preview_pages', maxCount: 8 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, description, price } = req.body;
    const pdfFile = req.files?.pdf?.[0];
    const coverFile = req.files?.cover_image?.[0];
    const previewFiles = req.files?.preview_pages || [];
    const parsedPrice = Number(price);

    if (!title || !author || !price || !pdfFile) {
      return res.status(400).json({ error: 'Title, author, price and PDF are required' });
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Please enter a valid price greater than 0.' });
    }

    const createdBook = await Book.create({
      title: String(title).trim(),
      author: String(author).trim(),
      description: description ? String(description).trim() : '',
      price: parsedPrice,
      cover_url: '',
      cover_image_path: coverFile ? `/uploads/books/${coverFile.filename}` : '',
      preview_pages: previewFiles.map((f) => `/uploads/books/${f.filename}`),
      pdf_path: `/uploads/books/${pdfFile.filename}`
    });
    res.json({ message: 'Book added successfully', book: createdBook });
  } catch (err) {
    console.error('Book upload failed:', err.message);
    res.status(500).json({ error: 'Book upload failed. Please try again.' });
  }
});
app.put('/api/admin/books/:id', isAuth, isAdmin, async (req, res) => { const { title, author, description, price } = req.body; await Book.findByIdAndUpdate(req.params.id, { title, author, description: description || '', price: Number(price) }); res.json({ message: 'Book updated' }); });
app.delete('/api/admin/books/:id', isAuth, isAdmin, async (req, res) => { await Book.findByIdAndDelete(req.params.id); res.json({ message: 'Book deleted' }); });
app.post('/api/admin/testimonials', isAuth, isAdmin, async (req, res) => { const { name, content, rating } = req.body; await Testimonial.create({ name, content, rating: Number(rating || 5) }); res.json({ message: 'Testimonial added' }); });
app.put('/api/admin/testimonials/:id', isAuth, isAdmin, async (req, res) => { const { name, content, rating } = req.body; await Testimonial.findByIdAndUpdate(req.params.id, { name, content, rating: Number(rating || 5) }); res.json({ message: 'Testimonial updated' }); });
app.delete('/api/admin/testimonials/:id', isAuth, isAdmin, async (req, res) => { await Testimonial.findByIdAndDelete(req.params.id); res.json({ message: 'Testimonial removed' }); });
app.put('/api/admin/orders/:id/status', isAuth, isAdmin, async (req, res) => { const { status } = req.body; if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' }); await Order.findByIdAndUpdate(req.params.id, { status }); res.json({ message: `Order ${status}` }); });
app.put('/api/admin/users/:id/role', isAuth, isAdmin, async (req, res) => { const { role } = req.body; if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' }); await User.findByIdAndUpdate(req.params.id, { role }); res.json({ message: 'User role updated' }); });

app.post('/api/admin/settings/qr', isAuth, isAdmin, uploadQR.single('qr'), async (req, res) => {
  const { upi_id } = req.body;
  const current = await Settings.findOne();
  current.upi_qr_path = req.file ? `/uploads/qr/${req.file.filename}` : current.upi_qr_path;
  current.upi_id = upi_id || '';
  await current.save();
  res.json({ message: 'UPI settings updated' });
});

app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  console.error('Unhandled server error:', err.message);
  return res.status(500).json({ error: 'Server error. Please try again.' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ReadifyBySam listening on port ${PORT}`);
  connectMongoWithRetry();
});

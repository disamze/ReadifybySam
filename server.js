require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 10000;

const DB_PATH = path.join(__dirname, 'readify.db');
const db = new Database(DB_PATH);

['uploads/books', 'uploads/payments', 'uploads/qr'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'readify-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','admin')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      site_name TEXT DEFAULT 'ReadifyBySam',
      upi_qr_path TEXT DEFAULT '',
      upi_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      cover_url TEXT DEFAULT '',
      pdf_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      payment_screenshot TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (1)').run();

  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@readifybysam.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Readify Admin';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(adminName, adminEmail, hash, 'admin');
    console.log(`Seeded admin: ${adminEmail} / ${adminPassword}`);
  }

  const testCount = db.prepare('SELECT COUNT(*) as count FROM testimonials').get().count;
  if (!testCount) {
    const stmt = db.prepare('INSERT INTO testimonials (name, content, rating) VALUES (?, ?, ?)');
    stmt.run('Aanya Sharma', 'Loved the premium notes and beginner-friendly books!', 5);
    stmt.run('Raghav Mehta', 'Super smooth checkout and instant approval by admin.', 5);
    stmt.run('Priya Nair', 'Design is beautiful and books are very practical.', 4);
  }
}

initDB();

const storageBooks = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/books')),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});

const storagePayments = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/payments')),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});

const storageQR = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads/qr')),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});

const uploadBook = multer({ storage: storageBooks });
const uploadPayment = multer({ storage: storagePayments });
const uploadQR = multer({ storage: storageQR });

const isAuth = (req, res, next) => (req.session.user ? next() : res.status(401).json({ error: 'Unauthorized' }));
const isAdmin = (req, res, next) => (req.session.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Forbidden' }));

function publicStats() {
  const purchased = db
    .prepare('SELECT IFNULL(SUM(quantity), 0) as purchased FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = ?')
    .get('approved').purchased;
  const testimonials = db.prepare('SELECT id, name, content, rating FROM testimonials ORDER BY id DESC').all();
  const books = db.prepare('SELECT id, title, author, description, price, cover_url FROM books ORDER BY id DESC').all();
  const settings = db.prepare('SELECT site_name, upi_qr_path, upi_id FROM settings WHERE id = 1').get();
  return { purchased, testimonials, books, settings };
}

app.get('/api/public-data', (_, res) => {
  res.json(publicStats());
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid signup details.' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email.toLowerCase(), hash, role);
  res.json({ message: 'Signup successful. Please login.' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email };
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get('/api/books', (_, res) => {
  res.json(db.prepare('SELECT id, title, author, description, price, cover_url FROM books ORDER BY id DESC').all());
});

app.post('/api/orders', isAuth, uploadPayment.single('payment_screenshot'), (req, res) => {
  if (req.session.user.role !== 'user') return res.status(403).json({ error: 'Only users can place orders' });
  const items = JSON.parse(req.body.items || '[]');
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });

  const booksLookup = db.prepare('SELECT id, price FROM books WHERE id = ?');
  let total = 0;
  const sanitized = [];
  for (const item of items) {
    const book = booksLookup.get(item.bookId);
    const qty = Math.max(1, Number(item.quantity || 1));
    if (!book) continue;
    total += book.price * qty;
    sanitized.push({ bookId: book.id, quantity: qty, price: book.price });
  }
  if (!sanitized.length) return res.status(400).json({ error: 'No valid books in cart' });

  const orderTx = db.transaction(() => {
    const orderResult = db
      .prepare('INSERT INTO orders (user_id, total, payment_screenshot) VALUES (?, ?, ?)')
      .run(req.session.user.id, total, req.file ? `/uploads/payments/${req.file.filename}` : null);
    const orderId = orderResult.lastInsertRowid;
    const stmt = db.prepare('INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?, ?, ?, ?)');
    sanitized.forEach((i) => stmt.run(orderId, i.bookId, i.quantity, i.price));
    return orderId;
  });

  const orderId = orderTx();
  res.json({ message: 'Order placed and pending admin approval.', orderId });
});

app.get('/api/my-library', isAuth, (req, res) => {
  if (req.session.user.role !== 'user') return res.status(403).json({ error: 'Only users can access library' });

  const books = db
    .prepare(`
      SELECT b.id, b.title, b.author, b.pdf_path, o.status, o.created_at
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN books b ON b.id = oi.book_id
      WHERE o.user_id = ? AND o.status = 'approved'
      ORDER BY o.created_at DESC
    `)
    .all(req.session.user.id);
  res.json(books);
});

app.get('/api/admin/dashboard', isAuth, isAdmin, (_, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC').all();
  const books = db.prepare('SELECT * FROM books ORDER BY id DESC').all();
  const orders = db
    .prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC
    `)
    .all();
  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({ users, books, orders, testimonials, settings });
});

app.post('/api/admin/books', isAuth, isAdmin, uploadBook.single('pdf'), (req, res) => {
  const { title, author, description, price, cover_url } = req.body;
  if (!title || !author || !price || !req.file) return res.status(400).json({ error: 'Title, author, price and PDF are required' });
  db.prepare('INSERT INTO books (title, author, description, price, cover_url, pdf_path) VALUES (?, ?, ?, ?, ?, ?)').run(
    title,
    author,
    description || '',
    Number(price),
    cover_url || '',
    `/uploads/books/${req.file.filename}`
  );
  res.json({ message: 'Book added successfully' });
});

app.put('/api/admin/books/:id', isAuth, isAdmin, (req, res) => {
  const { title, author, description, price, cover_url } = req.body;
  db.prepare('UPDATE books SET title=?, author=?, description=?, price=?, cover_url=? WHERE id=?').run(
    title,
    author,
    description || '',
    Number(price),
    cover_url || '',
    Number(req.params.id)
  );
  res.json({ message: 'Book updated' });
});

app.delete('/api/admin/books/:id', isAuth, isAdmin, (req, res) => {
  db.prepare('DELETE FROM books WHERE id=?').run(Number(req.params.id));
  res.json({ message: 'Book deleted' });
});

app.post('/api/admin/testimonials', isAuth, isAdmin, (req, res) => {
  const { name, content, rating } = req.body;
  db.prepare('INSERT INTO testimonials (name, content, rating) VALUES (?, ?, ?)').run(name, content, Number(rating || 5));
  res.json({ message: 'Testimonial added' });
});

app.put('/api/admin/testimonials/:id', isAuth, isAdmin, (req, res) => {
  const { name, content, rating } = req.body;
  db.prepare('UPDATE testimonials SET name=?, content=?, rating=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
    name,
    content,
    Number(rating || 5),
    Number(req.params.id)
  );
  res.json({ message: 'Testimonial updated' });
});

app.delete('/api/admin/testimonials/:id', isAuth, isAdmin, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id=?').run(Number(req.params.id));
  res.json({ message: 'Testimonial removed' });
});

app.put('/api/admin/orders/:id/status', isAuth, isAdmin, (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, Number(req.params.id));
  res.json({ message: `Order ${status}` });
});

app.put('/api/admin/users/:id/role', isAuth, isAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, Number(req.params.id));
  res.json({ message: 'User role updated' });
});

app.post('/api/admin/settings/qr', isAuth, isAdmin, uploadQR.single('qr'), (req, res) => {
  const { upi_id } = req.body;
  db.prepare('UPDATE settings SET upi_qr_path=?, upi_id=? WHERE id=1').run(
    req.file ? `/uploads/qr/${req.file.filename}` : db.prepare('SELECT upi_qr_path FROM settings WHERE id=1').get().upi_qr_path,
    upi_id || ''
  );
  res.json({ message: 'UPI settings updated' });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });

  db.prepare('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)').run(name, email, message);

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'disamaze@gmail.com',
      subject: 'ReadifyBySam Contact Message',
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    });
  }

  res.json({ message: 'Message sent successfully!' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ReadifyBySam running on port ${PORT}`);
});

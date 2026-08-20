require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const mongoose   = require('mongoose');
const MongoStore = require('connect-mongo');
const bcrypt     = require('bcryptjs');
const path       = require('path');

const Admin       = require('./models/Admin');
const Feriante    = require('./models/Feriante');
const Feria       = require('./models/Feria');
const Inscripcion = require('./models/Inscripcion');

const app       = express();
const PORT      = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Camelia';

// ─── Middleware ────────────────────────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'feria-camelia-dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, ttl: 28800 }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];
const validId  = id => mongoose.Types.ObjectId.isValid(id);

// ─── API Pública ───────────────────────────────────────────────────────────────

app.get('/api/ferias', async (req, res) => {
  try {
    const ferias = await Feria.find({ activa: true, fecha: { $gte: todayStr() } })
      .sort({ fecha: 1 }).select('fecha lugar precio recomendaciones');
    res.json(ferias);
  } catch { res.status(500).json({ error: 'Error al obtener las ferias' }); }
});

// ─── Feriantes auth ────────────────────────────────────────────────────────────

function requireFeriante(req, res, next) {
  if (!req.session.ferianteId) return res.status(401).json({ error: 'Debés iniciar sesión para continuar.' });
  next();
}

app.get('/api/feriantes/check', async (req, res) => {
  if (!req.session.ferianteId) return res.json({ authenticated: false });
  try {
    const f = await Feriante.findById(req.session.ferianteId)
      .select('nombre_emprendimiento rubro nombre_contacto email telefono');
    res.json({ authenticated: !!f, feriante: f || null });
  } catch { res.json({ authenticated: false }); }
});

app.post('/api/feriantes/registro', async (req, res) => {
  const { nombre_emprendimiento, rubro, nombre_contacto, email, telefono, password } = req.body;
  if (!nombre_emprendimiento?.trim() || !rubro?.trim() || !nombre_contacto?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Por favor completá todos los campos obligatorios.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'El formato del email no es válido.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  if (await Feriante.findOne({ email: email.trim().toLowerCase() }))
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Iniciá sesión.' });
  try {
    const f = await Feriante.create({
      nombre_emprendimiento: nombre_emprendimiento.trim(),
      rubro: rubro.trim(),
      nombre_contacto: nombre_contacto.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono?.trim() || '',
      password_hash: bcrypt.hashSync(password, 10)
    });
    req.session.ferianteId = f._id.toString();
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

app.post('/api/feriantes/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  const f = await Feriante.findOne({ email: email.trim().toLowerCase() });
  if (!f || !bcrypt.compareSync(password, f.password_hash))
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  req.session.ferianteId = f._id.toString();
  res.json({ success: true, nombre: f.nombre_emprendimiento });
});

app.post('/api/feriantes/logout', (req, res) => {
  req.session.ferianteId = null;
  res.json({ success: true });
});

app.get('/api/feriantes/me', requireFeriante, async (req, res) => {
  const f = await Feriante.findById(req.session.ferianteId);
  if (!f) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(f);
});

app.get('/api/feriantes/mis-inscripciones', requireFeriante, async (req, res) => {
  try {
    const inscripciones = await Inscripcion.find({ feriante: req.session.ferianteId })
      .populate('feria', 'fecha lugar precio recomendaciones')
      .sort({ createdAt: 1 });
    res.json(inscripciones.filter(i => i.feria).map(i => ({
      id:              i.feria._id,
      fecha:           i.feria.fecha,
      lugar:           i.feria.lugar,
      precio:          i.feria.precio,
      recomendaciones: i.feria.recomendaciones,
      tipo_espacio:    i.tipo_espacio,
      necesita_tablon: i.necesita_tablon ? 1 : 0,
      inscripto_el:    i.created_at
    })));
  } catch { res.status(500).json({ error: 'Error al obtener inscripciones.' }); }
});

app.post('/api/feriantes/inscribirse', requireFeriante, async (req, res) => {
  const { tipo_espacio, necesita_tablon } = req.body;
  const feriaId = req.body.feria_id;
  if (!feriaId || !validId(feriaId)) return res.status(400).json({ error: 'ID de feria no válido.' });
  if (!tipo_espacio && !necesita_tablon)
    return res.status(400).json({ error: 'Seleccioná al menos una opción de espacio.' });
  if (tipo_espacio && !['tablon', 'perchero', 'tablon_y_perchero'].includes(tipo_espacio))
    return res.status(400).json({ error: 'Tipo de espacio no válido.' });
  const feria = await Feria.findOne({ _id: feriaId, activa: true, fecha: { $gte: todayStr() } });
  if (!feria) return res.status(404).json({ error: 'Feria no disponible.' });
  if (await Inscripcion.findOne({ feriante: req.session.ferianteId, feria: feriaId }))
    return res.status(409).json({ error: 'Ya estás inscripto en esta feria.', yaInscripto: true });
  try {
    await Inscripcion.create({
      feriante: req.session.ferianteId, feria: feriaId,
      tipo_espacio: tipo_espacio || '', necesita_tablon: !!necesita_tablon
    });
    res.json({ success: true, feria });
  } catch { res.status(500).json({ error: 'Error al procesar la inscripción.' }); }
});

app.delete('/api/feriantes/inscripciones/:feriaId', requireFeriante, async (req, res) => {
  if (!validId(req.params.feriaId)) return res.status(400).json({ error: 'ID no válido.' });
  await Inscripcion.deleteOne({ feriante: req.session.ferianteId, feria: req.params.feriaId });
  res.json({ success: true });
});

// ─── Admin auth ────────────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'No autorizado' });
  next();
}

app.get('/api/admin/check',  (req, res) => res.json({ authenticated: !!req.session.adminId }));

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Campos requeridos' });
  const admin = await Admin.findOne({ username });
  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.adminId = admin._id.toString();
  res.json({ success: true });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => { req.session.destroy(); res.json({ success: true }); });

// ─── Admin API ─────────────────────────────────────────────────────────────────

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [totalFeriantes, feriasActivas, totalFerias, totalInscripciones] = await Promise.all([
    Feriante.countDocuments(),
    Feria.countDocuments({ activa: true, fecha: { $gte: todayStr() } }),
    Feria.countDocuments(),
    Inscripcion.countDocuments()
  ]);
  res.json({ totalFeriantes, feriasActivas, totalFerias, totalInscripciones });
});

app.get('/api/admin/ferias', requireAdmin, async (req, res) => {
  try {
    const ferias = await Feria.find().sort({ fecha: -1 });
    const result = await Promise.all(ferias.map(async f => ({
      ...f.toJSON(), total_inscripciones: await Inscripcion.countDocuments({ feria: f._id })
    })));
    res.json(result);
  } catch { res.status(500).json({ error: 'Error al obtener ferias.' }); }
});

app.post('/api/admin/ferias', requireAdmin, async (req, res) => {
  const { fecha, lugar, precio, recomendaciones } = req.body;
  if (!fecha || !lugar?.trim() || !precio || !recomendaciones?.trim())
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  try {
    const f = await Feria.create({ fecha, lugar: lugar.trim(), precio: parseFloat(precio), recomendaciones: recomendaciones.trim() });
    res.json({ success: true, id: f._id });
  } catch { res.status(500).json({ error: 'Error al crear la feria' }); }
});

app.put('/api/admin/ferias/:id', requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID no válido.' });
  const { fecha, lugar, precio, recomendaciones, activa } = req.body;
  if (!fecha || !lugar?.trim() || !precio || !recomendaciones?.trim())
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  try {
    await Feria.findByIdAndUpdate(req.params.id, {
      fecha, lugar: lugar.trim(), precio: parseFloat(precio),
      recomendaciones: recomendaciones.trim(), activa: !!activa
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al actualizar' }); }
});

app.delete('/api/admin/ferias/:id', requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID no válido.' });
  try {
    await Promise.all([Feria.findByIdAndDelete(req.params.id), Inscripcion.deleteMany({ feria: req.params.id })]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar' }); }
});

app.get('/api/admin/ferias/:id/inscripciones', requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID no válido.' });
  try {
    const inscripciones = await Inscripcion.find({ feria: req.params.id })
      .populate('feriante', 'nombre_emprendimiento rubro nombre_contacto email telefono')
      .sort({ created_at: -1 });
    res.json(inscripciones.filter(i => i.feriante).map(i => ({
      nombre_emprendimiento: i.feriante.nombre_emprendimiento,
      rubro:           i.feriante.rubro,
      tipo_espacio:    i.tipo_espacio,
      necesita_tablon: i.necesita_tablon ? 1 : 0,
      nombre_contacto: i.feriante.nombre_contacto,
      email:           i.feriante.email,
      telefono:        i.feriante.telefono,
      created_at:      i.created_at
    })));
  } catch { res.status(500).json({ error: 'Error al obtener inscripciones.' }); }
});

app.get('/api/admin/feriantes', requireAdmin, async (req, res) => {
  try {
    const feriantes = await Feriante.find().sort({ created_at: -1 });
    const result = await Promise.all(feriantes.map(async f => {
      const insc = await Inscripcion.find({ feriante: f._id }).populate('feria', 'fecha');
      const ferias_inscriptas = insc.filter(i => i.feria).map(i => i.feria.fecha).join(', ') || null;
      const espacios = [...new Set(insc.filter(i => i.tipo_espacio).map(i => i.tipo_espacio))];
      return {
        ...f.toJSON(), ferias_inscriptas,
        espacios_usados: espacios.join(',') || null,
        alguna_vez_tablon: insc.some(i => i.necesita_tablon) ? 1 : 0
      };
    }));
    res.json(result);
  } catch { res.status(500).json({ error: 'Error al obtener feriantes.' }); }
});

app.put('/api/admin/password', requireAdmin, async (req, res) => {
  const { current, nueva } = req.body;
  if (!current || !nueva || nueva.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  const admin = await Admin.findById(req.session.adminId);
  if (!bcrypt.compareSync(current, admin.password_hash))
    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
  await Admin.findByIdAndUpdate(req.session.adminId, { password_hash: bcrypt.hashSync(nueva, 10) });
  res.json({ success: true });
});

// ─── Inicio ────────────────────────────────────────────────────────────────────

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB conectado');
    if (!await Admin.findOne({ username: 'admin' })) {
      await Admin.create({ username: 'admin', password_hash: bcrypt.hashSync('admin123', 10) });
      console.log('Admin creado: usuario=admin, contraseña=admin123');
    }
    app.listen(PORT, () => {
      console.log('\n🌸  Feria La Camelia corriendo en http://localhost:' + PORT);
      console.log('📊  Panel admin: http://localhost:' + PORT + '/admin/');
      console.log('🔑  Credenciales: admin / admin123\n');
    });
  })
  .catch(err => { console.error('Error al conectar MongoDB:', err.message); process.exit(1); });

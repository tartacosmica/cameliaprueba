// ── Helpers ─────────────────────────────────────────────────────────────────

function formatearFecha(fechaStr) {
  const [year, month, day] = fechaStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatearPrecio(precio) {
  return Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Auth-aware nav ────────────────────────────────────────────────────────────

async function initNav() {
  try {
    const { authenticated } = await fetch('/api/feriantes/check').then(r => r.json());

    const loggedIn  = ['nav-micuenta', 'nav-logout-btn'];
    const loggedOut = ['nav-registrarse', 'nav-ingresar'];

    loggedIn.forEach(id  => { const el = document.getElementById(id);  if (el) el.style.display = authenticated ? '' : 'none'; });
    loggedOut.forEach(id => { const el = document.getElementById(id);  if (el) el.style.display = authenticated ? 'none' : ''; });

    document.getElementById('nav-logout-btn')?.addEventListener('click', async () => {
      await fetch('/api/feriantes/logout', { method: 'POST' });
      window.location.href = '/';
    });
  } catch { /* silent — nav stays in default state */ }
}

// ── Página de inicio: mostrar ferias disponibles ──────────────────────────────

async function loadFeriasHome() {
  const container = document.getElementById('ferias-list');
  if (!container) return;

  try {
    const ferias = await fetch('/api/ferias').then(r => r.json());

    if (!ferias.length) {
      container.innerHTML = '<p class="empty-state">No hay fechas disponibles en este momento. ¡Volvé pronto!</p>';
      return;
    }

    container.innerHTML = ferias.map(f => `
      <div class="feria-card">
        <div class="feria-card-date">📅 ${formatearFecha(f.fecha)}</div>
        <div class="feria-card-detail"><span class="icon">📍</span><span>${escHtml(f.lugar)}</span></div>
        <div class="feria-card-price">Espacio: ${formatearPrecio(f.precio)}</div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">No se pudieron cargar las fechas. Actualizá la página.</p>';
  }
}


// ── Auth guard ───────────────────────────────────────────────────────────────

(async function checkAuth() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();
  if (!data.authenticated) {
    window.location.href = '/admin/login.html';
  } else {
    initDashboard();
  }
})();

// ── Init ─────────────────────────────────────────────────────────────────────

function initDashboard() {
  loadStats();
  loadFerias();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'feriantes') loadFeriantes();
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  // Nueva feria btn
  document.getElementById('btn-nueva-feria').addEventListener('click', () => abrirModalFeria(null));

  // Feria form submit
  document.getElementById('feria-form').addEventListener('submit', handleFeriaSubmit);

  // Password form
  document.getElementById('pwd-form').addEventListener('submit', handlePwdSubmit);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await apiFetch('/api/admin/stats');
    document.getElementById('stat-feriantes').textContent = data.totalFeriantes;
    document.getElementById('stat-activas').textContent = data.feriasActivas;
    document.getElementById('stat-total').textContent = data.totalFerias;
    document.getElementById('stat-inscripciones').textContent = data.totalInscripciones;
  } catch { /* silent */ }
}

// ── Ferias table ──────────────────────────────────────────────────────────────

async function loadFerias() {
  const tbody = document.getElementById('ferias-tbody');
  try {
    const ferias = await apiFetch('/api/admin/ferias');
    if (!ferias.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay fechas registradas. Creá la primera.</td></tr>';
      return;
    }
    tbody.innerHTML = ferias.map(f => `
      <tr>
        <td data-label="Fecha" style="text-transform:capitalize;font-weight:600">${formatearFecha(f.fecha)}</td>
        <td data-label="Lugar">${escHtml(f.lugar)}</td>
        <td data-label="Precio">${formatearPrecio(f.precio)}</td>
        <td data-label="Inscriptos">
          <button class="btn btn-ghost btn-sm" onclick="verInscripciones('${f.id}', '${escHtml(f.fecha)}')">
            👥 ${f.total_inscripciones}
          </button>
        </td>
        <td data-label="Estado">
          <span class="badge ${f.activa ? 'badge-active' : 'badge-inactive'}">
            ${f.activa ? 'Activa' : 'Inactiva'}
          </span>
        </td>
        <td data-label="Acciones">
          <div class="btn-row">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick='abrirModalFeria(${JSON.stringify(f)})'>✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" title="Eliminar" onclick="eliminarFeria('${f.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar las ferias.</td></tr>';
  }
}

// ── Modal Feria (create / edit) ───────────────────────────────────────────────

function abrirModalFeria(feria) {
  const isEditing = !!feria;
  document.getElementById('modal-feria-title').textContent = isEditing ? 'Editar Fecha de Feria' : 'Nueva Fecha de Feria';
  document.getElementById('feria-id').value = feria?.id || '';
  document.getElementById('feria-fecha').value = feria?.fecha || '';
  document.getElementById('feria-lugar').value = feria?.lugar || '';
  document.getElementById('feria-precio').value = feria?.precio ?? '';
  document.getElementById('feria-recomendaciones').value = feria?.recomendaciones || '';
  document.getElementById('feria-submit-btn').textContent = isEditing ? 'Guardar cambios' : 'Crear fecha';
  document.getElementById('feria-form-error').classList.add('hidden');

  // Show activa toggle only when editing
  const activaGroup = document.getElementById('activa-group');
  activaGroup.style.display = isEditing ? '' : 'none';
  if (isEditing) document.getElementById('feria-activa').checked = feria.activa == 1;

  document.getElementById('modal-feria').classList.remove('hidden');
}

function cerrarModalFeria() {
  document.getElementById('modal-feria').classList.add('hidden');
  document.getElementById('feria-form').reset();
}

async function handleFeriaSubmit(e) {
  e.preventDefault();
  const errDiv = document.getElementById('feria-form-error');
  errDiv.classList.add('hidden');

  const id = document.getElementById('feria-id').value;
  const fecha = document.getElementById('feria-fecha').value;
  const lugar = document.getElementById('feria-lugar').value.trim();
  const precio = document.getElementById('feria-precio').value;
  const recomendaciones = document.getElementById('feria-recomendaciones').value.trim();
  const activa = document.getElementById('feria-activa').checked;

  if (!fecha || !lugar || !precio || !recomendaciones) {
    errDiv.textContent = 'Todos los campos son obligatorios.';
    errDiv.classList.remove('hidden');
    return;
  }

  const body = { fecha, lugar, precio, recomendaciones, activa };
  const submitBtn = document.getElementById('feria-submit-btn');
  submitBtn.disabled = true;

  try {
    const url = id ? `/api/admin/ferias/${id}` : '/api/admin/ferias';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      errDiv.textContent = data.error || 'Ocurrió un error.';
      errDiv.classList.remove('hidden');
    } else {
      cerrarModalFeria();
      loadFerias();
      loadStats();
    }
  } catch {
    errDiv.textContent = 'Error de conexión. Intentá nuevamente.';
    errDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}

async function eliminarFeria(id) {
  if (!confirm('¿Seguro que querés eliminar esta fecha? Se eliminarán todas las inscripciones asociadas.')) return;
  try {
    await apiFetch(`/api/admin/ferias/${id}`, 'DELETE');
    loadFerias();
    loadStats();
  } catch {
    alert('Error al eliminar la feria.');
  }
}

// ── Modal Inscripciones ───────────────────────────────────────────────────────

async function verInscripciones(feriaId, fecha) {
  document.getElementById('modal-inscripciones-title').textContent = `Inscriptos — ${formatearFecha(fecha)}`;
  document.getElementById('inscripciones-tbody').innerHTML = '<tr><td colspan="7" class="loading">Cargando…</td></tr>';
  document.getElementById('modal-inscripciones').classList.remove('hidden');

  try {
    const inscripciones = await apiFetch(`/api/admin/ferias/${feriaId}/inscripciones`);
    const tbody = document.getElementById('inscripciones-tbody');

    if (!inscripciones.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay inscriptos para esta fecha aún.</td></tr>';
      return;
    }

    tbody.innerHTML = inscripciones.map(i => `
      <tr>
        <td data-label="Emprendimiento" style="font-weight:600">${escHtml(i.nombre_emprendimiento)}</td>
        <td data-label="Rubro">${escHtml(i.rubro)}</td>
        <td data-label="Espacio"><span class="espacio-pill">${espacioLabel(i.tipo_espacio)}</span></td>
        <td data-label="Tablón">${i.necesita_tablon ? '<span style="color:var(--success);font-weight:700">✓ Sí</span>' : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td data-label="Contacto">${escHtml(i.nombre_contacto)}</td>
        <td data-label="Email"><a href="mailto:${escHtml(i.email)}">${escHtml(i.email)}</a></td>
        <td data-label="Teléfono">${escHtml(i.telefono) || '—'}</td>
        <td data-label="Inscripto" style="white-space:nowrap;font-size:.8rem;color:var(--gray-500)">${formatDateTime(i.created_at)}</td>
      </tr>
    `).join('');
  } catch {
    document.getElementById('inscripciones-tbody').innerHTML =
      '<tr><td colspan="8" class="empty-state">Error al cargar los inscriptos.</td></tr>';
  }
}

function cerrarModalInscripciones() {
  document.getElementById('modal-inscripciones').classList.add('hidden');
}

// ── Feriantes table ───────────────────────────────────────────────────────────

async function loadFeriantes() {
  const tbody = document.getElementById('feriantes-tbody');
  try {
    const feriantes = await apiFetch('/api/admin/feriantes');
    document.getElementById('feriantes-count').textContent = `${feriantes.length} registrados`;

    if (!feriantes.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No hay feriantes registrados aún.</td></tr>';
      return;
    }
    tbody.innerHTML = feriantes.map(f => `
      <tr>
        <td data-label="Emprendimiento" style="font-weight:600">${escHtml(f.nombre_emprendimiento)}</td>
        <td data-label="Rubro">${escHtml(f.rubro)}</td>
        <td data-label="Espacio(s)">${espaciosUsadosLabel(f.espacios_usados)}</td>
        <td data-label="Tablón">${f.alguna_vez_tablon ? '<span style="color:var(--success);font-weight:700">✓ Sí</span>' : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td data-label="Contacto">${escHtml(f.nombre_contacto)}</td>
        <td data-label="Email"><a href="mailto:${escHtml(f.email)}">${escHtml(f.email)}</a></td>
        <td data-label="Teléfono">${escHtml(f.telefono) || '—'}</td>
        <td data-label="Ferias" style="font-size:.8rem">${f.ferias_inscriptas ? escHtml(f.ferias_inscriptas) : '—'}</td>
        <td data-label="Registrado" style="white-space:nowrap;font-size:.8rem;color:var(--gray-500)">${formatDateTime(f.created_at)}</td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Error al cargar los feriantes.</td></tr>';
  }
}

// ── Password change ───────────────────────────────────────────────────────────

async function handlePwdSubmit(e) {
  e.preventDefault();
  const msgDiv = document.getElementById('pwd-msg');
  const current = document.getElementById('pwd-current').value;
  const nueva = document.getElementById('pwd-nueva').value;
  const confirmar = document.getElementById('pwd-confirmar').value;

  if (nueva !== confirmar) {
    msgDiv.innerHTML = '<div class="form-error">Las contraseñas nuevas no coinciden.</div>';
    return;
  }
  if (nueva.length < 6) {
    msgDiv.innerHTML = '<div class="form-error">La nueva contraseña debe tener al menos 6 caracteres.</div>';
    return;
  }

  try {
    const res = await fetch('/api/admin/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, nueva })
    });
    const data = await res.json();
    if (data.success) {
      msgDiv.innerHTML = '<div style="color:var(--success);font-size:.875rem;margin-bottom:.75rem">✅ Contraseña actualizada correctamente.</div>';
      e.target.reset();
    } else {
      msgDiv.innerHTML = `<div class="form-error">${escHtml(data.error)}</div>`;
    }
  } catch {
    msgDiv.innerHTML = '<div class="form-error">Error al actualizar. Intentá nuevamente.</div>';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
  return res.json();
}

function formatearFecha(fechaStr) {
  const [year, month, day] = fechaStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatearPrecio(precio) {
  return Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function espacioLabel(tipo) {
  return { tablon: 'Tablón', perchero: 'Perchero', tablon_y_perchero: 'Tablón y Perchero' }[tipo] || (tipo ? tipo : '—');
}

function espaciosUsadosLabel(str) {
  if (!str) return '—';
  const unicos = [...new Set(str.split(',').filter(Boolean))];
  return unicos.map(e => `<span class="espacio-pill">${espacioLabel(e)}</span>`).join(' ');
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  const { authenticated, feriante } = await fetch('/api/feriantes/check').then(r => r.json());
  if (!authenticated || !feriante) { window.location.href = '/login.html'; return; }

  await initNav();

  document.getElementById('welcome-nombre').textContent = `¡Hola, ${feriante.nombre_emprendimiento}! 👋`;
  document.getElementById('welcome-rubro').innerHTML = `🏷️ ${escHtml(feriante.rubro)}`;
  document.getElementById('welcome-contacto').innerHTML = `✉️ ${escHtml(feriante.email)}`;

  loadFeriasDisponibles();
  loadMisInscripciones();
})();

// ── Ferias disponibles ────────────────────────────────────────────────────────

async function loadFeriasDisponibles() {
  const container = document.getElementById('ferias-disponibles');
  try {
    const [ferias, misInscripciones] = await Promise.all([
      fetch('/api/ferias').then(r => r.json()),
      fetch('/api/feriantes/mis-inscripciones').then(r => r.json())
    ]);
    const inscriptaIds = new Set(misInscripciones.map(i => i.id));
    if (!ferias.length) {
      container.innerHTML = '<p class="empty-state">No hay fechas disponibles en este momento. Volvé pronto.</p>';
      return;
    }
    container.innerHTML = ferias.map(f => {
      const yaInscripto = inscriptaIds.has(f.id);
      return `
        <div class="feria-item" id="feria-item-${f.id}">
          <div class="feria-item-row">
            <div>
              <div class="feria-item-date">📅 ${formatearFecha(f.fecha)}</div>
              <div class="feria-item-details">
                <span>📍 ${escHtml(f.lugar)}</span>
                <span>💰 ${formatearPrecio(f.precio)}</span>
              </div>
            </div>
            <div class="feria-item-actions" id="actions-${f.id}">
              ${yaInscripto
                ? '<span class="badge-inscripto">✓ Ya inscripto</span>'
                : `<button class="btn btn-primary btn-sm" onclick="mostrarEspacio('${f.id}')">Inscribirme</button>`
              }
            </div>
          </div>
          ${yaInscripto ? '' : `
          <div class="espacio-selector hidden" id="espacio-sel-${f.id}">
            <div class="espacio-selector-title">¿Qué espacio necesitás para esta fecha?</div>
            <div class="espacio-checks">
              <label class="espacio-check-label" id="lbl-esp-tablon-${f.id}">
                <input type="checkbox" id="esp-tablon-${f.id}"
                  onchange="toggleCheckStyle('lbl-esp-tablon-${f.id}', this.checked)">
                <span class="espacio-check-text">🪑 Espacio de tablón</span>
              </label>
              <label class="espacio-check-label" id="lbl-esp-perchero-${f.id}">
                <input type="checkbox" id="esp-perchero-${f.id}"
                  onchange="toggleCheckStyle('lbl-esp-perchero-${f.id}', this.checked)">
                <span class="espacio-check-text">🧥 Espacio de perchero</span>
              </label>
              <label class="espacio-check-label" id="lbl-nec-tablon-${f.id}">
                <input type="checkbox" id="nec-tablon-${f.id}"
                  onchange="toggleCheckStyle('lbl-nec-tablon-${f.id}', this.checked)">
                <span class="espacio-check-text">🪑 Necesito tablón</span>
              </label>
            </div>
            <div id="espacio-err-${f.id}" class="form-error hidden"></div>
            <div class="espacio-selector-actions">
              <button class="btn btn-ghost btn-sm" onclick="ocultarEspacio('${f.id}')">Cancelar</button>
              <button class="btn btn-primary btn-sm" onclick="confirmarInscripcion('${f.id}')">Confirmar inscripción</button>
            </div>
          </div>`}
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">Error al cargar las ferias.</p>';
  }
}

function toggleCheckStyle(lblId, checked) {
  const lbl = document.getElementById(lblId);
  if (lbl) lbl.classList.toggle('checked', checked);
}

function mostrarEspacio(feriaId) {
  document.getElementById(`espacio-sel-${feriaId}`)?.classList.remove('hidden');
  const btn = document.querySelector(`#actions-${feriaId} button`);
  if (btn) btn.style.display = 'none';
}

function ocultarEspacio(feriaId) {
  document.getElementById(`espacio-sel-${feriaId}`)?.classList.add('hidden');
  const btn = document.querySelector(`#actions-${feriaId} button`);
  if (btn) btn.style.display = '';
  // Reset all three checkboxes
  ['esp-tablon','esp-perchero','nec-tablon'].forEach(t => {
    const cb = document.getElementById(`${t}-${feriaId}`);
    if (cb) { cb.checked = false; toggleCheckStyle(`lbl-${t}-${feriaId}`, false); }
  });
  document.getElementById(`espacio-err-${feriaId}`)?.classList.add('hidden');
}

async function confirmarInscripcion(feriaId) {
  const tieneTablon   = document.getElementById(`esp-tablon-${feriaId}`)?.checked;
  const tienePerchero = document.getElementById(`esp-perchero-${feriaId}`)?.checked;
  const necesita_tablon = document.getElementById(`nec-tablon-${feriaId}`)?.checked;
  const errDiv        = document.getElementById(`espacio-err-${feriaId}`);

  if (!tieneTablon && !tienePerchero && !necesita_tablon) {
    errDiv.textContent = 'Seleccioná al menos una opción.';
    errDiv.classList.remove('hidden');
    return;
  }
  errDiv.classList.add('hidden');

  // tipo_espacio sólo viene de los checkboxes "Espacio de..."
  const tipo_espacio = tieneTablon && tienePerchero ? 'tablon_y_perchero'
                     : tieneTablon ? 'tablon'
                     : tienePerchero ? 'perchero'
                     : '';

  const confirmBtn = document.querySelector(`#espacio-sel-${feriaId} .btn-primary`);
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '…'; }

  try {
    const res = await fetch('/api/feriantes/inscribirse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feria_id: feriaId, tipo_espacio, necesita_tablon })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`espacio-sel-${feriaId}`)?.classList.add('hidden');
      document.getElementById(`actions-${feriaId}`).innerHTML = '<span class="badge-inscripto">✓ Ya inscripto</span>';
      mostrarModalExito(data.feria, tipo_espacio, necesita_tablon);
      loadMisInscripciones();
    } else {
      errDiv.textContent = data.error || 'No se pudo procesar la inscripción.';
      errDiv.classList.remove('hidden');
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmar inscripción'; }
    }
  } catch {
    errDiv.textContent = 'Error de conexión. Intentá nuevamente.';
    errDiv.classList.remove('hidden');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmar inscripción'; }
  }
}

// ── Mis inscripciones ─────────────────────────────────────────────────────────

async function loadMisInscripciones() {
  const container = document.getElementById('mis-inscripciones');
  const espacioLabels = { tablon: '🪑 Tablón', perchero: '🧥 Perchero', tablon_y_perchero: '🛒 Tablón y Perchero' };
  try {
    const inscripciones = await fetch('/api/feriantes/mis-inscripciones').then(r => r.json());
    if (!inscripciones.length) {
      container.innerHTML = '<p class="empty-state">Todavía no te inscribiste a ninguna feria. ¡Elegí una fecha arriba!</p>';
      return;
    }
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    container.innerHTML = inscripciones.map(f => {
      const [y, m, d] = f.fecha.split('-').map(Number);
      const pasada = new Date(y, m - 1, d) < hoy;
      return `
        <div class="feria-item">
          <div>
            <div class="feria-item-date">📅 ${formatearFecha(f.fecha)}</div>
            <div class="feria-item-details">
              <span>📍 ${escHtml(f.lugar)}</span>
              <span>💰 ${formatearPrecio(f.precio)}</span>
                ${espacioLabels[f.tipo_espacio] ? `<span>${espacioLabels[f.tipo_espacio]}</span>` : ''}
                ${f.necesita_tablon ? '<span style="color:var(--primary);font-weight:600">🪑 Necesita tablón</span>' : ''}
            </div>
          </div>
          <div class="feria-item-actions">
            ${pasada
              ? '<span class="badge-pasada">Finalizada</span>'
              : `<button class="btn btn-ghost btn-sm" onclick="cancelarInscripcion('${f.id}', this)">Cancelar</button>`
            }
          </div>
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">Error al cargar tus inscripciones.</p>';
  }
}

// ── Cancelar inscripción ──────────────────────────────────────────────────────

async function cancelarInscripcion(feriaId, btn) {
  if (!confirm('¿Cancelar tu inscripción a esta feria?')) return;
  btn.disabled = true;
  try {
    await fetch(`/api/feriantes/inscripciones/${feriaId}`, { method: 'DELETE' });
    loadFeriasDisponibles();
    loadMisInscripciones();
  } catch {
    alert('Error al cancelar. Intentá nuevamente.');
    btn.disabled = false;
  }
}

// ── Modal éxito inscripción ───────────────────────────────────────────────────

const espacioLabelsModal = { tablon: '🪑 Tablón', perchero: '🧥 Perchero', tablon_y_perchero: '🛒 Tablón y Perchero' };

function mostrarModalExito(feria, tipo_espacio, necesita_tablon) {
  document.getElementById('modal-feria-titulo').textContent =
    `¡Tu inscripción a la feria del ${formatearFecha(feria.fecha)} fue confirmada!`;
  document.getElementById('modal-feria-detail').innerHTML = `
    <div class="modal-feria-card">
      <div class="modal-feria-header">📅 ${formatearFecha(feria.fecha)}</div>
      <div class="modal-feria-detail">📍 ${escHtml(feria.lugar)}</div>
      <div class="modal-feria-detail">💰 Precio del espacio: ${formatearPrecio(feria.precio)}</div>
      ${tipo_espacio ? `<div class="modal-feria-detail">${espacioLabelsModal[tipo_espacio]}</div>` : ''}
      ${necesita_tablon ? '<div class="modal-feria-detail" style="color:var(--primary);font-weight:600">🪑 Necesita tablón provisto</div>' : ''}
      <div class="modal-rec-title">📝 Recomendaciones para el día</div>
      <div class="modal-rec-text">${escHtml(feria.recomendaciones)}</div>
    </div>`;
  document.getElementById('modal-inscripcion').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModalInscripcion() {
  document.getElementById('modal-inscripcion').classList.add('hidden');
  document.body.style.overflow = '';
}
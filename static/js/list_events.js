// scrip para las funciones del listado de eventos
let events = [];//eventos
let eventToDelete = null;//eliminar
let searchDebounce = null;

//no depende de las funciones de la pagina principal
function getEl(id) { return document.getElementById(id); }

//animacion para que se muestre o esconda el menu
document.querySelector('.menu-icon')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('collapsed');
    document.querySelector('.menu-icon')?.classList.toggle('rotated');
});

//cerrar modales
function closeModal() {
    getEl('edit-modal')?.style && (getEl('edit-modal').style.display = 'none');
    getEl('delete-confirm-modal')?.style && (getEl('delete-confirm-modal').style.display = 'none');
}

//funcion para traer los eventos
function fetchEvents(featuredOnly = false) {
    fetch(`/list_events?featured=${featuredOnly}`)
        .then(res => res.json())
        .then(data => {
            events = data.events || [];
            renderEventsList();
        })
        .catch(() => {
            events = [];
            renderEventsList();
        });
}

//renderiza todos los ventos que se garegaron al calendario para mostrarlos en una lista 
function renderEventsList() {
    const container = getEl('events-container');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p class="no-events">No hay eventos.</p>';
        return;
    }

    container.innerHTML = events.map(ev => `
        <div class="event-card" data-title="${ev.title}">
            <div class="event-card-info">
                <h3>${ev.title} ${ev.featured ? '<span class="featured">⭐</span>' : ''}</h3>
                <p class="date"> ${ev.date}</p>
                <p>${ev.description || ''}</p>
            </div>
            <div class="event-actions">
                <button class="btn-edit"
                    onclick="editEvent('${ev.title.replace(/'/g,"\\'")}',
                                      '${ev.date}',
                                      '${(ev.description||'').replace(/'/g,"\\'")}',
                                      ${ev.featured})">
                    Editar
                </button>
                <button class="btn-delete"
                    onclick="deleteEvent('${ev.title.replace(/'/g,"\\'")}', '${ev.date}')">
                    Eliminar
                </button>
            </div>
        </div>`).join('');
}

function showEventList(featuredOnly) { fetchEvents(featuredOnly); }

//ontiene los id de cada elemento de un evento para editarlo
function editEvent(title, date, description, featured) {
    getEl('edit-modal').style.display  = 'flex';
    getEl('edit-title').value          = title;
    getEl('edit-desc').value           = description;
    getEl('edit-date').value           = date;
    getEl('edit-featured').checked     = featured;
    getEl('edit-form').setAttribute('data-original-title', title);
    getEl('edit-form').setAttribute('data-original-date',  date);
}

//editar un evento
getEl('edit-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        title:           form.getAttribute('data-original-title'),
        date:            form.getAttribute('data-original-date'),
        new_title:       getEl('edit-title').value,
        new_date:        getEl('edit-date').value,
        new_description: getEl('edit-desc').value,
        new_featured:    getEl('edit-featured').checked
    };
    fetch('/update_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => { closeModal(); fetchEvents(); });
});

//eliminar evento
function deleteEvent(title, date) {
    eventToDelete = { title, date };
    getEl('delete-confirm-modal').style.display = 'flex';
}

//confirmar la eliminacion de un evnto
getEl('confirm-delete-btn')?.addEventListener('click', function() {
    if (!eventToDelete) return;
    fetch('/delete_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventToDelete)
    }).then(() => {
        eventToDelete = null;
        closeModal();
        fetchEvents();
    });
});

//buscardor directamente en la base de datos
getEl('search-input')?.addEventListener('input', function() {
    const text = this.value.trim();
    const box  = getEl('search-results');
    if (!box) return;

    if (!text) { box.style.display = 'none'; return; }

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => searchEvents(text), 300);
});
//busqueda
function searchEvents(query) {
    fetch(`/search_events?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => showSearchResults(data.events || []))
        .catch(() => showSearchResults([]));
}
//resultados de la busqueda
function showSearchResults(results) {
    const box = getEl('search-results');
    if (!box) return;

    if (results.length === 0) {
        box.innerHTML = "<div class='search-item'>No se encontraron eventos</div>";
        box.style.display = 'block';
        return;
    }

    box.innerHTML = results.map(ev => `
        <div class="search-item" onclick="highlightEvent('${ev.title.replace(/'/g,"\\'")}')">
            <strong>${ev.title}</strong>
            ${ev.featured ? '<span style="font-size:11px;">⭐</span>' : ''}
            <br>
            <small>📅 ${ev.date}</small>
            ${ev.description
                ? `<br><small style="color:#888;">${ev.description.substring(0,50)}${ev.description.length>50?'...':''}</small>`
                : ''}
        </div>`).join('');

    box.style.display = 'block';
}

// Resalta y hace scroll a la tarjeta encontrada
function highlightEvent(title) {
    // Cierra el buscador
    const box = getEl('search-results');
    if (box) box.style.display = 'none';
    const input = getEl('search-input');
    if (input) input.value = '';

    // Busca la tarjeta en la lista
    const cards = document.querySelectorAll('.event-card');
    cards.forEach(card => {
        const cardTitle = card.querySelector('h3')?.textContent?.trim() || '';
        if (cardTitle.toLowerCase().includes(title.toLowerCase())) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'border 0.3s, box-shadow 0.3s';
            card.style.border     = '1px solid #8b5cf6';
            card.style.boxShadow  = '0 0 14px rgba(139,92,246,0.35)';
            setTimeout(() => {
                card.style.border    = '';
                card.style.boxShadow = '';
            }, 2500);
        }
    });
}

// Cierra resultados al click fuera
document.addEventListener('click', (e) => {
    const box   = getEl('search-results');
    const input = getEl('search-input');
    if (box && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
    }
});

//iniciar
fetchEvents();
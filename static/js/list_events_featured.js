// scrip para las funciones del listado de eventos destacados
let events = []; //eventos
let eventToDelete = null; //eliminar
let searchDebounce = null; //buscar evento

function getEl(id) { return document.getElementById(id); }

//funcion para traer los eventos
function fetchEvents(featuredOnly = true) {  // Cambiado a true por defecto para destacados
    fetch(`/list_events?featured=${featuredOnly}`).then(res => res.json()).then(data => {
        events = data.events || [];
        renderEventsList();
    }).catch(() => {
        events = [];
        renderEventsList();
    });
}

//renderiza todos los ventos que se garegaron l calendario para mostrarlos en una lista 
function renderEventsList() {
    const container = document.getElementById('events-container');
    if (events.length === 0) { //si no hay ningun evento aun
        container.innerHTML = '<p class="no-events">No hay eventos destacados.</p>';
        return;
    }
    let html = '';
    events.forEach(ev => {
        const featuredIcon = ev.featured ? '<span class="featured">⭐</span>' : ''; //crea un html para mostrar los eventos
        html += `
                    <div class="event-card">
                        <div>
                            <h3>${ev.title} ${featuredIcon}</h3> 
                            <p class="date">${ev.date}</p>
                            <p>${ev.description}</p>
                        </div>
                        <div class="event-actions">
                            <button class="btn-edit" onclick="editEvent('${ev.title}', '${ev.date}', '${ev.description}', ${ev.featured})">Editar</button>
                            <button class="btn-delete" onclick="deleteEvent('${ev.title}', '${ev.date}')">Eliminar</button>
                        </div>
                    </div>
                `;
    });
    container.innerHTML = html;
}

//ontiene los id de cada elemento de un evento para editarlo
function editEvent(title, date, description, featured) {
    document.getElementById('edit-modal').style.display = 'flex';
    document.getElementById('edit-title').value = title;
    document.getElementById('edit-desc').value = description;
    document.getElementById('edit-date').value = date;
    document.getElementById('edit-featured').checked = featured;
    document.getElementById('edit-form').setAttribute('data-original-title', title);
    document.getElementById('edit-form').setAttribute('data-original-date', date);
}

//llama al modal de  confirmacion para elimnar 
function deleteEvent(title, date) {
    eventToDelete = { title, date };

    document.getElementById("delete-confirm-modal").style.display = "flex";
}

//muestra los eventos
function showEventList(featuredOnly) {
    fetchEvents(featuredOnly);
}

//cerrar modales
function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('delete-confirm-modal').style.display = 'none';
}

//editar un evento
document.getElementById('edit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        title: form.getAttribute('data-original-title'),
        date: form.getAttribute('data-original-date'),
        new_title: document.getElementById('edit-title').value,
        new_date: document.getElementById('edit-date').value,
        new_description: document.getElementById('edit-desc').value,
        new_featured: document.getElementById('edit-featured').checked
    };
    //manda el formulario al backend para guaradrlo y remplazar el evento
    fetch('/update_event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(() => { closeModal(); fetchEvents(); });
});

//animacion para que se muestre o esconda el menu
document.querySelector('.menu-icon').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const menuIcon = document.querySelector('.menu-icon');
    sidebar.classList.toggle('collapsed');
    menuIcon.classList.toggle('rotated');
});

//confirmar la eliminacion de un evento 
document.getElementById("confirm-delete-btn").addEventListener("click", function () {

    if (!eventToDelete) return;
    //se llama el backend para que lo elimine de la base de datos
    fetch('/delete_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventToDelete)
    })
        .then(() => {
            closeModal();
            fetchEvents();
            loadRecommendations();
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

    if (results.length === 0) { // si no se encontro nada 
        box.innerHTML = "<div class='search-item'>No se encontraron eventos</div>";
        box.style.display = 'block';
        return;
    }
    //muestra los resultados en forma de burbuja debjao del buscador
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

// Resalta y hace scroll a la tarjeta encontrada dentro del listado de eventos
function highlightEvent(title) {
    // Cierra el buscador
    const box = getEl('search-results');
    if (box) box.style.display = 'none';
    const input = getEl('search-input');
    if (input) input.value = '';

    // Busca la tarjeta 
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

// Cierra resultados al click fuera del buscador
document.addEventListener('click', (e) => {
    const box   = getEl('search-results');
    const input = getEl('search-input');
    if (box && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
    }
});
// Cargar lista al inicio (solo destacados)
fetchEvents(true);
// scrip para las funciones del listado de eventos recomendados guardados
let savedEventToDelete = null; // guarda el título del evento a eliminar

//carga los eventos guardados
function loadSavedEvents() {
    fetch('/get_saved_events')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('events-container');

            if (!data.saved_events || data.saved_events.length === 0) { //si no hay eventos
                container.innerHTML = `
                        <div class="no-events">
                            <p>No tienes eventos guardados aún.</p>
                            <p style="font-size:14px; margin-top:8px;">
                                Explora las recomendaciones y guarda los que te interesen ✦
                            </p>
                        </div>`;
                return;
            }
            //si se encuentran eentos 
            let html = '';

            data.saved_events.forEach(ev => {
                html += `
                        <div class="event-card">
                            <div class="event-card-info">
                                <h3>${ev.title}</h3>
                                <p>${ev.description || 'Sin descripción'}</p>
                                <p class="date">📅 ${ev.date || 'Fecha no disponible'}</p>
                                <p>📍 ${ev.venue || 'Lugar no disponible'}</p>
                                <p class="saved-at">Guardado el ${ev.saved_at || ''}</p>
                            </div>
                            <div class="event-actions">
                                ${ev.url ? `<a href="${ev.url}" target="_blank" class="btn-tm">Ticketmaster</a>` : ''}
                                <button class="btn-delete" onclick="openDeleteSavedModal('${ev.title.replace(/'/g, "\\'")}')">
                                    Eliminar
                                </button>
                            </div>
                        </div>`;
            });

            container.innerHTML = html;
        })
        .catch(() => {
            document.getElementById('events-container').innerHTML =
                '<p class="no-events">Error al cargar los eventos guardados.</p>';
        });
}

// modal para confirmar la eliminacion de un vento guardado
function openDeleteSavedModal(title) {
    savedEventToDelete = title;
    document.getElementById('delete-saved-msg').textContent =
        `¿Estás seguro de que quieres eliminar "${title}" de tus guardados?`;
    document.getElementById('delete-saved-modal').style.display = 'flex';
}

// Cierra el modal de confirmacion d eleiminacion
function closeDeleteSavedModal() {
    savedEventToDelete = null;
    document.getElementById('delete-saved-modal').style.display = 'none';
}

//animacion para que se muestre o esconda el menu
document.querySelector('.menu-icon').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const menuIcon = document.querySelector('.menu-icon');
    sidebar.classList.toggle('collapsed');
    menuIcon.classList.toggle('rotated');
});

// eliminacion de un vento
document.getElementById('confirm-delete-saved-btn').addEventListener('click', function () {
    if (!savedEventToDelete) return;

    fetch('/delete_saved_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: savedEventToDelete })
    })
        .then(res => res.json())
        .then(data => {
            closeDeleteSavedModal();
            if (data.success) {
                loadSavedEvents(); // recarga la lista
            } else {
                alert('Error al eliminar el evento');
            }
        })
        .catch(() => {
            closeDeleteSavedModal();
            alert('Error de conexión');
        });
});


// Carga al iniciar
loadSavedEvents();
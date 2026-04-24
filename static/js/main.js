// scrip para las funciones de la pgina de inicio
//calendario
//header
//recomendaciones
let currentDate = new Date();//guarda mes y año actual
let events = [];//arreglo para almacenar eventos
let recommendations = [];//arreglo con recomendaciones de IA
let bannerInterval; 
const btnMonth = document.getElementById('btn-month');//muestra y cambia la fecha del clanedario donde se encuentre
let eventToDelete = null;// titulo del evento a elimnar
let notifications = []; 
let currentRecEvent = {}; //variable para guardar los eventos del modal actual abierto

//funcion para obtener eventos con peticion AJAX  al backend flask
function fetchEvents() {
    fetch('/get_events').then(res => res.json()).then(data => {
        //pone color de fondo alos eventos para indicar que hay eventos en esa fecha  
        events = data.events.map(e => {


            const colors = [
                { bg: "#ddb523", text: "#fafafb" },
                { bg: "#c67a3c", text: "#fafafb" },
                { bg: "#675974", text: "#fafafb" },
                { bg: "#56678e", text: "#fafafb" },
                { bg: "#3e1a5d", text: "#fafafb" }
            ];

            const random = colors[Math.floor(Math.random() * colors.length)];

            return {
                ...e,
                bgColor: random.bg,
                textColor: random.text
            };
        });
        renderCalendar();//genra calendario despues de cargar eventos
        checkUpcomingEvents();
    }).catch(() => {
        events = [];
        renderCalendar();
    });


}

//actualiza el boton de mes
function updateMonthButton() {
    const monthYearText = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    btnMonth.textContent = monthYearText;
    btnMonth.setAttribute('aria-label', `Mes actual: ${monthYearText}`);
}

//funcio para renderizar calendario 
function renderCalendar() {
    updateMonthButton();

    const month = currentDate.getMonth();//obtiene mes actual
    const year = currentDate.getFullYear();//obtiene año actual

    const firstDayIndex = new Date(year, month, 1).getDay();//dia de la seman que incia el mes
    const startDay = firstDayIndex === 0 ? 0 : firstDayIndex;//se ajusta si el mes empieza en domingo

    const lastDay = new Date(year, month + 1, 0).getDate();//ultimo dia actual
    const prevLastDay = new Date(year, month, 0).getDate();//ultimo dia del mes anterior 

    //tabla con string dinamico en html
    let htmlContent = "<thead><tr><th>DOM</th><th>LUN</th><th>MAR</th><th>MIE</th><th>JUE</th><th>VIE</th><th>SAB</th></tr></thead><tbody><tr>";
    //agrega dias del mes anterior inactivos 
    for (let i = 0; i < startDay; i++) {
        htmlContent += `<td class="inactive">${prevLastDay - startDay + i + 1}</td>`;
    }

    //genera cada dia del mes actual
    for (let day = 1; day <= lastDay; day++) {
        const thisDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === thisDate);//filtra eventos que cioncidan con esa fecha
        let eventHtml = '';
        //agrega etiquetas visuales de ventos dentro del dia 
        dayEvents.forEach(ev => {
            eventHtml += `
                        <div class="event-label"
                            style="background:${ev.bgColor}; color:${ev.textColor};"
                            title="${ev.title}">
                            ${ev.title}
                        </div>
                    `;
        });
        //se detecta si es el dia actual
        const isToday = (new Date().toDateString() === new Date(year, month, day).toDateString());

        let cellStyle = "";

        // si hay eventos  pone color ala  celda
        if (dayEvents.length > 0) {
            cellStyle += `background:${dayEvents[0].bgColor}33;`; // transparencia
        }

        if (isToday) {
            cellStyle += "box-shadow: 0 0 6px 3px #6a4fad;";
        }

       // si hay eventos agrega una clase para la version movil
        let hasEventClass = dayEvents.length > 0 ? "has-event" : "";

        htmlContent += `<td class="${hasEventClass}" style="${cellStyle}">`;
        htmlContent += `<div class="date-num">${day}</div>`;
        htmlContent += eventHtml;
        htmlContent += '</td>';

        const dayOfWeek = (startDay + day - 1) % 7;
        if (dayOfWeek === 6 && day !== lastDay) {
            htmlContent += '</tr><tr>';
        }
    }
    //completa la ultima fila con dias del mes siguiente
    const lastDayWeekday = (startDay + lastDay) % 7;
    if (lastDayWeekday !== 0) {
        for (let i = lastDayWeekday; i < 7; i++) {
            htmlContent += `<td class="inactive">${i - lastDayWeekday + 1}</td>`;
        }
    }

    htmlContent += '</tr></tbody>';

    document.getElementById('calendar-table').innerHTML = htmlContent;
    //asigna un evento clcik a cada dia activo
    const tds = document.querySelectorAll("#calendar-table tbody td:not(.inactive)");
    tds.forEach(td => {
        td.onclick = () => {
            const dayNumber = td.querySelector(".date-num").textContent;
            const clickedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            showDayEvents(clickedDate);
        };
    });
}

//funcion para efecto de banner
function toggleRecommendations() {

    const panel = document.getElementById("recommendations-panel");

    panel.classList.toggle("active");
    panel.classList.toggle("collapsed");

}

window.addEventListener("load", () => {

    const panel = document.getElementById("recommendations-panel");

    if (window.innerWidth < 900) {
        panel.classList.add("collapsed");
    } else {
        panel.classList.remove("collapsed");
    }

});

//funcion para mostra eventos del dia
function showDayEvents(date) {
    //filtra eventos del dia seleccionado
    const dayEvents = events.filter(e => e.date === date);
    document.getElementById('modal-date').textContent = date;//muesta la fceha en modal
    let listHtml = '';
    if (dayEvents.length === 0) {
        listHtml = '<p>No hay eventos para este día.</p>';
    } else {
        dayEvents.forEach(ev => {// esturctura de la ficha de cada dia si hay eventos
            listHtml += `
                        <div class="event-item">
                            <div>
                                <h4>${ev.title}</h4>
                                <p>${ev.description}</p>
                            </div>
                            <div class="event-actions">
                                <button class="btn-edit" onclick="editEvent('${ev.title}', '${ev.date}', '${ev.description}', ${ev.featured})">Editar</button>
                                <button class="btn-delete" onclick="deleteEvent('${ev.title}', '${ev.date}')">Eliminar</button>
                            </div>
                        </div>
                    `;
        });
    }
    document.getElementById('event-list').innerHTML = listHtml;
    document.getElementById('event-modal').style.display = 'flex';
}

//funcion para agregar un evento
function addEvent() {
    const form = document.getElementById('add-form');
    form.reset(); // limpia el formulario
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('add-modal').style.display = 'flex';
    document.getElementById('event-date').value = document.getElementById('modal-date').textContent;
}

//Funcion para editar un evento
function editEvent(title, date, description, featured) {
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'flex';
    document.getElementById('edit-title').value = title;
    document.getElementById('edit-desc').value = description;
    document.getElementById('edit-date').value = date;
    document.getElementById('edit-featured').checked = featured;
    document.getElementById('edit-form').setAttribute('data-original-title', title);
    document.getElementById('edit-form').setAttribute('data-original-date', date);
}

//funcion para eliminarr un evento
function deleteEvent(title, date) {
    eventToDelete = { title, date };

    document.getElementById("delete-confirm-modal").style.display = "flex";
}

//cierra cualquier modal abierto cuando entras a home desde el menu
function showHome() {
    closeModal();
}

//cerrar modales
function closeModal() {
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('rec-modal').style.display = 'none';
    document.getElementById('delete-confirm-modal').style.display = 'none';
}

// Funcion para  peticion de recomendaciones
function loadRecommendations() {
    //hace una peticion get a flask
    fetch('/get_recommendations').then(res => res.json()).then(data => {
        recommendations = data.recommendations || [];//guarda las recomendaciones recibida
        if (recommendations.length > 0) {
            startBannerRotation();
        } else {
            document.getElementById('banner-container').innerHTML = '<p>No hay recomendaciones disponibles.</p>';
        }
    });
}

//banner dinamico 
function startBannerRotation() {
    let currentIndex = 0;//indice que indica que recomendacion se esta mostrando
    const container = document.getElementById('banner-container');//contenenedor vidual del html donde esta el banner

    function showBanner() {
        if (recommendations.length === 0) return;//si no hayrecomendaciones no hace nada

        //obtiene dos recomendaciones actuales para mostrarlas juntas
        const rec1 = recommendations[currentIndex];
        const rec2 = recommendations[(currentIndex + 1) % recommendations.length];

        //inserta el banner en el div del html principal
        container.innerHTML = `
                    <div class="banner-wrapper">

                        <div class="banner" onclick="showRecDetails('${rec1.title}', '${rec1.description}', '${rec1.date}', '${rec1.venue}', '${rec1.url}')">
                            <img src="${rec1.image}" class="banner-img"> 
                            <h3>${rec1.title}</h3>
                            <p class="date">${rec1.date}</p>
                            <p>${rec1.venue}</p>
                        </div>

                        <div class="banner" onclick="showRecDetails('${rec2.title}', '${rec2.description}', '${rec2.date}', '${rec2.venue}', '${rec2.url}')">
                            <img src="${rec2.image}" class="banner-img"> 
                            <h3>${rec2.title}</h3>
                            <p class="date">${rec2.date}</p>
                            <p>${rec2.venue}</p>
                        </div>

                    </div>
                `;
        //algoritmo modular cuando llega al final del arreglo vuelve a comenzar
        currentIndex = (currentIndex + 1) % recommendations.length;
    }

    showBanner(); // Mostrar primero
    bannerInterval = setInterval(showBanner, 6000); // Cambiar cada 5 segundos
}

//funcion para mostrar los detalles de la recomendacion
function showRecDetails(title, description, date, venue, url) {

    currentRecEvent = { title, description, date, venue, url };

    document.getElementById('rec-modal-title').textContent = title;
    document.getElementById('rec-modal-desc').textContent = description;
    document.getElementById('rec-modal-date').textContent = date;
    document.getElementById('rec-modal-venue').textContent = venue;
    document.getElementById('rec-modal-link').href = url;
    document.getElementById('rec-modal').style.display = 'flex';

     const btn = document.getElementById('btn-save-rec');
    btn.classList.remove('saved');
    btn.title = 'Guardar evento';
 
    document.getElementById('rec-modal').style.display = 'flex';

    /*
    //registra el click en la base de datos
    fetch('/track_rec_click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, venue, url })
    }).catch(err => console.warn('No se pudo registrar el click:', err));
    */
}

//funcion para guardar el evento recomendado
function saveRecommendedEvent() {
 
    const btn = document.getElementById('btn-save-rec');
 
    // Si ya esta guardado no hace nada
    if (btn.classList.contains('saved')) return;
 
    fetch('/save_recommended_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentRecEvent)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Cambia el boton a estado de guardado
            btn.classList.add('saved');
            btn.title = 'Evento guardado';
        } else if (data.error === 'Ya guardado') {
            // Ya existía, igual lo marca visualmente
            btn.classList.add('saved');
            btn.title = 'Ya guardado';
        } else {
            alert('Error al guardar el evento');
        }
    })
    .catch(() => alert('Error de conexión'));
}

//formulario agregar un evento al calendario 
document.getElementById('add-form').addEventListener('submit', function (e) {
    e.preventDefault();//evita que se recargue la pagina
    const data = {//construye el objeto
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-desc').value,
        date: document.getElementById('event-date').value,
        featured: document.getElementById('event-featured').checked
    };
    //envia los datos al back end 
    fetch('/add_event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(() => { closeModal(); fetchEvents(); }); loadRecommendations();
});

//formulario editar un evento del calendario 
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
    fetch('/update_event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(() => { closeModal(); fetchEvents(); });
});

//animacion para navegar estre meses
document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    fetchEvents();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    fetchEvents();
});

//animacion del menu lateral 
document.querySelector('.menu-icon').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const menuIcon = document.querySelector('.menu-icon');
    sidebar.classList.toggle('collapsed');//contrae y expande 
    menuIcon.classList.toggle('rotated');//rota el icono 
});

//confirmar la eliminacion de un evento 
document.getElementById("confirm-delete-btn").addEventListener("click", function () {

    if (!eventToDelete) return;

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

//buscar eventos  
const searchInput = document.getElementById("search-input");
const resultsBox = document.getElementById("search-results");

searchInput.addEventListener("input", function () {

    const text = this.value.toLowerCase().trim();

    if (text === "") {
        resultsBox.style.display = "none";
        return;
    }

    const filtered = events.filter(ev =>
        ev.title.toLowerCase().includes(text)
    );

    showSearchResults(filtered);
});

//muestra los resultados de la busqueda 
function showSearchResults(results) {

    if (results.length === 0) {
        resultsBox.innerHTML = "<div class='search-item'>No se encontraron eventos</div>";
        resultsBox.style.display = "block";
        return;
    }

    let html = "";

    results.forEach(ev => {

        html += `
                <div class="search-item" onclick="goToEvent('${ev.date}')">
                    <strong>${ev.title}</strong><br>
                    <small>${ev.date}</small>
                </div>
                `;
    });

    resultsBox.innerHTML = html;
    resultsBox.style.display = "block";
}
//se direje al avento al buscarlo//
function goToEvent(date) {

    resultsBox.style.display = "none";
    showDayEvents(date);
}


//notificaciones
function checkUpcomingEvents() {

    const today = new Date();

    notifications = [];

    events.forEach(ev => {

        const eventDate = new Date(ev.date);
        const diffTime = eventDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

       
        if (diffDays >= 0 && diffDays <= 3) {

            notifications.push({
                title: ev.title,
                date: ev.date,
                message: `Tu evento "${ev.title}" es en ${diffDays} día(s)`
            });
        }
    });

    updateNotificationUI();
}

function updateNotificationUI() {

    const count = document.getElementById("notif-count");
    const panel = document.getElementById("notif-panel");

    count.textContent = notifications.length;

    if (notifications.length === 0) {
        count.style.display = "none";
        panel.innerHTML = "<p>No hay notificaciones</p>";
        return;
    }

    count.style.display = "inline-block";
     //muestra eventos sercanos en forma de burbuja
    let html = "";

    notifications.forEach(n => {
        html += `
                    <div class="notif-item">
                        <strong>${n.title}</strong><br>
                        <small>${n.message}</small>
                    </div>
                `;
    });

    panel.innerHTML = html;
}

function toggleNotifications() {

    const panel = document.getElementById("notif-panel");

    panel.style.display = panel.style.display === "block" ? "none" : "block";
}

/*
//FUNCION EXTRA PARA GENERAR ESTADISTICAS 
function loadRecStats() {
    fetch('/rec_stats')
        .then(res => res.json())
        .then(data => {
            console.table(data.stats); 
            
        })
        .catch(err => console.warn('Error cargando estadísticas:', err));
}
*/
// Iniciar
fetchEvents();
loadRecommendations();
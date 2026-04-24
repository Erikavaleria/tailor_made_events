#CODIGO PRINCIPAL
#flask cre la app, renderiza html, recibe los datos del usuario con formularios JSON,genera url internas
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_bcrypt import Bcrypt #libreria para encriptar contraseñas
#librerias para formularios
from flask_wtf import FlaskForm 
from wtforms import StringField, PasswordField, SubmitField, SelectMultipleField, IntegerField, RadioField, SelectField, FileField
from wtforms.validators import DataRequired, Email, Length, EqualTo, NumberRange, Optional
from wtforms.widgets import ListWidget, CheckboxInput
from pymongo import MongoClient #conecta a la base de datos
import os #para variables de entorno
#libreria para usar API KEY de Ticketmaster
from dotenv import load_dotenv
load_dotenv()
import requests #peticiones HTTP para consultar la API
from sklearn.feature_extraction.text import TfidfVectorizer #convierte texto a vectores numericos
from sklearn.metrics.pairwise import cosine_similarity #verifica que tan similares son los textos
import numpy as np #operaciones matematicas
import random  # Para rotar recomendaciones aleatoriamente aun pendiente
from werkzeug.utils import secure_filename #libreria para imagenes
import re
from datetime import datetime


#CREACION DE LA APP
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
bcrypt = Bcrypt(app) #hash de contraseñas

#MongoDB Atlas
MONGO_URI = os.getenv('MONGO_URI')
# Configuracion API de ticketmaster llamando al API KEY en el archivo .env
TICKETMASTER_API_KEY = os.getenv('TICKETMASTER_API_KEY') 

#VARIABLES
client = MongoClient(MONGO_URI) 
db = client.flask_login #nombre de base de datos "flask_login"
users_collection = db.users  #usuarios en la base de datos
events_collection = db.events #eventos guardados por el usuario
rec_clicks_collection = db.rec_clicks #coleccion para contar los clicks en una recomendacion 
saved_events_collection = db.saved_events #coleccion para eventos recomendados guardados 
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

#======CLASES=====

# Formulario de login 
class LoginForm(FlaskForm):
    email = StringField('Correo electronico', validators=[DataRequired(), Email()])
    password = PasswordField('Contraseña', validators=[DataRequired()])
    submit = SubmitField('Iniciar sesión')

#Formualario de registro 
class RegisterForm(FlaskForm):
    full_name = StringField('Nombre completo ', validators=[DataRequired(), Length(min=2, max=100)])
    location = SelectField('Ubicación ', choices=[
        ('Mexico', 'México'), ('USA', 'Estados Unidos'), ('Canada', 'Canadá'), ('Spain', 'España'), ('Argentina', 'Argentina')
    ], validators=[DataRequired()])
    phone = StringField('Número de teléfono', validators=[DataRequired(), Length(min=7, max=15)])
    age = IntegerField('Edad', validators=[DataRequired(), NumberRange(min=10, max=120)])
    profile_image = FileField('Foto de perfil (opcional)') 
    submit = SubmitField('Guardar datos personales')

#formulario de preferencias 
class PreferencesForm(FlaskForm):
    interests = SelectMultipleField(
        'Intereses',
        choices=[

            ('music', 'Música'),
            ('concert', 'Conciertos'),


            ('theatre', 'Teatro'),
            ('comedy', 'Comedia'),
            ('musical', 'Musicales'),

            ('festival', 'Festivales'),
            ('family', 'Eventos familiares'),

            ('soccer', 'Fútbol'),
            ('basketball', 'Basketball'),
            ('motorsports', 'Deportes motor'),

            ('exhibition', 'Exposiciones'),
            ('culture', 'Eventos culturales')

        ],

        option_widget=CheckboxInput(),
        widget=ListWidget(prefix_label=False),
        validators=[Optional()]
    )

    favorite_genre = SelectMultipleField(
        'Género musical favorito',
        choices=[
            ('rock', 'Rock'),
            ('pop', 'Pop'),
            ('latin', 'Latino'),
            ('electronic', 'Electrónica'),
            ('jazz', 'Jazz'),
            ('classical', 'Clásica')
        ],

        option_widget=CheckboxInput(),
        widget=ListWidget(prefix_label=False),
        validators=[Optional()]
    )

    submit = SubmitField('Guardar preferencias')

#======RUTAS DE USUARIOS=====

#valida y redirecciona si ya hay una secion abierta (decide a donde mandar al usaurio)
@app.route('/')
def index():
    if 'email' in session:
        user = users_collection.find_one({'email': session['email']})
        if user:
            if 'full_name' not in user:
                return redirect(url_for('register')) #tiene datos personales
            if 'preferences' not in user:
                return redirect(url_for('preferences'))#tiene preferencias
            return render_template('profile.html', user=user)
    return redirect(url_for('login')) #si no hay sesion abierta lo manda a login

#inicio de sesion
@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()#creacion del formulario de login 

    if form.validate_on_submit(): #flask recibe el POST del formulario de login.html y se validan los datos
        user = users_collection.find_one({'email': form.email.data.lower()}) #se busca al usuario en la base de datos

        if user and bcrypt.check_password_hash(user['password'], form.password.data):#verifica la contraseña

            # se crea la sesion 
            session['email'] = user['email']

            # genera una seilla para las recomendaciones con IA esto para que cada que inicie sesion le muestre otras recomendaciones 
            session['rec_seed'] = random.randint(1, 1000000)

            #flash('Inicio de sesión exitoso', 'success')#mensaje enviado a la base.html
            return redirect(url_for('welcome'))#redirecciona ala pagina principal

        else:
            flash('Correo o contraseña incorrectos', 'danger')

    return render_template('login.html', form=form)#llama al html del frontend

#registro de nuevo usuario 
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if 'email' in session:#si el usuario ya tiene sesion iniciada no se debe volver a registrar 
        return redirect(url_for('index'))
    #se crea el formulario 
    class SignupForm(FlaskForm):
        email = StringField('Correo', validators=[DataRequired(), Email()])#campo obligatorio y en formato de correo
        password = PasswordField('Contraseña', validators=[DataRequired(), Length(min=6)])#campo obligatorio minimo 6 caracteres
        confirm_password = PasswordField('Confirmar Contraseña', validators=[DataRequired(), EqualTo('password')])#campo obligatorio compara que sean iguales las comtraseñas
        submit = SubmitField('Registrarse')#boton para enviar registro
    #instancia del formulario
    form = SignupForm()
    if form.validate_on_submit():#se busca en mongoDB el correo 
        existing_user = users_collection.find_one({'email': form.email.data.lower()})
        if existing_user:#si existe se muestra un error 
            flash('El correo ya está registrado', 'danger')
        else:#aplica algoritmo BCRYPT
            hashed_pw = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
            #inserta el usuario en la base de datos 
            users_collection.insert_one({
                'email': form.email.data.lower(),
                'password': hashed_pw
            })
            #se crea una sesion 
            session['email'] = form.email.data.lower()
            flash('Registro exitoso, por favor completa tus datos', 'success')
            return redirect(url_for('register'))
    return render_template('register.html', form=form, signup=True)

#registro de datos personales
@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'email' not in session:
        return redirect(url_for('login'))
    form = RegisterForm()
    if form.validate_on_submit():
        profile_image_path = None
        if form.profile_image.data:
            filename = secure_filename(form.profile_image.data.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            form.profile_image.data.save(filepath)
            profile_image_path = f'/static/uploads/{filename}'
        
        users_collection.update_one(
            {'email': session['email']},
            {'$set': {
                'full_name': form.full_name.data,
                'location': form.location.data,
                'phone': form.phone.data,
                'age': form.age.data,
                'profile_image': profile_image_path or '/static/img/iconoUsuario.png'
            }}
        )
        flash('Datos personales guardados', 'success')
        return redirect(url_for('preferences'))
    return render_template('register.html', form=form)


#formulario de preferencias
@app.route('/preferences', methods=['GET', 'POST'])
def preferences():

    form = PreferencesForm()

    if form.validate_on_submit():

        users_collection.update_one(
            {'email': session['email']},
            {
                '$set': {
                    'preferences.interests': form.interests.data,
                    'preferences.favorite_genre': form.favorite_genre.data
                }
            }
        )

        return redirect(url_for('welcome'))

    return render_template('preferences.html', form=form)

#pagina principal
@app.route('/welcome')
def welcome():
    if 'email' not in session: #verifica que el usuario este logeado
        return redirect(url_for('login'))
    user = users_collection.find_one({'email': session['email']})
    full_name = user.get('full_name', 'Usuario') if user else 'Usuario'
    profile_image = user.get('profile_image', '/static/default_user.png') if user else '/static/default_user.png' #busca la foto del usuario para mostrarla en el perfil
    return render_template('welcome.html', full_name=full_name, profile_image=profile_image)

#perfil de usuario 
@app.route('/profile')
def profile():
    if 'email' not in session:
        return redirect(url_for('login'))
    user = users_collection.find_one({'email': session['email']})
    return render_template('profile.html', user=user)

#editar info de usuario 
@app.route('/update_profile', methods=['POST'])
def update_profile():

    if 'email' not in session:
        return redirect(url_for('login'))

    user_email = session['email']

    full_name = request.form.get('full_name')
    phone = request.form.get('phone')
    location = request.form.get('location')
    age = request.form.get('age')

    interests = request.form.getlist('interests')
    favorite_genre = request.form.getlist('favorite_genre')

    update_data = {
        'full_name': full_name,
        'phone': phone,
        'location': location,
        'age': int(age) if age else None,
        'preferences.interests': interests,
        'preferences.favorite_genre': favorite_genre
    }

    # ACTUALIZAR IMAGEN
    if 'profile_image' in request.files:

        image = request.files['profile_image']

        if image and image.filename != '':

            filename = secure_filename(image.filename)

            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            image.save(filepath)

            update_data['profile_image'] = f'/static/uploads/{filename}'

    users_collection.update_one(
        {'email': user_email},
        {'$set': update_data}
    )


    return redirect(url_for('profile'))




#=======RUTAS DE RECOMENDACIONES======

#funcion para limpiar titulo y evitar duplicados
def normalize_title(title):
    title = title.lower()
    title = re.sub(r'\(.*?\)', '', title)  # quita paréntesis
    title = re.sub(r'[^a-z0-9\s]', '', title)  # quita símbolos
    title = title.strip()
    return title
# funcion para consultar eventos de Ticketmaster (por ciudad, palabra clave optenida por el formulario de preferencias de usuario)
def fetch_ticketmaster_events(location=None, keyword='', size=80):  # CAMBIO tamaño mayor

    url = 'https://app.ticketmaster.com/discovery/v2/events.json'

    params = {
        'apikey': TICKETMASTER_API_KEY,
        'countryCode': 'MX',
        'size': size,
        'sort': 'relevance,desc'
    }

    if keyword:
        params['keyword'] = keyword

    if location:
        params['city'] = location

    response = requests.get(url, params=params)

    if response.status_code == 200:

        data = response.json()
        events = data.get('_embedded', {}).get('events', [])

        print("Eventos encontrados:", len(events))

        formatted_events = []

        for e in events:
            try:

                formatted_events.append({

                    'title': e.get('name', 'Sin título'),

                    'description': e.get('info') or e.get('pleaseNote') or 'Sin descripción',

                    'date': e.get('dates', {}).get('start', {}).get('localDate', 'Fecha no disponible'),

                    'url': e.get('url', '#'),

                    'venue': e.get('_embedded', {}).get('venues', [{}])[0].get('name', 'Desconocido'),

                    'image': e.get('images', [{}])[0].get('url', '')

                })

            except Exception as error:
                print("Evento con error omitido:", error)

        # CAMBIO: mezclar eventos para variedad
        random.shuffle(formatted_events)

        # CAMBIO: devolver más eventos para el algoritmo
        return formatted_events[:50]

    print("Error API:", response.status_code)
    return []


# Funcion para generar recomendaciones con IA propia (similitud de coseno)
def generate_recommendations(user_email):

    random.seed(session.get('rec_seed', None))

    user = users_collection.find_one({'email': user_email})

    if not user:
        return []

    # Eventos del calendario
    user_events = list(events_collection.find(
        {'user_email': user_email},
        {'_id': 0, 'title': 1, 'description': 1}
    ))

    prefs = user.get('preferences', {})
    interests = prefs.get('interests', [])
    genres = prefs.get('favorite_genre', [])

    user_location = user.get('location', 'Mexico')

    # PERFIL DEL USUARIO
    user_profile_text = " ".join(interests + genres)

    # usar eventos del calendario para aprender gustos
    for e in user_events:

        title = e.get('title', '')
        desc = e.get('description', '')

        user_profile_text += f" {title} {desc}"

    external_events = []

    # BUSQUEDA POR INTERESES
    for kw in interests:

        results = fetch_ticketmaster_events(
            location=user_location,
            keyword=kw,
            size=40
        )

        external_events.extend(results)

    # BUSQUEDA POR GENEROS MUSICALES
    for g in genres:

        results = fetch_ticketmaster_events(
            location=user_location,
            keyword=g,
            size=40
        )

        external_events.extend(results)

    # BUSCAR EVENTOS SIMILARES A LOS DEL CALENDARIO
    for e in user_events:

        keyword = e.get('title', '')

        results = fetch_ticketmaster_events(
            location=user_location,
            keyword=keyword,
            size=20
        )

        external_events.extend(results)

    # SI NO HAY SUFICIENTES EVENTOS
    if len(external_events) < 50:

        random_events = fetch_ticketmaster_events(
            location=user_location,
            keyword='',
            size=80
        )

        external_events.extend(random_events)
    #SI LA API FALLA

    if not external_events:

        print("⚠️ API falló, usando cache")

        cached = user.get('cached_recommendations', [])

        if cached:
            random.shuffle(cached)
            return cached[:30]

        return []

    # elimina duplicados
    unique_events = {}

    for e in external_events:

        clean_title = normalize_title(e['title'])

        # si ya existe, NO lo repetimos
        if clean_title not in unique_events:
            unique_events[clean_title] = e

    external_events = list(unique_events.values())

    if not external_events:
        return []

    external_texts = [f"{e['title']} {e['description']}" for e in external_events]

    all_texts = [user_profile_text] + external_texts

    try:

        vectorizer = TfidfVectorizer(ngram_range=(1, 2))

        tfidf_matrix = vectorizer.fit_transform(all_texts)

        user_vector = tfidf_matrix[0]

        external_vectors = tfidf_matrix[1:]

        similarities = cosine_similarity(user_vector, external_vectors).flatten()

        top_indices = np.argsort(similarities)[::-1][:30]  # CAMBIO 30 recomendaciones

        recommended = [
            external_events[i] for i in top_indices if similarities[i] > 0.03
        ]

        # exploracionaleatoria
        random.shuffle(external_events)

        recommended.extend(external_events[:15])

        # quitar duplicados otra vez
        final_unique = {}

        for e in recommended:

            clean_title = normalize_title(e['title'])

            if clean_title not in final_unique:
                final_unique[clean_title] = e

        recommended = list(final_unique.values())[:30]
    
        #guarda los eventos en la base de dtaos 
        users_collection.update_one(
                {'email': user_email},
                {
                    '$set': {
                        'cached_recommendations': recommended,
                        'last_rec_update': datetime.now()
                    }
                }
            )

        return recommended

    except Exception as e:

        print(f"Error en similitud: {e}")

        cached = user.get('cached_recommendations', [])

        if cached:
            print("⚠️ usando recomendaciones guardadas")
            random.shuffle(cached)
            return cached[:30]


        random.shuffle(external_events)

        return external_events[:30]

# ruta para correr las recomendaciones una ve el usuario se logue
@app.route('/get_recommendations')
def get_recommendations():

    if 'email' not in session:
        return {'error': 'No logueado'}, 401

    recommendations = generate_recommendations(session['email'])

    return {'recommendations': recommendations}

"""
#ruta para contar los click en una recomendacion 
@app.route('/track_rec_click', methods=['POST'])
def track_rec_click():
    
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    data = request.json
 
    if not data.get('title'):
        return {'error': 'Título requerido'}, 400
 
    rec_clicks_collection.insert_one({
        'user_email': session['email'],
        'event_title': data.get('title'),
        'event_date':  data.get('date', ''),
        'event_venue': data.get('venue', ''),
        'event_url':   data.get('url', ''),
        'clicked_at':  datetime.now()
    })
 
    return {'success': True}

#ruta para generar estadistcas de los click

@app.route('/rec_stats')
def rec_stats():
  
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    pipeline = [
        {'$match': {'user_email': session['email']}},
        {'$group': {
            '_id': '$event_title',
            'clicks': {'$sum': 1},
            'last_click': {'$max': '$clicked_at'}
        }},
        {'$sort': {'clicks': -1}},
        {'$limit': 20}
    ]
 
    stats = list(rec_clicks_collection.aggregate(pipeline))
 
   
    result = []
    for s in stats:
        result.append({
            'event_title': s['_id'],
            'clicks': s['clicks'],
            'last_click': s['last_click'].strftime('%Y-%m-%d %H:%M') if s.get('last_click') else ''
        })
 
    return {'stats': result}

"""
#rutas para guardar eventos recomendados 
@app.route('/save_recommended_event', methods=['POST'])
def save_recommended_event():
   
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    data = request.json
 
    if not data.get('title'):
        return {'error': 'Título requerido'}, 400
 
    # Evita duplicados
    existing = saved_events_collection.find_one({
        'user_email': session['email'],
        'title': data['title']
    })
 
    if existing:
        return {'error': 'Ya guardado'}, 409
 
    saved_events_collection.insert_one({
        'user_email': session['email'],
        'title':       data.get('title', ''),
        'description': data.get('description', ''),
        'date':        data.get('date', ''),
        'venue':       data.get('venue', ''),
        'url':         data.get('url', ''),
        'saved_at':    datetime.now()
    })
 
    return {'success': True}

 
@app.route('/get_saved_events')
def get_saved_events():
  
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    saved = list(saved_events_collection.find(
        {'user_email': session['email']},
        {'_id': 0, 'title': 1, 'description': 1, 'date': 1, 'venue': 1, 'url': 1, 'saved_at': 1}
    ).sort('saved_at', -1))
 
   
    for s in saved:
        if s.get('saved_at'):
            s['saved_at'] = s['saved_at'].strftime('%Y-%m-%d %H:%M')
 
    return {'saved_events': saved}

#ruta para eliminar eventos guardados
@app.route('/delete_saved_event', methods=['POST'])
def delete_saved_event():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    data = request.json
 
    if not data.get('title'):
        return {'error': 'Título requerido'}, 400
 
    result = saved_events_collection.delete_one({
        'user_email': session['email'],
        'title': data['title']
    })
 
    if result.deleted_count > 0:
        return {'success': True}
    return {'error': 'Evento no encontrado'}, 404
 


#===== RUTAS DE CALENDARIO======

#ruta para ver  eventos
@app.route('/get_events')
def get_events():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
    events = list(events_collection.find({'user_email': session['email']}, {'_id': 0, 'title': 1, 'date': 1, 'description': 1, 'featured': 1}))
    return {'events': events}

#ruta para agregar evento
@app.route('/add_event', methods=['POST'])
def add_event():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
    data = request.json
    # Validación basica
    if not data.get('title') or not data.get('date'):
        return {'error': 'Título y fecha requeridos'}, 400
    # Evitar duplicados)
    existing = events_collection.find_one({'user_email': session['email'], 'title': data['title'], 'date': data['date']})
    if existing:
        return {'error': 'Evento ya existe'}, 409
    events_collection.insert_one({
        'user_email': session['email'],
        'title': data['title'],
        'date': data['date'],
        'description': data.get('description', ''),
        'featured': data.get('featured', False)
    })
    return {'success': True}

#ruta para eliminar evento
@app.route('/delete_event', methods=['POST'])
def delete_event():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
    data = request.json
    result = events_collection.delete_one({
        'user_email': session['email'],
        'title': data['title'],
        'date': data['date']
    })
    if result.deleted_count > 0:
        return {'success': True}
    return {'error': 'Evento no encontrado'}, 404

#ruta para editar evento 
@app.route('/update_event', methods=['POST'])
def update_event():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
    data = request.json
    # Validación
    if not data.get('title') or not data.get('date') or not data.get('new_title') or not data.get('new_date'):
        return {'error': 'Datos incompletos'}, 400
    result = events_collection.update_one(
        {'user_email': session['email'], 'title': data['title'], 'date': data['date']},
        {'$set': {
            'title': data['new_title'],
            'date': data['new_date'],
            'description': data.get('new_description', ''),
            'featured': data.get('new_featured', False)
        }}
    )
    if result.modified_count > 0:
        return {'success': True}
    return {'error': 'Evento no encontrado o sin cambios'}, 404

#ruta para listar todos los eventos
@app.route('/list_events_page')
def list_events_page():
    if 'email' not in session:
        return redirect(url_for('login'))
    user = users_collection.find_one({'email': session['email']})
    full_name = user.get('full_name', 'Usuario') if user else 'Usuario'
    profile_image = user.get('profile_image', '/static/default_user.png') if user else '/static/img/iconoUsuario.png'
    return render_template('lista_eventos.html', full_name=full_name, profile_image=profile_image)

@app.route('/list_events')
def list_events():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
    featured_only = request.args.get('featured', 'false').lower() == 'true'
    query = {'user_email': session['email']}
    if featured_only:
        query['featured'] = True

    events = list(
    events_collection
    .find(query, {'_id': 0, 'title': 1, 'date': 1, 'description': 1, 'featured': 1})
    .sort('date', 1)
    )
    return {'events': events}

#ruta de eventos destacados 
@app.route('/destacados_page')
def destacados_page():
    if 'email' not in session:
        return redirect(url_for('login'))
    user = users_collection.find_one({'email': session['email']})
    full_name = user.get('full_name', 'Usuario') if user else 'Usuario'
    profile_image = user.get('profile_image', '/static/default_user.png') if user else '/static/default_user.png'
    return render_template('destacados.html', full_name=full_name, profile_image=profile_image)

#ruta de eventos guardados
@app.route('/saves_page')
def saves_page():
    if 'email' not in session:
        return redirect(url_for('login'))
    user = users_collection.find_one({'email': session['email']})
    full_name = user.get('full_name', 'Usuario') if user else 'Usuario'
    profile_image = user.get('profile_image', '/static/default_user.png') if user else '/static/default_user.png'
    return render_template('save_events.html', full_name=full_name, profile_image=profile_image)

@app.route('/search_events')
def search_events():
    if 'email' not in session:
        return {'error': 'No logueado'}, 401
 
    query = request.args.get('q', '').strip()
 
    if not query:
        return {'events': []}
 
    # Busca con regex case-insensitive en título y descripción
    results = list(events_collection.find(
        {
            'user_email': session['email'],
            '$or': [
                {'title':       {'$regex': query, '$options': 'i'}},
                {'description': {'$regex': query, '$options': 'i'}}
            ]
        },
        {'_id': 0, 'title': 1, 'date': 1, 'description': 1, 'featured': 1}
    ).sort('date', 1).limit(10))
 
    return {'events': results}

#cerrar sesion
@app.route('/logout')
def logout():
    session.pop('email', None)
    flash('Sesión cerrada', 'info')
    return redirect(url_for('login'))



if __name__ == '__main__':
    app.run(debug=True)
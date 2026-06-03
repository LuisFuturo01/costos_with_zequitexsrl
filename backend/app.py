from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import io
import os
import numpy as np
from PIL import Image
from rembg import remove
from dotenv import load_dotenv

# --- IMPORTACIONES DE CLOUDINARY ---
import cloudinary
import cloudinary.uploader
# Importamos la clase CloudinaryImage para generar URLs robustas
from cloudinary import CloudinaryImage 

# Cargar variables de entorno desde .env
load_dotenv()

from database import db, init_db_data
import db_services

try:
    from image_services import obtener_colores_dominantes_avanzado, calcular_estimacion_puntadas
except ImportError:
    print("⚠️ ADVERTENCIA: image_services.py no encontrado.")

app = Flask(__name__)
# Configuración CORS
CORS(app, resources={r"/*": {"origins": "*"}}, allow_headers=["Content-Type", "skip_zrok_interstitial"])

# Cargar configuración de DB (Heterogénea: MySQL por defecto, PostgreSQL para cotizaciones/órdenes)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_MYSQL', 'mysql+pymysql://LuisFuturo01:LuisFuturo01_2025@localhost/zequicotizador')
app.config['SQLALCHEMY_BINDS'] = {
    'postgresql': os.getenv('DATABASE_POSTGRESQL', 'postgresql://postgres:LuisFuturo01_2025@localhost:5433/zequicotizador_postgre')
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# --- CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config( 
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
    api_key = os.getenv("CLOUDINARY_API_KEY"), 
    api_secret = os.getenv("CLOUDINARY_API_SECRET"), 
    secure=True
)

# ==========================================
# 🔐 AUTENTICACIÓN
# ==========================================
@app.route('/')
def index():
    return jsonify({"status": "online", "message": "Zequitex API funcionando"})

@app.route('/config/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = db_services.get_user_by_username(username)
    
    if user and check_password_hash(user.password_hash, password):
        return jsonify({"success": True, "user": {"id": user.id, "nombre": user.nombre, "usuario": user.usuario, "role": user.rol}})
    return jsonify({"success": False, "message": "Credenciales inválidas o usuario inactivo"}), 401

@app.route('/config/password', methods=['POST'])
def change_password():
    data = request.get_json()
    current = data.get('current_password')
    new_pass = data.get('new_password')
    
    users = db_services.get_all_active_users()
    target_user = None
    for u in users:
        if check_password_hash(u.password_hash, current):
            target_user = u
            break
    if target_user:
        db_services.update_user_password(target_user.id, generate_password_hash(new_pass))
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Contraseña actual incorrecta"}), 400

# ==========================================
# ⚙️ CONFIGURACIÓN E HISTORIAL
# ==========================================

@app.route('/config', methods=['GET'])
def get_config():
    precios_db = db_services.get_active_pricing()
    response = {}
    if precios_db:
        response['pricing'] = precios_db.to_dict()
    else:
        response['pricing'] = {
            "precio_stitch_1000": 0, "factor_cambio_hilo": 0, "costo_hilo_bordar": 0,
            "costo_hilo_bobina": 0, "costo_pellon": 0, "tela_estructurante": 0,
            "tela_normal": 0, "rollo_papel": 0, "costo_impresion": 0, "corte_impresion": 0
        }
    response['discounts'] = []
    response['hoops'] = []
    response['stitch_density'] = 55
    return jsonify(response)

@app.route('/config/history', methods=['GET'])
def get_price_history():
    history = db_services.get_pricing_history()
    return jsonify([h.to_dict() for h in history])

@app.route('/config', methods=['POST'])
def update_config():
    data = request.get_json()
    p = data.get('pricing', {})
    db_services.update_pricing_config(p)
    return jsonify({"success": True})

# ==========================================
# 📦 GESTIÓN DE COTIZACIONES
# ==========================================

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    try:
        if not data.get('cliente_id') or not data.get('configuracion_id'):
            return jsonify({"success": False, "message": "Faltan IDs de cliente o configuración"}), 400

        order_payload = {
            "cliente_id": data.get('cliente_id'),
            "configuracion_id": data.get('configuracion_id'),
            "nombre_trabajo": data.get('nombre_trabajo', 'Cotización'),
            "puntadas": data.get('puntadas', 0),
            "colores": data.get('colores', 1),
            "ancho": data.get('ancho', 0.0),
            "alto": data.get('alto', 0.0),
            "bastidor": data.get('bastidor', ''),
            "tipo_tela": data.get('tipo_tela', ''),
            "tiene_sublimacion": data.get('tiene_sublimacion', False),
            "cantidad": data.get('cantidad', 1),
            "precio_unitario": data.get('precio_unitario', 0.0),
            "precio_total": data.get('precio_total', 0.0),
            "datos_json": data.get('datos_json'),
            "detalles": f"{data.get('nombre_trabajo')} - Total: {data.get('precio_total')}",
            "personal_id": data.get('personal_id')
        }
        new_cotizacion = db_services.create_cotizacion(order_payload)
        return jsonify({"success": True, "id": new_cotizacion.id})
    except Exception as e:
        print("Error saving cotizacion:", e)
        return jsonify({"success": False, "message": f"Error SQL: {str(e)}"}), 500

@app.route('/orders/<int:id>', methods=['GET'])
def get_order_detail(id):
    cot = db_services.get_cotizacion_by_id(id)
    if not cot:
        return jsonify({"success": False, "message": "Cotización no encontrada"}), 404
    return jsonify(cot.to_dict())

@app.route('/clients/<int:client_id>/orders', methods=['GET'])
def get_client_orders(client_id):
    try:
        cotizaciones = db_services.get_cotizaciones_by_client(client_id)
        return jsonify([c.to_summary_dict() for c in cotizaciones])
    except Exception as e:
        print(f"Error in get_client_orders: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================
# 📋 GESTIÓN DE ÓRDENES
# ==========================================

@app.route('/ordenes', methods=['GET'])
def get_ordenes():
    try:
        ordenes = db_services.get_all_ordenes()
        return jsonify([o.to_summary_dict() for o in ordenes])
    except Exception as e:
        print(f"Error in get_ordenes: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/clients/<int:client_id>/ordenes', methods=['GET'])
def get_client_ordenes(client_id):
    ordenes = db_services.get_ordenes_by_client(client_id)
    return jsonify([o.to_summary_dict() for o in ordenes])

@app.route('/ordenes', methods=['POST'])
def create_orden():
    data = request.get_json()
    try:
        cotizacion_id = data.get('cotizacion_id')
        if not cotizacion_id:
            return jsonify({"success": False, "message": "Falta cotizacion_id"}), 400
        
        cotizacion = db_services.get_cotizacion_by_id(cotizacion_id)
        if not cotizacion:
            return jsonify({"success": False, "message": "Cotización no encontrada"}), 404
        
        existing_orden = db_services.get_orden_by_cotizacion_id(cotizacion_id)
        if existing_orden:
            return jsonify({"success": False, "message": "Ya existe una orden para esta cotización"}), 400
        
        fecha_entrega = None
        if data.get('fecha_entrega'):
            from datetime import datetime as dt
            fecha_entrega = dt.strptime(data.get('fecha_entrega'), '%Y-%m-%d').date()
        
        new_orden = db_services.create_orden(
            cotizacion_id=cotizacion_id,
            estado=data.get('estado', 'en_proceso'),
            fecha_entrega=fecha_entrega,
            detail=data.get('detail', ''),
            personal_id=data.get('personal_id')
        )
        return jsonify({"success": True, "id": new_orden.id})
    except Exception as e:
        print("Error creating orden:", e)
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500

@app.route('/ordenes/<int:id>', methods=['GET'])
def get_orden_detail(id):
    orden = db_services.get_orden_by_id(id)
    if not orden:
        return jsonify({"success": False, "message": "Orden no encontrada"}), 404
    return jsonify(orden.to_dict())

@app.route('/ordenes/<int:id>', methods=['PUT'])
def update_orden(id):
    orden = db_services.get_orden_by_id(id)
    if not orden:
        return jsonify({"success": False, "message": "Orden no encontrada"}), 404
        
    data = request.get_json()
    update_data = {}
    
    if 'estado' in data:
        if data['estado'] not in ['en_proceso', 'cancelado', 'entregado']:
            return jsonify({"success": False, "message": "Estado inválido"}), 400
        update_data['estado'] = data['estado']
    
    if 'detail' in data:
        update_data['detail'] = data['detail']
    
    if 'fecha_entrega' in data:
        if data['fecha_entrega']:
            from datetime import datetime as dt
            update_data['fecha_entrega'] = dt.strptime(data['fecha_entrega'], '%Y-%m-%d').date()
        else:
            update_data['fecha_entrega'] = None
            
    if 'personal_id' in data:
        update_data['personal_id'] = data['personal_id']
    
    try:
        updated = db_services.update_orden(id, update_data)
        return jsonify({"success": True, "orden": updated.to_dict()})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ordenes/<int:id>', methods=['DELETE'])
def delete_orden(id):
    try:
        success = db_services.delete_orden(id)
        if not success:
            return jsonify({"success": False, "message": "Orden no encontrada"}), 404
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================
# 🖼️ PROCESAMIENTO (CORREGIDO PARA URL OPTIMIZADA)
# ==========================================

@app.route('/process', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "Falta la imagen"}), 400
    
    file = request.files['image']
    
    try:
        width_req_cm = float(request.form.get('width', 10))
    except:
        return jsonify({"success": False, "message": "Ancho inválido"}), 400
    
    try:
        # 1. Eliminar Fondo
        input_image = Image.open(file.stream)
        output_image = remove(input_image) 

        # 2. Calcular Precios y Puntadas
        p = db_services.get_active_pricing()
        if not p:
            # Fallback si no hay config
            p = type('obj', (object,), {
                'precio_stitch_1000': 1.0, 'factor_cambio_hilo': 0.5, 'costo_pellon': 300.0,
                'tela_estructurante': 180.0, 'tela_normal': 18.0, 'costo_impresion': 3.0
            })

        CONSTANTE_DENSIDAD = 135 
        calculos = calcular_estimacion_puntadas(output_image, width_req_cm, CONSTANTE_DENSIDAD)
        estimated_stitches = calculos['estimatedStitches']
        real_area = calculos['realArea']
        rect_area = calculos['rectArea']
        height_req_cm = calculos['height']

        colores_detectados = obtener_colores_dominantes_avanzado(output_image)
        colors_hex = [c['hex'] for c in colores_detectados]
        num_colors = len(colores_detectados)

        costo_puntadas = (estimated_stitches / 1000) * float(p.precio_stitch_1000)
        costo_cambios_color = num_colors * float(p.factor_cambio_hilo)
        costo_pellon_unit = float(p.costo_pellon) / 1000000 
        costo_pellon_calculado = rect_area * costo_pellon_unit
        costo_pellon_final = np.ceil(costo_pellon_calculado / 0.05) * 0.05

        precio_calculado = costo_puntadas + costo_cambios_color + costo_pellon_final
        precio_final = max(precio_calculado, 10) 

        # 3. SUBIR A CLOUDINARY (Optimizado para ahorrar espacio)
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG") # Tu backend sigue enviando PNG
        buffered.seek(0)
        
        # AQUÍ ESTÁ EL TRUCO:
        upload_result = cloudinary.uploader.upload(
            buffered, 
            folder="zequitex_orders", 
            resource_type="image",
            # forzamos que se guarde como webp en sus servidores
            format="webp",       
            # forzamos que se guarde comprimido
            quality="auto",      
            # OPCIONAL: Si alguien sube una foto de 4000px, la reducimos a 1000px para ahorrar más espacio
            width=1000,          
            crop="limit"         
        )
        
        public_id = upload_result.get("public_id")

        # 4. GENERAR URL OPTIMIZADA (WebP + Calidad Auto)
        # Usamos CloudinaryImage para construir una URL absoluta y segura
        image_url = CloudinaryImage(public_id).build_url(
            secure=True,
            fetch_format="auto",  # Convierte a WebP automáticamente
            quality="auto"        # Optimiza el peso
        )

        return jsonify({
            "success": True,
            "tenia_fondo": True,
            "dims": { "width": round(width_req_cm, 2), "height": height_req_cm },
            "realArea": real_area,
            "estimatedStitches": estimated_stitches,
            "colors": colors_hex,
            "numColors": num_colors,
            "breakdown": {
                "puntadas": round(costo_puntadas, 2),
                "colores": round(costo_cambios_color, 2),
                "materiales": 0,
                "pellon": round(costo_pellon_final, 2),
                "hilos": 0, "base": 0, "tela": 0, "corte": 0
            },
            "precio_sugerido": round(precio_final, 2),
            "imagen_procesada": image_url, # URL lista para usar
            "public_id": public_id,        # ID para borrar después
            "mensaje": "Procesamiento automático"
        })

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================
# 👥 CRUD USUARIOS Y CLIENTES
# ==========================================

@app.route('/users', methods=['GET'])
def get_users():
    users = db_services.get_all_active_users()
    res = [{
        "id": u.id, 
        "nombre": u.nombre, 
        "usuario": u.usuario, 
        "role": u.rol, 
        "activo": u.activo,
        "celular": u.celular,
        "domicilio": u.domicilio
    } for u in users]
    return jsonify(res)

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    if db_services.get_user_by_username(data.get('usuario'), active_only=False):
        return jsonify({"success": False, "message": "Usuario existe"}), 400
    
    db_services.create_user(
        nombre=data.get('nombre'), 
        usuario=data.get('usuario'), 
        rol=data.get('role', 'empleado'),
        password_hash=generate_password_hash(data.get('password', '123456')), 
        celular=data.get('celular'),
        domicilio=data.get('domicilio')
    )
    return jsonify({"success": True})

@app.route('/users/<int:id>', methods=['PUT'])
def update_user(id):
    data = request.get_json()
    user = db_services.update_user(id, data)
    if not user:
        return jsonify({"success": False, "message": "Usuario no encontrado"}), 404
    return jsonify({"success": True})

@app.route('/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    u = db_services.get_user_by_id(id)
    if not u:
         return jsonify({"success": False, "message": "Usuario no encontrado"}), 404
    if u.usuario == 'admin': 
        return jsonify({"success": False, "message": "No se puede eliminar la cuenta principal de administrador"}), 400
    
    db_services.delete_user(id)
    return jsonify({"success": True})

# --- CLIENTES ---

@app.route('/clients', methods=['GET'])
def get_clients():
    clients = db_services.get_all_active_clients()
    res = [{"id":c.id, "nombre":c.nombre, "numero_referencia":c.numero_referencia, "domicilio":c.domicilio} for c in clients]
    return jsonify(res)

@app.route('/clients', methods=['POST'])
def create_client():
    data = request.get_json()
    db_services.create_client(
        nombre=data.get('nombre'), 
        numero_referencia=data.get('numero_referencia'), 
        domicilio=data.get('domicilio')
    )
    return jsonify({"success": True})

@app.route('/clients/<int:id>', methods=['PUT'])
def update_client(id):
    data = request.get_json()
    client = db_services.update_client(id, data)
    if not client:
        return jsonify({"success": False, "message": "Cliente no encontrado"}), 404
    return jsonify({"success": True})

@app.route('/clients/<int:id>', methods=['DELETE'])
def delete_client(id):
    success = db_services.delete_client(id)
    if not success:
         return jsonify({"success": False, "message": "Cliente no encontrado"}), 404
    return jsonify({"success": True})

if __name__ == '__main__':
    init_db_data(app)
    with app.app_context():
        if not db_services.get_user_by_username('admin', active_only=False):
            print("👤 Creando admin por defecto...")
            db_services.create_user(
                nombre='Administrador Principal', 
                usuario='admin', 
                rol='administrador', 
                password_hash=generate_password_hash('12345678'),
                celular=None,
                domicilio=None
            )
    app.run(
        debug=os.getenv('FLASK_DEBUG', 'True').lower() == 'true',
        host=os.getenv('FLASK_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_PORT', 5000))
    )
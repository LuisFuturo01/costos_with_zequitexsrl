from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import io
import base64
import numpy as np
from PIL import Image
from rembg import remove 

from database import db, Personal, Clientes, ConfiguracionPrecios, Ordenes, init_db_data

try:
    from image_services import obtener_colores_dominantes_avanzado, calcular_estimacion_puntadas
except ImportError:
    print("⚠️ ADVERTENCIA: image_services.py no encontrado.")

app = Flask(__name__)
CORS(app)

# Asegúrate de que esta URI sea correcta para tu entorno
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://LuisFuturo01:LuisFuturo01_2025@localhost/zequitexcotizador'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# ==========================================
# 🔐 AUTENTICACIÓN
# ==========================================
@app.route('/config/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # Validamos usuario y que 'activo' sea True
    user = Personal.query.filter_by(usuario=username, activo=True).first()
    
    if user and check_password_hash(user.password_hash, password):
        return jsonify({"success": True, "user": {"id": user.id, "nombre": user.nombre, "usuario": user.usuario, "role": user.rol}})
    return jsonify({"success": False, "message": "Credenciales inválidas o usuario inactivo"}), 401

@app.route('/config/password', methods=['POST'])
def change_password():
    data = request.get_json()
    current = data.get('current_password')
    new_pass = data.get('new_password')
    
    # Solo buscamos usuarios activos
    users = Personal.query.filter_by(activo=True).all()
    target_user = None
    for u in users:
        if check_password_hash(u.password_hash, current):
            target_user = u
            break
    if target_user:
        target_user.password_hash = generate_password_hash(new_pass)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Contraseña actual incorrecta"}), 400

# ==========================================
# ⚙️ CONFIGURACIÓN E HISTORIAL
# ==========================================

@app.route('/config', methods=['GET'])
def get_config():
    precios_db = ConfiguracionPrecios.query.filter_by(activo=True).order_by(ConfiguracionPrecios.id.desc()).first()
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
    history = ConfiguracionPrecios.query.order_by(ConfiguracionPrecios.fecha_modificacion.desc()).limit(50).all()
    return jsonify([h.to_dict() for h in history])

@app.route('/config', methods=['POST'])
def update_config():
    data = request.get_json()
    p = data.get('pricing', {})
    
    current_price = ConfiguracionPrecios.query.filter_by(activo=True).first()
    if current_price: current_price.activo = False
    
    new_price = ConfiguracionPrecios(
        precio_stitch_1000=p.get('precio_stitch_1000', 0),
        factor_cambio_hilo=p.get('factor_cambio_hilo', 0),
        costo_hilo_bordar=p.get('costo_hilo_bordar', 0),
        costo_hilo_bobina=p.get('costo_hilo_bobina', 0),
        costo_pellon=p.get('costo_pellon', 0),
        tela_estructurante=p.get('tela_estructurante', 0),
        tela_normal=p.get('tela_normal', 0),
        rollo_papel=p.get('rollo_papel', 0),
        costo_impresion=p.get('costo_impresion', 0),
        corte_impresion=p.get('corte_impresion', 0),
        activo=True,
        fecha_modificacion=datetime.utcnow()
    )
    db.session.add(new_price)
    db.session.commit()
    return jsonify({"success": True})

# ==========================================
# 📦 GESTIÓN DE ÓRDENES
# ==========================================

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    try:
        if not data.get('cliente_id') or not data.get('configuracion_id'):
            return jsonify({"success": False, "message": "Faltan IDs de cliente o configuración"}), 400

        new_order = Ordenes(
            cliente_id=data.get('cliente_id'),
            configuracion_id=data.get('configuracion_id'),
            nombre_trabajo=data.get('nombre_trabajo', 'Cotización'),
            puntadas=data.get('puntadas', 0),
            colores=data.get('colores', 1),
            ancho=data.get('ancho', 0.0),
            alto=data.get('alto', 0.0),
            bastidor=data.get('bastidor', ''),
            tipo_tela=data.get('tipo_tela', ''),
            tiene_sublimacion=data.get('tiene_sublimacion', False),
            cantidad=data.get('cantidad', 1),
            precio_unitario=data.get('precio_unitario', 0.0),
            precio_total=data.get('precio_total', 0.0),
            datos_json=data.get('datos_json'),
            detalles=f"{data.get('nombre_trabajo')} - Total: {data.get('precio_total')}"
        )
        db.session.add(new_order)
        db.session.commit()
        return jsonify({"success": True, "id": new_order.id})
    except Exception as e:
        print("Error saving order:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error SQL: {str(e)}"}), 500

@app.route('/clients/<int:client_id>/orders', methods=['GET'])
def get_client_orders(client_id):
    orders = Ordenes.query.filter_by(cliente_id=client_id).order_by(Ordenes.fecha_pedido.desc()).all()
    return jsonify([o.to_dict() for o in orders])

# ==========================================
# 🖼️ PROCESAMIENTO
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
        input_image = Image.open(file.stream)
        output_image = remove(input_image) 

        p = ConfiguracionPrecios.query.filter_by(activo=True).first()
        if not p:
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

        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

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
            "imagen_procesada": f"data:image/png;base64,{img_str}",
            "mensaje": "Procesamiento automático"
        })

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================
# 👥 CRUD USUARIOS Y CLIENTES (LOGICAL DELETE)
# ==========================================

@app.route('/users', methods=['GET'])
def get_users():
    # FILTRO: Solo Personal activo
    users = Personal.query.filter_by(activo=True).all()
    # CORRECCIÓN: Agregados 'celular' y 'domicilio' al response
    res = [{
        "id": u.id, 
        "nombre": u.nombre, 
        "usuario": u.usuario, 
        "role": u.rol, 
        "activo": u.activo,
        "celular": u.celular,      # <--- Faltaba esto
        "domicilio": u.domicilio   # <--- Faltaba esto
    } for u in users]
    return jsonify(res)

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    if Personal.query.filter_by(usuario=data.get('usuario')).first():
        return jsonify({"success": False, "message": "Usuario existe"}), 400
    
    new_user = Personal(
        nombre=data.get('nombre'), 
        usuario=data.get('usuario'), 
        rol=data.get('role', 'empleado'),
        password_hash=generate_password_hash(data.get('password', '123456')), 
        celular=data.get('celular'),     # <--- Guardar celular
        domicilio=data.get('domicilio'), # <--- Guardar domicilio
        activo=True
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": True})

# --- RUTA QUE FALTABA: EDITAR USUARIO (PUT) ---
@app.route('/users/<int:id>', methods=['PUT'])
def update_user(id):
    user = Personal.query.get_or_404(id)
    data = request.get_json()
    
    # Actualizamos campos si vienen en el JSON
    if 'nombre' in data: user.nombre = data['nombre']
    if 'usuario' in data: user.usuario = data['usuario']
    if 'role' in data: user.rol = data['role']
    if 'celular' in data: user.celular = data['celular']
    if 'domicilio' in data: user.domicilio = data['domicilio']
    
    # Si viene password y no está vacío, lo actualizamos
    if data.get('password') and data.get('password').strip() != '':
        user.password_hash = generate_password_hash(data['password'])
        
    try:
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    u = Personal.query.get_or_404(id)
    if u.usuario == 'admin': 
        return jsonify({"success": False, "message": "No se puede borrar al admin"}), 400
    
    # BORRADO LÓGICO
    u.activo = False
    db.session.commit()
    return jsonify({"success": True})

# --- CLIENTES ---

@app.route('/clients', methods=['GET'])
def get_clients():
    clients = Clientes.query.filter_by(estado=True).all()
    res = [{"id":c.id, "nombre":c.nombre, "numero_referencia":c.numero_referencia, "domicilio":c.domicilio} for c in clients]
    return jsonify(res)

@app.route('/clients', methods=['POST'])
def create_client():
    data = request.get_json()
    new_c = Clientes(
        nombre=data.get('nombre'), 
        numero_referencia=data.get('numero_referencia'), 
        domicilio=data.get('domicilio'),
        estado=True
    )
    db.session.add(new_c)
    db.session.commit()
    return jsonify({"success": True})

# --- RUTA QUE FALTABA: EDITAR CLIENTE (PUT) ---
@app.route('/clients/<int:id>', methods=['PUT'])
def update_client(id):
    client = Clientes.query.get_or_404(id)
    data = request.get_json()
    
    if 'nombre' in data: client.nombre = data['nombre']
    if 'numero_referencia' in data: client.numero_referencia = data['numero_referencia']
    if 'domicilio' in data: client.domicilio = data['domicilio']
    
    try:
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/clients/<int:id>', methods=['DELETE'])
def delete_client(id):
    c = Clientes.query.get_or_404(id)
    c.estado = False 
    db.session.commit()
    return jsonify({"success": True})

if __name__ == '__main__':
    init_db_data(app)
    with app.app_context():
        if not Personal.query.filter_by(usuario='admin').first():
            print("👤 Creando admin por defecto...")
            admin = Personal(
                nombre='Administrador Principal', 
                usuario='admin', 
                rol='administrador', 
                password_hash=generate_password_hash('12345678'),
                activo=True
            )
            db.session.add(admin)
            db.session.commit()
    app.run(debug=True, host='0.0.0.0', port=5000)
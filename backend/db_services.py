from database import db, Personal, Clientes, ConfiguracionPrecios, Cotizacion, Orden
from datetime import datetime
from decimal import Decimal

# --- AUTENTICACIÓN / USUARIOS ---
def get_user_by_username(username, active_only=True):
    query = Personal.query.filter_by(usuario=username)
    if active_only:
        query = query.filter_by(activo=True)
    return query.first()

def get_user_by_id(user_id):
    return Personal.query.get(user_id)

def get_all_active_users():
    return Personal.query.filter_by(activo=True).all()

def create_user(nombre, usuario, password_hash, rol='empleado', celular=None, domicilio=None):
    new_user = Personal(
        # pyrefly: ignore [unexpected-keyword]
        nombre=nombre,
        # pyrefly: ignore [unexpected-keyword]
        usuario=usuario,
        # pyrefly: ignore [unexpected-keyword]
        password_hash=password_hash,
        # pyrefly: ignore [unexpected-keyword]
        rol=rol,
        # pyrefly: ignore [unexpected-keyword]
        celular=celular,
        # pyrefly: ignore [unexpected-keyword]
        domicilio=domicilio,
        # pyrefly: ignore [unexpected-keyword]
        activo=True
    )
    db.session.add(new_user)
    db.session.commit()
    return new_user

def update_user_password(user_id, password_hash):
    user = get_user_by_id(user_id)
    if user:
        user.password_hash = password_hash
        db.session.commit()
        return True
    return False

def update_user(user_id, data):
    user = get_user_by_id(user_id)
    if not user:
        return None
    
    if 'nombre' in data: user.nombre = data['nombre']
    if 'usuario' in data: user.usuario = data['usuario']
    if 'role' in data: user.rol = data['role']
    if 'celular' in data: user.celular = data['celular']
    if 'domicilio' in data: user.domicilio = data['domicilio']
    if 'password' in data and data['password'].strip() != '':
        from werkzeug.security import generate_password_hash
        user.password_hash = generate_password_hash(data['password'])
    
    db.session.commit()
    return user

def delete_user(user_id):
    user = get_user_by_id(user_id)
    if not user:
        return False
    user.activo = False
    db.session.commit()
    return True

# --- CLIENTES ---
def get_all_active_clients():
    return Clientes.query.filter_by(estado=True).all()

def get_client_by_id(client_id):
    return Clientes.query.get(client_id)

def create_client(nombre, numero_referencia=None, domicilio=None):
    new_c = Clientes(
        # pyrefly: ignore [unexpected-keyword]
        nombre=nombre,
        # pyrefly: ignore [unexpected-keyword]
        numero_referencia=numero_referencia,
        # pyrefly: ignore [unexpected-keyword]
        domicilio=domicilio,
        # pyrefly: ignore [unexpected-keyword]
        estado=True
    )
    db.session.add(new_c)
    db.session.commit()
    return new_c

def update_client(client_id, data):
    client = get_client_by_id(client_id)
    if not client:
        return None
    if 'nombre' in data: client.nombre = data['nombre']
    if 'numero_referencia' in data: client.numero_referencia = data['numero_referencia']
    if 'domicilio' in data: client.domicilio = data['domicilio']
    db.session.commit()
    return client

def delete_client(client_id):
    client = get_client_by_id(client_id)
    if not client:
        return False
    client.estado = False
    db.session.commit()
    return True

# --- CONFIGURACIÓN DE PRECIOS ---
def get_active_pricing():
    return ConfiguracionPrecios.query.filter_by(activo=True).order_by(ConfiguracionPrecios.id.desc()).first()

def get_pricing_history(limit=50):
    return ConfiguracionPrecios.query.order_by(ConfiguracionPrecios.fecha_modificacion.desc()).limit(limit).all()

def update_pricing_config(pricing_data):
    if not pricing_data:
        pricing_data = {}
    current_price = ConfiguracionPrecios.query.filter_by(activo=True).first()
    if current_price:
        current_price.activo = False
    
    new_price = ConfiguracionPrecios(
        # pyrefly: ignore [unexpected-keyword]
        precio_stitch_1000=Decimal(str(pricing_data.get('precio_stitch_1000', 0))),
        # pyrefly: ignore [unexpected-keyword]
        factor_cambio_hilo=Decimal(str(pricing_data.get('factor_cambio_hilo', 0))),
        # pyrefly: ignore [unexpected-keyword]
        costo_hilo_bordar=Decimal(str(pricing_data.get('costo_hilo_bordar', 0))),
        # pyrefly: ignore [unexpected-keyword]
        costo_hilo_bobina=Decimal(str(pricing_data.get('costo_hilo_bobina', 0))),
        # pyrefly: ignore [unexpected-keyword]
        costo_pellon=Decimal(str(pricing_data.get('costo_pellon', 0))),
        # pyrefly: ignore [unexpected-keyword]
        tela_estructurante=Decimal(str(pricing_data.get('tela_estructurante', 0))),
        # pyrefly: ignore [unexpected-keyword]
        tela_normal=Decimal(str(pricing_data.get('tela_normal', 0))),
        # pyrefly: ignore [unexpected-keyword]
        rollo_papel=Decimal(str(pricing_data.get('rollo_papel', 0))),
        # pyrefly: ignore [unexpected-keyword]
        costo_impresion=Decimal(str(pricing_data.get('costo_impresion', 0))),
        # pyrefly: ignore [unexpected-keyword]
        corte_impresion=pricing_data.get('corte_impresion', 0),
        # pyrefly: ignore [unexpected-keyword]
        activo=True,
        # pyrefly: ignore [unexpected-keyword]
        fecha_modificacion=datetime.utcnow()
    )
    db.session.add(new_price)
    db.session.commit()
    return new_price

# --- COTIZACIONES ---
def create_cotizacion(data):
    if not data:
        data = {}
    new_cotizacion = Cotizacion(
        # pyrefly: ignore [unexpected-keyword]
        cliente_id=data.get('cliente_id'),
        # pyrefly: ignore [unexpected-keyword]
        configuracion_id=data.get('configuracion_id'),
        # pyrefly: ignore [unexpected-keyword]
        nombre_trabajo=data.get('nombre_trabajo', 'Cotización'),
        # pyrefly: ignore [unexpected-keyword]
        puntadas=data.get('puntadas', 0),
        # pyrefly: ignore [unexpected-keyword]
        colores=data.get('colores', 1),
        # pyrefly: ignore [unexpected-keyword]
        ancho=Decimal(str(data.get('ancho', 0.0))),
        # pyrefly: ignore [unexpected-keyword]
        alto=Decimal(str(data.get('alto', 0.0))),
        # pyrefly: ignore [unexpected-keyword]
        bastidor=data.get('bastidor', ''),
        # pyrefly: ignore [unexpected-keyword]
        tipo_tela=data.get('tipo_tela', ''),
        # pyrefly: ignore [unexpected-keyword]
        tiene_sublimacion=int(bool(data.get('tiene_sublimacion', False))),
        # pyrefly: ignore [unexpected-keyword]
        cantidad=data.get('cantidad', 1),
        # pyrefly: ignore [unexpected-keyword]
        precio_unitario=Decimal(str(data.get('precio_unitario', 0.0))),
        # pyrefly: ignore [unexpected-keyword]
        precio_total=Decimal(str(data.get('precio_total', 0.0))),
        # pyrefly: ignore [unexpected-keyword]
        datos_json=data.get('datos_json'),
        # pyrefly: ignore [unexpected-keyword]
        detalles=data.get('detalles'),
        # pyrefly: ignore [unexpected-keyword]
        personal_id=data.get('personal_id')
    )
    db.session.add(new_cotizacion)
    db.session.commit()
    return new_cotizacion

def get_cotizacion_by_id(cot_id):
    return Cotizacion.query.get(cot_id)

def get_cotizaciones_by_client(client_id):
    return Cotizacion.query.filter_by(cliente_id=client_id).order_by(Cotizacion.fecha_pedido.desc()).all()

# --- ÓRDENES ---
def get_all_ordenes():
    return Orden.query.order_by(Orden.fecha_entrega.asc(), Orden.fecha_creacion.desc()).all()

def get_ordenes_by_client(client_id):
    return Orden.query.join(Cotizacion).filter(Cotizacion.cliente_id == client_id).order_by(Orden.fecha_creacion.desc()).all()

def get_orden_by_id(orden_id):
    return Orden.query.get(orden_id)

def get_orden_by_cotizacion_id(cot_id):
    return Orden.query.filter_by(cotizacion_id=cot_id).first()

def create_orden(cotizacion_id, estado='en_proceso', fecha_entrega=None, detail=None, personal_id=None):
    new_orden = Orden(
        # pyrefly: ignore [unexpected-keyword]
        cotizacion_id=cotizacion_id,
        # pyrefly: ignore [unexpected-keyword]
        estado=estado,
        # pyrefly: ignore [unexpected-keyword]
        fecha_entrega=fecha_entrega,
        # pyrefly: ignore [unexpected-keyword]
        detail=detail,
        # pyrefly: ignore [unexpected-keyword]
        personal_id=personal_id
    )
    db.session.add(new_orden)
    db.session.commit()
    return new_orden

def update_orden(orden_id, data):
    orden = get_orden_by_id(orden_id)
    if not orden:
        return None
    
    if 'estado' in data:
        orden.estado = data['estado']
    if 'detail' in data:
        orden.detail = data['detail']
    if 'fecha_entrega' in data:
        orden.fecha_entrega = data['fecha_entrega']
    if 'personal_id' in data:
        orden.personal_id = data['personal_id']
        
    db.session.commit()
    return orden

def delete_orden(orden_id):
    orden = get_orden_by_id(orden_id)
    if not orden:
        return False
    db.session.delete(orden)
    db.session.commit()
    return True

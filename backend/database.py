from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
from datetime import datetime

db = SQLAlchemy()

# --- CLIENTES ---
class Clientes(db.Model):
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    numero_referencia = db.Column(db.String(50))
    domicilio = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Campo de control: 'estado' (True = Activo, False = Eliminado)
    estado = db.Column(db.Boolean, default=True, nullable=False)

# --- PERSONAL ---
class Personal(db.Model):
    __tablename__ = 'personal'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    rol = db.Column(db.String(50), nullable=False)
    usuario = db.Column(db.String(50), unique=True, nullable=False)
    # Mapeo explícito: atributo 'password_hash' -> columna 'password'
    password_hash = db.Column('password', db.String(255), nullable=False)
    celular = db.Column(db.String(20))
    domicilio = db.Column(db.Text)
    
    # Campo de control: 'activo' (True = Activo, False = Eliminado)
    activo = db.Column(db.Boolean, default=True, nullable=False)

# --- CONFIGURACIÓN DE PRECIOS ---
class ConfiguracionPrecios(db.Model):
    __tablename__ = 'configuracion_precios'
    
    id = db.Column(db.Integer, primary_key=True)
    precio_stitch_1000 = db.Column(db.Numeric(10, 2), nullable=False)
    factor_cambio_hilo = db.Column(db.Numeric(10, 2), nullable=False)
    costo_hilo_bordar = db.Column(db.Numeric(10, 2), nullable=False)
    costo_hilo_bobina = db.Column(db.Numeric(10, 2), nullable=False)
    costo_pellon = db.Column(db.Numeric(10, 2), nullable=False)
    tela_estructurante = db.Column(db.Numeric(10, 2), nullable=False)
    tela_normal = db.Column(db.Numeric(10, 2), nullable=False)
    rollo_papel = db.Column(db.Numeric(10, 2), nullable=False)
    costo_impresion = db.Column(db.Numeric(10, 2), nullable=False)
    corte_impresion = db.Column(db.Float, default=0.0)
    
    fecha_modificacion = db.Column(db.DateTime, default=datetime.utcnow)
    activo = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "precio_stitch_1000": float(self.precio_stitch_1000),
            "factor_cambio_hilo": float(self.factor_cambio_hilo),
            "costo_hilo_bordar": float(self.costo_hilo_bordar),
            "costo_hilo_bobina": float(self.costo_hilo_bobina),
            "costo_pellon": float(self.costo_pellon) if self.costo_pellon else 0,
            "tela_estructurante": float(self.tela_estructurante),
            "tela_normal": float(self.tela_normal),
            "rollo_papel": float(self.rollo_papel),
            "costo_impresion": float(self.costo_impresion),
            "corte_impresion": self.corte_impresion,
            "fecha_modificacion": self.fecha_modificacion.isoformat() if self.fecha_modificacion else None,
            "activo": self.activo
        }

# --- COTIZACIONES (antes Órdenes) ---
class Cotizacion(db.Model):
    __tablename__ = 'cotizacion'
    
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False)
    configuracion_id = db.Column(db.Integer, db.ForeignKey('configuracion_precios.id'), nullable=False)
    
    nombre_trabajo = db.Column(db.String(150), nullable=False, default="Cotización")
    fecha_pedido = db.Column(db.DateTime, default=datetime.utcnow)
    
    puntadas = db.Column(db.Integer, default=0)
    colores = db.Column(db.Integer, default=1)
    ancho = db.Column(db.Numeric(10, 2), default=0.00)
    alto = db.Column(db.Numeric(10, 2), default=0.00)
    bastidor = db.Column(db.String(100))
    tipo_tela = db.Column(db.String(50))
    tiene_sublimacion = db.Column(db.Boolean, default=False)

    cantidad = db.Column(db.Integer, default=1)
    precio_unitario = db.Column(db.Numeric(10, 2), default=0.00)
    precio_total = db.Column(db.Numeric(10, 2), default=0.00)
    
    datos_json = db.Column(db.Text) 
    detalles = db.Column(db.Text)

    cliente = db.relationship('Clientes', backref=db.backref('cotizaciones', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "configuracion_id": self.configuracion_id,
            "nombre_trabajo": self.nombre_trabajo,
            "fecha_pedido": self.fecha_pedido.isoformat() if self.fecha_pedido else None,
            "puntadas": self.puntadas,
            "colores": self.colores,
            "ancho": float(self.ancho) if self.ancho else 0,
            "alto": float(self.alto) if self.alto else 0,
            "bastidor": self.bastidor,
            "tipo_tela": self.tipo_tela,
            "tiene_sublimacion": self.tiene_sublimacion,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario) if self.precio_unitario else 0,
            "precio_total": float(self.precio_total) if self.precio_total else 0,
            "datos_json": self.datos_json,
            "detalles": self.detalles 
        }

    def to_summary_dict(self):
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "configuracion_id": self.configuracion_id,
            "nombre_trabajo": self.nombre_trabajo,
            "fecha_pedido": self.fecha_pedido.isoformat() if self.fecha_pedido else None,
            "puntadas": self.puntadas,
            "colores": self.colores,
            "ancho": float(self.ancho) if self.ancho else 0,
            "alto": float(self.alto) if self.alto else 0,
            "bastidor": self.bastidor,
            "tipo_tela": self.tipo_tela,
            "tiene_sublimacion": self.tiene_sublimacion,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario) if self.precio_unitario else 0,
            "precio_total": float(self.precio_total) if self.precio_total else 0,
            # Exclude heavy fields
            # "datos_json": self.datos_json,
            # "detalles": self.detalles 
        }

# --- ÓRDENES (Nueva tabla) ---
class Orden(db.Model):
    __tablename__ = 'orden'
    
    id = db.Column(db.Integer, primary_key=True)
    cotizacion_id = db.Column(db.Integer, db.ForeignKey('cotizacion.id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) # Restore missing column
    estado = db.Column(db.String(20), nullable=False, default='en_proceso')  # en_proceso, cancelado, entregado
    fecha_entrega = db.Column(db.Date, nullable=True)
    detail = db.Column(db.Text)  # Observaciones durante el proceso
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    
    cotizacion = db.relationship('Cotizacion', backref=db.backref('orden', uselist=False))
    cliente = db.relationship('Clientes', backref=db.backref('ordenes', lazy=True))

    def to_dict(self):
        cot = self.cotizacion
        return {
            "id": self.id,
            "cotizacion_id": self.cotizacion_id,
            "estado": self.estado,
            "fecha_entrega": self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            "detail": self.detail,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            # Datos expandidos de la cotización
            "cliente_id": cot.cliente_id if cot else None,
            "nombre_trabajo": cot.nombre_trabajo if cot else None,
            "cliente_nombre": cot.cliente.nombre if cot and cot.cliente else None,
            "precio_total": float(cot.precio_total) if cot and cot.precio_total else 0,
            "cantidad": cot.cantidad if cot else 0,
            "fecha_pedido": cot.fecha_pedido.isoformat() if cot and cot.fecha_pedido else None,
            # Detalles técnicos para visualización (WorkClientView)
            "puntadas": cot.puntadas if cot else 0,
            "colores": cot.colores if cot else 1,
            "ancho": float(cot.ancho) if cot and cot.ancho is not None else 0.0,
            "alto": float(cot.alto) if cot and cot.alto is not None else 0.0,
            "bastidor": cot.bastidor if cot else '',
            "tipo_tela": cot.tipo_tela if cot else '',
            "tiene_sublimacion": cot.tiene_sublimacion if cot else False,
            "datos_json": cot.datos_json if cot else None,
             # Precio unitario también es útil
            "precio_unitario": float(cot.precio_unitario) if cot and cot.precio_unitario is not None else 0.0
        }

    def to_summary_dict(self):
        cot = self.cotizacion
        return {
            "id": self.id,
            "cotizacion_id": self.cotizacion_id,
            "estado": self.estado,
            "fecha_entrega": self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            "detail": self.detail,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "cliente_id": cot.cliente_id if cot else None,
            "nombre_trabajo": cot.nombre_trabajo if cot else None,
            "cliente_nombre": cot.cliente.nombre if cot and cot.cliente else None,
            "precio_total": float(cot.precio_total) if cot and cot.precio_total else 0,
            "cantidad": cot.cantidad if cot else 0,
            "fecha_pedido": cot.fecha_pedido.isoformat() if cot and cot.fecha_pedido else None,
            "puntadas": cot.puntadas if cot else 0,
            "colores": cot.colores if cot else 1,
            # Exclude heavy fields
            # "datos_json": cot.datos_json if cot else None,
        }

def init_db_data(app):
    with app.app_context():
        db.create_all()
        if not ConfiguracionPrecios.query.first():
            print("💰 Creando precios iniciales...")
            precios = ConfiguracionPrecios(
                precio_stitch_1000=1.0, factor_cambio_hilo=0.5, costo_hilo_bordar=19.0,
                costo_hilo_bobina=9.0, costo_pellon=300.0, tela_estructurante=180.0,
                tela_normal=18.0, rollo_papel=330.0, costo_impresion=3.0, corte_impresion=1.7,
                activo=True
            )
            db.session.add(precios)
            db.session.commit()
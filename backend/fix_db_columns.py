from app import app, db
from sqlalchemy import text

def fix_schema():
    with app.app_context():
        with db.engine.connect() as conn:
            print("Verificando esquema de la tabla 'personal'...")
            
            # 1. Celular
            try:
                result = conn.execute(text("SHOW COLUMNS FROM personal LIKE 'celular'"))
                if not result.fetchone():
                    print("   -> Agregando columna 'celular'...")
                    conn.execute(text("ALTER TABLE personal ADD COLUMN celular VARCHAR(20) DEFAULT NULL"))
                else:
                    print("   OK - Columna 'celular' ya existe.")
            except Exception as e:
                print(f"   X Error verificando/agregando celular: {e}")

            # 2. Domicilio
            try:
                result = conn.execute(text("SHOW COLUMNS FROM personal LIKE 'domicilio'"))
                if not result.fetchone():
                    print("   -> Agregando columna 'domicilio'...")
                    conn.execute(text("ALTER TABLE personal ADD COLUMN domicilio TEXT DEFAULT NULL"))
                else:
                    print("   OK - Columna 'domicilio' ya existe.")
            except Exception as e:
                print(f"   X Error verificando/agregando domicilio: {e}")

            # 3. Orden: fecha_entrega
            try:
                result = conn.execute(text("SHOW COLUMNS FROM orden LIKE 'fecha_entrega'"))
                if not result.fetchone():
                    print("   -> Agregando columna 'fecha_entrega' a tabla 'orden'...")
                    conn.execute(text("ALTER TABLE orden ADD COLUMN fecha_entrega DATE DEFAULT NULL"))
                else:
                    print("   OK - Columna 'fecha_entrega' ya existe.")
            except Exception as e:
                print(f"   X Error verificando fecha_entrega: {e}")

            # 4. Orden: detail
            try:
                result = conn.execute(text("SHOW COLUMNS FROM orden LIKE 'detail'"))
                if not result.fetchone():
                    print("   -> Agregando columna 'detail' a tabla 'orden'...")
                    conn.execute(text("ALTER TABLE orden ADD COLUMN detail TEXT DEFAULT NULL"))
                else:
                    print("   OK - Columna 'detail' ya existe.")
            except Exception as e:
                print(f"   X Error verificando detail: {e}")

            # 5. Orden: fecha_creacion
            try:
                result = conn.execute(text("SHOW COLUMNS FROM orden LIKE 'fecha_creacion'"))
                if not result.fetchone():
                    print("   -> Agregando columna 'fecha_creacion' a tabla 'orden'...")
                    conn.execute(text("ALTER TABLE orden ADD COLUMN fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP"))
                else:
                    print("   OK - Columna 'fecha_creacion' ya existe.")
            except Exception as e:
                print(f"   X Error verificando fecha_creacion: {e}")

if __name__ == '__main__':
    fix_schema()

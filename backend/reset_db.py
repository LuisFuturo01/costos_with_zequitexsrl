import os
from app import app, db
from sqlalchemy import text

def reset_database():
    """
    Vacía las tablas orden, cotizacion y clientes (respetando FK)
    y resetea los contadores de auto-incremento.
    """
    print("⚠️  ADVERTENCIA: Esta acción BORRARÁ TODOS los datos de Órdenes, Cotizaciones y Clientes.")
    print("NO se borrarán los Usuarios ni la Configuración/Historial de precios.")
    confirm = input("Escribe 'CONFIRMAR' para proceder: ")
    
    if confirm != "CONFIRMAR":
        print("❌ Operación cancelada.")
        return

    with app.app_context():
        try:
            # Desactivar FK checks para poder truncar sin problemas de orden
            db.session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            
            print("⏳ Limpiando tabla: Orden...")
            db.session.execute(text("TRUNCATE TABLE orden"))
            
            print("⏳ Limpiando tabla: Cotizacion...")
            db.session.execute(text("TRUNCATE TABLE cotizacion"))
            
            print("⏳ Limpiando tabla: Clientes...")
            db.session.execute(text("TRUNCATE TABLE clientes"))

            # Reset FK checks
            db.session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            
            db.session.commit()
            print("✅ Base de datos limpiada correctamente. Contadores reiniciados.")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al limpiar la base de datos: {e}")

if __name__ == "__main__":
    reset_database()

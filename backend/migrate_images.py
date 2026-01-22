import os
import json
import base64
import cloudinary.uploader
from app import app, db, Cotizacion

# Configuración de Cloudinary (Debe coincidir con app.py si no usas env vars)
# Nota: Idealmente esto debería venir de os.environ
from dotenv import load_dotenv
load_dotenv()

import cloudinary
cloudinary.config(
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
  api_key = os.getenv("CLOUDINARY_API_KEY"),
  api_secret = os.getenv("CLOUDINARY_API_SECRET")
)

def migrate_images():
    """
    Recorre todas las cotizaciones. Si encuentra una imagen en Base64 en 'datos_json',
    la sube a Cloudinary y actualiza el registro con la URL.
    """
    print("🚀 Iniciando migración de imágenes a Cloudinary...")
    
    with app.app_context():
        cotizaciones = Cotizacion.query.all()
        count = 0
        total = len(cotizaciones)
        print(f"🔍 Analizando {total} cotizaciones...")

        for cot in cotizaciones:
            try:
                if not cot.datos_json:
                    continue

                # Intentar detectar si es una URL o Base64
                if cot.datos_json.startswith('http'):
                    # Ya es una URL, saltar
                    continue
                
                # Si empieza con data:, es un base64 formatted
                # Si no, asumimos que es base64 raw (legacy)
                
                image_data = cot.datos_json
                
                # Preparar para subir
                print(f"Subiendo imagen para Cotización ID {cot.id}...")
                
                # Si es raw base64 (sin prefijo), añadirselo para que cloudinary lo reconozca si hace falta,
                # pero cloudinary.uploader.upload soporta base64 strings directamente si tienen el prefijo.
                # Si no tienen prefijo, hay que ver.
                
                prefix = "data:image/png;base64,"
                if not image_data.startswith("data:") and not image_data.startswith("http"):
                    image_payload = prefix + image_data
                else:
                    image_payload = image_data

                # Subir a Cloudinary
                upload_result = cloudinary.uploader.upload(
                    image_payload, 
                    folder="zequitex_orders"
                )
                
                secure_url = upload_result["secure_url"]
                
                # Actualizar DB
                cot.datos_json = secure_url
                count += 1
                if count % 10 == 0:
                    db.session.commit() # Commit parcial
                    print(f"✅ Migradas {count} imágenes...")

            except Exception as e:
                print(f"❌ Error migrando Cotización {cot.id}: {e}")
        
        db.session.commit()
        print(f"✨ Migración completada. Total imágenes migradas: {count}")

if __name__ == "__main__":
    migrate_images()

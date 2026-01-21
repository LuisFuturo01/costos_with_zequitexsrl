from app import app, db, Personal
from werkzeug.security import generate_password_hash

def reset_password():
    with app.app_context():
        user = Personal.query.filter_by(usuario='admin').first()
        if user:
            print(f"Usuario encontrado: {user.usuario}")
            # Resetear a '12345678'
            new_pass = '12345678'
            user.password_hash = generate_password_hash(new_pass)
            db.session.commit()
            print(f"✅ Contraseña actualizada exitosamente a: {new_pass}")
        else:
            print("❌ No se encontró el usuario 'admin'")

if __name__ == '__main__':
    reset_password()

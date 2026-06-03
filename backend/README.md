# 🐍 Zequitex Cotizador - Backend

API RESTful desarrollada con **Flask** para gestionar la lógica de negocio, procesamiento de imágenes y base de datos del sistema Zequitex.

## 🚀 Instalación y Configuración

### Requisitos
- Python 3.8+
- MySQL / MariaDB

### Pasos

1.  **Crear entorno virtual**:
    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Linux/Mac
    source venv/bin/activate
    ```

2.  **Instalar dependencias**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` basado en `.env.example`:
    ```env
    DATABASE_MYSQL=mysql+pymysql://root:@localhost/zequicotizador
    DATABASE_POSTGRESQL=postgresql://postgres:password@localhost:5432/zequicotizador_postgre
    CLOUDINARY_CLOUD_NAME=...
    CLOUDINARY_API_KEY=...
    CLOUDINARY_API_SECRET=...
    ```

4.  **Iniciar bases de datos**:
    - Importa el archivo `heterogenea-mysql.sql` en tu gestor **MySQL / MariaDB**.
    - Importa el archivo `heterogenea-postgresql.sql` en tu gestor **PostgreSQL**.
    - El sistema creará un usuario admin por defecto en MySQL si no existe al arrancar (`admin` / `12345678`).

5.  **Ejecutar servidor**:
    ```bash
    python app.py
    ```

## 📡 API Endpoints

### Autenticación
- `POST /config/login`: Login de personal.
- `POST /config/password`: Cambio de contraseña.

### Cotizaciones
- `POST /process`: Procesa una imagen, elimina fondo, detecta colores y sube a Cloudinary.
- `POST /orders`: Guarda una nueva cotización.
- `GET /clients/:id/orders`: Obtiene historial de cotizaciones de un cliente.

### Órdenes de Trabajo
- `POST /ordenes`: Convierte una cotización en orden de trabajo.
- `GET /ordenes`: Lista todas las órdenes activas.
- `PUT /ordenes/:id`: Actualiza estado (`en_proceso`, `entregado`, etc.).

### Configuración
- `GET /config`: Obtiene precios actuales.
- `POST /config`: Actualiza tabla de precios.

## ☁️ Integración Cloudinary

El backend se encarga de:
1. Recibir la imagen cruda.
2. Eliminar el fondo con `rembg`.
3. Subir la imagen procesada a Cloudinary (formato WebP).
4. Retornar la URL segura para que el frontend la guarde en la BD.

---
© 2024 Zequitex SRL

# 🧵 Zequitex Cotizador

Sistema de cotización de bordados para **Zequitex SRL**. Permite calcular costos de bordado de manera automática o manual, gestionar clientes, órdenes de trabajo y configuración de precios.

---

## 📋 Tabla de Contenido

- [Descripción General](#-descripción-general)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Base de Datos](#-base-de-datos)
- [Backend (API)](#-backend-api)
- [Frontend](#-frontend)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Uso del Sistema](#-uso-del-sistema)



> **Documentación Específica:**
>
> - 📘 **[Frontend README](./frontend/README.md)** (Setup, Componentes, Vite)
> - 🐍 **[Backend README](./backend/README.md)** (API, Flask, Cloudinary)
>
> ---

## 📖 Descripción General

Zequitex Cotizador es una aplicación web completa que automatiza el proceso de cotización para servicios de bordado. El sistema incluye:

- **Procesamiento de imágenes** con IA para detectar colores y estimar puntadas
- **Cálculo automático de costos** basado en materiales, puntadas y configuración
- **Gestión de clientes** con historial de cotizaciones y órdenes
- **Panel de configuración** para precios y parámetros del sistema
- **Sistema de órdenes de trabajo** con estados y fechas de entrega

---

## 🏗 Arquitectura del Proyecto

```
cotizadorZequitex/
├── backend/                    # API REST con Flask + Python
│   ├── app.py                  # Servidor principal y rutas API
│   ├── database.py             # Modelos ORM con SQLAlchemy
│   ├── image_services.py       # Procesamiento de imágenes
│   ├── requirements.txt        # Dependencias Python (incluyendo cloudinary)
│   └── zequitexcotizador.sql   # Schema de base de datos
│
├── frontend/                   # Aplicación React + TypeScript
│   ├── src/
│   │   ├── App.tsx             # Componente principal
│   │   ├── components/         # Componentes React
│   │   │   ├── views/          # Vistas principales
│   │   │   ├── modes/          # Modos de cotización
│   │   │   └── ui/             # Componentes de UI
│   │   ├── services/api.ts     # Cliente HTTP para la API
│   │   └── types/index.ts      # Tipos TypeScript
│   ├── package.json            # Dependencias Node.js
│   └── vite.config.ts          # Configuración Vite
│
└── README.md                   # Este archivo
```

---

## 🛠 Tecnologías Utilizadas

### Backend
| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| Python | 3.x | Lenguaje principal |
| Flask | latest | Framework web |
| SQLAlchemy | latest | ORM para base de datos |
| MySQL/MariaDB | 10.4+ | Base de datos |
| rembg | latest | Remoción de fondos con IA |
| scikit-learn | latest | Detección de colores (KMeans) |
| Pillow | latest | Manipulación de imágenes |
| NumPy | latest | Cálculos numéricos |
| Cloudinary | latest | Almacenamiento optimizado de imágenes |

### Frontend
| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| React | 19.1.1 | Biblioteca de UI |
| TypeScript | 5.9.3 | Tipado estático |
| Vite | 7.1.7 | Build tool |
| html2canvas | 1.4.1 | Captura de pantalla |

---

## 🗄 Base de Datos

### Diagrama Entidad-Relación

```mermaid
erDiagram
    clientes ||--o{ cotizacion : tiene
    personal ||--o{ cotizacion : crea
    personal ||--o{ orden : procesa
    configuracion_precios ||--o{ cotizacion : usa
    cotizacion ||--o| orden : genera

    clientes {
        int id PK
        varchar nombre
        varchar numero_referencia
        text domicilio
        datetime created_at
        boolean estado
    }

    personal {
        int id PK
        varchar usuario UK
        varchar password
        varchar nombre
        varchar rol
        boolean activo
        varchar celular
        text domicilio
    }

    configuracion_precios {
        int id PK
        decimal precio_stitch_1000
        decimal factor_cambio_hilo
        decimal costo_hilo_bordar
        decimal costo_hilo_bobina
        decimal costo_pellon
        decimal tela_estructurante
        decimal tela_normal
        decimal rollo_papel
        decimal costo_impresion
        decimal corte_impresion
        datetime fecha_modificacion
        boolean activo
    }

    cotizacion {
        int id PK
        int cliente_id FK
        int configuracion_id FK
        int personal_id FK
        varchar nombre_trabajo
        datetime fecha_pedido
        int puntadas
        int colores
        decimal ancho
        decimal alto
        varchar bastidor
        varchar tipo_tela
        boolean tiene_sublimacion
        int cantidad
        decimal precio_unitario
        decimal precio_total
        text datos_json
        text detalles
    }

    orden {
        int id PK
        int cotizacion_id FK
        int personal_id FK
        varchar estado
        date fecha_entrega
        text detail
        datetime fecha_creacion
    }
```

### Descripción de Tablas

#### `clientes`
Almacena información de los clientes de la empresa.
- **estado**: Borrado lógico (1=activo, 0=eliminado)

#### `personal`
Usuarios del sistema con autenticación (administradores y operadores).
- **rol**: `administrador` o `empleado`
- **password**: Hasheado con scrypt de Werkzeug
- **activo**: Borrado lógico

#### `configuracion_precios`
Historial de configuración de precios. Solo un registro está `activo` a la vez.
- **precio_stitch_1000**: Costo por cada 1000 puntadas
- **costo_pellon**: Precio por 1,000,000 cm²
- **tela_estructurante/tela_normal**: Precio por 15,000 cm²
- **corte_impresion**: Relación por minuto

#### `cotizacion`
Cotizaciones generadas para clientes, vinculadas al precio de cotización y al creador.
- **datos_json**: Imagen procesada subida a Cloudinary (URL segura)
- **tiene_sublimacion**: Si el trabajo incluye sublimación
- **personal_id**: Clave foránea al personal que creó la cotización

#### `orden`
Órdenes de trabajo confirmadas y pasadas a producción a partir de una cotización.
- **estado**: `en_proceso`, `cancelado`, `entregado`
- **fecha_entrega**: Fecha comprometida de entrega
- **personal_id**: Clave foránea al personal que maneja o procesa la orden
- **detail**: Observaciones de la orden de producción

---

## 🔧 Backend (API)

### Endpoints Principales

#### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/config/login` | Iniciar sesión |
| POST | `/config/password` | Cambiar contraseña |

#### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/config` | Obtener configuración activa |
| POST | `/config` | Actualizar configuración (crea nuevo registro) |
| GET | `/config/history` | Historial de cambios de precios |

#### Usuarios y Clientes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/users` | Listar usuarios activos |
| POST | `/users` | Crear usuario |
| PUT | `/users/:id` | Editar usuario |
| DELETE | `/users/:id` | Desactivar usuario (lógico) |
| GET | `/clients` | Listar clientes activos |
| POST | `/clients` | Crear cliente |
| PUT | `/clients/:id` | Editar cliente |
| DELETE | `/clients/:id` | Desactivar cliente (lógico) |

#### Cotizaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/orders` | Crear cotización |
| GET | `/clients/:id/orders` | Cotizaciones de un cliente |

#### Órdenes de Trabajo
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/ordenes` | Listar todas las órdenes |
| POST | `/ordenes` | Crear orden desde cotización |
| PUT | `/ordenes/:id` | Actualizar estado/detalles |
| DELETE | `/ordenes/:id` | Eliminar orden |
| GET | `/clients/:id/ordenes` | Órdenes de un cliente |

#### Procesamiento de Imágenes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/process` | Procesar imagen para cotización |

### Procesamiento de Imágenes (`image_services.py`)

El sistema incluye procesamiento avanzado de imágenes:

1. **Remoción de fondo**: Usa `rembg` con IA para eliminar fondos
2. **Detección de colores**: KMeans clustering mapea colores a una paleta de 20 colores de bordado estándar
3. **Estimación de puntadas**: Calcula basándose en el área real del diseño (no el rectángulo)

```python
# Fórmula de puntadas:
puntadas = área_real_cm² × densidad  # densidad = 135 por defecto
```

#### Paleta de Colores de Bordado
Negro, Blanco, Rojo, Amarillo, Verde, Azul, Naranja, Morado, Rosa, Café, Celeste, Dorado, Gris, Azul Marino, Fucsia, Verde Lima, Turquesa, Vino, Beige, Coral

### Integración con Cloudinary ☁️

Para optimizar el almacenamiento y rendimiento, las imágenes procesadas ya no se guardan como Base64 en la base de datos.

1.  **Subida**: El backend sube la imagen procesada a Cloudinary.
2.  **Optimización**: Se convierte automáticamente a formato **WebP** y calidad automática.
3.  **Almacenamiento**: Se guarda la URL segura (`https://res.cloudinary.com/...`) en el campo `datos_json` de la tabla `cotizacion`.

---

## 💻 Frontend

### Vistas Principales

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Principal | `App.tsx` | Cotización con 3 modos |
| Login | `LoginView.tsx` | Autenticación |
| Configuración | `ConfigView.tsx` | Admin de usuarios, clientes, precios |
| Órdenes | `OrdenesView.tsx` | Gestión de órdenes de trabajo |

### Modos de Cotización

| Modo | Archivo | Descripción |
|------|---------|-------------|
| Upload | `UploadMode.tsx` | Subir imagen desde archivo |
| Cámara | `CameraMode.tsx` | Capturar desde cámara |
| Manual | `ManualMode.tsx` | Ingresar datos manualmente |

### Componentes Principales

| Componente | Descripción |
|------------|-------------|
| `ResultTicket.tsx` | Ticket de resultado de cotización |
| `ShareableTicket.tsx` | Ticket compartible/imprimible |
| `WorkClientView.tsx` | Vista detallada de cotización/orden |
| `ExitConfirmModal.tsx` | Modal de confirmación de salida |

### Tipos TypeScript (`types/index.ts`)

```typescript
// Resultado del procesamiento de imagen
interface ProcessResult {
  success: boolean;
  dims: { width: number; height: number };
  estimatedStitches: number;
  colors: string[];
  breakdown: { puntadas, colores, pellon, ... };
  precio_sugerido: number;
  imagen_procesada: string; // Base64
}

// Configuración de precios
interface Pricing {
  precio_stitch_1000: number;
  factor_cambio_hilo: number;
  costo_pellon: number;
  // ...
}

// Estados de orden
type EstadoOrden = 'en_proceso' | 'cancelado' | 'entregado';
```

---

## 🚀 Instalación y Configuración

### Requisitos Previos
- Python 3.8+
- Node.js 18+
- MySQL/MariaDB 10.4+
- XAMPP (opcional, para desarrollo local)

### 1. Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE zequitexcotizador CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Importar schema
mysql -u usuario -p zequitexcotizador < backend/zequitexcotizador.sql
```

### 2. Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de base de datos

# Ejecutar servidor
python app.py
```

**Archivo `.env` del backend:**

```env
DATABASE_URI=mysql+pymysql://usuario:password@localhost/zequitexcotizador
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

El backend estará disponible en `http://localhost:5000`

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con la URL de tu API

# Ejecutar en desarrollo
npm run dev
```

**Archivo `.env` del frontend:**

```env
# Para desarrollo local:
VITE_API_URL=http://localhost:5000

# Para producción con zrok:
# VITE_API_URL=https://tu-token.share.zrok.io
```

El frontend estará disponible en `http://localhost:5173`

---

## 📱 Uso del Sistema

### Flujo de Cotización

1. **Seleccionar cliente** o crear uno nuevo
2. **Elegir modo** de cotización:
   - 📤 **Upload**: Subir imagen del diseño
   - 📷 **Cámara**: Capturar foto del diseño
   - ✍️ **Manual**: Ingresar datos manualmente
3. **Procesar**: El sistema calcula automáticamente
4. **Ajustar** cantidad, tipo de tela, sublimación si aplica
5. **Guardar** la cotización

### Flujo de Orden de Trabajo

1. Desde una cotización guardada, **confirmar orden**
2. Establecer **fecha de entrega**
3. Actualizar **estado** según progreso:
   - 🔄 En Proceso
   - ✅ Entregado  
   - ❌ Cancelado

### Configuración de Precios

Acceder desde el panel de configuración (requiere rol `administrador`):

- **Precio por 1000 puntadas**: Base del cálculo
- **Factor cambio de hilo**: Costo adicional por cada color
- **Materiales**: Pellón, tela, papel, etc.
- **Corte e impresión**: Para trabajos con sublimación

---

## 👤 Credenciales por Defecto

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin   | -private-  | administrador |

> ⚠️ **Importante**: Cambiar la contraseña del administrador después de la primera instalación.

---

## 🌐 Publicación con zrok (Túneles Públicos)

Esta sección detalla cómo transformar tu estación de trabajo local en un servidor accesible globalmente mediante túneles persistentes de [zrok.io](https://zrok.io). Ideal para pruebas de campo en dispositivos móviles y demostraciones en tiempo real.

### Fundamentos Técnicos

El sistema utiliza un túnel de capa de aplicación que mapea puertos locales a subdominios públicos con certificados SSL automáticos.

- **Persistencia**: Mediante la reserva de "shares", las URLs se mantienen constantes
- **Seguridad**: Configuración de `allowedHosts` para prevenir ataques de redirección
- **Conectividad**: Bypass de intersticial para comunicaciones API

### Configuración Inicial de zrok

#### 1. Autenticación del Entorno

Una vez descargado el binario de zrok, vincular el entorno local:

```bash
.\zrok.exe enable <TU_TOKEN_PERSONAL>
```

#### 2. Reserva de Dominios Persistentes

Para URLs constantes al reiniciar, usar reserva en modo proxy:

```bash
# Frontend (Vite - Puerto 5173)
.\zrok.exe reserve public http://127.0.0.1:5173 --backend-mode proxy

# Backend (Flask - Puerto 5000)
.\zrok.exe reserve public http://127.0.0.1:5000 --backend-mode proxy
```

### Configuración del Frontend (Vite)

Vite bloquea acceso desde dominios externos. Modificar `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',      // Expone a la red local
    port: 5173,
    strictPort: true,
    allowedHosts: 'all',  // Permite acceso desde zrok
    cors: true
  }
})
```

### Configuración del Backend (Flask)

El backend debe aceptar peticiones CORS y cabeceras de zrok:

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": "*", 
        "allow_headers": ["Content-Type", "skip_zrok_interstitial"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

### Header de Bypass (Crítico)

Zrok incluye una página intermedia de advertencia. Para peticiones API, añadir el header:

```typescript
// services/api.ts
const API_URL = "https://tu-token-backend.share.zrok.io";

const headersBase = {
  "skip_zrok_interstitial": "true"  // Salta la advertencia de zrok
};

const headersJson = {
  ...headersBase,
  "Content-Type": "application/json"
};

export const fetchData = async () => {
  const response = await fetch(`${API_URL}/endpoint`, {
    headers: headersJson
  });
  return response.json();
};
```

### Automatización del Lanzamiento

Orden recomendado:

1. **Iniciar servidores locales** (MySQL, Flask, Vite)
2. **Activar túneles** con el token reservado:

```bash
.\zrok.exe share reserved <TOKEN_RESERVADO> --override-endpoint http://127.0.0.1:<PUERTO>
```

### Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `404 Not Found` | El túnel no encuentra el servidor local | Verificar que Vite/Flask estén corriendo antes de zrok |
| `Blocked request` | Seguridad de Vite activa | Verificar `allowedHosts: 'all'` en vite.config |
| `CORS Policy Error` | Flask no acepta el origen | Revisar configuración `CORS(app)` |
| `net::ERR_FAILED` | HTML de advertencia en lugar de JSON | Verificar header `skip_zrok_interstitial` |

---

## 📄 Licencia

Proyecto privado de **Zequitex SRL**. Todos los derechos reservados.

---

## 🤝 Contribuciones

Para reportar errores o sugerir mejoras, contactar al equipo de desarrollo.

# 🎨 Zequitex Cotizador - Frontend

Aplicación web desarrollada con **React + TypeScript + Vite** para el sistema de cotización de Zequitex SRL.

## 🚀 Características

- **Diseño Moderno**: Interfaz de usuario intuitiva y responsiva.
- **Cotización Multimodal**:
  - 📤 **Upload**: Subida de archivos de imagen.
  - 📷 **Cámara**: Captura en tiempo real.
  - ✍️ **Manual**: Entrada de datos directa.
- **Visualización en Tiempo Real**: Vista previa de la imagen procesada y desglose de costos.
- **Gestión de Órdenes**: Flujo completo desde cotización hasta orden de trabajo.
- **Optimización de Imágenes**: Integración con Cloudinary para almacenamiento eficiente (WebP).

## 🛠 Instalación y Ejecución

### Requisitos
- Node.js 18.x o superior
- npm 9.x o superior

### Pasos

1.  **Clonar el repositorio** (si aún no lo has hecho):
    ```bash
    git clone <url-del-repo>
    cd cotizadorZequitex/frontend
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` en la raíz del directorio `frontend` basado en `.env.example`:
    ```env
    VITE_API_URL=http://localhost:5000
    ```

4.  **Ejecutar servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:5173`.

## 📦 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── modes/          # Modos de cotización (Camera, Upload, Manual)
│   │   ├── ui/             # Componentes UI reutilizables
│   │   └── views/          # Vistas principales (Config, Login, Ordenes)
│   ├── services/           # Lógica de comunicación con API
│   ├── types/              # Definiciones de tipos TypeScript
│   └── App.tsx             # Componente raíz y ruteo
└── vite.config.ts          # Configuración de Vite
```

## 🌐 Despliegue con zrok

Para exponer la aplicación públicamente usando zrok:

1.  Asegúrate de tener en `vite.config.ts`:
    ```ts
    server: {
      host: '0.0.0.0',
      allowedHosts: 'all'
    }
    ```
2.  Ejecuta el tunel:
    ```bash
    zrok reserve public http://127.0.0.1:5173 --backend-mode proxy
    ```

---
© 2024 Zequitex SRL

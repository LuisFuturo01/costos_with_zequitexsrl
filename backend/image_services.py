import os
import sys

# --- FIX CRÍTICO PARA WINDOWS ---
# Evita el error: "The system cannot find the file specified" en KMeans
os.environ["LOKY_MAX_CPU_COUNT"] = "1"

from rembg import remove
from PIL import Image
import numpy as np
from sklearn.cluster import KMeans
import math

# ==========================================
# 🎨 CONFIGURACIÓN DE COLORES
# ==========================================
PALETA_BORDADO = [
    {"nombre": "Negro", "rgb": (0, 0, 0), "hex": "#000000"},
    {"nombre": "Blanco", "rgb": (255, 255, 255), "hex": "#FFFFFF"},
    {"nombre": "Rojo", "rgb": (255, 0, 0), "hex": "#FF0000"},
    {"nombre": "Amarillo", "rgb": (255, 255, 0), "hex": "#FFFF00"},
    {"nombre": "Verde", "rgb": (0, 128, 0), "hex": "#008000"},
    {"nombre": "Azul", "rgb": (0, 0, 255), "hex": "#0000FF"},
    {"nombre": "Naranja", "rgb": (255, 140, 0), "hex": "#FF8C00"},
    {"nombre": "Morado", "rgb": (128, 0, 128), "hex": "#800080"},
    {"nombre": "Rosa", "rgb": (255, 192, 203), "hex": "#FFC0CB"},
    {"nombre": "Café", "rgb": (139, 69, 19), "hex": "#8B4513"},
    {"nombre": "Celeste", "rgb": (135, 206, 235), "hex": "#87CEEB"},
    {"nombre": "Dorado", "rgb": (218, 165, 32), "hex": "#DAA520"},
    {"nombre": "Gris", "rgb": (128, 128, 128), "hex": "#808080"},
    {"nombre": "Azul Marino", "rgb": (0, 0, 128), "hex": "#000080"},
    {"nombre": "Fucsia", "rgb": (255, 0, 255), "hex": "#FF00FF"},
    {"nombre": "Verde Lima", "rgb": (50, 205, 50), "hex": "#32CD32"},
    {"nombre": "Turquesa", "rgb": (64, 224, 208), "hex": "#40E0D0"},
    {"nombre": "Vino", "rgb": (128, 0, 32), "hex": "#800020"},
    {"nombre": "Beige", "rgb": (245, 245, 220), "hex": "#F5F5DC"},
    {"nombre": "Coral", "rgb": (255, 127, 80), "hex": "#FF7F50"},
]

def calcular_distancia_deltaE(color1, color2):
    # Tu lógica original de distancia de color (funciona bien)
    def rgb_to_lab(rgb):
        r, g, b = [x / 255.0 for x in rgb]
        def gamma(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
        r, g, b = gamma(r), gamma(g), gamma(b)
        x = r * 0.4124 + g * 0.3576 + b * 0.1805
        y = r * 0.2126 + g * 0.7152 + b * 0.0722
        z = r * 0.0193 + g * 0.1192 + b * 0.9505
        def f(t): return t ** (1/3) if t > 0.008856 else (7.787 * t + 16/116)
        x, y, z = x / 0.95047, y / 1.00000, z / 1.08883
        L = 116 * f(y) - 16
        a = 500 * (f(x) - f(y))
        b = 200 * (f(y) - f(z))
        return L, a, b
    
    L1, a1, b1 = rgb_to_lab(color1)
    L2, a2, b2 = rgb_to_lab(color2)
    return math.sqrt((L2 - L1)**2 + (a2 - a1)**2 + (b2 - b1)**2)

def mapear_a_paleta(color_rgb):
    mejor = None
    min_dist = float('inf')
    for color_std in PALETA_BORDADO:
        dist = calcular_distancia_deltaE(color_rgb, color_std["rgb"])
        if dist < min_dist:
            min_dist = dist
            mejor = color_std
    return mejor, min_dist

# --- TUS COLORES (Lógica Original que te gustaba) ---

def obtener_colores_dominantes_avanzado(imagen_pil, n_colores=10):
    try:
        img_array = np.array(imagen_pil)
        if img_array.shape[2] == 4:
            mask = img_array[:, :, 3] > 50
            pixeles_rgb = img_array[mask][:, :3]
        else:
            pixeles_rgb = img_array.reshape(-1, 3)
        
        if len(pixeles_rgb) < 10: return []
        
        colores_detectados = []
        
        # 1. K-Means optimizado
        muestra_size = min(8000, len(pixeles_rgb))
        indices = np.random.choice(len(pixeles_rgb), muestra_size, replace=False)
        muestra = pixeles_rgb[indices].astype(float)
        
        n_clusters = min(15, muestra_size // 100)
        if n_clusters < 1: n_clusters = 1

        # NOTA: Agregué n_init=10 explícito para evitar warnings futuros
        kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        kmeans.fit(muestra)
        
        for centro in kmeans.cluster_centers_:
            centro = np.clip(centro, 0, 255).astype(int)
            colores_detectados.append(tuple(centro))

        # Mapeo a paleta
        colores_finales = []
        nombres_vistos = set()
        distancias_por_nombre = {}
        
        for color_raw in colores_detectados:
            color_tuple = tuple(int(x) for x in color_raw)
            match, distancia = mapear_a_paleta(color_tuple)
            nombre = match["nombre"]
            
            if nombre not in nombres_vistos or distancia < distancias_por_nombre[nombre]:
                if nombre in nombres_vistos:
                    colores_finales = [c for c in colores_finales if c["nombre"] != nombre]
                
                colores_finales.append({
                    "hex": match["hex"],
                    "nombre": match["nombre"],
                    "rgb": match["rgb"],
                    "distancia": round(distancia, 2),
                    "confianza": max(0, 100 - distancia * 2)
                })
                nombres_vistos.add(nombre)
                distancias_por_nombre[nombre] = distancia
                
        colores_finales.sort(key=lambda x: x["confianza"], reverse=True)
        return colores_finales[:n_colores]
    except Exception as e:
        print(f"Error colores: {e}")
        return [{"hex": "#000000", "nombre": "Negro"}]

# --- MIS PUNTADAS (Lógica Nueva Bounding Box) ---

def calcular_estimacion_puntadas(imagen_pil, ancho_solicitado_cm, densidad=135):
    """
    Calcula las puntadas basándose en el CONTENIDO REAL (Dibujo), 
    ignorando el fondo transparente para la escala.
    Densidad 135 = Bordado Macizo
    """
    if imagen_pil.mode != 'RGBA':
        imagen_pil = imagen_pil.convert('RGBA')
    
    img_array = np.array(imagen_pil)

    # 1. Detectar Bounding Box (Límites del dibujo)
    filas = np.any(img_array[:, :, 3] > 20, axis=1)
    cols = np.any(img_array[:, :, 3] > 20, axis=0)

    if not np.any(filas) or not np.any(cols):
        return {"estimatedStitches": 0, "realArea": 0, "rectArea": 0, "height": 0}

    y_min, y_max = np.where(filas)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    # Dimensiones del DIBUJO en píxeles
    ancho_contenido_px = (x_max - x_min) + 1
    alto_contenido_px = (y_max - y_min) + 1

    # 2. Calcular Escala (CM por Píxel)
    # Asumimos que los "10cm" que pide el usuario son para el DIBUJO, no el fondo
    if ancho_contenido_px > 0:
        cm_por_pixel = ancho_solicitado_cm / ancho_contenido_px
    else:
        cm_por_pixel = 0

    # 3. Área de un píxel
    area_pixel_cm2 = cm_por_pixel * cm_por_pixel

    # 4. Contar píxeles sólidos
    pixeles_solidos = np.sum(img_array[:, :, 3] > 20)

    # 5. Área Real de Bordado
    area_real_bordado = pixeles_solidos * area_pixel_cm2

    # 6. Estimación Puntadas
    puntadas = int(area_real_bordado * densidad)
    if puntadas < 2000: puntadas = 2000

    # 7. Datos geométricos extra
    alto_real_cm = alto_contenido_px * cm_por_pixel
    area_rectangulo = ancho_solicitado_cm * alto_real_cm

    return {
        "estimatedStitches": puntadas,
        "realArea": round(area_real_bordado, 2),
        "rectArea": round(area_rectangulo, 2),
        "height": round(alto_real_cm, 2)
    }
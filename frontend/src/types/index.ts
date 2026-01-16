export interface ProcessResult {
  success: boolean;
  tenia_fondo: boolean;
  dims: { width: number; height: number }; // Dimensiones finales
  realArea: number;       // Área real de bordado
  estimatedStitches: number; // Puntadas estimadas
  colors: string[];       // Array de hex colors
  numColors: number;      // Cantidad de colores
  
  // Nuevo desglose de costos
  breakdown: {
    puntadas: number;
    colores: number;
    materiales: number;
    base: number;
    hilos?: number;
    // AGREGA ESTAS LÍNEAS:
    tela?: number;
    pellon?: number;
    corte?: number;
    impresion?: number;

  };
  
  precio_sugerido: number; // Precio final total
  imagen_procesada: string; // Base64
  
  // Campos opcionales de error
  message?: string;
  error?: string;
  mensaje?: string;
}

export interface Config {
  pricing: Pricing;
  discounts: any[]; 
  hoops: any[];
  stitch_density: number;
}

export interface User {
  id: number;
  nombre: string;
  usuario: string;
  role: 'administrador' | 'empleado'; // Tipos específicos
  celular?: string;
  domicilio?: string;
  activo: boolean;
  password?: string; // Solo para cuando creamos/editamos
}

export interface Client {
  id: number;
  nombre: string;
  numero_referencia?: string;
  domicilio?: string;
}

export interface Pricing {
  precio_stitch_1000: number;
  factor_cambio_hilo: number;
  costo_hilo_bordar: number;
  costo_hilo_bobina: number;
  costo_pellon: number;
  tela_estructurante: number;
  tela_normal: number;
  rollo_papel: number;
  costo_rollo: number;
  costo_impresion: number;
  fecha_modificacion?: string; 
  activo?: boolean;
  corte_impresion?: number;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: User;
}

export interface Order {
  id: number;
  cliente_id: number;
  configuracion_id: number;
  nombre_trabajo: string; // Nuevo
  fecha_pedido: string;
  
  // Nuevos campos estructurados
  puntadas: number;
  colores: number;
  ancho: number;
  alto: number;
  bastidor: string;
  tipo_tela: string;
  tiene_sublimacion: boolean;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  
  // El JSON con el desglose completo
  datos_json: string; 
  
  // Mantenemos detalles por si acaso, o lo quitamos si ya no lo usas en el backend
  detalles?: string; 
}

export type TabMode = 'upload' | 'camera' | 'manual';
export type View = 'main' | 'config' | 'login';

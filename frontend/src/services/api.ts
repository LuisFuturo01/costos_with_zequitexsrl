import type { Config, ProcessResult, LoginResponse, User, Client, Pricing, Orden, Cotizacion } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Cabecera indispensable para que zrok no bloquee la conexión
const headersBase = {
  "skip_zrok_interstitial": "true"
};

const headersJson = {
  ...headersBase,
  "Content-Type": "application/json"
};

export const api = {
  // --- CONFIGURACIÓN ---
  getConfig: async (): Promise<Config> => {
    const res = await fetch(`${API_URL}/config`, { headers: headersBase });
    if (!res.ok) throw new Error('Error al obtener configuración');
    return res.json();
  },

  updateConfig: async (config: Config) => {
    const res = await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: headersJson,
      body: JSON.stringify(config)
    });
    return res.json();
  },

  getPriceHistory: async (): Promise<Pricing[]> => {
    const res = await fetch(`${API_URL}/config/history`, { headers: headersBase }); 
    return res.json();
  },

  // --- AUTENTICACIÓN ---
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await fetch(`${API_URL}/config/login`, {
      method: 'POST',
      headers: headersJson,
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  // --- GESTIÓN DE USUARIOS ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, { headers: headersBase });
    return res.json();
  },

  saveUser: async (user: Partial<User>) => {
    const method = user.id ? 'PUT' : 'POST';
    const url = user.id ? `${API_URL}/users/${user.id}` : `${API_URL}/users`;
    const res = await fetch(url, {
      method,
      headers: headersJson,
      body: JSON.stringify(user)
    });
    return res.json();
  },

  deleteUser: async (id: number) => {
    const res = await fetch(`${API_URL}/users/${id}`, { 
      method: 'DELETE',
      headers: headersBase 
    });
    return res.json();
  },

  // --- GESTIÓN DE CLIENTES ---
  getClients: async (): Promise<Client[]> => {
    const res = await fetch(`${API_URL}/clients`, { headers: headersBase });
    return res.json();
  },

  saveClient: async (client: Partial<Client>) => {
    const method = client.id ? 'PUT' : 'POST';
    const url = client.id ? `${API_URL}/clients/${client.id}` : `${API_URL}/clients`;
    const res = await fetch(url, {
      method,
      headers: headersJson,
      body: JSON.stringify(client)
    });
    return res.json();
  },

  deleteClient: async (id: number) => {
    const res = await fetch(`${API_URL}/clients/${id}`, { 
      method: 'DELETE',
      headers: headersBase 
    });
    return res.json();
  },

  // --- PROCESAMIENTO DE IMÁGENES ---
  processImage: async (formData: FormData): Promise<ProcessResult> => {
    const res = await fetch(`${API_URL}/process`, {
      method: 'POST',
      headers: headersBase, // IMPORTANTE: Sin Content-Type aquí
      body: formData
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Error al procesar');
    return data;
  },

  // --- ÓRDENES Y COTIZACIONES ---
  getOrdenes: async (): Promise<Orden[]> => {
    const res = await fetch(`${API_URL}/ordenes`, { headers: headersBase });
    return res.json();
  },

  getClientOrders: async (clientId: number): Promise<Cotizacion[]> => {
    const res = await fetch(`${API_URL}/clients/${clientId}/orders`, { headers: headersBase });
    return res.json();
  },

  getClientOrdenes: async (clientId: number): Promise<Orden[]> => {
    const res = await fetch(`${API_URL}/clients/${clientId}/ordenes`, { headers: headersBase });
    return res.json();
  },

  getOrdenDetail: async (id: number): Promise<Orden> => {
    const res = await fetch(`${API_URL}/ordenes/${id}`, { headers: headersBase });
    return res.json();
  },

  getCotizacionDetail: async (id: number): Promise<Cotizacion> => {
    const res = await fetch(`${API_URL}/orders/${id}`, { headers: headersBase }); 
    return res.json();
  },

  createOrden: async (data: any) => {
    const res = await fetch(`${API_URL}/ordenes`, {
      method: 'POST',
      headers: headersJson,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateOrden: async (id: number, data: any) => {
    const res = await fetch(`${API_URL}/ordenes/${id}`, {
      method: 'PUT',
      headers: headersJson,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteOrden: async (id: number) => {
    const res = await fetch(`${API_URL}/ordenes/${id}`, {
      method: 'DELETE',
      headers: headersBase
    });
    return res.json();
  },

  saveOrder: async (orderData: any): Promise<{success: boolean, id: number, message?: string}> => {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: headersJson,
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al guardar cotización');
    }
    return res.json();
  }
};
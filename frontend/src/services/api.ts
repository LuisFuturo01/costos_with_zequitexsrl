import type { Config, ProcessResult, LoginResponse, User, Client, Pricing, Orden, Cotizacion } from '../types';

const API_URL = 'http://192.168.1.220:5000';

export const api = {
  // --- CONFIGURACIÓN ---
  getConfig: async (): Promise<Config> => {
    const res = await fetch(`${API_URL}/config`);
    if (!res.ok) throw new Error('Error al obtener configuración');
    return res.json();
  },

  updateConfig: async (config: Config) => {
    const res = await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  getPriceHistory: async (): Promise<Pricing[]> => {
      const res = await fetch(`${API_URL}/config/history`); 
      return res.json();
  },

  // --- AUTENTICACIÓN ---
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await fetch(`${API_URL}/config/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  updatePassword: async (currentPassword: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/config/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    return res.json();
  },

  // --- GESTIÓN DE USUARIOS (PERSONAL) ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`);
    return res.json();
  },

  saveUser: async (user: Partial<User>) => {
    const method = user.id ? 'PUT' : 'POST';
    const url = user.id ? `${API_URL}/users/${user.id}` : `${API_URL}/users`;
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar usuario');
    return data;
  },

  deleteUser: async (id: number) => {
    const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // --- GESTIÓN DE CLIENTES ---
  getClients: async (): Promise<Client[]> => {
    const res = await fetch(`${API_URL}/clients`);
    return res.json();
  },

  saveClient: async (client: Partial<Client>) => {
    const method = client.id ? 'PUT' : 'POST';
    const url = client.id ? `${API_URL}/clients/${client.id}` : `${API_URL}/clients`;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar cliente');
    return data;
  },

  deleteClient: async (id: number) => {
    const res = await fetch(`${API_URL}/clients/${id}`, { method: 'DELETE' });
    return res.json();
  },

  getClientOrders: async (clientId: number): Promise<Cotizacion[]> => {
      const res = await fetch(`${API_URL}/clients/${clientId}/orders`);
      return res.json();
  },

  getClientOrdenes: async (clientId: number): Promise<Orden[]> => {
      const res = await fetch(`${API_URL}/clients/${clientId}/ordenes`);
      return res.json();
  },
  
  // --- GESTIÓN DE COTIZACIONES ---
  saveOrder: async (orderData: {
      cliente_id: number, 
      configuracion_id: number, 
      nombre_trabajo: string, 
      tiene_sublimacion: boolean,
      [key: string]: unknown
  }) => {
      console.log("Enviando cotización al backend:", orderData);
      const res = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al guardar cotización');
      return data;
  },

  // --- GESTIÓN DE ÓRDENES (Nueva funcionalidad) ---
  getOrdenes: async (): Promise<Orden[]> => {
      const res = await fetch(`${API_URL}/ordenes`);
      return res.json();
  },

  createOrden: async (data: { cotizacion_id: number, fecha_entrega?: string, detail?: string }) => {
      const res = await fetch(`${API_URL}/ordenes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || 'Error al crear orden');
      return result;
  },

  updateOrden: async (id: number, data: Partial<Orden>) => {
      const res = await fetch(`${API_URL}/ordenes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Error al actualizar orden');
      return result;
  },

  deleteOrden: async (id: number) => {
      const res = await fetch(`${API_URL}/ordenes/${id}`, { method: 'DELETE' });
      return res.json();
  },

  // --- PROCESAMIENTO ---
  processImage: async (formData: FormData): Promise<ProcessResult> => {
    const res = await fetch(`${API_URL}/process`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.mensaje ?? data.error ?? 'Error desconocido');
    }
    return data;
  }
};
import type { Config, ProcessResult, LoginResponse, User, Client, Order, Pricing } from '../types';

const API_URL = 'http://192.168.1.211:5000';

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
    const method = user.id ? 'PUT' : 'POST'; // Si tiene ID edita, si no crea
    const url = user.id ? `${API_URL}/users/${user.id}` : `${API_URL}/users`;
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return res.json();
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
    return res.json();
  },

  deleteClient: async (id: number) => {
    const res = await fetch(`${API_URL}/clients/${id}`, { method: 'DELETE' });
    return res.json();
  },

  getClientOrders: async (clientId: number): Promise<Order[]> => {
      const res = await fetch(`${API_URL}/clients/${clientId}/orders`);
      return res.json();
  },
  saveOrder: async (orderData: {cliente_id: number, configuracion_id: number, detalles: string}) => {
      console.log("Enviando orden al backend:", orderData); // DEBUG
      const res = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al guardar orden');
      return data;
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
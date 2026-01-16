import { useState, useEffect, FormEvent } from 'react';
import type { Config, View, User, Client, Order, Pricing } from '../../types'; // Ajusté Pricing type si se llama PriceConfig en tu types, puse Pricing para coincidir con tu api.ts
import { api } from '../../services/api';
// Componentes UI
import { WorkClientView } from './WorkClientView';
import { AlertModal } from '../ui/AlertModal';

interface Props {
  config: Config;
  setConfig: (c: Config) => void;
  setView: (v: View) => void;
  setIsLoggedIn: (v: boolean) => void;
  currentUser: User | null;
}

const PRICE_FIELDS = [
  { key: 'precio_stitch_1000', label: '1.000 puntadas' },
  { key: 'factor_cambio_hilo', label: 'Factor Cambio Hilo' },
  { key: 'costo_hilo_bordar', label: 'Hilo Bordar' },
  { key: 'costo_hilo_bobina', label: 'Hilo Bobina' },
  { key: 'costo_pellon', label: 'Rollo de pellon' },
  { key: 'tela_estructurante', label: 'Tela Estructurante por metro' },
  { key: 'tela_normal', label: 'Tela Normal por metro' },
  { key: 'rollo_papel', label: 'Rollo de papel' },
  { key: 'costo_impresion', label: 'Impresión' },
  { key: 'corte_impresion', label: 'Corte de Aplicación por minuto' }
];

export const ConfigView = ({ config, setConfig, setView, setIsLoggedIn, currentUser }: Props) => {
  const isAdmin = currentUser?.role === 'administrador' || currentUser?.role === 'admin';
  const canManageClients = true; 

  const [activeTab, setActiveTab] = useState<'precios' | 'historial' | 'usuarios' | 'clientes'>('precios');
  
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [priceHistory, setPriceHistory] = useState<Pricing[]>([]);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  
  const [selectedClientForOrders, setSelectedClientForOrders] = useState<Client | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: number, type: 'user'|'client'}>({isOpen: false, id: 0, type: 'user'});
  const [alertInfo, setAlertInfo] = useState<{open: boolean, msg: string}>({open: false, msg: ''});

  useEffect(() => {
    if (activeTab === 'usuarios' && isAdmin) loadUsers();
    if (activeTab === 'clientes' && canManageClients) loadClients();
    if (activeTab === 'historial' && isAdmin) loadHistory();
  }, [activeTab, isAdmin, canManageClients]);

  const loadUsers = () => api.getUsers().then(setUsers).catch(console.error);
  const loadClients = () => api.getClients().then(setClients).catch(console.error);
  
  const loadHistory = async () => {
      try {
          const history = await api.getPriceHistory();
          setPriceHistory(history);
      } catch (e) { console.error("Error historial", e); }
  };

  const handleShowOrders = async (client: Client) => {
      setSelectedClientForOrders(client);
      setClientOrders([]); 
      try {
          const orders = await api.getClientOrders(client.id);
          setClientOrders(orders);
      } catch (e) { setAlertInfo({open: true, msg: "Error cargando órdenes"}); }
  };

  // --- LOGICA PARA CLONAR/GUARDAR NUEVA COTIZACIÓN ---
  const handleCloneOrder = async (newOrderData: any) => {
      try {
          // Asignar el ID del cliente actual
          const payload = {
              ...newOrderData,
              cliente_id: selectedClientForOrders?.id,
              configuracion_id: config.pricing.id 
          }; // Corregido: 'id' suele estar en pricing, verifica tu interface Pricing

          await api.saveOrder(payload);
          setAlertInfo({ open: true, msg: '✅ Nueva cotización generada correctamente' });
          setViewingOrder(null); 
          
          if (selectedClientForOrders) {
              const updatedOrders = await api.getClientOrders(selectedClientForOrders.id);
              setClientOrders(updatedOrders);
          }
      } catch (error: any) {
          setAlertInfo({ open: true, msg: `Error: ${error.message}` });
      }
  };

  const updatePrice = (field: string, val: number) => {
    // @ts-ignore
    setConfig({...config, pricing: {...config.pricing, [field]: val}});
  };

  const saveGeneralConfig = async () => {
      try {
          await api.updateConfig(config);
          setAlertInfo({open: true, msg: 'Configuración actualizada correctamente'});
          const newConfig = await api.getConfig();
          setConfig(newConfig);
      } catch (error) { setAlertInfo({open: true, msg: 'Error al guardar'}); }
  };

  // --- MANEJO DE USUARIOS (EMPLEADOS) ---
  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
        const res = await api.saveUser(editingUser);
        // Verificar éxito basado en tu API
        if (res.success || res.id) { 
            setEditingUser(null); 
            loadUsers(); 
            setAlertInfo({open: true, msg: 'Usuario guardado correctamente'});
        } else {
            setAlertInfo({open: true, msg: res.message || 'Error al guardar usuario'});
        }
    } catch (error: any) {
        setAlertInfo({open: true, msg: error.message});
    }
  };
  
  const requestDeleteUser = (id: number) => setConfirmModal({isOpen: true, id, type: 'user'});

  // --- MANEJO DE CLIENTES ---
  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
        await api.saveClient(editingClient);
        setEditingClient(null);
        await loadClients(); // Esperamos a que cargue
        setAlertInfo({open: true, msg: 'Cliente guardado correctamente'});
    } catch (error: any) {
        setAlertInfo({open: true, msg: error.message || 'Error al guardar cliente'});
    }
  };

  const requestDeleteClient = (id: number) => setConfirmModal({isOpen: true, id, type: 'client'});

  const confirmDelete = async () => {
      setConfirmModal({...confirmModal, isOpen: false});
      try {
          if (confirmModal.type === 'user') {
              await api.deleteUser(confirmModal.id);
              loadUsers();
          } else {
              await api.deleteClient(confirmModal.id);
              loadClients();
          }
      } catch (e) {
          setAlertInfo({open: true, msg: 'Error al eliminar registro'});
      }
  };

  return (
    <div className="app config-view">
      <header className="header">
        <h1 className="brand-name">
            {isAdmin ? 'Panel Admin' : 'Panel Empleado'}
        </h1>
        <div className="user-info">
            <span>{currentUser?.usuario} ({currentUser?.role})</span>
            <button className="btn-secondary sm" onClick={() => {setIsLoggedIn(false); setView('main')}}>Salir</button>
        </div>
      </header>

      <AlertModal 
        isOpen={alertInfo.open}
        title="Información"
        message={alertInfo.msg}
        onClose={() => setAlertInfo({open: false, msg: ''})}
      />

      {confirmModal.isOpen && (
          <div className="modal-overlay" style={{zIndex: 3002}}>
              <div className="modal-card" style={{maxWidth: '350px', textAlign: 'center'}}>
                  <h3 style={{color: '#ef4444', marginBottom: '1rem'}}>¿Estás seguro?</h3>
                  <p style={{marginBottom: '1.5rem', color: '#000000ff'}}>Esta acción eliminará el registro permanentemente.</p>
                  <div className="modal-actions" style={{justifyContent: 'center'}}>
                      <button className="btn-secondary" onClick={() => setConfirmModal({...confirmModal, isOpen: false})}>Cancelar</button>
                      <button className="btn-main" style={{background: '#ef4444', borderColor: '#ef4444'}} onClick={confirmDelete}>Eliminar</button>
                  </div>
              </div>
          </div>
      )}

      <div className="container">
        <div className="tabs">
            <button className={`tab ${activeTab === 'precios' ? 'active' : ''}`} onClick={() => setActiveTab('precios')}>Precios</button>
            {canManageClients && (
                <button className={`tab ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}>Clientes</button>
            )}
            {isAdmin && (
                <>
                    <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>Historial</button>
                    <button className={`tab ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>Personal</button>
                </>
            )}
        </div>

        {viewingOrder && selectedClientForOrders && (
            <WorkClientView 
                order={viewingOrder} 
                clientName={selectedClientForOrders.nombre} 
                onClose={() => setViewingOrder(null)}
                config={config} 
                onSaveNewOrder={handleCloneOrder}
            />
        )}

        {/* TAB PRECIOS */}
        {activeTab === 'precios' && (
            <div className="card">
                <div className="card-header">
                    <h3>Precios Vigentes</h3>
                    <small>Mod: {config.pricing.fecha_modificacion || 'N/A'}</small>
                </div>
                <div className="config-grid">
                    {PRICE_FIELDS.map((field) => (
                        <div className="config-item" key={field.key}>
                            <label>{field.label}</label>
                            {/* @ts-ignore */}
                            <input type="number" step="0.01" className="styled-input" disabled={!isAdmin} value={config.pricing[field.key]} onChange={e => updatePrice(field.key, parseFloat(e.target.value))} />
                        </div>
                    ))}
                </div>
                {isAdmin && <button className="btn-main" style={{marginTop: 20}} onClick={saveGeneralConfig}>Guardar Cambios</button>}
            </div>
        )}

        {/* TAB CLIENTES */}
        {activeTab === 'clientes' && canManageClients && (
            <div className="card">
                <div className="card-header">
                    <h3>Clientes</h3>
                    <button className="btn-main sm" onClick={()=>setEditingClient({})}>+ Nuevo</button>
                </div>

                {selectedClientForOrders && (
                    <div className="modal-overlay">
                        <div className="modal-card" style={{maxWidth: '800px'}}>
                            <div className="card-header">
                                <h3>Órdenes: {selectedClientForOrders.nombre}</h3>
                                <button className="icon-btn" onClick={()=>setSelectedClientForOrders(null)}>✕</button>
                            </div>
                            <div style={{maxHeight:'400px', overflowY:'auto', margin:'10px 0'}}>
                                {clientOrders.length === 0 ? <p>No hay cotizaciones guardadas.</p> : (
                                    <div className="data-table">
                                        <thead>
                                            <div>
                                                <th>Fecha</th>
                                                <th>Trabajo</th>
                                                <th style={{textAlign: 'right'}}>Acción</th>
                                            </div>
                                        </thead>
                                        <tbody>
                                            {clientOrders.map(o => (
                                                <div key={o.id}>
                                                    <span>{new Date(o.fecha_pedido).toLocaleDateString()}</span>
                                                    <span style={{fontSize:'0.9rem', fontWeight: 'bold', color: '#fff'}}>{o.nombre_trabajo}</span>
                                                    <span style={{textAlign: 'right'}}>
                                                        <button className="btn-secondary sm" onClick={() => setViewingOrder(o)}>👁️ Ver</button>
                                                    </span>
                                                </div>
                                            ))}
                                        </tbody>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {editingClient && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <form onSubmit={handleSaveClient}>
                                <h3>{editingClient.id ? 'Editar' : 'Nuevo'} Cliente</h3>
                                <label style={{fontSize:'0.8rem', color:'#888'}}>Nombre del Cliente</label>
                                <input className="styled-input" required placeholder="Nombre" value={editingClient.nombre || ''} onChange={e=>setEditingClient({...editingClient, nombre:e.target.value})} />
                                
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:10, display:'block'}}>Nro Referencia / Teléfono</label>
                                <input className="styled-input" placeholder="Referencia" value={editingClient.numero_referencia || ''} onChange={e=>setEditingClient({...editingClient, numero_referencia:e.target.value})} />
                                
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:10, display:'block'}}>Domicilio</label>
                                <input className="styled-input" placeholder="Domicilio" value={editingClient.domicilio || ''} onChange={e=>setEditingClient({...editingClient, domicilio:e.target.value})} />
                                
                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={()=>setEditingClient(null)}>Cancelar</button>
                                    <button type="submit" className="btn-main">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="data-table">
                    <thead><div><th>Nombre</th><th>Ref</th><th>Acciones</th></div></thead>
                    <tbody>
                        {clients.map(c => (
                            <div key={c.id}>
                                <span style={{cursor: 'pointer', color: '#34d399', fontWeight: 'bold'}} onClick={() => handleShowOrders(c)}>{c.nombre} ↗</span>
                                <span>{c.numero_referencia}</span>
                                <span>
                                    <button className="icon-btn" onClick={() => setEditingClient(c)}>✏️</button>
                                    {isAdmin && <button className="icon-btn danger" onClick={() => requestDeleteClient(c.id)}>🗑️</button>}
                                </span>
                            </div>
                        ))}
                    </tbody>
                </div>
            </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && isAdmin && (
            <div className="card" style={{overflowX: 'auto'}}>
                <h3>Historial de Configuraciones</h3>
                <div className="table-responsive" style={{overflowX: 'auto'}}>
                    <div className="data-table" style={{minWidth: '1200px', fontSize: '0.85rem'}}>
                        <thead>
                            <div>
                                <th style={{width: 140}}>Fecha</th>
                                <th>1.000 pts</th><th>Fac c/hilo</th><th>H. Bordar</th><th>H. Bobina</th><th>Pellón Rollo</th><th>T. Estruct</th><th>T. Normal</th><th>Papel Rollo</th><th>Imp.</th><th>Corte</th><th>Estado</th>
                            </div>
                        </thead>
                        <tbody>
                            {priceHistory.map(h => (
                                <div key={h.id}>
                                    <span>{h.fecha_modificacion ? new Date(h.fecha_modificacion).toLocaleString() : 'N/A'}</span>
                                    <span>{h.precio_stitch_1000}</span><span>{h.factor_cambio_hilo}</span><span>{h.costo_hilo_bordar}</span><span>{h.costo_hilo_bobina}</span><span>{h.costo_pellon}</span><span>{h.tela_estructurante}</span><span>{h.tela_normal}</span><span>{h.rollo_papel}</span><span>{h.costo_impresion}</span><span>{h.corte_impresion}</span>
                                    <span>{h.activo ? <span className="badge admin" style={{background:'#10b981'}}>Activo</span> : <span className="badge user" style={{background:'#9ca3af'}}>Inactivo</span>}</span>
                                </div>
                            ))}
                        </tbody>
                    </div>
                </div>
            </div>
        )}

        {/* TAB USUARIOS - CORREGIDO */}
        {activeTab === 'usuarios' && isAdmin && (
            <div className="card">
                <div className="card-header">
                    <h3>Usuarios / Empleados</h3>
                    <button className="btn-main sm" onClick={()=>setEditingUser({})}>+ Nuevo Personal</button>
                </div>
                
                {editingUser && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <form onSubmit={handleSaveUser}>
                                <h3>{editingUser.id ? 'Editar' : 'Crear'} Usuario</h3>
                                
                                <label style={{fontSize:'0.8rem', color:'#888'}}>Nombre Completo</label>
                                <input className="styled-input" required placeholder="Ej: Juan Perez" value={editingUser.nombre || ''} onChange={e=>setEditingUser({...editingUser, nombre:e.target.value})}/>
                                
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:8, display:'block'}}>Usuario (Login)</label>
                                <input className="styled-input" required placeholder="usuario" value={editingUser.usuario || ''} onChange={e=>setEditingUser({...editingUser, usuario:e.target.value})}/>
                                
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:8, display:'block'}}>Contraseña {editingUser.id && '(Dejar en blanco para no cambiar)'}</label>
                                <input className="styled-input" type="password" placeholder="***" value={editingUser.password || ''} onChange={e=>setEditingUser({...editingUser, password:e.target.value})}/>
                                
                                {/* NUEVOS CAMPOS AÑADIDOS */}
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:8, display:'block'}}>Celular</label>
                                <input className="styled-input" placeholder="777..." type="tel" value={editingUser.celular || ''} onChange={e=>setEditingUser({...editingUser, celular:e.target.value})}/>

                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:8, display:'block'}}>Domicilio</label>
                                <input className="styled-input" placeholder="Dirección..." value={editingUser.domicilio || ''} onChange={e=>setEditingUser({...editingUser, domicilio:e.target.value})}/>
                                
                                <label style={{fontSize:'0.8rem', color:'#888', marginTop:8, display:'block'}}>Rol</label>
                                <select className="styled-input" value={editingUser.role || 'empleado'} onChange={e=>setEditingUser({...editingUser, role:e.target.value as any})}>
                                    <option value="empleado">Empleado</option>
                                    <option value="administrador">Administrador</option>
                                </select>
                                
                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={()=>setEditingUser(null)}>Cancelar</button>
                                    <button type="submit" className="btn-main">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                <div className="data-table">
                    <thead>
                        <div>
                            <th>Usuario</th>
                            <th>Nombre</th>
                            <th>Celular</th>
                            <th>Domicilio</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                        </div>
                    </thead>
                    <tbody>
                        {users.map(u=>(
                            <div key={u.id}>
                                <span style={{fontWeight:'bold'}}>{u.usuario}</span>
                                <span>{u.nombre}</span>
                                <span>{u.celular || '-'}</span>
                                <span style={{fontSize:'0.85rem'}}>{u.domicilio || '-'}</span>
                                <span>{u.role === 'administrador' ? '👑 Admin' : 'Empleado'}</span>
                                <span>
                                    <button className="icon-btn" onClick={()=>setEditingUser(u)} title="Editar">✏️</button>
                                    <button className="icon-btn danger" onClick={()=>requestDeleteUser(u.id)} title="Eliminar">🗑️</button>
                                </span>
                            </div>
                        ))}
                    </tbody>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
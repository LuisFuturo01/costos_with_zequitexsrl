import { useState, useEffect, FormEvent } from 'react';
import type { Config, View, User, Client, Order, PriceConfig } from '../../types';
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
  const [priceHistory, setPriceHistory] = useState<PriceConfig[]>([]);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  
  const [selectedClientForOrders, setSelectedClientForOrders] = useState<Client | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  // --- MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ---
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

  // --- USUARIOS ---
  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await api.saveUser(editingUser);
    if (res.success) { setEditingUser(null); loadUsers(); } else setAlertInfo({open: true, msg: res.message});
  };
  
  const requestDeleteUser = (id: number) => setConfirmModal({isOpen: true, id, type: 'user'});

  // --- CLIENTES ---
  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    await api.saveClient(editingClient);
    setEditingClient(null);
    loadClients();
  };

  const requestDeleteClient = (id: number) => setConfirmModal({isOpen: true, id, type: 'client'});

  // --- EJECUCIÓN DE ELIMINACIÓN ---
  const confirmDelete = async () => {
      setConfirmModal({...confirmModal, isOpen: false});
      if (confirmModal.type === 'user') {
          await api.deleteUser(confirmModal.id);
          loadUsers();
      } else {
          await api.deleteClient(confirmModal.id);
          loadClients();
      }
  };

  return (
    // Importante: La clase 'app' asegura que el header tome los estilos globales
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

      {/* --- MODALES INTERNOS --- */}
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
                  <p style={{marginBottom: '1.5rem', color: '#fff'}}>Esta acción eliminará el registro permanentemente.</p>
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

        {/* --- VISOR DE TICKET HISTÓRICO --- */}
        {viewingOrder && selectedClientForOrders && (
            <WorkClientView 
                order={viewingOrder} 
                clientName={selectedClientForOrders.nombre} 
                onClose={() => setViewingOrder(null)} 
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
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Trabajo</th>
                                                <th style={{textAlign: 'right'}}>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientOrders.map(o => (
                                                <tr key={o.id}>
                                                    <td>{new Date(o.fecha_pedido).toLocaleDateString()}</td>
                                                    <td style={{fontSize:'0.9rem', fontWeight: 'bold', color: '#fff'}}>{o.nombre_trabajo}</td>
                                                    <td style={{textAlign: 'right'}}>
                                                        <button className="btn-secondary sm" onClick={() => setViewingOrder(o)}>👁️ Ver</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
                                <input className="styled-input" required placeholder="Nombre" value={editingClient.nombre||''} onChange={e=>setEditingClient({...editingClient, nombre:e.target.value})} />
                                <input className="styled-input" style={{marginTop:10}} placeholder="Referencia" value={editingClient.numero_referencia||''} onChange={e=>setEditingClient({...editingClient, numero_referencia:e.target.value})} />
                                <input className="styled-input" style={{marginTop:10}} placeholder="Domicilio" value={editingClient.domicilio||''} onChange={e=>setEditingClient({...editingClient, domicilio:e.target.value})} />
                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={()=>setEditingClient(null)}>Cancelar</button>
                                    <button type="submit" className="btn-main">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <table className="data-table">
                    <thead><tr><th>Nombre</th><th>Ref</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {clients.map(c => (
                            <tr key={c.id}>
                                <td style={{cursor: 'pointer', color: '#34d399', fontWeight: 'bold'}} onClick={() => handleShowOrders(c)}>{c.nombre} ↗</td>
                                <td>{c.numero_referencia}</td>
                                <td>
                                    <button className="icon-btn" onClick={() => setEditingClient(c)}>✏️</button>
                                    {isAdmin && <button className="icon-btn danger" onClick={() => requestDeleteClient(c.id)}>🗑️</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && isAdmin && (
            <div className="card" style={{overflowX: 'auto'}}>
                <h3>Historial de Configuraciones</h3>
                <div className="table-responsive" style={{overflowX: 'auto'}}>
                    <table className="data-table" style={{minWidth: '1200px', fontSize: '0.85rem'}}>
                        <thead>
                            <tr>
                                <th style={{width: 140}}>Fecha</th>
                                <th>1.000 pts</th><th>Fac c/hilo</th><th>H. Bordar</th><th>H. Bobina</th><th>Pellón Rollo</th><th>T. Estruct</th><th>T. Normal</th><th>Papel Rollo</th><th>Imp.</th><th>Corte</th><th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {priceHistory.map(h => (
                                <tr key={h.id}>
                                    <td>{h.fecha_modificacion ? new Date(h.fecha_modificacion).toLocaleString() : 'N/A'}</td>
                                    <td>{h.precio_stitch_1000}</td><td>{h.factor_cambio_hilo}</td><td>{h.costo_hilo_bordar}</td><td>{h.costo_hilo_bobina}</td><td>{h.costo_pellon}</td><td>{h.tela_estructurante}</td><td>{h.tela_normal}</td><td>{h.rollo_papel}</td><td>{h.costo_impresion}</td><td>{h.corte_impresion}</td>
                                    <td>{h.activo ? <span className="badge admin" style={{background:'#10b981'}}>Activo</span> : <span className="badge user" style={{background:'#9ca3af'}}>Inactivo</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB USUARIOS */}
        {activeTab === 'usuarios' && isAdmin && (
            <div className="card">
                <div className="card-header"><h3>Usuarios</h3><button className="btn-main sm" onClick={()=>setEditingUser({})}>+</button></div>
                {editingUser && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <form onSubmit={handleSaveUser}>
                                <input className="styled-input" placeholder="Nombre" value={editingUser.nombre||''} onChange={e=>setEditingUser({...editingUser, nombre:e.target.value})}/>
                                <input className="styled-input" style={{marginTop:10}} placeholder="Usuario" value={editingUser.usuario||''} onChange={e=>setEditingUser({...editingUser, usuario:e.target.value})}/>
                                <input className="styled-input" style={{marginTop:10}} type="password" placeholder="Pass" value={editingUser.password||''} onChange={e=>setEditingUser({...editingUser, password:e.target.value})}/>
                                <select className="styled-input" style={{marginTop:10}} value={editingUser.role} onChange={e=>setEditingUser({...editingUser, role:e.target.value as any})}><option value="empleado">Empleado</option><option value="administrador">Admin</option></select>
                                <div className="modal-actions"><button type="submit" className="btn-main">Guardar</button><button type="button" className="btn-secondary" onClick={()=>setEditingUser(null)}>X</button></div>
                            </form>
                        </div>
                    </div>
                )}
                <table className="data-table"><tbody>{users.map(u=><tr key={u.id}><td>{u.usuario}</td><td>{u.role}</td><td><button className="icon-btn danger" onClick={()=>requestDeleteUser(u.id)}>🗑️</button></td></tr>)}</tbody></table>
            </div>
        )}
      </div>
    </div>
  );
};
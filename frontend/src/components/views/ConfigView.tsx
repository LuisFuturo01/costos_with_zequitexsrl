import { useState, useEffect, type FormEvent } from 'react';
import type { Config, View, User, Client, Order, Pricing, Orden } from '../../types';
import { api } from '../../services/api';
// Componentes UI
import { WorkClientView } from './WorkClientView';
import { AlertModal } from '../ui/AlertModal';
import { OrdenesView } from './OrdenesView';
// Iconos SVG
import cotizacionIcon from '../../assets/images/cotizacion.svg';
import ordenIcon from '../../assets/images/orden.svg';
import closeIcon from '../../assets/images/close.svg';
import viewIcon from '../../assets/images/view.svg';
import editIcon from '../../assets/images/edit.svg';
import deleteIcon from '../../assets/images/delete.svg';
import adminIcon from '../../assets/images/admin.svg';
import checkIcon from '../../assets/images/check.svg';
import cancelIcon from '../../assets/images/cancel.svg';
import processIcon from '../../assets/images/process.svg';

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
  { key: 'costo_hilo_bordar', label: 'Costo Hilo Bordar (cono)' },
  { key: 'costo_hilo_bobina', label: 'Costo Hilo Bobina (cono)' },
  { key: 'costo_pellon', label: 'Costo Rollo de pellon' },
  { key: 'tela_estructurante', label: 'Costo Tela Estructurante (metro)' },
  { key: 'tela_normal', label: 'Costo Tela Normal (metro)' },
  { key: 'rollo_papel', label: 'Costo Rollo de papel' },
  { key: 'costo_impresion', label: 'Costo Impresión (30x30 cm)' },
  { key: 'corte_impresion', label: 'Costo Corte de Aplicación (minuto)' }
];

export const ConfigView = ({ config, setConfig, setView, setIsLoggedIn, currentUser }: Props) => {
  const isAdmin = currentUser?.role === 'administrador';
  const canManageClients = true; 

  const [activeTab, setActiveTab] = useState<'precios' | 'historial' | 'usuarios' | 'clientes' | 'ordenes'>('precios');
  
  const CACHE_KEY_USERS = 'zequitex_users';
  const CACHE_KEY_CLIENTS = 'zequitex_clients';

  const [users, setUsers] = useState<User[]>(() => {
      const cached = localStorage.getItem(CACHE_KEY_USERS);
      return cached ? JSON.parse(cached) : [];
  });
  const [clients, setClients] = useState<Client[]>(() => {
      const cached = localStorage.getItem(CACHE_KEY_CLIENTS);
      return cached ? JSON.parse(cached) : [];
  });
  const [priceHistory, setPriceHistory] = useState<Pricing[]>([]);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  
  const [selectedClientForOrders, setSelectedClientForOrders] = useState<Client | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [viewingDocType, setViewingDocType] = useState<'cotizacion' | 'orden'>('cotizacion');

  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: number, type: 'user'|'client'}>({isOpen: false, id: 0, type: 'user'});
  const [alertInfo, setAlertInfo] = useState<{open: boolean, msg: string}>({open: false, msg: ''});

  const [clientOptionsModal, setClientOptionsModal] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<'cotizaciones' | 'ordenes' | null>(null);
  const [clientOrdenes, setClientOrdenes] = useState<Orden[]>([]);
  
  const [orderFromCotizacion, setOrderFromCotizacion] = useState<Order | null>(null);
  const [newOrderFechaEntrega, setNewOrderFechaEntrega] = useState('');
  
  // Trigger para actualizar la vista de órdenes
  const [refreshOrdenesTrigger, setRefreshOrdenesTrigger] = useState(0);

  useEffect(() => {
    if (activeTab === 'usuarios' && isAdmin) loadUsers();
    if (activeTab === 'clientes' && canManageClients) loadClients();
    if (activeTab === 'historial' && isAdmin) loadHistory();
  }, [activeTab, isAdmin, canManageClients]);

  const loadUsers = () => api.getUsers().then(data => { setUsers(data); localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(data)); }).catch(console.error);
  const loadClients = () => api.getClients().then(data => { setClients(data); localStorage.setItem(CACHE_KEY_CLIENTS, JSON.stringify(data)); }).catch(console.error);
  
  const loadHistory = async () => {
      try {
          const history = await api.getPriceHistory();
          setPriceHistory(history);
      } catch (e) { console.error("Error historial", e); }
  };

  const handleShowClientOptions = (client: Client) => {
    setClientOptionsModal(client);
    setViewMode(null);
  };

  const loadClientCotizaciones = async (client: Client) => {
      setSelectedClientForOrders(client);
      setClientOptionsModal(null);
      setViewMode('cotizaciones');
      setClientOrders([]); 
      try {
          const orders = await api.getClientOrders(client.id);
          setClientOrders(orders);
      } catch { setAlertInfo({open: true, msg: "Error cargando cotizaciones"}); }
  };

  const loadClientOrdenes = async (client: Client) => {
      setSelectedClientForOrders(client);
      setClientOptionsModal(null);
      setViewMode('ordenes');
      setClientOrdenes([]);
      try {
          const clientOrdenesData = await api.getClientOrdenes(client.id);
          setClientOrdenes(clientOrdenesData);
      } catch { setAlertInfo({open: true, msg: "Error cargando órdenes"}); }
  };

  const handleCreateOrderFromCotizacion = async () => {
    if (!orderFromCotizacion) return;
    try {
      await api.createOrden({
        cotizacion_id: orderFromCotizacion.id,
        fecha_entrega: newOrderFechaEntrega || undefined
      });
      setAlertInfo({ open: true, msg: '✅ Orden creada correctamente' });
      setOrderFromCotizacion(null);
      setNewOrderFechaEntrega('');
      setRefreshOrdenesTrigger(prev => prev + 1); // Forzar recarga de OrdenesView
      if (selectedClientForOrders) {
        const updatedOrders = await api.getClientOrders(selectedClientForOrders.id);
        setClientOrders(updatedOrders);
      }
    } catch {
      setAlertInfo({ open: true, msg: 'Error al crear orden' });
    }
  };

  const handleCloneOrder = async (newOrderData: any) => {
      try {
          const payload = {
              ...newOrderData,
              cliente_id: selectedClientForOrders?.id,
              configuracion_id: config.pricing.id 
          }; 
          await api.saveOrder(payload);
          setAlertInfo({ open: true, msg: '✅ Nueva cotización generada correctamente' });
          setViewingOrder(null); 
          if (selectedClientForOrders) {
              const updatedOrders = await api.getClientOrders(selectedClientForOrders.id);
              setClientOrders(updatedOrders);
          }
      } catch { setAlertInfo({ open: true, msg: 'Error al generar cotización' }); }
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
      } catch { setAlertInfo({open: true, msg: 'Error al guardar'}); }
  };

  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
        const res = await api.saveUser(editingUser);
        if (res.success || res.id) { 
            setEditingUser(null); 
            loadUsers(); 
            setAlertInfo({open: true, msg: 'Usuario guardado correctamente'});
        }
    } catch {
        setAlertInfo({open: true, msg: 'Error al guardar usuario'});
    }
  };
  
  const requestDeleteUser = (id: number) => setConfirmModal({isOpen: true, id, type: 'user'});

  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
        await api.saveClient(editingClient);
        setEditingClient(null);
        await loadClients(); 
        setAlertInfo({open: true, msg: 'Cliente guardado correctamente'});
    } catch {
        setAlertInfo({open: true, msg: 'Error al guardar cliente'});
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
      } catch (e: any) {
          setAlertInfo({open: true, msg: e.message || 'Error al eliminar registro'});
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
            <button className="btn-secondary sm sm-salir" onClick={() => {setIsLoggedIn(false); setView('main')}}>Salir</button>
        </div>
      </header>

      <AlertModal 
        isOpen={alertInfo.open}
        title="Información"
        message={alertInfo.msg}
        onClose={() => setAlertInfo({open: false, msg: ''})}
      />

      {confirmModal.isOpen && (
          <div className="modal-overlay">
              <div className="modal-card modal-sm text-center">
                  <h3 className="text-danger mb-2">¿Estás seguro?</h3>
                  <p className="mb-3 text-dark">Esta acción eliminará el registro permanentemente.</p>
                  <div className="modal-actions justify-center">
                      <button className="btn-secondary" onClick={() => setConfirmModal({...confirmModal, isOpen: false})}>Cancelar</button>
                      <button className="btn-main btn-danger" onClick={confirmDelete}>Eliminar</button>
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
            <button className={`tab ${activeTab === 'ordenes' ? 'active' : ''}`} onClick={() => setActiveTab('ordenes')}>Órdenes</button>
            {isAdmin && (
                <>
                    <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>Historial</button>
                    <button className={`tab ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>Personal</button>
                </>
            )}
        </div>

        {/* TAB ÓRDENES */}
        {activeTab === 'ordenes' && (
            <div className="card">
                <OrdenesView config={config} refreshTrigger={refreshOrdenesTrigger} />
            </div>
        )}

        {viewingOrder && (
            <WorkClientView 
                order={viewingOrder} 
                clientName={selectedClientForOrders?.nombre || viewingOrder.cliente_nombre || 'Cliente'} 
                onClose={() => setViewingOrder(null)}
                config={config} 
                onSaveNewOrder={handleCloneOrder}
                docType={viewingDocType}
                client={selectedClientForOrders}
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
                {isAdmin && <button className="btn-main mt-3" onClick={saveGeneralConfig}>Guardar Cambios</button>}
            </div>
        )}

        {/* TAB CLIENTES */}
        {activeTab === 'clientes' && canManageClients && (
            <div className="card">
                <div className="card-header">
                    <h3>Clientes</h3>
                    <button className="btn-main sm" onClick={()=>setEditingClient({})}>+ Nuevo</button>
                </div>

                {/* Modal de opciones del cliente */}
                {clientOptionsModal && (
                    <div className="modal-overlay">
                        <div className="modal-card modal-sm text-center">
                            <h3 className="mb-3">Cliente: {clientOptionsModal.nombre}</h3>
                            <div className="flex-column gap-2">
                                <button className="btn-main btn-lg-block" onClick={() => loadClientCotizaciones(clientOptionsModal)}>
                                    <img src={cotizacionIcon} className="icono-img icono-cotizacion" alt="cotización" /> Ver Cotizaciones
                                </button>
                                <button className="btn-secondary btn-lg-block" onClick={() => loadClientOrdenes(clientOptionsModal)}>
                                    <img src={ordenIcon} className="icono-img icono-orden" alt="orden" /> Ver Órdenes
                                </button>
                            </div>
                            <button className="btn-secondary mt-3 w-100" onClick={() => setClientOptionsModal(null)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal de cotizaciones del cliente */}
                {selectedClientForOrders && viewMode === 'cotizaciones' && (
                    <div className="modal-overlay">
                        <div className="modal-card modal-lg">
                            <div className="card-header">
                                <h3><img src={cotizacionIcon} className="icono-img icono-cotizacion" alt="cotización" /> Cotizaciones: {selectedClientForOrders.nombre}</h3>
                                <button className="icon-btn" onClick={() => { setSelectedClientForOrders(null); setViewMode(null); }}><img src={closeIcon} className="icono-img icono-close icono-no-margin" alt="cerrar" /></button>
                            </div>
                            <div className="table-container-scroll cotizacion-clientes">
                                {clientOrders.length === 0 ? <p>No hay cotizaciones guardadas.</p> : (
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Trabajo</th>
                                                <th className="text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientOrders.map(o => (
                                                <tr key={o.id}>
                                                    <td>{new Date(o.fecha_pedido).toLocaleDateString()}</td>
                                                    <td className="font-bold text-sm">{o.nombre_trabajo}</td>
                                                    <td className="text-right">
                                                        <button className="btn-secondary sm" onClick={() => { setViewingOrder(o); setViewingDocType('cotizacion'); }}><img src={viewIcon} className="icono-img icono-view" alt="ver" /> Ver</button>
                                                        <button className="btn-main sm" onClick={() => setOrderFromCotizacion(o)}><img src={ordenIcon} className="icono-img icono-orden" alt="orden" /> Ordenar</button>
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

                {/* Modal de órdenes del cliente */}
                {selectedClientForOrders && viewMode === 'ordenes' && (
                    <div className="modal-overlay">
                        <div className="modal-card modal-lg">
                            <div className="card-header">
                                <h3><img src={ordenIcon} className="icono-img icono-orden" alt="orden" /> Órdenes: {selectedClientForOrders.nombre}</h3>
                                <button className="icon-btn" onClick={() => { setSelectedClientForOrders(null); setViewMode(null); }}><img src={closeIcon} className="icono-img icono-close icono-no-margin" alt="cerrar" /></button>
                            </div>
                            <div className="table-container-scroll">
                                {clientOrdenes.length === 0 ? <p>No hay órdenes para este cliente.</p> : (
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Trabajo</th>
                                                <th>Estado</th>
                                                <th>Entrega</th>
                                                <th className="text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientOrdenes.map(o => (
                                                <tr key={o.id}>
                                                    <td className="font-bold">{o.nombre_trabajo || 'Sin nombre'}</td>
                                                    <td>
                                                        <span className={`status-badge status-${o.estado}`}>
                                                            {o.estado === 'entregado' ? <><img src={checkIcon} className="icono-img icono-check" alt="entregado" /> Entregado</> : o.estado === 'cancelado' ? <><img src={cancelIcon} className="icono-img icono-cancel" alt="cancelado" /> Cancelado</> : <><img src={processIcon} className="icono-img icono-process" alt="proceso" /> En Proceso</>}
                                                        </span>
                                                    </td>
                                                    <td>{o.fecha_entrega ? new Date(o.fecha_entrega).toLocaleDateString() : '—'}</td>
                                                    <td>
                                                        <button className="btn-secondary sm" onClick={() => { setViewingOrder(o as unknown as Order); setViewingDocType('orden'); }}><img src={viewIcon} className="icono-img icono-view" alt="ver" /> Ver</button>
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

                {/* Modal para crear orden desde cotización */}
                {orderFromCotizacion && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <h3><img src={ordenIcon} className="icono-img icono-orden" alt="orden" /> Crear Orden desde Cotización</h3>
                            <p className="modal-subtitle">Cotización: {orderFromCotizacion.nombre_trabajo}</p>
                            
                            <label className="form-label">Fecha de Entrega (opcional)</label>
                            <input 
                                type="date" 
                                className="styled-input"
                                value={newOrderFechaEntrega}
                                onChange={(e) => setNewOrderFechaEntrega(e.target.value)}
                            />

                            <div className="modal-actions">
                                <button className="btn-secondary" onClick={() => { setOrderFromCotizacion(null); setNewOrderFechaEntrega(''); }}>Cancelar</button>
                                <button className="btn-main" onClick={handleCreateOrderFromCotizacion}>Crear Orden</button>
                            </div>
                        </div>
                    </div>
                )}

                {editingClient && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <form onSubmit={handleSaveClient}>
                                <h3>{editingClient.id ? 'Editar' : 'Nuevo'} Cliente</h3>
                                <label className="form-label">Nombre del Cliente</label>
                                <input className="styled-input" required placeholder="Nombre" value={editingClient.nombre || ''} onChange={e=>setEditingClient({...editingClient, nombre:e.target.value})} />
                                
                                <label className="form-label">Nro Referencia / Teléfono</label>
                                <input className="styled-input" placeholder="Referencia" value={editingClient.numero_referencia || ''} onChange={e=>setEditingClient({...editingClient, numero_referencia:e.target.value})} />
                                
                                <label className="form-label">Domicilio</label>
                                <input className="styled-input" placeholder="Domicilio" value={editingClient.domicilio || ''} onChange={e=>setEditingClient({...editingClient, domicilio:e.target.value})} />
                                
                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={()=>setEditingClient(null)}>Cancelar</button>
                                    <button type="submit" className="btn-main">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <table className="data-table">
                    <thead className="thead-clientes"><tr><th>Nombre</th><th>Ref</th><th>Acciones</th></tr></thead>
                    <tbody className="tbody-clientes">
                        {clients.map(c => (
                            <tr key={c.id}>
                                <td>
                                    <span onClick={() => handleShowClientOptions(c)}>{c.nombre} </span>
                                </td>
                                <td>{c.numero_referencia}</td>
                                <td>
                                    <button className="icon-btn" onClick={() => setEditingClient(c)}><img src={editIcon} className="icono-img icono-edit icono-no-margin" alt="editar" /></button>
                                    {isAdmin && <button className="icon-btn danger" onClick={() => requestDeleteClient(c.id)}><img src={deleteIcon} className="icono-img icono-delete icono-no-margin" alt="eliminar" /></button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && isAdmin && (
            <div className="card">
                <h3>Historial de Configuraciones</h3>
                <table className="data-table data-table-configuraciones">
                    <thead className="thead-historial">
                        <tr>
                            <th>Fecha</th>
                            <th>1.000 pts</th><th>Fac c/hilo</th><th>H. Bordar</th><th>H. Bobina</th><th>Pellón Rollo</th><th>T. Estruct</th><th>T. Normal</th><th>Papel Rollo</th><th>Imp.</th><th>Corte</th><th>Estado</th>
                        </tr>
                    </thead>
                    <tbody className="tbody-historial">
                        {priceHistory.map(h => (
                            <tr key={h.id}>
                                <td>{h.fecha_modificacion ? new Date(h.fecha_modificacion).toLocaleString() : 'N/A'}</td>
                                <td>{h.precio_stitch_1000}</td><td>{h.factor_cambio_hilo}</td><td>{h.costo_hilo_bordar}</td><td>{h.costo_hilo_bobina}</td><td>{h.costo_pellon}</td><td>{h.tela_estructurante}</td><td>{h.tela_normal}</td><td>{h.rollo_papel}</td><td>{h.costo_impresion}</td><td>{h.corte_impresion}</td>
                                <td>{h.activo ? <span className="badge admin" >Activo</span> : <span className="badge user" >Inactivo</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TAB USUARIOS */}
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
                                
                                <label className="form-label">Nombre Completo</label>
                                <input className="styled-input" required placeholder="Ej: Juan Perez" value={editingUser.nombre || ''} onChange={e=>setEditingUser({...editingUser, nombre:e.target.value})}/>
                                
                                <label className="form-label">Usuario (Login)</label>
                                <input className="styled-input" required placeholder="usuario" value={editingUser.usuario || ''} onChange={e=>setEditingUser({...editingUser, usuario:e.target.value})}/>
                                
                                <label className="form-label">Contraseña {editingUser.id && '(Dejar en blanco para no cambiar)'}</label>
                                <input className="styled-input" type="password" placeholder="***" value={editingUser.password || ''} onChange={e=>setEditingUser({...editingUser, password:e.target.value})}/>
                                
                                <label className="form-label">Celular</label>
                                <input className="styled-input" placeholder="777..." type="tel" value={editingUser.celular || ''} onChange={e=>setEditingUser({...editingUser, celular:e.target.value})}/>

                                <label className="form-label">Domicilio</label>
                                <input className="styled-input" placeholder="Dirección..." value={editingUser.domicilio || ''} onChange={e=>setEditingUser({...editingUser, domicilio:e.target.value})}/>
                                
                                <label className="form-label">Rol</label>
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
                
                <table className="data-table data-table-configuraciones">
                    <thead className="thead-personal">
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre</th>
                            <th>Celular</th>
                            <th>Domicilio</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="tbody-personal">
                        {users.map(u=>(
                            <tr key={u.id}>
                                <td >{u.usuario}</td>
                                <td>{u.nombre}</td>
                                <td>{u.celular || '-'}</td>
                                <td >{u.domicilio || '-'}</td>
                                <td>{u.role === 'administrador' ? <><img src={adminIcon} className="icono-img icono-admin" alt="admin" /> Admin</> : 'Empleado'}</td>
                                <td>
                                    <button className="icon-btn" onClick={()=>setEditingUser(u)} title="Editar"><img src={editIcon} className="icono-img icono-edit icono-no-margin" alt="editar" /></button>
                                    <button className="icon-btn danger" onClick={()=>requestDeleteUser(u.id)} title="Eliminar"><img src={deleteIcon} className="icono-img icono-delete icono-no-margin" alt="eliminar" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import type { Orden, EstadoOrden, Config } from '../../types';
import { api } from '../../services/api';
import { AlertModal } from '../ui/AlertModal';
import { WorkClientView } from './WorkClientView';
// Iconos SVG
import listIcon from '../../assets/images/list.svg';
import closeIcon from '../../assets/images/close.svg';
import processIcon from '../../assets/images/process.svg';
import checkIcon from '../../assets/images/check.svg';
import cancelIcon from '../../assets/images/cancel.svg';
import viewIcon from '../../assets/images/view.svg';
import editIcon from '../../assets/images/edit.svg';

interface Props {
  onClose?: () => void;
  config?: Config;
}

// (Styles removed as they are no longer used in Table View)

export const OrdenesView = ({ onClose, config }: Props) => {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<EstadoOrden | 'todos'>('todos');
  const [editingOrden, setEditingOrden] = useState<Orden | null>(null);
  
  // Estado para ver detalles
  const [viewingOrden, setViewingOrden] = useState<Orden | null>(null);

  const [alertInfo, setAlertInfo] = useState<{
    open: boolean;
    msg: string;
    type: 'success' | 'error' | 'info';
  }>({ open: false, msg: '', type: 'info' });

  useEffect(() => {
    loadOrdenes();
  }, []);

  const loadOrdenes = async () => {
    setLoading(true);
    try {
      const data = await api.getOrdenes();
      if (Array.isArray(data)) {
        setOrdenes(data);
      } else {
        console.error("API response is not an array:", data);
        setOrdenes([]);
        const errorResponse = data as any;
        if (errorResponse.message) {
            setAlertInfo({ open: true, msg: "Error: " + errorResponse.message, type: 'error' });
        }
      }
    } catch (e) {
      console.error('Error loading ordenes:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEstado = async (id: number, nuevoEstado: EstadoOrden) => {
    try {
      await api.updateOrden(id, { estado: nuevoEstado });
      setAlertInfo({ open: true, msg: 'Estado actualizado correctamente', type: 'success' });
      loadOrdenes();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      setAlertInfo({ open: true, msg: errorMsg, type: 'error' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingOrden) return;
    try {
      await api.updateOrden(editingOrden.id, {
        detail: editingOrden.detail,
        fecha_entrega: editingOrden.fecha_entrega
      });
      setAlertInfo({ open: true, msg: 'Orden actualizada', type: 'success' });
      setEditingOrden(null);
      loadOrdenes();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      setAlertInfo({ open: true, msg: errorMsg, type: 'error' });
    }
  };

  const filteredOrdenes =
    filterEstado === 'todos' ? ordenes : ordenes.filter(o => o.estado === filterEstado);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatMoney = (amount?: number) => {
    if (!amount) return 'Bs 0.00';
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB'
    }).format(amount);
  };

  return (
    <div className="ordenes-view">
      <AlertModal
        isOpen={alertInfo.open}
        title="Información"
        message={alertInfo.msg}
        type={alertInfo.type}
        onClose={() => setAlertInfo({ ...alertInfo, open: false })}
      />

      <div className="ordenes-header">
        <h2><img src={listIcon} className="icono-img icono-list" alt="órdenes" /> Órdenes de Trabajo</h2>
        {onClose && (
          <button className="icon-btn" onClick={onClose}>
            <img src={closeIcon} className="icono-img icono-close icono-no-margin" alt="cerrar" />
          </button>
        )}
      </div>

      <div className="ordenes-filters">
        <button
          className={`filter-btn ${filterEstado === 'todos' ? 'active' : ''}`}
          onClick={() => setFilterEstado('todos')}
        >
          Todas ({ordenes.length})
        </button>

        <button
          className={`filter-btn en_proceso ${filterEstado === 'en_proceso' ? 'active' : ''}`}
          onClick={() => setFilterEstado('en_proceso')}
        >
          <img src={processIcon} className="icono-img icono-process" alt="proceso" /> En Proceso ({ordenes.filter(o => o.estado === 'en_proceso').length})
        </button>

        <button
          className={`filter-btn entregado ${filterEstado === 'entregado' ? 'active' : ''}`}
          onClick={() => setFilterEstado('entregado')}
        >
          <img src={checkIcon} className="icono-img icono-check" alt="entregado" /> Entregados ({ordenes.filter(o => o.estado === 'entregado').length})
        </button>

        <button
          className={`filter-btn cancelado ${filterEstado === 'cancelado' ? 'active' : ''}`}
          onClick={() => setFilterEstado('cancelado')}
        >
          <img src={cancelIcon} className="icono-img icono-cancel" alt="cancelado" /> Cancelados ({ordenes.filter(o => o.estado === 'cancelado').length})
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando órdenes...</div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Trabajo</th>
                <th>Cliente</th>
                <th>Cantidad</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Entrega</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrdenes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay órdenes encontradas
                  </td>
                </tr>
              ) : (
                filteredOrdenes.map(orden => (
                  <tr key={orden.id}>
                    <td><strong>{orden.id}</strong></td>
                    <td>
                      <div>{orden.nombre_trabajo || 'Sin nombre'}</div>
                      {orden.detail && <small style={{ color: 'var(--text-secondary)' }}>{orden.detail}</small>}
                    </td>
                    <td>{orden.cliente_nombre || '—'}</td>
                    <td>{orden.cantidad || 0}</td>
                    <td>{formatMoney(orden.precio_total)}</td>
                    <td>
                      <select
                        className={`estado-select-mini ${orden.estado}`}
                        value={orden.estado}
                        onChange={e => handleUpdateEstado(orden.id, e.target.value as EstadoOrden)}
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="en_proceso">En Proceso</option>
                        <option value="entregado">Entregado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </td>
                    <td>{formatDate(orden.fecha_entrega)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="icon-btn" 
                          onClick={() => setViewingOrden(orden)}
                          title="Ver Detalles"
                        >
                          <img src={viewIcon} className="icono-img" alt="ver" />
                        </button>
                        <button 
                          className="icon-btn" 
                          onClick={() => setEditingOrden(orden)}
                          title="Editar"
                        >
                          <img src={editIcon} className="icono-img" alt="editar" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Edición */}
      {editingOrden && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Editar Orden #{editingOrden.id}</h3>

            <label>Fecha de Entrega</label>
            <input
              type="date"
              className="styled-input"
              value={editingOrden.fecha_entrega || ''}
              onChange={e =>
                setEditingOrden({
                  ...editingOrden,
                  fecha_entrega: e.target.value || null
                })
              }
            />

            <label>Observaciones / Notas</label>
            <textarea
              className="styled-input"
              rows={4}
              value={editingOrden.detail || ''}
              onChange={e =>
                setEditingOrden({
                  ...editingOrden,
                  detail: e.target.value
                })
              }
            />

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingOrden(null)}>
                Cancelar
              </button>
              <button className="btn-main" onClick={handleSaveEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles (WorkClientView) */}
      {viewingOrden && config && (
        <WorkClientView 
          order={viewingOrden as unknown as import('../../types').Cotizacion} 
          clientName={viewingOrden.cliente_nombre || 'Cliente'} 
          onClose={() => setViewingOrden(null)}
          config={config} 
          onSaveNewOrder={() => {}} // No clonamos desde aquí por ahora
          docType="orden"
        />
      )}
    </div>
  );
};

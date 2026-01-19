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
import userIcon from '../../assets/images/user.svg';
import ordenIcon from '../../assets/images/orden.svg';
import moneyIcon from '../../assets/images/money.svg';
import calendarIcon from '../../assets/images/calendar.svg';
import cotizacionIcon from '../../assets/images/cotizacion.svg';
import viewIcon from '../../assets/images/view.svg';
import editIcon from '../../assets/images/edit.svg';

interface Props {
  onClose?: () => void;
  config?: Config;
}

const ESTADO_STYLES: Record<EstadoOrden, { bg: string; text: string; label: string; icon: string }> = {
  en_proceso: { bg: '', text: '', label: 'En Proceso', icon: 'process' },
  entregado: { bg: '', text: '', label: 'Entregado', icon: 'check' },
  cancelado: { bg: '', text: '', label: 'Cancelado', icon: 'cancel' }
};

const getEstadoIcon = (estado: EstadoOrden) => {
  switch(estado) {
    case 'entregado': return checkIcon;
    case 'cancelado': return cancelIcon;
    default: return processIcon;
  }
};

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
      setOrdenes(data);
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
      ) : filteredOrdenes.length === 0 ? (
        <div className="empty-state">
          <p>No hay órdenes</p>
        </div>
      ) : (
        <div className="ordenes-grid">
          {filteredOrdenes.map(orden => (
            <div key={orden.id} className="orden-card">
              <div className="orden-card-header">
                <span className="orden-trabajo">{orden.nombre_trabajo || 'Sin nombre'}</span>
                <span className={`estado-badge ${orden.estado}`}>
                  <img src={getEstadoIcon(orden.estado)} className="icono-img" alt={orden.estado} /> {ESTADO_STYLES[orden.estado].label}
                </span>
              </div>

              <div className="orden-card-body">
                <div className="orden-info-row">
                  <span className="label"><img src={userIcon} className="icono-img icono-user" alt="cliente" /> Cliente:</span>
                  <span className="value">{orden.cliente_nombre || '—'}</span>
                </div>

                <div className="orden-info-row">
                  <span className="label"><img src={ordenIcon} className="icono-img icono-orden" alt="cantidad" /> Cantidad:</span>
                  <span className="value">{orden.cantidad || 0} pzs</span>
                </div>

                <div className="orden-info-row">
                  <span className="label"><img src={moneyIcon} className="icono-img icono-money" alt="total" /> Total:</span>
                  <span className="value">{formatMoney(orden.precio_total)}</span>
                </div>

                <div className="orden-info-row">
                  <span className="label"><img src={calendarIcon} className="icono-img icono-calendar" alt="fecha" /> Entrega:</span>
                  <span className="value">{formatDate(orden.fecha_entrega)}</span>
                </div>

                {orden.detail && (
                  <div className="orden-detail">
                    <span className="label"><img src={cotizacionIcon} className="icono-img icono-cotizacion" alt="notas" /> Notas:</span>
                    <p>{orden.detail}</p>
                  </div>
                )}
              </div>

              <div className="orden-card-actions">
                <select
                  className="estado-select"
                  value={orden.estado}
                  onChange={e =>
                    handleUpdateEstado(orden.id, e.target.value as EstadoOrden)
                  }
                >
                  <option value="en_proceso">En Proceso</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                
                <button className="btn-secondary sm" onClick={() => setViewingOrden(orden)}>
                  <img src={viewIcon} className="icono-img icono-view" alt="ver" /> Ver
                </button>
                <button className="btn-secondary sm" onClick={() => setEditingOrden(orden)}>
                  <img src={editIcon} className="icono-img icono-edit" alt="editar" /> Editar
                </button>
              </div>
            </div>
          ))}
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
          order={viewingOrden} 
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

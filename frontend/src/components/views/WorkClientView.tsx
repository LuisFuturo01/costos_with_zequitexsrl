import { useMemo } from 'react';
import type { Order } from '../types';

interface Props {
  order: Order;
  clientName: string;
  onClose: () => void;
}

export const WorkClientView = ({ order, clientName, onClose }: Props) => {
  
  // --- RECONSTRUCCIÓN DE DATOS (HISTÓRICO) ---
  const data = useMemo(() => {
    // 1. Intentamos leer el JSON "Backup"
    let extraData: any = {};
    try {
      if (order.datos_json) {
        extraData = JSON.parse(order.datos_json);
      }
    } catch (e) { console.error("Error parseando JSON", e); }

    // 2. Extraer desglose
    const breakdown = extraData.breakdown || {};
    
    // Formateador
    const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val);

    return {
      fecha: new Date(order.fecha_pedido).toLocaleDateString(),
      hora: new Date(order.fecha_pedido).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      nombreTrabajo: order.nombre_trabajo || "Cotización",
      
      imagen: extraData.imagen_procesada || "", 
      
      // Datos Técnicos
      puntadas: order.puntadas || extraData.estimatedStitches || 0,
      colores: order.colores || extraData.numColors || 1,
      ancho: order.ancho || extraData.dims?.width || 0,
      alto: order.alto || extraData.dims?.height || 0,
      cantidad: order.cantidad || 1,
      bastidor: order.bastidor || "Estándar",
      tipoTela: order.tipo_tela || "Normal",
      
      // Costos
      costoPuntadas: breakdown.puntadas !== undefined ? formatMoney(breakdown.puntadas) : "---",
      costoColores: breakdown.colores !== undefined ? formatMoney(breakdown.colores) : "---",
      costoTela: breakdown.tela !== undefined ? formatMoney(breakdown.tela) : "---",
      costoPellon: breakdown.pellon !== undefined ? formatMoney(breakdown.pellon) : "---",
      costoCorte: breakdown.corte ? formatMoney(breakdown.corte) : null,
      
      // Totales
      precioUnitario: formatMoney(order.precio_unitario || 0),
      precioTotal: formatMoney(order.precio_total || 0),
      
      mensaje: extraData.mensaje || order.detalles || ""
    };
  }, [order]);

  const handlePrint = () => {
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="modal-overlay" style={{zIndex: 2000, alignItems: 'center', paddingTop: '20px', paddingBottom: '20px'}}>
      
      <style>{`
        /* SCROLL PERSONALIZADO PARA EL MODAL */
        .ticket-scrollable::-webkit-scrollbar {
          width: 8px;
        }
        .ticket-scrollable::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .ticket-scrollable::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.5);
          border-radius: 4px;
        }
        .ticket-scrollable::-webkit-scrollbar-thumb:hover {
          background: rgba(52, 211, 153, 0.8);
        }

        @media print {
          body * { visibility: hidden; }
          
          .modal-overlay {
            background: white !important;
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: block !important; padding: 0 !important;
            visibility: visible !important; z-index: 9999 !important;
          }
          
          .ticket-card, .ticket-card * { visibility: visible !important; }
          
          .ticket-card {
            position: absolute; top: 0; left: 0; width: 100%; max-width: 100%;
            border: 1px solid #000 !important; box-shadow: none !important;
            background: white !important; color: black !important;
            padding: 15px !important; margin: 0 !important;
            max-height: none !important; overflow: visible !important; /* IMPORTANTE: Para que imprima todo el largo */
          }
          
          .ticket-actions, .close-btn-top { display: none !important; }
          
          .ticket-total-box { background: #eee !important; border: 1px solid #000 !important; color: #000 !important; }
          .ticket-total-box strong, .ticket-total-box span { color: #000 !important; }
          .label { color: #555 !important; }
          .value, .price { color: #000 !important; }
        }
      `}</style>

      {/* AQUÍ ESTÁ LA CORRECCIÓN: 
          maxHeight: '90vh' limita la altura al 90% de la pantalla.
          overflowY: 'auto' activa el scroll si el contenido es más alto.
      */}
      <div 
        className="ticket-card ticket-scrollable" 
        style={{
            maxWidth: '450px', 
            width: '100%', 
            position: 'relative',
            maxHeight: '85vh', // Límite de altura
            overflowY: 'auto',  // Activar scroll
            display: 'flex',
            flexDirection: 'column'
        }}
      >
        
        <button className="close-btn-top" onClick={onClose} style={{
            position: 'absolute', top: '15px', right: '15px', zIndex: 10,
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', 
            borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
        }}>✕</button>

        {/* HEADER */}
        <div className="ticket-header" style={{marginTop: '10px'}}>
          <div className="ticket-brand">ZEQUITEX</div>
          <div className="ticket-title" style={{fontSize: '1.4rem', lineHeight: 1.2, marginBottom: 5}}>
            {data.nombreTrabajo}
          </div>
          <div className="ticket-date">{data.fecha} • {data.hora}</div>
          <div style={{fontSize: '0.85rem', color: '#34d399', marginTop: '8px', fontWeight:'bold', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 5}}>
            Cliente: {clientName}
          </div>
        </div>

        {/* PREVIEW */}
        {data.imagen && (
            <div className="ticket-preview" style={{padding: '10px', marginBottom: '15px'}}>
                <img src={data.imagen} alt="Diseño" style={{maxHeight: 120, objectFit:'contain'}} />
            </div>
        )}

        {/* DATOS TÉCNICOS */}
        <div className="ticket-stats-grid" style={{marginBottom: '15px'}}>
          <div className="stat-item"><span className="label">Puntadas</span><span className="value">{data.puntadas.toLocaleString()}</span></div>
          <div className="stat-item"><span className="label">Colores</span><span className="value">{data.colores}</span></div>
          <div className="stat-item"><span className="label">Medidas</span><span className="value">{data.ancho} x {data.alto}</span></div>
          <div className="stat-item input-item" style={{background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)'}}>
              <span className="label" style={{color: '#34d399'}}>Cantidad</span>
              <span className="value">{data.cantidad}</span>
          </div>
        </div>

        <div className="divider" style={{margin: '10px 0'}}></div>

        {/* COSTOS */}
        <div className="detail-section">
          <div className="detail-title">Resumen de Costos</div>
          <div className="breakdown-row"><div className="row-label"><span>Bordado</span></div><span className="price">{data.costoPuntadas}</span></div>
          <div className="breakdown-row"><div className="row-label"><span>Hilos</span></div><span className="price">{data.costoColores}</span></div>
          <div className="breakdown-row"><div className="row-label"><span>Tela ({data.tipoTela})</span></div><span className="price">{data.costoTela}</span></div>
          <div className="breakdown-row"><div className="row-label"><span>Insumos ({data.bastidor})</span></div><span className="price">{data.costoPellon}</span></div>
          {data.costoCorte && (
             <div className="breakdown-row"><div className="row-label"><span>Corte</span></div><span className="price">{data.costoCorte}</span></div>
          )}
          
          <div className="ticket-note" style={{marginTop: 15}}>
            <strong>Nota:</strong>
            <p style={{whiteSpace: 'pre-wrap', fontSize:'0.8rem', marginTop: 4, lineHeight: 1.4}}>{data.mensaje}</p>
          </div>
        </div>

        {/* TOTALES */}
        <div className="ticket-total-box" style={{marginTop: 'auto'}}>
          <div className="unit-price"><span>Precio Unitario</span><strong>{data.precioUnitario}</strong></div>
          <div className="final-price"><span>TOTAL</span><strong>{data.precioTotal}</strong></div>
        </div>

        <div className="ticket-footer" style={{marginTop: 10}}>
            Registro Histórico - Copia de Sistema.
        </div>

        {/* ACCIONES */}
        <div className="ticket-actions" style={{paddingBottom: 5}}>
          <button className="action-btn" style={{background: '#475569'}} onClick={onClose}>Cerrar</button>
          <button className="action-btn print" onClick={handlePrint}>
            <i className="fas fa-print"></i> Re-Imprimir
          </button>
        </div>

      </div>
    </div>
  );
};
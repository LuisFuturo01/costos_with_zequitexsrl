import { useMemo, useState } from 'react';
import type { Order, Config } from '../types';

interface Props {
  order: Order;
  clientName: string;
  onClose: () => void;
  config: Config;
  onSaveNewOrder: (newOrderData: any) => void;
}

// BASTIDORES CON PRECIO DE CORTE (IGUAL QUE MANUAL MODE)
const BASTIDORES_LISTA = [
  { size: 10, name: "10 cm", corte: 0.15 },
  { size: 13, name: "13 cm", corte: 0.25 },
  { size: 16, name: "16 cm", corte: 0.35 },
  { size: 20, name: "20 cm", corte: 0.45 },
  { size: 31, name: "31 cm", corte: 0.65 }
];

export const WorkClientView = ({ order, clientName, onClose, config, onSaveNewOrder }: Props) => {
  
  // --- LEER DATOS ORIGINALES PARA ESTADO INICIAL ---
  const initialData = useMemo(() => {
    let extra: any = {};
    try { if (order.datos_json) extra = JSON.parse(order.datos_json); } catch (e) {}
    const bd = extra.breakdown || {};
    
    // Detectar si tenía sublimación (por flag o por precio histórico)
    const hadSublimation = order.tiene_sublimacion || (bd.impresion && bd.impresion > 0) || false;
    // Detectar si tenía apliqué (por costo de corte > 0)
    const hasAplique = (bd.corte && bd.corte > 0) || false;

    return {
        hasAplique,
        fabricType: order.tipo_tela || 'Normal',
        hadSublimation,
        extra
    };
  }, [order]);

  // --- ESTADO DE EDICIÓN ---
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
      nombreTrabajo: order.nombre_trabajo || "",
      cantidad: order.cantidad || 1,
      puntadas: order.puntadas || 0,
      colores: order.colores || 1,
      ancho: order.ancho || 0,
      alto: order.alto || 0,
      tieneSublimacion: initialData.hadSublimation,
      tieneAplique: initialData.hasAplique,
      tipoTela: initialData.fabricType
  });

  // --- CÁLCULO EN TIEMPO REAL (LÓGICA EXACTA DE MANUAL MODE) ---
  const calculatedData = useMemo(() => {
      const p = config.pricing;
      const areaDiseno = editData.ancho * editData.alto;

      // 1. BASTIDOR
      const bastidorObj = BASTIDORES_LISTA
          .slice()
          .sort((a, b) => a.size - b.size)
          .find(b => areaDiseno <= (b.size ** 2))
          ?? BASTIDORES_LISTA[BASTIDORES_LISTA.length - 1];

      const areaBastidorReal = bastidorObj.size ** 2;
      const bastidorNombre = bastidorObj.name;
      const precioServicioCorte = bastidorObj.corte;

      // 2. COSTOS BÁSICOS (API)
      const PRECIO_1000 = p.precio_stitch_1000;
      const PRECIO_COLOR = p.factor_cambio_hilo;
      
      let finalStitches = editData.puntadas;
      if (finalStitches < 2000 && finalStitches > 0) finalStitches = 2000;

      const costoPuntadas = (finalStitches / 1000) * PRECIO_1000;
      const costoColores = editData.colores * PRECIO_COLOR;

      // 3. PELLÓN (Factor dinámico según ManualMode)
      let FACTOR_PELLON = (p.costo_pellon ?? 300) / 1000000; 
      if (areaBastidorReal <= 450) FACTOR_PELLON *= 3.8;
      else if (areaBastidorReal <= 900) FACTOR_PELLON *= 3.2;
      else if (areaBastidorReal <= 1600) FACTOR_PELLON *= 2.5;
      else FACTOR_PELLON *= 1.5;

      const costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
      const costoPellon = Math.ceil(costoPellonCalc / 0.05) * 0.05;

      // 4. TELA (CORREGIDO: Solo se cobra si hay APLIQUÉ)
      let costoTela = 0;
      if (editData.tieneAplique) {
          const PRECIO_TELA_NORMAL = p.tela_normal; 
          const PRECIO_TELA_ESTRUCT = p.tela_estructurante;
          const precioTelaCm2 = (editData.tipoTela === 'Estructurante' ? PRECIO_TELA_ESTRUCT : PRECIO_TELA_NORMAL) / 15000;

          costoTela = Number((areaDiseno * precioTelaCm2).toFixed(2));
          // Multiplicadores de ManualMode
          if (areaDiseno <= 450) costoTela *= 2.05;
          else if (areaDiseno <= 900) costoTela *= 2.2;
          else if (areaDiseno <= 1600) costoTela *= 2.4;
          else costoTela *= 2.6;
      }

      // 5. CORTE (APLIQUÉ)
      const costoCorte = editData.tieneAplique ? precioServicioCorte : 0;

      // 6. SUBLIMACIÓN (Lógica Compleja de Rollos - Idéntica a ManualMode)
      let costoImpresion = 0;
      if (editData.tieneSublimacion) {
          const COSTO_ROLLO = p.costo_rollo ?? 0;
          const PRECIO_IMPRESION = p.costo_impresion ?? 0;
          const ROLLO_ANCHO_CM = 100;
          const ROLLO_LARGO_CM = 10000; 
          const AREA_TOTAL_ROLLO = ROLLO_ANCHO_CM * ROLLO_LARGO_CM;

          const imgW = editData.ancho;
          const imgH = editData.alto;

          if (imgW > 0 && imgH > 0 && imgW <= ROLLO_ANCHO_CM) {
              const imagenesPorFila = Math.floor(ROLLO_ANCHO_CM / imgW);
              // Evitar división por cero
              const filasNecesarias = imagenesPorFila > 0 ? Math.ceil(editData.cantidad / imagenesPorFila) : 0;
              const largoCortadoCm = filasNecesarias * imgH;
              const areaUsadaRollo = largoCortadoCm * ROLLO_ANCHO_CM;

              // Costo proporcional del rollo
              costoImpresion = (areaUsadaRollo / AREA_TOTAL_ROLLO) * COSTO_ROLLO;

              // Mínimo comercial (referencia costo hoja 30x30)
              const COSTO_MINIMO = PRECIO_IMPRESION * 0.25;
              if (costoImpresion < COSTO_MINIMO) {
                  costoImpresion = COSTO_MINIMO;
              }

              // Redondeo
              costoImpresion = Math.ceil(costoImpresion / 0.05) * 0.05;
          }
      }

      // 7. TOTALES
      const precioUnitario = costoPuntadas + costoColores + costoPellon + costoTela + costoCorte + costoImpresion;
      
      // Descuentos por volumen
      let discountPercent = 0;
      const qty = editData.cantidad;
      if (qty >= 501) discountPercent = 0.05;
      else if (qty >= 201) discountPercent = 0.04;
      else if (qty >= 101) discountPercent = 0.03;
      else if (qty >= 51) discountPercent = 0.02;

      const subtotal = precioUnitario * qty;
      const precioTotal = subtotal - (subtotal * discountPercent);

      return {
          precioUnitario,
          precioTotal,
          costoPuntadas,
          costoColores,
          costoPellon,
          costoTela,
          costoCorte,
          costoImpresion,
          bastidorNombre,
          discountPercent
      };
  }, [editData, config]); // Recalcula si cambian datos o configuración

  // --- GUARDAR COMO NUEVA ---
  const handleSaveAsNew = () => {
      const breakdown = {
          puntadas: Number(calculatedData.costoPuntadas.toFixed(2)),
          colores: Number(calculatedData.costoColores.toFixed(2)),
          pellon: Number(calculatedData.costoPellon.toFixed(2)),
          tela: Number(calculatedData.costoTela.toFixed(2)),
          corte: Number(calculatedData.costoCorte.toFixed(2)),
          impresion: Number(calculatedData.costoImpresion.toFixed(2)),
          bastidorNombre: calculatedData.bastidorNombre,
          cantidadUnidades: editData.cantidad
      };

      let mensaje = `Tela: ${editData.tipoTela}`;
      if (editData.tieneAplique) mensaje += ' • Con Apliqué';
      if (editData.tieneSublimacion) mensaje += ' • Con Sublimación';

      const fullDataSnapshot = {
          ...initialData.extra, // Mantener imagen original
          breakdown,
          mensaje,
          descuento_aplicado: calculatedData.discountPercent,
          fecha_calculo: new Date().toISOString()
      };

      const payload = {
          nombre_trabajo: editData.nombreTrabajo,
          puntadas: editData.puntadas,
          colores: editData.colores,
          ancho: editData.ancho,
          alto: editData.alto,
          bastidor: calculatedData.bastidorNombre,
          tipo_tela: editData.tipoTela,
          tiene_sublimacion: editData.tieneSublimacion,
          cantidad: editData.cantidad,
          precio_unitario: calculatedData.precioUnitario,
          precio_total: calculatedData.precioTotal,
          datos_json: JSON.stringify(fullDataSnapshot)
      };

      onSaveNewOrder(payload);
  };

  // --- LECTURA (DATOS GUARDADOS) ---
  const readOnlyData = useMemo(() => {
    let extra: any = {};
    try { if (order.datos_json) extra = JSON.parse(order.datos_json); } catch (e) {}
    const bd = extra.breakdown || {};
    return {
        ...order,
        costoPuntadas: bd.puntadas || 0,
        costoColores: bd.colores || 0,
        costoPellon: bd.pellon || 0,
        costoTela: bd.tela || 0,
        costoCorte: bd.corte || 0,
        costoImpresion: bd.impresion || 0,
        imagen: extra.imagen_procesada || ""
    };
  }, [order]);

  const formatMoney = (val: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val);
  const handlePrint = () => { setTimeout(() => window.print(), 200); };

  return (
    <div className="modal-overlay" style={{zIndex: 2000, alignItems: 'center', paddingTop: '20px', paddingBottom: '20px'}}>
      
      <style>{`
        .ticket-input-edit {
            width: 100%; border: 1px solid #34d399; 
            border-radius: 4px; padding: 4px; font-size: 0.9rem;
            background: #f0fdf4; color: #064e3b; text-align: center;
        }
        .edit-label { font-size: 0.75rem; color: #059669; display: block; margin-bottom: 2px; }
        .edit-row { display: flex; gap: 10px; margin-bottom: 10px; }
        .edit-col { flex: 1; }
        .edit-checkbox { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; cursor: pointer; color: #333; }
      `}</style>

      <div 
        className="ticket-card ticket-scrollable" 
        style={{maxWidth: '450px', width: '100%', position: 'relative', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'}}
      >
        <button className="close-btn-top" onClick={onClose} style={{position: 'absolute', top: '15px', right: '15px', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'}}>✕</button>

        {/* HEADER */}
        <div className="ticket-header" style={{marginTop: '10px'}}>
          <div className="ticket-brand">ZEQUITEX</div>
          
          {isEditing ? (
              <input 
                className="ticket-input-edit" 
                style={{fontSize: '1.2rem', fontWeight: 'bold', margin: '10px 0'}}
                value={editData.nombreTrabajo}
                onChange={e => setEditData({...editData, nombreTrabajo: e.target.value})}
              />
          ) : (
              <div className="ticket-title" style={{fontSize: '1.4rem', lineHeight: 1.2, marginBottom: 5}}>
                {readOnlyData.nombre_trabajo}
              </div>
          )}
          
          <div className="ticket-date">{new Date(order.fecha_pedido).toLocaleDateString()}</div>
          <div style={{fontSize: '0.85rem', color: '#34d399', marginTop: '8px', fontWeight:'bold', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 5}}>
            Cliente: {clientName}
          </div>
        </div>

        {/* PREVIEW */}
        {readOnlyData.imagen && (
            <div className="ticket-preview" style={{padding: '10px', marginBottom: '15px'}}>
                <img src={readOnlyData.imagen} alt="Diseño" style={{maxHeight: 120, objectFit:'contain'}} />
            </div>
        )}

        {/* DATOS TÉCNICOS (EDITABLES) */}
        {isEditing ? (
            <div style={{background: '#fff', padding: '10px', borderRadius: '8px', border: '1px dashed #ccc', marginBottom: '15px'}}>
                <div className="edit-row">
                    <div className="edit-col">
                        <label className="edit-label">Ancho (cm)</label>
                        <input type="number" className="ticket-input-edit" value={editData.ancho} onChange={e=>setEditData({...editData, ancho: parseFloat(e.target.value)||0})} />
                    </div>
                    <div className="edit-col">
                        <label className="edit-label">Alto (cm)</label>
                        <input type="number" className="ticket-input-edit" value={editData.alto} onChange={e=>setEditData({...editData, alto: parseFloat(e.target.value)||0})} />
                    </div>
                </div>
                <div className="edit-row">
                    <div className="edit-col">
                        <label className="edit-label">Puntadas</label>
                        <input type="number" className="ticket-input-edit" value={editData.puntadas} onChange={e=>setEditData({...editData, puntadas: parseInt(e.target.value)||0})} />
                    </div>
                    <div className="edit-col">
                        <label className="edit-label">Colores</label>
                        <input type="number" className="ticket-input-edit" value={editData.colores} onChange={e=>setEditData({...editData, colores: parseInt(e.target.value)||0})} />
                    </div>
                </div>
                <div className="edit-row">
                    <div className="edit-col">
                        <label className="edit-label">Cantidad</label>
                        <input type="number" className="ticket-input-edit" value={editData.cantidad} onChange={e=>setEditData({...editData, cantidad: parseInt(e.target.value)||1})} />
                    </div>
                    <div className="edit-col">
                         <label className="edit-label">Tipo Tela</label>
                         <select className="ticket-input-edit" value={editData.tipoTela} onChange={e=>setEditData({...editData, tipoTela: e.target.value})}>
                            <option value="Normal">Normal</option>
                            <option value="Estructurante">Estructurante</option>
                         </select>
                    </div>
                </div>
                <div className="edit-row" style={{justifyContent:'space-around', background:'#f9fafb', padding:'5px', borderRadius:'4px'}}>
                     <label className="edit-checkbox">
                        <input type="checkbox" checked={editData.tieneSublimacion} onChange={e => setEditData({...editData, tieneSublimacion: e.target.checked})} />
                        Sublimación
                     </label>
                     <label className="edit-checkbox">
                        <input type="checkbox" checked={editData.tieneAplique} onChange={e => setEditData({...editData, tieneAplique: e.target.checked})} />
                        Apliqué
                     </label>
                </div>
            </div>
        ) : (
            <div className="ticket-stats-grid" style={{marginBottom: '15px'}}>
              <div className="stat-item"><span className="label">Puntadas</span><span className="value">{order.puntadas?.toLocaleString()}</span></div>
              <div className="stat-item"><span className="label">Colores</span><span className="value">{order.colores}</span></div>
              <div className="stat-item"><span className="label">Medidas</span><span className="value">{order.ancho} x {order.alto}</span></div>
              <div className="stat-item input-item" style={{background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)'}}>
                  <span className="label" style={{color: '#34d399'}}>Cantidad</span>
                  <span className="value">{order.cantidad}</span>
              </div>
            </div>
        )}

        <div className="divider" style={{margin: '10px 0'}}></div>

        {/* COSTOS (DINÁMICOS O ESTÁTICOS) */}
        <div className="detail-section">
          <div className="detail-title">Resumen de Costos {isEditing && "(Recálculo)"}</div>
          
          <div className="breakdown-row">
              <div className="row-label"><span>Bordado</span></div>
              <span className="price">{isEditing ? formatMoney(calculatedData.costoPuntadas) : formatMoney(readOnlyData.costoPuntadas)}</span>
          </div>
          <div className="breakdown-row">
              <div className="row-label"><span>Hilos</span></div>
              <span className="price">{isEditing ? formatMoney(calculatedData.costoColores) : formatMoney(readOnlyData.costoColores)}</span>
          </div>
          
          {/* Mostrar Tela solo si tiene costo > 0 (Apliqué) */}
          {(isEditing ? calculatedData.costoTela > 0 : readOnlyData.costoTela > 0) && (
             <div className="breakdown-row"><div className="row-label"><span>Tela ({isEditing ? editData.tipoTela : order.tipo_tela})</span></div><span className="price">{isEditing ? formatMoney(calculatedData.costoTela) : formatMoney(readOnlyData.costoTela)}</span></div>
          )}
          
          <div className="breakdown-row">
              <div className="row-label"><span>Pellon ({isEditing ? calculatedData.bastidorNombre : order.bastidor})</span></div>
              <span className="price">{isEditing ? formatMoney(calculatedData.costoPellon) : formatMoney(readOnlyData.costoPellon)}</span>
          </div>

          {(isEditing ? editData.tieneAplique : readOnlyData.costoCorte > 0) && (
              <div className="breakdown-row"><div className="row-label"><span>Corte/Apliqué</span></div><span className="price">{isEditing ? formatMoney(calculatedData.costoCorte) : formatMoney(readOnlyData.costoCorte)}</span></div>
          )}

          {(isEditing ? editData.tieneSublimacion : readOnlyData.costoImpresion > 0) && (
              <div className="breakdown-row"><div className="row-label"><span>Sublimación</span></div><span className="price">{isEditing ? formatMoney(calculatedData.costoImpresion) : formatMoney(readOnlyData.costoImpresion)}</span></div>
          )}
        </div>

        {/* TOTALES */}
        <div className="ticket-total-box" style={{marginTop: 'auto'}}>
          <div className="unit-price"><span>Precio Unitario</span><strong>{isEditing ? formatMoney(calculatedData.precioUnitario) : formatMoney(order.precio_unitario)}</strong></div>
          <div className="final-price"><span>TOTAL</span><strong>{isEditing ? formatMoney(calculatedData.precioTotal) : formatMoney(order.precio_total)}</strong></div>
        </div>

        <div className="ticket-footer" style={{marginTop: 10}}>
            {isEditing ? 'Modo Edición - Precios Actuales' : 'Registro Histórico'}
        </div>

        {/* ACCIONES */}
        <div className="ticket-actions" style={{paddingBottom: 5, gap: '10px'}}>
          {!isEditing ? (
              <>
                <button className="action-btn" style={{background: '#475569'}} onClick={onClose}>Cerrar</button>
                <button className="action-btn" style={{background: '#f59e0b'}} onClick={() => setIsEditing(true)}>✏️ Editar</button>
                <button className="action-btn print" onClick={handlePrint}><i className="fas fa-print"></i> Imprimir</button>
              </>
          ) : (
              <>
                <button className="action-btn" style={{background: '#475569'}} onClick={() => setIsEditing(false)}>Cancelar</button>
                <button className="action-btn" style={{background: '#10b981'}} onClick={handleSaveAsNew}>💾 Guardar como Nueva</button>
              </>
          )}
        </div>

      </div>
    </div>
  );
};
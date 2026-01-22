import { useMemo, useState, useEffect } from 'react';
import type { Order, Config, Client, ProcessResult } from '../../types';
import { api } from '../../services/api';
import { ShareableTicket } from '../ShareableTicket';
// Iconos SVG
import closeIcon from '../../assets/images/close.svg';
import editIcon from '../../assets/images/edit.svg';
import saveIcon from '../../assets/images/save.svg';

interface Props {
  order: Order;
  clientName: string;
  onClose: () => void;
  config: Config;
  onSaveNewOrder: (newOrderData: any) => void;
  docType?: 'cotizacion' | 'orden';
  client?: Client | null;
}

const BASTIDORES_LISTA = [
  { size: 6.5, name: "9 cm", corte: 0.15, tiempoCorteSegundos: 3.53 },
  { size: 9.5, name: "12 cm", corte: 0.25, tiempoCorteSegundos: 7.06 },
  { size: 12.5, name: "15 cm", corte: 0.35, tiempoCorteSegundos: 10.59 },
  { size: 15.5, name: "18 cm", corte: 0.45, tiempoCorteSegundos: 14.12 },
  { size: 27.5, name: "30 cm", corte: 0.65, tiempoCorteSegundos: 17.65 }
];

export const WorkClientView = ({ order, clientName, onClose, config, onSaveNewOrder, docType = 'cotizacion', client }: Props) => {
  
  // --- LEER DATOS ORIGINALES PARA ESTADO INICIAL ---
  // --- MANEJO DE ESTADO LOCAL (INICIAL + FULL DETAILS) ---
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  useEffect(() => {
    // Si cambio la orden prop, reseteamos
    setCurrentOrder(order);

    // Si falta datos_json, cargamos el detalle completo
    if (!order.datos_json) {
        const fetchDetails = async () => {
            try {
                let fullData: any;
                if (docType === 'orden') {
                    fullData = await api.getOrdenDetail(order.id);
                } else {
                    fullData = await api.getCotizacionDetail(order.id);
                }
                if (fullData) {
                    setCurrentOrder(prev => ({...prev, ...fullData}));
                }
            } catch (e) {
                console.error("Error cargando detalles:", e);
            }
        };
        fetchDetails();
    }
  }, [order, docType]);

  // --- LEER DATOS ORIGINALES PARA ESTADO INICIAL ---
  const redondeoPrecio = (precio: number) => {
    return Math.ceil(precio*10)/10;
  };

  const initialData = useMemo(() => {
    let extra: any = {};
    let imagenStored = null;

    if (currentOrder.datos_json) {
        if (currentOrder.datos_json.trim().startsWith('{')) {
            // Legacy: JSON completo
            try { extra = JSON.parse(currentOrder.datos_json); } catch (e) {}
            imagenStored = extra.imagen_procesada || null;
        } else {
            // New: Solo la imagen en base64
            imagenStored = currentOrder.datos_json;
        }
    }
    
    const hadSublimation = currentOrder.tiene_sublimacion || false;
    const hasAplique = currentOrder.tipo_tela === 'Estructurante';

    return {
        hasAplique,
        fabricType: currentOrder.tipo_tela || 'Normal',
        hadSublimation,
        extra, 
        imagenStored
    };
  }, [currentOrder]);

  // --- ESTADO DE EDICIÓN ---
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
      nombreTrabajo: currentOrder.nombre_trabajo || "",
      cantidad: currentOrder.cantidad || 1,
      puntadas: currentOrder.puntadas || 0,
      colores: currentOrder.colores || 1,
      ancho: currentOrder.ancho || 0,
      alto: currentOrder.alto || 0,
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
      const tiempoCorteSegundos = bastidorObj.tiempoCorteSegundos;

      // 2. COSTOS BÁSICOS (API)
      const PRECIO_1000 = p.precio_stitch_1000;
      let PRECIO_COLOR = p.factor_cambio_hilo;
      
      let finalStitches = editData.puntadas;
      if (finalStitches < 2000 && finalStitches > 0) finalStitches = 2000;

      if (editData.colores > 1) {
          PRECIO_COLOR = PRECIO_COLOR * (editData.colores - 1);
      }
      const costoPuntadas = redondeoPrecio((finalStitches / 1000) * (PRECIO_1000 + PRECIO_COLOR));
      const costoColores = 0;

      // 3. PELLÓN (Factor dinámico según ManualMode)
      let FACTOR_PELLON = (p.costo_pellon ?? 300) / 1000000; 
      if (areaBastidorReal <= 42.25) FACTOR_PELLON *= 3.8;
      else if (areaBastidorReal <= 90.25) FACTOR_PELLON *= 3.5;
      else if (areaBastidorReal <= 156.25) FACTOR_PELLON *= 3.2;
      else if (areaBastidorReal <= 240.25) FACTOR_PELLON *= 2.9;
      else if (areaBastidorReal <= 756.25) FACTOR_PELLON *= 2.6;

      const costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
      const costoPellon = redondeoPrecio(costoPellonCalc);

      // 4. TELA (CORREGIDO: Solo se cobra si hay APLIQUÉ)
      let costoTela = 0;
      if (editData.tieneAplique) {
          const PRECIO_TELA_NORMAL = p.tela_normal; 
          const PRECIO_TELA_ESTRUCT = p.tela_estructurante;
          const precioTelaCm2 = (editData.tipoTela === 'Estructurante' ? PRECIO_TELA_ESTRUCT : PRECIO_TELA_NORMAL) / 15000;

          costoTela = Number((areaDiseno * precioTelaCm2).toFixed(2));
          // Multiplicadores de ManualMode (CORREGIDOS)
          if(areaBastidorReal<=42.25) costoTela *= 1.5;
          else if(areaBastidorReal<=90.25) costoTela *= 1.4;
          else if(areaBastidorReal<=156.25) costoTela *= 1.3;
          else if(areaBastidorReal<=240.25) costoTela *= 1.2;
          else if(areaBastidorReal<=756.25) costoTela *= 1.1;
          
          costoTela = redondeoPrecio(costoTela);
      }

      // 5. CORTE (APLIQUÉ) - Corregido con tiempo
      const PRECIO_CORTE_POR_60_SEG = p.corte_impresion ?? 0;
      let costoCorte = 0;
      if (editData.tieneAplique) {
          costoCorte = tiempoCorteSegundos * (PRECIO_CORTE_POR_60_SEG/60);
          costoCorte = Number(costoCorte.toFixed(2));
          costoCorte = redondeoPrecio(costoCorte);
      }

      // 6. SUBLIMACIÓN (Lógica Compleja de Rollos - Idéntica a ManualMode)
      let costoImpresion = 0;
      if (editData.tieneSublimacion) {
          const COSTO_ROLLO = p.rollo_papel ?? 0;
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
              const costoTotalLote = (areaUsadaRollo / AREA_TOTAL_ROLLO) * COSTO_ROLLO;
              costoImpresion = costoTotalLote / (editData.cantidad || 1);

              // Mínimo comercial (referencia costo hoja 30x30)
              const COSTO_MINIMO = PRECIO_IMPRESION * 0.25;
              if (costoImpresion < COSTO_MINIMO) {
                  costoImpresion = COSTO_MINIMO;
              }

              // Redondeo
              costoImpresion = redondeoPrecio(costoImpresion);
          }
      }

      // 7. TOTALES
      const CANTIDAD_MINIMA = 6;
      let precioUnitarioReal = costoPuntadas + costoColores + costoPellon + costoTela + costoCorte + costoImpresion;
      let precioUnitarioAdjusted = precioUnitarioReal;

      // Lógica de cantidad mínima (si pide < 6, se cobra como 6)
      if (editData.cantidad < CANTIDAD_MINIMA) {
          const precioTotalMinimo = precioUnitarioReal * CANTIDAD_MINIMA;
          precioUnitarioAdjusted = precioTotalMinimo / editData.cantidad; 
      }
      
      const precioUnitario = redondeoPrecio(precioUnitarioAdjusted);
      
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
          precioUnitario: precioUnitarioReal, // Base real
          precioUnitarioFacturado: precioUnitario, // Con ajuste de mínimo
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
      let mensaje = `Tela: ${editData.tipoTela}`;
      if (editData.tieneAplique) mensaje += ' • Con Apliqué';
      if (editData.tieneSublimacion) mensaje += ' • Con Sublimación';

      const fullDataSnapshot = {
          imagen_procesada: initialData.extra?.imagen_procesada || null,
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
          precio_unitario: calculatedData.precioUnitarioFacturado,
          precio_total: calculatedData.precioTotal, // Mantiene el total correcto
          datos_json: JSON.stringify(fullDataSnapshot)
      };

      onSaveNewOrder(payload);
  };

  // --- LECTURA (DATOS GUARDADOS) - Usa valores recalculados ---
  const readOnlyData = useMemo(() => {
    // Ya no re-parseamos datos_json aquí, usamos initialData
    
    // Recalcular costos basándose en los datos guardados de la orden + config actual
    const p = config.pricing;
    const areaDiseno = currentOrder.ancho * currentOrder.alto;
    
    // Bastidor
    const bastidorObj = BASTIDORES_LISTA
        .slice().sort((a, b) => a.size - b.size)
        .find(b => areaDiseno <= (b.size ** 2)) ?? BASTIDORES_LISTA[BASTIDORES_LISTA.length - 1];
    const areaBastidorReal = bastidorObj.size ** 2;
    
    // Costos recalculados
    let finalStitches = currentOrder.puntadas || 0;
    if (finalStitches < 2000 && finalStitches > 0) finalStitches = 2000;
    
    let PRECIO_COLOR = p.factor_cambio_hilo;
    const numColores = currentOrder.colores || 1;
    if (numColores > 1) {
        PRECIO_COLOR = PRECIO_COLOR * (numColores - 1);
    }
    const costoPuntadas = redondeoPrecio((finalStitches / 1000) * (p.precio_stitch_1000 + PRECIO_COLOR));
    const costoColores = 0;
    
    let FACTOR_PELLON = (p.costo_pellon ?? 300) / 1000000;
    if (areaBastidorReal <= 42.25) FACTOR_PELLON *= 3.8;
    else if (areaBastidorReal <= 90.25) FACTOR_PELLON *= 3.5;
    else if (areaBastidorReal <= 156.25) FACTOR_PELLON *= 3.2;
    else if (areaBastidorReal <= 240.25) FACTOR_PELLON *= 2.9;
    else if (areaBastidorReal <= 756.25) FACTOR_PELLON *= 2.6;
    const costoPellon = redondeoPrecio(areaBastidorReal * FACTOR_PELLON);
    
    // Tela (solo si hay apliqué - detectado por tipo_tela Estructurante)
    let costoTela = 0;
    const tieneAplique = currentOrder.tipo_tela === 'Estructurante';
    if (tieneAplique) {
        const precioTelaCm2 = (currentOrder.tipo_tela === 'Estructurante' ? p.tela_estructurante : p.tela_normal) / 15000;
        costoTela = Number((areaDiseno * precioTelaCm2).toFixed(2));
        
        if(areaBastidorReal<=42.25) costoTela *= 1.5;
        else if(areaBastidorReal<=90.25) costoTela *= 1.4;
        else if(areaBastidorReal<=156.25) costoTela *= 1.3;
        else if(areaBastidorReal<=240.25) costoTela *= 1.2;
        else if(areaBastidorReal<=756.25) costoTela *= 1.1;
        
        costoTela = redondeoPrecio(costoTela);
    }
    
    // CORTE: Si hay apliqué, se cobra el corte del bastidor
    const PRECIO_CORTE_POR_60_SEG = p.corte_impresion ?? 0;
    const tiempoCorteSegundos = bastidorObj.tiempoCorteSegundos || 0;
    let costoCorte = 0;
    if (tieneAplique) {
        costoCorte = tiempoCorteSegundos * (PRECIO_CORTE_POR_60_SEG/60);
        costoCorte = Number(costoCorte.toFixed(2));
        costoCorte = redondeoPrecio(costoCorte);
    }
    
    // IMPRESIÓN: Si hay sublimación
    let costoImpresion = 0;
    if (currentOrder.tiene_sublimacion) {
          const COSTO_ROLLO = p.rollo_papel ?? 0;
          const PRECIO_IMPRESION = p.costo_impresion ?? 0;
          const ROLLO_ANCHO_CM = 100;
          const ROLLO_LARGO_CM = 10000; 
          const AREA_TOTAL_ROLLO = ROLLO_ANCHO_CM * ROLLO_LARGO_CM;
          
          const imgW = currentOrder.ancho;
          const imgH = currentOrder.alto;
          
           if (imgW > 0 && imgH > 0 && imgW <= ROLLO_ANCHO_CM) {
              const imagenesPorFila = Math.floor(ROLLO_ANCHO_CM / imgW);
              const filasNecesarias = imagenesPorFila > 0 ? Math.ceil((currentOrder.cantidad || 1) / imagenesPorFila) : 0;
              const largoCortadoCm = filasNecesarias * imgH;
              const areaUsadaRollo = largoCortadoCm * ROLLO_ANCHO_CM;
              
              const costoTotalLote = (areaUsadaRollo / AREA_TOTAL_ROLLO) * COSTO_ROLLO;
              costoImpresion = costoTotalLote / (currentOrder.cantidad || 1);

              const COSTO_MINIMO = PRECIO_IMPRESION * 0.25;
              if (costoImpresion < COSTO_MINIMO) costoImpresion = COSTO_MINIMO;
              costoImpresion = redondeoPrecio(costoImpresion);
           }
    }
    
    const CANTIDAD_MINIMA = 6;
    let precioUnitarioCalculado = costoPuntadas + costoColores + costoPellon + costoTela + costoCorte + costoImpresion;
    let precioTotalCalculado = precioUnitarioCalculado * (currentOrder.cantidad || 1);
    
    const cantidad = currentOrder.cantidad || 1;
    if (cantidad < CANTIDAD_MINIMA) {
        precioTotalCalculado = precioUnitarioCalculado * CANTIDAD_MINIMA; 
        precioUnitarioCalculado = precioTotalCalculado / cantidad;
    }
    
    const precioUnitarioFinal = redondeoPrecio(precioUnitarioCalculado);
    
    return {
        ...currentOrder,
        costoPuntadas,
        costoColores,
        costoPellon,
        costoTela,
        costoCorte,
        costoImpresion,
        precio_unitario: precioUnitarioFinal,
        precio_total: redondeoPrecio(precioTotalCalculado),
        imagen: initialData.imagenStored || ""
    };
  }, [currentOrder, config, initialData]);

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
        <button className="close-btn-top" onClick={onClose} style={{position: 'absolute', top: '15px', right: '15px', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'}}><img src={closeIcon} className="icono-img icono-close icono-no-margin" alt="cerrar" style={{width: '14px', height: '14px', filter: 'brightness(0) invert(1)'}} /></button>

        {/* HEADER */}
        <div className="ticket-header" style={{marginTop: '10px'}}>
          <div className="ticket-brand">{docType === 'orden' ? `ORDEN #${currentOrder.id}` : `ZEQUITEX #${currentOrder.id}`}</div>
          
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
          
          <div className="ticket-date">{new Date(currentOrder.fecha_pedido).toLocaleDateString()}</div>
          <div style={{fontSize: '0.85rem', color: '#34d399', marginTop: '8px', fontWeight:'bold', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 5}}>
            Cliente: {clientName}
          </div>
        </div>

        {/* PREVIEW */}
        {readOnlyData.imagen && (
            <div className="ticket-preview" style={{padding: '10px', marginBottom: '15px'}}>
                <img src={
                    readOnlyData.imagen.startsWith('http') || readOnlyData.imagen.startsWith('data:')
                    ? readOnlyData.imagen
                    : `data:image/jpeg;base64,${readOnlyData.imagen}`
                } alt="Diseño" style={{maxHeight: 120, objectFit:'contain'}} />
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
              <div className="stat-item"><span className="label">Puntadas</span><span className="value">{currentOrder.puntadas?.toLocaleString()}</span></div>
              <div className="stat-item"><span className="label">Colores</span><span className="value">{currentOrder.colores}</span></div>
              <div className="stat-item"><span className="label">Medidas</span><span className="value">{currentOrder.ancho} x {currentOrder.alto}</span></div>
              <div className="stat-item input-item" style={{background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)'}}>
                  <span className="label" style={{color: '#34d399'}}>Cantidad</span>
                  <span className="value">{currentOrder.cantidad}</span>
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
          {/* Hilos incluido en bordado */}
          
          {/* Mostrar Tela solo si tiene costo > 0 (Apliqué) */}
          {(isEditing ? calculatedData.costoTela > 0 : readOnlyData.costoTela > 0) && (
             <div className="breakdown-row"><div className="row-label"><span>Tela ({isEditing ? editData.tipoTela : currentOrder.tipo_tela})</span></div><span className="price">{isEditing ? formatMoney(calculatedData.costoTela) : formatMoney(readOnlyData.costoTela)}</span></div>
          )}
          
          <div className="breakdown-row">
              <div className="row-label"><span>Pellon ({isEditing ? calculatedData.bastidorNombre : currentOrder.bastidor})</span></div>
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
          <div className="unit-price"><span>Precio Unitario</span><strong>{isEditing ? formatMoney(calculatedData.precioUnitarioFacturado) : formatMoney(currentOrder.precio_unitario || 0)}</strong></div>
          <div className="final-price"><span>TOTAL</span><strong>{isEditing ? formatMoney(calculatedData.precioTotal) : formatMoney(currentOrder.precio_total || 0)}</strong></div>
        </div>

        <div className="ticket-footer" style={{marginTop: 10}}>
            {isEditing ? 'Modo Edición - Precios Actuales' : 'Registro Histórico'}
        </div>

        {/* ACCIONES */}
        <div className="ticket-actions" style={{paddingBottom: 5, gap: '10px'}}>
          {!isEditing ? (
              <>
                <ShareableTicket 
                    result={{
                        success: true,
                        tenia_fondo: false,
                        dims: { width: readOnlyData.ancho, height: readOnlyData.alto },
                        realArea: 0, 
                        estimatedStitches: readOnlyData.puntadas,
                        colors: [],
                        numColors: readOnlyData.colores,
                        breakdown: {
                            puntadas: readOnlyData.costoPuntadas,
                            colores: readOnlyData.costoColores,
                            pellon: readOnlyData.costoPellon,
                            tela: readOnlyData.costoTela,
                            corte: readOnlyData.costoCorte,
                            impresion: readOnlyData.costoImpresion,
                            materiales: 0,
                            hilos: 0, base: 0
                        },
                        precio_sugerido: readOnlyData.precio_unitario,
                        imagen_procesada: readOnlyData.imagen,
                        mensaje: ''
                    }}
                    config={config}
                    quantity={readOnlyData.cantidad}
                    totalPrice={readOnlyData.precio_total} // PASAMOS EL TOTAL CORRECTO
                    jobName={readOnlyData.nombre_trabajo}
                    client={client || { nombre: clientName } as Client}
                    cotizacionId={currentOrder.id}
                />
                <button className="action-btn" style={{background: '#475569'}} onClick={onClose}>Cerrar</button>

                <button className="action-btn" style={{background: '#f59e0b'}} onClick={() => setIsEditing(true)}><img src={editIcon} className="icono-img icono-edit" alt="editar" style={{filter: 'brightness(0) invert(1)'}} /> Editar</button>
                <button className="action-btn print" onClick={handlePrint}><i className="fas fa-print"></i> Imprimir</button>
              </>
          ) : (
              <>
                <button className="action-btn" style={{background: '#475569'}} onClick={() => setIsEditing(false)}>Cancelar</button>
                <button className="action-btn" style={{background: '#10b981'}} onClick={handleSaveAsNew}><img src={saveIcon} className="icono-img icono-save" alt="guardar" style={{filter: 'brightness(0) invert(1)'}} /> Guardar como Nueva</button>
              </>
          )}
        </div>

      </div>
    </div>
  );
};
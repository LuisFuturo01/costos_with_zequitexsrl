import { useState, useEffect } from 'react';
import type { ProcessResult, Config } from '../types';

interface Props {
  result: ProcessResult;
  config: Config;
  initialQuantity?: number;
  onPrintRequest: () => void; // <--- Cambiado para solicitar al padre
  // NUEVAS PROPS
  clientName?: string | null;
  jobName?: string;
}

export const ResultTicket = ({ 
  result, 
  config, 
  initialQuantity = 1, 
  onPrintRequest,
  clientName,
  jobName
}: Props) => {
  
  const [qty, setQty] = useState(initialQuantity);

  useEffect(() => {
    const bd = result.breakdown as any;
    const manualQty = Number(bd?.cantidadUnidades);

    if (manualQty && manualQty > 0) {
        setQty(manualQty);
    } else if (initialQuantity > 0) {
        setQty(initialQuantity);
    }
  }, [result, initialQuantity]);

  // Lógica de Descuentos
  const getDiscountData = (amount: number) => {
    let discountPercent = 0;
    let label = "";

    if (amount >= 501) { discountPercent = 0.05; label = "Desc. (5%)"; } 
    else if (amount >= 201) { discountPercent = 0.04; label = "Desc. (4%)"; } 
    else if (amount >= 101) { discountPercent = 0.03; label = "Desc. (3%)"; } 
    else if (amount >= 51) { discountPercent = 0.02; label = "Desc. (2%)"; } 
    else { discountPercent = 0; label = ""; }
    return { discountPercent, label };
  };

  const precioUnitarioBase = result.precio_sugerido || 0;
  const { discountPercent, label: discountLabel } = getDiscountData(qty);
  
  const precioSubtotal = precioUnitarioBase * qty;
  const montoDescuento = precioSubtotal * discountPercent;
  const precioFinal = precioSubtotal - montoDescuento;
  const precioUnitarioFinal = precioFinal / (qty > 0 ? qty : 1);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-BO', { 
      style: 'currency', 
      currency: 'BOB' 
    }).format(amount);
  };

  // Lectura de datos
  const bd = result.breakdown as any; 
  
  const costoPuntadas = Number(bd?.puntadas) || 0;
  const costoColores = Number(bd?.colores) || 0;
  const costoTela = Number(bd?.tela) || 0;
  const costoPellon = Number(bd?.pellon) || 0;
  const costoCorte = Number(bd?.corte) || 0;
  
  const nombreBastidor = bd?.bastidorNombre || "Estándar";
  const tipoTela = result.mensaje?.includes('Estructurante') ? 'Estructurante' : 'Normal';

  return (
    <div className="ticket-wrapper">
      <div className="ticket-card">
        
        <div className="ticket-header">
          <div className="ticket-brand">ZEQUITEX</div>
          
          {/* TÍTULO DINÁMICO: Nombre del Trabajo */}
          <div className="ticket-title">
            {jobName || "COTIZACIÓN DETALLADA"}
          </div>
          
          <div className="ticket-date">
            {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>

          {/* MOSTRAR CLIENTE SI EXISTE */}
          {clientName && (
            <div style={{
                fontSize: '0.8rem', 
                color: '#10b981', 
                marginTop: '4px', 
                fontWeight: 700, 
                textTransform: 'uppercase'
            }}>
                Cliente: {clientName}
            </div>
          )}
        </div>

        <div className="ticket-preview">
          {result.imagen_procesada ? (
            <img src={result.imagen_procesada} alt="Diseño Bordado" />
          ) : (
            <div className="no-image-placeholder">
              <i className="fas fa-file-invoice-dollar"></i>
              <span>Cotización Generada</span>
            </div>
          )}
        </div>

        <div className="ticket-stats-grid">
          <div className="stat-item">
            <span className="label">Puntadas</span>
            <span className="value">{result.estimatedStitches ? Math.round(result.estimatedStitches).toLocaleString() : 0}</span>
          </div>
          <div className="stat-item">
            <span className="label">Colores</span>
            <span className="value">{result.numColors}</span>
          </div>
          <div className="stat-item">
            <span className="label">Medidas</span>
            <span className="value">
              {result.dims?.width ?? 0} x {result.dims?.height ?? 0} cm
            </span>
          </div>
          
          <div className="stat-item input-item">
            <span className="label">Cantidad</span>
            <input 
              type="number" 
              className="qty-input"
              min="1"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className="divider"></div>

        <div className="detail-section">
          <div className="detail-title">Estructura del Costo (Unitario)</div>
          
          <div className="breakdown-row">
            <div className="row-label">
                <span>Bordado / Puntadas</span>
                <small>~{Math.round(result.estimatedStitches/1000)}k puntadas</small>
            </div>
            <span className="price">{formatMoney(costoPuntadas)}</span>
          </div>

          <div className="breakdown-row">
             <div className="row-label">
                <span>Cambios de Hilo</span>
                <small>{result.numColors} colores</small>
            </div>
            <span className="price">{formatMoney(costoColores)}</span>
          </div>

          <div className="breakdown-row">
            <div className="row-label">
                <span>Tela Base ({tipoTela})</span>
                <small>Calculado s/ Área Diseño</small>
            </div>
            <span className="price">{formatMoney(costoTela)}</span>
          </div>

          <div className="breakdown-row">
            <div className="row-label">
                <span>Pellón / Insumos</span>
                <small>Bastidor: {nombreBastidor}</small>
            </div>
            <span className="price">{formatMoney(costoPellon)}</span>
          </div>

          {costoCorte > 0 && (
             <div className="breakdown-row">
                <div className="row-label">
                   <span>Servicio de Corte</span>
                   <small>Apliqué / Troquelado</small>
                </div>
                <span className="price">{formatMoney(costoCorte)}</span>
             </div>
          )}

          <div className="breakdown-row total-unit-row mt-3 pt-2 border-t border-dashed border-gray-300">
             <span>Costo Unitario Base</span>
             <strong>{formatMoney(precioUnitarioBase)}</strong>
          </div>
        </div>

        <div className="divider-dashed"></div>

        <div className="ticket-breakdown">
          <div className="breakdown-row">
            <span>Subtotal ({qty} pzs)</span>
            <span className="price">{formatMoney(precioSubtotal)}</span>
          </div>

          {discountPercent > 0 && (
            <div className="breakdown-row discount-row">
              <span>{discountLabel}</span>
              <span className="price discount-text">- {formatMoney(montoDescuento)}</span>
            </div>
          )}
        </div>

        {result.mensaje && (
          <div className="ticket-note">
              <strong>Detalle:</strong>
              <p>{result.mensaje}</p>
          </div>
        )}

        <div className="ticket-total-box">
          <div className="unit-price">
              <span>Unitario Final</span>
              <strong>{formatMoney(precioUnitarioFinal)}</strong>
          </div>
          <div className="final-price">
              <span>A PAGAR</span>
              <strong>{formatMoney(precioFinal)}</strong>
          </div>
        </div>

        <div className="ticket-footer">
          * Cotización válida por 15 días.
        </div>
      </div>

      <div className="ticket-actions">
        <button className="action-btn whatsapp" onClick={() => alert('Enviar a WhatsApp')}>
          <i className="fab fa-whatsapp"></i> Enviar
        </button>
        
        {/* BOTÓN IMPRIMIR: Valida si hay cliente */}
        <button 
          className="action-btn print" 
          onClick={onPrintRequest}
          style={{ opacity: clientName ? 1 : 0.5, cursor: clientName ? 'pointer' : 'not-allowed' }}
          title={!clientName ? "Selecciona un cliente arriba para imprimir" : ""}
        >
          <i className="fas fa-print"></i> Imprimir
        </button>
      </div>
    </div>
  );
};
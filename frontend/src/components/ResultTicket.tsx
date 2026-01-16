import { useState, useEffect } from 'react';
import type { ProcessResult, Config, Client } from '../types';
import { ShareableTicket } from './ShareableTicket';

interface Props {
  result: ProcessResult;
  config: Config;
  initialQuantity?: number;
  onPrintRequest: () => void;
  selectedClient?: Client | null; // CORRECCIÓN: Recibimos el objeto completo
  jobName?: string;
}

export const ResultTicket = ({ 
  result, 
  config, 
  initialQuantity = 1, 
  onPrintRequest,
  selectedClient, 
  jobName: initialJobName
}: Props) => {
  
  const [qty, setQty] = useState(initialQuantity);
  
  // --- ESTADOS DE EDICIÓN ---
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [jName, setJName] = useState(initialJobName || '');

  // --- CORRECCIÓN CLAVE: Sincronizar datos del cliente ---
  // Rellena nombre y teléfono automáticamente si vienen de App.tsx
  useEffect(() => {
    if (selectedClient) {
        setCName(selectedClient.nombre || '');
        setCPhone(selectedClient.numero_referencia || '');
    }
  }, [selectedClient]);

  // Sincronizar cantidad inicial
  useEffect(() => {
    const bd = result.breakdown as any;
    const manualQty = Number(bd?.cantidadUnidades);
    if (manualQty && manualQty > 0) setQty(manualQty);
    else if (initialQuantity > 0) setQty(initialQuantity);
  }, [result, initialQuantity]);

  // --- CREACIÓN DINÁMICA DEL OBJETO CLIENTE ---
  // Combina los inputs manuales con el ID original si existe
  const activeClient: Client | null = cName.trim() ? {
    id: selectedClient?.id || 0,
    nombre: cName,
    numero_referencia: cPhone || undefined,
    domicilio: selectedClient?.domicilio || ''
  } : null;

  // --- CÁLCULOS MATEMÁTICOS ---
  const getDiscountData = (amount: number) => {
    if (amount >= 501) return { percent: 0.05, label: "Desc. (5%)" };
    if (amount >= 201) return { percent: 0.04, label: "Desc. (4%)" };
    if (amount >= 101) return { percent: 0.03, label: "Desc. (3%)" };
    if (amount >= 51) return { percent: 0.02, label: "Desc. (2%)" };
    return { percent: 0, label: "" };
  };

  const precioUnitarioBase = result.precio_sugerido || 0;
  const { percent: discountPercent, label: discountLabel } = getDiscountData(qty);
  
  const precioSubtotal = precioUnitarioBase * qty;
  const montoDescuento = precioSubtotal * discountPercent;
  const precioFinal = precioSubtotal - montoDescuento;
  const precioUnitarioFinal = precioFinal / (qty > 0 ? qty : 1);

  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);

  // Desglose de costos
  const bd = result.breakdown as any; 
  const costoPuntadas = Number(bd?.puntadas) || 0;
  const costoColores = Number(bd?.colores) || 0;
  const costoTela = Number(bd?.tela) || 0;
  const costoPellon = Number(bd?.pellon) || 0;
  const costoCorte = Number(bd?.corte) || 0;
  const costoImpresion = Number(bd?.impresion) || 0;
  
  const nombreBastidor = bd?.bastidorNombre || "Estándar";
  const tipoTela = result.mensaje?.includes('Estructurante') ? 'Estructurante' : 'Normal';
  const tieneSublimacion = result.mensaje?.includes('Sublimación') || costoImpresion > 0;

  return (
    <div className="ticket-wrapper">
      <div className="ticket-card">
        
        <div className="ticket-header">
          <div className="ticket-brand">ZEQUITEX</div>
          
          {/* Input: Nombre del Trabajo */}
          <div className="ticket-title-input-container" style={{ marginBottom: '5px' }}>
             <input 
                type="text" 
                className="ticket-input job-input"
                placeholder="Nombre del Trabajo"
                value={jName}
                onChange={(e) => setJName(e.target.value)}
                style={{ 
                    width: '100%', textAlign: 'center', fontWeight: 'bold', 
                    fontSize: '1.1rem', border: '1px dashed #ccc', padding: '4px',
                    backgroundColor: 'transparent'
                }}
             />
          </div>
          
          <div className="ticket-date">
            {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>

          {/* Inputs: Cliente y WhatsApp */}
          <div className="client-inputs-grid" style={{ 
              display: 'flex', gap: '10px', marginTop: '10px', 
              justifyContent: 'center', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px',
              border: '1px solid #e5e7eb'
          }}>
             <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: '#666', display: 'block', marginBottom:'2px' }}>Cliente (Obligatorio) *</label>
                <input 
                    type="text" 
                    placeholder="Ingresa Nombre"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    style={{ 
                        width: '100%', padding: '6px', fontSize: '0.9rem', 
                        border: '1px solid', borderColor: cName ? '#d1d5db' : '#fca5a5', 
                        borderRadius: '4px', outline: 'none'
                    }}
                />
             </div>
             <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: '#666', display: 'block', marginBottom:'2px' }}>WhatsApp (Referencia)</label>
                <input 
                    type="tel" 
                    placeholder="Ej. 70001234"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    style={{ 
                        width: '100%', padding: '6px', fontSize: '0.9rem', 
                        border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none'
                    }}
                />
             </div>
          </div>
        </div>

        {/* Imagen Previa */}
        <div className="ticket-preview">
          {result.imagen_procesada ? (
            <img 
                src={result.imagen_procesada.startsWith('data:') ? result.imagen_procesada : `data:image/jpeg;base64,${result.imagen_procesada}`} 
                alt="Diseño Bordado" 
            />
          ) : (
            <div className="no-image-placeholder">
              <i className="fas fa-file-invoice-dollar"></i>
              <span>Cotización Generada</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
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
            <span className="value">{result.dims?.width ?? 0} x {result.dims?.height ?? 0} cm</span>
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

        {/* Detalle Precios */}
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

          {costoTela > 0 && (
            <div className="breakdown-row">
              <div className="row-label">
                  <span>Tela Base ({tipoTela})</span>
                  <small>Calculado s/ Área Diseño</small>
              </div>
              <span className="price">{formatMoney(costoTela)}</span>
            </div>
          )}

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

          {tieneSublimacion && costoImpresion > 0 && (
             <div className="breakdown-row">
                <div className="row-label">
                   <span>Sublimación Digital</span>
                   <small>Impresión + Material</small>
                </div>
                <span className="price">{formatMoney(costoImpresion)}</span>
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
        {/* CORRECCIÓN: Pasamos el objeto activeClient completo */}
        <ShareableTicket 
           result={result}
           config={config}
           quantity={qty}
           jobName={jName}
           client={activeClient}
        />

        <button 
          className="action-btn print" 
          onClick={onPrintRequest}
        >
          <i className="fas fa-print"></i> Imprimir
        </button>
      </div>
    </div>
  );
};
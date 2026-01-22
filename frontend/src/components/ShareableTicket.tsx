import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import type { ProcessResult, Config, Client } from '../types';
import { AlertModal } from './ui/AlertModal'; 

interface Props {
  result: ProcessResult;
  config: Config;
  quantity: number;
  jobName?: string;
  client: Client | null; // Objeto Cliente estricto
  cotizacionId?: number; // ID de cotización guardada (requerido para enviar por WhatsApp)
  mensajeAdicional?: string; // Mensaje adicional opcional
  totalPrice?: number; // Total calculado externo (opcional)
}

export const ShareableTicket = ({ result, config, quantity, jobName, client, cotizacionId, mensajeAdicional, totalPrice }: Props) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  // Estados para Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', type: 'info' as 'info'|'success'|'error' });
  const [pendingWaLink, setPendingWaLink] = useState<string | null>(null);

  // --- CÁLCULOS PARA LA IMAGEN (usando datos del breakdown guardados en DB) ---
  const bd = result.breakdown as any;
  const precioUnitario = result.precio_sugerido || 0;
  
  // LÓGICA CORREGIDA: Si la cantidad es 1, 2, 3, 4 o 5, se cobra como 6.
  const cantidadEfectiva = (quantity >= 1 && quantity <= 5) ? 6 : quantity;

  let discountPercent = 0;
  if (quantity >= 501) discountPercent = 0.05;
  else if (quantity >= 201) discountPercent = 0.04;
  else if (quantity >= 101) discountPercent = 0.03;
  else if (quantity >= 51) discountPercent = 0.02;

  // El subtotal usa la cantidadEfectiva para el cobro mínimo
  const subtotal = precioUnitario * cantidadEfectiva;
  const montoDescuento = subtotal * discountPercent;
  
  // Si nos pasan totalPrice, usamos ese. Si no, calculamos.
  const totalPagar = totalPrice !== undefined ? totalPrice : (subtotal - montoDescuento);
  
  // Obtener costos del breakdown guardado en la DB
  const costoPuntadas = Number(bd?.puntadas) || 0;  // Costo de puntadas
  const costoColores = Number(bd?.colores) || 0;    // Costo cambio de hilos
  const costoPellon = Number(bd?.pellon) || 0;      // Costo pellón
  const costoTela = Number(bd?.tela) || 0;          // Costo tela
  const costoCorte = Number(bd?.corte) || 0;        // Costo corte
  const costoImpresion = Number(bd?.impresion) || 0; // Costo sublimación
  
  // "Otros" = todo lo que no es puntadas
  const costoOtros = costoColores + costoPellon + costoTela + costoCorte + costoImpresion;
  
  const formatMoney = (val: number) => 
    new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val);

  const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // --- GENERACIÓN DE LINK ---
  const getWhatsAppLink = (text: string) => {
    const encodedText = encodeURIComponent(text);
    // Usamos numero_referencia del objeto Client
    const rawPhone = client?.numero_referencia ? client.numero_referencia.replace(/\D/g, '') : '';
    
    // Si tiene más de 5 dígitos, es válido
    if (rawPhone && rawPhone.length > 5) {
       return `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodedText}`;
    } 
    // Si no, modo selección manual
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  };

  const handleShare = async () => {
    // === 1. VALIDACIÓN: COTIZACIÓN DEBE ESTAR GUARDADA ===
    if (!cotizacionId) {
        setModalConfig({
            title: 'Cotización No Guardada',
            message: '⚠️ Debes GUARDAR la cotización antes de poder enviarla por WhatsApp. La cotización necesita un número de identificación.',
            type: 'error'
        });
        setModalOpen(true);
        return;
    }

    // === 2. VALIDACIÓN ESTRICTA: SI NO HAY CLIENTE, NO AVANZA ===
    if (!client || !client.nombre || client.nombre.trim() === '') {
        setModalConfig({
            title: 'Cliente Requerido',
            message: '⚠️ Debes ingresar un NOMBRE DE CLIENTE para poder generar y enviar la cotización.',
            type: 'error'
        });
        setModalOpen(true);
        return;
    }

    if (!ticketRef.current) return;
    setIsSharing(true);

    try {
      // 3. Generar Imagen (PNG)
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true, 
        logging: false
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showError('Error al generar la imagen del ticket.');
          return;
        }

        // Construir mensaje de WhatsApp con formato requerido
        const textLines = [
          `📋 *COTIZACIÓN #${cotizacionId}*`,
          ``,
          `Hola ${client.nombre}, aquí tienes tu cotización para "${jobName || 'Bordado'}":`,
          ``,
          `🧵 *Puntadas:* ${result.estimatedStitches ? Math.round(result.estimatedStitches).toLocaleString() : 0} pts`,
          `💰 *Costo bordado:* ${formatMoney(costoPuntadas)}`,
          `📦 *Otros costos:* ${formatMoney(costoOtros)}`,
          ``,
          `💵 *TOTAL: ${formatMoney(totalPagar)}* (${quantity} pzs)`,
        ];
        
        if (mensajeAdicional && mensajeAdicional.trim()) {
          textLines.push(``);
          textLines.push(`📝 ${mensajeAdicional}`);
        }
        
        textLines.push(``);
        textLines.push(`(Te adjunto el detalle en la imagen 👇)`);

        const textMessage = textLines.join('\n');
        
        const waLink = getWhatsAppLink(textMessage);
        const hasValidPhone = client.numero_referencia && client.numero_referencia.replace(/\D/g, '').length > 5;
        const file = new File([blob], 'cotizacion.png', { type: 'image/png' });
        
        let nativeShareSuccess = false;

        // INTENTO 1: Share Nativo (SOLO MÓVIL)
        if (isMobile() && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Cotización ${cotizacionId ? '#' + cotizacionId : ''}`,
              text: textMessage
            });
            nativeShareSuccess = true;
          } catch (err: any) {
             if (err.name === 'AbortError') {
                 setIsSharing(false);
                 return; // Usuario canceló explícitamente
             }
             console.log("Share nativo falló:", err);
          }
        }

        if (nativeShareSuccess) {
            setIsSharing(false);
            return;
        }

        // INTENTO 2: Fallback según dispositivo
        if (isMobile()) {
            // == FALLBACK MÓVIL: DESCARGAR IMAGEN ==
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Cotizacion_${cotizacionId || 'zequitex'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setModalConfig({
                title: 'Imagen Descargada',
                message: '📥 La imagen se guardó en tu dispositivo.\n\nPuedes abrirla y compartirla a la aplicación que desees (Facebook, WhatsApp, etc.).',
                type: 'success'
            });
            setModalOpen(true);
        } else {
            // == FALLBACK PC: CLIPBOARD + WHATSAPP ==
            try {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              setPendingWaLink(waLink);

              const msgExito = hasValidPhone 
                ? `✅ Imagen copiada.\nSe abrirá WhatsApp con ${client.nombre}.\nPresiona PEGAR (Ctrl + V).`
                : `✅ Imagen copiada.\nEl cliente no tiene un número válido.\nPresiona PEGAR (Ctrl + V).`;

              setModalConfig({
                title: 'Listo para enviar',
                message: msgExito,
                type: 'success'
              });
              setModalOpen(true);
            } catch (err) {
              console.error(err);
              showError('Tu navegador no soporta copiado automático. Captura la pantalla manualmente.');
            }
        }

        setIsSharing(false);
      }, 'image/png', 1.0);
    } catch (err) {
      console.error(err);
      showError('Error inesperado.');
    }
  };

  const showError = (msg: string) => {
    setIsSharing(false);
    setModalConfig({ title: 'Atención', message: msg, type: 'error' });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (pendingWaLink) {
      window.open(pendingWaLink, '_blank');
      setPendingWaLink(null);
    }
  };

  return (
    <div style={{ marginTop: '10px', width: '100%' }}>
      
      <button 
        onClick={handleShare} 
        disabled={isSharing}
        className="action-btn whatsapp"
        style={{ 
          width: '100%', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          backgroundColor: (client && client.nombre) ? '#25d366' : '#9ca3af',
          color: 'white', padding: '12px',
          borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 'bold',
          cursor: isSharing ? 'wait' : 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          transition: 'background-color 0.3s'
        }}
        title={!(client && client.nombre) ? "Ingresa un cliente para habilitar" : ""}
      >
        <i className={`fab ${isSharing ? 'fa-spinner fa-spin' : 'fa-whatsapp'}`} style={{ fontSize: '1.2em' }}></i>
        {isSharing ? 'Generando...' : (isMobile() ? 'Compartir / Descargar' : 'Enviar por WhatsApp')}
      </button>

      <AlertModal 
        isOpen={modalOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onClose={handleModalClose}
      />

      {/* =========================================================
          PLANTILLA VISUAL OCULTA (Se convierte en Imagen)
          ========================================================= */}
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
        <div 
          ref={ticketRef} 
          style={{ 
            width: '500px', padding: '40px', backgroundColor: 'white', 
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 
            color: '#1f2937', backgroundImage: 'linear-gradient(to bottom, #ffffff, #f9fafb)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid #10b981', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '26px', color: '#111827', fontWeight: '900', letterSpacing: '-0.5px' }}>COTIZACIÓN</h2>
              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'bold' }}>
                {cotizacionId ? `N° ${cotizacionId.toString().padStart(6, '0')}` : 'Borrador'} 
              </div>
              <p style={{ margin: '5px 0 0', fontSize: '16px', color: '#4b5563' }}>{jobName || 'Servicio de Bordado'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>ZEQUITEX</div>
               <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}>{new Date().toLocaleDateString()}</div>
               {client && client.nombre && <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', marginTop:'2px' }}>{client.nombre}</div>}
            </div>
          </div>

          {/* Imagen Central */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '25px', backgroundColor: '#fff', padding:'15px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
             {result.imagen_procesada ? (
               <img src={
                   result.imagen_procesada.startsWith('http') || result.imagen_procesada.startsWith('data:') 
                   ? result.imagen_procesada 
                   : `data:image/jpeg;base64,${result.imagen_procesada}`
               } alt="Diseño" style={{ maxHeight: '220px', maxWidth: '100%', objectFit: 'contain' }} />
             ) : ( <span style={{color:'#ccc'}}>Sin vista previa</span> )}
          </div>

          {/* Tabla de Precios Simplificada */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>
              Composición del Precio Unitario
            </h3>

            {/* 1. Puntadas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: '600', color: '#374151' }}>Bordado / Puntadas</span>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{result.estimatedStitches ? Math.round(result.estimatedStitches).toLocaleString() : 0} pts</div>
              </div>
              <strong style={{ color: '#1f2937' }}>{formatMoney(costoPuntadas)}</strong>
            </div>

            {/* 2. Otros (suma de todo lo demás) */}
            {costoOtros > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontWeight: '600', color: '#374151' }}>Otros</span>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Materiales e insumos</div>
                </div>
                <strong style={{ color: '#1f2937' }}>{formatMoney(costoOtros)}</strong>
              </div>
            )}

            {/* Subtotal Unitario */}
            <div style={{ borderTop: '1px dashed #d1d5db', marginTop: '10px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontSize: '14px', color: '#4b5563' }}>Precio Unitario Base:</span>
               <span style={{ fontWeight: 'bold', color: '#374151' }}>{formatMoney(precioUnitario)}</span>
            </div>
          </div>

          {/* Totales Finales */}
          <div style={{ backgroundColor: '#064e3b', color: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '15px', opacity: 0.9 }}>
              <span>Cantidad Solicitada:</span>
              <strong>{quantity} pzs</strong>
            </div>
            
            {montoDescuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px', color: '#fca5a5', fontWeight: 'bold' }}>
                <span>Descuento Volumen:</span>
                <span>- {formatMoney(montoDescuento)}</span>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: '500' }}>TOTAL A PAGAR:</span>
              <span style={{ fontSize: '34px', fontWeight: '800' }}>{formatMoney(totalPagar)}</span>
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '12px', textAlign: 'right', opacity: 0.8 }}>
               Unitario Final: {formatMoney(totalPagar / quantity)} c/u
            </div>
          </div>
          
          <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '15px' }}>
            Zequitex Soluciones Textiles • Cotización válida por 15 días
          </div>
        </div>
      </div>
    </div>
  );
};
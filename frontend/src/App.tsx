import { useState, useEffect, type FormEvent } from 'react';
import './assets/styles/App.scss';
import type { Config, TabMode, View, ProcessResult, User, Client } from './types';
import { api } from './services/api';

// Components
import { Header } from './components/layout/Header';
import { LoginView } from './components/views/LoginView';
import { ConfigView } from './components/views/ConfigView';
import { OrdenesView } from './components/views/OrdenesView';
import { ResultTicket } from './components/ResultTicket'; 
import { UploadMode } from './components/modes/UploadMode';
import { CameraMode } from './components/modes/CameraMode';
import { ManualMode } from './components/modes/ManualMode';

// Modales UI
import { InputModal } from './components/ui/InputModal';
import { AlertModal } from './components/ui/AlertModal';
import { ExitConfirmModal } from './components/ui/ExitConfirmModal';

// Iconos SVG
import saveIcon from './assets/images/save.svg';
import checkIcon from './assets/images/check.svg';

const BASTIDORES_DISPONIBLES = [
  { nombre: "9 cm", size: 6.5, corte: 0.15 },
  { nombre: "12 cm", size: 9.5, corte: 0.25 },
  { nombre: "15 cm", size: 12.5, corte: 0.35 },
  { nombre: "18 cm", size: 15.5, corte: 0.45 },
  { nombre: "30 cm", size: 27.5, corte: 0.65 }
];

function App() {
  const [view, setView] = useState<View>('main');
  const [mode, setMode] = useState<TabMode>('upload');
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [manualQuantity, setManualQuantity] = useState(1);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | string>(""); 
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  // --- ESTADOS PARA MODALES Y FLUJO ---
  const [isPrinting, setIsPrinting] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{open: boolean, title: string, msg: string, type: 'error'|'success'|'info'}>({open: false, title:'', msg:'', type:'info'});
  
  // Control del flujo de pedir nombre
  const [jobModal, setJobModal] = useState<{open: boolean, action: 'print'|'save'|'confirm'}>({open: false, action: 'save'});
  const [currentJobName, setCurrentJobName] = useState("Bordado Personalizado");

  // Estados para confirmar orden
  const [lastSavedCotizacionId, setLastSavedCotizacionId] = useState<number | null>(null);
  const [confirmOrderModal, setConfirmOrderModal] = useState(false);
  const [ordenFechaEntrega, setOrdenFechaEntrega] = useState('');
  const [ordenDetail, setOrdenDetail] = useState('');

  // Estado para modal de salida
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  useEffect(() => { loadData(); }, []);

  // Manejar evento beforeunload para advertir sobre datos no guardados
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        // Mostrar modal personalizado cuando hay datos sin guardar
        setShowExitModal(true);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedData]);

  // Marcar datos como no guardados cuando hay un resultado
  useEffect(() => {
    setHasUnsavedData(result !== null && lastSavedCotizacionId === null);
  }, [result, lastSavedCotizacionId]);

  const loadData = async () => {
      try {
          const cfg = await api.getConfig();
          setConfig(cfg);
          const cls = await api.getClients();
          setClients(cls);
      } catch (err) { console.error(err); }
  };

  const redondeoPrecio = (precio: number) => {
    return Math.ceil(precio*10)/10;
  };

  const getSelectedClient = (): Client | null => {
    if (!selectedClientId) return null;
    return clients.find(c => c.id === Number(selectedClientId)) || null;
  };

  // Helper de alertas
  const showAlert = (title: string, msg: string, type: 'error'|'success'|'info' = 'info') => {
      setAlertInfo({ open: true, title, msg, type });
  };

  const getSelectedClientName = () => {
      if (!selectedClientId) return null;
      const c = clients.find(cl => cl.id === Number(selectedClientId));
      return c ? c.nombre : null;
  };

  const handleCreateClient = async () => {
      if (!newClientName.trim()) return;
      try {
          const res = await api.saveClient({ nombre: newClientName });
          if (res) {
              const updated = await api.getClients();
              setClients(updated);
              const created = updated.find(c => c.nombre === newClientName);
              if (created) setSelectedClientId(created.id);
              setShowNewClientModal(false);
              setNewClientName("");
          }
      } catch { showAlert("Error", "Error creando cliente", "error"); }
  };

  // --- FLUJO: SOLICITAR NOMBRE ---
  const handleRequestAction = (action: 'print' | 'save') => {
      if (!result) return showAlert("Error", "No hay cotización para procesar.", "error");
      if (!selectedClientId) return showAlert("Atención", "Selecciona un cliente de la lista.", "error");
      
      setJobModal({ open: true, action });
  };

  // --- FLUJO: CONFIRMAR NOMBRE ---
  const handleConfirmJobName = (name: string) => {
      setJobModal({ ...jobModal, open: false });
      setCurrentJobName(name);

      if (jobModal.action === 'save') {
          executeSaveOrder(name);
      } else {
          executePrint(name);
      }
  };

  // --- FLUJO: GUARDAR ORDEN ---
  const executeSaveOrder = async (name: string) => {
      if (!config?.pricing?.id || !result) return;

      const bd = result.breakdown as any;
      const precioUnitarioReal = bd?.precioUnitarioReal || result.precio_sugerido || 0;
      const qty = manualQuantity;

      const CANTIDAD_MINIMA = 6;
      let precioUnitarioAjustado = precioUnitarioReal;
      
      if (qty < CANTIDAD_MINIMA) {
        precioUnitarioAjustado = precioUnitarioReal * CANTIDAD_MINIMA;
      }

      let discountPercent = 0;
      if (qty >= 501) discountPercent = 0.05;
      else if (qty >= 201) discountPercent = 0.04;
      else if (qty >= 101) discountPercent = 0.03;
      else if (qty >= 51) discountPercent = 0.02;

      const subtotal = precioUnitarioAjustado * qty;
      const totalFinal = subtotal - (subtotal * discountPercent);

      // Detectar si lleva sublimación basado en el costo calculado
      const tieneSublimacion = (bd?.impresion || 0) > 0;

      const orderPayload = {
          cliente_id: Number(selectedClientId),
          configuracion_id: Number(config.pricing.id),
          nombre_trabajo: name,
          puntadas: result.estimatedStitches,
          colores: result.numColors,
          ancho: result.dims?.width || 0,
          alto: result.dims?.height || 0,
          bastidor: bd?.bastidorNombre || "Estándar",
          tipo_tela: result.mensaje?.includes('Estructurante') ? 'Estructurante' : 'Normal',
          tiene_sublimacion: tieneSublimacion,
          cantidad: qty,
          precio_unitario: precioUnitarioAjustado,
          precio_total: totalFinal,
          datos_json: result.imagen_procesada ? result.imagen_procesada : null
      };

      try {
          const response = await api.saveOrder(orderPayload);
          setLastSavedCotizacionId(response.id);
          setHasUnsavedData(false);
          showAlert("Éxito", "Cotización guardada. ¿Deseas confirmar la orden?", "success");
      } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          showAlert("Error", "Error al guardar: " + message, "error");
      }
  };

  // --- FLUJO: CONFIRMAR ORDEN ---
  const handleOpenConfirmOrder = () => {
      if (!lastSavedCotizacionId) {
          return showAlert("Atención", "Primero debes guardar la cotización.", "error");
      }
      setConfirmOrderModal(true);
  };

  const handleConfirmOrder = async () => {
      if (!lastSavedCotizacionId) return;
      
      try {
          await api.createOrden({
              cotizacion_id: lastSavedCotizacionId,
              fecha_entrega: ordenFechaEntrega || undefined,
              detail: ordenDetail || undefined
          });
          setConfirmOrderModal(false);
          setOrdenFechaEntrega('');
          setOrdenDetail('');
          setResult(null);
          setLastSavedCotizacionId(null);
          setHasUnsavedData(false);
          showAlert("Éxito", "Orden confirmada correctamente. Puedes verla en la sección de Órdenes.", "success");
      } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          showAlert("Error", message, "error");
      }
  };

  // --- MANEJO DE SALIDA ---
  const handleConfirmExit = () => {
      setShowExitModal(false);
      setHasUnsavedData(false);
      setResult(null);
      setLastSavedCotizacionId(null);
      if (pendingNavigation) {
          pendingNavigation();
          setPendingNavigation(null);
      }
  };

  // 2. Ejecutar Impresión
  const executePrint = () => {
      setIsPrinting(true); 
      setTimeout(() => {
          window.print(); 
          setTimeout(() => setIsPrinting(false), 500);
      }, 500); 
  };

  const handleProcess = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const widthInput = parseFloat(formData.get('width') as string);
    if (!selectedFile || !widthInput || isNaN(widthInput)) return showAlert("Error", "Faltan datos", "error");

    setIsProcessing(true);
    const payload = new FormData();
    payload.append('image', selectedFile);
    payload.append('width', widthInput.toString());

    try {
      const apiData = await api.processImage(payload);
      if (config) {
        const p = config.pricing;
        const densidadConfig = config?.stitch_density || 55;
        
        const PRECIO_1000_PUNTADAS = p.precio_stitch_1000;
        let PRECIO_CAMBIO_COLOR = p.factor_cambio_hilo;
        
        // Factor base de pellón
        let FACTOR_PELLON = (p.costo_pellon ?? 300) / 1000000; 
        
        const w = apiData.dims?.width || 0;
        const h = apiData.dims?.height || 0;
        const areaDiseno = w * h;

        // Calcular puntadas
        let stitches = apiData.estimatedStitches;
        if (!stitches || stitches === 0) {
          stitches = Math.round(areaDiseno * densidadConfig * 1.1);
        }
        if (stitches < 2000) stitches = 2000;

        // Buscar bastidor adecuado basado en la dimensión máxima
        const dimensionMaxima = Math.max(w, h);
        const bastidorObj = BASTIDORES_DISPONIBLES
          .slice()
          .sort((a, b) => a.size - b.size)
          .find(b => dimensionMaxima <= b.size)
          ?? BASTIDORES_DISPONIBLES[BASTIDORES_DISPONIBLES.length - 1];

        const areaBastidorReal = bastidorObj.size ** 2;
        const bastidorNombre = bastidorObj.nombre;

        // Calcular costo de puntadas con cambios de color incluidos
        if (apiData.numColors > 1) {
          PRECIO_CAMBIO_COLOR = PRECIO_CAMBIO_COLOR * (apiData.numColors - 1);
        }
        const costoPuntadas = redondeoPrecio((stitches / 1000) * (PRECIO_1000_PUNTADAS + PRECIO_CAMBIO_COLOR));

        // Aplicar multiplicador de pellón según tamaño del bastidor
        if (areaBastidorReal <= 42.25) FACTOR_PELLON *= 3.8;
        else if (areaBastidorReal <= 90.25) FACTOR_PELLON *= 3.5;
        else if (areaBastidorReal <= 156.25) FACTOR_PELLON *= 3.2;
        else if (areaBastidorReal <= 240.25) FACTOR_PELLON *= 2.9;
        else if (areaBastidorReal <= 756.25) FACTOR_PELLON *= 2.6;

        const costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
        const costoPellon = redondeoPrecio(costoPellonCalc);

        // En modo upload/camera: solo puntadas (con colores incluidos) y pellón
        const precioUnitarioReal = costoPuntadas + costoPellon;

        setResult({
          ...apiData,
          estimatedStitches: stitches,
          precio_sugerido: precioUnitarioReal,
          breakdown: { 
              puntadas: Number(costoPuntadas.toFixed(2)), 
              colores: 0, // Ya está incluido en puntadas
              materiales: 0, 
              pellon: Number(costoPellon.toFixed(2)),
              hilos: 0, 
              base: 0, 
              corte: 0, 
              tela: 0,
              impresion: 0, // Sublimación solo aplica en modo manual
              bastidorNombre: bastidorNombre, 
              cantidadUnidades: 1,
              precioUnitarioReal: Number(precioUnitarioReal.toFixed(2)),
              precioUnitarioAjustado: Number(precioUnitarioReal.toFixed(2))
          },
          mensaje: `Bastidor: ${bastidorNombre}\nÁrea: ${areaBastidorReal.toFixed(2)} cm²`
        });
      } else { setResult(apiData); }
      setManualQuantity(1);
      setLastSavedCotizacionId(null); // Reset - nueva cotización requiere guardar de nuevo
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err: unknown) { 
      const message = err instanceof Error ? err.message : 'Error desconocido';
      showAlert("Error", message, "error"); 
    } finally { setIsProcessing(false); }
  };

  const onManualEstimate = (res: ProcessResult, qty: number) => {
      setResult(res);
      setManualQuantity(qty);
      setLastSavedCotizacionId(null); // Reset - nueva cotización requiere guardar de nuevo
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  // --- VISTA DE IMPRESIÓN ---
  if (isPrinting && result && config) {
      return (
        <ResultTicket 
            result={result} 
            config={config} 
            initialQuantity={manualQuantity} 
            selectedClient={getSelectedClient()}
            jobName={currentJobName}
            savedCotizacionId={lastSavedCotizacionId || undefined}
            onPrintRequest={() => {}} 
        />
      );
  }

  // --- VISTAS NORMALES ---
  // --- MANEJO LOGIN ---
  const handleLoginSuccess = (u: User) => {
      //console.log("Login Success:", u);
      setCurrentUser(u);
      setIsLoggedIn(true);
      setView('config'); // Go directly to config logic
  };

  // --- VISTAS NORMALES ---
  if (view === 'login') return <LoginView setView={setView} onLoginSuccess={handleLoginSuccess} />;
  if (view === 'config' && isLoggedIn && config) return <ConfigView config={config} setConfig={setConfig} setView={setView} setIsLoggedIn={setIsLoggedIn} currentUser={currentUser} />;
  if (view === 'ordenes') return (
    <div className="app">
      <Header setView={setView} />
      <div className="container">
        <OrdenesView onClose={() => setView('main')} />
      </div>
    </div>
  );

  return (
    <div className="app">
      <Header setView={setView} />

      {/* --- MODALES GLOBALES --- */}
      <AlertModal 
        isOpen={alertInfo.open} 
        title={alertInfo.title} 
        message={alertInfo.msg} 
        type={alertInfo.type}
        onClose={() => setAlertInfo({...alertInfo, open: false})}
      />

      <InputModal 
        isOpen={jobModal.open}
        title={jobModal.action === 'save' ? "Guardar Trabajo" : "Imprimir Cotización"}
        placeholder="Ej: Logo Pecho Izquierdo - Coca Cola"
        initialValue={currentJobName}
        onClose={() => setJobModal({...jobModal, open: false})}
        onAccept={handleConfirmJobName}
      />

      <div className="container">
        <div className="tabs">
          <button className={`tab ${mode==='upload'?'active':''}`} onClick={()=>{setMode('upload'); setResult(null)}}>Subir</button>
          <button className={`tab ${mode==='camera'?'active':''}`} onClick={()=>{setMode('camera'); setResult(null)}}>Foto</button>
          <button className={`tab ${mode==='manual'?'active':''}`} onClick={()=>{setMode('manual'); setResult(null)}}>Tanteo</button>
        </div>

        <div className="card">
          <div className="client-selection-area">
              <div className="client-input-group">
                  <div className="input-wrapper">
                      <label className="input-label">Cliente para Cotización</label>
                      <select className="client-select" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                          <option value="">-- Cliente Casual / Sin Registrar --</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                  </div>
                  <button type="button" className="btn-add-client" onClick={() => setShowNewClientModal(true)} title="Agregar Nuevo Cliente">+</button>
              </div>
          </div>

          {mode === 'manual' ? (
             <ManualMode onEstimate={onManualEstimate} />
          ) : (
            <form onSubmit={handleProcess}>
              {mode === 'upload' && <UploadMode onFileSelect={setSelectedFile} />}
              {mode === 'camera' && <CameraMode onCapture={setSelectedFile} />}
              <div className="width-input-section">
                <label className="input-label">ANCHO FINAL (CM)</label>
                <input type="number" name="width" className="styled-input" step="0.1" required placeholder="Ej: 10.5" />
              </div>
              <button type="submit" className="btn-main btn-process" disabled={isProcessing}>
                {isProcessing ? 'ANALIZANDO...' : 'COTIZAR BORDADO'}
              </button>
            </form>
          )}
        </div>

        {showNewClientModal && (
            <div className="modal-overlay">
                <div className="modal-card">
                    <h3>Nuevo Cliente Rápido</h3>
                    <input className="styled-input" placeholder="Nombre" autoFocus value={newClientName} onChange={e=>setNewClientName(e.target.value)}/>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={()=>setShowNewClientModal(false)}>Cancelar</button>
                        <button className="btn-main" onClick={handleCreateClient}>Guardar y Usar</button>
                    </div>
                </div>
            </div>
        )}

        {result && config && (
          <div>
              <ResultTicket 
                result={result} 
                config={config} 
                initialQuantity={manualQuantity} 
                selectedClient={getSelectedClient()} 
                jobName={currentJobName}
                savedCotizacionId={lastSavedCotizacionId || undefined}
                onPrintRequest={() => handleRequestAction('print')}
              />
              
              <div className="action-buttons-container">
                  <button 
                    className={`btn-main btn-save-cotizacion ${selectedClientId ? 'has-client' : 'no-client'}`}
                    onClick={() => handleRequestAction('save')}
                    disabled={!selectedClientId}
                  >
                      {selectedClientId ? <><img src={saveIcon} className="icono-img icono-save" alt="guardar" /> Guardar Cotización</> : 'Selecciona un cliente para guardar'}
                  </button>
                  
                  {lastSavedCotizacionId && (
                    <button 
                      className="btn-main btn-confirm-order"
                      onClick={handleOpenConfirmOrder}
                    >
                        <img src={checkIcon} className="icono-img icono-check" alt="confirmar" /> Confirmar Orden
                    </button>
                  )}
              </div>
          </div>
        )}

        {/* Modal de Confirmar Orden */}
        {confirmOrderModal && (
          <div className="modal-overlay confirm-order-modal">
            <div className="modal-card">
              <h3><img src={checkIcon} className="icono-img icono-check" alt="confirmar" /> Confirmar Orden</h3>
              <p>Esta cotización pasará a producción. Puedes agregar detalles opcionales:</p>
              
              <label>Fecha de Entrega (opcional)</label>
              <input 
                type="date" 
                className="styled-input"
                value={ordenFechaEntrega}
                onChange={(e) => setOrdenFechaEntrega(e.target.value)}
              />

              <label className="mt-10">Observaciones (opcional)</label>
              <textarea 
                className="styled-input"
                rows={3}
                placeholder="Notas adicionales para producción..."
                value={ordenDetail}
                onChange={(e) => setOrdenDetail(e.target.value)}
              />

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setConfirmOrderModal(false)}>Cancelar</button>
                <button className="btn-main" onClick={handleConfirmOrder}>Confirmar Orden</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Salida */}
        <ExitConfirmModal
          isOpen={showExitModal}
          onConfirmExit={handleConfirmExit}
          onCancel={() => setShowExitModal(false)}
        />
      </div>
    </div>
  );
}

export default App;
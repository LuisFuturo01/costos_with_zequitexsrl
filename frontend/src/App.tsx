import { useState, useEffect, FormEvent } from 'react';
import './assets/styles/App.scss';
import type { Config, TabMode, View, ProcessResult, User, Client } from './types';
import { api } from './services/api';

// Components
import { Header } from './components/layout/Header';
import { LoginView } from './components/views/LoginView';
import { ConfigView } from './components/views/ConfigView';
import { ResultTicket } from './components/ResultTicket'; 
import { UploadMode } from './components/modes/UploadMode';
import { CameraMode } from './components/modes/CameraMode';
import { ManualMode } from './components/modes/ManualMode';

// Modales UI
import { InputModal } from './components/ui/InputModal';
import { AlertModal } from './components/ui/AlertModal';

const BASTIDORES_DISPONIBLES = [
  { nombre: "10 cm", size: 10, corte: 0.15 },
  { nombre: "13 cm", size: 13, corte: 0.25 },
  { nombre: "16 cm", size: 16, corte: 0.35 },
  { nombre: "20 cm", size: 20, corte: 0.45 },
  { nombre: "31 cm", size: 31, corte: 0.65 }
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
  const [jobModal, setJobModal] = useState<{open: boolean, action: 'print'|'save'}>({open: false, action: 'save'});
  const [currentJobName, setCurrentJobName] = useState("Bordado Personalizado");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
      try {
          const cfg = await api.getConfig();
          setConfig(cfg);
          const cls = await api.getClients();
          setClients(cls);
      } catch (e) { console.error(e); }
  };

  const redondearAl05Superior = (valor: number) => {
    if (valor <= 0) return 0;
    const centavos = Math.round(valor * 100);
    return (Math.ceil(centavos / 5) * 5) / 100;
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
      } catch (e) { showAlert("Error", "Error creando cliente", "error"); }
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
      const precioUnitario = result.precio_sugerido || 0;
      const qty = manualQuantity;

      let discountPercent = 0;
      if (qty >= 501) discountPercent = 0.05;
      else if (qty >= 201) discountPercent = 0.04;
      else if (qty >= 101) discountPercent = 0.03;
      else if (qty >= 51) discountPercent = 0.02;

      const subtotal = precioUnitario * qty;
      const totalFinal = subtotal - (subtotal * discountPercent);

      const fullDataSnapshot = {
          breakdown: bd,
          mensaje: result.mensaje,
          imagen_procesada: result.imagen_procesada,
          descuento_aplicado: discountPercent,
          fecha_calculo: new Date().toISOString()
      };

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
          
          // NUEVO CAMPO:
          tiene_sublimacion: tieneSublimacion,

          cantidad: qty,
          precio_unitario: precioUnitario,
          precio_total: totalFinal,
          datos_json: JSON.stringify(fullDataSnapshot)
      };

      try {
          await api.saveOrder(orderPayload);
          showAlert("Éxito", "Cotización guardada correctamente.", "success");
      } catch (e: any) {
          showAlert("Error", "Error al guardar: " + e.message, "error");
      }
  };

  // 2. Ejecutar Impresión
  const executePrint = (name: string) => {
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
        const PRECIO_1000 = p.precio_stitch_1000;
        const PRECIO_COLOR = p.factor_cambio_hilo;
        
        // Factor base de pellón
        let FACTOR_PELLON = (p.costo_pellon ?? 300) / 1000000; 
        
        let stitches = apiData.estimatedStitches;
        if (stitches < 2000) stitches = 2000;

        const costoPuntadas = (stitches / 1000) * PRECIO_1000;
        const costoColores = apiData.numColors * PRECIO_COLOR;

        // Calcular área del diseño
        const w = apiData.dims?.width || 0;
        const h = apiData.dims?.height || 0;
        const areaDiseno = w * h;

        // Buscar bastidor adecuado basado en el área del diseño
        const bastidorObj = BASTIDORES_DISPONIBLES
          .slice()
          .sort((a, b) => a.size - b.size)
          .find(b => areaDiseno <= (b.size ** 2))
          ?? BASTIDORES_DISPONIBLES[BASTIDORES_DISPONIBLES.length - 1];

        const areaBastidorReal = bastidorObj.size ** 2;
        const bastidorNombre = bastidorObj.nombre;

        // Aplicar multiplicador según tamaño del bastidor
        if (areaBastidorReal <= 450) FACTOR_PELLON *= 3.8;
        else if (areaBastidorReal <= 900) FACTOR_PELLON *= 3.2;
        else if (areaBastidorReal <= 1600) FACTOR_PELLON *= 2.5;
        else FACTOR_PELLON *= 1.5;

        // Calcular costo de pellón y redondear a múltiplo de 0.05
        const costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
        const costoPellon = Math.ceil(costoPellonCalc / 0.05) * 0.05;

        // En modo upload/camera solo se calculan: puntadas, colores y pellón
        const total = costoPuntadas + costoColores + costoPellon;

        setResult({
          ...apiData,
          estimatedStitches: stitches,
          precio_sugerido: total,
          breakdown: { 
              puntadas: Number(costoPuntadas.toFixed(2)), 
              colores: Number(costoColores.toFixed(2)), 
              materiales: 0, 
              pellon: Number(costoPellon.toFixed(2)),
              hilos: 0, 
              base: 0, 
              corte: 0, 
              tela: 0,
              impresion: 0, // Sublimación solo aplica en modo manual
              bastidorNombre: bastidorNombre, 
              cantidadUnidades: 1
          },
          mensaje: `Bastidor: ${bastidorNombre}\nÁrea: ${areaBastidorReal} cm²`
        });
      } else { setResult(apiData); }
      setManualQuantity(1);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err: any) { showAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  const onManualEstimate = (res: ProcessResult, qty: number) => {
      setResult(res);
      setManualQuantity(qty);
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  // --- VISTA DE IMPRESIÓN ---
  if (isPrinting && result && config) {
      return (
        <ResultTicket 
            result={result} 
            config={config} 
            initialQuantity={manualQuantity} 
            clientName={getSelectedClientName()} 
            jobName={currentJobName}
            onPrintRequest={() => {}} 
        />
      );
  }

  // --- VISTAS NORMALES ---
  if (view === 'login') return <LoginView setView={setView} onLoginSuccess={(u)=>{setCurrentUser(u); setIsLoggedIn(true); setView('config');}} />;
  if (view === 'config' && isLoggedIn && config) return <ConfigView config={config} setConfig={setConfig} setView={setView} setIsLoggedIn={setIsLoggedIn} currentUser={currentUser} />;

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
                onPrintRequest={() => handleRequestAction('print')}
              />
              
              <div style={{marginTop: '1rem', textAlign: 'center', marginBottom: '2rem'}}>
                  <button 
                    className="btn-main" 
                    style={{backgroundColor: selectedClientId ? '#10b981' : '#9ca3af', width:'100%', maxWidth:400}} 
                    onClick={() => handleRequestAction('save')}
                    disabled={!selectedClientId}
                  >
                      {selectedClientId ? '💾 Guardar Cotización' : 'Selecciona un cliente para guardar'}
                  </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
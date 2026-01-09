import { useState, useEffect } from 'react';
import type { ProcessResult, Config } from '../../types';
import { api } from "../../services/api";

interface Props {
  onEstimate: (result: ProcessResult, quantity: number) => void;
}

interface QuizData {
  hasApplication: string;
  fabricType: string;
  hasSublimation: string;
  width: number;
  height: number;
  colors: number;
  stitches: number;
  quantity: number;
}

export const ManualMode = ({ onEstimate }: Props) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('next');
  const [appConfig, setAppConfig] = useState<Config | null>(null);

  const [data, setData] = useState<QuizData>({
    hasApplication: '',
    fabricType: '',
    hasSublimation: '',
    width: 0,
    height: 0,
    colors: 1,
    stitches: 0,
    quantity: 1
  });

  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const configData = await api.getConfig();
            setAppConfig(configData);
        } catch (error) {
            console.error("Error config:", error);
        }
    };
    fetchConfig();
  }, []);

  // BASTIDORES
  const BASTIDORES_LISTA = [
    { size: 10, name: "10 cm", corte: 0.10 },
    { size: 13, name: "13 cm", corte: 0.20 },
    { size: 16, name: "16 cm", corte: 0.30 },
    { size: 20, name: "20 cm", corte: 0.40 },
    { size: 31, name: "31 cm", corte: 0.50 }
  ];

  const questions = [
    { id: 1, type: 'choice', title: '¿Lleva Aplicación?', subtitle: 'Tela sobrepuesta', key: 'hasApplication', options: [{ label: 'No', value: 'No', icon: 'fas fa-times' }, { label: 'Si', value: 'Si', icon: 'fas fa-layer-group' }] },
    { id: 2, type: 'choice', title: 'Tipo de tela', subtitle: 'Sustrato base', key: 'fabricType', options: [{ label: 'Normal', value: 'Normal', icon: 'fas fa-tshirt' }, { label: 'Estructurante', value: 'Estructurante', icon: 'fas fa-hard-hat' }] },
    { id: 3, type: 'choice', title: '¿Sublimación?', subtitle: 'Impresión digital', key: 'hasSublimation', options: [{ label: 'No', value: 'No', icon: 'fas fa-tint-slash' }, { label: 'Si', value: 'Si', icon: 'fas fa-print' }] },
    { id: 4, type: 'dimensions', title: 'Dimensiones', subtitle: 'cm', inputs: ['width', 'height'] },
    { id: 5, type: 'number', title: 'Colores', subtitle: 'Cambios de hilo', key: 'colors', label: 'Nº Colores', min: 1 },
    { id: 6, type: 'number', title: 'Puntadas', subtitle: 'Opcional', key: 'stitches', label: 'Cantidad Puntadas', min: 0 },
    { id: 7, type: 'number', title: 'Producción', subtitle: 'Piezas', key: 'quantity', label: 'Unidades', min: 1 }
  ];

  const currentQuestion = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  const handleOptionClick = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
    setDirection('next');
    if (key === 'hasApplication' && value === 'No') setTimeout(() => setStep(3), 50);
    else setTimeout(() => setStep(s => s + 1), 50);
  };

  const handleInputChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    setData(prev => ({ ...prev, [key]: isNaN(numValue) ? 0 : numValue }));
  };

  const nextStep = () => step < questions.length - 1 ? (setDirection('next'), setTimeout(() => setStep(s => s + 1), 50)) : finishQuiz();
  const prevStep = () => {
    setDirection('prev');
    if (step === 4 && data.hasApplication === 'No') setStep(0);
    else setStep(s => s - 1);
  };

  const finishQuiz = () => {
    if (data.width <= 0 || data.height <= 0) {
      alert("⚠️ Medidas inválidas");
      setStep(3);
      return;
    }

    const areaDiseno = data.width * data.height;

    // 1. CONFIG
    const precios = appConfig?.pricing;
    const densidadConfig = appConfig?.stitch_density || 55;

    const PRECIO_1000_PUNTADAS = precios?.precio_stitch_1000 ?? 1.5;
    const PRECIO_CAMBIO_COLOR = precios?.factor_cambio_hilo ?? 1.0;
    
    // Pellón entre 1 millón (tu lógica)
    const FACTOR_PELLON = (precios?.costo_pellon ?? 300) / 1000000; 
    
    const PRECIO_TELA_NORMAL = precios?.tela_normal; 
    const PRECIO_TELA_ESTRUCT = precios?.tela_estructurante;
    const precioTelaCm2 = (data.fabricType === 'Estructurante' ? PRECIO_TELA_ESTRUCT : PRECIO_TELA_NORMAL)/15000;

    // 2. PUNTADAS
    let finalStitches = 0;
    if (data.stitches > 0) finalStitches = data.stitches;
    else finalStitches = Math.round(areaDiseno * densidadConfig * 1.1);
    if (finalStitches < 2000) finalStitches = 2000;

    // 3. BASTIDOR
    let bastidorObj = BASTIDORES_LISTA.find(b => areaDiseno <= (b.size * b.size));
    if (!bastidorObj) bastidorObj = BASTIDORES_LISTA[BASTIDORES_LISTA.length - 1];

    const areaBastidorReal = bastidorObj.size * bastidorObj.size;
    const bastidorNombre = bastidorObj.name;
    const precioServicioCorte = bastidorObj.corte;

    // 4. COSTOS
    const costoPuntadas = (finalStitches / 1000) * PRECIO_1000_PUNTADAS;
    const costoColores = data.colors * PRECIO_CAMBIO_COLOR;

    // Pellón
    let costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
    const costoPellon = Math.ceil(costoPellonCalc / 0.05) * 0.05;

    const costoTela = Number((areaDiseno * precioTelaCm2).toFixed(2));
    const costoCorte = (data.hasApplication === 'Si') ? precioServicioCorte : 0;

    // 5. TOTAL
    const precioTotal = costoPuntadas + costoColores + costoPellon + costoTela + costoCorte;
    const precioFinal = precioTotal;

    let mensaje = `Tela: ${data.fabricType}`;
    if (data.hasApplication === 'Si') mensaje += ' • Con Apliqué';
    if (data.hasSublimation === 'Si') mensaje += ' • Con Sublimación';

    // Log para verificar que enviamos cantidad
    console.log("Enviando Cantidad:", data.quantity);

    const manualResult: ProcessResult = {
      success: true,
      mensaje: mensaje,
      tenia_fondo: false,
      dims: { width: data.width, height: data.height },
      realArea: areaDiseno,
      colors: Array(data.colors).fill('#1A4533'),
      colorsDetailed: [],
      numColors: data.colors,
      imagen_procesada: '',
      estimatedStitches: finalStitches,
      precio_sugerido: precioFinal,
      
      breakdown: {
          puntadas: Number(costoPuntadas.toFixed(2)),
          colores: Number(costoColores.toFixed(2)),
          materiales: 0,
          base: 0,
          hilos: 0,
          tela: Number(costoTela.toFixed(2)),
          pellon: Number(costoPellon.toFixed(2)),
          corte: Number(costoCorte.toFixed(2)),
          bastidorNombre: bastidorNombre,
          
          // ESTA ES LA CLAVE: Enviamos la cantidad dentro del objeto
          cantidadUnidades: data.quantity 
      } as any
    };

    onEstimate(manualResult, data.quantity);
  };

  return (
    <div className="quiz-mode">
      <div className="progress-container"><div className="progress-bar" style={{ width: `${progress}%` }}></div></div>
      <div className="step-counter">Paso {step + 1} de {questions.length}</div>
      <div className={`quiz-card ${direction}`} key={step}>
        <h2 className="quiz-title">{currentQuestion.title}</h2>
        <p className="quiz-subtitle">{currentQuestion.subtitle}</p>
        <div className="quiz-content">
          {currentQuestion.type === 'choice' && currentQuestion.options && (
            <div className="options-grid">
              {currentQuestion.options.map((opt, idx) => (
                <button key={idx} className={`option-card ${data[currentQuestion.key as keyof QuizData] === opt.value ? 'selected' : ''}`} onClick={() => handleOptionClick(currentQuestion.key!, opt.value)}>
                  <div className="icon-circle"><i className={opt.icon}></i></div><span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
          {currentQuestion.type === 'dimensions' && (
            <div className="inputs-grid">
              <div className="input-group"><label>Ancho (cm)</label><input type="number" step="0.1" autoFocus value={data.width || ''} onChange={(e) => handleInputChange('width', e.target.value)} className="quiz-input" placeholder="0.0" /></div>
              <div className="input-group"><label>Alto (cm)</label><input type="number" step="0.1" value={data.height || ''} onChange={(e) => handleInputChange('height', e.target.value)} className="quiz-input" placeholder="0.0" /></div>
            </div>
          )}
          {currentQuestion.type === 'number' && (
            <div className="single-input-container"><label>{currentQuestion.label}</label><input type="number" min={currentQuestion.min} autoFocus value={data[currentQuestion.key as keyof QuizData] || ''} onChange={(e) => handleInputChange(currentQuestion.key!, e.target.value)} className="quiz-input big" /></div>
          )}
        </div>
        <div className="quiz-actions">
          {step > 0 && <button onClick={prevStep} className="btn-quiz-prev"><i className="fas fa-chevron-left"></i> Atrás</button>}
          {currentQuestion.type !== 'choice' && <button onClick={nextStep} className="btn-quiz-next">{step === questions.length - 1 ? 'Calcular' : 'Siguiente'} <i className="fas fa-chevron-right"></i></button>}
        </div>
      </div>
    </div>
  );
};
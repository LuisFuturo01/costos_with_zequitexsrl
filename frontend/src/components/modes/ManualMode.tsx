import { useState, useEffect } from 'react';
import type { ProcessResult, Config } from '../../types';
import { api } from "../../services/api";
import { AlertModal } from '../ui/AlertModal';

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
  const [alertModal, setAlertModal] = useState<{isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info'; onCloseAction?: () => void}>({isOpen: false, title: '', message: '', type: 'info'});

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info', onCloseAction?: () => void) => {
    setAlertModal({isOpen: true, title, message, type, onCloseAction});
  };

  const closeAlert = () => {
    const action = alertModal.onCloseAction;
    setAlertModal({isOpen: false, title: '', message: '', type: 'info'});
    if (action) action();
  };

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

  // BASTIDORES - ahora con tiempos en segundos
  const BASTIDORES_LISTA = [
    { size: 6.5,  name:  "9 cm", tiempoCorteSegundos: 3.53 },
    { size: 9.5,  name: "12 cm", tiempoCorteSegundos: 7.06 },
    { size: 12.5, name: "15 cm", tiempoCorteSegundos: 10.59 },
    { size: 15.5, name: "18 cm", tiempoCorteSegundos: 14.12 },
    { size: 27.5, name: "30 cm", tiempoCorteSegundos: 17.65 }
  ];

  const questions = [
    {
      id: 1,
      type: 'choice',
      title: '¿Lleva Aplicación?',
      subtitle: 'Tela sobrepuesta',
      key: 'hasApplication',
      options: [
        { label: 'Si', value: 'Si', icon: 'fas fa-layer-group' },
        { label: 'No', value: 'No', icon: 'fas fa-times' }
      ]
    },
    {
      id: 2,
      type: 'choice',
      title: 'Tipo de tela',
      subtitle: 'Sustrato base',
      key: 'fabricType',
      options: [
        { label: 'Normal', value: 'Normal', icon: 'fas fa-tshirt' },
        { label: 'Estructurante', value: 'Estructurante', icon: 'fas fa-hard-hat' }
      ]
    },
    {
      id: 3,
      type: 'choice',
      title: '¿Sublimación?',
      subtitle: 'Impresión digital',
      key: 'hasSublimation',
      options: [
        { label: 'Si', value: 'Si', icon: 'fas fa-print' },
        { label: 'No', value: 'No', icon: 'fas fa-tint-slash' }
      ]
    },
    { id: 4, type: 'dimensions', title: 'Dimensiones', subtitle: 'cm', inputs: ['width', 'height'] },
    { id: 5, type: 'number', title: 'Colores', subtitle: 'Cambios de hilo', key: 'colors', label: 'Nº Colores', min: 0 },
    { id: 6, type: 'number', title: 'Puntadas', subtitle: '', key: 'stitches', label: 'Cantidad Puntadas', min: 1 },
    { id: 7, type: 'number', title: 'Producción', subtitle: 'Piezas', key: 'quantity', label: 'Unidades', min: 0 }
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

  const isCurrentStepValid = (): boolean => {
    const q = currentQuestion;
    
    if (q.type === 'dimensions') {
      return data.width > 0 && data.height > 0;
    }
    
    if (q.type === 'number' && q.key) {
      const value = data[q.key as keyof QuizData];
      // Colores mínimo 1, puntadas mínimo 1, cantidad mínimo 1
      return typeof value === 'number' && value >= 1;
    }
    
    return true;
  };

  const nextStep = () => {
    if (!isCurrentStepValid()) {
      showAlert('Campo Obligatorio', 'Por favor complete el valor requerido antes de continuar.', 'error');
      return;
    }
    step < questions.length - 1 ? (setDirection('next'), setTimeout(() => setStep(s => s + 1), 50)) : finishQuiz();
  };
  
  const prevStep = () => {
    setDirection('prev');
    if (step === 4 && data.hasApplication === 'No') setStep(0);
    else setStep(s => s - 1);
  };

  const finishQuiz = () => {
    if (data.width <= 0 || data.height <= 0) {
      showAlert('Medidas Inválidas', 'Las dimensiones deben ser mayores a 0.', 'error', () => setStep(3));
      return;
    }
  const redondeoPrecio = (precio: number) => {
    return Math.ceil(precio*10)/10;
  };
    const areaDiseno = data.width * data.height;

    // 1. CONFIG
    const precios = appConfig?.pricing;
    const densidadConfig = appConfig?.stitch_density || 55;

    const PRECIO_1000_PUNTADAS = precios?.precio_stitch_1000 ?? 0;
    let PRECIO_CAMBIO_COLOR = precios?.factor_cambio_hilo ?? 0;
    const PRECIO_IMPRESION = precios?.costo_impresion ?? 0;
    const COSTO_ROLLO = precios?.rollo_papel ?? 0;
    const PRECIO_CORTE_POR_60_SEG = precios?.corte_impresion ?? 0;
    
    // Pellón
    let FACTOR_PELLON = (precios?.costo_pellon ?? 300) / 1000000; 
    
    const PRECIO_TELA_NORMAL = precios?.tela_normal ?? 0; 
    const PRECIO_TELA_ESTRUCT = precios?.tela_estructurante ?? 0;
    const precioTelaCm2 = (data.fabricType === 'Estructurante' ? PRECIO_TELA_ESTRUCT : PRECIO_TELA_NORMAL) / 15000;

    
    // 2. PUNTADAS
    let finalStitches = 0;
    if (data.stitches > 0) finalStitches = data.stitches;
    else finalStitches = Math.round(areaDiseno * densidadConfig * 1.1);

    // 3. BASTIDOR - CORREGIDO: Comparar dimensiones, no área
    const dimensionMaximaDiseno = Math.max(data.width, data.height);
    
    const bastidorObj =
      BASTIDORES_LISTA
        .slice()
        .sort((a, b) => a.size - b.size)
        .find(b => dimensionMaximaDiseno <= b.size)
      ?? BASTIDORES_LISTA[BASTIDORES_LISTA.length - 1];

    const areaBastidorReal = bastidorObj.size ** 2;
    const bastidorNombre = bastidorObj.name;
    const tiempoCorteSegundos = bastidorObj.tiempoCorteSegundos;

    // 4. COSTOS
    if(data.colors>1){
      PRECIO_CAMBIO_COLOR = PRECIO_CAMBIO_COLOR * (data.colors-1);
    }
    const costoPuntadas = redondeoPrecio((finalStitches) * ((PRECIO_1000_PUNTADAS+PRECIO_CAMBIO_COLOR)/1000));

    // Pellón
    if(areaBastidorReal<=42.25) FACTOR_PELLON *= 3.8;
    else if(areaBastidorReal<=90.25) FACTOR_PELLON *= 3.5;
    else if(areaBastidorReal<=156.25) FACTOR_PELLON *= 3.2;
    else if(areaBastidorReal<=240.25) FACTOR_PELLON *= 2.9;
    else if(areaBastidorReal<=756.25) FACTOR_PELLON *= 2.6;

    const costoPellonCalc = areaBastidorReal * FACTOR_PELLON;
    const costoPellon = redondeoPrecio(costoPellonCalc);

    // CORRECCIÓN 1: Tela solo si tiene aplicación
    let costoTela = 0;
    if (data.hasApplication === 'Si') {
      costoTela = Number((areaDiseno * precioTelaCm2).toFixed(2));
      if(data.fabricType === 'Estructurante') {
        if(areaBastidorReal<=42.25) costoTela *= 1.5;
        else if(areaBastidorReal<=90.25) costoTela *= 1.4;
        else if(areaBastidorReal<=156.25) costoTela *= 1.3;
        else if(areaBastidorReal<=240.25) costoTela *= 1.2;
        else if(areaBastidorReal<=756.25) costoTela *= 1.1;
      }
      else if(data.fabricType === 'Normal') {
        if(areaBastidorReal<=42.25) costoTela *= 1.5;
        else if(areaBastidorReal<=90.25) costoTela *= 1.4;
        else if(areaBastidorReal<=156.25) costoTela *= 1.3;
        else if(areaBastidorReal<=240.25) costoTela *= 1.2;
        else if(areaBastidorReal<=756.25) costoTela *= 1.1;
      }
    }
    costoTela = redondeoPrecio(costoTela);
    
    // CORRECCIÓN 2: Cálculo del precio de corte basado en tiempo
    // Formula: (tiempoCorteSegundos / 60) * PRECIO_CORTE_POR_60_SEG
    let costoCorte = 0;
    if (data.hasApplication === 'Si') {
      costoCorte = tiempoCorteSegundos  * (PRECIO_CORTE_POR_60_SEG/60);
      costoCorte = Number(costoCorte.toFixed(2));
    }

    // 5. IMPRESIÓN/SUBLIMACIÓN
    let costoImpresion = 0;

    if (data.hasSublimation === 'Si') {
      // Dimensiones del rollo
      const ROLLO_ANCHO_CM = 100;
      const ROLLO_LARGO_CM = 10000; // 100 metros
      const AREA_TOTAL_ROLLO = ROLLO_ANCHO_CM * ROLLO_LARGO_CM; // 1,000,000 cm²

      // Dimensiones del diseño
      const imgW = data.width;
      const imgH = data.height;
      const areaUnDesign = imgW * imgH;

      // Validación: El diseño debe caber en el ancho del rollo
      if (imgW > ROLLO_ANCHO_CM) {
        showAlert('Diseño Excede Rollo', `El ancho del diseño (${imgW} cm) excede el ancho del rollo (${ROLLO_ANCHO_CM} cm).`, 'error', () => setStep(3));
        return;
      }

      // 1️⃣ Calcular cuántas imágenes caben en UNA FILA (a lo ancho)
      const imagenesPorFila = Math.floor(ROLLO_ANCHO_CM / imgW);

      // 2️⃣ Calcular cuántas FILAS se necesitan para la cantidad total
      const filasNecesarias = Math.ceil(data.quantity / imagenesPorFila);

      // 3️⃣ Calcular cuánto LARGO de rollo se usará (se corta)
      const largoCortadoCm = filasNecesarias * imgH;

      // 4️⃣ Calcular el ÁREA REAL que se usa del rollo
      const areaUsadaRollo = largoCortadoCm * ROLLO_ANCHO_CM;

      // 5️⃣ Costo proporcional al papel cortado (regla de 3 simple)
      costoImpresion = (areaUsadaRollo / AREA_TOTAL_ROLLO) * COSTO_ROLLO;

      // Redondeo comercial
      costoImpresion = redondeoPrecio(costoImpresion);

      // Log para debugging
      console.log('📊 Cálculo de Sublimación:', {
        diseño: { ancho: imgW, alto: imgH, area: areaUnDesign },
        cantidad: data.quantity,
        distribucion: {
          imagenesPorFila,
          filasNecesarias,
          largoCortadoCm,
          areaUsadaRollo
        },
        costo: {
          calculado: ((areaUsadaRollo / AREA_TOTAL_ROLLO) * COSTO_ROLLO).toFixed(2),
          final: costoImpresion.toFixed(2)
        }
      });
    } else {
      console.log('❌ Sublimación NO marcada');
    }

    // 6. TOTAL CON AJUSTE DE CANTIDAD MÍNIMA
    const CANTIDAD_MINIMA = 6;
    const precioTotal = costoPuntadas + costoPellon + costoTela + costoCorte + costoImpresion;
    
    // Si la cantidad es menor a 6, calcular precio como si fueran 6 unidades
    let precioUnitarioReal = precioTotal;
    let precioUnitarioAjustado = precioTotal;
    
    if (data.quantity < CANTIDAD_MINIMA) {
      // El precio ajustado es el costo de hacer 6 unidades (se cobra lo mismo sin importar si pide 1, 2, 3, 4 o 5)
      precioUnitarioAjustado = precioTotal * CANTIDAD_MINIMA;
    }
    
    const precioFinal = precioUnitarioAjustado;

    let mensaje = `Tela: ${data.fabricType}`;
    if (data.hasApplication === 'Si') mensaje += ' • Con Apliqué';
    if (data.hasSublimation === 'Si') mensaje += ' • Con Sublimación';

    console.log("✅ Datos finales a enviar:", {
      cantidad: data.quantity,
      precioTotal: precioFinal.toFixed(2),
      precioUnitarioReal: precioUnitarioReal.toFixed(2),
      precioUnitarioAjustado: precioUnitarioAjustado.toFixed(2),
      costoTela: costoTela.toFixed(2),
      costoCorte: costoCorte.toFixed(2),
      tiempoCorteSegundos: tiempoCorteSegundos,
      costoImpresion: costoImpresion.toFixed(2),
      tieneAplicacion: data.hasApplication === 'Si',
      tieneSublimacion: data.hasSublimation === 'Si',
      seAplicoMinimo: data.quantity < CANTIDAD_MINIMA
    });

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
          colores: 0,
          materiales: 0,
          base: 0,
          hilos: 0,
          tela: Number(costoTela.toFixed(2)),
          pellon: Number(costoPellon.toFixed(2)),
          corte: Number(costoCorte.toFixed(2)),
          bastidorNombre: bastidorNombre,
          impresion: Number(costoImpresion.toFixed(2)),
          cantidadUnidades: data.quantity,
          precioUnitarioReal: Number(precioUnitarioReal.toFixed(2)),
          precioUnitarioAjustado: Number(precioUnitarioAjustado.toFixed(2))
      } as any
    };

    onEstimate(manualResult, data.quantity);
  };

  return (
    <div className="quiz-mode">
      <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={closeAlert} />
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
                  <div className="icon-circle"><span>{opt.label}</span></div>
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
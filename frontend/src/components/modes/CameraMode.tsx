import { useRef, useState, useEffect } from 'react';

interface Props {
  onCapture: (file: File) => void;
}

export const CameraMode = ({ onCapture }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  
  // NUEVO: Estados para controlar la dirección de la cámara
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Limpiar cámara al desmontar
  useEffect(() => {
    // Chequear si el dispositivo tiene más de una cámara
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(console.error);

    return () => {
      stopCamera();
    };
  }, []);

  // Función modificada para aceptar un modo específico (opcional)
  const startCamera = async (overrideMode?: 'environment' | 'user') => {
    setError('');
    const targetMode = overrideMode || facingMode;

    try {
      stopCamera(); // Aseguramos que se detenga la anterior antes de iniciar

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { exact: targetMode }, // Intentamos exacto primero
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      handleStreamSuccess(stream);
    } catch (err) {
      console.warn("Fallo intento exacto, probando configuración flexible...", err);
      
      // Fallback: si falla 'exact', intentamos sin 'exact' o configuración básica
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: targetMode // Sin 'exact'
          } 
        });
        handleStreamSuccess(stream);
      } catch (err2: any) {
        console.error("Error cámara:", err2);
        setError(`No se pudo acceder a la cámara (${targetMode}). Verifica permisos.`);
      }
    }
  };

  const handleStreamSuccess = (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // Promesa de play para móviles
      videoRef.current.play().catch(e => console.error("Error play:", e));
      setIsStreamActive(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreamActive(false);
    }
  };

  // NUEVO: Función para cambiar cámara
  const toggleCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode); // Iniciamos inmediatamente con el nuevo modo
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Si es la cámara frontal, invertimos la imagen (efecto espejo) para que se vea natural
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            onCapture(file);
            
            const previewUrl = URL.createObjectURL(blob);
            setCapturedImage(previewUrl);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(); // Vuelve a iniciar con el último modo usado
  };

  return (
    <div className="camera-mode-container">
      
      {error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)' }}>
          <p>{error}</p>
          <button className="btn-secondary" onClick={() => startCamera()}>Intentar de nuevo</button>
        </div>
      )}

      {capturedImage ? (
        <div className="capture-preview">
          <img src={capturedImage} alt="Captura" style={{width: '100%', borderRadius: 'var(--radius-md)'}} />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
            <button type="button" className="btn-secondary" onClick={handleRetake}>
              <img src="./src/assets/images/camera.svg" alt="" style={{ width: '20px', height: '20px' }}/> Tomar otra
            </button>
            <div style={{ padding: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="./src/assets/images/check.svg" alt="" style={{ width: '20px', height: '20px', border:'none' }}/> <p>Foto lista</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="camera-wrapper">
          {!isStreamActive && !error && (
            <div className="upload-area" onClick={() => startCamera()} style={{ minHeight: '300px' }}>
              <i className="fas fa-camera" style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--color-accent)' }}></i>
              <p>Toque para activar la cámara</p>
            </div>
          )}

          <div className="camera-module" style={{ display: isStreamActive ? 'block' : 'none', position: 'relative' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="camera-video"
              // Agregamos espejo CSS si es frontal para mejor UX
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            
            {isStreamActive && (
              <div className="camera-controls" style={{
                  position: 'absolute', 
                  bottom: '20px', 
                  left: 0, 
                  right: 0, 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '2rem'
              }}>
                 {/* BOTÓN DISPARADOR */}
                <button type="button" className="capture-btn" onClick={takePhoto} style={{
                    width: '60px', height: '60px', borderRadius: '50%', 
                    border: '4px solid white', backgroundColor: 'rgba(255,0,0,0.8)', color: 'white'
                }}>
                  <i className="fas fa-camera"></i>
                </button>

                {/* BOTÓN CAMBIO DE CÁMARA (Solo si hay múltiples) */}
                {hasMultipleCameras && (
                    <button type="button" onClick={toggleCamera} style={{
                        width: '45px', height: '45px', borderRadius: '50%', 
                        border: 'none', backgroundColor: 'rgba(255,255,255,0.3)', color: 'white',
                        fontSize: '1.2rem', cursor: 'pointer', backdropFilter: 'blur(4px)',
                        right: '20px',
                        bottom: '20px',
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img src="./src/assets/images/rotate.svg" alt="" style={{ width: '20px', height: '20px' }}/>
                    </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
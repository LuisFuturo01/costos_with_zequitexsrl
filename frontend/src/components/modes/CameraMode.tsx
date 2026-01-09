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

  // Limpiar cámara al desmontar el componente
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      // Intenta usar la cámara trasera (environment) si existe
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error("Error cámara:", err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
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

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Configurar dimensiones del canvas igual al video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dibujar foto
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convertir a Blob/File para enviar al padre
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            onCapture(file);
            
            // Generar preview visual
            const previewUrl = URL.createObjectURL(blob);
            setCapturedImage(previewUrl);
            stopCamera(); // Detenemos cámara para mostrar preview
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className="camera-mode-container">
      
      {/* 1. ESTADO DE ERROR */}
      {error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)' }}>
          <p>{error}</p>
          <button className="btn-secondary" onClick={startCamera}>Intentar de nuevo</button>
        </div>
      )}

      {/* 2. VISTA PREVIA DE LA CAPTURA */}
      {capturedImage ? (
        <div className="capture-preview">
          <img src={capturedImage} alt="Captura" style={{width: '100%', borderRadius: 'var(--radius-md)'}} />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={handleRetake}>
              📸 Tomar otra
            </button>
            {/* El botón de confirmar es el "Cotizar" del formulario padre, 
                así que aquí solo indicamos que ya está lista */}
            <div style={{ padding: '0.8rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
              ✅ Foto lista para cotizar
            </div>
          </div>
        </div>
      ) : (
        /* 3. VISTA DE CÁMARA EN VIVO */
        <div className="camera-wrapper">
          {!isStreamActive && !error && (
            <div className="upload-area" onClick={startCamera} style={{ minHeight: '300px' }}>
              <i className="fas fa-camera" style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--color-accent)' }}></i>
              <p>Toque para activar la cámara</p>
            </div>
          )}

          {/* El video siempre está renderizado pero oculto si no hay stream, para evitar errores de ref */}
          <div className="camera-module" style={{ display: isStreamActive ? 'block' : 'none' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="camera-video"
              onLoadedMetadata={() => {
                  // Asegurar play en algunos móviles
                  videoRef.current?.play().catch(console.error);
              }}
            />
            
            {isStreamActive && (
              <button type="button" className="capture-btn" onClick={takePhoto}>
                <i className="fas fa-camera"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas oculto para procesar la imagen */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
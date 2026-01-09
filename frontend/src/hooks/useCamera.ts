import { useState, useRef } from 'react';

export const useCamera = () => {
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setActive(true);
      }
    } catch (err) {
      alert('Error al acceder a la cámara: ' + err);
    }
  };

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setActive(false);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setPreview(URL.createObjectURL(blob));
          stop();
        }
      }, 'image/png');
    }
  };

  const reset = () => {
    setCapturedBlob(null);
    setPreview('');
    start();
  };

  return {
    active,
    preview,
    capturedBlob,
    videoRef,
    canvasRef,
    start,
    stop,
    capture,
    reset
  };
};
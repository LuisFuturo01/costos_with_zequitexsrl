import { useEffect } from 'react';
// Iconos SVG
import warningIcon from '../../assets/images/warning.svg';

interface Props {
  isOpen: boolean;
  onConfirmExit: () => void;
  onCancel: () => void;
}

export const ExitConfirmModal = ({ isOpen, onConfirmExit, onCancel }: Props) => {
  // Manejar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><img src={warningIcon} className="icono-img icono-warning icono-xxl icono-no-margin" alt="advertencia" /></div>
        <h3 style={{ color: '#f59e0b', marginBottom: '0.75rem' }}>¿Seguro de salir?</h3>
        <p style={{ color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Los datos no guardados se perderán. <br/>
          Asegúrate de guardar tu cotización antes de salir.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button 
            className="btn-secondary" 
            onClick={onCancel}
            style={{ minWidth: '120px' }}
          >
            Cancelar
          </button>
          <button 
            className="btn-main" 
            onClick={onConfirmExit}
            style={{ 
              minWidth: '120px',
              background: '#ef4444',
              borderColor: '#ef4444'
            }}
          >
            Salir sin Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

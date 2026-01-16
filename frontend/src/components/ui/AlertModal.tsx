interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export const AlertModal = ({ isOpen, title, message, type = 'info', onClose }: Props) => {
  if (!isOpen) return null;
  
  // Colores según tu paleta
  const color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#F2C029';

  return (
    <div className="modal-overlay" style={{zIndex: 3001}}>
      <div className="modal-card" style={{maxWidth: '350px', textAlign: 'center'}}>
        <h3 style={{color: color, marginBottom: '0.5rem'}}>{title}</h3>
        <p style={{marginBottom: '1.5rem', color: '#000000ff!important'}}>{message}</p>
        <button className="btn-main" onClick={onClose} style={{width: '100%'}}>Entendido</button>
      </div>
    </div>
  );
};
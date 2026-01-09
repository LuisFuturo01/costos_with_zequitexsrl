import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  onClose: () => void;
  onAccept: (value: string) => void;
}

export const InputModal = ({ isOpen, title, initialValue = "", placeholder, onClose, onAccept }: Props) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{zIndex: 3000}}>
      <div className="modal-card" style={{maxWidth: '400px'}}>
        <h3 style={{marginBottom: '1rem', color: '#F2C029'}}>{title}</h3>
        <input 
          type="text" 
          className="styled-input"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onAccept(value);
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="modal-actions" style={{marginTop: '1.5rem'}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button 
            className="btn-main" 
            onClick={() => onAccept(value)}
            disabled={!value.trim()}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
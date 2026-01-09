import { useRef, useState } from 'react';

interface Props {
  onFileSelect: (file: File) => void;
}

export const UploadMode = ({ onFileSelect }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      onFileSelect(file);
    }
  };

  return (
    <div className="upload-mode">
      <label className="input-label">DISEÑO A BORDAR</label>
      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
        <input 
          ref={fileInputRef} type="file" accept="image/*" 
          onChange={handleChange} style={{ display: 'none' }} 
        />
        {preview ? (
          <img src={preview} alt="Preview" className="preview-img" />
        ) : (
          <>
            <div className="upload-icon"><i className="fas fa-image"></i></div>
            <div className="upload-text">Toca para seleccionar</div>
          </>
        )}
      </div>
    </div>
  );
};
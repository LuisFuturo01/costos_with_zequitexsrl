import type { View } from '../../types';

interface HeaderProps {
  setView: (view: View) => void;
}

export const Header = ({ setView }: HeaderProps) => {
  return (
    <div className="header-wrapper"> {/* Contenedor para centrar el bloque */}
      <header className="header-card">
        
        {/* Bloque Izquierdo: Logo y Título */}
        <div className="brand-group">
          <div className="logo-box" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="/background-logo.webp" alt="" style={{ width: '100%', height: '100%'}} /></div>
          <div className="brand-text">
            <h1>ZEQUITEX <span>SRL</span></h1>
            <p>Servicios de Bordado Profesional</p>
          </div>
        </div>

        {/* Bloque Derecho: Botón */}
        <button 
          className="settings-btn" 
          onClick={() => setView('login')}
          title="Configuraciones"
        >
          <i className="fas fa-cog" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><img src="./src/assets/images/setting.svg" alt="hola" style={{ width: '100%', height: '100%'}} /></i>
        </button>

      </header>
    </div>
  );
};
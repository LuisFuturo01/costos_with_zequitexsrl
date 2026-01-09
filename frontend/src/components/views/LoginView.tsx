import { useState, FormEvent } from 'react';
import { api } from '../../services/api';
import type { View, User } from '../../types';

interface Props {
  setView: (view: View) => void;
  onLoginSuccess: (user: User) => void; // Actualizamos para pasar el usuario al padre
}

export const LoginView = ({ setView, onLoginSuccess }: Props) => {
  const [username, setUsername] = useState(''); // Nuevo estado
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Pasamos username y password
      const data = await api.login(username, password);
      
      if (data.success && data.user) {
        onLoginSuccess(data.user); // Enviamos los datos del usuario arriba
      } else {
        setError(data.message || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app login-view">
      <div className="login-container">
        <div className="login-card">
          <div className="login-icon">
            <i className="fas fa-user-shield"></i>
          </div>
          <h2>Acceso Administrativo</h2>
          
          <form onSubmit={handleSubmit}>
            {/* CAMPO DE USUARIO NUEVO */}
            <div className="input-group">
                <label>Usuario</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: admin" 
                  className="styled-input" 
                  autoFocus
                  required
                />
            </div>

            <div className="input-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="styled-input" 
                  required
                />
            </div>
            
            {error && <div className="error-message" style={{color: 'red', margin: '10px 0'}}>{error}</div>}
            
            <button type="submit" className="btn-main" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            
            <button type="button" className="btn-secondary" onClick={() => setView('main')}>
              Cancelar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
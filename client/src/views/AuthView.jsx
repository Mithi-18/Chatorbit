import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

export default function AuthView({ isRegister }) {
  const navigate = useNavigate();
  const { setUser, setToken } = useStore();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const url = isRegister ? 'http://localhost:5000/auth/register' : 'http://localhost:5000/auth/login';
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      if (isRegister) {
        navigate('/login');
      } else {
        setToken(data.token);
        setUser(data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h1 className="auth-header">
        {isRegister ? 'Join Chatorbit' : 'Welcome Back'}
      </h1>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Name" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
        )}
        <div className="input-group">
          <input 
            type="email" 
            placeholder="Email" 
            value={formData.email} 
            onChange={e => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        <div className="input-group">
          <input 
            type="password" 
            placeholder="Password" 
            value={formData.password} 
            onChange={e => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        {error && <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" className="btn-primary">
          {isRegister ? 'Sign Up' : 'Login'}
        </button>
      </form>
      <p className="text-link" onClick={() => navigate(isRegister ? '/login' : '/register')}>
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Sign up"}
      </p>
    </div>
  );
}

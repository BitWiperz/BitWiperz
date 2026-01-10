import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import './Login.css';

// Password validation helper - must match backend requirements
const validatePassword = (pwd: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (pwd.length < 8) {
    errors.push('Minimum 8 characters');
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push('At least one uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(pwd)) {
    errors.push('At least one lowercase letter (a-z)');
  }
  if (!/\d/.test(pwd)) {
    errors.push('At least one digit (0-9)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword;
  const isFormValid = password.length > 0 && passwordValidation.isValid && passwordsMatch && email.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValidation.isValid) {
      setError(`Password must contain: ${passwordValidation.errors.join(', ')}`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authService.register({ email, password, name });
      // After successful registration, automatically log in
      await authService.login({ email, password });
      navigate('/devices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">BitWiperz</h1>
        <h2 className="auth-subtitle">Register</h2>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name (optional)"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
              {password && (
                <span style={{ marginLeft: '8px', fontSize: '0.85em', color: passwordValidation.isValid ? '#4caf50' : '#f44336' }}>
                  {passwordValidation.isValid ? '✓ Valid' : '✗ Invalid'}
                </span>
              )}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={loading}
              minLength={8}
            />
            {password && !passwordValidation.isValid && (
              <div style={{ fontSize: '0.85em', color: '#f44336', marginTop: '4px' }}>
                <p style={{ margin: '4px 0' }}>Password requirements:</p>
                <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                  {passwordValidation.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password
              {confirmPassword && (
                <span style={{ marginLeft: '8px', fontSize: '0.85em', color: passwordsMatch ? '#4caf50' : '#f44336' }}>
                  {passwordsMatch ? '✓ Match' : '✗ No match'}
                </span>
              )}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm your password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading || !isFormValid}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

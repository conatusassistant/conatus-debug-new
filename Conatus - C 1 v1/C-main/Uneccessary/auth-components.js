// src/pages/auth/SignupPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { signUp, signInWithProvider, clearError } from '../../store/auth';
import './AuthPages.css';

const SignupPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { error, loading } = useSelector(state => state.auth);
  
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [validationError, setValidationError] = useState('');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    
    // Clear any previous errors
    if (error) {
      dispatch(clearError());
    }
    setValidationError('');
  };
  
  const validateForm = () => {
    if (credentials.password.length < 8) {
      setValidationError('Password must be at least 8 characters long');
      return false;
    }
    
    if (credentials.password !== credentials.confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await dispatch(signUp({
        email: credentials.email,
        password: credentials.password
      })).unwrap();
      
      navigate('/');
    } catch (error) {
      // Error is handled in the reducer
    }
  };
  
  const handleProviderSignIn = (provider) => {
    dispatch(signInWithProvider(provider));
  };
  
  return (
    <div className="auth-page signup-page">
      <h2>Create Account</h2>
      
      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}
      
      {validationError && (
        <div className="auth-error">
          {validationError}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={credentials.email}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            required
          />
          <small>Must be at least 8 characters long</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            value={credentials.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>
      
      <div className="auth-divider">
        <span>Or</span>
      </div>
      
      <div className="social-auth-buttons">
        <button
          type="button"
          className="social-button google-button"
          onClick={() => handleProviderSignIn('google')}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.75 12C17.75 11.31 17.67 10.63 17.53 10H12V12.75H15.38C15.16 13.75 14.5 14.59 13.57 15.13V17.25H16.19C17.82 15.75 18.64 13.4 17.75 12Z" fill="#4285F4"/><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 8.5C13.24 8.5 14.36 9.07 15.19 9.91L16.91 8.19C15.45 6.73 13.35 6 12 6C9.27 6 6.91 7.65 5.74 10.07L7.76 11.69C8.28 9.85 9.98 8.5 12 8.5Z" fill="#EA4335"/><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 19.5C9.66 19.5 6.91 18.31 5.48 16.35L7.5 14.73C8.5 16.21 10.12 17 12 17C13.88 17 15.5 16.21 16.5 14.73L18.52 16.35C17.09 18.31 14.34 19.5 12 19.5Z" fill="#34A853"/><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM5.74 10.07C5.27 10.95 5 11.95 5 13C5 14.05 5.27 15.05 5.74 15.93L3.72 17.55C2.64 16.11 2 14.11 2 12C2 9.89 2.64 7.89 3.72 6.45L5.74 8.07C5.27 8.95 5 9.95 5 11V12C5 11.62 5.03 11.24 5.07 10.89L5.74 10.07Z" fill="#FBBC05"/></svg>
          Continue with Google
        </button>
        
        <button
          type="button"
          className="social-button apple-button"
          onClick={() => handleProviderSignIn('apple')}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M17.6 13.8C17.4 14.4 17.1 15 16.8 15.5C16.4 16.2 16 16.8 15.6 17.3C15 18 14.4 18.3 13.7 18.3C13.2 18.3 12.6 18.2 12 17.8C11.4 17.5 10.9 17.3 10.4 17.3C9.9 17.3 9.4 17.5 8.7 17.8C8.1 18.2 7.6 18.3 7.1 18.3C6.3 18.3 5.7 18 4.9 17.3C4.5 16.8 4 16.2 3.7 15.5C3.2 14.7 3 13.9 3 13.1C3 12.2 3.3 11.4 3.8 10.7C4.2 10.2 4.7 9.8 5.3 9.5C5.9 9.2 6.6 9.1 7.3 9.1C7.9 9.1 8.5 9.3 9.2 9.6C9.8 9.9 10.3 10 10.6 10C10.8 10 11.4 9.9 12.1 9.5C12.7 9.2 13.4 9 14.1 9.1C15.7 9.2 16.9 9.8 17.6 10.9C16.2 11.7 15.5 12.9 15.6 14.4C15.7 15.5 16.2 16.4 17.6 13.8Z M14.1 3.5C14.1 4.4 13.8 5.2 13.3 6C12.7 6.8 11.9 7.3 11.2 7.2C11.2 6.3 11.5 5.4 12 4.7C12.2 4.3 12.6 3.9 13 3.6C13.4 3.3 13.8 3.1 14.1 3H14.1V3.5Z" fill="currentColor"/></svg>
          Continue with Apple
        </button>
      </div>
      
      <div className="auth-footer-links">
        <p>
          Already have an account? <Link to="/login" className="text-link">Log In</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

// src/pages/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { resetPassword, clearError } from '../../store/auth';
import './AuthPages.css';

const ForgotPasswordPage = () => {
  const dispatch = useDispatch();
  const { error, loading } = useSelector(state => state.auth);
  
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const handleChange = (e) => {
    setEmail(e.target.value);
    
    // Clear any previous errors
    if (error) {
      dispatch(clearError());
    }
    setSuccessMessage('');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await dispatch(resetPassword(email)).unwrap();
      setSuccessMessage(`Password reset instructions have been sent to ${email}`);
    } catch (error) {
      // Error is handled in the reducer
    }
  };
  
  return (
    <div className="auth-page forgot-password-page">
      <h2>Reset Password</h2>
      
      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="auth-success">
          {successMessage}
        </div>
      )}
      
      <p className="auth-description">
        Enter your email address and we'll send you instructions to reset your password.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={loading || successMessage}
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </div>
      </form>
      
      <div className="auth-footer-links">
        <p>
          <Link to="/login" className="text-link">
            Back to Log In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

// src/pages/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { updatePassword, clearError } from '../../store/auth';
import './AuthPages.css';

const ResetPasswordPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { error, loading } = useSelector(state => state.auth);
  
  const [passwords, setPasswords] = useState({
    password: '',
    confirmPassword: ''
  });
  
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Check if we have a reset token in the URL
  useEffect(() => {
    const hash = location.hash;
    if (!hash || !hash.includes('type=recovery')) {
      setValidationError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [location]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
    
    // Clear any previous errors
    if (error) {
      dispatch(clearError());
    }
    setValidationError('');
  };
  
  const validateForm = () => {
    if (passwords.password.length < 8) {
      setValidationError('Password must be at least 8 characters long');
      return false;
    }
    
    if (passwords.password !== passwords.confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await dispatch(updatePassword(passwords.password)).unwrap();
      setSuccessMessage('Your password has been reset successfully.');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      // Error is handled in the reducer
    }
  };
  
  return (
    <div className="auth-page reset-password-page">
      <h2>Set New Password</h2>
      
      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}
      
      {validationError && (
        <div className="auth-error">
          {validationError}
        </div>
      )}
      
      {successMessage && (
        <div className="auth-success">
          {successMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={passwords.password}
            onChange={handleChange}
            required
            autoFocus
            disabled={!!validationError || !!successMessage}
          />
          <small>Must be at least 8 characters long</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            value={passwords.confirmPassword}
            onChange={handleChange}
            required
            disabled={!!validationError || !!successMessage}
          />
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={loading || !!validationError || !!successMessage}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
      
      <div className="auth-footer-links">
        <p>
          <Link to="/login" className="text-link">
            Back to Log In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

// src/components/common/LoadingScreen.jsx
import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;

// src/components/common/LoadingScreen.css
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  display: inline-block;
  position: relative;
  width: 60px;
  height: 60px;
}

.spinner {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 48px;
  height: 48px;
  margin: 6px;
  border: 6px solid #3b82f6;
  border-radius: 50%;
  animation: spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: #3b82f6 transparent transparent transparent;
}

@keyframes spinner {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-message {
  margin-top: 1.5rem;
  font-size: 1.2rem;
  color: #333;
}

// src/pages/auth/AuthPages.css
.auth-page {
  max-width: 400px;
  width: 100%;
}

.auth-page h2 {
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  text-align: center;
  color: #333;
}

.auth-description {
  margin-bottom: 1.5rem;
  color: #666;
  text-align: center;
}

.auth-error {
  background-color: #fee2e2;
  border-left: 4px solid #ef4444;
  color: #b91c1c;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0.25rem;
}

.auth-success {
  background-color: #dcfce7;
  border-left: 4px solid #22c55e;
  color: #166534;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0.25rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #4b5563;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #3b82f6;
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group small {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
}

.primary-button {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.25rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary-button:hover {
  background-color: #2563eb;
}

.primary-button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.text-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.text-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.auth-divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: #6b7280;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e5e7eb;
}

.auth-divider span {
  padding: 0 0.75rem;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 500;
}

.social-auth-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.social-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background-color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.social-button svg {
  margin-right: 0.75rem;
}

.google-button:hover {
  background-color: #f9fafb;
}

.apple-button {
  background-color: #000;
  color: white;
  border-color: #000;
}

.apple-button:hover {
  background-color: #333;
}

.auth-footer-links {
  margin-top: 1.5rem;
  text-align: center;
}

// src/components/layouts/MainLayout.css
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 10;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3b82f6;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.app-nav a {
  color: #4b5563;
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.app-nav a:hover {
  color: #3b82f6;
  background-color: #f3f4f6;
}

.app-nav a.active {
  color: #3b82f6;
  font-weight: 500;
}

.sign-out-button {
  background-color: transparent;
  border: 1px solid #d1d5db;
  color: #4b5563;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: all 0.2s;
}

.sign-out-button:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.app-main {
  flex: 1;
  padding: 1rem;
  background-color: #f9fafb;
}

.mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #4b5563;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Mobile styles */
@media (max-width: 768px) {
  .app-header {
    padding: 1rem;
  }
  
  .mobile-menu-toggle {
    display: block;
  }
  
  .app-nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background-color: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    gap: 1rem;
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s;
  }
  
  .app-nav.mobile-open {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }
  
  .app-nav a, 
  .sign-out-button {
    width: 100%;
    text-align: center;
  }
}

// src/components/layouts/AuthLayout.css
.auth-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  background-color: #f9fafb;
}

.auth-logo {
  margin-bottom: 2rem;
}

.auth-logo h1 {
  font-size: 2.5rem;
  color: #3b82f6;
  margin: 0;
}

.auth-logo a {
  text-decoration: none;
}

.auth-card {
  width: 100%;
  max-width: 450px;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.auth-footer {
  margin-top: 2rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 1.5rem;
  }
}

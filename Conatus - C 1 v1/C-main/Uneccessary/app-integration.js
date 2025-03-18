// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getUser } from './store/auth';
import realtimeService from './services/realtime/realtimeService';

// Layout components
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Main app pages
import HomePage from './pages/home/HomePage';
import LibraryPage from './pages/library/LibraryPage';
import SocialPage from './pages/social/SocialPage';
import SettingsPage from './pages/settings/SettingsPage';

// Automation pages
import AutomationDetailsPage from './pages/library/AutomationDetailsPage';
import CreateAutomationPage from './pages/library/CreateAutomationPage';
import EditAutomationPage from './pages/library/EditAutomationPage';

// Error pages
import NotFoundPage from './pages/errors/NotFoundPage';

// Utility components
import LoadingScreen from './components/common/LoadingScreen';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  const dispatch = useDispatch();
  const { user, loading } = useSelector(state => state.auth);
  
  useEffect(() => {
    // Load user data when app initializes
    dispatch(getUser());
    
    // Initialize realtime service
    realtimeService.init();
    
    // Clean up on unmount
    return () => {
      realtimeService.cleanup();
    };
  }, [dispatch]);
  
  // Show loading screen while checking authentication
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <Router>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/signup" element={user ? <Navigate to="/" /> : <SignupPage />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPasswordPage />} />
          <Route path="/reset-password" element={user ? <Navigate to="/" /> : <ResetPasswordPage />} />
        </Route>
        
        {/* Protected app routes */}
        <Route element={<ProtectedRoute user={user}><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/create" element={<CreateAutomationPage />} />
          <Route path="/library/:automationId" element={<AutomationDetailsPage />} />
          <Route path="/library/:automationId/edit" element={<EditAutomationPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        
        {/* Error routes */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;

// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

// src/components/common/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ user, children }) => {
  const location = useLocation();
  
  if (!user) {
    // Redirect to login page, but save the location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

export default ProtectedRoute;

// src/components/layouts/MainLayout.jsx
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { signOut } from '../../store/auth';
import './MainLayout.css';

const MainLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const handleSignOut = async () => {
    await dispatch(signOut());
    navigate('/login');
  };
  
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo">Conatus</div>
        
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="sr-only">Menu</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
        
        <nav className={`app-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/social">Social</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <button onClick={handleSignOut} className="sign-out-button">Sign Out</button>
        </nav>
      </header>
      
      {/* Main content */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;

// src/components/layouts/AuthLayout.jsx
import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import './AuthLayout.css';

const AuthLayout = () => {
  return (
    <div className="auth-container">
      <div className="auth-logo">
        <Link to="/">
          <h1>Conatus</h1>
        </Link>
      </div>
      
      <div className="auth-card">
        <Outlet />
      </div>
      
      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} Conatus. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AuthLayout;

// src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { signIn, signInWithProvider, clearError } from '../../store/auth';
import './AuthPages.css';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { error, loading } = useSelector(state => state.auth);
  
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  
  // Get the page they were trying to access
  const from = location.state?.from?.pathname || '/';
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    
    // Clear any previous errors
    if (error) {
      dispatch(clearError());
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await dispatch(signIn(credentials)).unwrap();
      navigate(from, { replace: true });
    } catch (error) {
      // Error is handled in the reducer
    }
  };
  
  const handleProviderSignIn = (provider) => {
    dispatch(signInWithProvider(provider));
  };
  
  return (
    <div className="auth-page login-page">
      <h2>Log In</h2>
      
      {error && (
        <div className="auth-error">
          {error}
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
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          
          <Link to="/forgot-password" className="text-link">
            Forgot password?
          </Link>
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
          Don't have an account? <Link to="/signup" className="text-link">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

// src/pages/home/HomePage.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchConversations, 
  createConversation,
  setCurrentConversation,
  streamResponse
} from '../../store/conversations';
import './HomePage.css';

const HomePage = () => {
  const dispatch = useDispatch();
  const { 
    conversations, 
    currentConversation,
    messages,
    loading 
  } = useSelector(state => state.conversations);
  
  const [query, setQuery] = useState('');
  
  // Fetch conversations on component mount
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);
  
  // Set current conversation if none is selected
  useEffect(() => {
    if (!currentConversation && conversations.length > 0) {
      dispatch(setCurrentConversation(conversations[0].id));
    }
  }, [dispatch, currentConversation, conversations]);
  
  // Handle new conversation
  const handleNewConversation = async () => {
    await dispatch(createConversation('New Conversation'));
  };
  
  // Handle selecting a conversation
  const handleSelectConversation = (conversationId) => {
    dispatch(setCurrentConversation(conversationId));
  };
  
  // Handle sending a query
  const handleSendQuery = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Create conversation if none exists
    let targetConversationId = currentConversation;
    if (!targetConversationId) {
      const result = await dispatch(createConversation('New Conversation')).unwrap();
      targetConversationId = result.id;
    }
    
    // Dispatch streaming query
    dispatch(streamResponse({
      query,
      conversationId: targetConversationId
    }));
    
    // Clear input
    setQuery('');
  };
  
  // Get current conversation messages
  const currentMessages = currentConversation && messages[currentConversation] 
    ? messages[currentConversation] 
    : [];
  
  return (
    <div className="home-page">
      <div className="conversations-sidebar">
        <button 
          className="new-conversation-button"
          onClick={handleNewConversation}
        >
          New Conversation
        </button>
        
        <div className="conversations-list">
          {conversations.map(conversation => (
            <div 
              key={conversation.id}
              className={`conversation-item ${currentConversation === conversation.id ? 'active' : ''}`}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <h3>{conversation.title}</h3>
              <p className="conversation-preview">
                {/* Show the last message content or a placeholder */}
                {messages[conversation.id]?.length > 0
                  ? messages[conversation.id][messages[conversation.id].length - 1].content.substring(0, 40) + '...'
                  : 'Start a new conversation...'}
              </p>
            </div>
          ))}
          
          {conversations.length === 0 && !loading && (
            <div className="empty-state">
              <p>No conversations yet. Start a new one!</p>
            </div>
          )}
          
          {loading && (
            <div className="loading-state">
              <p>Loading conversations...</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="chat-container">
        <div className="messages-container">
          {currentMessages.map(message => (
            <div 
              key={message.id}
              className={`message ${message.role}`}
            >
              <div className="message-content">
                {message.content}
                {message.loading && <span className="typing-indicator">...</span>}
              </div>
              {message.provider && (
                <div className="message-provider">
                  Powered by {message.provider}
                </div>
              )}
            </div>
          ))}
          
          {currentMessages.length === 0 && (
            <div className="empty-chat">
              <h2>How can I help you today?</h2>
              <p>Ask me anything and I'll use the best AI to help you.</p>
            </div>
          )}
        </div>
        
        <form className="query-form" onSubmit={handleSendQuery}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask me anything..."
            disabled={loading}
          />
          <button 
            type="submit"
            disabled={!query.trim() || loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default HomePage;

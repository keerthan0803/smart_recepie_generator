import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './HomePage';
import '../stylesheets/App.css';

function App() {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    // Get customer info from localStorage
    const name = localStorage.getItem('customerName');
    const id = localStorage.getItem('customerId');
    
    if (name) setCustomerName(name);
    if (id) setCustomerId(id);
    const c = parseInt(localStorage.getItem('customerCredits') || '0', 10);
    if (!isNaN(c)) setCredits(c);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('customerId');
    localStorage.removeItem('customerName');
    localStorage.removeItem('customerEmail');
    setCustomerName('');
    setCustomerId('');
    window.location.href = '/signin';
  };

  return (
    <Router>
      <div className="app">
        <nav className="app-navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-brand">
              <span className="brand-icon">🍳</span>
              <span className="brand-name">Smart Recipe Generator</span>
            </Link>
            
            <div className="navbar-menu">
              <Link to="/" className="nav-link">
                <span className="nav-icon">🏠</span>
                Home
              </Link>
              <a href="/chatbot" className="nav-link">
                <span className="nav-icon">💬</span>
                AI Chat
              </a>
              
              {customerName ? (
                <div className="user-menu">
                  <span className="user-greeting">
                    <span className="user-icon">👨‍🍳</span>
                    {customerName}
                  </span>
                  <span className="credits-badge" title="Available credits">💰 {credits}</span>
                  <button onClick={handleLogout} className="logout-btn">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="auth-links">
                  <a href="/signin" className="nav-link">Sign In</a>
                  <a href="/signup" className="nav-link signup-btn">Sign Up</a>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="app-content">
          <Routes>
            <Route path="/" element={<HomePage customerName={customerName} customerId={customerId} />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; 2025 Smart Recipe Generator. Made with ❤️ for food lovers.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import ChatBot from './ChatBot';
import '../stylesheets/ChatBotFullScreen.css';

const ChatBotFullScreen = () => {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get customer info from localStorage
    const id = localStorage.getItem('customerId');
    const name = localStorage.getItem('customerName');
    
    if (!id) {
      // Redirect to sign-in if not logged in
      window.location.href = '/signin';
      return;
    }
    
    setCustomerId(id);
    setCustomerName(name || 'User');
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading your chat...</p>
      </div>
    );
  }

  return (
    <div className="chatbot-fullscreen-container">
      <ChatBot customerId={customerId} customerName={customerName} />
    </div>
  );
};

export default ChatBotFullScreen;

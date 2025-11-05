import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../stylesheets/ChatBot.css';

const ChatBot = ({ customerId: propCustomerId, customerName: propCustomerName }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const messagesEndRef = useRef(null);

  // Get customer info from props or localStorage
  const customerId = propCustomerId || localStorage.getItem('customerId');
  const customerName = propCustomerName || localStorage.getItem('customerName');

  useEffect(() => {
    // Check if we have a customer ID (from props or localStorage)
    if (!customerId) {
      // Give a moment for localStorage to be checked
      const timer = setTimeout(() => {
        if (!localStorage.getItem('customerId')) {
          window.location.href = '/signin';
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    // Load chat sessions
    loadChatSessions();
  }, [customerId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatSessions = async () => {
    if (!customerId) return;

    try {
      const response = await axios.get(`/api/customer/${customerId}/sessions`);
      if (response.data.success) {
        const sessions = response.data.sessions;
        setChatSessions(sessions);
        
        // If there are existing sessions, load the most recent one
        if (sessions.length > 0) {
          loadSession(sessions[0].sessionId, sessions[0].title);
        } else {
          // Create a new session for first-time users
          createNewChat();
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      // If error, create a new session
      createNewChat();
    }
  };

  const loadSession = async (sessionId, title) => {
    setIsLoading(true);
    setCurrentSessionId(sessionId);
    setSessionTitle(title);
    
    try {
      const response = await axios.get(`/api/customer/${customerId}/sessions/${sessionId}/messages`);
      if (response.data.success) {
        const sessionMessages = response.data.messages;
        setMessages(sessionMessages.map(msg => ({
          sender: msg.sender,
          message: msg.message,
          timestamp: new Date(msg.timestamp),
          recipeGenerated: msg.recipeGenerated,
          recipeId: msg.recipeId
        })));
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
    } finally {
      setIsLoading(false);
      setShowHistory(false);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await axios.post(`/api/customer/${customerId}/sessions`);
      if (response.data.success) {
        const newSessionId = response.data.sessionId;
        setCurrentSessionId(newSessionId);
        setSessionTitle('New Chat');
        setMessages([]);
        setShowHistory(false);
        
        // Add welcome message
        setTimeout(() => {
          const welcomeMsg = {
            sender: 'ai',
            message: `Hi ${customerName || 'there'}! 👋 I'm your Smart Recipe AI assistant. Tell me what ingredients you have, your dietary preferences, or what type of cuisine you're craving, and I'll help you create the perfect recipe!`,
            timestamp: new Date()
          };
          setMessages([welcomeMsg]);
          saveMessageToSession(newSessionId, welcomeMsg.message, 'ai');
        }, 500);
        
        // Reload sessions list
        loadChatSessions();
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMessageToSession = async (sessionId, message, sender, recipeGenerated = false, recipeId = null) => {
    if (!customerId || !sessionId) return;

    try {
      await axios.post(`/api/customer/${customerId}/sessions/${sessionId}/messages`, {
        message,
        sender,
        recipeGenerated,
        recipeId
      });
      
      // Reload sessions to update the preview and lastMessageAt
      loadChatSessions();
    } catch (error) {
      console.error('Error saving message to session:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !currentSessionId) return;

    const userMessage = {
      sender: 'user',
      message: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageCopy = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    // Save user message
    await saveMessageToSession(currentSessionId, messageCopy, 'user');

    try {
      // Get recent conversation history for context
      const recentMessages = messages.slice(-10); // Last 10 messages
      
      // Call Gemini API through backend
      const response = await axios.post('/api/gemini/chat', {
        message: messageCopy,
        conversationHistory: recentMessages,
        customerId: customerId
      });

      const aiResponse = response.data.success 
        ? response.data.message 
        : (response.data.fallbackResponse || generateFallbackResponse(messageCopy));
      
      const aiMessage = {
        sender: 'ai',
        message: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      // Update credits in localStorage if provided
      if (response.data.credits !== undefined) {
        localStorage.setItem('customerCredits', String(response.data.credits));
      }
      setIsTyping(false);

      // Save AI response
      await saveMessageToSession(currentSessionId, aiResponse, 'ai');
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      if (error.response && error.response.status === 402) {
        // Redirect to buy credits page without showing an alert
        window.location.href = '/buy-credits';
        return setIsTyping(false);
      }
      if (error.response && error.response.status === 429) {
        const aiMessage = {
          sender: 'ai',
          message: 'The AI service is temporarily busy (rate limited). Please try again in a moment.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        return setIsTyping(false);
      }
      
      // Use fallback response if API fails
      const fallbackResponse = generateFallbackResponse(messageCopy);
      
      const aiMessage = {
        sender: 'ai',
        message: fallbackResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);

      // Save fallback response
      await saveMessageToSession(currentSessionId, fallbackResponse, 'ai');
    }
  };

  const generateFallbackResponse = (userInput) => {
    const input = userInput.toLowerCase();
    
    if (input.includes('pasta') || input.includes('spaghetti')) {
      return "🍝 Great choice! I can help you make delicious pasta. Do you prefer a classic tomato-based sauce, creamy alfredo, or something with pesto? Also, let me know if you have any dietary restrictions!";
    } else if (input.includes('chicken') || input.includes('meat')) {
      return "🍗 Chicken is versatile! Are you in the mood for something grilled, baked, or perhaps a curry? What's your skill level - beginner, intermediate, or advanced?";
    } else if (input.includes('vegetarian') || input.includes('vegan')) {
      return "🥗 Excellent! I have many plant-based recipes. What ingredients do you have on hand? Some common ones like beans, lentils, tofu, or vegetables?";
    } else if (input.includes('quick') || input.includes('fast') || input.includes('30 minutes')) {
      return "⚡ I understand you're short on time! I can suggest recipes that take 30 minutes or less. What ingredients do you have available?";
    } else if (input.includes('dessert') || input.includes('sweet')) {
      return "🍰 Sweet tooth calling! Are you interested in cakes, cookies, puddings, or something refreshing like ice cream? Do you have baking supplies?";
    } else if (input.includes('ingredients')) {
      return "📝 Perfect! Please list the ingredients you have, and I'll create a custom recipe for you. For example: 'I have chicken, rice, tomatoes, onions, and garlic.'";
    } else {
      return `I understand you're looking for recipe ideas! To help you better, could you tell me:\n\n1. What ingredients do you have?\n2. Any dietary preferences or restrictions?\n3. Your cooking skill level?\n4. How much time do you have?\n\nThis will help me create the perfect recipe for you! 🍳`;
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await axios.delete(`/api/customer/${customerId}/sessions/${sessionId}`);
      
      // If deleting current session, create a new one
      if (sessionId === currentSessionId) {
        createNewChat();
      } else {
        loadChatSessions();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  // Quick suggestions removed per request

  if (isLoading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner"></div>
        <p>Loading your chat...</p>
      </div>
    );
  }

  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <button 
          className="history-toggle-btn"
          onClick={() => setShowHistory(!showHistory)}
          title="Chat History"
        >
          📋
        </button>
        
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <div>
            <h2>{sessionTitle}</h2>
            <p className="chat-status">
              <span className="status-dot"></span>
              Online and ready to help
            </p>
          </div>
        </div>
        
        <button 
          className="new-chat-btn"
          onClick={createNewChat}
          title="New Chat"
        >
          ➕ New Chat
        </button>
      </div>

      <div className="chat-body">
        {showHistory && (
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <h3>Chat History</h3>
              <button 
                className="close-sidebar-btn"
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="sessions-list">
              {chatSessions.map((session) => (
                <div 
                  key={session.sessionId}
                  className={`session-item ${session.sessionId === currentSessionId ? 'active' : ''}`}
                  onClick={() => loadSession(session.sessionId, session.title)}
                >
                  <div className="session-header">
                    <h4>{session.title}</h4>
                    <button 
                      className="delete-session-btn"
                      onClick={(e) => deleteSession(session.sessionId, e)}
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {session.foodNames && session.foodNames.length > 0 && (
                    <div className="session-tags">
                      {session.foodNames.slice(0, 3).map((food, idx) => (
                        <span key={idx} className="tag food-tag">{food}</span>
                      ))}
                    </div>
                  )}
                  
                  {session.keywords && session.keywords.length > 0 && (
                    <div className="session-tags">
                      {session.keywords.slice(0, 2).map((keyword, idx) => (
                        <span key={idx} className="tag keyword-tag">{keyword}</span>
                      ))}
                    </div>
                  )}
                  
                  <div className="session-info">
                    <span className="message-count">💬 {session.messageCount}</span>
                    <span className="session-date">
                      {new Date(session.lastMessageAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {session.preview && (
                    <p className="session-preview">{session.preview.slice(0, 50)}...</p>
                  )}
                </div>
              ))}
              
              {chatSessions.length === 0 && (
                <p className="no-sessions">No chat history yet. Start a new conversation!</p>
              )}
            </div>
          </div>
        )}

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-avatar">
                {msg.sender === 'ai' ? '🤖' : '👤'}
              </div>
              <div className="message-content">
                <div className="message-bubble">
                  {msg.message}
                </div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="message ai">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-bubble typing">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick suggestions removed */}

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div className="input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Type your message... (e.g., 'I have chicken and rice')"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isTyping}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputMessage.trim() || isTyping}
          >
            <span className="send-icon">📤</span>
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBot;

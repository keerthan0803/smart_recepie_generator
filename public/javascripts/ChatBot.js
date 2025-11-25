import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../stylesheets/ChatBot.css';

/**
 * ChatBot Component
 * Handles recipe generation via AI with chat history and session management
 */
const ChatBot = ({ customerId: propCustomerId, customerName: propCustomerName }) => {
  // ==================== STATE MANAGEMENT ====================
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const messagesEndRef = useRef(null);

  // ==================== GET USER INFO ====================
  const customerId = propCustomerId || localStorage.getItem('customerId');
  const customerName = propCustomerName || localStorage.getItem('customerName') || 'Chef';
  const initialCredits = parseInt(localStorage.getItem('customerCredits') || '0', 10);

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    setCredits(initialCredits);
    
    if (!customerId) {
      const timer = setTimeout(() => {
        if (!localStorage.getItem('customerId')) {
          window.location.href = '/signin';
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    loadUserProfile();
    loadChatSessions();
  }, [customerId]);

  // ==================== LOAD USER PROFILE ====================
  const loadUserProfile = async () => {
    if (!customerId) return;

    try {
      const response = await axios.get(`/api/customer/${customerId}`);
      if (response.data.success) {
        const profile = {
          firstName: response.data.customer.firstName,
          skillLevel: response.data.customer.skillLevel || 'beginner',
          allergies: response.data.customer.allergies || [],
          dietaryPreferences: response.data.customer.dietaryPreferences || [],
          favoriteIngredients: response.data.customer.favoriteIngredients || [],
          dislikedIngredients: response.data.customer.dislikedIngredients || [],
          age: response.data.customer.age
        };
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  // ==================== AUTO SCROLL ====================
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // ==================== SESSION MANAGEMENT ====================
  const loadChatSessions = async () => {
    if (!customerId) return;
    
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/customer/${customerId}/sessions`);
      
      if (response.data.success) {
        const sessions = response.data.sessions || [];
        setChatSessions(sessions);

        if (sessions.length > 0) {
          // Load most recent session
          await loadSession(sessions[0].sessionId, sessions[0].title);
        } else {
          // Create new session for first-time users
          await createNewChat();
        }
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load chat history. Starting new chat...');
      await createNewChat();
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId, title) => {
    try {
      setIsLoading(true);
      setCurrentSessionId(sessionId);
      setSessionTitle(title);
      setError(null);

      const response = await axios.get(
        `/api/customer/${customerId}/sessions/${sessionId}/messages`
      );

      if (response.data.success) {
        const sessionMessages = response.data.messages || [];
        setMessages(sessionMessages.map(msg => ({
          sender: msg.sender,
          message: msg.message,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load this chat session');
      setMessages([]);
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
        setError(null);
        setShowHistory(false);

        // Add welcome message with profile info
        let welcomeMessage = `👋 Hi ${customerName}! I'm your Smart Recipe AI assistant.\n\n`;
        
        if (userProfile) {
          welcomeMessage += `I have your profile: ${userProfile.skillLevel} level cook`;
          if (userProfile.dietaryPreferences?.length > 0) {
            welcomeMessage += `, ${userProfile.dietaryPreferences.join(', ')}`;
          }
          welcomeMessage += `.\n\n`;
        }
        
        welcomeMessage += `Tell me:\n• What ingredients you have\n• What type of cuisine you're craving\n• How much time you have to cook\n\nI'll create the perfect recipe for you! 🍳`;
        
        const welcomeMsg = {
          sender: 'ai',
          message: welcomeMessage,
          timestamp: new Date()
        };

        setMessages([welcomeMsg]);
        
        // Save welcome message
        await axios.post(
          `/api/customer/${customerId}/sessions/${newSessionId}/messages`,
          {
            message: welcomeMsg.message,
            sender: 'ai'
          }
        ).catch(err => console.error('Error saving welcome message:', err));

        // Reload sessions list
        const sessionsResponse = await axios.get(`/api/customer/${customerId}/sessions`);
        if (sessionsResponse.data.success) {
          setChatSessions(sessionsResponse.data.sessions || []);
        }
      }
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create new chat');
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();

    if (!window.confirm('Delete this chat? This cannot be undone.')) return;

    try {
      await axios.delete(`/api/customer/${customerId}/sessions/${sessionId}`);

      if (sessionId === currentSessionId) {
        await createNewChat();
      } else {
        await loadChatSessions();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError('Failed to delete chat');
    }
  };

  // ==================== MESSAGE HANDLING ====================
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isTyping || !currentSessionId) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setError(null);

    // Add user message to display
    const userMessage = {
      sender: 'user',
      message: userMsg,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Save user message to database
    try {
      await axios.post(
        `/api/customer/${customerId}/sessions/${currentSessionId}/messages`,
        { message: userMsg, sender: 'user' }
      );
    } catch (err) {
      console.error('Error saving user message:', err);
    }

    // Get AI response
    await getAIResponse(userMsg);
  };

  const getAIResponse = async (userMsg) => {
    setIsTyping(true);

    try {
      // Get last 10 messages for context
      const conversationHistory = messages.slice(-10);

      // Build request payload with user profile data
      const requestPayload = {
        message: userMsg,
        conversationHistory,
        customerId,
        userProfile: userProfile ? {
          skillLevel: userProfile.skillLevel,
          allergies: userProfile.allergies,
          dietaryPreferences: userProfile.dietaryPreferences,
          favoriteIngredients: userProfile.favoriteIngredients,
          dislikedIngredients: userProfile.dislikedIngredients
        } : null
      };

      // Call Gemini API
      const response = await axios.post('/api/gemini/chat', requestPayload);

      if (response.data.success) {
        const aiMessage = {
          sender: 'ai',
          message: response.data.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);

        // Update credits if provided
        if (response.data.credits !== undefined) {
          const newCredits = response.data.credits;
          setCredits(newCredits);
          localStorage.setItem('customerCredits', String(newCredits));
        }

        // Save AI message to database
        try {
          await axios.post(
            `/api/customer/${customerId}/sessions/${currentSessionId}/messages`,
            { message: response.data.message, sender: 'ai' }
          );
        } catch (err) {
          console.error('Error saving AI message:', err);
        }
      }
    } catch (err) {
      console.error('Error getting AI response:', err);

      // Handle specific error cases
      if (err.response?.status === 402) {
        // Insufficient credits
        window.location.href = '/buy-credits';
        return;
      }

      if (err.response?.status === 429) {
        // Rate limited
        const errorMsg = {
          sender: 'ai',
          message: '⏳ The AI service is temporarily busy. Please try again in a moment.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        // Generic error with fallback
        const fallback = generateFallbackResponse(userMsg);
        const fallbackMsg = {
          sender: 'ai',
          message: fallback,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMsg]);

        // Try to save fallback
        try {
          await axios.post(
            `/api/customer/${customerId}/sessions/${currentSessionId}/messages`,
            { message: fallback, sender: 'ai' }
          );
        } catch (saveErr) {
          console.error('Error saving fallback message:', saveErr);
        }
      }

      setError('Could not get response. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  // ==================== FALLBACK RESPONSES ====================
  const generateFallbackResponse = (userInput) => {
    const input = userInput.toLowerCase();

    const responses = {
      pasta: '🍝 Great choice! Do you prefer classic tomato sauce, creamy Alfredo, or pesto? Any dietary restrictions?',
      chicken: '🍗 Chicken is versatile! Grilled, baked, curry, or stir-fry? What skill level are you?',
      vegetarian: '🥗 Excellent! What vegetables or proteins do you have - beans, tofu, lentils?',
      quick: '⚡ Need something fast! 30-minute recipes: what main ingredients do you have?',
      dessert: '🍰 Sweet treat! Interested in cakes, cookies, puddings, or ice cream?',
      vegan: '🌱 Vegan recipes! What base ingredients do you have available?'
    };

    for (const [key, response] of Object.entries(responses)) {
      if (input.includes(key)) return response;
    }

    return '🤔 I need more details! Please tell me:\n• What ingredients you have\n• Any dietary preferences\n• How much time available\n\nThen I can create a perfect recipe! 🍳';
  };

  // ==================== LOADING STATE ====================
  if (isLoading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner"></div>
        <p>Loading your chat...</p>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="chatbot-container">
      {/* HEADER */}
      <div className="chat-header">
        <button
          className="history-toggle-btn"
          onClick={() => setShowHistory(!showHistory)}
          title="Toggle chat history"
        >
          📋
        </button>

        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <div>
            <h2>{sessionTitle}</h2>
            <p className="chat-status">
              <span className="status-dot"></span>
              Ready to help • {credits} credits
            </p>
          </div>
        </div>

        <button
          className="new-chat-btn"
          onClick={createNewChat}
          title="Start new chat"
        >
          ➕ New
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="chat-body">
        {/* SIDEBAR - CHAT HISTORY */}
        {showHistory && (
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <h3>💬 Chat History</h3>
              <button
                className="close-sidebar-btn"
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>

            <div className="sessions-list">
              {chatSessions.length > 0 ? (
                chatSessions.map((session) => (
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
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="session-meta">
                      <span>💬 {session.messageCount || 0} messages</span>
                      <span>
                        {new Date(session.lastMessageAt).toLocaleDateString()}
                      </span>
                    </div>

                    {session.preview && (
                      <p className="session-preview">
                        {session.preview.substring(0, 60)}...
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="no-sessions">No chat history yet</p>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES AREA */}
        <div className="chat-messages">
          {error && (
            <div className="error-banner">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender}`}>
              <div className="message-avatar">
                {msg.sender === 'ai' ? '🤖' : '👤'}
              </div>
              <div className="message-content">
                <div className="message-bubble">
                  {msg.message}
                </div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message ai">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-bubble typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT FORM */}
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div className="input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="What would you like to cook? (e.g., 'chicken with rice')"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isTyping}
            maxLength="500"
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputMessage.trim() || isTyping}
            title="Send message (Ctrl+Enter)"
          >
            📤 Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBot;

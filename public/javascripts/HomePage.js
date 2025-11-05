import React from 'react';
import '../stylesheets/HomePage.css';

const HomePage = ({ customerName, customerId }) => {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to Smart Recipe Generator
            {customerName && <span className="hero-greeting">, {customerName}!</span>}
          </h1>
          <p className="hero-subtitle">
            Your AI-powered cooking companion that creates personalized recipes based on your ingredients, preferences, and skill level
          </p>
          
          {customerId ? (
            <div className="cta-buttons">
              <a href="/chatbot" className="cta-button">
                <span className="cta-icon">🤖</span>
                Start Cooking with AI
              </a>
              <a href="/buy-credits" className="cta-button secondary">
                <span className="cta-icon">💰</span>
                Buy Credits
              </a>
            </div>
          ) : (
            <div className="cta-buttons">
              <a href="/signup" className="cta-button primary">
                <span className="cta-icon">🍳</span>
                Get Started Free
              </a>
              <a href="/signin" className="cta-button secondary">
                Sign In
              </a>
              <a href="/buy-credits" className="cta-button secondary">
                <span className="cta-icon">💰</span>
                Buy Credits
              </a>
            </div>
          )}
        </div>
        
        <div className="hero-image">
          <div className="chef-illustration">
            <span className="chef-emoji">👨‍🍳</span>
            <div className="floating-ingredients">
              <span className="ingredient">🥕</span>
              <span className="ingredient">🍅</span>
              <span className="ingredient">🥑</span>
              <span className="ingredient">🧄</span>
              <span className="ingredient">🧅</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-title">Why Choose Our AI Recipe Generator?</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3 className="feature-title">Personalized Recipes</h3>
            <p className="feature-description">
              Get recipes tailored to your skill level, dietary preferences, and available ingredients
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3 className="feature-title">AI Chat Assistant</h3>
            <p className="feature-description">
              Chat with our AI to get recipe suggestions, cooking tips, and ingredient substitutions
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🥘</div>
            <h3 className="feature-title">Smart Ingredients</h3>
            <p className="feature-description">
              Find amazing recipes using ingredients you already have in your kitchen
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3 className="feature-title">Recipe History</h3>
            <p className="feature-description">
              Save your favorite recipes and track your cooking journey over time
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3 className="feature-title">Global Cuisines</h3>
            <p className="feature-description">
              Explore recipes from around the world adapted to your taste and dietary needs
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Instant Results</h3>
            <p className="feature-description">
              Get recipe recommendations in seconds with detailed instructions and nutritional info
            </p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-icon">📝</div>
            <h3 className="step-title">Tell Us Your Preferences</h3>
            <p className="step-description">
              Share your dietary needs, skill level, and available ingredients
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-icon">🤖</div>
            <h3 className="step-title">AI Creates Your Recipe</h3>
            <p className="step-description">
              Our AI generates a personalized recipe just for you
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-icon">🍳</div>
            <h3 className="step-title">Cook & Enjoy</h3>
            <p className="step-description">
              Follow the step-by-step instructions and enjoy your meal
            </p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Start Your Culinary Journey?</h2>
          <p className="cta-text">
            Join thousands of home chefs who are discovering amazing recipes every day
          </p>
          
          {customerId ? (
            <div className="cta-buttons">
              <a href="/chatbot" className="cta-button large">
                <span className="cta-icon">💬</span>
                Chat with AI Now
              </a>
              <a href="/buy-credits" className="cta-button large secondary">
                <span className="cta-icon">💰</span>
                Buy Credits
              </a>
            </div>
          ) : (
            <div className="cta-buttons">
              <a href="/signup" className="cta-button large">
                <span className="cta-icon">🚀</span>
                Create Free Account
              </a>
              <a href="/buy-credits" className="cta-button large secondary">
                <span className="cta-icon">💰</span>
                Buy Credits
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;

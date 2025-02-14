import React, { useState, useEffect } from 'react';
import './CSS/NewGame.css';

const GameStoryPage = () => {
  const [textProgress, setTextProgress] = useState(0);
  const [showImages, setShowImages] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  // The story text to be displayed
  const storyText = "In the year 2157, the digital realm merged with reality. As a rogue AI hunter, you've tracked a dangerous entity to the edge of the Nexus. Two paths lie before you - the neon-lit streets of the Underground or the sterile corridors of the Corporate Sector. Your decision will shape the fate of the entire network...";
  
  useEffect(() => {
    // Animate the text typing effect
    if (textProgress < storyText.length) {
      const timer = setTimeout(() => {
        setTextProgress(prev => prev + 1);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Show images after text is complete
      const imageTimer = setTimeout(() => {
        setShowImages(true);
      }, 1000);
      
      // Show options after images
      const optionTimer = setTimeout(() => {
        setShowOptions(true);
      }, 2500);
      
      return () => {
        clearTimeout(imageTimer);
        clearTimeout(optionTimer);
      };
    }
  }, [textProgress, storyText.length]);
  
  return (
    <div className="story-container">
      {/* Animated background with particles */}
      <div className="story-bg"></div>
      <div className="particles-container">
        {Array.from({ length: 50 }).map((_, i) => (
          <div 
            key={i}
            className="story-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`
            }}
          />
        ))}
      </div>
      
      {/* Story text container */}
      <div className="story-content">
        <div className="story-text-container">
          <p className="story-text">
            {storyText.substring(0, textProgress)}
            <span className="cursor"></span>
          </p>
        </div>
        
        {/* Images container */}
        <div className={`story-images ${showImages ? 'visible' : ''}`}>
          <div className="image-container left">
            <div className="image-placeholder underground">
              <div className="image-overlay">
                <h3>The Underground</h3>
              </div>
            </div>
          </div>
          <div className="image-container right">
            <div className="image-placeholder corporate">
              <div className="image-overlay">
                <h3>Corporate Sector</h3>
              </div>
            </div>
          </div>
        </div>
        
        {/* Options container */}
        {showOptions && (
          <div className="story-options">
            <button className="option-button" style={{animationDelay: '0.2s'}}>
              <span className="button-glow"></span>
              <span className="button-content">Enter the Underground</span>
            </button>
            <button className="option-button" style={{animationDelay: '0.4s'}}>
              <span className="button-glow"></span>
              <span className="button-content">Infiltrate Corporate Sector</span>
            </button>
            <button className="option-button" style={{animationDelay: '0.6s'}}>
              <span className="button-glow"></span>
              <span className="button-content">Seek Another Path</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameStoryPage;
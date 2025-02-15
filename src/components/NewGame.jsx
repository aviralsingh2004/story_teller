import React, { useState, useEffect, useRef } from 'react';
import './CSS/NewGame.css';

const GameStoryPage = () => {
  const [textProgress, setTextProgress] = useState(0);
  const [showImages, setShowImages] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [currentStory, setCurrentStory] = useState("");
  const [choices, setChoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [images, setImages] = useState({ image1: null, image2: null });
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const imageCheckInterval = useRef(null);
  const initializeRef = useRef(false);
  const [audioFile, setAudioFile] = useState(null);
  const [isCheckingAudio, setIsCheckingAudio] = useState(false);
  const audioCheckInterval = useRef(null);
  const audioRef = useRef(null);
  const [manualChoice, setManualChoice] = useState("");
  
  const checkForImages = () => {
    if (!isCheckingImages) return;
    
    fetch(`http://localhost:4000/api/check-images`)
      .then(response => response.json())
      .then(data => {
        if (data.images && data.images.length >= 2) {
          setImages({
            image1: data.images[0],
            image2: data.images[1]
          });
          setIsCheckingImages(false);
          if (imageCheckInterval.current) {
            clearInterval(imageCheckInterval.current);
            imageCheckInterval.current = null;
          }
        }
      })
      .catch(error => {
        console.error('Error checking images:', error);
      });
  };

  useEffect(() => {
    if (isCheckingImages && !imageCheckInterval.current) {
      imageCheckInterval.current = setInterval(checkForImages, 5000);
    }
    
    return () => {
      if (imageCheckInterval.current) {
        clearInterval(imageCheckInterval.current);
        imageCheckInterval.current = null;
      }
    };
  }, [isCheckingImages]);

  const checkForAudio = () => {
    if (!isCheckingAudio) return;
    
    fetch(`http://localhost:4000/api/check-audio/${gameId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.audioFile) {
          if (audioRef.current) {
            audioRef.current.src = `http://localhost:4000/audio/${data.audioFile}`;
            audioRef.current.play()
              .then(() => {
                setIsCheckingAudio(false);
                if (audioCheckInterval.current) {
                  clearInterval(audioCheckInterval.current);
                  audioCheckInterval.current = null;
                }
              })
              .catch(error => console.error('Error playing audio:', error));
          }
        }
      })
      .catch(error => {
        console.error('Error checking audio:', error);
      });
  };

  useEffect(() => {
    if (gameId) {
      const initialDelay = setTimeout(() => {
        setIsCheckingAudio(true);
      }, 5000);
      return () => clearTimeout(initialDelay);
    }
  }, [gameId]);

  useEffect(() => {
    if (isCheckingAudio && !audioCheckInterval.current) {
      checkForAudio();
      audioCheckInterval.current = setInterval(checkForAudio, 1000);
    }
    
    return () => {
      if (audioCheckInterval.current) {
        clearInterval(audioCheckInterval.current);
        audioCheckInterval.current = null;
      }
    };
  }, [isCheckingAudio]);

  const handleChoice = (choiceIndex) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setTextProgress(0);
    setShowImages(false);
    setShowOptions(false);
    setImages({ image1: null, image2: null });
    
    fetch(`http://localhost:4000/api/game/${gameId}/choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ choice: choiceIndex })
    })
    .then(() => fetch(`http://localhost:4000/api/game/${gameId}/turn`))
    .then(response => response.json())
    .then(data => {
      setCurrentStory(data.story);
      setChoices(data.choices);
      setIsCheckingImages(true);
      setTimeout(() => {
        setIsCheckingAudio(true);
      }, 5000);
    })
    .catch(error => {
      console.error('Error processing choice:', error);
    });
  };

  const handleManualChoice = (e) => {
    e.preventDefault();
    if (!manualChoice.trim()) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setTextProgress(0);
    setShowImages(false);
    setShowOptions(false);
    setImages({ image1: null, image2: null });
    
    fetch(`http://localhost:4000/api/game/${gameId}/manual-choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ choice: manualChoice })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return fetch(`http://localhost:4000/api/game/${gameId}/turn`);
    })
    .then(response => response.json())
    .then(data => {
      setCurrentStory(data.story);
      setChoices(data.choices);
      setManualChoice("");
      setIsCheckingImages(true);
      setTimeout(() => {
        setIsCheckingAudio(true);
      }, 5000);
    })
    .catch(error => {
      console.error('Error processing manual choice:', error);
    });
  };

  useEffect(() => {
    if (initializeRef.current) return;
    initializeRef.current = true;

    fetch('http://localhost:4000/api/game/start', {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      setGameId(data.gameId);
      if (data.gameId) {
        return fetch(`http://localhost:4000/api/game/${data.gameId}/turn`);
      }
      throw new Error('No gameId received');
    })
    .then(response => response.json())
    .then(turnData => {
      setCurrentStory(turnData.story);
      setChoices(turnData.choices);
      setIsCheckingImages(true);
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error starting game:', error);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (textProgress < currentStory.length) {
      const timer = setTimeout(() => {
        setTextProgress(prev => prev + 1);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      const imageTimer = setTimeout(() => {
        setShowImages(true);
      }, 1000);
      
      const optionTimer = setTimeout(() => {
        setShowOptions(true);
      }, 2500);
      
      return () => {
        clearTimeout(imageTimer);
        clearTimeout(optionTimer);
      };
    }
  }, [textProgress, currentStory]);

  if (isLoading) {
    return <div className="story-container">Loading Universe...</div>;
  }

  return (
    <div className="story-container">
      <div className="background-effects">
        <div className="star-field"></div>
        <div className="nebula-effect"></div>
        <div className="floating-lights"></div>
        <div className="floating-orbs"></div>
        <div className="cosmic-dust"></div>
        <div className="meteors"></div>
      </div>
      
      <div className="content-wrapper">
        <div className="text-section">
          <div className="story-text-container">
            <div className="text-scroll-wrapper">
              <p className="story-text">
                {currentStory.substring(0, textProgress)}
                <span className="cursor"></span>
              </p>
            </div>
          </div>
        </div>

        <div className="images-section">
          <div className={`story-images ${showImages ? 'visible' : ''}`}>
            <div className="image-container">
              <div className={`image-placeholder ${images.image1 ? '' : 'no-image'}`}>
                {images.image1 ? (
                  <img 
                    src={`http://localhost:4000/extracted_images/${images.image1}`} 
                    alt="Scene" 
                    className="generated-image"
                    onError={(e) => e.target.parentElement.classList.add('no-image')}
                  />
                ) : (
                  <div className="image-overlay">
                    <h3>Constructing Reality...</h3>
                    <div className="loading-spinner"></div>
                  </div>
                )}
              </div>
              <div className="image-frame"></div>
            </div>
            <div className="image-container">
              <div className={`image-placeholder ${images.image2 ? '' : 'no-image'}`}>
                {images.image2 ? (
                  <img 
                    src={`http://localhost:4000/extracted_images/${images.image2}`} 
                    alt="Scene" 
                    className="generated-image"
                    onError={(e) => e.target.parentElement.classList.add('no-image')}
                  />
                ) : (
                  <div className="image-overlay">
                    <h3>Rendering Dimensions...</h3>
                    <div className="loading-spinner"></div>
                  </div>
                )}
              </div>
              <div className="image-frame"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className={`options-wrapper ${showOptions ? 'show' : ''}`}>
        <div className="story-options">
          {choices.map((choice, index) => (
            <button 
              key={index}
              className="option-button" 
              style={{animationDelay: `${0.2 * (index + 1)}s`}}
              onClick={() => handleChoice(index)}
            >
              <span className="button-glow"></span>
              <span className="button-content">
                <span className="choice-number">{index + 1}</span>
                {choice}
              </span>
            </button>
          ))}
          
          <div className="custom-choice-container">
  <form onSubmit={handleManualChoice} className="manual-choice-form">
    <div className="custom-option">
      <input
        type="text"
        value={manualChoice}
        onChange={(e) => setManualChoice(e.target.value)}
        placeholder="Type your own action..."
        className="manual-input"
        aria-label="Custom action input"
      />
    </div>
    <button 
      type="submit" 
      className="submit-button"
      disabled={!manualChoice.trim()}
    >
      Go
    </button>
  </form>
</div>
        </div>
      </div>
      
      <audio 
        ref={audioRef} 
        className="audio-element"
        onEnded={() => setIsCheckingAudio(false)}
        onError={() => setIsCheckingAudio(false)}
      />
      
      {isCheckingAudio && (
        <div className="audio-status">
          <div className="audio-spinner"></div>
          Synthesizing Audio...
        </div>
      )}
    </div>
  );
};

export default GameStoryPage;
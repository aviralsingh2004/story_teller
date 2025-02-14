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
  
  // Function to check for images
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
          // Stop checking once images are found
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

  // Start checking for images when needed
  useEffect(() => {
    if (isCheckingImages && !imageCheckInterval.current) {
      imageCheckInterval.current = setInterval(checkForImages, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (imageCheckInterval.current) {
        clearInterval(imageCheckInterval.current);
        imageCheckInterval.current = null;
      }
    };
  }, [isCheckingImages]);

  // Function to check for audio and play immediately when found
  const checkForAudio = () => {
    if (!isCheckingAudio) return;
    
    fetch(`http://localhost:4000/api/check-audio/${gameId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.audioFile) {
          // Play audio immediately when found
          if (audioRef.current) {
            audioRef.current.src = `http://localhost:4000/audio/${data.audioFile}`;
            audioRef.current.play()
              .then(() => {
                console.log('Playing audio:', data.audioFile);
                // Stop checking once audio starts playing
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

  // Start checking for audio after initial delay
  useEffect(() => {
    if (gameId) {
      // Wait 5 seconds before starting to check for audio
      const initialDelay = setTimeout(() => {
        setIsCheckingAudio(true);
      }, 5000);

      return () => clearTimeout(initialDelay);
    }
  }, [gameId]);

  // Audio checking interval
  useEffect(() => {
    if (isCheckingAudio && !audioCheckInterval.current) {
      // Check immediately when starting
      checkForAudio();
      // Then check every second
      audioCheckInterval.current = setInterval(checkForAudio, 1000);
    }
    
    return () => {
      if (audioCheckInterval.current) {
        clearInterval(audioCheckInterval.current);
        audioCheckInterval.current = null;
      }
    };
  }, [isCheckingAudio]);

  // Handle choice selection
  const handleChoice = (choiceIndex) => {
    // Stop any currently playing audio
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
      // Wait 5 seconds before checking for new audio
      setTimeout(() => {
        setIsCheckingAudio(true);
      }, 5000);
    })
    .catch(error => {
      console.error('Error processing choice:', error);
    });
  };

  // Initialize game
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

  // Text animation effect
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
    return <div className="story-container">loading...</div>;
  }

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
            {currentStory.substring(0, textProgress)}
            <span className="cursor"></span>
          </p>
        </div>
        
        {/* Images container */}
        <div className={`story-images ${showImages ? 'visible' : ''}`}>
          <div className="image-container left">
            <div className={`image-placeholder ${images.image1 ? '' : 'no-image'}`}>
              {images.image1 ? (
                <img 
                  src={`http://localhost:4000/extracted_images/${images.image1}`} 
                  alt="Scene 1" 
                  className="generated-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.parentElement.classList.add('no-image');
                  }}
                />
              ) : (
                <div className="image-overlay">
                  <h3>Generating Scene...</h3>
                  <div className="loading-spinner"></div>
                </div>
              )}
            </div>
          </div>
          <div className="image-container right">
            <div className={`image-placeholder ${images.image2 ? '' : 'no-image'}`}>
              {images.image2 ? (
                <img 
                  src={`http://localhost:4000/extracted_images/${images.image2}`} 
                  alt="Scene 2" 
                  className="generated-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.parentElement.classList.add('no-image');
                  }}
                />
              ) : (
                <div className="image-overlay">
                  <h3>Generating Scene...</h3>
                  <div className="loading-spinner"></div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Options container */}
        {showOptions && (
          <div className="story-options">
            {choices.map((choice, index) => (
              <button 
                key={index}
                className="option-button" 
                style={{animationDelay: `${0.2 * (index + 1)}s`}}
                onClick={() => handleChoice(index)}
              >
                <span className="button-glow"></span>
                <span className="button-content">{choice}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Audio player */}
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }} 
        onEnded={() => {
          console.log('Audio playback completed');
          setIsCheckingAudio(false);
        }}
        onError={(e) => {
          console.error('Audio playback error:', e);
          setIsCheckingAudio(false);
        }}
      />
      
      {/* Audio status indicator */}
      {isCheckingAudio && (
        <div className="audio-status">
          Preparing narration...
        </div>
      )}
    </div>
  );
};

export default GameStoryPage;
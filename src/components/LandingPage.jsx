import React, { useEffect, useState } from 'react';
import { Triangle } from 'lucide-react';
import './CSS/LandingPage.css';
import { useNavigate } from 'react-router-dom';
// Custom hook for particle animation
const useParticleAnimation = () => {
  const [particles, setParticles] = useState([]);
  
  
  useEffect(() => {
    // Create initial particles
    const initialParticles = Array.from({ length: 30 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 5 + 2,
      speedX: Math.random() * 2 - 1,
      speedY: Math.random() * 2 - 1,
      opacity: Math.random() * 0.5 + 0.2,
    }));
    
    setParticles(initialParticles);
    
    const interval = setInterval(() => {
      setParticles(prevParticles => 
        prevParticles.map(p => ({
          ...p,
          x: (p.x + p.speedX + window.innerWidth) % window.innerWidth,
          y: (p.y + p.speedY + window.innerHeight) % window.innerHeight,
          opacity: p.opacity > 0.8 ? 0.2 : p.opacity + 0.001,
        }))
      );
    }, 16);
    
    
    return () => clearInterval(interval);
  }, []);
  
  return particles;
};

const GamingLandingPage = () => {
  const particles = useParticleAnimation();
  const [isLogoAnimated, setIsLogoAnimated] = useState(false);
  const navigate = useNavigate();
  const HandleClick=()=>{
    navigate('/newgame')
  }
  useEffect(() => {
    // Trigger logo animation after a short delay
    const timer = setTimeout(() => setIsLogoAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="landing-container">
      {/* Animated background */}
      <div className="animated-background"></div>
      
      {/* Particles */}
      {particles.map((p, i) => (
        <div 
          key={i}
          className="particle"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px rgba(59, 130, 246, 0.8)`,
          }}
        />
      ))}
      
      {/* Logo */}
      <div className={`logo-container ${isLogoAnimated ? 'logo-animated' : ''}`}>
        <div className="logo-triangles">
          <Triangle size={120} strokeWidth={1} className="triangle-outer" />
          <div className="triangle-middle-container">
            <Triangle size={80} strokeWidth={1} className="triangle-middle" />
          </div>
          <div className="triangle-inner-container">
            <Triangle size={40} strokeWidth={1} className="triangle-inner" />
          </div>
        </div>
        <h1 className="game-title">CYBER NEXUS</h1>
      </div>
      
      {/* Start Game Button */}
      <button className="start-button" onClick={()=>{HandleClick()}}>
        <div className="button-glow"></div>
        <div className="button-bg"></div>
        <span className="button-text">START GAME</span>
        <div className="button-border-glow"></div>
      </button>
      
      {/* Ambient corner lights */}
      <div className="corner-light top-left"></div>
      <div className="corner-light bottom-right"></div>
    </div>
  );
};

export default GamingLandingPage;
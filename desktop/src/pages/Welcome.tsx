import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Welcome.css";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-advance to network setup after 3 seconds
    const timer = setTimeout(() => {
      navigate("/network-setup");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleSkip = () => {
    navigate("/network-setup");
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="welcome-logo">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="60" cy="60" r="55" stroke="#4caf50" strokeWidth="6" />
            <path
              d="M40 60 L55 75 L80 45"
              stroke="#4caf50"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="60" cy="60" r="35" stroke="#4caf50" strokeWidth="3" opacity="0.5" />
          </svg>
        </div>
        
        <h1 className="welcome-title">BitWiperz</h1>
        <p className="welcome-subtitle">Secure Data Erasure System</p>
        
        <div className="welcome-loader">
          <div className="loader-bar"></div>
        </div>

        <button className="welcome-skip-btn" onClick={handleSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

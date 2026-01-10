import { useState, useRef, useEffect } from "react";
import "./ErasureMethod.css";

export interface ErasureOption {
  id: string;
  label: string;
  description: string;
}

interface ErasureMethodProps {
  options?: ErasureOption[];
  selectedOption?: string;
  onSelect?: (option: string) => void;
  onErase?: () => void;
  isLoading?: boolean;
}

const DEFAULT_OPTIONS: ErasureOption[] = [
  {
    id: "ata-secure-erase",
    label: "ATA SECURE ERASE",
    description: "Hardware-level ATA command, ~30-60 seconds",
  },
  {
    id: "crypto-erase",
    label: "CRYPTO ERASE",
    description: "Self-encrypting drives, fastest method ~10-20 seconds",
  },
  {
    id: "dod-3-pass",
    label: "DOD 3-PASS",
    description: "US DEPT OF DEFENCE 5220.22-M (3 patterns) ~2-5 minutes",
  },
  {
    id: "dod-7-pass",
    label: "DOD 7-PASS",
    description: "Extended security (7 patterns) ~5-10 minutes",
  },
  {
    id: "gutmann-35-pass",
    label: "GUTMANN 35-PASS",
    description: "Maximum security (35 patterns) ~15-30 minutes",
  },
  {
    id: "block-erase",
    label: "BLOCK ERASE",
    description: "SSD TRIM/UNMAP optimization ~20-40 seconds",
  },
];

export default function ErasureMethod({
  options = DEFAULT_OPTIONS,
  selectedOption = "dod-3-pass",
  onSelect,
  onErase,
  isLoading = false,
}: ErasureMethodProps) {
  const [selected, setSelected] = useState(selectedOption);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (optionId: string) => {
    setSelected(optionId);
    setIsDropdownOpen(false);
    onSelect?.(optionId);
  };

  const selectedOpt = options.find((opt) => opt.id === selected);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="erasure-method">
      <label className="erasure-label">ERASURE METHOD :</label>
      <div className="erasure-controls">
        <div className="erasure-dropdown" ref={dropdownRef}>
          <div 
            className="dropdown-content"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className="dropdown-label">{selectedOpt?.description}</span>
            <button 
              className="dropdown-toggle"
              style={{
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 10L12 15L17 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {isDropdownOpen && (
            <div className="dropdown-menu">
              {options.map((option) => (
                <button
                  key={option.id}
                  className={`dropdown-item ${
                    selected === option.id ? "active" : ""
                  }`}
                  onClick={() => handleSelect(option.id)}
                >
                  <div className="dropdown-item-title">{option.label}</div>
                  <div className="dropdown-item-description">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="erasure-button"
          onClick={onErase}
          disabled={isLoading}
        >
          {isLoading ? "WIPING..." : selectedOpt?.label || "ERASE"}
        </button>
      </div>
    </div>
  );
}

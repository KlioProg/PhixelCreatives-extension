import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('colors');
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paletteDetail, setPaletteDetail] = useState(null);
  const [colorIndex, setColorIndex] = useState(0);
  
  // Build the active color data for display in the detail modal
  let activeData = null;
  if (paletteDetail) {
    const safeColorIndex = Math.min(colorIndex, paletteDetail.colors.length - 1);
    const rawColor = String(paletteDetail.colors[safeColorIndex]).trim().toLowerCase();
    activeData = getTrueColorMath(rawColor);
  }
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['savedPalettes'], (result) => {
        if(result.savedPalettes) {
          setPalettes(result.savedPalettes);
        }
      });
    }
  }, []);

  const processColorResponse = (response, tabTitle) => {
    if (response && response.colors && response.colors.length > 0) {
      const cleanTitle = tabTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Untitled'; 
      const newPalette = {
        id: Date.now(),
        title: cleanTitle,
        colors: response.colors.slice(0, 5) // Limit to top 5colors
      };

      setPalettes(prev => {
        const newDeck = [newPalette, ...prev];
        chrome.storage.local.set({ savedPalettes: newDeck });
        return newDeck;
      })
   
      setActiveTab('colors');
    } else {
      alert("No colors found on the current page.");
    }
    setLoading(false);
  }

  const deletePalette = (id) => {
    if(!window.confirm("Are you sure you want to delete this palette?")) return;

    setPalettes(prev => {
      const updatedDeck = prev.filter(palette => palette.id !== id);
      chrome.storage.local.set({ savedPalettes: updatedDeck });
      return updatedDeck;
  });
  }

  const handleExtractColors = async () => {
    setLoading(true);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if(!tab) {
      alert("No active tab found. Please open a webpage and try again.");
      setLoading(false);
      return;
    }

    if (isRestrictedUrl(tab.url)) {
      alert("This extension cannot access the current page due to browser security restrictions. Please navigate to a different webpage and try again.");
      setLoading(false);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "extractColors" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error", chrome.runtime.lastError.message);
        alert("Failed to communicate with content script.");
        setLoading(false);
        return;
      }
      processColorResponse(response, tab.title);
    });
  }

  return (
    <div className="phixel-container">
      
      {/* Slim Red Brand Header Box */}
      <header className="brand-header">
        <h1 className="brand-title">PHIXEL</h1>
      </header>

      {/* Retro Tab Navbar Controllers */}
      <nav className="tab-navbar">
        <button 
          className={`nav-tab ${activeTab === 'colors' ? 'active' : ''}`}
          onClick={() => setActiveTab('colors')}
        >
          Colors
        </button>
        <button 
          className={`nav-tab ${activeTab === 'vectors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vectors')}
        >
          Vectors
        </button>
        <button 
          className={`nav-tab ${activeTab === 'fonts' ? 'active' : ''}`}
          onClick={() => setActiveTab('fonts')}
        >
          Fonts
        </button>
      </nav>

      {/* Scroll Context Display Area */}
      <main className="main-content-window">
        {activeTab === 'colors' && (
          <>
            <div className="palette-grid">
              {palettes.length === 0 ? (
                <div className="empty-state-msg">
                  <p>No palettes captured yet.</p>
                  <p style={{ fontSize: '10px', color: '#8c8a82' }}>Click below to scan!</p>
                </div>
              ) : (
                palettes.map((palette) => (
                  <div key={palette.id} className="palette-card">
                    
                    {/* Top Section: Color Strip Bars */}
                    <div className="card-color-deck">
                      {palette.colors.map((color, index) => (
                        <div 
                          key={index} 
                          className="color-bar-slice" 
                          style={{ backgroundColor: color }}
                          title={`Click to copy: ${color}`}
                          onClick={() => {
                            navigator.clipboard.writeText(color);
                            alert(`Copied ${color} to clipboard!`);
                          }}
                        />
                      ))}
                    </div>

                    {/* Bottom Section: The Metadata Tray Info Line */}
                    <div className="card-meta-tray">
                      <span className="meta-site-name">{palette.title}</span>
                      <div className="meta-actions-group">
                        <span 
                          className="icon-action-btn" 
                          title="View Detail" 
                          onClick={() => setPaletteDetail(palette)}>
                            👁
                        </span>
                        <span 
                          className="icon-action-btn delete-btn" 
                          title="Delete Palette" 
                          onClick={() => deletePalette(palette.id)}
                        >
                          •••
                        </span>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

            {paletteDetail && (
              <div className="modal-backdrop" onClick={() => setPaletteDetail(null)}>
                <div className="eye-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-topbar">
                    <span className="modal-topbar-title">{paletteDetail.title}</span>
<<<<<<< HEAD
                    <div className="header-actions">
                      <span 
                        className="icon-btn options-btn" 
                        onClick={() => {
                          if(window.confirm("Delete this palette?")) {
                            deletePalette(paletteDetail.id);
                            setPaletteDetail(null);
                          }
                        }}
                      >
                        •••
                      </span>
                      <span className="icon-btn close-btn" onClick={() => setPaletteDetail(null)}>✕</span>
                    </div>
=======
                    <span className="icon-btn close-btn" onClick={() => setPaletteDetail(null)}>✕</span>
>>>>>>> 9db8268283fe5a34b1c65b028e6e307accab0812
                  </div>
                  <div 
                      className="modal-body"
                      style={{ 
                        backgroundColor: activeData ? activeData.hex : '#0F1722',
                        /* Automatically flips text to black or white! */
                        color: activeData?.isLight ? '#08060d' : '#FFFFFF', 
                        transition: 'background-color 0.3s ease, color 0.3s ease'
                      }}
                    >
                    {activeData ? (
                        <div className="modal-data-list">
                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.hex); alert(`Copied HEX: ${activeData.hex}`); }}>
                            <span className="data-label">HEX</span>
                            <span className="data-value">{activeData.hex}</span>
                          </div>

                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.hsb); alert(`Copied HSB: ${activeData.hsb}`); }}>
                            <span className="data-label">HSB</span>
                            <span className="data-value">{activeData.hsb}</span>
                          </div>

                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.hsl); alert(`Copied HSL: ${activeData.hsl}`); }}>
                            <span className="data-label">HSL</span>
                            <span className="data-value">{activeData.hsl}</span>
                          </div>

                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.rgb); alert(`Copied RGB: ${activeData.rgb}`); }}>
                            <span className="data-label">RGB</span>
                            <span className="data-value">{activeData.rgb}</span>
                          </div>

                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.cmyk); alert(`Copied CMYK: ${activeData.cmyk}`); }}>
                            <span className="data-label">CMYK</span>
                            <span className="data-value">{activeData.cmyk}</span>
                          </div>

                          <div className="data-row" onClick={() => { navigator.clipboard.writeText(activeData.oklab); alert(`Copied OKLAB: ${activeData.oklab}`); }}>
                            <span className="data-label">OKLAB</span>
                            <span className="data-value">{activeData.oklab}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="loading-text">Crunching color data...</p>
                      )}
                    </div>
                  <div className="modal-bottom-ribbon">
<<<<<<< HEAD
                    {paletteDetail.colors.map((color, index) => {
                      const canvas = document.createElement("canvas");
                      canvas.width = 1; canvas.height = 1;
                      const ctx = canvas.getContext("2d", { willReadFrequently: true });
                      ctx.fillStyle = color;
                      ctx.fillRect(0, 0, 1, 1);
                      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                      const isLight = (r * 0.299 + g * 0.587 + b * 0.114) > 150;

                      return (
                        <div
                          key={index}
                          className={`ribbon-slice ${index === colorIndex ? 'active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setColorIndex(index)}
                        >
                          {/* 2. Show the arrow ONLY if this is the active slice */}
                          {index === colorIndex && (
                            <div 
                              className="active-arrow" 
                              style={{ color: isLight ? '#08060d' : '#EDEDE9' }}
                            >
                              ^
                            </div>
                          )}
                        </div>
                      );
                    })}
=======
                    {paletteDetail.colors.map((color, index) => (
                      <div
                        key={index}
                        className={`ribbon-slice ${index === colorIndex ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setColorIndex(index)}
                      />
                    ))}
>>>>>>> 9db8268283fe5a34b1c65b028e6e307accab0812
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Placeholder panes for your next phase additions */}
        {activeTab === 'vectors' && (
          <div className="placeholder-pane">Vector Module coming in Phase 2!</div>
        )}
        
        {activeTab === 'fonts' && (
          <div className="placeholder-pane">Font Module coming in Phase 3!</div>
        )}
      </main>

      {/* Fixed Lower Footer Green Action Button */}
      <footer className="footer-control-deck">
        <button 
          className="extract-btn" 
          onClick={handleExtractColors} 
          disabled={loading || activeTab !== 'colors'}
        >
          {loading ? "SCANNING SITE..." : "GET COLORS!"}
        </button>
      </footer>

    </div>
  );
}

function isRestrictedUrl(url) {
   if (!url) return true; // If no URL, treat as restricted
   return url.startsWith("chrome://") || 
          url.startsWith("edge://") || 
          url.startsWith("about:") || 
          url.startsWith("file://");
}

function rgbToCmyk(r, g, b) {
  if (r === 0 && g === 0 && b === 0) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  
  let c = 1 - (r / 255);
  let m = 1 - (g / 255);
  let y = 1 - (b / 255);
  let k = Math.min(c, m, y);
  
  c = Math.round(((c - k) / (1 - k)) * 100) || 0;
  m = Math.round(((m - k) / (1 - k)) * 100) || 0;
  y = Math.round(((y - k) / (1 - k)) * 100) || 0;
  k = Math.round(k * 100) || 0;
  
  return { c, m, y, k };
}

function rgbToHslHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, sL = 0, l = (max + min) / 2, sB = 0, v = max;

  if (d !== 0) {
    sL = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    sB = max === 0 ? 0 : d / max;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    sL: Math.round(sL * 100), l: Math.round(l * 100),
    sB: Math.round(sB * 100), b: Math.round(v * 100)
  };
}

function rgbToOklab(r, g, b) {
  let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  
  l = Math.cbrt(l / 255); m = Math.cbrt(m / 255); s = Math.cbrt(s / 255);
  
  return {
    L: (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s).toFixed(3),
    a: (1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s).toFixed(3),
    b: (0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s).toFixed(3)
  };
}

function getTrueColorMath(colorString) {
  const canvas = document.createElement("canvas");
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.fillStyle = colorString;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  
  const hslHsb = rgbToHslHsb(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const oklab = rgbToOklab(r, g, b);

  const isLight = (r * 0.299 + g * 0.587 + b * 0.114) > 150; 

  return { 
    hex, 
    rgb: `${r}, ${g}, ${b}`,
    hsl: `${hslHsb.h}, ${hslHsb.sL}, ${hslHsb.l}`,
    hsb: `${hslHsb.h}, ${hslHsb.sB}, ${hslHsb.b}`,
    cmyk: `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`,
    oklab: `${oklab.L}, ${oklab.a}, ${oklab.b}`,
    isLight 
  };
}

export default App;
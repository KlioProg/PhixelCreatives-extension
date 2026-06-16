import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('colors');
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(false);

  const processColorResponse = (response, tabTitle) => {
    if (response && response.colors && response.colors.length > 0) {
      const cleanTitle = tabTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Untitled'; 
      const newPalette = {
        id: Date.now(),
        title: cleanTitle,
        colors: response.colors
      };
      setPalettes(prev => [...prev, newPalette]);
      setActiveTab('colors');
    } else {
      alert("No colors found on the current page.");
    }
    setLoading(false);
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
        return;
      } else {
        processColorResponse(response, tab.title);
      }
      setLoading(false);
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
                      <span className="icon-action-btn" title="View Detail">👁</span>
                      <span className="icon-action-btn" title="Options">•••</span>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
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

export default App;
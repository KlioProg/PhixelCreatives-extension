/* global chrome */
import { useState, useEffect, useRef, useCallback, useEffectEvent } from 'react'
import './App.css'
import { MAX_PALETTE_COLORS } from './lib/constants.js';
import { convertToHex, getTrueColorMath } from './lib/colorMath.js';
import { capturePalette, isRestrictedUrl } from './lib/capturePalette.js';
import { createPaletteStore } from './lib/paletteStore.js';
import { copyText } from './lib/clipboard.js';
import { PencilSimple, Copy, Hash, PaintBrush, Trash, Eye, DotsThree, X, CaretUp } from "@phosphor-icons/react";


const createEditColorItems = (colors, baseId) => {
  return colors.map((color, index) => ({
    id: `${baseId}-${index}-${Date.now()}`,
    value: color
  }));
};

const createColorItem = (baseId, value) => ({
  id: `${baseId}-${Date.now()}`,
  value
});

function App() {
  const [activeTab, setActiveTab] = useState('colors');
  const [palettes, setPalettes] = useState([]);
  const [paletteStore] = useState(() => createPaletteStore(globalThis.chrome?.storage?.local));
  const captureInProgress = useRef(false);
  const [loading, setLoading] = useState(false);
  const [paletteDetail, setPaletteDetail] = useState(null);
  const [colorIndex, setColorIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [selectedClearIds, setSelectedClearIds] = useState([]);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [openMenuID, setOpenMenuID] = useState(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingPalette, setEditingPalette] = useState(null);
  const [fonts, setFonts] = useState([]);
  const [fontDetail, setFontDetail] = useState(null);
  const [fontPreviewText, setFontPreviewText] = useState('The quick brown fox jumps over the lazy dog');
  const [fontPickerActive, setFontPickerActive] = useState(false);
  const [pendingColorPickerId, setPendingColorPickerId] = useState(null);
  const toastTimerRef = useRef(null);
  const colorInputRefs = useRef({});

  const handleEditColorChange = (colorId, newColor) => {
    setEditingPalette(prev => {
      if (!prev) return prev;
      const updatedColors = prev.colors.map((colorItem) =>
        colorItem.id === colorId ? { ...colorItem, value: newColor } : colorItem
      );
      return { ...prev, colors: updatedColors };
    });
  };

  const handleAddNewColor = () => {
    if (!editingPalette) return;
    if (editingPalette.colors.length >= MAX_PALETTE_COLORS) {
      showToast(`Maximum of ${MAX_PALETTE_COLORS} colors reached!`);
      return;
    }

    const newColorItem = createColorItem(editingPalette.id, '#FFFFFF');
    setEditingPalette(prev => ({
      ...prev,
      colors: [
        ...prev.colors,
        newColorItem
      ]
    }));
    setPendingColorPickerId(newColorItem.id);
  };

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      setToastMessage('');
    }, 1800);
  }, []);

  const handleRemoveColor = (colorId) => {
    setEditingPalette(prev => {
      if (!prev) return prev;
      const updatedColors = prev.colors.filter((colorItem) => colorItem.id !== colorId);
      return { ...prev, colors: updatedColors };
    });
    if (pendingColorPickerId === colorId) {
      setPendingColorPickerId(null);
    }
  };

  const handleClearPaletteColors = () => {
    if (!editingPalette) return;
    setEditingPalette(prev => prev ? { ...prev, colors: [] } : prev);
    setPendingColorPickerId(null);
    showToast('All colors removed');
  };

  const isLightColor = (colorString) => {
    const hexColor = convertToHex(colorString).replace(/^#/, '');
    if (!/^([A-Fa-f0-9]{6})/.test(hexColor)) return false;
    const normalized = hexColor.slice(0, 6);
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
  };

  const getEditPaletteColorValues = (editPalette) => {
    return editPalette?.colors?.map((colorItem) => colorItem.value) ?? [];
  };

  const savePaletteChange = async (transform) => {
    try {
      const saved = await paletteStore.update(transform);
      setPalettes(saved);
      return true;
    } catch (error) {
      showToast(`Could not save palettes: ${error.message}`);
      return false;
    }
  };

  const copyWithFeedback = async (value, message) => {
    try {
      await copyText(value);
      showToast(message);
    } catch (error) {
      showToast(`Could not copy: ${error.message}`);
    }
  };

  const handleSaveEditedPalette = async () => {
    if (!editingPalette) return;
    const savedColors = getEditPaletteColorValues(editingPalette).map(convertToHex);
    if (!savedColors.length || savedColors.some(color => !color)) {
      showToast('Add at least one valid color before saving.');
      return;
    }
    const savedPalette = { ...editingPalette, colors: savedColors };
    if (!await savePaletteChange(deck => deck.map(palette =>
      palette.id === savedPalette.id ? savedPalette : palette
    ))) return;
    if (paletteDetail?.id === editingPalette.id) {
      setPaletteDetail(savedPalette);
      setColorIndex(index => Math.min(index, savedColors.length - 1));
    }

    setEditingPalette(null);
    showToast('Palette updated');
  };

  const addFontFromCapture = useEffectEvent((fontData) => {
    const fontItem = {
      id: crypto.randomUUID(),
      fontFamily: fontData.fontFamily,
      fontSize: fontData.fontSize,
      fontWeight: fontData.fontWeight,
      fontStyle: fontData.fontStyle,
      sampleText: fontData.sampleText || 'The quick brown fox jumps over the lazy dog'
    };
    setFonts((prev) => [fontItem, ...prev]);
    setFontPickerActive(false);
    showToast(`Captured font: ${fontItem.fontFamily}`);
  });

  const handlePickFont = async () => {
    setFontPickerActive(true);
    showToast('Starting font picker. Click text on the page.');

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['latestFontCapture']);
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') {
      setFontPickerActive(false);
      showToast('No active tab found.');
      return;
    }

    let attemptedInjection = false;
    const sendPickFontMessage = () => {
      chrome.tabs.sendMessage(tab.id, { action: 'pickFont' }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.error('Error', errorMsg);

          if (!attemptedInjection && errorMsg.includes('Receiving end does not exist')) {
            attemptedInjection = true;
            chrome.scripting.executeScript(
              { target: { tabId: tab.id }, files: ['content.js'] },
              () => {
                if (chrome.runtime.lastError) {
                  const injectError = chrome.runtime.lastError.message;
                  console.error('Injection error', injectError);
                  setFontPickerActive(false);
                  showToast(`Cannot inject content script: ${injectError}`);
                  return;
                }
                sendPickFontMessage();
              }
            );
            return;
          }

          setFontPickerActive(false);
          showToast(`Failed to communicate with the page: ${errorMsg}`);
          return;
        }

        if (response?.started) {
          showToast('Font picker active. Select page text now.');
          return;
        }

        setFontPickerActive(false);
        showToast('Font picker could not start. The page may not be supported.');
      });
    };

    sendPickFontMessage();
  };

  const handleClearFonts = () => {
    if (!fonts.length) {
      showToast('No fonts to remove');
      return;
    }
    setFonts([]);
    setFontDetail(null);
    setFontPickerActive(false);
    showToast('Fonts cleared');
  };

  const handleExtractFonts = async () => {
    setLoading(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') {
      setLoading(false);
      showToast('No active tab found.');
      return;
    }

    if (isRestrictedUrl(tab.url)) {
      setLoading(false);
      showToast('This extension cannot access the current page. Please navigate to a supported webpage.');
      return;
    }

    let attemptedInjection = false;
    const sendExtractFontsMessage = () => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractFonts' }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.error('Error', errorMsg);

          if (!attemptedInjection && errorMsg.includes('Receiving end does not exist')) {
            attemptedInjection = true;
            chrome.scripting.executeScript(
              { target: { tabId: tab.id }, files: ['content.js'] },
              () => {
                if (chrome.runtime.lastError) {
                  const injectError = chrome.runtime.lastError.message;
                  console.error('Injection error', injectError);
                  setLoading(false);
                  showToast(`Cannot inject content script: ${injectError}`);
                  return;
                }
                sendExtractFontsMessage();
              }
            );
            return;
          }

          setLoading(false);
          showToast('Failed to communicate with the page.');
          return;
        }

        setLoading(false);
        const capturedFonts = Array.isArray(response?.fonts) ? response.fonts : [];
        setFonts(capturedFonts);
        if (capturedFonts.length > 0) {
          showToast(`Captured ${capturedFonts.length} font${capturedFonts.length === 1 ? '' : 's'}`);
        } else {
          showToast('No visible fonts found on this page.');
        }
      });
    };

    sendExtractFontsMessage();
  };

  const handleRemoveFont = (id) => {
    setFonts((prev) => prev.filter((font) => font.id !== id));
    if (fontDetail?.id === id) {
      setFontDetail(null);
    }
  };

  const handleOpenFontDetail = (font) => {
    setFontDetail(font);
    setFontPreviewText(font.sampleText || 'The quick brown fox jumps over the lazy dog');
  };

  const closeFontDetail = () => {
    setFontDetail(null);
  };

  const handleFontPreviewTextChange = (event) => {
    setFontPreviewText(event.target.value);
  };

  const handleCopyFontCss = () => {
    if (!fontDetail) return;
    const cssText = `font-family: ${fontDetail.fontFamily}; font-size: ${fontDetail.fontSize}; font-weight: ${fontDetail.fontWeight}; font-style: ${fontDetail.fontStyle};`;
    void copyWithFeedback(cssText, 'Font CSS copied');
  };

  const openRenameModal = (targetPalette) => {
    setRenameTarget(targetPalette);
    setRenameDraft(targetPalette.title || '');
    setRenameModalOpen(true);
    setOpenMenuID(null);
    setIsMenuOpen(false);
  };

  const cancelRenameModal = () => {
    setRenameModalOpen(false);
    setRenameTarget(null);
    setRenameDraft('');
  };

  const confirmRename = async () => {
    if (!renameTarget) return;

    const nextName = renameDraft.trim();
    if (!nextName) {
      showToast('Please enter a palette name');
      return;
    }

    if (!await savePaletteChange(deck => deck.map(palette =>
        palette.id === renameTarget.id ? { ...palette, title: nextName } : palette
    ))) return;

    if (paletteDetail && paletteDetail.id === renameTarget.id) {
      setPaletteDetail(prev => ({ ...prev, title: nextName }));
    }

    showToast('Palette renamed');
    cancelRenameModal();
  };

  const handleRename = (targetPalette) => {
    openRenameModal(targetPalette);
  }

  const handleDuplicate = async (targetPalette) => {
  const newPalette = {
    ...targetPalette,
    id: crypto.randomUUID(),
    title: `${targetPalette.title} (Copy)`
  };

    if (!await savePaletteChange(deck => [newPalette, ...deck])) return;
    
    setOpenMenuID(null); 
    showToast('Palette duplicated');
  }

  const handleCopyAllHex = (targetPalette) => {
    const allHex = targetPalette.colors.map(color => convertToHex(color)).join(', ');
    void copyWithFeedback(allHex, 'Copied all HEX values');
    setOpenMenuID(null);
  }

  const requestDeletePalette = (id) => {
    setPendingDeleteId(id);
    setConfirmDelete(true);
    setIsMenuOpen(false);
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
    setConfirmDelete(false);
  };

  const confirmDeletePalette = async () => {
    if (pendingDeleteId == null) return;
    if (!await deletePalette(pendingDeleteId)) return;
    setPendingDeleteId(null);
    setConfirmDelete(false);
  };

  const handleClearAllPalettes = () => {
    if (!palettes.length) {
      showToast('No palettes to remove');
      return;
    }
    setSelectedClearIds(palettes.map((palette) => palette.id));
    setClearModalOpen(true);
  };

  const cancelClearModal = () => {
    setClearModalOpen(false);
    setSelectedClearIds([]);
  };

  const toggleClearSelection = (id) => {
    setSelectedClearIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const confirmClearSelected = async () => {
    if (!selectedClearIds.length) return;

    if (!await savePaletteChange(deck => deck.filter(palette => !selectedClearIds.includes(palette.id)))) return;

    if (paletteDetail && selectedClearIds.includes(paletteDetail.id)) {
      setPaletteDetail(null);
    }

    showToast(`${selectedClearIds.length} palette${selectedClearIds.length === 1 ? '' : 's'} cleared`);
    setClearModalOpen(false);
    setSelectedClearIds([]);
    setOpenMenuID(null);
    setIsMenuOpen(false);
  };

  const confirmClearAllPalettes = async () => {
    if (!await savePaletteChange(() => [])) return;
    setPaletteDetail(null);
    setOpenMenuID(null);
    setIsMenuOpen(false);
    setClearModalOpen(false);
    setSelectedClearIds([]);
    showToast('All palettes removed');
  };
  
  let activeData = null;
  if (paletteDetail?.colors.length) {
    const safeColorIndex = Math.min(colorIndex, paletteDetail.colors.length - 1);
    const rawColor = String(paletteDetail.colors[safeColorIndex]).trim().toLowerCase();
    activeData = getTrueColorMath(rawColor);
  }
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.options-dropdown') && !e.target.closest('.options-btn')) {
        setOpenMenuID(null); // Shut the menu!
      }
    };
      if (openMenuID !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuID]); 
  
  useEffect(() => {
    if (!pendingColorPickerId) return;
    const colorInput = colorInputRefs.current[pendingColorPickerId];
    if (colorInput) {
      window.requestAnimationFrame(() => colorInput.click());
      setPendingColorPickerId(null);
    }
  }, [pendingColorPickerId]);

  useEffect(() => {
    let active = true;
    paletteStore.load().then(saved => {
      if (active) setPalettes(saved);
    }).catch(error => {
      if (active) showToast(`Could not load palettes: ${error.message}`);
    });
    return () => { active = false; };
  }, [paletteStore, showToast]);

  useEffect(() => {
    const consumeStoredCapture = () => {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      chrome.storage.local.get(['latestFontCapture'], (result) => {
        if (result.latestFontCapture && !result.latestFontCapture.canceled) {
          addFontFromCapture(result.latestFontCapture);
        }
        if (result.latestFontCapture) {
          chrome.storage.local.remove(['latestFontCapture']);
        }
      });
    };

    const storageChangeHandler = (changes, area) => {
      if (area !== 'local') return;
      if (changes.latestFontCapture?.newValue) {
        const newCapture = changes.latestFontCapture.newValue;
        if (!newCapture.canceled) {
          addFontFromCapture(newCapture);
        }
        chrome.storage.local.remove(['latestFontCapture']);
      }
    };

    consumeStoredCapture();
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(storageChangeHandler);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(storageChangeHandler);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const deletePalette = async (id) => {
    if (!await savePaletteChange(deck => deck.filter(palette => palette.id !== id))) return false;
    if (paletteDetail?.id === id) {
      setPaletteDetail(null);
    }
    showToast('Palette deleted');
    return true;
  }

  const handleExtractColors = async () => {
    if (captureInProgress.current) return;
    captureInProgress.current = true;
    setLoading(true);
    try {
      if (!globalThis.chrome?.tabs) throw new Error('Open Phixel from the Chrome extension toolbar.');
      const { title, colors } = await capturePalette(chrome.tabs);
      if (!colors.length) {
        showToast('No colors found in the visible page.');
        return;
      }
      const newPalette = {
        id: crypto.randomUUID(),
        title: title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Untitled',
        colors,
      };
      if (!await savePaletteChange(deck => [newPalette, ...deck])) return;
      setActiveTab('colors');
      showToast('Palette saved');
    } catch (error) {
      showToast(`Could not capture colors: ${error.message}`);
    } finally {
      captureInProgress.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="phixel-container">
      
      <header className="brand-header">
        <h1 className="brand-title">PHIXEL</h1>
      </header>

      <nav className="tab-navbar">
        <button 
          className={`nav-tab ${activeTab === 'colors' ? 'active' : ''}`}
          onClick={() => setActiveTab('colors')}
        >
          Colors
        </button>
        <button 
          className={`nav-tab ${activeTab === 'fonts' ? 'active' : ''}`}
          onClick={() => setActiveTab('fonts')}
        >
          Fonts
        </button>
      </nav>

      {activeTab === 'colors' && palettes.length > 0 && (
        <div className="palette-actions-bar palette-actions-tab">
          <div className="palette-actions-toolbar">
            <span className="palette-actions-label">Palette Actions</span>
            <button className="clear-all-palettes-btn" onClick={handleClearAllPalettes}>
              <Trash size={16} weight="bold" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      <main className="main-content-window">
        {activeTab === 'colors' && (
          <>
            <div className="palette-grid">
              {palettes.length === 0 ? (
                <div className="empty-state-msg">
                  <p>No palettes captured yet.</p>
                  <p>Click below to scan!</p>
                </div>
              ) : (
                palettes.map((palette) => (
                  <div key={palette.id} className="palette-card">
                    
                    <div className="card-color-deck">
                      {palette.colors.map((color, index) => {
                        const hexColor = convertToHex(color);
                        const isLight = isLightColor(color);

                        return (
                          <div 
                            key={index} 
                            className="color-bar-slice" 
                            style={{ backgroundColor: color }}
                            title={`Click to copy: ${hexColor}`}
                            onClick={() => {
                              void copyWithFeedback(hexColor, `Copied ${hexColor}`);
                            }}
                          >
                            <span className="slice-hex-label" style={{ color: isLight ? '#121212' : '#ffffff' }}>{hexColor}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="card-meta-tray">
                      <span className="meta-site-name">{palette.title}</span>
                      <div className="meta-actions-group">
                        <span 
                          className="icon-action-btn" 
                          title="View Detail" 
                          onClick={() => setPaletteDetail(palette)}>
                            <Eye size={16} weight="bold" />
                        </span>
                        <span 
                          className="icon-action-btn options-btn" 
                          title="Options" 
                          onClick={() => setOpenMenuID(openMenuID === palette.id ? null : palette.id)}>
                          <DotsThree size={18} weight="bold" />
                        </span>

                        {openMenuID === palette.id && (
                           <div className="options-dropdown">
                          <div className="dropdown-item" onClick={() => handleRename(palette)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <PencilSimple size={18} weight="bold" />
                            </span>
                            Rename
                          </div>
                          <div className="dropdown-item" onClick={() => handleDuplicate(palette)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Copy size={18} weight="bold" />
                            </span>
                            Duplicate
                          </div>
                          <div className="dropdown-item" onClick={() => handleCopyAllHex(palette)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Hash size={18} weight="bold" />
                            </span>
                            Copy All Hex
                          </div>
                          <div className="dropdown-item" onClick={(e) => { 
                            e.stopPropagation(); 
                            const cleanHexColors = palette.colors.map(c => convertToHex(c).substring(0, 7));
                            setEditingPalette({ ...palette, colors: createEditColorItems(cleanHexColors, palette.id) }); 
                            setOpenMenuID(null); 
                          }}>
                            <span className="dropdown-icon" aria-hidden="true"><PaintBrush size={18} weight="bold" /></span>
                            Edit Palette
                          </div>
                          <div className="dropdown-divider"></div>
                          <div className="dropdown-item delete-text" onClick={() => requestDeletePalette(palette.id)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Trash size={18} weight="bold" />
                            </span>
                            <span>Delete</span>
                          </div>
                        </div>
                        )}
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
                    <div className="header-actions">
                    <div className="options-menu-container">
                      <span 
                        className="eye-icon-btn eye-options-btn" 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                      >
                        <DotsThree size={22} weight="bold" />
                      </span>

                      {isMenuOpen && (
                        <div className="options-dropdown">
                            <div className="dropdown-item" onClick={() => handleRename(paletteDetail)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <PencilSimple size={18} weight="bold" />
                            </span>
                            Rename
                          </div>
                            <div className="dropdown-item" onClick={() => handleDuplicate(paletteDetail)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Copy size={18} weight="bold" />
                            </span>
                            Duplicate
                          </div>                      
                          <div className="dropdown-item" onClick={() => handleCopyAllHex(paletteDetail)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Hash size={18} weight="bold" />
                            </span>
                            Copy All Hex
                          </div>   
                          <div className="dropdown-item" onClick={() => { 
                            const cleanHexColors = paletteDetail.colors.map(c => convertToHex(c).substring(0, 7));
                            setEditingPalette({ ...paletteDetail, colors: createEditColorItems(cleanHexColors, paletteDetail.id) });
                            setIsMenuOpen(false);
                          }}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <PaintBrush size={18} weight="bold" />
                            </span>
                            Edit Palette
                          </div>                         
                          <div className="dropdown-divider"></div>                        
                          <div className="dropdown-item delete-text" onClick={() => requestDeletePalette(paletteDetail.id)}>
                            <span className="dropdown-icon" aria-hidden="true">
                              <Trash size={18} weight="bold" />
                            </span>
                            <span>Delete</span>
                          </div>                 
                        </div>
                      )}
                    </div>                      
                      <span 
                      className="eye-icon-btn eye-close-btn" 
                      onClick={() => {
                        setPaletteDetail(null);
                        setIsMenuOpen(false);
                      }}>
                        <X size={20} weight="bold" />
                      </span>
                    </div>
                  </div>
                  <div 
                      className="modal-body"
                      style={{ 
                        backgroundColor: activeData ? activeData.hex : '#0F1722',
                        color: activeData?.isLight ? '#08060d' : '#FFFFFF', 
                        transition: 'background-color 0.3s ease, color 0.3s ease'
                      }}
                    >
                    {activeData ? (
                        <div className="modal-data-list">
                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.hex, `Copied HEX: ${activeData.hex}`); }}>
                            <span className="data-label">HEX</span>
                            <span className="data-value">{activeData.hex}</span>
                          </div>

                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.hsb, `Copied HSB: ${activeData.hsb}`); }}>
                            <span className="data-label">HSB</span>
                            <span className="data-value">{activeData.hsb}</span>
                          </div>

                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.hsl, `Copied HSL: ${activeData.hsl}`); }}>
                            <span className="data-label">HSL</span>
                            <span className="data-value">{activeData.hsl}</span>
                          </div>

                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.rgb, `Copied RGB: ${activeData.rgb}`); }}>
                            <span className="data-label">RGB</span>
                            <span className="data-value">{activeData.rgb}</span>
                          </div>

                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.cmyk, `Copied CMYK: ${activeData.cmyk}`); }}>
                            <span className="data-label">CMYK</span>
                            <span className="data-value">{activeData.cmyk}</span>
                          </div>

                          <div className="data-row" onClick={() => { void copyWithFeedback(activeData.oklab, `Copied OKLAB: ${activeData.oklab}`); }}>
                            <span className="data-label">OKLAB</span>
                            <span className="data-value">{activeData.oklab}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="loading-text">This palette has no colors.</p>
                      )}
                    </div>
                  <div className="modal-bottom-ribbon">
                    {paletteDetail.colors.map((color, index) => {
                      const isLight = isLightColor(color);

                      return (
                        <div
                          key={index}
                          className={`ribbon-slice ${index === colorIndex ? 'active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setColorIndex(index)}
                        >
                          {index === colorIndex && (
                            <div 
                              className="active-arrow" 
                              style={{ color: isLight ? '#121212' : '#FFFFFF' }}
                            >
                              <CaretUp size={20} weight="bold" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Placeholder panes for your next phase additions */}
        {activeTab === 'fonts' && (
          <>
            <div className="palette-actions-bar palette-actions-tab">
              <div className="palette-actions-toolbar">
                  <span className="palette-actions-label">Font Capture</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="clear-all-palettes-btn clear-fonts-btn" onClick={handleClearFonts} disabled={!fonts.length}>
                      <Trash size={16} weight="bold" />
                      <span>Clear fonts</span>
                    </button>
                    <button className="clear-all-palettes-btn" onClick={handlePickFont} disabled={fontPickerActive}>
                      <span>Pick Font</span>
                    </button>
                  </div>
                </div>
            </div>

            {fonts.length === 0 ? (
              <div className="empty-state-msg">
                <p>No fonts captured yet.</p>
                <p>Click the footer button to capture fonts from the page.</p>
              </div>
            ) : (
              <div className="palette-grid">
                {fonts.map((font) => (
                  <div key={font.id} className="palette-card font-card" onClick={() => handleOpenFontDetail(font)}>
                    <div className="font-card-preview" style={{ fontFamily: font.fontFamily, fontWeight: font.fontWeight, fontStyle: font.fontStyle }}>
                      <span className="font-card-name">{font.fontFamily}</span>
                      <span className="font-card-sample">{font.sampleText}</span>
                    </div>
                    <div className="card-meta-tray">
                      <span className="meta-site-name">{font.fontFamily}</span>
                      <div className="meta-actions-group">
                        <span 
                          className="icon-action-btn delete-text" 
                          title="Remove font" 
                          onClick={() => handleRemoveFont(font.id)}>
                          <Trash size={18} weight="bold" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer-control-deck">
        <button 
          className={`extract-btn ${activeTab === 'fonts' ? 'font-footer-btn' : ''}`} 
          onClick={activeTab === 'fonts' ? handleExtractFonts : handleExtractColors} 
          disabled={loading || (activeTab !== 'colors' && activeTab !== 'fonts')}
        >
          {loading ? (activeTab === 'colors' ? 'SCANNING SITE...' : 'PROCESSING...') : (activeTab === 'fonts' ? 'GET FONT!' : 'GET COLORS!')}
        </button>
      </footer>

      {editingPalette && (
        <div className="edit-backdrop" onClick={() => setEditingPalette(null)}>
          <div className="edit-card" onClick={(e) => e.stopPropagation()}>
            <div className="edit-title">Edit palette</div>
            <p className="edit-copy">Adjust colors then save to update your palette.</p>

            <div className="edit-toolbar">
              <button className="edit-clear-btn" title="Remove all colors from this palette" onClick={handleClearPaletteColors}>
                <Trash size={16} weight="bold" />
                <span>Remove All</span>
              </button>
            </div>

            <div className="edit-colors-grid">
              {editingPalette.colors.map((colorItem) => (
                <div key={colorItem.id} className="edit-color-wrapper">
                  <label 
                    className={`edit-color-block ${colorItem.id === pendingColorPickerId ? 'pending' : ''}`} 
                    style={{ backgroundColor: colorItem.id === pendingColorPickerId ? 'transparent' : colorItem.value }}
                    title="Click to pick a new color"
                  >
                    <input 
                      ref={(el) => {
                        if (el) {
                          colorInputRefs.current[colorItem.id] = el;
                        } else {
                          delete colorInputRefs.current[colorItem.id];
                        }
                      }}
                      type="color" 
                      value={colorItem.value} 
                      onChange={(e) => handleEditColorChange(colorItem.id, e.target.value)}
                      className="hidden-color-input"
                    />
                  </label>
                  <button className="remove-color-btn" onClick={() => handleRemoveColor(colorItem.id)}>
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              ))}

              {editingPalette.colors.length < MAX_PALETTE_COLORS && (
                <div className="add-color-wrapper" onClick={handleAddNewColor}>
                  <span className="add-plus">+</span>
                </div>
              )}
            </div>

            <div className="edit-actions">
              <button className="confirm-btn cancel" onClick={() => setEditingPalette(null)}>Cancel</button>
              <button className="confirm-btn delete" onClick={handleSaveEditedPalette}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {fontDetail && (
        <div className="modal-backdrop" onClick={closeFontDetail}>
          <div className="eye-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-topbar">
              <span className="modal-topbar-title">{fontDetail.fontFamily}</span>
              <div className="header-actions">
                <span className="eye-icon-btn" onClick={closeFontDetail}>
                  <X size={20} weight="bold" />
                </span>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '22px 18px' }}>
              <div className="font-detail-preview" style={{
                fontFamily: fontDetail.fontFamily,
                fontWeight: fontDetail.fontWeight,
                fontStyle: fontDetail.fontStyle,
                fontSize: fontDetail.fontSize,
                color: '#241C15',
                minHeight: '110px',
                padding: '16px',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #D1C6B5',
                marginBottom: '18px'
              }}>
                {fontPreviewText}
              </div>
              <label className="rename-copy" style={{ marginBottom: '10px' }}>Preview Text</label>
              <input
                className="rename-input"
                value={fontPreviewText}
                onChange={handleFontPreviewTextChange}
                maxLength={80}
              />
              <div className="font-detail-meta">
                <span>Size: {fontDetail.fontSize}</span>
                <span>Weight: {fontDetail.fontWeight}</span>
                <span>Style: {fontDetail.fontStyle}</span>
              </div>
              <div className="edit-actions" style={{ marginTop: '16px' }}>
                <button className="confirm-btn cancel" onClick={closeFontDetail}>Close</button>
                <button className="confirm-btn delete" onClick={handleCopyFontCss}>Copy CSS</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className="toast-banner" role="status">
          {toastMessage}
        </div>
      )}

      {renameModalOpen && renameTarget && (
        <div className="rename-backdrop" onClick={cancelRenameModal}>
          <div className="rename-card" onClick={(event) => event.stopPropagation()}>
            <div className="rename-title">Rename palette</div>
            <p className="rename-copy">Pick a new name for this saved palette.</p>
            <input
              className="rename-input"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && confirmRename()}
              autoFocus
              maxLength={30}
            />
            <div className="rename-actions">
              <button className="confirm-btn cancel" onClick={cancelRenameModal}>Cancel</button>
              <button className="confirm-btn delete" onClick={confirmRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="confirm-backdrop" onClick={cancelDelete}>
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-title">Delete palette?</div>
            <p className="confirm-copy">This action will remove the palette from your saved list. You can’t undo it.</p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={cancelDelete}>Cancel</button>
              <button className="confirm-btn delete" onClick={confirmDeletePalette}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {clearModalOpen && (
        <div className="confirm-backdrop" onClick={cancelClearModal}>
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-title">Select palettes to clear</div>
            <p className="confirm-copy">Choose which palettes to delete, or clear every saved palette at once.</p>

            <div className="clear-modal-counter">
              <span>{selectedClearIds.length} selected</span>
              <span>{palettes.length} total</span>
            </div>

            <div className="clear-selection-list">
              {palettes.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className={`clear-selection-item ${selectedClearIds.includes(palette.id) ? 'selected' : ''}`}
                  onClick={() => toggleClearSelection(palette.id)}
                >
                  <span className="clear-selection-checkbox">
                    {selectedClearIds.includes(palette.id) ? '✓' : ''}
                  </span>
                  <span>{palette.title || 'Untitled palette'}</span>
                </button>
              ))}
            </div>

            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={cancelClearModal}>Cancel</button>
              <button
                className="confirm-btn delete"
                onClick={confirmClearSelected}
                disabled={!selectedClearIds.length}
              >
                {selectedClearIds.length ? `Clear ${selectedClearIds.length}` : 'Clear selected'}
              </button>
              <button className="confirm-btn clear-all" onClick={confirmClearAllPalettes}>Clear All</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

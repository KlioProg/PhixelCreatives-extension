# Phixel Creatives Engine

Phixel is a compact, retro-inspired Chrome extension built for designers, developers, and digital creatives. Encased in a classic handheld console UI (featuring authentic 8-bit typography), Phixel is designed to be a frictionless, highly visual utility tool for web creatives.

Stop squinting at complex developer tools to find that perfect hex code. Phixel allows you to instantly scan any active webpage, extract its dominant color palette, and save it permanently to your local browser storage.

## The Tech Stack
* **React (Vite):** Core framework for state management and UI rendering.
* **Manifest V3:** The latest Chrome Extension standard for secure, optimized browser performance.
* **Pure CSS:** Custom zero-dependency styling utilizing Flexbox, CSS Grid, and pure CSS patterns to achieve a tactile hardware aesthetic.

## Development Roadmap & Issue Tracker

Phixel is currently in active development. I am building this project step by step to bridge the gap between creative UI/UX design and foundational software engineering. 

### Phase 1: The Color Engine (Complete - Ready to Try!)
**Phase 1 is officially wrapped! The core color extraction engine is fully functional, and everyone can now install and try it out.**
* **Instant Extraction:** Grab the top 5 dominant colors from any active webpage.
* **Persistent Memory:** Palettes are saved to Chrome's `local.storage`. Close the extension, refresh the page, or restart your browser—your colors are preserved.
* **Pro Dashboard Layout:** Colors are displayed as clickable ribbons on a custom drafting-grid background. 
* **One-Click Copy:** Click any color ribbon to seamlessly copy the hex code to your system clipboard.

### Phase 1.5: Advanced Interactions (Complete)
* **Pro Detail Modal:** A full-screen overlay providing deep-dive mathematical conversions (HEX, HSB, HSL, RGB, CMYK, LAB) for precise print and digital use.
* **Accordion UI Expanders:** Smooth, flex-based CSS animations for color slices on hover.
* **Palette Editor:** Swap, add, and manage custom hex codes via the native OS color picker system.

### Phase 2: Vector Module (Up Next & Accelerating)
**With the core engine complete, development is shifting into high gear for Phases 2 and 3!**
* A dedicated tab to instantly scan, preview, and download SVG vectors and icons currently rendered on the active webpage. 

### Phase 3: Font Scanner (Accelerating)
* A typography engine designed to identify and list the exact font families, weights, and styling properties used on the current site.

## Installation (Developer Preview)

Want to try out the completed Phase 1 Color Engine? You can install it locally right now:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/KlioProg/PhixelCreatives-extension.git](https://github.com/KlioProg/PhixelCreatives-extension.git)
    cd PhixelCreatives-extension
    npm install
    npm run build
    ```
2.  **Open Chrome Extensions:**
    Navigate to `chrome://extensions/` in your browser and ensure **"Developer mode"** is toggled ON in the top right corner.
3.  **Load the Extension:**
    Click **"Load unpacked"** in the top left corner, and select the `dist` folder that was just generated inside your project directory.

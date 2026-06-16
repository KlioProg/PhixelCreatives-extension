chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractColors") {
    const colors = new Set(); // Use a Set to automatically avoid duplicate colors
    
    // Grab every single HTML element on the active page
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(element => {
      // Get the computed CSS styles for each element
      const styles = window.getComputedStyle(element);
      
      const textColor = styles.color;
      const bgColor = styles.backgroundColor;
      
      // Filter out completely transparent elements
      if (textColor && textColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'transparent') {
        colors.add(textColor);
      }
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        colors.add(bgColor);
      }
    });

    // Convert the Set back to a clean array and send it back to React
    sendResponse({ colors: Array.from(colors) });
  }
});
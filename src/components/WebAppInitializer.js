import { useEffect } from 'react';

const WebAppInitializer = () => {
  useEffect(() => {
    const initializeWebApp = () => {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Check if WebApp is properly initialized
        if (!tg || typeof tg.ready !== 'function') {
          console.warn('Telegram WebApp not properly initialized');
          return;
        }
        
        console.log('Initializing Telegram WebApp...');
        
        try {
          // Configure WebApp for full screen experience
          tg.ready();
          
          // Force expand to full screen immediately
          tg.expand();
          
          // Enable closing confirmation to prevent accidental closes
          if (tg.enableClosingConfirmation) {
            tg.enableClosingConfirmation();
          }
          
          // Set header color to match app theme
          if (tg.setHeaderColor) {
            tg.setHeaderColor('#1a1a1a');
          }
          
          // Set background color
          if (tg.setBackgroundColor) {
            tg.setBackgroundColor('#1a1a1a');
          }
          
          // Set theme params for better integration
          if (tg.setThemeParams) {
            tg.setThemeParams({
              bg_color: '#1a1a1a',
              text_color: '#ffffff',
              hint_color: '#999999',
              link_color: '#2481cc',
              button_color: '#2481cc',
              button_text_color: '#ffffff'
            });
          }
          
          // Disable the back button to prevent accidental navigation
          if (tg.BackButton && tg.BackButton.hide) {
            tg.BackButton.hide();
          }
          
          // Hide main button to ensure full screen experience
          if (tg.MainButton && tg.MainButton.hide) {
            tg.MainButton.hide();
          }
        } catch (error) {
          console.error('Error initializing Telegram WebApp:', error);
        }
        
        console.log('Telegram WebApp initialized successfully');
        
        // Log WebApp info for debugging
        try {
          console.log('WebApp Info:', {
            platform: tg.platform,
            version: tg.version,
            colorScheme: tg.colorScheme,
            themeParams: tg.themeParams,
            isExpanded: tg.isExpanded,
            viewportHeight: tg.viewportHeight,
            viewportStableHeight: tg.viewportStableHeight
          });
        } catch (error) {
          console.log('Could not log WebApp info:', error);
        }
      } else {
        console.warn('Telegram WebApp not available');
      }
    };

    // Initialize immediately
    initializeWebApp();
    
    // Also initialize on window load to ensure it's called
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeWebApp);
    }
    
    // Initialize on window load as backup
    window.addEventListener('load', initializeWebApp);
    
  }, []);

  return null; // This component doesn't render anything
};

export default WebAppInitializer; 
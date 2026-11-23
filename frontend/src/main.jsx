import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ProfProvider } from './context/ProfContext.jsx';
import { LangProvider } from './context/LangContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './styles/style.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LangProvider>
          <ProfProvider>
            <App />
          </ProfProvider>
        </LangProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

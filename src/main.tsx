import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import VerifyReceiptPage from './routes/verify-receipt';
import './style.css';

const currentPath = window.location.pathname.replace(/\\/+$/, '') || '/';
const Page = currentPath === '/verify-receipt' ? VerifyReceiptPage : App;

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Page /></React.StrictMode>);

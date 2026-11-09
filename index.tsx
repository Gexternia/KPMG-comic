import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminApp } from './components/AdminApp';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname.replace(/\/+$/, '');
const isAdmin = path === '/admin' || path.startsWith('/admin/');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>
);
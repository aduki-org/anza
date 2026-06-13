/**
 * src/app.js — app entry point
 */
import '@adukiorg/anza/ui';
import { dock } from '@adukiorg/anza/ui';
import '@adukiorg/anza/theme';

// Service Worker
navigator.serviceWorker.register('/dist/sw.js', { type: 'module' });

// Layout shell
dock('main');

// Pages
import './pages/index.js';

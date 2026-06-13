/**
 * src/entry/index.js — landing page
 */
import { page } from '@adukiorg/anza/ui';

page('/', {
  tag: 'page-welcome',
  via: ['main'],
  template: { html: './index.html', css: './index.css' }
}, import.meta.url);

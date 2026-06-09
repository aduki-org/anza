/**
 * src/elements/forms/upload/index.js
 *
 * Form Control: <ui-upload>
 * Highly interactive Drag-and-Drop file uploader primitive leveraging the
 * standard core API progress-tracked upload wrapper.
 *
 * Source: doc 04 — Web Components §3, doc 11 — Networking §14
 */

import { ui } from '../../../core/ui/index.js';
import { upload } from '../../../core/api/upload.js';

ui.element('ui-upload', {
  style: './style.css',
  template: './index.html',
  props: {
    url: { type: String, reflect: true },
    multiple: { type: Boolean, reflect: true },
    accept: { type: String, reflect: true }
  },
  mount({ el, tags, on }) {
    const dropzone = tags.one('.dropzone');
    const fileInput = tags.one('input[type="file"]');

    // Click triggers hidden file selector picker
    on.click(dropzone, () => fileInput.click());

    // File selection changes
    on.change(fileInput, (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        processFiles(el, tags, files);
      }
    });

    // Drag-and-drop listener events
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((event) => {
      on[event](dropzone, prevent);
    });

    ['dragenter', 'dragover'].forEach((event) => {
      on[event](dropzone, () => dropzone.classList.add('highlight'));
    });

    ['dragleave', 'drop'].forEach((event) => {
      on[event](dropzone, () => dropzone.classList.remove('highlight'));
    });

    on.drop(dropzone, (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(el, tags, files);
      }
    });

    syncAttributes(el, tags);
  },
  update({ el, name, tags }) {
    if (name === 'multiple' || name === 'accept') {
      syncAttributes(el, tags);
    }
  }
}, import.meta.url);

function syncAttributes(el, tags) {
  const fileInput = tags.one('input[type="file"]');
  if (el.multiple) {
    fileInput.setAttribute('multiple', '');
  } else {
    fileInput.removeAttribute('multiple');
  }

  if (el.accept) {
    fileInput.setAttribute('accept', el.accept);
  } else {
    fileInput.removeAttribute('accept');
  }
}

async function processFiles(el, tags, files) {
  const url = el.url;
  if (!url) {
    el.dispatchEvent(new CustomEvent('selected', { detail: { files }, bubbles: true, composed: true }));
    return;
  }

  const progressBar = tags.one('.progress-bar');
  const progressFill = tags.one('.progress-fill');
  progressBar.style.display = 'block';

  try {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    await upload(url, formData, {
      onProgress: (p) => {
        progressFill.style.width = `${p.percentage}%`;
        el.dispatchEvent(new CustomEvent('progress', { detail: p, bubbles: true, composed: true }));
      },
      signal: el.ctrl.signal
    });

    progressFill.style.width = '100%';
    el.dispatchEvent(new CustomEvent('success', { detail: { files }, bubbles: true, composed: true }));
  } catch (err) {
    el.dispatchEvent(new CustomEvent('error', { detail: err, bubbles: true, composed: true }));
  } finally {
    setTimeout(() => {
      progressBar.style.display = 'none';
      progressFill.style.width = '0%';
    }, 1000);
  }
}

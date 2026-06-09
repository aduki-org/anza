import { assetCache } from './state.js';

// Detect constructable stylesheet + adoptedStyleSheets support once.
const supportsSheets =
  typeof CSSStyleSheet !== 'undefined' &&
  'adoptedStyleSheets' in Document.prototype &&
  'adoptedStyleSheets' in ShadowRoot.prototype;

/**
 * Preloads style and HTML template resources asynchronously exactly once.
 * Returns { templateNode, stylesheet, cssText, tagsDescriptor }.
 * When constructable stylesheets are unsupported, stylesheet is null and
 * cssText carries the raw CSS for <style> injection.
 */
export async function preloadResources(tag, styleUrl, templateUrl, inlineTemplate, inlineStyle) {
  let templateNode = null;
  let stylesheet = null;
  let cssText = null;
  let tagsDescriptor = null;

  // Compile / Fetch styles
  if (styleUrl) {
    if (assetCache.has(styleUrl)) {
      const cached = assetCache.get(styleUrl);
      if (supportsSheets) {
        stylesheet = cached;
      } else {
        cssText = cached;
      }
    } else {
      try {
        const res = await fetch(styleUrl);
        if (res.ok) {
          const css = await res.text();
          if (supportsSheets) {
            stylesheet = new CSSStyleSheet();
            stylesheet.replaceSync(css);
            assetCache.set(styleUrl, stylesheet);
          } else {
            cssText = css;
            assetCache.set(styleUrl, css);
          }
        }
      } catch (err) {
        console.error(`Failed to load style resource for element ${tag}:`, err);
      }
    }
  } else if (inlineStyle) {
    if (supportsSheets) {
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineStyle);
    } else {
      cssText = inlineStyle;
    }
  }

  // Compile / Fetch Template markup
  if (templateUrl) {
    if (assetCache.has(templateUrl)) {
      templateNode = assetCache.get(templateUrl);
    } else {
      try {
        const res = await fetch(templateUrl);
        if (res.ok) {
          const html = await res.text();
          templateNode = createTemplateFragment(html);
          assetCache.set(templateUrl, templateNode);
        }
      } catch (err) {
        console.error(`Failed to fetch template resource for element ${tag}:`, err);
      }
    }

    // Fetch Tags Descriptor
    const tagsUrl = templateUrl.replace(/\.html$/, '.tags.json');
    if (assetCache.has(tagsUrl)) {
      tagsDescriptor = assetCache.get(tagsUrl);
    } else {
      try {
        const res = await fetch(tagsUrl);
        if (res.ok) {
          const raw = await res.json();
          tagsDescriptor = validateDescriptor(raw);
          assetCache.set(tagsUrl, tagsDescriptor);
        }
      } catch (_) {
        // Safe to ignore — not all elements have a tags descriptor
      }
    }
  } else if (inlineTemplate) {
    templateNode = createTemplateFragment(inlineTemplate);
  }

  return { templateNode, stylesheet, cssText, tagsDescriptor };
}

/**
 * Validates a raw tags descriptor JSON object.
 * Returns a safe descriptor with only array-typed fields, or null if unusable.
 */
export function validateDescriptor(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const safe = {};
  if (typeof raw.version === 'number') safe.version = raw.version;

  const known = new Set(['version', 'refs', 'ids', 'classes', 'tags', 'compound']);

  for (const field of ['refs', 'ids', 'classes', 'tags', 'compound']) {
    safe[field] = Array.isArray(raw[field]) ? raw[field] : [];
  }

  // Preserve unknown future fields without mutating them
  for (const [k, v] of Object.entries(raw)) {
    if (!known.has(k)) {
      safe[k] = v;
    }
  }

  return safe;
}

/**
 * Compiles an HTML string into a DocumentFragment utilizing the fastest native methods.
 */
export function createTemplateFragment(htmlString) {
  const tpl = document.createElement('template');
  if (typeof tpl.setHTMLUnsafe === 'function') {
    tpl.setHTMLUnsafe(htmlString);
  } else {
    tpl.innerHTML = htmlString;
  }
  return tpl.content;
}

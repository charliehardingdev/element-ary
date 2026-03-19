// Store the last right-clicked element
let lastRightClickedElement = null;

const SENSITIVE_INPUT_TYPES = new Set([
  'password',
  'email',
  'tel',
  'number',
  'search',
  'url',
  'hidden'
]);

const SENSITIVE_ATTRIBUTES = new Set([
  'value',
  'srcdoc',
  'ping'
]);

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:')) return '[data-url-redacted]';
  if (rawUrl.startsWith('blob:')) return '[blob-url-redacted]';
  if (rawUrl.startsWith('javascript:')) return '[javascript-url-redacted]';

  try {
    const parsed = new URL(rawUrl, window.location.href);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    if (rawUrl.startsWith('#')) return '[anchor-link]';
    return rawUrl;
  }
}

function redactValue(value, label = 'redacted') {
  if (!value) return '';
  return `[${label}]`;
}

function sanitizeSrcset(srcset) {
  if (!srcset) return '';
  return srcset
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [urlPart, ...descriptorParts] = entry.split(/\s+/);
      const sanitizedUrl = sanitizeUrl(urlPart);
      return [sanitizedUrl, ...descriptorParts].filter(Boolean).join(' ');
    })
    .join(', ');
}

function sanitizeElementHtml(element) {
  if (!element?.cloneNode) return '';

  const clone = element.cloneNode(true);
  const elements = [clone, ...clone.querySelectorAll('*')];

  elements.forEach(node => {
    if (!node.getAttributeNames) return;

    const tagName = node.tagName?.toLowerCase() || '';
    const inputType = (node.getAttribute('type') || '').toLowerCase();

    node.getAttributeNames().forEach(attrName => {
      const attrValue = node.getAttribute(attrName);

      if (SENSITIVE_ATTRIBUTES.has(attrName)) {
        node.setAttribute(attrName, redactValue(attrValue));
        return;
      }

      if (attrName === 'href' || attrName === 'src' || attrName === 'action' || attrName === 'formaction' || attrName === 'poster') {
        node.setAttribute(attrName, sanitizeUrl(attrValue));
        return;
      }

      if (attrName === 'srcset') {
        node.setAttribute(attrName, sanitizeSrcset(attrValue));
        return;
      }

      if (attrName === 'type' && tagName === 'input' && SENSITIVE_INPUT_TYPES.has(inputType)) {
        if (node.hasAttribute('value')) {
          node.setAttribute('value', redactValue(attrValue));
        }
      }
    });

    if (tagName === 'textarea') {
      node.textContent = redactValue(node.textContent);
    }

    if (tagName === 'input' && SENSITIVE_INPUT_TYPES.has(inputType) && node.hasAttribute('value')) {
      node.setAttribute('value', '[redacted]');
    }
  });

  return clone.outerHTML || '';
}

// Function to get DOM path (CSS selector path) for an element
function getDOMPath(element) {
  if (!element || element.nodeType !== 1) return '';
  
  const path = [];
  let current = element;
  
  while (current && current.nodeType === 1) {
    let selector = current.nodeName.toLowerCase();
    
    // Add ID if present
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break; // ID should be unique, so we can stop here
    }
    
    // Add class names if present (handle both string and SVGAnimatedString)
    let className = '';
    if (current.className) {
      if (typeof current.className === 'string') {
        className = current.className;
      } else if (current.className.baseVal) {
        // SVG element
        className = current.className.baseVal;
      }
    }
    
    if (className) {
      const classes = className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      if (siblings.length > 1) {
        selector += `:nth-child(${index})`;
      }
    }
    
    path.unshift(selector);
    current = parent;
  }
  
  return path.join(' > ');
}

// Function to get image-specific information
function getImageInfo(imgElement) {
  if (!imgElement || imgElement.tagName !== 'IMG') return null;
  
  const info = {
    src: sanitizeUrl(imgElement.src || imgElement.getAttribute('src') || ''),
    srcset: sanitizeSrcset(imgElement.srcset || imgElement.getAttribute('srcset') || ''),
    sizes: imgElement.sizes || imgElement.getAttribute('sizes') || '',
    alt: imgElement.alt || '',
    title: imgElement.title || '',
    naturalWidth: imgElement.naturalWidth || 0,
    naturalHeight: imgElement.naturalHeight || 0,
    displayWidth: imgElement.width || imgElement.offsetWidth || 0,
    displayHeight: imgElement.height || imgElement.offsetHeight || 0,
    loading: imgElement.loading || 'eager',
    decoding: imgElement.decoding || 'auto',
    isDataUrl: false,
    isComplete: imgElement.complete || false,
    crossOrigin: imgElement.crossOrigin || null,
    referrerPolicy: imgElement.referrerPolicy || ''
  };
  
  // Check if it's a data URL
  if (info.src.startsWith('data:')) {
    info.isDataUrl = true;
      const dataUrlMatch = info.src.match(/^data:([^;]+);/);
      if (dataUrlMatch) {
        info.dataUrlType = dataUrlMatch[1];
        // Estimate data URL size (rough approximation)
        const commaIndex = info.src.indexOf(',');
        if (commaIndex !== -1) {
          const base64Length = info.src.length - commaIndex - 1;
          info.dataUrlSizeKB = Math.round((base64Length * 3) / 4 / 1024);
        }
      }
  } else {
    // Extract file extension from URL
    const urlMatch = info.src.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (urlMatch) {
      info.fileExtension = urlMatch[1].toLowerCase();
    }
  }
  
  return info;
}

// Function to format image information
function formatImageInfo(imgInfo) {
  let output = 'Image Information:\n';
  output += `Source URL: ${imgInfo.src}\n`;
  
  // Handle srcset (responsive images)
  if (imgInfo.srcset) {
    output += `\nResponsive Images (srcset):\n`;
    const srcsetEntries = imgInfo.srcset.split(',').map(s => s.trim());
    srcsetEntries.forEach((entry, index) => {
      output += `  ${index + 1}. ${entry}\n`;
    });
    
    if (imgInfo.sizes) {
      output += `Sizes Attribute: ${imgInfo.sizes}\n`;
    }
  }
  
  if (imgInfo.alt) {
    output += `\nAlt Text: ${imgInfo.alt}\n`;
  }
  
  if (imgInfo.title) {
    output += `Title: ${imgInfo.title}\n`;
  }
  
  output += `\nDimensions:\n`;
  if (imgInfo.naturalWidth > 0 && imgInfo.naturalHeight > 0) {
    output += `  Natural Size: ${imgInfo.naturalWidth} × ${imgInfo.naturalHeight}px\n`;
    
    if (imgInfo.displayWidth !== imgInfo.naturalWidth || 
        imgInfo.displayHeight !== imgInfo.naturalHeight) {
      output += `  Display Size: ${imgInfo.displayWidth} × ${imgInfo.displayHeight}px\n`;
      const scaleX = imgInfo.naturalWidth > 0 
        ? ((imgInfo.displayWidth / imgInfo.naturalWidth) * 100).toFixed(1)
        : 'N/A';
      const scaleY = imgInfo.naturalHeight > 0
        ? ((imgInfo.displayHeight / imgInfo.naturalHeight) * 100).toFixed(1)
        : 'N/A';
      output += `  Scale: ${scaleX}% × ${scaleY}%\n`;
    }
  } else {
    output += `  Natural Size: Not loaded yet or unavailable\n`;
    output += `  Display Size: ${imgInfo.displayWidth} × ${imgInfo.displayHeight}px\n`;
  }
  
  if (imgInfo.isDataUrl) {
    output += `\nData URL:\n`;
    output += `  Type: ${imgInfo.dataUrlType || 'unknown'}\n`;
    if (imgInfo.dataUrlSizeKB) {
      output += `  Size: ~${imgInfo.dataUrlSizeKB} KB\n`;
    }
    output += `  (Full data URL truncated in output)\n`;
  } else {
    if (imgInfo.fileExtension) {
      output += `\nFile Format: ${imgInfo.fileExtension.toUpperCase()}\n`;
    }
  }
  
  output += `\nAttributes:\n`;
  output += `  Loading: ${imgInfo.loading}\n`;
  output += `  Decoding: ${imgInfo.decoding}\n`;
  output += `  Loaded: ${imgInfo.isComplete ? 'Yes ✓' : 'No (still loading)'}\n`;
  
  if (imgInfo.crossOrigin) {
    output += `  Cross-Origin: ${imgInfo.crossOrigin}\n`;
  }
  
  if (imgInfo.referrerPolicy) {
    output += `  Referrer Policy: ${imgInfo.referrerPolicy}\n`;
  }
  
  return output;
}

// Function to find image element (handles picture elements and nested images)
function findImageElement(element) {
  if (!element) return null;
  
  // Direct img element
  if (element.tagName === 'IMG') {
    return element;
  }
  
  // Picture element - find the img inside
  if (element.tagName === 'PICTURE') {
    const img = element.querySelector('img');
    if (img) return img;
  }
  
  // Check if element contains an img
  if (element.querySelector) {
    const img = element.querySelector('img');
    if (img && img.parentElement === element) {
      // Only return if it's a direct child (not deeply nested)
      return img;
    }
  }
  
  // Check for background image
  const bgImage = window.getComputedStyle(element).backgroundImage;
  if (bgImage && bgImage !== 'none') {
    return { isBackgroundImage: true, url: bgImage };
  }
  
  return null;
}

// Function to format background image info
function formatBackgroundImageInfo(bgInfo) {
  let output = 'Background Image Information:\n';
  
  // Extract URL from CSS background-image value
  const urlMatch = bgInfo.url.match(/url\(['"]?([^'"]+)['"]?\)/);
  if (urlMatch) {
    const bgUrl = sanitizeUrl(urlMatch[1]);
    output += `Source URL: ${bgUrl}\n`;
    
    if (bgUrl.startsWith('data:')) {
      output += `Type: Data URL\n`;
    } else {
      const urlMatch2 = bgUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      if (urlMatch2) {
        output += `File Format: ${urlMatch2[1].toUpperCase()}\n`;
      }
    }
  }
  
  return output;
}

// Function to get link-specific information
function getLinkInfo(linkElement) {
  if (!linkElement || linkElement.tagName !== 'A') return null;
  
  const info = {
    href: sanitizeUrl(linkElement.href || linkElement.getAttribute('href') || ''),
    text: linkElement.textContent?.trim() || '',
    target: linkElement.target || '_self',
    rel: linkElement.rel || '',
    download: linkElement.download || null,
    type: linkElement.type || null,
    hreflang: linkElement.hreflang || null,
    ping: linkElement.ping || null
  };
  
  // Determine if it's an external link
  if (info.href) {
    try {
      const linkUrl = new URL(info.href, window.location.href);
      info.isExternal = linkUrl.origin !== window.location.origin;
      info.protocol = linkUrl.protocol.replace(':', '');
      info.isMailto = info.protocol === 'mailto';
      info.isTel = info.protocol === 'tel';
      // Check if it's an anchor link (starts with # or has hash with same origin)
      info.isAnchor = linkUrl.hash && (
        info.href.startsWith('#') || 
        (linkUrl.origin === window.location.origin && linkUrl.pathname === window.location.pathname)
      );
    } catch (e) {
      // Invalid URL, might be a relative path or anchor
      info.isAnchor = info.href.startsWith('#');
    }
  }
  
  return info;
}

// Function to format link information
function formatLinkInfo(linkInfo) {
  let output = 'Link Information:\n';
  output += `URL: ${linkInfo.href}\n`;
  
  if (linkInfo.text) {
    output += `Link Text: ${linkInfo.text}\n`;
  }
  
  if (linkInfo.isExternal) {
    output += `Type: External Link\n`;
  } else if (linkInfo.isAnchor) {
    output += `Type: Anchor Link (same page)\n`;
  } else if (linkInfo.isMailto) {
    output += `Type: Email Link\n`;
  } else if (linkInfo.isTel) {
    output += `Type: Phone Link\n`;
  } else {
    output += `Type: Internal Link\n`;
  }
  
  if (linkInfo.target && linkInfo.target !== '_self') {
    output += `Target: ${linkInfo.target}\n`;
  }
  
  if (linkInfo.rel) {
    output += `Rel: ${linkInfo.rel}\n`;
  }
  
  if (linkInfo.download) {
    output += `Download: ${linkInfo.download}\n`;
  }
  
  if (linkInfo.type) {
    output += `Type Attribute: ${linkInfo.type}\n`;
  }
  
  return output;
}

// Function to get form element information
function getFormElementInfo(formElement) {
  if (!formElement || !formElement.tagName) return null;
  const tagName = formElement.tagName;
  
  if (tagName === 'INPUT') {
    return {
      type: 'input',
      inputType: formElement.type || 'text',
      name: formElement.name || '',
      value: SENSITIVE_INPUT_TYPES.has((formElement.type || 'text').toLowerCase())
        ? redactValue(formElement.value)
        : '',
      placeholder: formElement.placeholder || '',
      required: formElement.required || false,
      disabled: formElement.disabled || false,
      readonly: formElement.readOnly || false,
      checked: formElement.checked || false,
      min: formElement.min || null,
      max: formElement.max || null,
      step: formElement.step || null,
      pattern: formElement.pattern || null,
      maxLength: formElement.maxLength || -1,
      autocomplete: formElement.autocomplete || ''
    };
  } else if (tagName === 'TEXTAREA') {
    return {
      type: 'textarea',
      name: formElement.name || '',
      value: redactValue(formElement.value),
      placeholder: formElement.placeholder || '',
      required: formElement.required || false,
      disabled: formElement.disabled || false,
      readonly: formElement.readOnly || false,
      rows: formElement.rows || null,
      cols: formElement.cols || null,
      maxLength: formElement.maxLength || -1
    };
  } else if (tagName === 'SELECT') {
    const options = Array.from(formElement.options);
    return {
      type: 'select',
      name: formElement.name || '',
      value: redactValue(formElement.value, 'selected-value-redacted'),
      required: formElement.required || false,
      disabled: formElement.disabled || false,
      multiple: formElement.multiple || false,
      optionCount: options.length,
      selectedCount: options.filter(opt => opt.selected).length
    };
  } else if (tagName === 'BUTTON') {
    return {
      type: 'button',
      buttonType: formElement.type || 'button',
      text: formElement.textContent?.trim() || '',
      disabled: formElement.disabled || false,
      form: formElement.form?.id || null,
      formAction: sanitizeUrl(formElement.formAction || ''),
      formMethod: formElement.formMethod || null
    };
  } else if (tagName === 'FORM') {
    const inputs = formElement.querySelectorAll('input, textarea, select, button');
    return {
      type: 'form',
      action: sanitizeUrl(formElement.action || ''),
      method: formElement.method || 'get',
      enctype: formElement.enctype || 'application/x-www-form-urlencoded',
      target: formElement.target || '_self',
      autocomplete: formElement.autocomplete || '',
      inputCount: inputs.length,
      novalidate: formElement.noValidate || false
    };
  }
  
  return null;
}

// Function to format form element information
function formatFormElementInfo(formInfo) {
  if (!formInfo) return '';
  
  let output = `${formInfo.type.charAt(0).toUpperCase() + formInfo.type.slice(1)} Element Information:\n`;
  
  if (formInfo.type === 'input') {
    output += `Type: ${formInfo.inputType}\n`;
    if (formInfo.name) output += `Name: ${formInfo.name}\n`;
    if (formInfo.value) output += `Value: ${formInfo.value}\n`;
    if (formInfo.placeholder) output += `Placeholder: ${formInfo.placeholder}\n`;
    if (formInfo.required) output += `Required: Yes\n`;
    if (formInfo.disabled) output += `Disabled: Yes\n`;
    if (formInfo.readonly) output += `Readonly: Yes\n`;
    if (formInfo.inputType === 'checkbox' || formInfo.inputType === 'radio') {
      output += `Checked: ${formInfo.checked ? 'Yes' : 'No'}\n`;
    }
    if (formInfo.min !== null) output += `Min: ${formInfo.min}\n`;
    if (formInfo.max !== null) output += `Max: ${formInfo.max}\n`;
    if (formInfo.step !== null) output += `Step: ${formInfo.step}\n`;
    if (formInfo.pattern) output += `Pattern: ${formInfo.pattern}\n`;
    if (formInfo.maxLength > 0) output += `Max Length: ${formInfo.maxLength}\n`;
    if (formInfo.autocomplete) output += `Autocomplete: ${formInfo.autocomplete}\n`;
  } else if (formInfo.type === 'textarea') {
    if (formInfo.name) output += `Name: ${formInfo.name}\n`;
    if (formInfo.value) {
      const valueStr = String(formInfo.value);
      output += `Value: ${valueStr.substring(0, 100)}${valueStr.length > 100 ? '...' : ''}\n`;
    }
    if (formInfo.placeholder) output += `Placeholder: ${formInfo.placeholder}\n`;
    if (formInfo.rows) output += `Rows: ${formInfo.rows}\n`;
    if (formInfo.cols) output += `Cols: ${formInfo.cols}\n`;
    if (formInfo.maxLength > 0) output += `Max Length: ${formInfo.maxLength}\n`;
    if (formInfo.required) output += `Required: Yes\n`;
    if (formInfo.disabled) output += `Disabled: Yes\n`;
  } else if (formInfo.type === 'select') {
    if (formInfo.name) output += `Name: ${formInfo.name}\n`;
    output += `Value: ${formInfo.value}\n`;
    output += `Options: ${formInfo.optionCount}\n`;
    output += `Selected: ${formInfo.selectedCount}\n`;
    if (formInfo.multiple) output += `Multiple: Yes\n`;
    if (formInfo.required) output += `Required: Yes\n`;
  } else if (formInfo.type === 'button') {
    output += `Button Type: ${formInfo.buttonType}\n`;
    if (formInfo.text) output += `Text: ${formInfo.text}\n`;
    if (formInfo.disabled) output += `Disabled: Yes\n`;
    if (formInfo.form) output += `Form ID: ${formInfo.form}\n`;
    if (formInfo.formAction) output += `Form Action: ${formInfo.formAction}\n`;
  } else if (formInfo.type === 'form') {
    output += `Action: ${formInfo.action || '(none)'}\n`;
    output += `Method: ${formInfo.method.toUpperCase()}\n`;
    output += `Enctype: ${formInfo.enctype}\n`;
    output += `Target: ${formInfo.target}\n`;
    output += `Input Fields: ${formInfo.inputCount}\n`;
    if (formInfo.novalidate) output += `No Validate: Yes\n`;
  }
  
  return output;
}

// Function to get media element information (video/audio)
function getMediaInfo(mediaElement) {
  if (!mediaElement || !mediaElement.tagName) return null;
  const tagName = mediaElement.tagName;
  if (tagName !== 'VIDEO' && tagName !== 'AUDIO') return null;
  
  return {
    type: tagName.toLowerCase(),
    src: sanitizeUrl(mediaElement.src || mediaElement.currentSrc || ''),
    sources: Array.from(mediaElement.querySelectorAll('source')).map(s => ({
      src: sanitizeUrl(s.src || s.getAttribute('src') || ''),
      type: s.type || '',
      media: s.media || ''
    })),
    poster: sanitizeUrl(mediaElement.poster || ''),
    controls: mediaElement.controls || false,
    autoplay: mediaElement.autoplay || false,
    loop: mediaElement.loop || false,
    muted: mediaElement.muted || false,
    preload: mediaElement.preload || 'metadata',
    currentTime: mediaElement.currentTime || 0,
    duration: mediaElement.duration || 0,
    paused: mediaElement.paused !== undefined ? mediaElement.paused : null,
    volume: mediaElement.volume !== undefined ? mediaElement.volume : null,
    width: tagName === 'VIDEO' ? (mediaElement.videoWidth || mediaElement.width || 0) : null,
    height: tagName === 'VIDEO' ? (mediaElement.videoHeight || mediaElement.height || 0) : null
  };
}

// Function to format media information
function formatMediaInfo(mediaInfo) {
  let output = `${mediaInfo.type.charAt(0).toUpperCase() + mediaInfo.type.slice(1)} Element Information:\n`;
  
  if (mediaInfo.src) {
    output += `Source: ${mediaInfo.src}\n`;
  }
  
  if (mediaInfo.sources.length > 0) {
    output += `\nSource Elements (${mediaInfo.sources.length}):\n`;
    mediaInfo.sources.forEach((src, i) => {
      output += `  ${i + 1}. ${src.src || '(no src)'}\n`;
      if (src.type) output += `     Type: ${src.type}\n`;
      if (src.media) output += `     Media: ${src.media}\n`;
    });
  }
  
  if (mediaInfo.type === 'video' && mediaInfo.poster) {
    output += `Poster Image: ${mediaInfo.poster}\n`;
  }
  
  if (mediaInfo.type === 'video') {
    output += `\nDimensions:\n`;
    output += `  Width: ${mediaInfo.width}px\n`;
    output += `  Height: ${mediaInfo.height}px\n`;
  }
  
  output += `\nAttributes:\n`;
  output += `  Controls: ${mediaInfo.controls ? 'Yes' : 'No'}\n`;
  output += `  Autoplay: ${mediaInfo.autoplay ? 'Yes' : 'No'}\n`;
  output += `  Loop: ${mediaInfo.loop ? 'Yes' : 'No'}\n`;
  output += `  Muted: ${mediaInfo.muted ? 'Yes' : 'No'}\n`;
  output += `  Preload: ${mediaInfo.preload}\n`;
  
  if (mediaInfo.duration > 0) {
    const minutes = Math.floor(mediaInfo.duration / 60);
    const seconds = Math.floor(mediaInfo.duration % 60);
    output += `\nPlayback:\n`;
    output += `  Duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
    if (mediaInfo.currentTime > 0) {
      const currMin = Math.floor(mediaInfo.currentTime / 60);
      const currSec = Math.floor(mediaInfo.currentTime % 60);
      output += `  Current Time: ${currMin}:${currSec.toString().padStart(2, '0')}\n`;
    }
    if (mediaInfo.paused !== null) {
      output += `  Status: ${mediaInfo.paused ? 'Paused' : 'Playing'}\n`;
    }
    if (mediaInfo.volume !== null) {
      output += `  Volume: ${Math.round(mediaInfo.volume * 100)}%\n`;
    }
  }
  
  return output;
}

// Function to get iframe information
function getIframeInfo(iframeElement) {
  if (!iframeElement || !iframeElement.tagName || iframeElement.tagName !== 'IFRAME') return null;
  
  return {
    src: sanitizeUrl(iframeElement.src || iframeElement.getAttribute('src') || ''),
    title: iframeElement.title || '',
    width: iframeElement.width || iframeElement.offsetWidth || 0,
    height: iframeElement.height || iframeElement.offsetHeight || 0,
    sandbox: iframeElement.sandbox?.toString() || null,
    allow: iframeElement.allow || null,
    loading: iframeElement.loading || 'eager',
    referrerPolicy: iframeElement.referrerPolicy || null
  };
}

// Function to format iframe information
function formatIframeInfo(iframeInfo) {
  let output = 'Iframe Information:\n';
  output += `Source: ${iframeInfo.src}\n`;
  
  if (iframeInfo.title) {
    output += `Title: ${iframeInfo.title}\n`;
  }
  
  output += `\nDimensions:\n`;
  output += `  Width: ${iframeInfo.width}px\n`;
  output += `  Height: ${iframeInfo.height}px\n`;
  
  if (iframeInfo.sandbox) {
    output += `\nSandbox: ${iframeInfo.sandbox}\n`;
  }
  
  if (iframeInfo.allow) {
    output += `Allow: ${iframeInfo.allow}\n`;
  }
  
  output += `Loading: ${iframeInfo.loading}\n`;
  
  if (iframeInfo.referrerPolicy) {
    output += `Referrer Policy: ${iframeInfo.referrerPolicy}\n`;
  }
  
  return output;
}

// Function to get table information
function getTableInfo(tableElement) {
  if (!tableElement || !tableElement.tagName) return null;
  const tagName = tableElement.tagName;
  if (tagName !== 'TABLE' && tagName !== 'THEAD' && tagName !== 'TBODY' && 
      tagName !== 'TFOOT' && tagName !== 'TR' && tagName !== 'TD' && tagName !== 'TH') {
    return null;
  }
  
  // Find the table element
  let table = tableElement;
  if (tagName !== 'TABLE') {
    table = tableElement.closest('table');
  }
  
  if (!table) return null;
  
  const rows = table.querySelectorAll('tr');
  const headers = table.querySelectorAll('th');
  const cells = table.querySelectorAll('td');
  
  return {
    type: tagName.toLowerCase(),
    rowCount: rows.length,
    headerCount: headers.length,
    cellCount: cells.length,
    hasHead: !!table.querySelector('thead'),
    hasBody: !!table.querySelector('tbody'),
    hasFoot: !!table.querySelector('tfoot'),
    caption: table.querySelector('caption')?.textContent?.trim() || null
  };
}

// Function to format table information
function formatTableInfo(tableInfo) {
  let output = 'Table Information:\n';
  output += `Rows: ${tableInfo.rowCount}\n`;
  output += `Header Cells: ${tableInfo.headerCount}\n`;
  output += `Data Cells: ${tableInfo.cellCount}\n`;
  
  if (tableInfo.hasHead) output += `Has THEAD: Yes\n`;
  if (tableInfo.hasBody) output += `Has TBODY: Yes\n`;
  if (tableInfo.hasFoot) output += `Has TFOOT: Yes\n`;
  if (tableInfo.caption) output += `Caption: ${tableInfo.caption}\n`;
  
  return output;
}

// Function to get list information
function getListInfo(listElement) {
  if (!listElement || !listElement.tagName) return null;
  const tagName = listElement.tagName;
  if (tagName !== 'UL' && tagName !== 'OL' && tagName !== 'DL') return null;
  
  const items = tagName === 'DL' 
    ? listElement.querySelectorAll('dt, dd')
    : listElement.querySelectorAll('li');
  
  return {
    type: tagName.toLowerCase(),
    itemCount: items.length,
    start: tagName === 'OL' ? (listElement.start || 1) : null,
    reversed: tagName === 'OL' ? listElement.reversed : false,
    markerType: tagName === 'OL' ? (listElement.type || '1') : (listElement.type || 'disc')
  };
}

// Function to format list information
function formatListInfo(listInfo) {
  let output = `${listInfo.type.toUpperCase()} List Information:\n`;
  output += `Items: ${listInfo.itemCount}\n`;
  
  if (listInfo.type === 'ol') {
    if (listInfo.start !== null && listInfo.start !== 1) {
      output += `Start: ${listInfo.start}\n`;
    }
    if (listInfo.reversed) {
      output += `Reversed: Yes\n`;
    }
    output += `Type: ${listInfo.markerType}\n`;
  } else if (listInfo.type === 'ul') {
    output += `Marker Type: ${listInfo.markerType}\n`;
  }
  
  return output;
}

// Function to get heading information
function getHeadingInfo(headingElement) {
  if (!headingElement || !headingElement.tagName) return null;
  const tagName = headingElement.tagName;
  if (!tagName.match(/^H[1-6]$/)) return null;
  
  return {
    level: parseInt(tagName.charAt(1)),
    text: headingElement.textContent?.trim() || '',
    id: headingElement.id || null
  };
}

// Function to format heading information
function formatHeadingInfo(headingInfo) {
  let output = `Heading (H${headingInfo.level}) Information:\n`;
  output += `Text: ${headingInfo.text}\n`;
  if (headingInfo.id) {
    output += `ID: ${headingInfo.id}\n`;
  }
  return output;
}

// Function to get element contents
function getElementContents(element) {
  if (!element) return '';
  
  // Check for background images first
  let bgImage = null;
  try {
    bgImage = window.getComputedStyle(element).backgroundImage;
  } catch (e) {
    // Element might not be in the DOM or stylesheet access denied
    console.warn('Could not get computed style:', e);
  }
  
  if (bgImage && bgImage !== 'none' && element.tagName !== 'IMG') {
    const bgInfo = { isBackgroundImage: true, url: bgImage };
    let output = formatBackgroundImageInfo(bgInfo);
    
    const textContent = element.textContent || element.innerText || '';
    const htmlContent = element.outerHTML || '';
    
    if (htmlContent.length <= 800) {
      output += `\nHTML:\n${htmlContent}`;
    } else {
      output += `\nHTML: (too long, showing background image info only)`;
    }
    
    if (textContent.trim()) {
      output += `\n\nText Content: ${textContent.trim()}`;
    }
    
    return output;
  }
  
  // Special handling for images and picture elements
  const imgElement = findImageElement(element);
  if (imgElement && !imgElement.isBackgroundImage) {
    const imgInfo = getImageInfo(imgElement);
    if (imgInfo) {
      let output = formatImageInfo(imgInfo);
      
      // Include HTML tag (shortened if data URL is present)
      let htmlContent = sanitizeElementHtml(element);
      if (imgInfo.isDataUrl && htmlContent.length > 500) {
        // Truncate data URL in HTML for readability
        const truncatedSrc = imgInfo.src.substring(0, 100) + '...[data URL truncated]...';
        htmlContent = htmlContent.replace(imgInfo.src, truncatedSrc);
      }
      
      if (htmlContent.length <= 1000) {
        output += `\nHTML:\n${htmlContent}`;
      } else {
        output += `\nHTML: (too long, showing image info only)`;
      }
      
      return output;
    }
  }
  
  // Check for links
  if (element.tagName === 'A') {
    const linkInfo = getLinkInfo(element);
    if (linkInfo) {
      let output = formatLinkInfo(linkInfo);
      const htmlContent = sanitizeElementHtml(element);
      if (htmlContent.length <= 800) {
        output += `\nHTML:\n${htmlContent}`;
      }
      return output;
    }
  }
  
  // Check for form elements
  const formInfo = getFormElementInfo(element);
  if (formInfo) {
    let output = formatFormElementInfo(formInfo);
      const htmlContent = sanitizeElementHtml(element);
    if (htmlContent.length <= 800) {
      output += `\nHTML:\n${htmlContent}`;
    }
    return output;
  }
  
  // Check for media elements (video/audio)
  const mediaInfo = getMediaInfo(element);
  if (mediaInfo) {
    let output = formatMediaInfo(mediaInfo);
      const htmlContent = sanitizeElementHtml(element);
    if (htmlContent.length <= 1000) {
      output += `\nHTML:\n${htmlContent}`;
    }
    return output;
  }
  
  // Check for iframes
  const iframeInfo = getIframeInfo(element);
  if (iframeInfo) {
    let output = formatIframeInfo(iframeInfo);
      const htmlContent = sanitizeElementHtml(element);
    if (htmlContent.length <= 800) {
      output += `\nHTML:\n${htmlContent}`;
    }
    return output;
  }
  
  // Check for tables
  const tableInfo = getTableInfo(element);
  if (tableInfo) {
    let output = formatTableInfo(tableInfo);
    const textContent = element.textContent || element.innerText || '';
    const htmlContent = sanitizeElementHtml(element);
    
    if (htmlContent.length <= 1000) {
      output += `\nHTML:\n${htmlContent}`;
    } else {
      output += `\nHTML: (too long, showing table info only)`;
    }
    
    if (textContent && textContent.trim()) {
      const trimmedText = textContent.trim();
      output += `\n\nText Content: ${trimmedText.substring(0, 200)}${trimmedText.length > 200 ? '...' : ''}`;
    }
    
    return output;
  }
  
  // Check for lists
  const listInfo = getListInfo(element);
  if (listInfo) {
    let output = formatListInfo(listInfo);
    const htmlContent = sanitizeElementHtml(element);
    if (htmlContent.length <= 1000) {
      output += `\nHTML:\n${htmlContent}`;
    }
    return output;
  }
  
  // Check for headings
  const headingInfo = getHeadingInfo(element);
  if (headingInfo) {
    let output = formatHeadingInfo(headingInfo);
    const htmlContent = sanitizeElementHtml(element);
    if (htmlContent.length <= 500) {
      output += `\nHTML:\n${htmlContent}`;
    }
    return output;
  }
  
  // Regular element handling (default)
  const textContent = element.textContent || element.innerText || '';
  
  // Also get HTML if it's not too long (limit to 1000 chars for clipboard)
  const htmlContent = sanitizeElementHtml(element);
  
  if (htmlContent.length <= 1000) {
    return `HTML: ${htmlContent}\n\nText: ${textContent.trim()}`;
  } else {
    return `Text: ${textContent.trim()}\n\n(HTML too long, showing text only)`;
  }
}

// Capture right-click events to store the element
document.addEventListener('contextmenu', (event) => {
  lastRightClickedElement = event.target;
}, true);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getElementInfo") {
    // Return true to keep message channel open for async clipboard operation
    // Note: Chrome will throw if sendResponse is called twice, so we track it defensively
    let responseSent = false;
    
    try {
      let element = lastRightClickedElement;
      
      // Fallback: try to get element at coordinates if stored element is not available
      // Note: elementFromPoint uses viewport coordinates, but we primarily rely on
      // lastRightClickedElement captured from the contextmenu event
      if (!element && request.clickX !== undefined && request.clickY !== undefined) {
        // Convert page coordinates to viewport coordinates if needed
        const viewportX = request.clickX - window.pageXOffset;
        const viewportY = request.clickY - window.pageYOffset;
        element = document.elementFromPoint(viewportX, viewportY);
      }
      
      if (!element) {
        sendResponse({
          success: false,
          error: "Could not find element"
        });
        return false; // Synchronous response sent
      }
      
      // Get element info
      const contents = getElementContents(element);
      const domPath = getDOMPath(element);
      const url = sanitizeUrl(window.location.href);
      
      // Format the output
      const output = `Element Contents:
${contents}

DOM Path:
${domPath}

Page URL:
${url}`;

      // Copy to clipboard (async operation)
      // Note: clipboard API requires HTTPS or localhost
      navigator.clipboard.writeText(output).then(() => {
        console.log("Element info copied to clipboard");
        if (!responseSent) {
          sendResponse({
            success: true,
            contents: contents,
            domPath: domPath,
            url: url
          });
          responseSent = true;
        }
      }).catch(err => {
        console.error("Failed to copy to clipboard:", err);
        // Fallback: try using execCommand for older browsers/HTTP pages
        try {
          // Ensure document.body exists
          if (!document.body) {
            throw new Error("Document body not available");
          }
          
          const textArea = document.createElement('textarea');
          textArea.value = output;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '0';
          textArea.setAttribute('readonly', '');
          document.body.appendChild(textArea);
          textArea.select();
          textArea.setSelectionRange(0, output.length); // For mobile devices
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            console.log("Element info copied using fallback method");
            if (!responseSent) {
              sendResponse({
                success: true,
                contents: contents,
                domPath: domPath,
                url: url,
                fallback: true
              });
              responseSent = true;
            }
          } else {
            if (!responseSent) {
              sendResponse({
                success: false,
                error: "Failed to copy to clipboard. Clipboard access may require HTTPS."
              });
              responseSent = true;
            }
          }
        } catch (fallbackErr) {
          if (!responseSent) {
            sendResponse({
              success: false,
              error: `Failed to copy: ${fallbackErr.message}. Clipboard access may require HTTPS.`
            });
            responseSent = true;
          }
        }
      });
      
      return true; // Keep message channel open for async clipboard operation
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
      return false; // Error response sent synchronously
    }
  }
  
  return false; // Not handling this action
});

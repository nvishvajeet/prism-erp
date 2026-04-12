/* PRISM Debug Grid + Voice Feedback Recorder
   Loaded when ?debug=1 is in the URL.

   Features:
   1. Numbered grid overlay — 6 columns × N rows, each cell labeled
      (R1/C1..C6). Toggle with the Grid button or press 'g'.
   2. Voice feedback — click Record, speak while looking at the grid.
      Click anywhere on the page while recording to tag that position:
      a red dot appears and "[Click: R3,C2 on /schedule]" is injected
      into the transcript so Claude knows EXACTLY where the bug is.
   3. On Stop the full transcript (speech + click markers) is saved
      to logs/debug_feedback.md via POST /debug/feedback. Claude
      reads that file when you say "start debugging".

   The grid uses the same 6-column layout as .dashboard-tiles /
   .inst-tiles so grid numbers map directly to tile positions. */

(function () {
  'use strict';

  // ── Grid overlay ──────────────────────────────────────────────

  var COLS = 6;
  var ROW_HEIGHT = 100; // px per grid row
  var gridVisible = false;
  var gridContainer = null;
  var clickMarkerContainer = null;
  var clickEvents = []; // collected during a recording session

  function gridCoords(clientX, clientY) {
    var col = Math.floor(clientX / (window.innerWidth / COLS)) + 1;
    var row = Math.floor(clientY / ROW_HEIGHT) + 1;
    return { row: Math.max(1, row), col: Math.min(col, COLS) };
  }

  function createGrid() {
    if (gridContainer) return;
    gridContainer = document.createElement('div');
    gridContainer.id = 'debugGrid';
    gridContainer.style.cssText = [
      'position: fixed', 'inset: 0', 'z-index: 99990',
      'pointer-events: none', 'display: none'
    ].join(';');

    for (var c = 0; c <= COLS; c++) {
      var pct = (c / COLS * 100).toFixed(2) + '%';
      var line = document.createElement('div');
      line.style.cssText = 'position:absolute;top:0;bottom:0;left:' + pct +
        ';width:1px;background:rgba(255,80,80,0.35)';
      gridContainer.appendChild(line);
      if (c < COLS) {
        var cl = document.createElement('div');
        cl.textContent = 'C' + (c + 1);
        cl.style.cssText = 'position:absolute;top:4px;left:calc(' + pct +
          ' + 4px);font:bold 11px/1 monospace;color:rgba(255,80,80,0.8);' +
          'background:rgba(0,0,0,0.6);padding:2px 5px;border-radius:3px';
        gridContainer.appendChild(cl);
      }
    }
    var rows = Math.ceil(window.innerHeight / ROW_HEIGHT) + 2;
    for (var r = 0; r <= rows; r++) {
      var top = r * ROW_HEIGHT;
      var rl = document.createElement('div');
      rl.style.cssText = 'position:absolute;left:0;right:0;top:' + top +
        'px;height:1px;background:rgba(80,140,255,0.3)';
      gridContainer.appendChild(rl);
      var lab = document.createElement('div');
      lab.textContent = 'R' + (r + 1);
      lab.style.cssText = 'position:absolute;top:' + (top + 4) +
        'px;left:4px;font:bold 11px/1 monospace;color:rgba(80,140,255,0.8);' +
        'background:rgba(0,0,0,0.6);padding:2px 5px;border-radius:3px';
      gridContainer.appendChild(lab);
    }
    document.body.appendChild(gridContainer);

    // Container for click markers (persists independently of grid toggle)
    clickMarkerContainer = document.createElement('div');
    clickMarkerContainer.id = 'debugClickMarkers';
    clickMarkerContainer.style.cssText =
      'position:fixed;inset:0;z-index:99991;pointer-events:none';
    document.body.appendChild(clickMarkerContainer);
  }

  function toggleGrid() {
    createGrid();
    gridVisible = !gridVisible;
    gridContainer.style.display = gridVisible ? 'block' : 'none';
    if (gridBtn) gridBtn.textContent = gridVisible ? 'Hide Grid' : 'Show Grid';
  }

  function placeClickMarker(x, y, label) {
    createGrid();
    var dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;width:22px;height:22px;border-radius:50%;' +
      'background:rgba(220,40,40,0.7);border:2px solid #fff;' +
      'left:' + (x - 11) + 'px;top:' + (y - 11) + 'px;' +
      'pointer-events:none;z-index:99992';
    var tag = document.createElement('div');
    tag.textContent = label;
    tag.style.cssText = 'position:fixed;left:' + (x + 14) + 'px;top:' + (y - 8) +
      'px;font:bold 11px/1 monospace;color:#fff;background:rgba(220,40,40,0.85);' +
      'padding:2px 6px;border-radius:3px;pointer-events:none;z-index:99992';
    clickMarkerContainer.appendChild(dot);
    clickMarkerContainer.appendChild(tag);
  }

  function clearClickMarkers() {
    if (clickMarkerContainer) clickMarkerContainer.innerHTML = '';
    clickEvents = [];
  }

  // ── Session persistence across page navigation ─────────────────
  // When recording and the user clicks a link, we save state to
  // sessionStorage so recording auto-resumes on the next page.

  function saveSessionState() {
    if (!isRecording) return;
    sessionStorage.setItem('debugRecording', JSON.stringify({
      transcript: transcript,
      clicks: clickEvents,
      startedAt: sessionStorage.getItem('debugRecordingStart') || new Date().toISOString(),
    }));
  }

  function restoreSessionState() {
    var saved = sessionStorage.getItem('debugRecording');
    if (!saved) return false;
    try {
      var state = JSON.parse(saved);
      transcript = state.transcript || '';
      clickEvents = state.clicks || [];
      sessionStorage.setItem('debugRecordingStart', state.startedAt);
      return true;
    } catch (_) { return false; }
  }

  function clearSessionState() {
    sessionStorage.removeItem('debugRecording');
    sessionStorage.removeItem('debugRecordingStart');
  }

  // ── Click capture during recording ────────────────────────────

  function onDebugClick(e) {
    if (!isRecording) return;
    if (e.target.closest('#debugPanel')) return;

    var g = gridCoords(e.clientX, e.clientY);
    var label = 'R' + g.row + ',C' + g.col;
    var nearest = e.target.closest('[class]');
    var context = nearest ? '.' + nearest.className.split(/\s+/)[0] : e.target.tagName.toLowerCase();

    // If the click target is a link, save state and let navigation
    // happen — recording resumes on the new page automatically.
    var link = e.target.closest('a[href]');
    if (link && link.href && !link.href.startsWith('javascript:')) {
      var entry = '[Navigate: ' + label + ' → ' + link.pathname + ']';
      transcript += entry + ' ';
      clickEvents.push({
        grid: label, element: context,
        x: e.clientX, y: e.clientY,
        page: window.location.pathname,
        navigateTo: link.pathname,
      });
      saveSessionState();
      // Ensure ?debug=1 follows the navigation
      var url = new URL(link.href, window.location.origin);
      url.searchParams.set('debug', '1');
      link.href = url.toString();
      return; // let the browser navigate
    }

    var entry = '[Click: ' + label + ' on ' + context + ']';
    transcript += entry + ' ';
    clickEvents.push({
      grid: label, element: context,
      x: e.clientX, y: e.clientY,
      page: window.location.pathname,
    });

    placeClickMarker(e.clientX, e.clientY, label);
    updateTranscriptDisplay();
  }

  function updateTranscriptDisplay() {
    if (transcriptEl) {
      transcriptEl.textContent = transcript || 'Listening... (click anywhere to mark a point)';
    }
  }

  // ── Voice feedback recorder ───────────────────────────────────

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var isRecording = false;
  var transcript = '';
  var transcriptEl = null;

  function initSpeech() {
    if (!SpeechRecognition) return null;
    var r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = function (e) {
      var final = '';
      var interim = '';
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      // Merge speech with any click markers already in transcript
      var clickParts = transcript.match(/\[Click:[^\]]+\]/g) || [];
      transcript = final + clickParts.join(' ') + ' ';
      if (transcriptEl) {
        transcriptEl.textContent = transcript + (interim ? '[...' + interim + ']' : '');
      }
    };
    r.onerror = function (e) {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') {
        if (transcriptEl) transcriptEl.textContent = 'Mic denied. Allow in browser settings.';
      }
    };
    r.onend = function () {
      if (isRecording) { try { r.start(); } catch (_) {} }
    };
    return r;
  }

  function startRecording(resumed) {
    if (!recognition) recognition = initSpeech();
    if (!recognition) {
      alert('Speech recognition not supported. Use Chrome.');
      return;
    }
    if (!resumed) {
      transcript = '';
      clickEvents = [];
      clearClickMarkers();
      clearSessionState();
    }
    isRecording = true;
    recognition.start();
    recordBtn.textContent = 'Stop';
    recordBtn.style.background = '#d32f2f';
    transcriptPanel.style.display = 'block';
    if (transcriptEl) transcriptEl.textContent = resumed
      ? 'Resumed recording (navigated from previous page)...'
      : 'Listening... (click anywhere to mark a point)';
    updateTranscriptDisplay();
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) recognition.stop();
    recordBtn.textContent = 'Record';
    recordBtn.style.background = '#1976d2';
    clearSessionState();

    var fullText = transcript.trim();
    if (fullText || clickEvents.length) {
      saveFeedback(fullText, clickEvents.slice());
    } else {
      if (transcriptEl) transcriptEl.textContent = '(no speech or clicks)';
    }
  }

  function saveFeedback(text, clicks) {
    if (transcriptEl) transcriptEl.textContent = 'Saving...';
    fetch('/debug/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        clicks: clicks,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        grid_visible: gridVisible
      })
    }).then(function (r) { return r.json(); })
      .then(function () {
        if (transcriptEl) {
          var n = clicks.length;
          transcriptEl.textContent = 'Saved (' + n + ' click' + (n !== 1 ? 's' : '') +
            '). Say "start debugging" to Claude.';
        }
      })
      .catch(function (err) {
        if (transcriptEl) transcriptEl.textContent = 'Save failed: ' + err;
      });
  }

  // ── Control panel (floating bottom-right) ─────────────────────

  var panel = document.createElement('div');
  panel.id = 'debugPanel';
  panel.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:99999',
    'display:flex', 'flex-direction:column', 'gap:8px',
    'align-items:flex-end', 'font:13px/1.4 system-ui,sans-serif'
  ].join(';');

  var btnCss = 'border:none;border-radius:6px;padding:8px 16px;color:#fff;' +
    'cursor:pointer;font:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.3)';

  var gridBtn = document.createElement('button');
  gridBtn.textContent = 'Show Grid';
  gridBtn.style.cssText = btnCss + ';background:#455a64';
  gridBtn.addEventListener('click', toggleGrid);

  var recordBtn = document.createElement('button');
  recordBtn.textContent = 'Record';
  recordBtn.style.cssText = btnCss + ';background:#1976d2';
  recordBtn.addEventListener('click', function () {
    if (isRecording) stopRecording(); else startRecording();
  });

  var clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Marks';
  clearBtn.style.cssText = btnCss + ';background:#757575;font-size:11px;padding:5px 10px';
  clearBtn.addEventListener('click', clearClickMarkers);

  var transcriptPanel = document.createElement('div');
  transcriptPanel.style.cssText = [
    'display:none', 'background:rgba(0,0,0,0.88)', 'color:#eee',
    'padding:10px 14px', 'border-radius:8px', 'max-width:420px',
    'font-size:12px', 'line-height:1.5',
    'box-shadow:0 2px 12px rgba(0,0,0,0.5)', 'max-height:200px',
    'overflow-y:auto'
  ].join(';');
  transcriptEl = document.createElement('div');
  transcriptPanel.appendChild(transcriptEl);

  panel.appendChild(gridBtn);
  if (SpeechRecognition) panel.appendChild(recordBtn);
  panel.appendChild(clearBtn);
  panel.appendChild(transcriptPanel);
  document.body.appendChild(panel);

  // Click listener for recording mode
  document.addEventListener('click', onDebugClick, true);

  // Keyboard: 'g' toggles grid
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleGrid(); }
  });

  // Auto-show grid on load
  toggleGrid();

  // Auto-resume recording if we navigated here while recording
  if (restoreSessionState()) {
    startRecording(true);
  }
})();

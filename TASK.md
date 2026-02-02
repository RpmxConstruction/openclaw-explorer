Build a D3.js radial tree file explorer. REPLACE public/index.html completely.

REQUIREMENTS:

1. D3.JS TREE LAYOUT:
   - Root folder node at TOP CENTER
   - Two connector lines from root bottom center:
     - LEFT line goes to a circle containing ALL FOLDERS (cyan)
     - RIGHT line goes to a circle containing ALL FILES (purple)
   - Click folder expands with SAME pattern (its folders left, files right)
   - SVG path connector lines between nodes
   - Smooth animations

2. INLINE FILE EDITING:
   - Monaco Editor from CDN (https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/)
   - Click file opens editor CENTERED BELOW current level
   - SAVE button calls POST /api/write with {path, content}
   - Success/error feedback

3. ZOOM AND PAN:
   - Mouse wheel zoom
   - Drag to pan
   - d3.zoom behavior
   - Reset view button

4. NAVIGATION UNDO:
   - Click parent collapses to that level
   - UNDO button top-right
   - Stack-based history

5. AESTHETIC:
   - Neon-on-black (cyan folders, purple files)
   - Dark background with stars
   - Keep Node/Gateway tab switching

EXISTING API:
- GET /api/tree?path= returns [{name, type, path}]
- GET /api/read?path= returns {content, size}
- POST /api/write with {path, content}
- Gateway: /api/gateway/tree and /api/gateway/read

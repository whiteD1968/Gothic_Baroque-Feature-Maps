# Gothic_Baroque Feature Mapper

Gothic_Baroque Feature Mapper is a visual research tool for extracting and translating historical architectural features into authored, AI-ready references for MidJourney, ComfyUI, Stable Diffusion, and architectural design workflows.

The project now operates as a full **Feature Extraction + Graphic Translation Lab** with archive, translation, projection, and export pipelines, plus a region-based **Blend Lab** for crossbreeding Source A/B image logic.

## Main Workflow

Historical source image -> extracted feature maps -> graphic translation -> abstract AI reference -> architectural projection artifact

## Core Tabs

- `Archive`: upload, tag, organize, and preview source images.
- `Extraction`: generate edge, shadow/depth, flow, node, density, symmetry/asymmetry, and composite maps.
- `Translation`: authored abstract outputs (taxonomy boards, hybrid linework plates, mutation sheets, field condition maps, MidJourney boards).
- `Blend Lab`: region-based Source A/B crossbreeding, mask tools, blend presets, live mutation grid, and Grasshopper-ready export.
- `Projection`: map translated outputs onto placeholder geometry (tile, vault patch, stereotomic block, column fragment, minimal surface patch).
- `Export`: map/image export, metadata, prompt summaries, and packaged outputs.

## Recent Feature Additions

- Premium workspace structure and editorial UI treatment.
- Presentation modes (`Grid`, `Gallery`, `Atlas`, `Board`, `Detail`).
- Graphic style and translation presets (including Gothic/Baroque logic profiles).
- Blend Lab module with:
  - Source A / Source B upload and tagging
  - region tools (`rectangular`, `lasso`, `polygon`, `brush mask`, `erase mask`)
  - adjustable brush diameter
  - erase transparency slider (`0-100`)
  - apply/deselect flow for iterative edits
  - region delete/fill (`Delete A -> Fill from B`, `Delete B -> Fill from A`)
  - explicit Source B patch toggle
  - on-canvas A/B target badge
  - undo/redo (`Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`) + reset tools
- Gradient color mode enhancements:
  - gradient ramp preview
  - lower/upper limit controls
  - editable color stops
- Source-region selection on original previews:
  - drag region rectangle on Source A and Source B
  - Blend Canvas uses selected source regions, not only full-image cover fit.

## Project Structure

```txt
/frontend
/backend
/backend/routes
/backend/services
/backend/utils
/public/uploads
/public/outputs
```

## Local Development

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3005`.

### 3) Root-level Convenience Commands

```bash
npm run dev:backend
npm run dev
```

## Deployment (GitHub Pages)

Live demo:

- https://whited1968.github.io/Gothic_Baroque-Feature-Maps/

### Build locally for GitHub Pages

From repo root (PowerShell):

```powershell
$env:GITHUB_PAGES="true"
$env:GH_PAGES_BASE_PATH="/Gothic_Baroque-Feature-Maps"
npm --prefix frontend run build
```

The static export is generated in:

- `frontend/out`

### Publish to `gh-pages` branch (safe workflow)

Use a separate worktree so local `main` stays untouched:

1. Build with the environment variables above.
2. Create/use a `gh-pages` worktree checkout.
3. Replace only worktree contents with `frontend/out`.
4. Commit and push `gh-pages`.

This repo is configured so GitHub Pages can serve from the `gh-pages` branch root.

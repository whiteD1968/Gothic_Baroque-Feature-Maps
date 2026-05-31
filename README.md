# Gothic_Baroque Feature Mapper

Gothic_Baroque Feature Mapper is a lightweight research tool that treats historical architecture as a database of latent spatial, ornamental, and structural intelligence. Instead of reproducing Gothic or Baroque styles directly, it extracts computational features from precedent images and converts them into abstract analytical maps for AI-assisted design workflows across MidJourney, ComfyUI, Stable Diffusion, and related tools.

## Features

- Upload JPG, PNG, and WEBP files (single or batch)
- Tag each image as Gothic, Baroque, Mixed, or Custom
- Thumbnail gallery with per-image tag control
- Adjustable extraction controls for edge thresholds and density kernel
- One-click preset profiles:
  - Gothic-sensitive
  - Baroque-dense
  - Balanced mixed
  - Custom
- Generated maps per image:
  - Original
  - Edge Map (Canny)
  - Shadow / Depth Map (local variance)
  - Flow Map (Sobel directional gradients)
  - Node Map (intersection/corner intensity)
  - Density Map (ornament/contour concentration)
  - Composite Map (layered abstraction)
- Side-by-side results panel with map downloads
- Batch ZIP export for all generated maps
- Copyable trait description text for prompting/reference
- Basic mirrored-half symmetry analysis included in trait metrics

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

## Getting Started

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2) Frontend (Next.js)

```bash
cd frontend
npm install
# optional if backend is not on localhost:8000
# set NEXT_PUBLIC_API_URL
npm run dev
```

Open `http://localhost:3000`.

## Controls

- `Edge Threshold Low`: Lower Canny boundary for edge sensitivity
- `Edge Threshold High`: Upper Canny boundary for edge confirmation
- `Density Kernel`: Neighborhood size used to estimate ornament concentration

## Workflow

Historical image database -> feature extraction -> abstract maps -> AI image references -> new architectural language

## Research Framing

This tool supports research into digital spolia, computational craft, and the translation of historical architectural language into new material and fabrication workflows by extracting latent features such as ribs, arches, tracery, curvature, node intersections, and relief depth into reusable computational maps.

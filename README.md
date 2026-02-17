# Commment!

Full-stack comments app with a React frontend and Flask backend.

## Project structure

- `src/`: frontend application code
- `src/__tests__/`: frontend tests (Vitest + Testing Library)
- `backend/`: Flask API and SQLite data access
- `backend/tests/`: backend API tests (pytest)
- `backend/data/`: runtime SQLite database location

## Frontend

- Install deps: `npm install`
- Start dev server: `npm run dev`
- Run tests: `npm test`
- Build production assets: `npm run build`

## Backend

- Install deps: `pip install -r backend/requirements.txt`
- Run API: `python -m backend.server`
- Run tests: `pytest backend/tests/test_api.py`

## Notes

- The backend serves frontend assets from `dist/` when present.
- Local virtual environments, build output, and database files are intentionally ignored from version control.

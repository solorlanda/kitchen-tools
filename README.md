# Kitchen Manager

A responsive, English-language restaurant kitchen web app built with React and Vite.

## Features

- **Prep List:** add, edit, remove, search, filter and complete prep tasks, with kitchen station, quantity and priority.
- **Opening & Closing:** independent, fully editable checklists with progress indicators and reset buttons.
- **Shopping List:** categories, quantities, units, notes, purchased status, CSV export and browser printing.
- **Dashboard:** overview, completion stats and quick actions.
- **Data management:** automatically saves data in the current browser using `localStorage`, and supports JSON backup export/import.
- Example data is included to demonstrate features; edit or delete it as needed.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

## Create production build

```bash
npm run build
```

The production site is generated in `dist/`.

## Deploy to Render (Static Site)

1. Push this folder to a GitHub repository.
2. In Render, select **New > Static Site** and connect the repository.
3. Set **Build Command** to `npm install && npm run build`.
4. Set **Publish Directory** to `dist`.
5. Deploy.

Alternatively, `render.yaml` is provided for a Render Blueprint deployment.

## Important data limitation

This starter uses **local browser storage only**. Lists do **not** synchronize between people, devices or browsers. Clearing browser data can delete your lists. Export a JSON backup regularly. For real shared use across multiple kitchen employees, a database, accounts/permissions and hosted backend are needed. This product is a workflow organizer; it is **not** a food safety compliance system.

## Privacy

No credentials are required and no third-party database receives your list data in this version. Google Fonts loaded from Google and package dependencies are external to the app.

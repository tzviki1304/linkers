# Link Saver Chrome Extension

A Chrome extension that replaces the new tab page for saving and organizing links in workspaces and categories.

## Features

- Opens automatically on new tab
- Organize links in workspaces and categories
- Drag and drop from open tabs
- Light and dark theme
- Import and export data
- Modern UI with Tailwind CSS and Material Design icons

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the upper right corner
4. Click "Load unpacked" button and select the extension directory
5. The extension is now installed and will open whenever you open a new tab

## Dependencies

- Tailwind CSS (included in the `css` directory)
- Material Design Icons (included in the `css` directory)

## Usage

- Open a new tab to access the Link Saver
- Create workspaces to organize your links
- Create categories within each workspace
- Drag and drop open tabs to categories to save them
- Use the save button next to each tab to save it to the active category
- Toggle between light and dark theme using the theme button
- Export your data for backup using the export button
- Import data using the import button

## File Structure

```
linkers/
  ├── manifest.json
  ├── popup.html
  ├── css/
  │   ├── tailwind.min.css
  │   ├── material-icons.css
  │   └── styles.css
  ├── js/
  │   ├── app.js
  │   ├── background.js
  │   ├── categories.js
  │   ├── links.js
  │   ├── store.js
  │   ├── tabs.js
  │   ├── ui.js
  │   └── workspaces.js
  └── icons/
      ├── icon16.png
      ├── icon48.png
      ├── icon128.png
      └── default-favicon.png
```

# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] – Initial Release

### Features

- ⏱ Live editing time tracking in the status bar (per file)
- 💾 Persistent time storage using `globalState`
- 📁 Explorer panel view showing all tracked files
- 📊 Bar chart (Top 5 files) using Chart.js in a Webview
- 🖱 Context menu actions for each file:
  - Reset time for this file
  - Export time for this file
- 📤 Export all tracked times as a JSON file
- 🔀 Sort tracked files (ascending / descending)
- ⏰ Pomodoro reminder after 25 minutes of editing

### Infrastructure

- First stable release (`v1.0.0`)
- Tested via `.vsix` and development host

# WhatsApp Bot Project

## Overview
A modular WhatsApp bot built with whatsapp-web.js featuring dynamic command and event loading. The project uses a clean, separated file structure for easy maintenance and scalability.

## Recent Changes (November 17, 2025)
- Initial project setup with Node.js and ES modules
- Created modular architecture with commands/, events/, and utils/ folders
- Implemented dynamic command and event loader system in index.js
- Added three example commands: ping, help, info
- Added three event handlers: ready, qr, message
- Configured system Chromium for whatsapp-web.js/puppeteer compatibility
- Improved dynamic Chromium path detection with environment variable fallback
- Added error handling for command/event loading failures
- Successfully deployed with authentication working
- Bot authenticated and ready to receive commands

## Project Architecture

### Core Structure
```
index.js - Main bot class with dynamic loaders
commands/ - Individual command files (auto-loaded)
events/ - Individual event handlers (auto-loaded)
utils/ - Utility functions (for future use)
```

### Key Design Patterns
- **Command Pattern**: Each command is a separate module with name, description, usage, and execute function
- **Event-Driven**: Events are dynamically loaded and registered with the WhatsApp client
- **Modular**: New commands/events can be added by simply creating new files

### Dependencies
- whatsapp-web.js: WhatsApp Web API wrapper
- qrcode-terminal: QR code display in console
- puppeteer (bundled): Browser automation for WhatsApp Web
- System Chromium: Used instead of bundled Chromium for Nix compatibility

## Technical Decisions
- **ES Modules**: Using "type": "module" in package.json for modern JavaScript
- **CommonJS Compatibility**: whatsapp-web.js is CommonJS, using default import with destructuring
- **System Chromium**: Configured executablePath to use Nix-provided Chromium to avoid dependency issues
- **LocalAuth Strategy**: Persists authentication between restarts

## User Preferences
- Clean, modular code structure with separated concerns
- Dynamic loading of commands and events
- No preferences specified yet for coding style

## Current State
- Bot is fully functional and running
- QR code authentication works correctly
- Three example commands working
- Ready for extension with more commands and features

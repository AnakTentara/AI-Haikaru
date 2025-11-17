# WhatsApp Bot

A modular WhatsApp bot built with whatsapp-web.js featuring a clean, dynamic workspace with separated command and event handlers.

## Project Structure

```
whatsapp-bot/
├── index.js           # Main bot file with dynamic loaders
├── commands/          # Command files (each command in separate file)
│   ├── ping.js       # Check bot responsiveness
│   ├── help.js       # Show all available commands
│   └── info.js       # Get bot and chat information
├── events/            # Event handler files
│   ├── ready.js      # Bot ready event
│   ├── qr.js         # QR code display event
│   └── message.js    # Message handler and command router
└── utils/             # Utility functions (for future use)
```

## Features

- **Dynamic Command Loading**: Automatically loads all commands from the `commands/` folder
- **Modular Event System**: Each event is in its own file in the `events/` folder
- **Clean Architecture**: Easy to add new commands and events
- **Command Prefix**: Default prefix is `!` (customizable)

## Getting Started

1. **Start the bot**:
   ```bash
   npm start
   ```

2. **Scan the QR code** with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed in the console

3. **Test the bot** by sending a message:
   ```
   !ping
   !help
   !info
   ```

## Adding New Commands

Create a new file in the `commands/` folder:

```javascript
// commands/example.js
export default {
  name: 'example',
  description: 'Example command description',
  usage: '!example [args]',
  async execute(message, args, bot) {
    // Your command logic here
    await message.reply('This is an example command!');
  }
};
```

The command will be automatically loaded when the bot starts.

## Adding New Events

Create a new file in the `events/` folder:

```javascript
// events/example.js
export default {
  name: 'event_name',
  once: false, // Set to true if event should only fire once
  execute(bot, ...args) {
    // Your event logic here
    console.log('Event triggered!');
  }
};
```

## Available Commands

- **!ping** - Check if the bot is responsive and see latency
- **!help** - Display all available commands or get help for a specific command
- **!info** - Get information about the bot and current chat

## Configuration

You can customize the bot by modifying the `WhatsAppBot` class in `index.js`:

- Change the command prefix by modifying `this.prefix`
- Add more Puppeteer options in the `Client` configuration
- Customize the authentication strategy

## Notes

- The bot uses `LocalAuth` strategy, so authentication is persisted between restarts
- Session data is stored in `.wwebjs_auth/` folder
- The bot is running on port-bound workflow for console output

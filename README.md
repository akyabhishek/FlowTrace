# FlowTrace - User Flow Recorder & Playback Browser Extension

A powerful browser extension for tracing user flows and interactions for comprehensive testing and debugging. FlowTrace is perfect for testers who want to capture user journeys and visualize them later without actually executing the actions.

## 🎯 Features

- **Flow Tracing**: Capture all user interactions including clicks, keyboard input, scrolling, form submissions, and more
- **Visual Playback**: Play back recorded flows with visual indicators showing where each action occurred
- **Flow Management**: Save, organize, and manage multiple recorded user flows
- **Export/Import**: Share flow traces with team members or save them for later use
- **Non-Intrusive Tracing**: Minimal impact on page performance during recording
- **Cross-Page Support**: Works on any website (http/https)

## 📦 Installation

### From Source (Developer Mode)

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd session-recorder-extension
   ```

2. **Open Chrome and navigate to Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Pin the extension** (optional)
   - Click the puzzle piece icon in the toolbar
   - Find "FlowTrace" and click the pin icon

## 🚀 Usage

### Recording a Flow

1. **Navigate to the webpage** you want to test
2. **Click the extension icon** in the browser toolbar
3. **Click "Start Recording"** in the popup
4. **Perform your test actions** on the webpage:
   - Click buttons, links, and other elements
   - Type in input fields
   - Scroll the page
   - Submit forms
   - Navigate between pages
5. **Click "Stop Recording"** when finished
6. Your flow trace will be automatically saved with a timestamp

### Playing Back a Flow

1. **Click the extension icon** to open the popup
2. **Select a flow** from the "Recorded Sessions" list
3. **Click "Play Selected Session"**
4. Watch as FlowTrace visualizes each action with:
   - Colored indicators showing click locations
   - Action type labels (click, scroll, input, etc.)
   - Automatic scrolling to follow the actions
   - Progress indicator showing current action

### Managing Flow Traces

- **Delete Flows**: Click the "×" button next to any flow trace
- **Export Flows**: Select a flow and click "Export" to save as JSON
- **Import Flows**: Click "Import" and select a previously exported JSON file

## 🛠️ Technical Details

### What Gets Recorded

The extension captures the following user interactions:

- **Mouse Events**: clicks, double-clicks
- **Keyboard Events**: key presses and releases
- **Form Interactions**: input changes, form submissions
- **Scroll Events**: page and element scrolling
- **Window Events**: browser resize

### Data Structure

Each recorded action includes:
```javascript
{
  type: "click",           // Action type
  timestamp: 1500,         // Time offset from session start (ms)
  target: "#submit-btn",   // CSS selector of target element
  coordinates: {           // Mouse coordinates
    x: 100, y: 200,       // Viewport coordinates
    pageX: 100, pageY: 800 // Page coordinates
  },
  key: "Enter",           // Key pressed (for keyboard events)
  value: "user input",    // Input value (for form events)
  scrollPosition: {       // Current scroll position
    x: 0, y: 400
  },
  viewport: {             // Browser viewport size
    width: 1920, height: 1080
  }
}
```

## 🎨 Customization

### Modifying Visual Indicators

You can customize the playback visualization by editing the `visualizeAction` method in `content.js`:

```javascript
// Change indicator color and size
indicator.style.cssText = `
    background: #your-color;
    width: 30px;
    height: 30px;
    // ... other styles
`;
```

### Adding New Event Types

To record additional events, modify the `addEventListeners` method in `content.js`:

```javascript
// Add new event listener
document.addEventListener('your-event', this.handleYourEvent, true);

// Add corresponding handler
handleYourEvent = (event) => {
    this.recordAction('your-event', event);
}
```

## 🔧 Development

### File Structure
```
session-recorder-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js             # Popup logic and controls
├── content.js           # Main recording/playback logic
├── background.js        # Background service worker
├── icons/              # Extension icons (16x16, 48x48, 128x128)
└── README.md           # This file
```

### Building for Production

1. **Create extension icons** (16x16, 48x48, 128x128 pixels)
2. **Test thoroughly** on different websites
3. **Package for Chrome Web Store** (if desired)

## 🤝 Use Cases

### For Testers
- **Bug Reproduction**: Record the exact steps that led to a bug
- **Test Documentation**: Create visual test cases for manual testing
- **Training**: Show new team members how to perform specific tests
- **Regression Testing**: Verify that previously working flows still function

### For Developers
- **User Journey Analysis**: Understand how users interact with your application
- **Performance Testing**: Identify slow interactions and optimize accordingly
- **Accessibility Testing**: Record and analyze keyboard navigation patterns

### For Product Managers
- **Feature Validation**: Record user interactions with new features
- **Usability Studies**: Capture and analyze user behavior patterns
- **Stakeholder Demos**: Create reproducible demonstrations of product functionality

## ⚠️ Important Notes

- **Privacy**: This extension only records interaction metadata, not sensitive data like passwords
- **Performance**: Recording has minimal impact, but very long sessions may use significant memory
- **Compatibility**: Works with Chrome/Chromium-based browsers (Chrome, Edge, Brave, etc.)
- **Limitations**: Cannot interact with browser UI elements, only webpage content

## 🐛 Troubleshooting

### Extension Not Working
1. Check that Developer Mode is enabled
2. Reload the extension from `chrome://extensions/`
3. Refresh the webpage you're trying to record

### Recording Not Starting
1. Make sure you're on an http/https page (not chrome:// pages)
2. Check browser console for error messages
3. Try reloading the page and starting recording again

### Playback Issues
1. Ensure the page structure hasn't changed significantly since recording
2. Try playing back on the same page where you recorded
3. Check that no modal dialogs or popups are blocking the playback

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

**Happy Testing!** 🚀 
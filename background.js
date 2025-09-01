// Background service worker for the Session Recorder extension

// Centralized logging utility for background script
class BackgroundLogger {
    constructor() {
        this.debugMode = false;
        this.loadDebugMode();
    }
    
    async loadDebugMode() {
        try {
            const result = await chrome.storage.local.get('flowtrace_settings');
            if (result.flowtrace_settings?.advanced?.debugMode) {
                this.debugMode = result.flowtrace_settings.advanced.debugMode;
            }
        } catch (error) {
            // Fallback to false if can't load settings
            this.debugMode = false;
        }
    }
    
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    log(...args) {
        if (this.debugMode) {
            console.log(...args);
        }
    }
    
    warn(...args) {
        if (this.debugMode) {
            console.warn(...args);
        }
    }
    
    error(...args) {
        if (this.debugMode) {
            console.error(...args);
        }
    }
    
    // Always log critical errors regardless of debug mode
    criticalError(...args) {
        console.error(...args);
    }
    
    // Always log critical info regardless of debug mode  
    criticalInfo(...args) {
        console.log(...args);
    }
}

// Create global logger instance
const bgLogger = new BackgroundLogger();

let globalRecordingState = {
    isRecording: false,
    currentSession: null,
    recordingTabId: null
};

let playbackState = {
    session: null,
    pageIndex: 0,
    actionIndex: 0,
    tabId: null
};

chrome.runtime.onInstalled.addListener(() => {
    console.log('Session Recorder extension installed');
    
    // Initialize storage if needed
    chrome.storage.local.get('sessions', (result) => {
        if (!result.sessions) {
            chrome.storage.local.set({ sessions: {} });
        }
    });
    
    // Initialize recording state
    chrome.storage.local.set({ isRecording: false });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup, no additional action needed
    console.log('Extension icon clicked');
});

// Listen for tab updates to inject content script and handle navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && 
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        
        bgLogger.log('🔧 Tab updated, ensuring content script injection:', { tabId, url: tab.url });
        
        // Ensure content script is injected
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).then(() => {
            bgLogger.log('✅ Content script injected successfully for tab:', tabId);
            
            // If recording is active and this is a navigation on the recorded tab
            if (globalRecordingState.isRecording && 
                globalRecordingState.recordingTabId === tabId && 
                changeInfo.url) {
                
                bgLogger.log('🎬 Recording navigation for tab:', tabId);
                // Record the navigation
                chrome.tabs.sendMessage(tabId, { 
                    action: 'recordNavigation', 
                    url: changeInfo.url,
                    timestamp: Date.now()
                }).catch(error => {
                    bgLogger.error('Failed to record navigation:', error);
                });
            }
            
            // If recording is active, notify the content script
            if (globalRecordingState.isRecording && globalRecordingState.recordingTabId === tabId) {
                console.log('🎬 Continuing recording for tab:', tabId);
                chrome.tabs.sendMessage(tabId, { 
                    action: 'continueRecording',
                    session: globalRecordingState.currentSession
                }).catch(error => {
                    console.error('Failed to continue recording:', error);
                });
            }
            
            // If playback state exists for this tab, continue playback
            if (playbackState.session && playbackState.tabId === tabId) {
                console.log('🎬 Continuing playback for tab:', tabId);
                chrome.tabs.sendMessage(tabId, {
                    action: 'continuePlayback',
                    session: playbackState.session,
                    pageIndex: playbackState.pageIndex,
                    actionIndex: playbackState.actionIndex
                }).catch(error => {
                    console.error('Failed to continue playback:', error);
                });
                
                // Clear playback state after use
                playbackState = {
                    session: null,
                    pageIndex: 0,
                    actionIndex: 0,
                    tabId: null
                };
            }
        }).catch(error => {
            // Content script might already be injected or tab is not accessible
            if (error.message.includes('Cannot access') || 
                error.message.includes('Extension manifest') ||
                error.message.includes('Unexpected token')) {
                console.log('⚠️ Cannot inject content script (expected for some pages):', error.message);
            } else {
                console.log('🔧 Content script injection skipped (likely already injected):', error.message);
            }
        });
    }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    bgLogger.log('Background received message:', request);
    
    try {
        switch (request.action) {
            case 'startGlobalRecording':
                if (!request.tabId) {
                    sendResponse({ success: false, error: 'No tab ID provided' });
                    break;
                }
                
                globalRecordingState.isRecording = true;
                globalRecordingState.recordingTabId = request.tabId;
                globalRecordingState.currentSession = {
                    id: Date.now().toString(),
                    startTime: Date.now(),
                    pages: []
                };
                
                chrome.storage.local.set({ isRecording: true }).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Failed to save recording state:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep message channel open for async response
                
            case 'stopGlobalRecording':
                globalRecordingState.isRecording = false;
                const recordingTabId = globalRecordingState.recordingTabId;
                
                // Get the final session data from content script first
                if (recordingTabId) {
                    chrome.tabs.sendMessage(recordingTabId, { 
                        action: 'stopRecording' 
                    }).then(response => {
                        bgLogger.log('🛑 Content script stop response:', response);
                        
                        // Use session from content script if available, otherwise use background session
                        const finalSession = response?.session || globalRecordingState.currentSession;
                        
                        // Clear global state
                        globalRecordingState.currentSession = null;
                        globalRecordingState.recordingTabId = null;
                        
                        chrome.storage.local.set({ isRecording: false }).then(() => {
                            sendResponse({ success: true, session: finalSession });
                        }).catch(error => {
                            console.error('Failed to save recording state:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    }).catch(error => {
                        console.log('Content script may not be available:', error.message);
                        
                        // Fallback to background session if content script is not available
                        const fallbackSession = globalRecordingState.currentSession;
                        globalRecordingState.currentSession = null;
                        globalRecordingState.recordingTabId = null;
                        
                        chrome.storage.local.set({ isRecording: false }).then(() => {
                            sendResponse({ success: true, session: fallbackSession });
                        }).catch(error => {
                            console.error('Failed to save recording state:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    });
                } else {
                    // No recording tab, just clear state
                    const session = globalRecordingState.currentSession;
                    globalRecordingState.currentSession = null;
                    globalRecordingState.recordingTabId = null;
                    
                    chrome.storage.local.set({ isRecording: false }).then(() => {
                        sendResponse({ success: true, session: session });
                    }).catch(error => {
                        console.error('Failed to save recording state:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                }
                return true; // Keep message channel open for async response
            
            case 'updateSession':
                if (globalRecordingState.currentSession) {
                    globalRecordingState.currentSession = request.session;
                }
                sendResponse({ success: true });
                break;
                
            case 'getGlobalRecordingState':
                sendResponse({ 
                    isRecording: globalRecordingState.isRecording,
                    session: globalRecordingState.currentSession 
                });
                break;
                
            case 'storePlaybackState':
                playbackState.session = request.session;
                playbackState.pageIndex = request.pageIndex;
                playbackState.actionIndex = request.actionIndex;
                playbackState.tabId = sender.tab.id;
                sendResponse({ success: true });
                break;
                
            case 'forwardToTab':
                chrome.tabs.sendMessage(request.tabId, request.message)
                    .then(response => sendResponse(response))
                    .catch(error => sendResponse({ error: error.message }));
                return true; // Keep message channel open
                
            case 'playbackCompleted':
                // Clear any stored playback state
                playbackState.session = null;
                playbackState.pageIndex = null;
                playbackState.actionIndex = null;
                playbackState.tabId = null;
                console.log('✅ Playback completed - cleared background state');
                sendResponse({ success: true });
                break;
                
            case 'updateDebugMode':
                bgLogger.setDebugMode(request.debugMode);
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
});

// Clean up old sessions (optional - keep last 50 sessions)
chrome.storage.local.get('sessions', (result) => {
    const sessions = result.sessions || {};
    const sessionEntries = Object.entries(sessions);
    
    if (sessionEntries.length > 50) {
        // Sort by timestamp and keep only the most recent 50
        const sortedSessions = sessionEntries
            .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 50);
        
        const cleanedSessions = Object.fromEntries(sortedSessions);
        chrome.storage.local.set({ sessions: cleanedSessions });
        
        console.log(`Cleaned up old sessions, kept ${sortedSessions.length} sessions`);
    }
}); 
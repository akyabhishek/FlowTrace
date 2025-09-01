let isRecording = false;
let selectedSession = null;

// Centralized logging utility for popup script
class PopupLogger {
    constructor() {
        this.debugMode = false;
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
const popupLogger = new PopupLogger();

// Settings management
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            playback: {
                speed: 1,
                visualIndicators: true,
                autoScroll: true,
                animationStyle: 'default'
            },
            recording: {
                quality: 'medium',
                includeMouseMoves: false,
                showRecordingIndicator: true
            },
            advanced: {
                elementDetection: 'flexible',
                debugMode: false,
                maxRetries: 3
            }
        };
        this.settings = { ...this.defaultSettings };
    }

    async loadSettings() {
        try {
                    const result = await chrome.storage.local.get('flowtrace_settings');
        if (result.flowtrace_settings) {
            this.settings = { ...this.defaultSettings, ...result.flowtrace_settings };
        }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        
        // Update logger debug mode
        popupLogger.setDebugMode(this.settings.advanced.debugMode);
        
        this.updateUI();
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ flowtrace_settings: this.settings });
            console.log('Settings saved:', this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    updateUI() {
        // Playback settings
        document.getElementById('playbackSpeed').value = this.settings.playback.speed;
        document.getElementById('speedValue').textContent = `${this.settings.playback.speed}x`;
        document.getElementById('visualIndicators').checked = this.settings.playback.visualIndicators;
        document.getElementById('autoScroll').checked = this.settings.playback.autoScroll;
        document.getElementById('animationStyle').value = this.settings.playback.animationStyle;

        // Recording settings
        document.getElementById('recordingQuality').value = this.settings.recording.quality;
        document.getElementById('includeMouseMoves').checked = this.settings.recording.includeMouseMoves;
        document.getElementById('showRecordingIndicator').checked = this.settings.recording.showRecordingIndicator;

        // Advanced settings
        document.getElementById('elementDetection').value = this.settings.advanced.elementDetection;
        document.getElementById('debugMode').checked = this.settings.advanced.debugMode;
        document.getElementById('maxRetries').value = this.settings.advanced.maxRetries;
        document.getElementById('retriesValue').textContent = this.settings.advanced.maxRetries;
    }

    bindEvents() {
        // Playback settings
        document.getElementById('playbackSpeed').addEventListener('input', (e) => {
            this.settings.playback.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = `${this.settings.playback.speed}x`;
            this.saveSettings();
        });

        document.getElementById('visualIndicators').addEventListener('change', (e) => {
            this.settings.playback.visualIndicators = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('autoScroll').addEventListener('change', (e) => {
            this.settings.playback.autoScroll = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('animationStyle').addEventListener('change', (e) => {
            this.settings.playback.animationStyle = e.target.value;
            this.saveSettings();
        });

        // Recording settings
        document.getElementById('recordingQuality').addEventListener('change', (e) => {
            this.settings.recording.quality = e.target.value;
            this.saveSettings();
        });

        document.getElementById('includeMouseMoves').addEventListener('change', (e) => {
            this.settings.recording.includeMouseMoves = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('showRecordingIndicator').addEventListener('change', (e) => {
            this.settings.recording.showRecordingIndicator = e.target.checked;
            this.saveSettings();
        });

        // Advanced settings
        document.getElementById('elementDetection').addEventListener('change', (e) => {
            this.settings.advanced.elementDetection = e.target.value;
            this.saveSettings();
        });

        document.getElementById('debugMode').addEventListener('change', (e) => {
            this.settings.advanced.debugMode = e.target.checked;
            
            // Update all loggers when debug mode changes
            popupLogger.setDebugMode(e.target.checked);
            
            // Update background script logger
            chrome.runtime.sendMessage({
                action: 'updateDebugMode',
                debugMode: e.target.checked
            }).catch(error => {
                console.log('Could not update background debug mode:', error);
            });
            
            // Update content script logger
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateDebugMode',
                        debugMode: e.target.checked
                    }).catch(error => {
                        console.log('Could not update content script debug mode:', error);
                    });
                }
            });
            
            this.saveSettings();
        });

        document.getElementById('maxRetries').addEventListener('input', (e) => {
            this.settings.advanced.maxRetries = parseInt(e.target.value);
            document.getElementById('retriesValue').textContent = this.settings.advanced.maxRetries;
            this.saveSettings();
        });
    }

    getSettings() {
        return this.settings;
    }
}

// Enhanced Error Handler
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
    }

    logError(error, context = '') {
        const errorEntry = {
            timestamp: Date.now(),
            message: error.message || error,
            context: context,
            stack: error.stack || null
        };
        
        this.errors.unshift(errorEntry);
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
        
                    console.error(`[FlowTrace Error] ${context}:`, error);
    }

    getRecentErrors() {
        return this.errors.slice(0, 10);
    }

    showUserFriendlyError(message, canRetry = false) {
        const status = document.getElementById('status');
        status.style.background = 'rgba(231, 76, 60, 0.2)';
        status.style.border = '1px solid rgba(231, 76, 60, 0.5)';
        
        if (canRetry) {
            status.innerHTML = `
                <div>${message}</div>
                <button onclick="retryLastAction()" style="margin-top: 8px; padding: 4px 12px; font-size: 11px;">
                    Try Again
                </button>
            `;
        } else {
            status.textContent = message;
        }

        // Auto-clear after 5 seconds
        setTimeout(() => {
            status.style.background = '';
            status.style.border = '';
            status.textContent = 'Ready';
        }, 5000);
    }
}

// Session validation and repair functionality
class SessionValidator {
    constructor() {
        this.requiredFields = {
            session: ['id', 'startTime', 'pages'],
            page: ['url', 'title', 'timestamp', 'actions'],
            action: ['type', 'timestamp', 'target']
        };
        this.validActionTypes = [
            'click', 'dblclick', 'keydown', 'keyup', 'input', 'change', 
            'submit', 'scroll', 'mousemove', 'resize'
        ];
    }

    validateSession(session) {
        const issues = [];
        const warnings = [];

        try {
            // Check session structure
            if (!session || typeof session !== 'object') {
                issues.push('Invalid session: not an object');
                return { isValid: false, issues, warnings, canRepair: false };
            }

            // Check required session fields
            for (const field of this.requiredFields.session) {
                if (!(field in session)) {
                    if (field === 'pages' && session.actions) {
                        warnings.push('Legacy session format detected (actions instead of pages)');
                    } else {
                        issues.push(`Missing required session field: ${field}`);
                    }
                }
            }

            // Validate pages or legacy actions
            if (session.pages && Array.isArray(session.pages)) {
                session.pages.forEach((page, pageIndex) => {
                    this.validatePage(page, pageIndex, issues, warnings);
                });
            } else if (session.actions && Array.isArray(session.actions)) {
                // Legacy format validation
                this.validateActions(session.actions, 'session', issues, warnings);
            } else {
                issues.push('Session has no pages or actions');
            }

            // Check for reasonable data
            if (session.startTime && (Date.now() - session.startTime > 365 * 24 * 60 * 60 * 1000)) {
                warnings.push('Session is more than a year old');
            }

        } catch (error) {
            issues.push(`Validation error: ${error.message}`);
        }

        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            canRepair: this.canRepairSession(session, issues)
        };
    }

    validatePage(page, pageIndex, issues, warnings) {
        // Check required page fields
        for (const field of this.requiredFields.page) {
            if (!(field in page)) {
                issues.push(`Page ${pageIndex}: Missing required field: ${field}`);
            }
        }

        // Validate URL
        if (page.url && !this.isValidUrl(page.url)) {
            warnings.push(`Page ${pageIndex}: Invalid URL format: ${page.url}`);
        }

        // Validate actions
        if (page.actions && Array.isArray(page.actions)) {
            this.validateActions(page.actions, `page ${pageIndex}`, issues, warnings);
        }
    }

    validateActions(actions, context, issues, warnings) {
        if (!Array.isArray(actions)) {
            issues.push(`${context}: Actions is not an array`);
            return;
        }

        actions.forEach((action, actionIndex) => {
            // Check required action fields
            for (const field of this.requiredFields.action) {
                if (!(field in action)) {
                    issues.push(`${context}, action ${actionIndex}: Missing required field: ${field}`);
                }
            }

            // Validate action type
            if (action.type && !this.validActionTypes.includes(action.type)) {
                warnings.push(`${context}, action ${actionIndex}: Unknown action type: ${action.type}`);
            }

            // Validate timestamp
            if (action.timestamp && (typeof action.timestamp !== 'number' || action.timestamp < 0)) {
                issues.push(`${context}, action ${actionIndex}: Invalid timestamp: ${action.timestamp}`);
            }

            // Validate coordinates for relevant actions
            if (['click', 'dblclick', 'mousemove'].includes(action.type)) {
                if (!action.coordinates || typeof action.coordinates !== 'object') {
                    warnings.push(`${context}, action ${actionIndex}: Missing coordinates for ${action.type} action`);
                }
            }
        });
    }

    canRepairSession(session, issues) {
        // Can repair if issues are mostly missing non-critical fields
        const repairableIssues = issues.filter(issue => 
            issue.includes('Missing required field') && 
            !issue.includes('id') && 
            !issue.includes('type')
        );
        return repairableIssues.length === issues.length;
    }

    repairSession(session) {
        const repairedSession = JSON.parse(JSON.stringify(session)); // Deep clone
        const repairs = [];

        try {
            // Generate missing ID
            if (!repairedSession.id) {
                repairedSession.id = Date.now().toString();
                repairs.push('Generated missing session ID');
            }

            // Generate missing startTime
            if (!repairedSession.startTime) {
                repairedSession.startTime = Date.now();
                repairs.push('Generated missing startTime');
            }

            // Convert legacy format
            if (!repairedSession.pages && repairedSession.actions) {
                repairedSession.pages = [{
                    url: repairedSession.url || window.location.href,
                    title: repairedSession.title || document.title,
                    timestamp: repairedSession.startTime,
                    actions: repairedSession.actions
                }];
                delete repairedSession.actions;
                delete repairedSession.url;
                delete repairedSession.title;
                repairs.push('Converted legacy session format');
            }

            // Repair pages
            if (repairedSession.pages && Array.isArray(repairedSession.pages)) {
                repairedSession.pages.forEach((page, pageIndex) => {
                    // Generate missing page fields
                    if (!page.url) {
                        page.url = 'about:blank';
                        repairs.push(`Generated missing URL for page ${pageIndex}`);
                    }
                    if (!page.title) {
                        page.title = `Page ${pageIndex + 1}`;
                        repairs.push(`Generated missing title for page ${pageIndex}`);
                    }
                    if (!page.timestamp) {
                        page.timestamp = repairedSession.startTime;
                        repairs.push(`Generated missing timestamp for page ${pageIndex}`);
                    }
                    if (!page.actions) {
                        page.actions = [];
                        repairs.push(`Generated missing actions array for page ${pageIndex}`);
                    }

                    // Filter out invalid actions
                    const originalLength = page.actions.length;
                    page.actions = page.actions.filter(action => 
                        action.type && 
                        action.timestamp !== undefined && 
                        action.target !== undefined
                    );
                    if (page.actions.length < originalLength) {
                        repairs.push(`Removed ${originalLength - page.actions.length} invalid actions from page ${pageIndex}`);
                    }
                });
            }

        } catch (error) {
            repairs.push(`Repair error: ${error.message}`);
        }

        return { repairedSession, repairs };
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

// Initialize managers
const settingsManager = new SettingsManager();
const errorHandler = new ErrorHandler();
const sessionValidator = new SessionValidator();
let lastFailedAction = null;

// Functions to manage recording state persistence
async function saveRecordingState(recording) {
    await chrome.storage.local.set({ isRecording: recording });
}

async function getRecordingState() {
    const result = await chrome.storage.local.get('isRecording');
    return result.isRecording || false;
}

    // Sessions management functions
    async function renameSession(sessionId, session) {
        try {
            const currentName = session.name || `Session ${sessionId.slice(-6)}`;
            const newName = prompt('Enter new session name:', currentName);
            
            if (newName === null) {
                // User cancelled
                return;
            }
            
            if (newName.trim() === '') {
                errorHandler.showUserFriendlyError('Session name cannot be empty');
                return;
            }
            
            if (newName.trim() === currentName) {
                // No change needed
                return;
            }
            
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            
            if (sessions[sessionId]) {
                sessions[sessionId].name = newName.trim();
                await chrome.storage.local.set({ sessions });
                
                // Reload sessions to reflect the change
                loadSessions();
                updateStats();
                
                const status = document.getElementById('status');
                if (status) status.textContent = 'Session renamed successfully';
            } else {
                errorHandler.showUserFriendlyError('Session not found');
            }
            
        } catch (error) {
            errorHandler.logError(error, 'Rename Session');
            errorHandler.showUserFriendlyError(`Failed to rename session: ${error.message}`);
        }
    }

    async function deleteSession(sessionId) {
        try {
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            
            if (sessions[sessionId]) {
                delete sessions[sessionId];
                await chrome.storage.local.set({ sessions });
                
                // Clear selection if deleted session was selected
                if (selectedSession && selectedSession.id === sessionId) {
                    selectedSession = null;
                    const playbackBtn = document.getElementById('playbackBtn');
                    if (playbackBtn) playbackBtn.disabled = true;
                }
                
                loadSessions(); // Refresh the list
                updateStats(); // Update stats
                const status = document.getElementById('status');
                if (status) status.textContent = 'Session deleted successfully';
            }
        } catch (error) {
            errorHandler.logError(error, 'Delete Session');
            errorHandler.showUserFriendlyError(`Failed to delete session: ${error.message}`);
        }
    }

    async function deleteAllSessions() {
        try {
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            const sessionCount = Object.keys(sessions).length;
            
            if (sessionCount === 0) {
                const status = document.getElementById('status');
                if (status) status.textContent = 'No sessions to delete';
                return;
            }
            
            const confirmMessage = `Are you sure you want to delete all ${sessionCount} session${sessionCount > 1 ? 's' : ''}? This action cannot be undone.`;
            
            if (confirm(confirmMessage)) {
                // Clear all sessions
                await chrome.storage.local.set({ sessions: {} });
                
                // Clear current selection
                selectedSession = null;
                const playbackBtn = document.getElementById('playbackBtn');
                if (playbackBtn) playbackBtn.disabled = true;
                
                // Refresh UI
                loadSessions();
                updateStats();
                const status = document.getElementById('status');
                if (status) status.textContent = `All ${sessionCount} sessions deleted successfully`;
            }
        } catch (error) {
            errorHandler.logError(error, 'Delete All Sessions');
            errorHandler.showUserFriendlyError(`Failed to delete all sessions: ${error.message}`);
        }
    }

    async function loadSessions() {
        try {
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            
            const sessionsList = document.getElementById('sessionsList');
            
            if (Object.keys(sessions).length === 0) {
                sessionsList.innerHTML = `
                    <div class="text-center py-8 text-white/60">
                        <span class="material-icons text-3xl mb-2 block">video_library</span>
                        <p class="text-sm">No sessions recorded yet</p>
                        <p class="text-xs mt-1">Start recording to create your first session</p>
                    </div>
                `;
                return;
            }
            
            sessionsList.innerHTML = '';
            
            // Sort sessions by startTime in descending order (newest first)
            Object.entries(sessions)
                .sort(([, a], [, b]) => new Date(b.startTime) - new Date(a.startTime))
                .forEach(([id, session]) => {
                const sessionItem = document.createElement('div');
                sessionItem.className = 'session-item glass-morphism rounded-lg p-3 cursor-pointer flex items-center justify-between';
                sessionItem.dataset.sessionId = id;
                
                const startTime = new Date(session.startTime).toLocaleString();
                const pageCount = session.pages ? session.pages.length : 1;
                const actionCount = session.pages ? 
                    session.pages.reduce((total, page) => total + (page.actions?.length || 0), 0) :
                    (session.actions?.length || 0);
                
                sessionItem.innerHTML = `
                    <div class="flex-1 session-info">
                        <div class="font-semibold text-white text-xs mb-1 session-name" data-session-id="${id}">${session.name || `Session ${id.slice(-6)}`}</div>
                        <div class="text-xs text-white/70 flex items-center space-x-3">
                            <span class="flex items-center space-x-1">
                                <span class="material-icons text-xs">schedule</span>
                                <span>${new Date(session.startTime).toLocaleDateString()}</span>
                            </span>
                            <span class="flex items-center space-x-1">
                                <span class="material-icons text-xs">web</span>
                                <span>${pageCount} page${pageCount > 1 ? 's' : ''}</span>
                            </span>
                            <span class="flex items-center space-x-1">
                                <span class="material-icons text-xs">touch_app</span>
                                <span>${actionCount}</span>
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1">
                        <button class="rename-session-btn glass-button p-1 rounded-full hover:bg-blue-500/20 transition-colors" data-session-id="${id}" title="Rename session">
                            <span class="material-icons text-blue-400 text-sm">edit</span>
                        </button>
                        <button class="delete-session-btn glass-button p-1 rounded-full hover:bg-red-500/20 transition-colors" data-session-id="${id}" title="Delete session">
                            <span class="material-icons text-red-400 text-sm">delete</span>
                        </button>
                    </div>
                `;
                
                // Add click handler for session selection
                const sessionInfo = sessionItem.querySelector('.session-info');
                sessionInfo.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.session-item').forEach(item => 
                        item.classList.remove('selected'));
                    sessionItem.classList.add('selected');
                    selectedSession = session;
                    const playbackBtn = document.getElementById('playbackBtn');
                    if (playbackBtn) playbackBtn.disabled = false;
                });
                
                // Add rename handler
                const renameBtn = sessionItem.querySelector('.rename-session-btn');
                renameBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await renameSession(id, session);
                });
                
                // Add delete handler
                const deleteBtn = sessionItem.querySelector('.delete-session-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${session.name || `Session ${id.slice(-6)}`}"?`)) {
                        await deleteSession(id);
                    }
                });
                
                sessionsList.appendChild(sessionItem);
            });
            

            
        } catch (error) {
            errorHandler.logError(error, 'Load Sessions');
            console.error('Failed to load sessions:', error);
        }
    }

    // Initialize slider styling
    function initializeSliders() {
        console.log('Initializing slider styling');
        
        const sliders = document.querySelectorAll('.range-slider');
        sliders.forEach(slider => {
            const updateSlider = () => {
                const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100;
                slider.style.background = `linear-gradient(to right, #6366f1 0%, #6366f1 ${percentage}%, rgba(255,255,255,0.2) ${percentage}%, rgba(255,255,255,0.2) 100%)`;
            };
            
            updateSlider();
            slider.addEventListener('input', updateSlider);
        });
    }

    // Tab management - restored working logic with new CSS classes
    function initializeTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        console.log('Found tabs:', tabBtns.length, 'contents:', tabContents.length);

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                console.log('Tab clicked:', targetTab);
                
                // Update tab button states
                tabBtns.forEach(t => {
                    t.classList.remove('active');
                });
                btn.classList.add('active');
                
                // Update content visibility
                tabContents.forEach(content => {
                    if (content.id === `${targetTab}-tab`) {
                        content.classList.remove('hidden');
                        content.classList.add('animate-fade-in');
                        console.log('Showing tab:', targetTab);
                    } else {
                        content.classList.add('hidden');
                        content.classList.remove('animate-fade-in');
                    }
                });
                
                // Load sessions when sessions tab is opened
                if (targetTab === 'sessions') {
                    console.log('Loading sessions for sessions tab');
                    loadSessions();
                }
            });
        });
        
        // Initialize first tab
        if (tabBtns.length > 0) {
            tabBtns[0].classList.add('active');
            console.log('Initialized home tab as active');
        }
    }

    // Update stats on home page
    function updateStats() {
        chrome.storage.local.get('sessions').then(result => {
            const sessions = result.sessions || {};
            const sessionCount = Object.keys(sessions).length;
            let totalActions = 0;

            Object.values(sessions).forEach(session => {
                if (session.pages) {
                    totalActions += session.pages.reduce((total, page) => 
                        total + (page.actions ? page.actions.length : 0), 0);
                } else if (session.actions) {
                    totalActions += session.actions.length;
                }
            });

            const totalSessionsEl = document.getElementById('totalSessions');
            const totalActionsEl = document.getElementById('totalActions');
            
            if (totalSessionsEl) totalSessionsEl.textContent = sessionCount;
            if (totalActionsEl) totalActionsEl.textContent = totalActions;
        });
    }

// Global retry function
window.retryLastAction = function() {
    if (lastFailedAction) {
        lastFailedAction();
    }
};

document.addEventListener('DOMContentLoaded', async function() {
    const recordBtn = document.getElementById('recordBtn');
    const playbackBtn = document.getElementById('playbackBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    const status = document.getElementById('status');
    const sessionsList = document.getElementById('sessionsList');

    // Initialize components
    initializeTabs();
    await settingsManager.loadSettings();
    settingsManager.bindEvents();
    
    // Initialize custom slider styling
    initializeSliders();
    
    // Load existing sessions and update stats
    loadSessions();
    updateStats();
    
    // Restore recording state
    isRecording = await getRecordingState();
    updateRecordingUI();

    recordBtn.addEventListener('click', toggleRecording);
    playbackBtn.addEventListener('click', playbackSession);
    exportBtn.addEventListener('click', exportSession);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importSession);
    
    // Delete All button event listener
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAllSessions);
    }
    
    // Listen for playback completion messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'playbackCompleted') {
            console.log('✅ Received playback completion notification');
            status.textContent = 'Playback completed successfully';
            
            // Reset any playback-related UI state
            selectedSession = null;
            playbackBtn.disabled = true;
            
            sendResponse({ success: true });
        }
    });

    function updateRecordingUI() {
        const recordIcon = recordBtn.querySelector('.material-icons');
        const recordText = recordBtn.querySelector('span:last-child');
        
        if (isRecording) {
            recordText.textContent = 'Stop Recording';
            recordIcon.textContent = 'stop';
            recordBtn.classList.add('recording-pulse');
            recordBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            recordBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            status.textContent = 'Recording in progress... (Navigate to other pages to record multi-page sessions)';
            playbackBtn.disabled = true;
        } else {
            recordText.textContent = 'Start Recording';
            recordIcon.textContent = 'fiber_manual_record';
            recordBtn.classList.remove('recording-pulse');
            recordBtn.style.background = '';
            recordBtn.style.borderColor = '';
            if (status.textContent.includes('Recording') || status.textContent.includes('Ready')) {
                status.textContent = 'Ready to record';
            }
            playbackBtn.disabled = selectedSession === null;
        }
    }

    async function toggleRecording() {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        popupLogger.log('🎬 Starting recording process...');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            popupLogger.log('🎬 Current tab:', { id: tab.id, url: tab.url, status: tab.status });
            
            // Check if we're on a valid page
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                errorHandler.showUserFriendlyError('Cannot record on browser pages. Please navigate to a website.');
                return;
            }
            
            // Check if page is fully loaded
            if (tab.status !== 'complete') {
                console.log('🎬 Page still loading, waiting...');
                status.textContent = 'Waiting for page to load...';
                
                // Wait for page to complete loading
                await new Promise((resolve) => {
                    const checkComplete = () => {
                        chrome.tabs.get(tab.id, (updatedTab) => {
                            if (updatedTab.status === 'complete') {
                                resolve();
                            } else {
                                setTimeout(checkComplete, 500);
                            }
                        });
                    };
                    checkComplete();
                });
                console.log('🎬 Page loading completed');
            }
            
            status.textContent = 'Starting recording...';
            recordBtn.disabled = true;
            
            console.log('🎬 Starting global recording via background script...');
            // Start global recording via background script
            const bgResponse = await chrome.runtime.sendMessage({ 
                action: 'startGlobalRecording', 
                tabId: tab.id,
                settings: settingsManager.getSettings()
            });
            
            if (!bgResponse || !bgResponse.success) {
                throw new Error(bgResponse?.error || 'Background script failed to start recording');
            }
            console.log('✅ Background script started recording successfully');
            
            status.textContent = 'Initializing content script...';
            console.log('🎬 Ensuring content script is ready...');
            
            // Ensure content script is injected and ready
            const contentScriptReady = await ensureContentScriptReady(tab.id);
            if (!contentScriptReady) {
                throw new Error('Content script failed to initialize after multiple attempts');
            }
            
            status.textContent = 'Starting session recording...';
            console.log('🎬 Starting recording on content script...');
            
            // Start recording on current tab with settings
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { 
                action: 'startRecording',
                settings: settingsManager.getSettings()
            });
            
            if (!contentResponse || !contentResponse.success) {
                throw new Error(contentResponse?.error || 'Content script failed to start recording');
            }
            console.log('✅ Content script started recording successfully');
            
            isRecording = true;
            await saveRecordingState(true);
            updateRecordingUI();
            
            popupLogger.log('🎉 Recording started successfully!');
            
        } catch (error) {
            popupLogger.error('❌ Recording failed:', error);
            errorHandler.logError(error, 'Start Recording');
            lastFailedAction = startRecording;
            errorHandler.showUserFriendlyError(`Failed to start recording: ${error.message}`, true);
            recordBtn.disabled = false;
            status.textContent = 'Failed to start recording';
        }
    }

    async function ensureContentScriptReady(tabId, maxRetries = 5) {
        popupLogger.log(`🔧 Ensuring content script ready for tab ${tabId}...`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                popupLogger.log(`🔧 Attempt ${attempt}/${maxRetries}: Injecting content script...`);
                
                // Try to inject the content script
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }).catch(error => {
                    // Content script might already be injected, which is fine
                    if (!error.message.includes('already injected') && !error.message.includes('duplicate')) {
                        throw error;
                    }
                    console.log(`🔧 Content script already injected (attempt ${attempt})`);
                });
                
                // Progressive wait time - start with shorter delay, increase if needed
                const waitTime = Math.min(300 + (attempt * 200), 1500);
                console.log(`🔧 Waiting ${waitTime}ms for script initialization...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Test if content script is responsive with longer timeout for first attempts
                const pingTimeout = attempt <= 2 ? 3000 : 2000;
                console.log(`🔧 Pinging content script (timeout: ${pingTimeout}ms)...`);
                
                const response = await Promise.race([
                    chrome.tabs.sendMessage(tabId, { action: 'ping' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), pingTimeout))
                ]);
                
                if (response && response.success) {
                    console.log(`✅ Content script ready after ${attempt} attempt(s)`);
                    return true;
                }
                
                console.log(`❌ Content script not responsive on attempt ${attempt}`);
                
            } catch (error) {
                console.log(`❌ Content script attempt ${attempt} failed:`, error.message);
                errorHandler.logError(error, `Content Script Ready Attempt ${attempt}`);
                
                if (attempt < maxRetries) {
                    const retryDelay = Math.min(500 + (attempt * 300), 2000);
                    console.log(`🔧 Retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        
        console.log(`❌ Content script failed to become ready after ${maxRetries} attempts`);
        return false;
    }

    async function stopRecording() {
        try {
            status.textContent = 'Stopping recording...';
            recordBtn.disabled = true;

            // Stop global recording
            const bgResponse = await chrome.runtime.sendMessage({ action: 'stopGlobalRecording' });
            if (!bgResponse || !bgResponse.success) {
                throw new Error(bgResponse?.error || 'Failed to stop recording');
            }

            isRecording = false;
            await saveRecordingState(false);
            updateRecordingUI();
            
            if (bgResponse.session && bgResponse.session.pages && bgResponse.session.pages.length > 0) {
                // Check if the session has any actions
                const totalActions = bgResponse.session.pages.reduce((total, page) => 
                    total + (page.actions ? page.actions.length : 0), 0);
                
                if (totalActions > 0) {
                    // Save the session to storage
                    await saveSession(bgResponse.session);
                    status.textContent = `Recording completed! Captured ${totalActions} actions across ${bgResponse.session.pages.length} page(s)`;
                    loadSessions(); // Refresh the sessions list
                    updateStats(); // Update stats
                } else {
                    status.textContent = 'Recording stopped (no actions recorded)';
                }
            } else {
                status.textContent = 'Recording stopped (no session data)';
            }
            
        } catch (error) {
            errorHandler.logError(error, 'Stop Recording');
            errorHandler.showUserFriendlyError(`Failed to stop recording: ${error.message}`);
        } finally {
            recordBtn.disabled = false;
        }
    }

    // Helper function to save session to storage
    async function saveSession(session) {
        try {
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            
            // Generate a unique session name
            const timestamp = new Date(session.startTime).toLocaleString();
            session.name = `Session ${session.id.slice(-6)} - ${timestamp}`;
            
            sessions[session.id] = session;
            await chrome.storage.local.set({ sessions });
            
            if (settingsManager.getSettings().advanced.debugMode) {
                console.log('Session saved:', session);
            }
        } catch (error) {
            errorHandler.logError(error, 'Save Session');
            throw error;
        }
    }

    async function playbackSession() {
        if (!selectedSession) {
            errorHandler.showUserFriendlyError('Please select a session to playback');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            status.textContent = 'Starting playback...';
            playbackBtn.disabled = true;
            
            // Send playback command with settings
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'playbackSession', 
                session: selectedSession,
                settings: settingsManager.getSettings()
            });
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to start playback');
            }
            
            status.textContent = 'Playback in progress...';
            
        } catch (error) {
            errorHandler.logError(error, 'Playback Session');
            lastFailedAction = playbackSession;
            errorHandler.showUserFriendlyError(`Failed to start playback: ${error.message}`, true);
            playbackBtn.disabled = false;
        }
    }

    async function saveSession(session) {
        const sessions = await getSessions();
        const sessionId = Date.now().toString();
        session.id = sessionId;
        session.name = `Session ${new Date().toLocaleString()}`;
        sessions[sessionId] = session;
        
        await chrome.storage.local.set({ sessions: sessions });
    }

    async function getSessions() {
        const result = await chrome.storage.local.get('sessions');
        return result.sessions || {};
    }



    async function exportSession() {
        if (!selectedSession) {
            errorHandler.showUserFriendlyError('Please select a session to export');
            return;
        }

        try {
            // Add metadata to the export
            const exportData = {
                ...selectedSession,
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                settings: settingsManager.getSettings()
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `flowtrace-session-${selectedSession.id || Date.now()}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            status.textContent = 'Session exported successfully';
            
        } catch (error) {
            errorHandler.logError(error, 'Export Session');
            errorHandler.showUserFriendlyError(`Failed to export session: ${error.message}`);
        }
    }

    async function importSession(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const sessionData = JSON.parse(text);
            
            // Validate session data
            const validation = sessionValidator.validateSession(sessionData);
            
            let finalSessionData = sessionData;
            let statusMessage = 'Session imported successfully';
            
            if (!validation.isValid) {
                if (validation.canRepair) {
                    // Attempt to repair the session
                    const repairResult = sessionValidator.repairSession(sessionData);
                    finalSessionData = repairResult.repairedSession;
                    statusMessage = `Session repaired and imported (${repairResult.repairs.length} fixes applied)`;
                    
                    if (settingsManager.getSettings().advanced.debugMode) {
                        console.log('Session repairs applied:', repairResult.repairs);
                    }
                } else {
                    throw new Error(`Invalid session: ${validation.issues.join(', ')}`);
                }
            } else if (validation.warnings.length > 0) {
                statusMessage = `Session imported with warnings (${validation.warnings.length} warnings)`;
                if (settingsManager.getSettings().advanced.debugMode) {
                    console.log('Session warnings:', validation.warnings);
                }
            }
            
            // Generate new ID to avoid conflicts
            finalSessionData.id = Date.now().toString();
            finalSessionData.importedAt = new Date().toISOString();
            
            // Save imported session
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || {};
            sessions[finalSessionData.id] = finalSessionData;
            await chrome.storage.local.set({ sessions });
            
            loadSessions();
            updateStats();
            status.textContent = statusMessage;
            
        } catch (error) {
            errorHandler.logError(error, 'Import Session');
            errorHandler.showUserFriendlyError(`Failed to import session: ${error.message}`);
        }
        
        // Clear the file input
        event.target.value = '';
    }

    // Debug function to inspect sessions
    window.debugSessions = async function() {
        const sessions = await getSessions();
        console.log('🔍 === SAVED SESSIONS DEBUG ===');
        console.log('Total sessions:', Object.keys(sessions).length);
        
        Object.entries(sessions).forEach(([id, session], index) => {
            console.log(`\n📋 Session ${index + 1} (ID: ${id}):`);
            console.log('Name:', session.name);
            console.log('Structure:', session.pages ? 'Multi-page' : 'Legacy');
            
            if (session.pages) {
                console.log('Pages:', session.pages.length);
                session.pages.forEach((page, pageIndex) => {
                    console.log(`  Page ${pageIndex + 1}:`, {
                        url: page.url,
                        title: page.title,
                        actionCount: page.actions ? page.actions.length : 0
                    });
                    if (page.actions && page.actions.length > 0) {
                        console.log('    Actions:', page.actions);
                    }
                });
            } else if (session.actions) {
                console.log('Legacy actions:', session.actions.length);
                if (session.actions.length > 0) {
                    console.log('Actions:', session.actions);
                }
            }
        });
        
        if (selectedSession) {
            console.log('\n🎯 Currently selected session:', selectedSession);
        }
        
        return sessions;
    };

}); 
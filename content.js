// Guard against multiple script injections
if (window.sessionRecorderLoaded) {
    console.log('Session Recorder already loaded, skipping...');
} else {
    window.sessionRecorderLoaded = true;

// Centralized logging utility
class Logger {
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
const logger = new Logger();

class SessionRecorder {
    constructor() {
        logger.log('🔧 Starting SessionRecorder constructor...');
        this.isRecording = false;
        this.currentSession = null;
        this.currentPageData = null;
        this.playbackOverlay = null;
        this.playbackIndex = 0;
        this.playbackSession = null;
        this.isPlaybackPaused = false;
        this.playbackTimeoutId = null;
        
        // Debouncing and deduplication
        this.lastRecordedAction = null;
        this.actionDebounceTimeout = null;
        this.recordingQueue = [];
        this.isProcessingQueue = false;
        
        // Scroll optimization
        this.scrollStartPosition = null;
        
        // Extension context tracking
        this.extensionContextValid = true;
        
        // Add unique instance ID for debugging
        this.instanceId = Math.random().toString(36).substr(2, 9);
        
        this.scrollTimeout = null;
        this.isScrolling = false;
        
        // Settings and error handling
        logger.log('🔧 Defining settings object...');
        this.settings = {
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
        
        logger.log('🔧 Settings defined successfully:', this.settings);
        
        // Initialize logger with debug mode (after settings are defined)
        logger.setDebugMode(this.settings?.advanced?.debugMode || false);
        logger.log('🎬 SessionRecorder instance created:', this.instanceId);
        
        this.errorHandler = {
            errors: [],
            maxErrors: 100,
            logError: (error, context = '') => {
                const errorEntry = {
                    timestamp: Date.now(),
                    message: error.message || error,
                    context: context,
                    stack: error.stack || null,
                    url: window.location.href
                };
                
                this.errorHandler.errors.unshift(errorEntry);
                if (this.errorHandler.errors.length > this.errorHandler.maxErrors) {
                    this.errorHandler.errors = this.errorHandler.errors.slice(0, this.errorHandler.maxErrors);
                }
                
                if (this.settings?.advanced?.debugMode) {
                    console.error(`[FlowTrace Error] ${context}:`, error);
                }
            },
            getRecentErrors: () => this.errorHandler.errors.slice(0, 10)
        };
        
        // Performance monitoring
        this.performanceMonitor = {
            metrics: {
                recording: {
                    startTime: null,
                    endTime: null,
                    actionsRecorded: 0,
                    pagesRecorded: 0,
                    errors: 0
                },
                playback: {
                    startTime: null,
                    endTime: null,
                    actionsExecuted: 0,
                    actionsSuccessful: 0,
                    actionsFailed: 0,
                    averageActionDelay: 0,
                    elementDetectionAttempts: 0,
                    elementDetectionSuccesses: 0
                }
            },
            
            startRecordingMetrics: () => {
                this.performanceMonitor.metrics.recording = {
                    startTime: Date.now(),
                    endTime: null,
                    actionsRecorded: 0,
                    pagesRecorded: 1,
                    errors: 0
                };
            },
            
            endRecordingMetrics: () => {
                this.performanceMonitor.metrics.recording.endTime = Date.now();
                if (this.settings?.advanced?.debugMode) {
                    const duration = this.performanceMonitor.metrics.recording.endTime - this.performanceMonitor.metrics.recording.startTime;
                    console.log('Recording Performance:', {
                        duration: `${duration}ms`,
                        actionsPerSecond: (this.performanceMonitor.metrics.recording.actionsRecorded / (duration / 1000)).toFixed(2),
                        ...this.performanceMonitor.metrics.recording
                    });
                }
            },
            
            startPlaybackMetrics: () => {
                this.performanceMonitor.metrics.playback = {
                    startTime: Date.now(),
                    endTime: null,
                    actionsExecuted: 0,
                    actionsSuccessful: 0,
                    actionsFailed: 0,
                    averageActionDelay: 0,
                    elementDetectionAttempts: 0,
                    elementDetectionSuccesses: 0
                };
            },
            
            endPlaybackMetrics: () => {
                this.performanceMonitor.metrics.playback.endTime = Date.now();
                if (this.settings?.advanced?.debugMode) {
                    const duration = this.performanceMonitor.metrics.playback.endTime - this.performanceMonitor.metrics.playback.startTime;
                    const successRate = this.performanceMonitor.metrics.playback.actionsExecuted > 0 ? 
                        (this.performanceMonitor.metrics.playback.actionsSuccessful / this.performanceMonitor.metrics.playback.actionsExecuted * 100).toFixed(1) : 0;
                    const detectionRate = this.performanceMonitor.metrics.playback.elementDetectionAttempts > 0 ?
                        (this.performanceMonitor.metrics.playback.elementDetectionSuccesses / this.performanceMonitor.metrics.playback.elementDetectionAttempts * 100).toFixed(1) : 0;
                    
                    console.log('Playback Performance:', {
                        duration: `${duration}ms`,
                        successRate: `${successRate}%`,
                        elementDetectionRate: `${detectionRate}%`,
                        ...this.performanceMonitor.metrics.playback
                    });
                }
            },
            
            recordAction: () => {
                this.performanceMonitor.metrics.recording.actionsRecorded++;
            },
            
            recordError: () => {
                this.performanceMonitor.metrics.recording.errors++;
            },
            
            recordPlaybackAction: (success = true) => {
                this.performanceMonitor.metrics.playback.actionsExecuted++;
                if (success) {
                    this.performanceMonitor.metrics.playback.actionsSuccessful++;
                } else {
                    this.performanceMonitor.metrics.playback.actionsFailed++;
                }
            },
            
            recordElementDetection: (success = true) => {
                this.performanceMonitor.metrics.playback.elementDetectionAttempts++;
                if (success) {
                    this.performanceMonitor.metrics.playback.elementDetectionSuccesses++;
                }
            },
            
            getMetrics: () => this.performanceMonitor.metrics
        };
        
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'ping':
                    // Ping handler for content script readiness check
                    sendResponse({ success: true, ready: true });
                    break;
                case 'startRecording':
                    try {
                        // Update settings if provided
                        if (request.settings) {
                            this.settings = { ...this.settings, ...request.settings };
                            logger.setDebugMode(this.settings.advanced.debugMode);
                        }
                        this.startRecording();
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Start Recording');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'stopRecording':
                    try {
                        const session = this.stopRecording();
                        sendResponse({ success: true, session: session });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Stop Recording');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'continueRecording':
                    try {
                        if (request.settings) {
                            this.settings = { ...this.settings, ...request.settings };
                            logger.setDebugMode(this.settings.advanced.debugMode);
                        }
                        this.continueRecording(request.session);
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Continue Recording');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'recordNavigation':
                    try {
                        this.recordNavigation(request.url, request.timestamp);
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Record Navigation');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'playbackSession':
                    try {
                        // Update settings if provided
                        if (request.settings) {
                            this.settings = { ...this.settings, ...request.settings };
                        }
                        this.playbackSession = request.session;
                        this.startPlayback();
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Start Playback');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'continuePlayback':
                    try {
                        if (request.settings) {
                            this.settings = { ...this.settings, ...request.settings };
                        }
                        this.playbackSession = request.session;
                        this.playbackPageIndex = request.pageIndex;
                        this.playbackActionIndex = request.actionIndex;
                        this.currentPlaybackPage = this.playbackSession.pages[this.playbackPageIndex];
                        this.continuePlaybackAfterNavigation();
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Continue Playback');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'updateSettings':
                    try {
                        this.settings = { ...this.settings, ...request.settings };
                        sendResponse({ success: true });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Update Settings');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                case 'getStatus':
                    try {
                        sendResponse({
                            success: true,
                            status: {
                                isRecording: this.isRecording,
                                isPlaybackActive: !!this.playbackSession,
                                currentUrl: window.location.href,
                                settings: this.settings,
                                recentErrors: this.errorHandler.getRecentErrors()
                            }
                        });
                    } catch (error) {
                        this.errorHandler.logError(error, 'Get Status');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                    
                case 'updateDebugMode':
                    logger.setDebugMode(request.debugMode);
                    this.settings.advanced.debugMode = request.debugMode;
                    sendResponse({ success: true });
                    break;
            }
            return true; // Keep message channel open for async response
        });
    }

    startRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.currentSession = {
            id: Date.now().toString(),
            startTime: Date.now(),
            pages: []
        };
        
        // Start performance monitoring
        this.performanceMonitor.startRecordingMetrics();
        
        // Start recording on current page
        this.startPageRecording();
        
        console.log('Recording started');
        this.showRecordingIndicator();
    }

    continueRecording(session) {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.currentSession = session;
        
        // Start recording on current page
        this.startPageRecording();
        
        console.log('Recording continued on new page');
        this.showRecordingIndicator();
    }

    startPageRecording() {
        this.currentPageData = {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            actions: []
        };
        
        // Add event listeners for various user interactions
        this.addEventListeners();
        
        // Add this page to the session
        if (this.currentSession) {
            this.currentSession.pages.push(this.currentPageData);
            this.updateBackgroundSession();
        }
    }

    recordNavigation(url, timestamp) {
        if (!this.isRecording) return;
        
        // Save current page data before navigation
        if (this.currentPageData) {
            this.currentPageData.endTime = timestamp;
            this.updateBackgroundSession();
        }
        
        console.log('Navigation recorded:', url);
    }

    updateBackgroundSession() {
        // Check if extension context is still valid
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage || !this.extensionContextValid) {
            logger.warn('⚠️ Extension context invalidated, cannot update session');
            this.extensionContextValid = false;
            return;
        }

        const totalActions = this.currentSession?.pages?.reduce((total, page) => 
            total + (page.actions ? page.actions.length : 0), 0) || 0;
        logger.log(`🔄 Updating background session: ${this.currentSession?.pages?.length || 0} pages, ${totalActions} actions`);
        
        try {
            chrome.runtime.sendMessage({
                action: 'updateSession',
                session: this.currentSession
            }, (response) => {
                // Handle response or ignore if extension context is invalidated
                if (chrome.runtime.lastError) {
                    logger.warn('⚠️ Extension context invalidated during session update');
                    return;
                } else {
                    logger.log('✅ Background session updated successfully');
                }
            });
        } catch (error) {
            logger.error('❌ Failed to send session update to background script:', error.message);
            // Extension context is invalidated, stop trying to update
            this.extensionContextValid = false;
            return;
        }
    }

    stopRecording() {
        if (!this.isRecording) {
            console.log('❌ Not currently recording, cannot stop');
            return null;
        }
        
        logger.log('🛑 Stopping recording session... [instance:', this.instanceId, ']');
        
        this.isRecording = false;
        this.removeEventListeners();
        this.hideRecordingIndicator();
        
        // Finalize current page data BEFORE clearing session
        if (this.currentPageData) {
            this.currentPageData.endTime = Date.now();
            logger.log('📄 Finalized current page data:', this.currentPageData);
        }
        
        // Preserve session data for summary and return value
        const sessionToReturn = this.currentSession;
        
        // Calculate total actions for summary BEFORE clearing session
        const totalActions = sessionToReturn?.pages?.reduce((total, page) => 
            total + (page.actions ? page.actions.length : 0), 0) || 0;
        
        logger.log('🔍 Session data being returned:', JSON.stringify(sessionToReturn, null, 2));
        logger.log(`📊 Session summary: ${sessionToReturn?.pages?.length || 0} pages, ${totalActions} total actions`);
        
        // End performance monitoring
        this.performanceMonitor.endRecordingMetrics();
        
        // Force clear any remaining state AFTER calculating summary
        this.recordingQueue = [];
        this.currentSession = null;
        this.currentPageData = null;
        
        console.log('✅ Recording stopped successfully. Session data preserved for return.');
        
        return sessionToReturn;
    }

    addEventListeners() {
        // Mouse events - use passive listeners where possible to improve performance
        document.addEventListener('click', this.handleClick, { capture: true, passive: false });
        document.addEventListener('dblclick', this.handleDoubleClick, { capture: true, passive: false });
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown, { capture: true, passive: true });
        document.addEventListener('keyup', this.handleKeyUp, { capture: true, passive: true });
        
        // Form events
        document.addEventListener('input', this.handleInput, { capture: true, passive: true });
        document.addEventListener('change', this.handleChange, { capture: true, passive: true });
        document.addEventListener('submit', this.handleSubmit, { capture: true, passive: false });
        
        // Scroll events - use passive for better performance
        document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        
        // Window events
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        logger.log('✅ Event listeners added for recording');
    }

    removeEventListeners() {
        logger.log('🧹 Removing event listeners...');
        document.removeEventListener('click', this.handleClick, { capture: true });
        document.removeEventListener('dblclick', this.handleDoubleClick, { capture: true });
        document.removeEventListener('keydown', this.handleKeyDown, { capture: true });
        document.removeEventListener('keyup', this.handleKeyUp, { capture: true });
        document.removeEventListener('input', this.handleInput, { capture: true });
        document.removeEventListener('change', this.handleChange, { capture: true });
        document.removeEventListener('submit', this.handleSubmit, { capture: true });
        document.removeEventListener('scroll', this.handleScroll, { capture: true });
        window.removeEventListener('resize', this.handleResize);
        
        // Clear any pending debounce timeouts
        if (this.actionDebounceTimeout) {
            clearTimeout(this.actionDebounceTimeout);
            this.actionDebounceTimeout = null;
        }
        
        // Clear scroll timeout and process final scroll if needed
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        if (this.isScrolling) {
            // Record final scroll position
            const currentScrollPosition = {
                x: window.scrollX,
                y: window.scrollY
            };
            if (this.scrollStartPosition) {
                const scrollDistanceX = Math.abs(currentScrollPosition.x - this.scrollStartPosition.x);
                const scrollDistanceY = Math.abs(currentScrollPosition.y - this.scrollStartPosition.y);
                
                if (scrollDistanceX > 5 || scrollDistanceY > 5) {
                    const scrollAction = {
                        type: 'scroll',
                        timestamp: Date.now() - this.currentPageData.timestamp,
                        target: 'window',
                        coordinates: { x: 0, y: 0, pageX: 0, pageY: 0 },
                        key: null,
                        value: null,
                        scrollPosition: currentScrollPosition,
                        scrollStart: this.scrollStartPosition,
                        viewport: { width: window.innerWidth, height: window.innerHeight }
                    };
                    this.currentPageData.actions.push(scrollAction);
                    console.log('✅ Recorded final scroll action on stop:', scrollAction);
                }
            }
            this.isScrolling = false;
            this.scrollStartPosition = null;
        }
        
        // Process any remaining queued actions
        if (this.recordingQueue.length > 0) {
            this.processRecordingQueue();
        }
        
        logger.log('✅ Event listeners removed and recording cleaned up');
    }

    // Event handlers
    handleClick = (event) => {
        this.recordAction('click', event);
    }

    handleDoubleClick = (event) => {
        this.recordAction('dblclick', event);
    }



    handleKeyDown = (event) => {
        this.recordAction('keydown', event);
    }

    handleKeyUp = (event) => {
        this.recordAction('keyup', event);
    }

    handleInput = (event) => {
        this.recordAction('input', event);
    }

    handleChange = (event) => {
        this.recordAction('change', event);
    }

    handleSubmit = (event) => {
        this.recordAction('submit', event);
    }

    handleScroll = (event) => {
        this.recordScrollAction(event);
    }

    handleResize = (event) => {
        this.recordAction('resize', event);
    }

    recordAction(type, event) {
        if (!this.isRecording) {
            console.log('❌ Not recording, ignoring action:', type, 'isRecording:', this.isRecording, 'instance:', this.instanceId);
            return;
        }
        
        // Double-check extension context is still valid
        if (!this.extensionContextValid) {
            console.log('❌ Extension context invalid, ignoring action:', type);
            this.isRecording = false;
            return;
        }
        if (!this.currentPageData) {
            console.error('No current page data available for recording');
            return;
        }

        // Handle cases where event might not have a target
        const eventTarget = event.target || event.currentTarget || document;

        // Get more accurate coordinates for click events
        let coordinates = {
            x: event.clientX || 0,
            y: event.clientY || 0,
            pageX: event.pageX || 0,
            pageY: event.pageY || 0
        };
        
        // For click events, also store element-relative coordinates
        if (['click', 'dblclick'].includes(type) && eventTarget && eventTarget.getBoundingClientRect) {
            const rect = eventTarget.getBoundingClientRect();
            coordinates.elementX = (event.clientX || 0) - rect.left;
            coordinates.elementY = (event.clientY || 0) - rect.top;
            coordinates.elementWidth = rect.width;
            coordinates.elementHeight = rect.height;
        }

        const action = {
            type: type,
            timestamp: Date.now() - this.currentPageData.timestamp,
            target: this.getElementSelector(eventTarget),
            coordinates: coordinates,
            key: event.key || null,
            value: eventTarget?.value || null,
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        // Add to queue for debounced processing
        this.queueAction(action);
    }

    recordScrollAction(event) {
        if (!this.isRecording || !this.currentPageData) {
            return;
        }

        const currentScrollPosition = {
            x: window.scrollX,
            y: window.scrollY
        };

        // If this is the start of a scroll sequence, record the starting position
        if (!this.isScrolling) {
            this.isScrolling = true;
            this.scrollStartPosition = currentScrollPosition;
        }

        // Clear any existing scroll timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Set a timeout to record the final scroll position
        this.scrollTimeout = setTimeout(() => {
            if (this.isScrolling) {
                // Record a single scroll action from start to end position
                const scrollAction = {
                    type: 'scroll',
                    timestamp: Date.now() - this.currentPageData.timestamp,
                    target: 'window',
                    coordinates: {
                        x: 0,
                        y: 0,
                        pageX: 0,
                        pageY: 0
                    },
                    key: null,
                    value: null,
                    scrollPosition: currentScrollPosition,
                    scrollStart: this.scrollStartPosition,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                };

                // Only record if there's meaningful scroll distance
                const scrollDistanceX = Math.abs(currentScrollPosition.x - this.scrollStartPosition.x);
                const scrollDistanceY = Math.abs(currentScrollPosition.y - this.scrollStartPosition.y);
                
                if (scrollDistanceX > 5 || scrollDistanceY > 5) {
                    this.currentPageData.actions.push(scrollAction);
                    console.log('✅ Recorded scroll action:', scrollAction);
                    this.lastRecordedAction = scrollAction;
                    this.updateBackgroundSession();
                }

                this.isScrolling = false;
                this.scrollStartPosition = null;
            }
        }, 200); // Wait 200ms after scrolling stops
    }

    queueAction(action) {
        // Check for duplicate actions to prevent glitchy recording
        if (this.isDuplicateAction(action)) {
            console.log('Skipping duplicate action:', action.type);
            return;
        }

        this.recordingQueue.push(action);
        
        // Clear existing debounce timeout
        if (this.actionDebounceTimeout) {
            clearTimeout(this.actionDebounceTimeout);
        }

        // Process queue after a short delay to allow for batching
        this.actionDebounceTimeout = setTimeout(() => {
            // Check if extension context is still valid before processing
            if (!this.extensionContextValid || !chrome || !chrome.runtime) {
                if (this.settings.advanced.debugMode) {
                    console.log('Extension context invalidated, stopping queue processing');
                }
                this.extensionContextValid = false;
                this.isRecording = false;
                return;
            }
            
            try {
                this.processRecordingQueue();
            } catch (error) {
                if (this.settings.advanced.debugMode) {
                    console.log('Error processing recording queue:', error.message);
                }
                // Stop processing if extension context is invalidated
                this.extensionContextValid = false;
                this.isRecording = false;
            }
        }, this.getDebounceDelay(action.type));
    }

    getDebounceDelay(actionType) {
        // Different debounce delays for different action types
        switch (actionType) {
            case 'scroll':
                return 300; // Longer delay for scroll to capture end position
            case 'input':
                return 100; // Medium delay for input to capture typing
            case 'mousemove':
                return 200; // Longer delay for mouse movements
            case 'resize':
                return 300; // Longer delay for resize events
            default:
                return 50; // Short delay for clicks and other discrete actions
        }
    }

    isDuplicateAction(newAction) {
        if (!this.lastRecordedAction) return false;

        const last = this.lastRecordedAction;
        const timeDiff = newAction.timestamp - last.timestamp;

        // Check for duplicate actions based on type and timing
        switch (newAction.type) {
            case 'scroll':
                // Consider scroll duplicate if within 200ms and similar position
                if (last.type === 'scroll' && timeDiff < 200) {
                    const scrollDiffX = Math.abs(newAction.scrollPosition.x - last.scrollPosition.x);
                    const scrollDiffY = Math.abs(newAction.scrollPosition.y - last.scrollPosition.y);
                    return scrollDiffX < 20 && scrollDiffY < 20;
                }
                break;
                
            case 'mousemove':
                // Consider mousemove duplicate if within 50ms and similar coordinates
                if (last.type === 'mousemove' && timeDiff < 50) {
                    const coordDiffX = Math.abs(newAction.coordinates.x - last.coordinates.x);
                    const coordDiffY = Math.abs(newAction.coordinates.y - last.coordinates.y);
                    return coordDiffX < 5 && coordDiffY < 5;
                }
                break;
                
            case 'input':
                // Consider input duplicate if same element and very close in time
                if (last.type === 'input' && last.target === newAction.target && timeDiff < 50) {
                    return true;
                }
                break;
                
            case 'keydown':
            case 'keyup':
                // Avoid duplicate key events
                if (last.type === newAction.type && last.key === newAction.key && timeDiff < 30) {
                    return true;
                }
                break;
        }

        return false;
    }

    processRecordingQueue() {
        if (this.isProcessingQueue || this.recordingQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        // Process all queued actions
        while (this.recordingQueue.length > 0) {
            const action = this.recordingQueue.shift();
            
            // Final duplicate check before recording
            if (!this.isDuplicateAction(action)) {
                this.currentPageData.actions.push(action);
                this.performanceMonitor.recordAction();
                logger.log(`✅ Recorded action: ${action.type} on ${this.currentPageData.url} [instance: ${this.instanceId}]`, action);
                this.lastRecordedAction = action;
            }
        }

        this.isProcessingQueue = false;
        
        // Update the session in background script
        this.updateBackgroundSession();
    }

    getElementSelector(element) {
        if (!element) return null;
        
        // Handle non-element targets (like document, window)
        if (!element.tagName) {
            if (element === document) return 'document';
            if (element === window) return 'window';
            return 'unknown';
        }
        
        // Try to get the most unique and stable selector
        const selectors = [];
        
        // 1. ID selector (most reliable)
        if (element.id && element.id.trim()) {
            const idSelector = `#${CSS.escape(element.id)}`;
            if (document.querySelectorAll(idSelector).length === 1) {
                return idSelector;
            }
        }
        
        // 2. Data attributes (very reliable for apps)
        const dataAttrs = ['data-testid', 'data-test', 'data-cy', 'data-id', 'data-automation-id'];
        for (const attr of dataAttrs) {
            const value = element.getAttribute(attr);
            if (value && value.trim()) {
                const dataSelector = `[${attr}="${CSS.escape(value)}"]`;
                if (document.querySelectorAll(dataSelector).length === 1) {
                    return dataSelector;
                }
            }
        }
        
        // 3. Name attribute for form elements
        if (element.name && element.name.trim()) {
            const nameSelector = `${element.tagName.toLowerCase()}[name="${CSS.escape(element.name)}"]`;
            if (document.querySelectorAll(nameSelector).length === 1) {
                return nameSelector;
            }
        }
        
        // 4. Unique class combinations
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ')
                .filter(c => c.length > 0 && !c.match(/^(hover|active|focus|selected|disabled)$/))
                .slice(0, 3); // Limit to first 3 classes to avoid overly specific selectors
                
            if (classes.length > 0) {
                const classSelector = `${element.tagName.toLowerCase()}.${classes.map(c => CSS.escape(c)).join('.')}`;
                if (document.querySelectorAll(classSelector).length === 1) {
                    return classSelector;
                }
                selectors.push(classSelector);
            }
        }
        
        // 5. Build path-based selector for better accuracy
        const getElementPath = (el) => {
            const path = [];
            let current = el;
            
            while (current && current !== document.body && current !== document.documentElement) {
                let selector = current.tagName.toLowerCase();
                
                // Add ID if available
                if (current.id && current.id.trim()) {
                    selector += `#${CSS.escape(current.id)}`;
                    path.unshift(selector);
                    break; // ID should be unique, stop here
                }
                
                // Add classes if available
                if (current.className && typeof current.className === 'string') {
                    const classes = current.className.split(' ')
                        .filter(c => c.length > 0 && !c.match(/^(hover|active|focus|selected|disabled)$/))
                        .slice(0, 2);
                    if (classes.length > 0) {
                        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
                    }
                }
                
                // Add nth-child if needed for uniqueness
                if (current.parentNode) {
                    const siblings = Array.from(current.parentNode.children)
                        .filter(sibling => sibling.tagName === current.tagName);
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current);
                        selector += `:nth-of-type(${index + 1})`;
                    }
                }
                
                path.unshift(selector);
                current = current.parentNode;
                
                // Limit path depth to avoid overly long selectors
                if (path.length >= 4) break;
            }
            
            return path.join(' > ');
        };
        
        const pathSelector = getElementPath(element);
        if (pathSelector && document.querySelectorAll(pathSelector).length === 1) {
            return pathSelector;
        }
        
        // 6. Fallback with text content for links and buttons
        if (['a', 'button'].includes(element.tagName.toLowerCase())) {
            const textContent = element.textContent?.trim().substring(0, 30);
            if (textContent) {
                const textSelector = `${element.tagName.toLowerCase()}:contains("${textContent}")`;
                // Note: :contains is not standard CSS, we'll handle this in findElement
                return `${element.tagName.toLowerCase()}[data-text="${CSS.escape(textContent)}"]`;
            }
        }
        
        // 7. Final fallback with position
        if (element.parentNode && element.parentNode.children) {
            const siblings = Array.from(element.parentNode.children);
            const index = siblings.indexOf(element);
            const positionSelector = `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
            
            // Make it more specific by adding parent info
            let parent = element.parentNode;
            if (parent && parent.tagName) {
                let parentSelector = parent.tagName.toLowerCase();
                if (parent.id) {
                    parentSelector += `#${CSS.escape(parent.id)}`;
                } else if (parent.className && typeof parent.className === 'string') {
                    const parentClasses = parent.className.split(' ')
                        .filter(c => c.length > 0)
                        .slice(0, 1);
                    if (parentClasses.length > 0) {
                        parentSelector += `.${CSS.escape(parentClasses[0])}`;
                    }
                }
                return `${parentSelector} > ${positionSelector}`;
            }
            
            return positionSelector;
        }
        
        // Ultimate fallback
        return element.tagName.toLowerCase();
    }

    showRecordingIndicator() {
        // Check if recording indicator should be shown
        if (!this.settings.recording.showRecordingIndicator) {
            return;
        }
        
        // Remove any existing recording indicator first
        this.hideRecordingIndicator();
        
        logger.log('🎬 Showing recording indicator...');
        
        const indicator = document.createElement('div');
        indicator.id = 'session-recording-indicator';
        indicator.className = 'session-recording-indicator';
        indicator.innerHTML = '🔴 Recording';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #e74c3c;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
        `;
        
        // Add pulsing animation
        const style = document.createElement('style');
        style.id = 'recording-indicator-style';
        style.setAttribute('data-recording', 'true');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;
        
        // Only add style if it doesn't exist
        if (!document.getElementById('recording-indicator-style')) {
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
        logger.log('✅ Recording indicator displayed');
    }

    hideRecordingIndicator() {
        logger.log('🛑 Hiding recording indicator...');
        
        // Try to find by ID first
        const indicator = document.getElementById('session-recording-indicator');
        if (indicator) {
            logger.log('✅ Found recording indicator by ID, removing...');
            indicator.remove();
        } else {
            logger.log('⚠️ Recording indicator not found by ID, searching by class...');
            
            // Fallback: try to find any recording indicators
            const indicators = document.querySelectorAll('[id*="recording"], [class*="recording"], .session-recording-indicator');
            if (indicators.length > 0) {
                console.log(`Found ${indicators.length} potential recording indicators, removing all...`);
                indicators.forEach(ind => ind.remove());
            } else {
                logger.log('❌ No recording indicators found to remove');
            }
        }
        
        // Also remove any related styles
        const recordingStyles = document.querySelectorAll('style[data-recording="true"]');
        recordingStyles.forEach(style => style.remove());
        
        logger.log('✅ Recording indicator cleanup completed');
    }

    async checkRecordingStateOnLoad() {
        try {
            // Check with background script if recording is active
            const response = await chrome.runtime.sendMessage({ action: 'getGlobalRecordingState' });
            
            if (response && response.isRecording) {
                console.log('🎬 Recording is active, showing indicator on page load');
                this.isRecording = true;
                this.showRecordingIndicator();
                
                // If there's session data, restore it
                if (response.session) {
                    this.currentSession = response.session;
                }
            } else {
                console.log('⏹️ No active recording detected');
            }
        } catch (error) {
            console.log('Failed to check recording state on load:', error.message);
        }
    }

    // Playback functionality
    startPlayback() {
        if (!this.playbackSession) return;
        
        console.log('🎬 Starting playback - cleaning up any existing overlays first');
        
        // Clean up any existing playback overlays before starting
        const existingOverlays = document.querySelectorAll('#session-playback-overlay, [id*="playback"], [class*="playback-overlay"]');
        existingOverlays.forEach(overlay => {
            overlay.remove();
            console.log('🧹 Removed existing overlay:', overlay.id || overlay.className);
        });
        
        // Clean up existing indicators
        const existingIndicators = document.querySelectorAll('.playback-action-indicator, .playback-click-indicator, .target-element-highlight, .playback-click-label');
        existingIndicators.forEach(indicator => indicator.remove());
        
        // Reset playback state
        this.playbackOverlay = null;
        this.isPlaybackPaused = false;
        
        // Handle both new multi-page sessions and legacy single-page sessions
        if (this.playbackSession.pages && this.playbackSession.pages.length > 0) {
            this.playbackPageIndex = 0;
            this.playbackActionIndex = 0;
            this.currentPlaybackPage = this.playbackSession.pages[0];
            
            // Navigate to first page if needed
            if (window.location.href !== this.currentPlaybackPage.url) {
                this.navigateToPageForPlayback(this.currentPlaybackPage.url);
                return; // Playback will continue after navigation
            }
        } else if (this.playbackSession.actions) {
            // Legacy single-page session
            this.currentPlaybackPage = this.playbackSession;
            this.playbackActionIndex = 0;
        } else {
            console.error('Invalid session format for playback');
            return;
                }
        
        // Start performance monitoring
        this.performanceMonitor.startPlaybackMetrics();
        
        // Wait for page to be fully loaded before starting playback
        this.waitForPageReady().then(() => {
        this.createPlaybackOverlay();
        this.playNextAction();
        });
    }

    navigateToPageForPlayback(url) {
        // Store playback state before navigation
        chrome.runtime.sendMessage({
            action: 'storePlaybackState',
            session: this.playbackSession,
            pageIndex: this.playbackPageIndex,
            actionIndex: this.playbackActionIndex
        });
        
        // Navigate to the URL
        window.location.href = url;
    }

    continuePlaybackAfterNavigation() {
        // This will be called by the message listener when playback continues
        // Wait for page to be fully loaded before starting playback
        this.waitForPageReady().then(() => {
            this.createPlaybackOverlay();
            this.playNextAction();
        });
    }

    createPlaybackOverlay() {
        // Remove existing overlay
        if (this.playbackOverlay) {
            this.playbackOverlay.remove();
        }

        console.log('Creating playback overlay');

        this.playbackOverlay = document.createElement('div');
        this.playbackOverlay.id = 'session-playback-overlay';
        this.playbackOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.05);
            z-index: 9999;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Add playback controls with enhanced styling
        const controls = document.createElement('div');
        controls.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 30px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            pointer-events: auto;
            min-width: 300px;
            text-align: center;
        `;
        
        const totalPages = this.playbackSession.pages ? this.playbackSession.pages.length : 1;
        const currentPageNum = (this.playbackPageIndex || 0) + 1;
        const pageInfo = totalPages > 1 ? ` (Page ${currentPageNum}/${totalPages})` : '';
        
        controls.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center;">
                    <div style="width: 12px; height: 12px; background: #ff4757; border-radius: 50%; margin-right: 10px; animation: recordingPulse 2s infinite;"></div>
                    <span id="playback-status">🎬 Playing Session${pageInfo}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="pause-resume-playback" style="
                        padding: 8px 16px; 
                        border: none; 
                        border-radius: 20px; 
                        background: rgba(255,255,255,0.2); 
                        color: white; 
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                    ">
                        ⏸ Pause
                    </button>
                    <button id="stop-playback" style="
                        padding: 8px 16px; 
                        border: none; 
                        border-radius: 20px; 
                        background: rgba(255,255,255,0.2); 
                        color: white; 
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                    ">
                        ⏹ Stop
                    </button>
                </div>
            </div>
        `;

        // Add recording pulse animation
        const recordingStyle = document.createElement('style');
        recordingStyle.textContent = `
            @keyframes recordingPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.8); }
            }
        `;
        if (!document.querySelector('style[data-recording="true"]')) {
            recordingStyle.setAttribute('data-recording', 'true');
            document.head.appendChild(recordingStyle);
        }
        
        controls.querySelector('#pause-resume-playback').addEventListener('click', () => {
            this.togglePauseResume();
        });
        
        controls.querySelector('#stop-playback').addEventListener('click', () => {
            this.stopPlayback();
        });

        this.playbackOverlay.appendChild(controls);
        document.body.appendChild(this.playbackOverlay);
        
        console.log('Playback overlay created successfully');
    }

    playNextAction() {
        if (!this.currentPlaybackPage || !this.currentPlaybackPage.actions) {
            console.log('No current playback page or actions, moving to next page');
            this.moveToNextPage();
            return;
        }

        if (this.playbackActionIndex >= this.currentPlaybackPage.actions.length) {
            console.log('All actions on current page completed, moving to next page');
            this.moveToNextPage();
            return;
        }

        const action = this.currentPlaybackPage.actions[this.playbackActionIndex];
        const nextAction = this.currentPlaybackPage.actions[this.playbackActionIndex + 1];
        
        console.log(`Playing action ${this.playbackActionIndex + 1}:`, action);
        
        // Execute action and visualization together for better synchronization
        this.executeActionWithVisualization(action);
        
        // Update status with enhanced information
        const status = document.getElementById('playback-status');
        if (status) {
            const totalPages = this.playbackSession.pages ? this.playbackSession.pages.length : 1;
            const currentPageNum = (this.playbackPageIndex || 0) + 1;
            const pageInfo = totalPages > 1 ? ` (Page ${currentPageNum}/${totalPages})` : '';
            const actionNum = this.playbackActionIndex + 1;
            const totalActions = this.currentPlaybackPage.actions.length;
            
            status.innerHTML = `🎬 Action ${actionNum}/${totalActions}: <strong>${action.type.toUpperCase()}</strong>${pageInfo}`;
        }

        this.playbackActionIndex++;

        // Schedule next action with intelligent timing
        if (nextAction) {
            let delay = this.calculateOptimalDelay(action, nextAction);
            
            this.playbackTimeoutId = setTimeout(() => {
                if (!this.isPlaybackPaused) {
                    this.playNextAction();
                }
            }, delay);
        } else {
            // No more actions on this page, move to next page
            this.playbackTimeoutId = setTimeout(() => {
                if (!this.isPlaybackPaused) {
                    this.moveToNextPage();
                }
            }, 800); // Reduced for faster transitions
        }
    }

    calculateOptimalDelay(currentAction, nextAction) {
        const originalDelay = nextAction.timestamp - currentAction.timestamp;
        
        // Base delay rules
        let delay = Math.max(originalDelay, 50); // Minimum 50ms delay
        
        // Adjust based on action types
        switch (nextAction.type) {
            case 'keyup':
            case 'keydown':
                // Very fast for key events
                delay = Math.min(delay, 150);
                break;
                
            case 'input':
                // Fast for input to maintain typing flow
                if (currentAction.type === 'input' || currentAction.type === 'keydown') {
                    delay = Math.min(delay, 300);
                } else {
                    delay = Math.min(delay, 500);
                }
                break;
                
            case 'scroll':
                // Fast scroll - much quicker than other actions
                delay = Math.min(delay, 100);
                // Even faster if consecutive scrolls
                if (currentAction.type === 'scroll') {
                    delay = Math.min(delay, 50);
                }
                break;
                
            case 'click':
            case 'dblclick':
                // Reasonable delay for clicks to ensure they're visible
                delay = Math.min(delay, 1500);
                // Add extra delay after form submissions or navigation-like clicks
                if (currentAction.type === 'submit' || 
                    (currentAction.type === 'click' && currentAction.target?.includes('button'))) {
                    delay = Math.max(delay, 500);
                }
                break;
                
            case 'change':
                // Medium delay for change events
                delay = Math.min(delay, 800);
                break;
                
            default:
                // Default cap
                delay = Math.min(delay, 2000);
        }
        
        // Ensure minimum delay between different types of actions
        if (currentAction.type !== nextAction.type) {
            delay = Math.max(delay, 100);
        }
        
        // Extra delay after certain actions that might trigger page changes
        if (currentAction.type === 'submit' || 
            (currentAction.type === 'click' && currentAction.target?.includes('submit'))) {
            delay = Math.max(delay, 1000);
        }
        
        // Apply playback speed setting
        const speedMultiplier = 1 / (this.settings.playback.speed || 1);
        delay = Math.round(delay * speedMultiplier);
        
        // Ensure minimum delay even at high speeds
        delay = Math.max(delay, 25);
        
        if (this.settings.advanced.debugMode) {
            console.log(`Delay calculation: original=${originalDelay}ms, adjusted=${delay}ms, speed=${this.settings.playback.speed}x`);
        }
        
        return delay;
    }

    moveToNextPage() {
        if (!this.playbackSession.pages) {
            // Single-page session is complete
            this.stopPlayback();
            return;
        }

        this.playbackPageIndex = (this.playbackPageIndex || 0) + 1;
        
        if (this.playbackPageIndex >= this.playbackSession.pages.length) {
            // All pages complete
            this.stopPlayback();
            return;
        }

        this.currentPlaybackPage = this.playbackSession.pages[this.playbackPageIndex];
        this.playbackActionIndex = 0;

        // Navigate to next page if needed
        if (window.location.href !== this.currentPlaybackPage.url) {
            this.navigateToPageForPlayback(this.currentPlaybackPage.url);
        } else {
            // Same page, wait for page to be ready then continue playback
            this.waitForPageReady().then(() => {
                this.playNextAction();
            });
        }
    }

    waitForPageReady() {
        return new Promise((resolve) => {
            // If document is already loaded, resolve immediately
            if (document.readyState === 'complete') {
                console.log('Page already loaded, proceeding with playback');
                resolve();
                return;
            }

            console.log('Waiting for page to load completely...');
            
            // Wait for both DOM content and all resources to load
            const checkReady = () => {
                if (document.readyState === 'complete') {
                    console.log('Page fully loaded, starting playback');
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };

            // Also listen for the load event as a backup
            const loadHandler = () => {
                console.log('Load event fired, page ready');
                window.removeEventListener('load', loadHandler);
                resolve();
            };

            window.addEventListener('load', loadHandler);
            
            // Start checking readiness
            checkReady();
            
            // Fallback timeout to prevent infinite waiting
            setTimeout(() => {
                console.log('Page load timeout reached, proceeding anyway');
                window.removeEventListener('load', loadHandler);
                resolve();
            }, 10000); // 10 second timeout
        });
    }

    findElement(selector, action = null) {
        if (!selector) return null;
        
        // Handle special cases
        if (selector === 'document') return document;
        if (selector === 'window') return window;
        
        const detectionMode = this.settings.advanced.elementDetection;
        const maxRetries = this.settings.advanced.maxRetries;
        
        // Try direct selector first
        try {
            const element = document.querySelector(selector);
            if (element) {
                if (this.settings.advanced.debugMode) {
                    console.log('Found element with direct selector:', selector);
                }
                return element;
            }
        } catch (e) {
            this.errorHandler.logError(e, 'Direct Selector Query');
        }
        
        // Enhanced strategies based on detection mode
        const strategies = [];
        
        // Always include text-based selector handling
        strategies.push(() => {
            if (selector.includes('[data-text=')) {
                const textMatch = selector.match(/\[data-text="([^"]+)"\]/);
                if (textMatch) {
                    const text = textMatch[1];
                    const tagName = selector.split('[')[0];
                    const elements = document.querySelectorAll(tagName);
                    for (const el of elements) {
                        if (el.textContent?.trim().includes(text)) {
                            return el;
                        }
                    }
                }
            }
            return null;
        });
        
        if (detectionMode === 'flexible' || detectionMode === 'aggressive') {
            // Coordinate-based finding
            strategies.push(() => {
                if (action && action.coordinates) {
                    if (this.settings.advanced.debugMode) {
                        console.log('Trying coordinate-based element finding...');
                    }
                    
                    const x = action.coordinates.pageX || action.coordinates.x || 0;
                    const y = action.coordinates.pageY || action.coordinates.y || 0;
                    
                    // Adjust coordinates for current scroll position
                    const adjustedX = x - window.scrollX + (action.scrollPosition ? action.scrollPosition.x - window.scrollX : 0);
                    const adjustedY = y - window.scrollY + (action.scrollPosition ? action.scrollPosition.y - window.scrollY : 0);
                    
                    const elementAtPoint = document.elementFromPoint(adjustedX, adjustedY);
                    if (elementAtPoint) {
                        if (this.settings.advanced.debugMode) {
                            console.log('Found element at coordinates:', elementAtPoint);
                        }
                        return elementAtPoint;
                    }
                }
                return null;
            });
            
            // Partial selector matching
            strategies.push(() => {
                if (selector.includes('.')) {
                    const parts = selector.split('.');
                    const tagName = parts[0];
                    const classes = parts.slice(1);
                    
                    // Try with fewer classes
                    for (let i = classes.length - 1; i >= 1; i--) {
                        const partialSelector = `${tagName}.${classes.slice(0, i).join('.')}`;
                        try {
                            const elements = document.querySelectorAll(partialSelector);
                            if (elements.length === 1) {
                                if (this.settings.advanced.debugMode) {
                                    console.log('Found element with partial selector:', partialSelector);
                                }
                                return elements[0];
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    // Try just the tag name
                    try {
                        const elements = document.querySelectorAll(tagName);
                        if (elements.length === 1) {
                            if (this.settings.advanced.debugMode) {
                                console.log('Found single element with tag name:', tagName);
                            }
                            return elements[0];
                        }
                    } catch (e) {
                        // Continue to next strategy
                    }
                }
                return null;
            });
            
            // Attribute-based matching
            strategies.push(() => {
                if (action && action.value !== undefined && action.value !== null) {
                    const tagName = selector.split(/[#\.\[:]/)[0];
                    if (['input', 'textarea', 'select'].includes(tagName.toLowerCase())) {
                        const inputs = document.querySelectorAll(tagName);
                        for (const input of inputs) {
                            if (input.value === action.value || 
                                input.placeholder === action.value ||
                                input.name === action.value) {
                                if (this.settings.advanced.debugMode) {
                                    console.log('Found element by value/name/placeholder match');
                                }
                                return input;
                            }
                        }
                    }
                }
                return null;
            });
        }
        
        if (detectionMode === 'aggressive') {
            // Fuzzy text matching for buttons and links
            strategies.push(() => {
                const tagName = selector.split(/[#\.\[:]/)[0];
                if (['button', 'a'].includes(tagName.toLowerCase())) {
                    const elements = document.querySelectorAll(tagName);
                    const targetText = action?.value || selector.match(/data-text="([^"]+)"/)?.[1];
                    
                    if (targetText) {
                        for (const el of elements) {
                            const elementText = el.textContent?.trim().toLowerCase();
                            const searchText = targetText.toLowerCase();
                            
                            // Fuzzy matching - check if 70% of characters match
                            if (elementText && this.fuzzyMatch(elementText, searchText, 0.7)) {
                                if (this.settings.advanced.debugMode) {
                                    console.log('Found element by fuzzy text match:', el);
                                }
                                return el;
                            }
                        }
                    }
                }
                return null;
            });
            
            // Similar element structure matching
            strategies.push(() => {
                const selectorParts = selector.split(/[\s>]/);
                if (selectorParts.length > 1) {
                    // Try to find elements with similar structure
                    const lastPart = selectorParts[selectorParts.length - 1];
                    const elements = document.querySelectorAll(lastPart.split(/[#\.:\[]/)[0]);
                    
                    for (const el of elements) {
                        if (this.elementMatchesStructure(el, selectorParts)) {
                            if (this.settings.advanced.debugMode) {
                                console.log('Found element by structure match:', el);
                            }
                            return el;
                        }
                    }
                }
                return null;
            });
        }
        
        // Execute strategies with retry logic
        for (let retry = 0; retry < maxRetries; retry++) {
            for (const strategy of strategies) {
                try {
                    const element = strategy();
                    if (element) {
                        this.performanceMonitor.recordElementDetection(true);
                        return element;
                    }
                } catch (error) {
                    this.errorHandler.logError(error, `Element Detection Strategy (retry ${retry + 1})`);
                }
            }
            
            // Wait before retry (except on last attempt)
            if (retry < maxRetries - 1) {
                // Small delay for dynamic content - use synchronous approach
                const start = Date.now();
                while (Date.now() - start < 200) {
                    // Busy wait for 200ms
                }
            }
        }
        
        this.performanceMonitor.recordElementDetection(false);
        if (this.settings.advanced.debugMode) {
            console.warn('Could not find element with any strategy for selector:', selector);
        }
        return null;
    }
    
    // Helper method for fuzzy text matching
    fuzzyMatch(text1, text2, threshold = 0.7) {
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;
        
        if (longer.length === 0) return true;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length >= threshold;
    }
    
    // Helper method for calculating edit distance
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    // Helper method for structure matching
    elementMatchesStructure(element, selectorParts) {
        let current = element;
        
        for (let i = selectorParts.length - 1; i >= 0; i--) {
            if (!current) return false;
            
            const part = selectorParts[i].trim();
            if (!part) continue;
            
            const tagMatch = part.match(/^([a-zA-Z]+)/);
            const classMatch = part.match(/\.([^#\.\[:]+)/g);
            const idMatch = part.match(/#([^#\.\[:]+)/);
            
            // Check tag name
            if (tagMatch && current.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) {
                return false;
            }
            
            // Check classes (at least one should match)
            if (classMatch) {
                const hasMatchingClass = classMatch.some(cls => 
                    current.classList.contains(cls.substring(1))
                );
                if (!hasMatchingClass) {
                    return false;
                }
            }
            
            // Check ID
            if (idMatch && current.id !== idMatch[1]) {
                return false;
            }
            
            current = current.parentElement;
        }
        
        return true;
    }

    executeActionWithVisualization(action) {
        // For click actions, we want to synchronize the visual and actual click
        if (action.type === 'click' || action.type === 'dblclick') {
            // Start visualization and ensure it's rendered before execution
            this.visualizeClickAction(action);
            
            // Execute on next frame to ensure animation has started rendering
            requestAnimationFrame(() => {
                this.executeAction(action);
            });
        } else {
            // For other actions, show visual first then execute
            this.visualizeAction(action);
            this.executeAction(action);
        }
    }

    executeAction(action) {
        console.log('Executing action:', action);

        try {
            // Ensure DOM is ready before executing actions
            if (document.readyState === 'loading') {
                console.log('DOM still loading, waiting before executing action:', action.type);
                setTimeout(() => this.executeAction(action), 200);
                return;
            }

            // Find the target element if specified
            let targetElement = null;
            if (action.target) {
                targetElement = this.findElement(action.target, action);
                if (!targetElement) {
                    console.warn('Target element not found:', action.target);
                    // Try to wait a bit and retry for dynamic content
                    setTimeout(() => {
                        targetElement = this.findElement(action.target, action);
                        if (!targetElement) {
                            console.warn('Target element still not found after retry:', action.target);
                        }
                    }, 500);
                }
            }

            switch (action.type) {
                case 'click':
                    this.simulateClick(targetElement, action);
                    break;
                
                case 'dblclick':
                    this.simulateDoubleClick(targetElement, action);
                    break;
                
                case 'keydown':
                case 'keyup':
                case 'keypress':
                    this.simulateKeyEvent(action);
                    break;
                
                case 'input':
                case 'change':
                    this.simulateInputEvent(targetElement, action);
                    break;
                
                case 'scroll':
                    this.simulateScrollEvent(action);
                    break;
                
                case 'mousemove':
                    this.simulateMouseEvent(targetElement, action);
                    break;
                
                case 'submit':
                    this.simulateSubmitEvent(targetElement, action);
                    break;
                
                default:
                    console.log('Action type not implemented for execution:', action.type);
            }
        } catch (error) {
            console.error('Error executing action:', error, action);
        }
    }

    simulateClick(targetElement, action) {
        console.log('Starting click simulation:', { targetElement, action });
        
        // Try multiple strategies to find the target element
        let element = targetElement;
        
        if (!element) {
            console.log('No target element provided, trying coordinate-based search...');
            
            // Use viewport coordinates (clientX/Y) for elementFromPoint
            const clientX = action.coordinates.x || action.coordinates.clientX || 0;
            const clientY = action.coordinates.y || action.coordinates.clientY || 0;
            
            // Adjust coordinates if page has scrolled since recording
            let adjustedX = clientX;
            let adjustedY = clientY;
            
            // If we have scroll position data, adjust coordinates
            if (action.scrollPosition) {
                const currentScrollX = window.scrollX;
                const currentScrollY = window.scrollY;
                const recordedScrollX = action.scrollPosition.x;
                const recordedScrollY = action.scrollPosition.y;
                
                adjustedX = clientX + (currentScrollX - recordedScrollX);
                adjustedY = clientY + (currentScrollY - recordedScrollY);
            }
            
            // Ensure coordinates are within viewport
            adjustedX = Math.max(0, Math.min(adjustedX, window.innerWidth - 1));
            adjustedY = Math.max(0, Math.min(adjustedY, window.innerHeight - 1));
            
            element = document.elementFromPoint(adjustedX, adjustedY);
            console.log('Found element at adjusted coordinates:', { adjustedX, adjustedY, element });
        }
        
        if (!element) {
            console.warn('Could not find any element to click at coordinates:', action.coordinates);
            return;
        }
        
        // Ensure the element is visible and interactable
        if (!this.isElementInteractable(element)) {
            console.warn('Element is not interactable:', element);
            // Try to find a parent that is interactable
            let parent = element.parentElement;
            while (parent && !this.isElementInteractable(parent)) {
                parent = parent.parentElement;
            }
            if (parent) {
                element = parent;
                console.log('Using interactable parent:', element);
            }
        }
        
        console.log('Final target element for click:', element, element.tagName, element.className, element.id);
        
        // SIMPLIFIED APPROACH: Focus on making the click actually work
        try {
            // 1. Focus the element if it's focusable
            if (this.isFocusable(element)) {
                element.focus();
                console.log('Focused element');
            }
            
            // 2. Try native click first (most reliable)
            if (element.click && typeof element.click === 'function') {
                // Remove any event listeners that might prevent the click
                const originalPointerEvents = element.style.pointerEvents;
                element.style.pointerEvents = 'auto';
                
                // Ensure element is not disabled
                const wasDisabled = element.disabled;
                if (element.disabled) {
                    element.disabled = false;
                }
                
                // Execute the native click immediately (no delay)
                element.click();
                console.log('✅ Native click executed on:', element.tagName);
                
                // Restore original states
                element.style.pointerEvents = originalPointerEvents;
                if (wasDisabled) {
                    element.disabled = true;
                }
                
                // Verify the click worked (with minimal delay for DOM updates)
                setTimeout(() => {
                    this.verifyClickSuccess(element, action);
                }, 50);
                
                return; // Native click succeeded, we're done
            }
            
            // 3. If native click not available, use event simulation
            const rect = element.getBoundingClientRect();
            const clickX = rect.left + rect.width / 2;
            const clickY = rect.top + rect.height / 2;
            
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clickX,
                clientY: clickY,
                button: 0,
                buttons: 1,
                detail: 1
            });
            
            const result = element.dispatchEvent(clickEvent);
            console.log('Event click dispatched, result:', result);
            
            // 4. Additional attempts for specific element types (immediate execution)
            if (element.tagName === 'A' && element.href) {
                // For links, navigate directly if event didn't work (check immediately)
                setTimeout(() => {
                    if (window.location.href === action.url) { // Still on same page
                        console.log('Navigating to link directly:', element.href);
                        window.location.href = element.href;
                    }
                }, 50); // Reduced delay
            } else if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && ['button', 'submit'].includes(element.type))) {
                // For buttons, try form submission if it's a submit button (immediate)
                if (element.type === 'submit') {
                    const form = element.closest('form');
                    if (form) {
                        console.log('Submitting form directly');
                        form.submit();
                    }
                }
            }
            
            console.log('✅ Click simulation completed');
            this.performanceMonitor.recordPlaybackAction(true);
            
        } catch (error) {
            console.error('Error during click simulation:', error);
            this.performanceMonitor.recordPlaybackAction(false);
            
                         // Ultimate fallback: try multiple aggressive approaches
             console.log('Trying aggressive fallback methods...');
             this.aggressiveClickFallback(element, action);
        }
    }
    
    verifyClickSuccess(element, action) {
        // Check if the click had the expected effect
        let success = false;
        
        if (element.tagName === 'A' && element.href) {
            // For links, check if navigation occurred
            success = window.location.href !== action.currentUrl;
            console.log('Link click verification:', success ? 'Success - navigated' : 'Failed - still on same page');
        } else if (element.type === 'checkbox' || element.type === 'radio') {
            // For checkboxes/radio, we can't easily verify without knowing the original state
            success = true; // Assume success
            console.log('Checkbox/radio click assumed successful');
        } else if (element.tagName === 'BUTTON' || element.type === 'submit') {
            // For buttons, check if form was submitted or page changed
            success = true; // Hard to verify generically
            console.log('Button click assumed successful');
        } else {
            // For other elements, assume success if no errors
            success = true;
            console.log('Generic click assumed successful');
        }
        
                 if (!success) {
             console.warn('Click may not have worked as expected, trying alternative methods');
             // Could add additional retry logic here
         }
    }
    
    aggressiveClickFallback(element, action) {
        const methods = [
            // Method 1: Direct onclick handler
            () => {
                if (element.onclick && typeof element.onclick === 'function') {
                    console.log('Trying onclick handler directly');
                    element.onclick.call(element);
                    return true;
                }
                return false;
            },
            
            // Method 2: onclick attribute evaluation
            () => {
                const onclickAttr = element.getAttribute('onclick');
                if (onclickAttr) {
                    console.log('Trying onclick attribute');
                    try {
                        // Create a safer evaluation context
                        const func = new Function(onclickAttr);
                        func.call(element);
                        return true;
                    } catch (e) {
                        console.warn('onclick attribute execution failed:', e);
                    }
                }
                return false;
            },
            
            // Method 3: Simulate mouse down/up sequence
            () => {
                try {
                    console.log('Trying mouse down/up sequence');
                    const rect = element.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    
                    const mouseDown = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y });
                    const mouseUp = new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y });
                    const click = new MouseEvent('click', { bubbles: true, clientX: x, clientY: y });
                    
                    element.dispatchEvent(mouseDown);
                    element.dispatchEvent(mouseUp);
                    element.dispatchEvent(click);
                    return true;
                } catch (e) {
                    console.warn('Mouse sequence failed:', e);
                }
                return false;
            },
            
            // Method 4: Force trigger for specific element types
            () => {
                console.log('Trying element-specific triggers');
                
                if (element.tagName === 'A' && element.href) {
                    console.log('Forcing link navigation');
                    window.location.href = element.href;
                    return true;
                } else if (element.tagName === 'BUTTON' || element.type === 'submit') {
                    const form = element.closest('form');
                    if (form) {
                        console.log('Forcing form submission');
                        form.submit();
                        return true;
                    }
                } else if (element.type === 'checkbox' || element.type === 'radio') {
                    console.log('Toggling checkbox/radio');
                    element.checked = !element.checked;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                } else if (element.tagName === 'SELECT') {
                    console.log('Triggering select change');
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            },
            
            // Method 5: Try to find and trigger event listeners
            () => {
                try {
                    console.log('Trying to trigger event listeners');
                    // This is a bit hacky, but try to trigger any click listeners
                    const clickEvent = new Event('click', { bubbles: true, cancelable: true });
                    Object.defineProperty(clickEvent, 'target', { value: element });
                    Object.defineProperty(clickEvent, 'currentTarget', { value: element });
                    
                    // Dispatch to document to ensure it bubbles through all listeners
                    document.dispatchEvent(clickEvent);
                    return true;
                } catch (e) {
                    console.warn('Event listener trigger failed:', e);
                }
                return false;
            }
        ];
        
        // Try each method until one succeeds
        for (let i = 0; i < methods.length; i++) {
            try {
                if (methods[i]()) {
                    console.log(`✅ Aggressive fallback method ${i + 1} succeeded`);
                    return;
                }
            } catch (error) {
                console.warn(`Aggressive fallback method ${i + 1} failed:`, error);
            }
        }
        
        console.error('❌ All aggressive fallback methods failed');
    }
    
    isElementInteractable(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            !element.disabled
        );
    }
    
    isFocusable(element) {
        const focusableTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
        return (
            focusableTags.includes(element.tagName) ||
            element.tabIndex >= 0 ||
            element.contentEditable === 'true'
        );
    }
    
    shouldTriggerNativeClick(element) {
        // Simplified: always try native click first for better reliability
        return element && typeof element.click === 'function';
    }
    
    handleSpecialClickCases(element, action) {
        // Handle form submissions
        if (element.type === 'submit' || (element.tagName === 'BUTTON' && element.type !== 'button')) {
            const form = element.closest('form');
            if (form) {
                console.log('Handling form submission click');
                // Form will be submitted by the click event
            }
        }
        
        // Handle links
        if (element.tagName === 'A' && element.href) {
            console.log('Handling link click:', element.href);
            // Link navigation will be handled by the click event
        }
        
        // Handle checkboxes and radio buttons
        if (element.type === 'checkbox' || element.type === 'radio') {
            console.log('Handling checkbox/radio click');
            // State change will be handled by the click event
        }
        
        // Handle select dropdowns
        if (element.tagName === 'SELECT') {
            console.log('Handling select dropdown click');
            // Dropdown will open from the click event
        }
    }

    simulateDoubleClick(targetElement, action) {
        console.log('Starting double-click simulation:', { targetElement, action });
        
        let element = targetElement;
        
        if (!element) {
            // Use the same element finding logic as single click
            const clientX = action.coordinates.x || action.coordinates.clientX || 0;
            const clientY = action.coordinates.y || action.coordinates.clientY || 0;
            element = document.elementFromPoint(clientX, clientY);
        }
        
        if (!element) {
            console.warn('Could not find element for double-click');
            return;
        }
        
        console.log('Double-clicking element:', element.tagName, element.className, element.id);
        
        try {
            // Focus the element if focusable
            if (this.isFocusable(element)) {
                element.focus();
            }
            
            // Simulate double-click event
            const rect = element.getBoundingClientRect();
            const clickX = rect.left + rect.width / 2;
            const clickY = rect.top + rect.height / 2;
            
            const dblClickEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clickX,
                clientY: clickY,
                button: 0,
                buttons: 1,
                detail: 2
            });
            
            element.dispatchEvent(dblClickEvent);
            console.log('✅ Double-click event dispatched');
            
        } catch (error) {
            console.error('Error during double-click simulation:', error);
        }
    }

    simulateKeyEvent(action) {
        const focusedElement = document.activeElement || document.body;
        
        const keyEvent = new KeyboardEvent(action.type, {
            bubbles: true,
            cancelable: true,
            key: action.key,
            code: action.code,
            keyCode: action.keyCode,
            which: action.keyCode,
            shiftKey: action.shiftKey,
            ctrlKey: action.ctrlKey,
            altKey: action.altKey,
            metaKey: action.metaKey
        });
        
        focusedElement.dispatchEvent(keyEvent);
        console.log('Simulated key event:', action.type, action.key);
    }

    simulateInputEvent(targetElement, action) {
        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
            // Focus the element first
            targetElement.focus();
            
            // Set the value
            if (action.value !== undefined) {
                targetElement.value = action.value;
                
                // Trigger input and change events
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                
                targetElement.dispatchEvent(inputEvent);
                targetElement.dispatchEvent(changeEvent);
                
                console.log('Simulated input on element:', targetElement, 'value:', action.value);
            }
        } else {
            console.warn('Could not simulate input - target element not found or not an input:', targetElement);
        }
    }

    simulateScrollEvent(action) {
        if (action.scrollPosition) {
            // Use smooth animated scrolling for better visual feedback
            const startX = window.scrollX;
            const startY = window.scrollY;
            const targetX = action.scrollPosition.x;
            const targetY = action.scrollPosition.y;
            
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            
            // Skip animation if the distance is very small
            if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
                window.scrollTo(targetX, targetY);
                console.log('Simulated instant scroll to:', action.scrollPosition);
                return;
            }
            
            // Animate the scroll
            const duration = Math.min(300, Math.max(100, Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 3));
            const startTime = performance.now();
            
            const animateScroll = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function for smooth animation
                const easeOutCubic = 1 - Math.pow(1 - progress, 3);
                
                const currentX = startX + deltaX * easeOutCubic;
                const currentY = startY + deltaY * easeOutCubic;
                
                window.scrollTo(currentX, currentY);
                
                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    // Ensure we end up exactly at the target position
                    window.scrollTo(targetX, targetY);
                    console.log('Simulated animated scroll to:', action.scrollPosition);
                }
            };
            
            requestAnimationFrame(animateScroll);
        }
    }

    simulateMouseEvent(targetElement, action) {
        const element = targetElement || document.elementFromPoint(
            action.coordinates.x || action.coordinates.clientX || 0,
            action.coordinates.y || action.coordinates.clientY || 0
        );
        
        if (element) {
            const mouseEvent = new MouseEvent(action.type, {
                bubbles: true,
                cancelable: true,
                clientX: action.coordinates.x || action.coordinates.clientX,
                clientY: action.coordinates.y || action.coordinates.clientY
            });
            
            element.dispatchEvent(mouseEvent);
            console.log('Simulated mouse event:', action.type, 'on element:', element);
        }
    }

    simulateSubmitEvent(targetElement, action) {
        if (targetElement && targetElement.tagName === 'FORM') {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            targetElement.dispatchEvent(submitEvent);
            console.log('Simulated form submission on:', targetElement);
        } else if (targetElement) {
            // If it's a submit button, find the parent form
            const form = targetElement.closest('form');
            if (form) {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
                console.log('Simulated form submission on parent form:', form);
            }
        }
    }

    visualizeClickAction(action) {
        // Skip visualization if disabled in settings
        if (!this.settings.playback.visualIndicators) {
            return;
        }
        
        // Specialized visualization for click actions that's perfectly synchronized
        if (!this.playbackOverlay) {
            this.errorHandler.logError(new Error('No playback overlay available'), 'Visualize Click Action');
            return;
        }

        if (this.settings.advanced.debugMode) {
            console.log('Visualizing synchronized click action:', action);
        }

        // Create visual indicator immediately when click happens
        const indicator = document.createElement('div');
        indicator.className = 'playback-click-indicator';
        
        // Use pageX/pageY if available, otherwise use clientX/clientY
        const x = action.coordinates.pageX || action.coordinates.x || 0;
        const y = action.coordinates.pageY || action.coordinates.y || 0;
        
        // Apply different styles based on animation setting
        const animationStyle = this.settings.playback.animationStyle;
        let indicatorSize = 24;
        let animationDuration = 0.8;
        
        switch (animationStyle) {
            case 'minimal':
                indicatorSize = 16;
                animationDuration = 0.6;
                break;
            case 'enhanced':
                indicatorSize = 32;
                animationDuration = 1.0;
                break;
            default:
                indicatorSize = 24;
                animationDuration = 0.8;
                break;
        }
        
        // Immediate visual feedback with synchronized timing
        indicator.style.cssText = `
            position: absolute;
            left: ${x - indicatorSize/2}px;
            top: ${y - indicatorSize/2}px;
            width: ${indicatorSize}px;
            height: ${indicatorSize}px;
            border-radius: 50%;
            background: rgba(255, 107, 107, 0.8);
            border: 2px solid #ff4757;
            z-index: 10001;
            pointer-events: none;
            transform: scale(1);
            opacity: 1;
            animation: synchronizedClickPulse ${animationDuration}s ease-out;
            box-shadow: 0 0 ${indicatorSize * 0.6}px rgba(255, 107, 107, 0.5);
        `;

        // Add click label (skip for minimal style)
        if (animationStyle !== 'minimal') {
            const label = document.createElement('div');
            label.textContent = action.type.toUpperCase();
            label.className = 'playback-click-label';
            label.style.cssText = `
                position: absolute;
                left: ${indicatorSize + 6}px;
                top: ${-indicatorSize/3}px;
                background: rgba(255, 71, 87, 0.9);
                color: white;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: ${animationStyle === 'enhanced' ? '12px' : '11px'};
                font-family: Arial, sans-serif;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            indicator.appendChild(label);
        }

        // Add immediate ripple effect (enhanced style only)
        if (animationStyle === 'enhanced') {
            const ripple = document.createElement('div');
            const rippleSize = indicatorSize * 2.5;
            ripple.style.cssText = `
                position: absolute;
                left: ${-rippleSize/2 + indicatorSize/2}px;
                top: ${-rippleSize/2 + indicatorSize/2}px;
                width: ${rippleSize}px;
                height: ${rippleSize}px;
                border: 3px solid rgba(255, 107, 107, 0.6);
                border-radius: 50%;
                transform: scale(0.5);
                opacity: 0.8;
                animation: synchronizedRipple ${animationDuration}s ease-out;
                pointer-events: none;
            `;
            indicator.appendChild(ripple);
        }

        // Add synchronized animation styles
        if (!document.getElementById('synchronized-click-animations')) {
            const style = document.createElement('style');
            style.id = 'synchronized-click-animations';
            style.textContent = `
                @keyframes synchronizedClickPulse {
                    0% { 
                        transform: scale(1); 
                        opacity: 1; 
                    }
                    20% { 
                        transform: scale(1.3); 
                        opacity: 0.9; 
                    }
                    100% { 
                        transform: scale(1.1); 
                        opacity: 0; 
                    }
                }
                @keyframes synchronizedRipple {
                    0% { 
                        transform: scale(0.5); 
                        opacity: 0.8; 
                    }
                    100% { 
                        transform: scale(1.2); 
                        opacity: 0; 
                    }
                }
            `;
            document.head.appendChild(style);
        }

        this.playbackOverlay.appendChild(indicator);

        // Force immediate rendering by triggering a layout
        indicator.offsetHeight; // This forces a layout calculation
        
        // Remove indicator after animation completes
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, animationDuration * 1000);

        // Highlight the target element immediately (synchronized)
        this.highlightTargetElement(action.target, true);

        // Ensure the click area is visible (immediate scroll if needed and auto-scroll enabled)
        if (this.settings.playback.autoScroll && y > 0 && (y > window.scrollY + window.innerHeight || y < window.scrollY)) {
            window.scrollTo({
                left: 0,
                top: y - window.innerHeight / 2,
                behavior: 'instant' // Immediate scroll for synchronization
            });
        }
    }

    visualizeAction(action) {
        // Skip visualization if disabled in settings
        if (!this.settings.playback.visualIndicators) {
            return;
        }
        
        // Skip visualization for keyup, keydown, and scroll events to optimize performance
        if (action.type === 'keyup' || action.type === 'keydown' || action.type === 'scroll') {
            if (this.settings.advanced.debugMode) {
                console.log('Skipping visualization for event:', action.type);
            }
            return;
        }

        if (!this.playbackOverlay) {
            this.errorHandler.logError(new Error('No playback overlay available'), 'Visualize Action');
            return;
        }

        if (this.settings.advanced.debugMode) {
            console.log('Visualizing action:', action);
        }

        // Create visual indicator for the action with style based on settings
        const indicator = document.createElement('div');
        indicator.className = 'playback-action-indicator';
        
        // Use pageX/pageY if available, otherwise use clientX/clientY
        const x = action.coordinates.pageX || action.coordinates.x || 0;
        const y = action.coordinates.pageY || action.coordinates.y || 0;
        
        // Apply animation style based on settings
        const animationStyle = this.settings.playback.animationStyle;
        let indicatorStyle = '';
        let animationName = 'lightActionPulse';
        
        switch (animationStyle) {
            case 'minimal':
                indicatorStyle = `
                    position: absolute;
                    left: ${x - 8}px;
                    top: ${y - 8}px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: rgba(74, 144, 226, 0.4);
                    border: 1px solid rgba(74, 144, 226, 0.6);
                    z-index: 10001;
                    pointer-events: none;
                    animation: minimalPulse 0.8s ease-out;
                `;
                animationName = 'minimalPulse';
                break;
            case 'enhanced':
                indicatorStyle = `
                    position: absolute;
                    left: ${x - 15}px;
                    top: ${y - 15}px;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: rgba(74, 144, 226, 0.8);
                    border: 3px solid rgba(74, 144, 226, 1);
                    z-index: 10001;
                    pointer-events: none;
                    animation: enhancedPulse 1.2s ease-out;
                    box-shadow: 0 0 20px rgba(74, 144, 226, 0.5);
                `;
                animationName = 'enhancedPulse';
                break;
            default: // 'default'
                indicatorStyle = `
                    position: absolute;
                    left: ${x - 10}px;
                    top: ${y - 10}px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(74, 144, 226, 0.6);
                    border: 2px solid rgba(74, 144, 226, 0.8);
                    z-index: 10001;
                    pointer-events: none;
                    animation: lightActionPulse 1s ease-out;
                    box-shadow: 0 0 10px rgba(74, 144, 226, 0.3);
                `;
                break;
        }
        
        indicator.style.cssText = indicatorStyle;

        // Add action type label with lighter styling (only for default and enhanced)
        if (animationStyle !== 'minimal') {
            const label = document.createElement('div');
            label.textContent = action.type.toUpperCase();
            label.className = 'playback-action-label';
            label.style.cssText = `
                position: absolute;
                left: 25px;
                top: -6px;
                background: rgba(52, 73, 94, 0.8);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-family: Arial, sans-serif;
                font-weight: normal;
                white-space: nowrap;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            `;
            indicator.appendChild(label);
        }

        // Add lighter ripple effect for clicks (only for enhanced mode)
        if ((action.type === 'click' || action.type === 'dblclick') && animationStyle === 'enhanced') {
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                left: -20px;
                top: -20px;
                width: 70px;
                height: 70px;
                border: 2px solid rgba(74, 144, 226, 0.5);
                border-radius: 50%;
                animation: enhancedRipple 1.2s ease-out;
                pointer-events: none;
            `;
            indicator.appendChild(ripple);
        }

        // Enhanced animation styles with different modes
        if (!document.getElementById('playback-animations')) {
            const style = document.createElement('style');
            style.id = 'playback-animations';
            style.textContent = `
                @keyframes minimalPulse {
                    0% { transform: scale(0); opacity: 0.6; }
                    50% { transform: scale(1); opacity: 0.4; }
                    100% { transform: scale(0.8); opacity: 0; }
                }
                @keyframes lightActionPulse {
                    0% { transform: scale(0); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 0.6; }
                    100% { transform: scale(1); opacity: 0; }
                }
                @keyframes enhancedPulse {
                    0% { transform: scale(0); opacity: 1; }
                    25% { transform: scale(1.2); opacity: 0.9; }
                    75% { transform: scale(1); opacity: 0.7; }
                    100% { transform: scale(0.9); opacity: 0; }
                }
                @keyframes enhancedRipple {
                    0% { transform: scale(0); opacity: 0.8; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                @keyframes lightRippleEffect {
                    0% { transform: scale(0); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 0; }
                }
                @keyframes actionPulse {
                    0% { transform: scale(0); opacity: 1; }
                    25% { transform: scale(1.2); opacity: 0.9; }
                    75% { transform: scale(1); opacity: 0.7; }
                    100% { transform: scale(0.8); opacity: 0; }
                }
                @keyframes rippleEffect {
                    0% { transform: scale(0); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        this.playbackOverlay.appendChild(indicator);

        // Remove indicator after animation time based on style
        const animationDuration = animationStyle === 'enhanced' ? 1200 : (animationStyle === 'minimal' ? 800 : 1000);
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, animationDuration);

        // Only auto-scroll to keep actions visible if enabled and not for scroll actions themselves
        if (this.settings.playback.autoScroll && action.type !== 'scroll' && y > 0 && 
            (y > window.scrollY + window.innerHeight || y < window.scrollY)) {
            window.scrollTo({
                left: 0,
                top: y - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }

        // Highlight the target element if it exists (with lighter effect)
        this.highlightTargetElement(action.target, true);
    }

    highlightTargetElement(selector, isLight = false) {
        if (!selector) return;

        try {
            const element = document.querySelector(selector);
            if (element) {
                const highlight = document.createElement('div');
                highlight.className = 'target-element-highlight';
                
                // Use lighter styling if requested
                if (isLight) {
                    highlight.style.cssText = `
                        position: absolute;
                        border: 1px solid rgba(74, 144, 226, 0.5);
                        background: rgba(74, 144, 226, 0.1);
                        pointer-events: none;
                        z-index: 10000;
                        border-radius: 3px;
                        animation: lightHighlightPulse 1s ease-out;
                    `;
                } else {
                    highlight.style.cssText = `
                        position: absolute;
                        border: 3px solid #4CAF50;
                        background: rgba(76, 175, 80, 0.2);
                        pointer-events: none;
                        z-index: 10000;
                        border-radius: 4px;
                        animation: highlightPulse 1.5s ease-out;
                    `;
                }

                // Position the highlight over the target element
                const rect = element.getBoundingClientRect();
                highlight.style.left = (rect.left + window.scrollX - 2) + 'px';
                highlight.style.top = (rect.top + window.scrollY - 2) + 'px';
                highlight.style.width = (rect.width + 4) + 'px';
                highlight.style.height = (rect.height + 4) + 'px';

                // Add highlight animation
                const highlightStyle = document.createElement('style');
                highlightStyle.textContent = `
                    @keyframes lightHighlightPulse {
                        0% { opacity: 0; transform: scale(1.05); }
                        50% { opacity: 0.6; transform: scale(1); }
                        100% { opacity: 0; transform: scale(1); }
                    }
                    @keyframes highlightPulse {
                        0% { opacity: 0; transform: scale(1.1); }
                        50% { opacity: 1; transform: scale(1); }
                        100% { opacity: 0; transform: scale(1); }
                    }
                `;
                if (!document.querySelector('style[data-highlight="true"]')) {
                    highlightStyle.setAttribute('data-highlight', 'true');
                    document.head.appendChild(highlightStyle);
                }

                this.playbackOverlay.appendChild(highlight);

                // Remove highlight after animation (shorter for light version)
                const timeout = isLight ? 1000 : 1500;
                setTimeout(() => {
                    if (highlight.parentNode) {
                        highlight.remove();
                    }
                }, timeout);
            }
        } catch (error) {
            console.log('Could not highlight target element:', error);
        }
    }

    togglePauseResume() {
        const pauseResumeBtn = document.getElementById('pause-resume-playback');
        const status = document.getElementById('playback-status');
        
        if (this.isPlaybackPaused) {
            // Resume playback
            this.isPlaybackPaused = false;
            pauseResumeBtn.innerHTML = '⏸ Pause';
            if (status) {
                status.innerHTML = status.innerHTML.replace('⏸ Paused', '🎬 Playing');
            }
            console.log('Playback resumed');
            // Continue with next action
            this.playNextAction();
        } else {
            // Pause playback
            this.isPlaybackPaused = true;
            pauseResumeBtn.innerHTML = '▶ Resume';
            if (status) {
                status.innerHTML = status.innerHTML.replace('🎬 Playing', '⏸ Paused');
            }
            // Clear any pending timeouts
            if (this.playbackTimeoutId) {
                clearTimeout(this.playbackTimeoutId);
                this.playbackTimeoutId = null;
            }
            console.log('Playback paused');
        }
    }

    stopPlayback() {
        console.log('🛑 Stopping playback and cleaning up...');
        
        // Clear any pending timeouts
        if (this.playbackTimeoutId) {
            clearTimeout(this.playbackTimeoutId);
            this.playbackTimeoutId = null;
            console.log('✅ Cleared playback timeout');
        }
        
        // Remove playback overlay (try multiple methods)
        if (this.playbackOverlay) {
            this.playbackOverlay.remove();
            this.playbackOverlay = null;
            console.log('✅ Removed playback overlay instance');
        }
        
        // Force remove any playback overlays that might still exist
        const overlays = document.querySelectorAll('#session-playback-overlay, [id*="playback"], [class*="playback-overlay"]');
        overlays.forEach(overlay => {
            overlay.remove();
            console.log('✅ Force removed overlay:', overlay.id || overlay.className);
        });
        
        // Clean up all playback-related styles
        const styles = document.querySelectorAll('#playback-animations, #synchronized-click-animations, style[data-highlight="true"], style[data-recording="true"]');
        styles.forEach(style => {
            style.remove();
            console.log('✅ Removed style:', style.id);
        });
        
        // Clean up any remaining indicators and highlights
        const indicators = document.querySelectorAll('.playback-action-indicator, .playback-click-indicator, .target-element-highlight, .playback-click-label');
        indicators.forEach(indicator => {
            indicator.remove();
        });
        console.log('✅ Cleaned up', indicators.length, 'visual indicators');
        
        // End performance monitoring
        this.performanceMonitor.endPlaybackMetrics();
        
        // Reset playback state completely
        this.playbackActionIndex = 0;
        this.playbackPageIndex = 0;
        this.playbackSession = null;
        this.currentPlaybackPage = null;
        this.isPlaybackPaused = false;
        
        // Send message to background and popup to update UI state
        chrome.runtime.sendMessage({
            action: 'playbackCompleted'
        }).catch(error => {
            console.log('Could not notify background of playback completion:', error);
        });
        
        // Also try to notify popup directly if it's open
        chrome.runtime.sendMessage({
            action: 'playbackCompleted',
            source: 'content'
        }).catch(error => {
            console.log('Could not notify popup of playback completion:', error);
        });
        
        console.log('✅ Playback stopped and completely cleaned up');
    }

    // Test function to verify event listeners are working
    testEventListeners() {
        console.log('🧪 Testing event listeners...');
        console.log('Recording state:', this.isRecording);
        console.log('Current page data:', this.currentPageData);
        console.log('Current session:', this.currentSession);
        
        // Add a temporary click listener to test
        const testHandler = (e) => {
            console.log('🧪 TEST: Click listener is working!', e.target);
            document.removeEventListener('click', testHandler);
        };
        document.addEventListener('click', testHandler);
        
        console.log('🧪 Click anywhere to test if event listeners are working');
    }

    // Debug function to inspect current recording state
    debugRecordingState() {
        console.log('🔍 === RECORDING DEBUG INFO ===');
        console.log('Is Recording:', this.isRecording);
        console.log('Current Session:', this.currentSession);
        console.log('Current Page Data:', this.currentPageData);
        
        if (this.currentSession && this.currentSession.pages) {
            console.log('Total Pages:', this.currentSession.pages.length);
            this.currentSession.pages.forEach((page, index) => {
                console.log(`Page ${index + 1}:`, {
                    url: page.url,
                    title: page.title,
                    actionCount: page.actions ? page.actions.length : 0,
                    actions: page.actions
                });
            });
        }
        
        // Test if event listeners are attached
        console.log('🧪 Testing event listeners - click anywhere...');
        const testClick = (e) => {
            console.log('✅ Click detected during debug test!', e.target);
            document.removeEventListener('click', testClick);
        };
        document.addEventListener('click', testClick);
        
        return {
            isRecording: this.isRecording,
            session: this.currentSession,
            pageData: this.currentPageData
        };
    }
}

// Initialize the session recorder when the content script loads
if (!window.sessionRecorder) {
    console.log('🎬 Initializing Session Recorder...');
    
    // Add a small delay to ensure DOM is ready
    const initializeRecorder = () => {
        try {
            const sessionRecorder = new SessionRecorder();
            
            // Check if recording is active on page load (for navigation scenarios)
            sessionRecorder.checkRecordingStateOnLoad();
            
            // Expose for debugging
            window.sessionRecorder = sessionRecorder;
            window.testRecording = () => sessionRecorder.testEventListeners();
            window.debugRecording = () => sessionRecorder.debugRecordingState();
            
            logger.log('✅ Session Recorder content script loaded successfully');
            logger.log('💡 Debug commands available:');
            logger.log('  - window.sessionRecorder: Access the recorder instance');
            logger.log('  - testRecording(): Test if event listeners are working');
            logger.log('  - debugRecording(): Inspect current recording state');
            logger.log('  - sessionRecorder.testEventListeners(): Same as testRecording()');
            
            // Mark as loaded for extension detection
            window.sessionRecorderLoaded = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Session Recorder:', error);
            console.error('Error stack:', error.stack);
            console.error('Error occurred at line:', error.lineNumber || 'unknown');
            
            // Don't retry if it's a settings-related error to avoid infinite loops
            if (error.message.includes('advanced')) {
                console.error('❌ Settings initialization error - not retrying');
                return;
            }
            
            // Retry after a short delay for other errors
            setTimeout(initializeRecorder, 1000);
        }
    };
    
    // Initialize immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRecorder);
    } else {
        // DOM is already ready, initialize with small delay to ensure everything is settled
        setTimeout(initializeRecorder, 100);
    }
    
} else {
    console.log('🎬 Session Recorder already initialized, using existing instance');
    window.sessionRecorderLoaded = true;
}

} // Close the main else block from the beginning 
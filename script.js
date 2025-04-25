// Modular organization using IIFE pattern
document.addEventListener('DOMContentLoaded', async () => {
    // Config & Constants
    const CONFIG = {
        totalPairs: 10,
        aiImagesCount: 20,
        realImagesCount: 20,
        backgroundRotationInterval: 20000, // 20 seconds
        backgrounds: [
            'assets/backgrounds/1.png',
            'assets/backgrounds/2.png',
            'assets/backgrounds/3.png',
            'assets/backgrounds/4.png'
        ]
    };

    const URL_HANDLER = (() => {
        function getSharedPair() {
            // First check for query parameters (works in both local dev and production)
            const urlParams = new URLSearchParams(window.location.search);
            const aiParam = urlParams.get('ai');
            const realParam = urlParams.get('real');
            
            if (aiParam && realParam) {
                return {
                    aiIndex: parseInt(aiParam, 10),
                    realIndex: parseInt(realParam, 10)
                };
            }
            
            // Fallback to path-based format for production environment
            const path = window.location.pathname;
            const pairMatch = path.match(/\/image(\d+)_(\d+)/);
            
            if (pairMatch && pairMatch.length === 3) {
                return {
                    aiIndex: parseInt(pairMatch[1], 10),
                    realIndex: parseInt(pairMatch[2], 10)
                };
            }
            
            return null;
        }
        
        function generateShareUrl(aiIndex, realIndex) {
            // Create a URL using query parameters for maximum compatibility
            const baseUrl = window.location.origin;
            return `${baseUrl}/?ai=${aiIndex}&real=${realIndex}`;
        }
        
        return {
            getSharedPair,
            generateShareUrl
        };
    })();

    const DOM = {
        // Containers
        landingContainer: document.getElementById('landing-container'),
        introSection: document.getElementById('intro-section'),
        resultsSection: document.getElementById('results-section'),
        gameContainer: document.getElementById('game-container'),
        backgroundContainer: document.getElementById('background-container'),
        loadingIndicator: document.getElementById('loading-indicator'),
        leaderboardContainer: document.getElementById('leaderboard-container'),
        leaderboardContent: document.getElementById('leaderboard-content'),
        
        // Interactive elements
        startGameButton: document.getElementById('start-game'),
        image1Container: document.getElementById('image1-container'),
        image2Container: document.getElementById('image2-container'),
        image1: document.getElementById('image1'),
        image2: document.getElementById('image2'),
        correctCountElement: document.getElementById('correct-count'),
        successRateElement: document.getElementById('success-rate'),
        playAgainButton: document.getElementById('play-again'),
        reviewGameButton: document.getElementById('review-game'),
        showLeaderboardButton: document.getElementById('show-leaderboard'),
        leaderboardBackButton: document.getElementById('leaderboard-back'),
        
        // Loading elements
        loadingProgress: document.getElementById('loading-progress'),
        loadingMessage: document.getElementById('loading-message'),

        copyLinkButton: document.getElementById('copy-link-button'),
        copyLinkMessage: document.getElementById('copy-link-message'),

        twitterShareButton: document.getElementById('twitter-share-button'),
        
        // Result elements
        percentileContainer: document.getElementById('percentile-container'),
        percentileValue: document.getElementById('percentile-value'),
        
        // Progress elements
        progressBar: document.getElementById('progress-bar')
    };

    // Game state
    const GameState = {
        currentPair: 1,
        correctAnswers: 0,
        aiImagePosition: null,
        ai_indices: [],
        real_indices: [],
        realImageMetadata: {},
        aiImageMetadata: {},
        gameHistory: [],
        reviewMode: false,
        reviewIndex: 0,
        currentBgIndex: 0,
        bgRotationInterval: null,
        isBackgroundLoading: false,
        backgroundLoadPromise: null,
        isSinglePairMode: false,
        sharedPairAiIndex: null,
        sharedPairRealIndex: null
    };

    // Image cache
    const ImageCache = {
        backgrounds: [],
        aiImages: [],
        realImages: []
    };

    // ==================
    // FIREBASE MODULE
    // ==================
    const FirebaseManager = (() => {
        function checkFirebaseAvailability() {
            if (typeof firebase === 'undefined') {
                console.error("Firebase is not defined");
                return false;
            }
            return true;
        }

        function logEvent(eventName, params = {}) {
            if (!checkFirebaseAvailability()) return;
            
            try {
                firebase.analytics().logEvent(eventName, params);
            } catch (error) {
                console.error(`Analytics error logging ${eventName}:`, error);
            }
        }
        
        async function saveToFirestore(collection, data) {
            if (!checkFirebaseAvailability()) return null;
            
            try {
                const docRef = await firebase.firestore().collection(collection).add({
                    ...data,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                return docRef;
            } catch (error) {
                console.error(`Error saving to Firestore (${collection}):`, error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                return null;
            }
        }
        
        function initializeCollection(collection) {
            if (!checkFirebaseAvailability()) return;
            
            firebase.firestore().collection(collection).doc('init')
                .set({
                    initialized: true,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                })
                .catch(error => {
                    console.error(`Error initializing collection ${collection}:`, error);
                });
        }
        
        async function getDocumentById(collection, docId) {
            if (!checkFirebaseAvailability()) return null;
            
            try {
                const docRef = await firebase.firestore().collection(collection).doc(docId).get();
                return docRef.exists ? docRef.data() : null;
            } catch (error) {
                console.error(`Error fetching document ${docId}:`, error);
                return null;
            }
        }
        
        async function updateDocument(collection, docId, data) {
            if (!checkFirebaseAvailability()) return false;
            
            try {
                await firebase.firestore().collection(collection).doc(docId).update(data);
                return true;
            } catch (error) {
                console.error(`Error updating document ${docId}:`, error);
                return false;
            }
        }
        
        async function createDocument(collection, docId, data) {
            if (!checkFirebaseAvailability()) return false;
            
            try {
                await firebase.firestore().collection(collection).doc(docId).set(data);
                return true;
            } catch (error) {
                console.error(`Error creating document ${docId}:`, error);
                return false;
            }
        }
        
        async function queryCollection(collection, queryFn) {
            if (!checkFirebaseAvailability()) return [];
            
            try {
                const query = queryFn(firebase.firestore().collection(collection));
                const snapshot = await query.get();
                
                if (snapshot.empty) return [];
                
                const results = [];
                snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
                return results;
            } catch (error) {
                console.error(`Error querying collection ${collection}:`, error);
                return [];
            }
        }
        
        return {
            logEvent,
            saveToFirestore,
            initializeCollection,
            getDocumentById,
            updateDocument,
            createDocument,
            queryCollection
        };
    })();

    // ==================
    // GAME ANALYTICS
    // ==================
    const GameAnalytics = (() => {
        function logGameStart() {
            FirebaseManager.logEvent('game_start');
        }
        
        function logGameComplete(score, totalQuestions, successRate) {
            FirebaseManager.logEvent('game_complete', {
                score,
                total_questions: totalQuestions,
                success_rate: successRate
            });
            
            FirebaseManager.saveToFirestore('game_results', {
                score,
                total_questions: totalQuestions,
                success_rate: successRate
            });
        }
        
        function logImageStatistics(imageId, isAI, wasCorrectlyIdentified) {
            const docId = `${isAI ? 'ai' : 'real'}_${imageId}`;
            const collection = 'image_stats';
            
            FirebaseManager.getDocumentById(collection, docId)
                .then(doc => {
                    if (doc) {
                        return FirebaseManager.updateDocument(collection, docId, {
                            seen: firebase.firestore.FieldValue.increment(1),
                            correct: firebase.firestore.FieldValue.increment(wasCorrectlyIdentified ? 1 : 0)
                        });
                    } else {
                        return FirebaseManager.createDocument(collection, docId, {
                            image_id: imageId,
                            type: isAI ? 'ai' : 'real',
                            seen: 1,
                            correct: wasCorrectlyIdentified ? 1 : 0
                        });
                    }
                });
        }
        
        function initializeImageStats() {
            FirebaseManager.initializeCollection('image_stats');
        }
        
        async function getPlayerPercentile(currentScore) {
            const results = await FirebaseManager.queryCollection('game_results', 
                collection => collection);
            
            if (results.length === 0) return 0;
            
            let lowerScores = 0;
            results.forEach(data => {
                if (data.score < currentScore) {
                    lowerScores++;
                }
            });
            
            return Math.round((lowerScores / results.length) * 100);
        }
        
        async function fetchTopRealImages(limit = 3) {
            const realImages = await FirebaseManager.queryCollection('image_stats',
                collection => collection.where('type', '==', 'real'));
            
            if (realImages.length === 0) return [];
            
            // Calculate win rate for each real image
            const imagesWithWinRate = realImages.map(data => {
                const winRate = data.seen > 0 ? (data.correct / data.seen) * 100 : 0;
                return {
                    id: data.image_id,
                    seen: data.seen,
                    correct: data.correct,
                    winRate: winRate
                };
            });
            
            // Sort by win rate (lowest first, as this is the "most confused for AI" rate)
            imagesWithWinRate.sort((a, b) => a.winRate - b.winRate);
            
            // Return top N
            return imagesWithWinRate.slice(0, limit);
        }
        
        return {
            logGameStart,
            logGameComplete,
            logImageStatistics,
            initializeImageStats,
            getPlayerPercentile,
            fetchTopRealImages
        };
    })();

    // ==================
    // IMAGE MANAGER
    // ==================
    const ImageManager = (() => {
        // Helper function to preload a single image
        function preloadImage(src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.error(`Failed to load image: ${src}`);
                    resolve(null);
                };
                img.src = src;
            });
        }
        
        // Preload only essential images to start quickly
        async function preloadEssentialImages() {
            // Preload only first background image
            const firstBg = CONFIG.backgrounds[0];
            const bgImg = await preloadImage(firstBg);
            if (bgImg) ImageCache.backgrounds[0] = bgImg;
            
            // Preload first pair of images
            await preloadSpecificPair(1);
        }
        
        // Start background loading of remaining images
        function startBackgroundImageLoading() {
            if (GameState.isBackgroundLoading) return;
            
            GameState.isBackgroundLoading = true;
            
            GameState.backgroundLoadPromise = new Promise(async (resolve) => {
                // Background load remaining backgrounds (skip the first one)
                for (let i = 1; i < CONFIG.backgrounds.length; i++) {
                    if (!ImageCache.backgrounds[i]) {
                        preloadImage(CONFIG.backgrounds[i]).then(img => {
                            if (img) ImageCache.backgrounds[i] = img;
                        });
                    }
                }
                
                // Background load all game images
                for (let i = 2; i <= CONFIG.totalPairs; i++) {
                    if (!isPairPreloaded(i)) {
                        // We don't await this, it happens in the background
                        preloadSpecificPair(i, false);
                    }
                }
                
                resolve();
            });
        }
        
        // Check if a specific pair is already loaded
        function isPairPreloaded(pairNum) {
            if (pairNum < 1 || pairNum > CONFIG.totalPairs) return false;
            
            const ai_index = GameState.ai_indices[pairNum - 1];
            const real_index = GameState.real_indices[pairNum - 1];
            
            return !!(ImageCache.aiImages[ai_index] && ImageCache.realImages[real_index]);
        }
        
        // Preload a specific pair of images
        async function preloadSpecificPair(pairNum, waitForCompletion = true) {
            if (pairNum < 1 || pairNum > CONFIG.totalPairs) return;
            
            const ai_index = GameState.ai_indices[pairNum - 1];
            const real_index = GameState.real_indices[pairNum - 1];
            
            const aiSrc = `assets/ai_images/${ai_index}.png`;
            const realSrc = `assets/real_images/${real_index}.png`;
            
            const aiPromise = ImageCache.aiImages[ai_index] ? 
                Promise.resolve(ImageCache.aiImages[ai_index]) : 
                preloadImage(aiSrc).then(img => {
                    if (img) ImageCache.aiImages[ai_index] = img;
                    return img;
                });
                
            const realPromise = ImageCache.realImages[real_index] ? 
                Promise.resolve(ImageCache.realImages[real_index]) : 
                preloadImage(realSrc).then(img => {
                    if (img) ImageCache.realImages[real_index] = img;
                    return img;
                });
            
            if (waitForCompletion) {
                await Promise.all([aiPromise, realPromise]);
            }
        }
        
        // New function to load the artwork metadata
        async function loadArtworkMetadata() {
            try {
                // Load real images metadata
                const realResponse = await fetch('assets/real_images/mapper.json');
                if (!realResponse.ok) {
                    throw new Error('Failed to load real artwork metadata');
                }
                GameState.realImageMetadata = await realResponse.json();
                
                // Load AI images metadata
                const aiResponse = await fetch('assets/ai_images/mapper.json');
                if (!aiResponse.ok) {
                    throw new Error('Failed to load AI image metadata');
                }
                GameState.aiImageMetadata = await aiResponse.json();
            } catch (error) {
                console.error('Error loading artwork metadata:', error);
                // Initialize as empty objects if loading fails
                GameState.realImageMetadata = {};
                GameState.aiImageMetadata = {};
            }
        }
        
        return {
            preloadImage,
            preloadEssentialImages,
            startBackgroundImageLoading,
            isPairPreloaded,
            preloadSpecificPair,
            loadArtworkMetadata
        };
    })();

    // ==================
    // BACKGROUND MANAGER
    // ==================
    const BackgroundManager = (() => {
        // Initialize just the first background (for fast startup)
        function initFirstBackground() {
            addBackgroundLayer(CONFIG.backgrounds[GameState.currentBgIndex], true);
        }
        
        // Initialize background rotation system
        function initBackgroundRotation() {
            // Set up rotation interval if not already running
            if (!GameState.bgRotationInterval) {
                GameState.bgRotationInterval = setInterval(rotateBackground, CONFIG.backgroundRotationInterval);
            }
        }
        
        // Add a new background layer
        function addBackgroundLayer(imageUrl, isActive = false) {
            const backgroundLayer = document.createElement('div');
            backgroundLayer.className = 'background-layer';
            if (isActive) {
                backgroundLayer.classList.add('active-background');
            }
            backgroundLayer.style.backgroundImage = `url(${imageUrl})`;
            DOM.backgroundContainer.appendChild(backgroundLayer);
            
            // Force repaint to ensure the transition works
            if (!isActive) {
                setTimeout(() => {
                    backgroundLayer.classList.add('active-background');
                }, 50);
            }
            
            return backgroundLayer;
        }
        
        // Rotate to next background
        function rotateBackground() {
            // Get next background
            GameState.currentBgIndex = (GameState.currentBgIndex + 1) % CONFIG.backgrounds.length;
            const nextBgUrl = CONFIG.backgrounds[GameState.currentBgIndex];
            
            // Check if image is already preloaded, if not preload it
            if (!ImageCache.backgrounds[GameState.currentBgIndex]) {
                ImageManager.preloadImage(nextBgUrl).then(img => {
                    if (img) ImageCache.backgrounds[GameState.currentBgIndex] = img;
                    performBackgroundTransition(nextBgUrl);
                });
            } else {
                performBackgroundTransition(nextBgUrl);
            }
        }
        
        // Perform the actual background transition
        function performBackgroundTransition(nextBgUrl) {
            // Get all current background layers
            const currentLayers = DOM.backgroundContainer.querySelectorAll('.background-layer');
            
            // First fade out existing active layers
            currentLayers.forEach(layer => {
                if (layer.classList.contains('active-background')) {
                    layer.classList.remove('active-background');
                    layer.classList.add('fade-out-background');
                }
            });
            
            // Add new background layer after a small delay to ensure smooth transition
            setTimeout(() => {
                const newLayer = addBackgroundLayer(nextBgUrl);
                
                // Clean up old layers after transition completes
                setTimeout(() => {
                    const oldLayers = DOM.backgroundContainer.querySelectorAll('.fade-out-background');
                    oldLayers.forEach(layer => {
                        DOM.backgroundContainer.removeChild(layer);
                    });
                }, 2100); // Slightly longer than the CSS transition
            }, 50);
        }
        
        return {
            initFirstBackground,
            initBackgroundRotation,
            rotateBackground
        };
    })();

    // ==================
    // UTILS
    // ==================
    const Utils = (() => {
        function getUniqueRandomIndices(count, min, max) {
            const indices = [];
            while (indices.length < count) {
                const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
                if (!indices.includes(randomNum)) {
                    indices.push(randomNum);
                }
            }
            return indices;
        }
        
        function showElement(element) {
            if (element) element.classList.remove('hidden');
        }
        
        function hideElement(element) {
            if (element) element.classList.add('hidden');
        }
        
        return {
            getUniqueRandomIndices,
            showElement,
            hideElement
        };
    })();

    // ==================
    // UI MANAGER
    // ==================
    const UIManager = (() => {
        function showLoading(message = "Loading...") {
            DOM.loadingMessage.textContent = message;
            Utils.showElement(DOM.loadingIndicator);
        }
        
        function hideLoading() {
            Utils.hideElement(DOM.loadingIndicator);
        }
        
        function updateLoadingProgress(percent) {
            DOM.loadingProgress.style.width = `${percent}%`;
            DOM.loadingProgress.textContent = `${percent}%`;
        }
        
        function showGameScreen() {
            Utils.hideElement(DOM.landingContainer);
            Utils.showElement(DOM.gameContainer);
        }
        
        function showResultsScreen() {
            Utils.hideElement(DOM.gameContainer);
            Utils.showElement(DOM.landingContainer);
            Utils.hideElement(DOM.introSection);
            Utils.showElement(DOM.resultsSection);
        }
        
        function updateResults(correctCount, totalPairs) {
            const successRate = (correctCount / totalPairs) * 100;
            
            // Check if we're in single pair mode
            if (GameState.isSinglePairMode) {
                // Get the results message container
                const messageContainer = DOM.correctCountElement.parentElement;
                
                // Update message based on correctness
                if (correctCount === 1) {
                    messageContainer.textContent = "You correctly identified the AI image!";
                } else {
                    messageContainer.textContent = "Opss, It looks like you were wrong.";
                }
                
                // Hide the success rate and percentile paragraphs
                const rateContainer = DOM.successRateElement.parentElement;
                rateContainer.classList.add('hidden');
                if (DOM.percentileContainer) {
                    DOM.percentileContainer.classList.add('hidden');
                }
            } else {
                // Regular game mode - update the standard results
                DOM.correctCountElement.textContent = correctCount;
                DOM.successRateElement.textContent = successRate.toFixed(0);
                
                // Make sure success rate and percentile are visible
                DOM.successRateElement.parentElement.classList.remove('hidden');
                if (DOM.percentileContainer) {
                    DOM.percentileContainer.classList.remove('hidden');
                }
            }
        }
        
        function updatePercentile(percentile) {
            if (percentile !== null) {
                DOM.percentileValue.textContent = percentile;
                Utils.showElement(DOM.percentileContainer);
            } else {
                Utils.hideElement(DOM.percentileContainer);
            }
        }
        
        function resetImageContainers() {
            DOM.image1Container.style.border = '';
            DOM.image2Container.style.border = '';
            DOM.image1Container.classList.remove('review-hover-enabled');
            DOM.image2Container.classList.remove('review-hover-enabled');
            DOM.image1Container.removeAttribute('data-image-type');
            DOM.image2Container.removeAttribute('data-image-type');
        }
        
        function showLeaderboard() {
            Utils.hideElement(DOM.landingContainer);
            Utils.hideElement(DOM.gameContainer);
            Utils.showElement(DOM.leaderboardContainer);
        }
        
        function hideLeaderboard() {
            Utils.hideElement(DOM.leaderboardContainer);
            Utils.showElement(DOM.landingContainer);
            Utils.showElement(DOM.resultsSection);
        }
        
        function updateLeaderboard(topImages) {
            DOM.leaderboardContent.innerHTML = '';
            
            if (topImages.length === 0) {
                DOM.leaderboardContent.innerHTML = '<p>No data available yet. Play more games!</p>';
                return;
            }
            
            topImages.forEach(image => {
                const metadata = GameState.realImageMetadata[image.id] || { Title: 'Untitled', Author: 'Unknown Artist' };
                
                const itemElement = document.createElement('div');
                itemElement.className = 'leaderboard-item';
                
                const winRateValue = Math.abs(image.winRate.toFixed(1) - 100);
                const winRateDisplay = Number(winRateValue.toFixed(2)).toString();
                
                itemElement.innerHTML = `
                    <img src="assets/real_images/${image.id}.png" alt="${metadata.Title}">
                    <div class="leaderboard-item-info">
                        <h3>${metadata.Title}</h3>
                        <p>Artist: ${metadata.Author}</p>
                        <p>Identified as real <span class="win-rate">${winRateDisplay}%</span> of the time</p>
                    </div>
                `;
                
                DOM.leaderboardContent.appendChild(itemElement);
            });
        }
        
        return {
            showLoading,
            hideLoading,
            updateLoadingProgress,
            showGameScreen,
            showResultsScreen,
            updateResults,
            updatePercentile,
            resetImageContainers,
            showLeaderboard,
            hideLeaderboard,
            updateLeaderboard
        };
    })();

    // ==================
    // GAME CORE
    // ==================
    const GameCore = (() => {
        async function initGame() {
            try {
                UIManager.showLoading("Loading game...");
                
                // Check if a shared pair is in the URL
                const sharedPair = URL_HANDLER.getSharedPair();
                
                if (sharedPair) {
                    // Set up a single pair game
                    GameState.isSinglePairMode = true;
                    GameState.sharedPairAiIndex = sharedPair.aiIndex;
                    GameState.sharedPairRealIndex = sharedPair.realIndex;
                    
                    // Only one pair for this mode
                    CONFIG.totalPairs = 1;
                    
                    // Set predefined indices for the single pair
                    GameState.ai_indices = [sharedPair.aiIndex];
                    GameState.real_indices = [sharedPair.realIndex];
                } else {
                    // Normal game mode
                    GameState.isSinglePairMode = false;
                    
                    // Sample indices based on the counted files
                    GameState.ai_indices = Utils.getUniqueRandomIndices(
                        CONFIG.totalPairs, 1, CONFIG.aiImagesCount);
                    GameState.real_indices = Utils.getUniqueRandomIndices(
                        CONFIG.totalPairs, 1, CONFIG.realImagesCount);
                }
                
                // Load the artwork metadata
                await ImageManager.loadArtworkMetadata();
                
                // Preload only the first background image and first pair of game images
                await ImageManager.preloadEssentialImages();
                
                // Initialize first background
                BackgroundManager.initFirstBackground();
                
                // Hide loading indicator when essentials are loaded
                UIManager.hideLoading();
                
                // Start loading the rest of the images in the background
                ImageManager.startBackgroundImageLoading();
                
            } catch (error) {
                console.error('Error initializing game:', error);
                UIManager.hideLoading();
            }
        }
        
        function startGame() {
            // Reset game history
            GameState.gameHistory = [];
            GameState.currentPair = 1;
            GameState.correctAnswers = 0;
            GameState.reviewMode = false;
            
            // Reset progress bar
            if (DOM.progressBar) {
                DOM.progressBar.style.width = '0%';
            }
            
            // Hide landing page
            Utils.hideElement(DOM.landingContainer);
            
            // Show game
            Utils.showElement(DOM.gameContainer);
            
            // Modify instructions for single pair mode
            if (GameState.isSinglePairMode) {
                // Hide progress bar in single pair mode
                if (DOM.progressBar) {
                    DOM.progressBar.parentElement.style.display = 'none';
                }
            }
            
            // Init background rotation if not already started
            if (!GameState.bgRotationInterval) {
                BackgroundManager.initBackgroundRotation();
            }
            
            // Start background loading the rest of the images if not already loading
            if (!GameState.isBackgroundLoading) {
                ImageManager.startBackgroundImageLoading();
            }
            
            // Log analytics
            GameAnalytics.logGameStart();
            GameAnalytics.initializeImageStats();
            
            loadImagePair();
        }
        
        async function loadImagePair() {
            // Check if the images for this pair are preloaded
            if (!ImageManager.isPairPreloaded(GameState.currentPair)) {
                // Show loading indicator if we need to load this pair
                UIManager.showLoading(`Loading images...`);
                
                // Wait for this specific pair to load
                await ImageManager.preloadSpecificPair(GameState.currentPair);
                
                // Hide loading indicator
                UIManager.hideLoading();
            }
            
            // Also preload the next pair in the background (if it exists)
            if (GameState.currentPair < CONFIG.totalPairs && 
                !ImageManager.isPairPreloaded(GameState.currentPair + 1)) {
                ImageManager.preloadSpecificPair(GameState.currentPair + 1, false);
            }
            
            // Update progress bar
            if (DOM.progressBar) {
                const progressPercent = ((GameState.currentPair - 1) / CONFIG.totalPairs) * 100;
                DOM.progressBar.style.width = `${progressPercent}%`;
            }
            
            // Randomly decide which image will be AI-generated
            GameState.aiImagePosition = Math.random() < 0.5 ? 'left' : 'right';
            
            // Get the indices for the current pair
            const ai_index = GameState.ai_indices[GameState.currentPair - 1];
            const real_index = GameState.real_indices[GameState.currentPair - 1];
            
            // Set image sources
            if (GameState.aiImagePosition === 'left') {
                DOM.image1.src = `assets/ai_images/${ai_index}.png`;
                DOM.image2.src = `assets/real_images/${real_index}.png`;
            } else {
                DOM.image1.src = `assets/real_images/${real_index}.png`;
                DOM.image2.src = `assets/ai_images/${ai_index}.png`;
            }
            
            // Reset any highlighting
            UIManager.resetImageContainers();
        }
        
        function checkAnswer(selectedPosition) {
            const isCorrect = selectedPosition === GameState.aiImagePosition;
            
            if (isCorrect) {
                GameState.correctAnswers++;
            }
            
            // Get the current indices for this pair
            const real_index = GameState.real_indices[GameState.currentPair - 1];
            const ai_index = GameState.ai_indices[GameState.currentPair - 1];
            
            // Log image statistics
            GameAnalytics.logImageStatistics(ai_index, true, selectedPosition === GameState.aiImagePosition);
            GameAnalytics.logImageStatistics(real_index, false, selectedPosition !== GameState.aiImagePosition);
            
            // Store this pair in game history
            GameState.gameHistory.push({
                pairNumber: GameState.currentPair,
                aiPosition: GameState.aiImagePosition,
                userSelected: selectedPosition,
                correct: isCorrect,
                leftImageSrc: DOM.image1.src,
                rightImageSrc: DOM.image2.src,
                realIndex: real_index,
                aiIndex: ai_index
            });
        
            // If single pair mode, immediately show results
            if (GameState.isSinglePairMode) {
                // Set progress bar to 100% when finished
                if (DOM.progressBar) {
                    DOM.progressBar.style.width = '100%';
                }
                
                showResults();
                return;
            }
            
            // For regular mode, move to next pair or show results
            if (GameState.currentPair < CONFIG.totalPairs) {
                GameState.currentPair++;
                
                // Update progress bar for next pair
                if (DOM.progressBar) {
                    const progressPercent = ((GameState.currentPair - 1) / CONFIG.totalPairs) * 100;
                    DOM.progressBar.style.width = `${progressPercent}%`;
                }
                
                loadImagePair();
            } else {
                // Set progress bar to 100% when finished
                if (DOM.progressBar) {
                    DOM.progressBar.style.width = '100%';
                }
                
                showResults();
            }
        }

        function shareOnTwitter() {
            if (GameState.currentPair <= 0 || GameState.currentPair > GameState.ai_indices.length) {
                console.error('Invalid pair index to share');
                return;
            }
            
            // Get the indices
            const ai_index = GameState.ai_indices[GameState.currentPair - 1];
            const real_index = GameState.real_indices[GameState.currentPair - 1];
            
            // Generate the share URL
            const shareUrl = URL_HANDLER.generateShareUrl(ai_index, real_index);
            
            // Create Twitter share text
            const shareText = "Can you tell which image is AI-generated? Take the AI or not AI challenge! #AIart #ArtChallenge";
            
            // Encode the URL and text
            const encodedText = encodeURIComponent(shareText);
            const encodedUrl = encodeURIComponent(shareUrl);
            
            // Create Twitter intent URL
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
            
            // Open Twitter sharing in a new window
            window.open(twitterUrl, '_blank', 'width=550,height=420');
        }
        
        async function showResults() {
            // Calculate success rate
            const successRate = (GameState.correctAnswers / CONFIG.totalPairs) * 100;
            
            // Update results elements
            UIManager.updateResults(GameState.correctAnswers, CONFIG.totalPairs);
            
            // Log to Firebase
            GameAnalytics.logGameComplete(
                GameState.correctAnswers, 
                CONFIG.totalPairs, 
                successRate.toFixed(0)
            );
            
            // Only calculate percentile for regular games, not single pair mode
            if (!GameState.isSinglePairMode) {
                try {
                    const percentile = await GameAnalytics.getPlayerPercentile(GameState.correctAnswers);
                    UIManager.updatePercentile(percentile);
                } catch (error) {
                    console.error("Error getting percentile:", error);
                    UIManager.updatePercentile(null);
                }
            } else {
                // For single pair mode, don't show percentile
                UIManager.updatePercentile(null);
            }
            
            // Show results screen
            UIManager.showResultsScreen();
        }
        
        function resetGame() {
            // Check if we were in single pair mode
            const wasSinglePairMode = GameState.isSinglePairMode;
            
            if (wasSinglePairMode) {
                // Redirect to the home page for a full game
                window.location.href = window.location.origin;
                return;
            }
            
            // Normal reset for regular mode
            // Reset game variables
            GameState.currentPair = 1;
            GameState.correctAnswers = 0;
            GameState.gameHistory = [];
            GameState.reviewMode = false;
            
            // Reset progress bar
            if (DOM.progressBar) {
                DOM.progressBar.style.width = '0%';
            }
            
            // Hide the results section
            Utils.hideElement(DOM.landingContainer);
            Utils.hideElement(DOM.resultsSection);
            
            // Show the game container directly
            Utils.showElement(DOM.gameContainer);
            
            // Re-initialize game to get fresh indices and load first pair
            GameState.ai_indices = Utils.getUniqueRandomIndices(
                CONFIG.totalPairs, 1, CONFIG.aiImagesCount);
            GameState.real_indices = Utils.getUniqueRandomIndices(
                CONFIG.totalPairs, 1, CONFIG.realImagesCount);
                
            loadImagePair();
        }

        // Add new method for copying current pair link
        function copyCurrentPairLink() {
            if (GameState.currentPair <= 0 || GameState.currentPair > GameState.ai_indices.length) {
                console.error('Invalid pair index to copy');
                return;
            }
            
            // Get the indices
            const ai_index = GameState.ai_indices[GameState.currentPair - 1];
            const real_index = GameState.real_indices[GameState.currentPair - 1];
            
            // Generate the share URL
            const shareUrl = URL_HANDLER.generateShareUrl(ai_index, real_index);
            
            // Copy to clipboard
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    // Show the copied message
                    if (DOM.copyLinkMessage) {
                        DOM.copyLinkMessage.classList.remove('hidden');
                        
                        // Hide the message after 2 seconds
                        setTimeout(() => {
                            DOM.copyLinkMessage.classList.add('hidden');
                        }, 2000);
                    }
                })
                .catch(err => {
                    console.error('Failed to copy URL: ', err);
                    
                    // Fallback method
                    const textarea = document.createElement('textarea');
                    textarea.value = shareUrl;
                    textarea.style.position = 'fixed';  // Avoid scrolling to bottom
                    document.body.appendChild(textarea);
                    textarea.select();
                    
                    try {
                        document.execCommand('copy');
                        
                        // Show the copied message
                        if (DOM.copyLinkMessage) {
                            DOM.copyLinkMessage.classList.remove('hidden');
                            
                            // Hide the message after 2 seconds
                            setTimeout(() => {
                                DOM.copyLinkMessage.classList.add('hidden');
                            }, 2000);
                        }
                    } catch (err) {
                        console.error('Fallback copy failed:', err);
                        alert('Failed to copy the link. Please copy it manually: ' + shareUrl);
                    }
                    
                    document.body.removeChild(textarea);
                });
        }
        
        async function handleShowLeaderboard() {
            try {
                UIManager.showLoading("Loading leaderboard...");
                
                // Fetch top real images
                const topRealImages = await GameAnalytics.fetchTopRealImages();
                
                // Update the leaderboard UI
                UIManager.updateLeaderboard(topRealImages);
                
                // Show leaderboard screen
                UIManager.showLeaderboard();
                
                // Hide loading indicator
                UIManager.hideLoading();
                
            } catch (error) {
                console.error('Error showing leaderboard:', error);
                UIManager.hideLoading();
            }
        }
        
        // Review mode functions
        function startReview() {
            // Switch to review mode
            GameState.reviewMode = true;
            GameState.reviewIndex = 0;
            
            // Hide results and show game container
            Utils.hideElement(DOM.landingContainer);
            Utils.showElement(DOM.gameContainer);
            
            // Load the first pair in review mode
            loadReviewPair();
        }
        
        function loadReviewPair() {
            if (GameState.reviewIndex >= GameState.gameHistory.length) {
                // End of review, go back to results
                endReview();
                return;
            }
            
            const pairData = GameState.gameHistory[GameState.reviewIndex];
            
            // Update progress bar for review mode
            if (DOM.progressBar) {
                const progressPercent = (GameState.reviewIndex / GameState.gameHistory.length) * 100;
                DOM.progressBar.style.width = `${progressPercent}%`;
            }
            
            // Set image sources
            DOM.image1.src = pairData.leftImageSrc;
            DOM.image2.src = pairData.rightImageSrc;
            
            // Reset any previous highlighting
            DOM.image1Container.style.border = '';
            DOM.image2Container.style.border = '';
            
            // Add review hover class to both containers
            DOM.image1Container.classList.add('review-hover-enabled');
            DOM.image2Container.classList.add('review-hover-enabled');
            
            // Get the real and AI image metadata
            const realIndex = pairData.realIndex;
            const aiIndex = pairData.aiIndex;
            const realMetadata = GameState.realImageMetadata[realIndex];
            const aiMetadata = GameState.aiImageMetadata[aiIndex];
            
            // Prepare AI metadata text
            let aiMetadataText = 'AI Generated';
            if (aiMetadata) {
                aiMetadataText = `Source: ${aiMetadata.Source}`;
                
                // Add prompt or URL based on what's available
                if (aiMetadata.Metadata && aiMetadata.Metadata.url) {
                    aiMetadataText += `\nURL: ${aiMetadata.Metadata.url}`;
                }
            }
            
            // Set hover text for AI and real images
            if (pairData.aiPosition === 'left') {
                // Left is AI, right is real
                DOM.image1Container.setAttribute('data-image-type', aiMetadataText);
                
                // Add metadata to real image if available
                if (realMetadata) {
                    DOM.image2Container.setAttribute('data-image-type', 
                        `"${realMetadata.Title}"\n${realMetadata.Author}`);
                } else {
                    DOM.image2Container.setAttribute('data-image-type', 'Real Image');
                }
            } else {
                // Left is real, right is AI
                DOM.image2Container.setAttribute('data-image-type', aiMetadataText);
                
                // Add metadata to real image if available
                if (realMetadata) {
                    DOM.image1Container.setAttribute('data-image-type', 
                        `"${realMetadata.Title}"\n${realMetadata.Author}`);
                } else {
                    DOM.image1Container.setAttribute('data-image-type', 'Real Image');
                }
            }
            
            // Highlight the user's selection as green (correct) or red (incorrect)
            if (pairData.userSelected === 'left') {
                DOM.image1Container.style.border = pairData.correct ? '4px solid green' : '4px solid red';
            } else {
                DOM.image2Container.style.border = pairData.correct ? '4px solid green' : '4px solid red';
            }
        }
        
        function endReview() {
            // Switch back to normal mode
            GameState.reviewMode = false;
            
            // Show results again
            Utils.hideElement(DOM.gameContainer);
            Utils.showElement(DOM.landingContainer);
            Utils.showElement(DOM.resultsSection);
            
            // Reset image containers
            UIManager.resetImageContainers();
        }
        
        function nextReviewPair() {
            GameState.reviewIndex++;
            loadReviewPair();
        }
        
        return {
            initGame,
            startGame,
            loadImagePair,
            checkAnswer,
            resetGame,
            startReview,
            handleShowLeaderboard,
            nextReviewPair,
            loadReviewPair,
            copyCurrentPairLink,
            shareOnTwitter  
        };
    })();

    // ==================
    // EVENT HANDLERS
    // ==================
    function setupEventListeners() {
        // Game navigation
        DOM.startGameButton.addEventListener('click', GameCore.startGame);
        DOM.playAgainButton.addEventListener('click', GameCore.resetGame);
        DOM.reviewGameButton.addEventListener('click', GameCore.startReview);
        
        // Image selection
        DOM.image1Container.addEventListener('click', () => {
            if (GameState.reviewMode) {
                GameCore.nextReviewPair();
            } else {
                GameCore.checkAnswer('left');
            }
        });
        
        DOM.image2Container.addEventListener('click', () => {
            if (GameState.reviewMode) {
                GameCore.nextReviewPair();
            } else {
                GameCore.checkAnswer('right');
            }
        });
        
        // Leaderboard
        if (DOM.showLeaderboardButton) {
            DOM.showLeaderboardButton.addEventListener('click', GameCore.handleShowLeaderboard);
        }
        
        if (DOM.leaderboardBackButton) {
            DOM.leaderboardBackButton.addEventListener('click', UIManager.hideLeaderboard);
        }

        if (DOM.copyLinkButton) {
            DOM.copyLinkButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the image click
                GameCore.copyCurrentPairLink();
            });
        }

        if (DOM.twitterShareButton) {
            DOM.twitterShareButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the image click
                GameCore.shareOnTwitter();
            });
        }
    }

    async function checkAutoStartGame() {
        if (GameState.isSinglePairMode) {
            // Start the game automatically for shared links
            GameCore.startGame();
        }
    }

    // Initialize the game
    await GameCore.initGame();
    setupEventListeners();
    await checkAutoStartGame()
});
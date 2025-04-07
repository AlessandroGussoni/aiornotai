document.addEventListener('DOMContentLoaded', async () => {
    // Game variables
    const totalPairs = 10;
    let currentPair = 1;
    let correctAnswers = 0;
    let aiImagePosition = null; // 'left' or 'right'
    let ai_indices = [];    // Indices for AI images
    let real_indices = [];  // Indices for Real images
    let realImageMetadata = {}; // Store the real artwork metadata
    let aiImageMetadata = {}; // Store the AI image metadata
    
    // New variables for review functionality
    let gameHistory = []; // To store played pairs
    let reviewMode = false;
    let reviewIndex = 0;

    // Background rotation variables
    const backgrounds = [
        'assets/backgrounds/1.png',
        'assets/backgrounds/2.png',
        'assets/backgrounds/3.png',
        'assets/backgrounds/4.png'
    ];
    let currentBgIndex = 0;
    let bgRotationInterval = null;

    // Preloaded image cache
    const imageCache = {
        backgrounds: [],
        aiImages: [],
        realImages: []
    };

    // DOM elements
    const landingContainer = document.getElementById('landing-container');
    const introSection = document.getElementById('intro-section');
    const resultsSection = document.getElementById('results-section');
    const startGameButton = document.getElementById('start-game');
    const image1Container = document.getElementById('image1-container');
    const image2Container = document.getElementById('image2-container');
    const image1 = document.getElementById('image1');
    const image2 = document.getElementById('image2');
    const gameContainer = document.getElementById('game-container');
    const correctCountElement = document.getElementById('correct-count');
    const successRateElement = document.getElementById('success-rate');
    const playAgainButton = document.getElementById('play-again');
    const reviewGameButton = document.getElementById('review-game'); // New button
    const backgroundContainer = document.getElementById('background-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingProgress = document.getElementById('loading-progress');

    // Initialize game by counting files, loading metadata, and setting up indices
    await initGame();
    
    // Event listeners
    startGameButton.addEventListener('click', startGame);
    
    image1Container.addEventListener('click', () => {
        if (reviewMode) {
            nextReviewPair();
        } else {
            checkAnswer('left');
        }
    });
    
    image2Container.addEventListener('click', () => {
        if (reviewMode) {
            nextReviewPair();
        } else {
            checkAnswer('right');
        }
    });

    playAgainButton.addEventListener('click', resetGame);
    reviewGameButton.addEventListener('click', startReview); // New event listener

    // Functions
    function startGame() {
        // Reset game history
        gameHistory = [];
        
        // Hide landing page, show game
        landingContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        
        // Reset to first pair
        currentPair = 1;
        correctAnswers = 0;
        reviewMode = false;
        
        // Init background rotation if not already started
        if (!bgRotationInterval) {
            initBackgroundRotation();
        }
        
        loadImagePair();
    }
    
    async function initGame() {
        try {
            // Show loading indicator
            loadingIndicator.classList.remove('hidden');
            
            // Count the number of files in each directory
            const [n_ai, n_real] = await countFilesInDirectories();
            console.log(`Found ${n_ai} AI images and ${n_real} real images.`);
            
            // Sample indices based on the counted files
            ai_indices = getUniqueRandomIndices(10, 1, n_ai);
            real_indices = getUniqueRandomIndices(10, 1, n_real);
            
            // Load the artwork metadata
            await loadArtworkMetadata();
            
            // Preload all images
            await preloadAllImages(n_ai, n_real);
            
            // Initialize background with preloaded image
            initBackgroundRotation();
            
            // Hide loading indicator when done
            loadingIndicator.classList.add('hidden');
            
        } catch (error) {
            console.error('Error initializing game:', error);
            loadingIndicator.classList.add('hidden');
        }
    }
    
    // New preloading function
    async function preloadAllImages(n_ai, n_real) {
        const totalImagesToLoad = backgrounds.length + ai_indices.length + real_indices.length;
        let loadedCount = 0;
        
        const updateProgress = () => {
            loadedCount++;
            const percent = Math.floor((loadedCount / totalImagesToLoad) * 100);
            loadingProgress.textContent = `${percent}%`;
            loadingProgress.style.width = `${percent}%`;
        };
        
        // Helper function to preload a single image
        const preloadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    updateProgress();
                    resolve(img);
                };
                img.onerror = () => {
                    console.error(`Failed to load image: ${src}`);
                    updateProgress();
                    // Resolve anyway to continue loading other images
                    resolve(null);
                };
                img.src = src;
            });
        };
        
        // Preload backgrounds
        const bgPromises = backgrounds.map(bg => {
            return preloadImage(bg).then(img => {
                if (img) imageCache.backgrounds.push(img);
            });
        });
        
        // Preload AI images
        const aiPromises = ai_indices.map(index => {
            const src = `assets/ai_images/${index}.png`;
            return preloadImage(src).then(img => {
                if (img) imageCache.aiImages[index] = img;
            });
        });
        
        // Preload real images
        const realPromises = real_indices.map(index => {
            const src = `assets/real_images/${index}.png`;
            return preloadImage(src).then(img => {
                if (img) imageCache.realImages[index] = img;
            });
        });
        
        // Wait for all images to load
        await Promise.all([...bgPromises, ...aiPromises, ...realPromises]);
        console.log('All images preloaded successfully');
    }
    
    // New function to load the artwork metadata
    async function loadArtworkMetadata() {
        try {
            // Load real images metadata
            const realResponse = await fetch('assets/real_images/mapper.json');
            if (!realResponse.ok) {
                throw new Error('Failed to load real artwork metadata');
            }
            realImageMetadata = await realResponse.json();
            console.log('Real artwork metadata loaded successfully');
            
            // Load AI images metadata
            const aiResponse = await fetch('assets/ai_images/mapper.json');
            if (!aiResponse.ok) {
                throw new Error('Failed to load AI image metadata');
            }
            aiImageMetadata = await aiResponse.json();
            console.log('AI image metadata loaded successfully');
        } catch (error) {
            console.error('Error loading artwork metadata:', error);
            // Initialize as empty objects if loading fails
            realImageMetadata = {};
            aiImageMetadata = {};
        }
    }
    
    // Initialize background rotation system
    function initBackgroundRotation() {
        // Create first background
        addBackgroundLayer(backgrounds[currentBgIndex], true);
        
        // Set up rotation interval
        bgRotationInterval = setInterval(rotateBackground, 20000); // 20 seconds
    }
    
    // Add a new background layer
    function addBackgroundLayer(imageUrl, isActive = false) {
        const backgroundLayer = document.createElement('div');
        backgroundLayer.className = 'background-layer';
        if (isActive) {
            backgroundLayer.classList.add('active-background');
        }
        backgroundLayer.style.backgroundImage = `url(${imageUrl})`;
        backgroundContainer.appendChild(backgroundLayer);
        
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
        currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
        const nextBgUrl = backgrounds[currentBgIndex];
        
        // Get all current background layers
        const currentLayers = backgroundContainer.querySelectorAll('.background-layer');
        
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
                const oldLayers = backgroundContainer.querySelectorAll('.fade-out-background');
                oldLayers.forEach(layer => {
                    backgroundContainer.removeChild(layer);
                });
            }, 2100); // Slightly longer than the CSS transition
        }, 50);
    }
    
    async function countFilesInDirectories() {
        // Count files in both directories
        const aiCount = await countFilesInDirectory('assets/ai_images');
        const realCount = await countFilesInDirectory('assets/real_images');
        
        return [aiCount, realCount];
    }
    
    async function countFilesInDirectory(dirPath) {
        // This is a JavaScript approximation of os.listdir() length count
        // We'll check for file existence sequentially
        let count = 0;
        const maxCheck = 100; // Safety limit to prevent infinite loop
        
        for (let i = 1; i <= maxCheck; i++) {
            try {
                // Check if file exists by sending a HEAD request
                const response = await fetch(`${dirPath}/${i}.png`, { method: 'HEAD' });
                if (response.ok) {
                    count = i;
                } else if (count > 0) {
                    // If we found files and then got a 404, we can stop
                    break;
                }
            } catch (error) {
                if (count > 0) break;
            }
        }
        
        return Math.max(count, 5); // Ensure we have at least 5 images to sample from
    }
    
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

    function loadImagePair() {
        // Randomly decide which image will be AI-generated
        aiImagePosition = Math.random() < 0.5 ? 'left' : 'right';
        
        // Get the indices for the current pair
        const ai_index = ai_indices[currentPair - 1];
        const real_index = real_indices[currentPair - 1];
        
        // Set image sources - use the preloaded image URLs from cache
        let leftImageSrc, rightImageSrc;
        if (aiImagePosition === 'left') {
            leftImageSrc = `assets/ai_images/${ai_index}.png`;
            rightImageSrc = `assets/real_images/${real_index}.png`;
            image1.src = leftImageSrc;
            image2.src = rightImageSrc;
        } else {
            leftImageSrc = `assets/real_images/${real_index}.png`;
            rightImageSrc = `assets/ai_images/${ai_index}.png`;
            image1.src = leftImageSrc;
            image2.src = rightImageSrc;
        }
        
        // Reset any highlighting from review mode
        image1Container.style.border = '';
        image2Container.style.border = '';
    }

    function checkAnswer(selectedPosition) {
        const isCorrect = selectedPosition === aiImagePosition;
        
        if (isCorrect) {
            correctAnswers++;
        }
        
        // Get the current indices for this pair
        const real_index = real_indices[currentPair - 1];
        const ai_index = ai_indices[currentPair - 1];
        
        // Store this pair in game history
        gameHistory.push({
            pairNumber: currentPair,
            aiPosition: aiImagePosition,
            userSelected: selectedPosition,
            correct: isCorrect,
            leftImageSrc: image1.src,
            rightImageSrc: image2.src,
            realIndex: real_index, // Store the real image index for metadata lookup
            aiIndex: ai_index // Store the AI image index for metadata lookup
        });

        // Move to next pair or show results
        if (currentPair < totalPairs) {
            currentPair++;
            loadImagePair();
        } else {
            showResults();
        }
    }

    function showResults() {
        // Calculate success rate
        const successRate = (correctAnswers / totalPairs) * 100;
        
        // Update results elements
        correctCountElement.textContent = correctAnswers;
        successRateElement.textContent = successRate.toFixed(0);
        
        // Hide game container and show landing page with results
        gameContainer.classList.add('hidden');
        landingContainer.classList.remove('hidden');
        introSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }

    function resetGame() {
        // Reset game variables
        currentPair = 1;
        correctAnswers = 0;
        gameHistory = [];
        reviewMode = false;
        
        // Hide the results section
        landingContainer.classList.add('hidden');
        resultsSection.classList.add('hidden');
        
        // Show the game container directly
        gameContainer.classList.remove('hidden');
        
        // Re-initialize game to get fresh indices and load first pair
        // No need to preload images again as they're already cached
        ai_indices = getUniqueRandomIndices(10, 1, imageCache.aiImages.length);
        real_indices = getUniqueRandomIndices(10, 1, imageCache.realImages.length);
        loadImagePair();
    }
    
    // New functions for review functionality
    function startReview() {
        // Switch to review mode
        reviewMode = true;
        reviewIndex = 0;
        
        // Hide results and show game container
        landingContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        
        
        // Load the first pair in review mode
        loadReviewPair();
    }
    
    function loadReviewPair() {
        if (reviewIndex >= gameHistory.length) {
            // End of review, go back to results
            endReview();
            return;
        }
        
        const pairData = gameHistory[reviewIndex];
        
        // Set image sources
        image1.src = pairData.leftImageSrc;
        image2.src = pairData.rightImageSrc;
        
        // Reset any previous highlighting
        image1Container.style.border = '';
        image2Container.style.border = '';
        
        // Add review hover class to both containers
        image1Container.classList.add('review-hover-enabled');
        image2Container.classList.add('review-hover-enabled');
        
        // Get the real and AI image metadata
        const realIndex = pairData.realIndex;
        const aiIndex = pairData.aiIndex;
        const realMetadata = realImageMetadata[realIndex];
        const aiMetadata = aiImageMetadata[aiIndex];
        
        // Prepare AI metadata text
        let aiMetadataText = 'AI Generated';
        if (aiMetadata) {
            aiMetadataText = `Source: ${aiMetadata.Source}`;
            
            // Add prompt or URL based on what's available
            if (aiMetadata.Metadata) {
                if (aiMetadata.Metadata.url) {
                    aiMetadataText += `\nURL: ${aiMetadata.Metadata.url}`;
                }
            }
        }
        
        // Set hover text for AI and real images
        if (pairData.aiPosition === 'left') {
            // Left is AI, right is real
            image1Container.setAttribute('data-image-type', aiMetadataText);
            
            // Add metadata to real image if available
            if (realMetadata) {
                image2Container.setAttribute('data-image-type', 
                    `"${realMetadata.Title}"\n${realMetadata.Author}`);
            } else {
                image2Container.setAttribute('data-image-type', 'Real Image');
            }
        } else {
            // Left is real, right is AI
            image2Container.setAttribute('data-image-type', aiMetadataText);
            
            // Add metadata to real image if available
            if (realMetadata) {
                image1Container.setAttribute('data-image-type', 
                    `"${realMetadata.Title}"\n${realMetadata.Author}`);
            } else {
                image1Container.setAttribute('data-image-type', 'Real Image');
            }
        }
        
        // Highlight the user's selection as green (correct) or red (incorrect)
        if (pairData.userSelected === 'left') {
            image1Container.style.border = pairData.correct ? '4px solid green' : '4px solid red';
        } else {
            image2Container.style.border = pairData.correct ? '4px solid green' : '4px solid red';
        }
    }
    
    function endReview() {
        // Switch back to normal mode
        reviewMode = false;
        
        // Show results again
        gameContainer.classList.add('hidden');
        landingContainer.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
        
        // Reset image borders
        image1Container.style.border = '';
        image2Container.style.border = '';
        
        // Remove the review hover class
        image1Container.classList.remove('review-hover-enabled');
        image2Container.classList.remove('review-hover-enabled');
        
        // Remove data attributes
        image1Container.removeAttribute('data-image-type');
        image2Container.removeAttribute('data-image-type');
    }
    
    function nextReviewPair() {
        reviewIndex++;
        loadReviewPair();
    }
});
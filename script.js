document.addEventListener('DOMContentLoaded', async () => {
    const n_ai = 18
    const n_real = 18
// Enhanced error logging for logGameComplete function
function logGameComplete(score, totalQuestions, successRate) {
  
  if (typeof firebase === 'undefined') {
    console.error("Firebase is not defined");
    return;
  }
  
  try {
    // Log to Analytics
    firebase.analytics().logEvent('game_complete', {
      score: score,
      total_questions: totalQuestions,
      success_rate: successRate
    });
    
    // Store in Firestore
    firebase.firestore().collection('game_results').add({
      score: score,
      total_questions: totalQuestions,
      success_rate: successRate,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then((docRef) => {
    })
    .catch((error) => {
      console.error('Error saving to Firestore:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
    });
  } catch (error) {
    console.error("Critical error in logGameComplete:", error);
  }
}
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

    // Loading state tracking
    let isBackgroundLoading = false;
    let backgroundLoadPromise = null;

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
    const loadingMessage = document.getElementById('loading-message');

    const showLeaderboardButton = document.getElementById('show-leaderboard');
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const leaderboardBackButton = document.getElementById('leaderboard-back');
    const leaderboardContent = document.getElementById('leaderboard-content');

    // Initialize game - only load essential data first
    await initGame();

    if (showLeaderboardButton) {
        showLeaderboardButton.addEventListener('click', showLeaderboard);
    }
    
    if (leaderboardBackButton) {
        leaderboardBackButton.addEventListener('click', hideLeaderboard);
    }
    
    // Function to fetch the top 5 real images with highest win rate
    async function fetchTopRealImages() {
        try {
            
            // Reference to the image_stats collection
            const imageStatsRef = firebase.firestore().collection('image_stats');
            
            // Query all real images
            const realImagesQuery = await imageStatsRef
                .where('type', '==', 'real')
                .get();
            
            if (realImagesQuery.empty) {
                return [];
            }
            
            // Calculate win rate for each real image
            const imagesWithWinRate = [];
            
            realImagesQuery.forEach(doc => {
                const data = doc.data();
                // Win rate is the percentage of times the real image was correctly identified as NOT AI
                // So it's the number of correct identifications divided by total times seen
                const winRate = data.seen > 0 ? (data.correct / data.seen) * 100 : 0;
                
                imagesWithWinRate.push({
                    id: data.image_id,
                    seen: data.seen,
                    correct: data.correct,
                    winRate: winRate
                });
            });
            
            // Sort by win rate (highest first)
            imagesWithWinRate.sort((a, b) => a.winRate - b.winRate);
            
            // Return top 3
            return imagesWithWinRate.slice(0, 3);
            
        } catch (error) {
            console.error('Error fetching top real images:', error);
            return [];
        }
    }
    
    function logGameStart() {
        try {
            firebase.analytics().logEvent('game_start');
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }
    
    function logGameComplete(score, totalQuestions, successRate) {
        try {
            // Log to Analytics
            firebase.analytics().logEvent('game_complete', {
                score: score,
                total_questions: totalQuestions,
                success_rate: successRate
            });
            
            // Store in Firestore
            firebase.firestore().collection('game_results').add({
                score: score,
                total_questions: totalQuestions,
                success_rate: successRate,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then((docRef) => {

            })
            .catch((error) => {
                console.error('Error saving result:', error);
            });
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }

    startGameButton.addEventListener('click', () => {
        startGame();
        logGameStart();
        initializeImageStatsCollection(); // Add this line
    });
    
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
    async function startGame() {
        // Reset game history
        gameHistory = [];
        
        // Hide landing page
        landingContainer.classList.add('hidden');
        
        // If we need to preload the first pair, show loading
        if (!isPairPreloaded(currentPair)) {
            loadingMessage.textContent = "Loading first images...";
            loadingIndicator.classList.remove('hidden');
            
            // Preload just the first pair
            await preloadSpecificPair(currentPair);
            
            // Hide loading when done
            loadingIndicator.classList.add('hidden');
        }
        
        // Show game
        gameContainer.classList.remove('hidden');
        
        // Reset game state
        currentPair = 1;
        correctAnswers = 0;
        reviewMode = false;
        
        // Init background rotation if not already started
        if (!bgRotationInterval) {
            initBackgroundRotation();
        }
        
        // Start background loading the rest of the images if not already loading
        if (!isBackgroundLoading) {
            startBackgroundImageLoading();
        }
        
        loadImagePair();
    }
    
    async function showLeaderboard() {
        try {
            // Show loading indicator
            loadingIndicator.classList.remove('hidden');
            loadingMessage.textContent = "Loading leaderboard...";
            
            // Fetch top real images
            const topRealImages = await fetchTopRealImages();
            
            // Clear previous content
            leaderboardContent.innerHTML = '';
            
            if (topRealImages.length === 0) {
                leaderboardContent.innerHTML = '<p>No data available yet. Play more games!</p>';
            } else {
                // Build leaderboard UI
                for (const image of topRealImages) {
                    // Get metadata for this real image
                    const metadata = realImageMetadata[image.id] || { Title: 'Untitled', Author: 'Unknown Artist' };
                    
                    // Create leaderboard item
                    const itemElement = document.createElement('div');
                    itemElement.className = 'leaderboard-item';
                    
                    // Round win rate to one decimal place
                    const winRateDisplay = Math.abs(image.winRate.toFixed(1) - 100);
                    
                    itemElement.innerHTML = `
                        <img src="assets/real_images/${image.id}.png" alt="${metadata.Title}">
                        <div class="leaderboard-item-info">
                            <h3>${metadata.Title}</h3>
                            <p>Artist: ${metadata.Author}</p>
                            <p>Identified as real <span class="win-rate">${winRateDisplay}%</span> of the time</p>
                        </div>
                    `;
                    
                    leaderboardContent.appendChild(itemElement);
                }
            }
            
            // Hide other containers and show leaderboard
            landingContainer.classList.add('hidden');
            gameContainer.classList.add('hidden');
            leaderboardContainer.classList.remove('hidden');
            
            // Hide loading indicator
            loadingIndicator.classList.add('hidden');
            
        } catch (error) {
            console.error('Error showing leaderboard:', error);
            loadingIndicator.classList.add('hidden');
        }
    }
    
    // Function to hide the leaderboard and return to results
    function hideLeaderboard() {
        // Hide leaderboard
        leaderboardContainer.classList.add('hidden');
        
        // Show results
        landingContainer.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
    }
    
    // Add this function to the initialization code
    async function initGame() {
        try {
            // Show loading indicator
            loadingIndicator.classList.remove('hidden');
            loadingMessage.textContent = "Loading game...";
            
            // Count the number of files in each directory
            
            // Sample indices based on the counted files
            ai_indices = getUniqueRandomIndices(10, 1, n_ai);
            real_indices = getUniqueRandomIndices(10, 1, n_real);
            
            // Load the artwork metadata
            await loadArtworkMetadata();
            
            // Preload only the first background image and first pair of game images
            await preloadEssentialImages();
            
            // Initialize first background
            initFirstBackground();
            
            // Hide loading indicator when essentials are loaded
            loadingIndicator.classList.add('hidden');
            
            // Start loading the rest of the images in the background
            startBackgroundImageLoading();
            
        } catch (error) {
            console.error('Error initializing game:', error);
            loadingIndicator.classList.add('hidden');
        }
    }
    
    // Preload only essential images to start quickly
    async function preloadEssentialImages() {
        // Preload only first background image
        await preloadImage(backgrounds[0]).then(img => {
            if (img) imageCache.backgrounds[0] = img;
        });
        
        // Preload first pair of images
        const firstPair = 1;
        await preloadSpecificPair(firstPair);
        
    }
    
    // Start background loading of remaining images
    function startBackgroundImageLoading() {
        if (isBackgroundLoading) return;
        
        isBackgroundLoading = true;
        
        backgroundLoadPromise = new Promise(async (resolve) => {
            
            // Background load remaining backgrounds (skip the first one)
            for (let i = 1; i < backgrounds.length; i++) {
                if (!imageCache.backgrounds[i]) {
                    preloadImage(backgrounds[i]).then(img => {
                        if (img) imageCache.backgrounds[i] = img;
                    });
                }
            }
            
            // Background load all game images
            for (let i = 2; i <= totalPairs; i++) {
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
        if (pairNum < 1 || pairNum > totalPairs) return false;
        
        const ai_index = ai_indices[pairNum - 1];
        const real_index = real_indices[pairNum - 1];
        
        return !!(imageCache.aiImages[ai_index] && imageCache.realImages[real_index]);
    }
    
    // Preload a specific pair of images
    async function preloadSpecificPair(pairNum, waitForCompletion = true) {
        if (pairNum < 1 || pairNum > totalPairs) return;
        
        const ai_index = ai_indices[pairNum - 1];
        const real_index = real_indices[pairNum - 1];
        
        const aiSrc = `assets/ai_images/${ai_index}.png`;
        const realSrc = `assets/real_images/${real_index}.png`;
        
        const aiPromise = imageCache.aiImages[ai_index] ? 
            Promise.resolve(imageCache.aiImages[ai_index]) : 
            preloadImage(aiSrc).then(img => {
                if (img) imageCache.aiImages[ai_index] = img;
                return img;
            });
            
        const realPromise = imageCache.realImages[real_index] ? 
            Promise.resolve(imageCache.realImages[real_index]) : 
            preloadImage(realSrc).then(img => {
                if (img) imageCache.realImages[real_index] = img;
                return img;
            });
        
        if (waitForCompletion) {
            await Promise.all([aiPromise, realPromise]);
        }
    }
    
    // Helper function to preload a single image
    function preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                // Resolve anyway to continue loading other images
                resolve(null);
            };
            img.src = src;
        });
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
            
            // Load AI images metadata
            const aiResponse = await fetch('assets/ai_images/mapper.json');
            if (!aiResponse.ok) {
                throw new Error('Failed to load AI image metadata');
            }
            aiImageMetadata = await aiResponse.json();
        } catch (error) {
            console.error('Error loading artwork metadata:', error);
            // Initialize as empty objects if loading fails
            realImageMetadata = {};
            aiImageMetadata = {};
        }
    }
    
    // Initialize just the first background (for fast startup)
    function initFirstBackground() {
        addBackgroundLayer(backgrounds[currentBgIndex], true);
    }
    
    // Initialize background rotation system
    function initBackgroundRotation() {
        // Set up rotation interval if not already running
        if (!bgRotationInterval) {
            bgRotationInterval = setInterval(rotateBackground, 20000); // 20 seconds
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
        
        // Check if image is already preloaded, if not preload it
        if (!imageCache.backgrounds[currentBgIndex]) {
            preloadImage(nextBgUrl).then(img => {
                if (img) imageCache.backgrounds[currentBgIndex] = img;
                performBackgroundTransition(nextBgUrl);
            });
        } else {
            performBackgroundTransition(nextBgUrl);
        }
    }
    
    // Perform the actual background transition
    function performBackgroundTransition(nextBgUrl) {
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
        
        return Math.max(count, 3); // Ensure we have at least 5 images to sample from
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

    async function loadImagePair() {
        // Check if the images for this pair are preloaded
        if (!isPairPreloaded(currentPair)) {
            // Show loading indicator if we need to load this pair
            loadingIndicator.classList.remove('hidden');
            loadingMessage.textContent = `Loading images...`;
            
            // Wait for this specific pair to load
            await preloadSpecificPair(currentPair);
            
            // Hide loading indicator
            loadingIndicator.classList.add('hidden');
        }
        
        // Also preload the next pair in the background (if it exists)
        if (currentPair < totalPairs && !isPairPreloaded(currentPair + 1)) {
            preloadSpecificPair(currentPair + 1, false);
        }
        
        // Randomly decide which image will be AI-generated
        aiImagePosition = Math.random() < 0.5 ? 'left' : 'right';
        
        // Get the indices for the current pair
        const ai_index = ai_indices[currentPair - 1];
        const real_index = real_indices[currentPair - 1];
        
        // Set image sources
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

    function logImageStatistics(imageId, isAI, wasCorrectlyIdentified) {
        try {
          
          // Reference to the image_stats collection
          const imageStatsRef = firebase.firestore().collection('image_stats');
          const docId = `${isAI ? 'ai' : 'real'}_${imageId}`;
          
          // First check if the document exists
          imageStatsRef.doc(docId).get()
            .then((docSnapshot) => {
              if (docSnapshot.exists) {
                // Document exists, update the counters
                return imageStatsRef.doc(docId).update({
                  seen: firebase.firestore.FieldValue.increment(1),
                  correct: firebase.firestore.FieldValue.increment(wasCorrectlyIdentified ? 1 : 0)
                });
              } else {
                // Document doesn't exist, create it with initial values
                return imageStatsRef.doc(docId).set({
                  image_id: imageId,
                  type: isAI ? 'ai' : 'real',
                  seen: 1,
                  correct: wasCorrectlyIdentified ? 1 : 0
                });
              }
            })
            .then(() => {
            })
            .catch(error => {
              console.error('Error updating image statistics:', error);
              console.error('Error code:', error.code);
              console.error('Error message:', error.message);
            });
        } catch (error) {
        }
      }
      
      // 3. Function to initialize the collection explicitly (can help with permission debugging)
      function initializeImageStatsCollection() {
        
        firebase.firestore().collection('image_stats').doc('init')
          .set({
            initialized: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          })
          .then(() => {
          })
          .catch(error => {
            console.error("Error initializing collection:", error);
            console.error("This is likely a permissions issue. Please update your Firestore security rules.");
          });
      }
      
      function checkAnswer(selectedPosition) {
        const isCorrect = selectedPosition === aiImagePosition;
        
        if (isCorrect) {
            correctAnswers++;
        }
        
        // Get the current indices for this pair
        const real_index = real_indices[currentPair - 1];
        const ai_index = ai_indices[currentPair - 1];
        
        // Log image statistics
        logImageStatistics(ai_index, true, selectedPosition === aiImagePosition);
        logImageStatistics(real_index, false, selectedPosition !== aiImagePosition);
        
        // Store this pair in game history
        gameHistory.push({
            pairNumber: currentPair,
            aiPosition: aiImagePosition,
            userSelected: selectedPosition,
            correct: isCorrect,
            leftImageSrc: image1.src,
            rightImageSrc: image2.src,
            realIndex: real_index,
            aiIndex: ai_index
        });
    
        // Move to next pair or show results
        if (currentPair < totalPairs) {
            currentPair++;
            loadImagePair();
        } else {
            showResults();
        }
    }

    async function getPlayerPercentile(currentScore) {
        try {
          
          const resultsSnapshot = await firebase.firestore()
            .collection('game_results')
            .get();
          
          if (resultsSnapshot.empty) {
            return 0;
          }
          
          let lowerScores = 0;
          let totalGames = 0;
          
          resultsSnapshot.forEach(doc => {
            const data = doc.data();
            totalGames++;
            if (data.score < currentScore) {
              lowerScores++;
            }
          });
          
          // Calculate and return the percentile
          const percentile = Math.round((lowerScores / totalGames) * 100);
          return percentile;
        } catch (error) {
          console.error('Error calculating percentile:', error);
          return null; // Return null to indicate error
        }
      }
      
      // Replace the existing showResults function with this updated version
      async function showResults() {
          // Calculate success rate
          const successRate = (correctAnswers / totalPairs) * 100;
          
          // Update results elements
          correctCountElement.textContent = correctAnswers;
          successRateElement.textContent = successRate.toFixed(0);
          
          // Log to Firebase
          logGameComplete(correctAnswers, totalPairs, successRate.toFixed(0));
          
          // Calculate and display the player's percentile
          try {
              const percentile = await getPlayerPercentile(correctAnswers);
              if (percentile !== null) {
                  // Update the percentile element we'll add to the HTML
                  const percentileElement = document.getElementById('percentile-value');
                  if (percentileElement) {
                      percentileElement.textContent = percentile;
                      document.getElementById('percentile-container').classList.remove('hidden');
                  }
              }
          } catch (error) {
              console.error("Error getting percentile:", error);
              // Hide the percentile container if there was an error
              const percentileContainer = document.getElementById('percentile-container');
              if (percentileContainer) {
                  percentileContainer.classList.add('hidden');
              }
          }
          
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
        ai_indices = getUniqueRandomIndices(10, 1, n_ai);
        real_indices = getUniqueRandomIndices(10, 1, n_real);
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
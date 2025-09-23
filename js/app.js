class AlumniMatch {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 4;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 50;
        this.stats = {
            shares: 0,
            votesYes: 0,
            votesNo: 0
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.hideLoadingScreen();
        this.updatePageIndicators();
        this.loadStats();
    }

    setupEventListeners() {
        // Touch events for swiping
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

        // Mouse events for desktop testing
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Video controls
        const playButton = document.getElementById('playButton');
        const video = document.getElementById('introVideo');

        if (playButton && video) {
            playButton.addEventListener('click', this.toggleVideo.bind(this));
            video.addEventListener('play', () => this.hideVideoOverlay());
            video.addEventListener('pause', () => this.showVideoOverlay());
        }

        // Vote buttons
        const voteYes = document.getElementById('voteYes');
        const voteNo = document.getElementById('voteNo');

        if (voteYes) voteYes.addEventListener('click', () => this.handleVote(true));
        if (voteNo) voteNo.addEventListener('click', () => this.handleVote(false));

        // Share buttons
        const shareButtons = document.querySelectorAll('.share-button');
        shareButtons.forEach(button => {
            button.addEventListener('click', this.handleShare.bind(this));
        });

        // Restart button
        const restartButton = document.getElementById('restartApp');
        if (restartButton) {
            restartButton.addEventListener('click', this.restart.bind(this));
        }

        // Page indicators
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                this.goToPage(page);
            });
        });
    }

    setupIntersectionObserver() {
        const videoSection = document.querySelector('.video-section');
        const video = document.getElementById('introVideo');

        if (videoSection && video) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        video.play().catch(e => console.log('Video autoplay prevented:', e));
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(videoSection);
        }

        // Observe reason cards for scroll-triggered animations
        const reasonCards = document.querySelectorAll('.reason-card');
        if (reasonCards.length > 0) {
            const cardObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const delay = parseFloat(entry.target.dataset.animationDelay) || 0;
                        setTimeout(() => {
                            entry.target.classList.add('animate');
                        }, delay * 1000);
                    }
                });
            }, { threshold: 0.2 });

            reasonCards.forEach(card => {
                cardObserver.observe(card);
            });
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
        if (!this.touchStartX || !this.touchStartY) return;

        // Prevent default scrolling behavior for horizontal swipes
        const touchCurrentX = e.touches[0].clientX;
        const touchCurrentY = e.touches[0].clientY;
        const diffX = Math.abs(touchCurrentX - this.touchStartX);
        const diffY = Math.abs(touchCurrentY - this.touchStartY);

        if (diffX > diffY) {
            e.preventDefault();
        }
    }

    handleTouchEnd(e) {
        if (!this.touchStartX || !this.touchStartY) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diffX = this.touchStartX - touchEndX;
        const diffY = this.touchStartY - touchEndY;

        // Check if it's more horizontal than vertical
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > this.minSwipeDistance) {
                if (diffX > 0) {
                    this.swipeLeft();
                } else {
                    this.swipeRight();
                }
            }
        }

        this.touchStartX = 0;
        this.touchStartY = 0;
    }

    handleMouseDown(e) {
        this.touchStartX = e.clientX;
        this.touchStartY = e.clientY;
    }

    handleMouseMove(e) {
        if (!this.touchStartX) return;

        const diffX = Math.abs(e.clientX - this.touchStartX);
        const diffY = Math.abs(e.clientY - this.touchStartY);

        if (diffX > diffY) {
            e.preventDefault();
        }
    }

    handleMouseUp(e) {
        if (!this.touchStartX) return;

        const diffX = this.touchStartX - e.clientX;
        const diffY = this.touchStartY - e.clientY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > this.minSwipeDistance) {
                if (diffX > 0) {
                    this.swipeLeft();
                } else {
                    this.swipeRight();
                }
            }
        }

        this.touchStartX = 0;
        this.touchStartY = 0;
    }

    handleKeyDown(e) {
        switch(e.key) {
            case 'ArrowLeft':
                this.swipeRight();
                break;
            case 'ArrowRight':
                this.swipeLeft();
                break;
            case ' ':
            case 'Enter':
                if (this.currentPage === 1) {
                    this.swipeLeft();
                }
                break;
        }
    }

    swipeLeft() {
        if (this.currentPage < this.totalPages && !this.isTransitioning) {
            this.goToPage(this.currentPage + 1);
        }
    }

    swipeRight() {
        if (this.currentPage > 1 && !this.isTransitioning) {
            this.goToPage(this.currentPage - 1);
        }
    }

    goToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.totalPages || this.isTransitioning) {
            return;
        }

        this.isTransitioning = true;

        // Hide current page
        const currentPageEl = document.querySelector('.page.active');
        if (currentPageEl) {
            currentPageEl.classList.remove('active');
        }

        // Show new page
        const newPageEl = document.getElementById(`page${pageNumber}`);
        if (newPageEl) {
            setTimeout(() => {
                newPageEl.classList.add('active');
                this.currentPage = pageNumber;
                this.updatePageIndicators();
                this.triggerPageAnimations(pageNumber);

                setTimeout(() => {
                    this.isTransitioning = false;
                }, 300);
            }, 150);
        }
    }

    triggerPageAnimations(pageNumber) {
        switch(pageNumber) {
            case 2:
                this.animateMatch();
                break;
            case 3:
                this.animateVotePrompt();
                break;
            case 4:
                this.animateSharePage();
                break;
        }
    }

    animateMatch() {
        // Magazine content is now immediately visible
        // Just trigger the staggered animations for magazine elements
        this.animateMagazineContent();
    }

    animateMagazineContent() {
        // Trigger animations for magazine elements
        const greeting = document.querySelector('.greeting');
        const nameTitle = document.querySelector('.name-title');
        const candidateInfo = document.querySelector('.candidate-info');
        const aboutSection = document.querySelector('.about-section');
        const magazinePhotos = document.querySelector('.magazine-photos');

        // Reset and animate elements
        [greeting, nameTitle, candidateInfo, aboutSection, magazinePhotos].forEach((el, index) => {
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                setTimeout(() => {
                    el.style.transition = 'all 0.8s ease-out';
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, index * 200);
            }
        });
    }


    animateVotePrompt() {
        const voteButtons = document.querySelectorAll('.vote-button');
        voteButtons.forEach((button, index) => {
            setTimeout(() => {
                button.style.opacity = '1';
                button.style.transform = 'scale(1)';
            }, index * 150);
        });
    }

    animateSharePage() {
        const shareButtons = document.querySelectorAll('.share-button');
        shareButtons.forEach((button, index) => {
            setTimeout(() => {
                button.style.opacity = '1';
                button.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }


    getRandomColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffa726', '#ab47bc'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updatePageIndicators() {
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            if (index + 1 === this.currentPage) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    toggleVideo() {
        const video = document.getElementById('introVideo');
        if (video) {
            if (video.paused) {
                video.play();
                video.muted = false;
            } else {
                video.pause();
            }
        }
    }

    hideVideoOverlay() {
        const overlay = document.querySelector('.video-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
        }
    }

    showVideoOverlay() {
        const overlay = document.querySelector('.video-overlay');
        if (overlay) {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
        }
    }

    handleVote(isYes) {
        if (isYes) {
            this.stats.votesYes++;
        } else {
            this.stats.votesNo++;
        }
        this.saveStats();
        this.updateStatsDisplay();

        const button = isYes ? document.getElementById('voteYes') : document.getElementById('voteNo');
        if (button) {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        }

        setTimeout(() => {
            this.goToPage(4);
        }, 500);
    }

    handleShare(e) {
        const platform = e.currentTarget.dataset.platform;
        const totalVotes = this.stats.votesYes + this.stats.votesNo;
        const shareText = `🗳️ Just voted in the Alumni Match movement!\n\n📊 Current Results:\n✅ Yes: ${this.stats.votesYes} votes\n❌ No: ${this.stats.votesNo} votes\n\n🗓️ Election Day: September 24th, 2025\n\nYour vote matters! Join us: ${window.location.href}`;

        switch(platform) {
            case 'whatsapp':
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                window.open(whatsappUrl, '_blank');
                break;
        }

        this.stats.shares++;
        this.saveStats();
        this.updateStatsDisplay();
    }


    loadStats() {
        const savedStats = localStorage.getItem('alumniMatchStats');
        if (savedStats) {
            this.stats = JSON.parse(savedStats);
        }
        this.updateStatsDisplay();
    }

    saveStats() {
        localStorage.setItem('alumniMatchStats', JSON.stringify(this.stats));
    }

    updateStatsDisplay() {
        this.updateBarChart();
    }

    updateBarChart() {
        const yesCount = document.getElementById('yes-count');
        const noCount = document.getElementById('no-count');
        const yesBar = document.getElementById('yes-bar');
        const noBar = document.getElementById('no-bar');

        if (yesCount) yesCount.textContent = this.stats.votesYes;
        if (noCount) noCount.textContent = this.stats.votesNo;

        const total = this.stats.votesYes + this.stats.votesNo;
        const yesPercent = total > 0 ? (this.stats.votesYes / total) * 100 : 50;
        const noPercent = total > 0 ? (this.stats.votesNo / total) * 100 : 50;

        if (yesBar) {
            yesBar.style.width = Math.max(yesPercent, 10) + '%';
        }
        if (noBar) {
            noBar.style.width = Math.max(noPercent, 10) + '%';
        }
    }

    restart() {
        this.goToPage(1);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1500);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AlumniMatch();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
class AlumniMatch {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 4;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 50;

        // Supabase configuration
        this.supabaseUrl = 'https://ebfoagvzgfihmtjipeiz.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZm9hZ3Z6Z2ZpaG10amlwZWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NzkzMjgsImV4cCI6MjA3NDI1NTMyOH0.c-GIRz4y4vGpD3Zq-c5aclN8OQOLrQnFmQCrTFjt22g';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

        // Enhanced voting system
        this.sessionId = this.generateSessionId();
        this.bufferProcessInterval = 5000; // Process buffer every 5 seconds

        // Legacy stats for compatibility
        this.stats = {
            shares: 0,
            votesYes: 0,
            votesNo: 0
        };

        // Current vote counts (loaded from Supabase)
        this.voteCounts = { yes: 0, no: 0 };

        this.init();
    }

    async init() {
        await this.loadVoteData();
        await this.initializeSession();
        this.startBufferProcessor();
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.hideLoadingScreen();
        this.updatePageIndicators();
        this.setupAdminShortcuts();
        await this.logInteraction('app_initialized');
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

        // Admin toggle button
        const adminToggle = document.getElementById('adminToggle');
        const adminToggleBtn = document.getElementById('adminToggleBtn');
        if (adminToggle) {
            adminToggle.addEventListener('click', this.toggleAdminDashboard.bind(this));
        }
        if (adminToggleBtn) {
            adminToggleBtn.addEventListener('click', this.toggleAdminDashboard.bind(this));
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
        const previousPage = this.currentPage;

        // Log page navigation
        this.logInteraction('page_navigation', {
            from: previousPage,
            to: pageNumber
        });

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

                // Update session page views
                if (this.voteData.sessions[this.sessionId]) {
                    this.voteData.sessions[this.sessionId].pageViews++;
                    this.saveVoteData();
                }

                setTimeout(() => {
                    this.isTransitioning = false;
                }, 300);
            }, 150);
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

    async handleVote(isYes) {
        const voteValue = isYes ? 'yes' : 'no';
        const userStatus = await this.getUserVoteStatus();

        // Check if user already voted
        if (userStatus.hasVoted) {
            if (userStatus.currentVote === voteValue) {
                // Same vote - show already voted message
                this.showVoteStatus(`You already voted "${isYes ? 'Hell YEAHH!' : 'Naah! I\'ll see tomorrow'}"!`, 'info');
                setTimeout(() => this.goToPage(4), 1000);
                return;
            } else {
                // Different vote - confirm change
                const oldVoteText = userStatus.currentVote === 'yes' ? 'Hell YEAHH!' : 'Naah! I\'ll see tomorrow';
                const newVoteText = isYes ? 'Hell YEAHH!' : 'Naah! I\'ll see tomorrow';
                this.showVoteStatus(`Changed from "${oldVoteText}" to "${newVoteText}"!`, 'change');
                await this.logInteraction('vote_changed', {
                    from: userStatus.currentVote,
                    to: voteValue
                });
            }
        } else {
            // First vote
            this.showVoteStatus(`You voted "${isYes ? 'Hell YEAHH!' : 'Naah! I\'ll see tomorrow'}"!`, 'success');
            await this.logInteraction('first_vote', { vote: voteValue });
        }

        // Add vote to buffer (not directly to counts)
        await this.addToVoteBuffer(voteValue);

        // Button animation
        const button = isYes ? document.getElementById('voteYes') : document.getElementById('voteNo');
        if (button) {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        }

        // Navigate to share page after delay
        setTimeout(() => {
            this.goToPage(4);
        }, 1500);
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

        if (yesCount) yesCount.textContent = this.voteCounts.yes;
        if (noCount) noCount.textContent = this.voteCounts.no;

        const total = this.voteCounts.yes + this.voteCounts.no;
        const yesPercent = total > 0 ? (this.voteCounts.yes / total) * 100 : 50;
        const noPercent = total > 0 ? (this.voteCounts.no / total) * 100 : 50;

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

    // Enhanced Voting System Methods

    generateSessionId() {
        const stored = localStorage.getItem('alumniMatchSessionId');
        if (stored) {
            return stored;
        }

        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('alumniMatchSessionId', newSessionId);
        return newSessionId;
    }

    async initializeSession() {
        try {
            // Check if session exists
            const { data: existingSession } = await this.supabase
                .from('voting_sessions')
                .select('*')
                .eq('session_id', this.sessionId)
                .single();

            if (!existingSession) {
                // Create new session
                const { error } = await this.supabase
                    .from('voting_sessions')
                    .insert({
                        session_id: this.sessionId,
                        user_agent: navigator.userAgent,
                        page_views: 1
                    });

                if (error) {
                    console.error('Error creating session:', error);
                    return;
                }
            } else {
                // Update existing session activity
                const { error } = await this.supabase
                    .from('voting_sessions')
                    .update({
                        last_activity: new Date().toISOString(),
                        page_views: existingSession.page_views + 1
                    })
                    .eq('session_id', this.sessionId);

                if (error) {
                    console.error('Error updating session:', error);
                }
            }

            await this.logInteraction('session_initialized');
        } catch (error) {
            console.error('Error in initializeSession:', error);
        }
    }

    startBufferProcessor() {
        setInterval(() => {
            this.processVoteBuffer();
        }, this.bufferProcessInterval);
    }

    async logInteraction(action, metadata = {}) {
        try {
            const { error } = await this.supabase
                .from('voting_interactions')
                .insert({
                    session_id: this.sessionId,
                    action: action,
                    page: this.currentPage,
                    metadata: {
                        userAgent: navigator.userAgent.substring(0, 100),
                        ...metadata
                    }
                });

            if (error) {
                console.error('Error logging interaction:', error);
            } else {
                console.log('Logged interaction:', action, metadata);
            }
        } catch (error) {
            console.error('Error in logInteraction:', error);
        }
    }

    async addToVoteBuffer(vote) {
        try {
            const { error } = await this.supabase
                .from('vote_buffer')
                .insert({
                    session_id: this.sessionId,
                    vote: vote
                });

            if (error) {
                console.error('Error adding vote to buffer:', error);
            } else {
                await this.logInteraction('vote_buffered', { vote: vote });
                console.log('Vote added to buffer:', { sessionId: this.sessionId, vote: vote });
            }
        } catch (error) {
            console.error('Error in addToVoteBuffer:', error);
        }
    }

    async processVoteBuffer() {
        try {
            // Get unprocessed votes from buffer
            const { data: unprocessedVotes, error: bufferError } = await this.supabase
                .from('vote_buffer')
                .select('*')
                .eq('processed', false);

            if (bufferError) {
                console.error('Error fetching buffer:', bufferError);
                return;
            }

            if (!unprocessedVotes || unprocessedVotes.length === 0) return;

            console.log(`Processing ${unprocessedVotes.length} votes from buffer...`);

            // Process each vote
            for (const bufferEntry of unprocessedVotes) {
                // Get current session data
                const { data: session } = await this.supabase
                    .from('voting_sessions')
                    .select('current_vote')
                    .eq('session_id', bufferEntry.session_id)
                    .single();

                const previousVote = session?.current_vote;

                // Update session with new vote
                const { error: sessionError } = await this.supabase
                    .from('voting_sessions')
                    .update({
                        current_vote: bufferEntry.vote,
                        last_activity: new Date().toISOString()
                    })
                    .eq('session_id', bufferEntry.session_id);

                if (sessionError) {
                    console.error('Error updating session:', sessionError);
                    continue;
                }

                // Update vote counts atomically
                if (previousVote && previousVote !== bufferEntry.vote) {
                    // User changed vote - decrement old, increment new
                    await this.updateVoteCounts(previousVote, -1);
                    await this.updateVoteCounts(bufferEntry.vote, 1);
                } else if (!previousVote) {
                    // New vote - just increment
                    await this.updateVoteCounts(bufferEntry.vote, 1);
                }

                // Mark buffer entry as processed
                const { error: markError } = await this.supabase
                    .from('vote_buffer')
                    .update({
                        processed: true,
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', bufferEntry.id);

                if (markError) {
                    console.error('Error marking vote as processed:', markError);
                }

                // Log the processing
                await this.logInteraction('vote_processed', {
                    vote: bufferEntry.vote,
                    previousVote: previousVote,
                    bufferId: bufferEntry.id
                });
            }

            // Refresh vote counts and update display
            await this.loadVoteData();
            this.updateStatsDisplay();

            console.log('Buffer processed. Current counts:', this.voteCounts);
        } catch (error) {
            console.error('Error in processVoteBuffer:', error);
        }
    }

    async updateVoteCounts(voteType, increment) {
        try {
            // First get current counts
            const { data: currentCounts } = await this.supabase
                .from('vote_counts')
                .select('yes_votes, no_votes')
                .eq('id', 1)
                .single();

            if (!currentCounts) return;

            const column = voteType === 'yes' ? 'yes_votes' : 'no_votes';
            const newValue = Math.max(0, currentCounts[column] + increment);

            const { error } = await this.supabase
                .from('vote_counts')
                .update({
                    [column]: newValue,
                    last_updated: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) {
                console.error(`Error updating ${column}:`, error);
            }
        } catch (error) {
            console.error('Error in updateVoteCounts:', error);
        }
    }

    async loadVoteData() {
        try {
            // Load current vote counts
            const { data: voteCounts, error: countsError } = await this.supabase
                .from('vote_counts')
                .select('*')
                .eq('id', 1)
                .single();

            if (countsError) {
                console.error('Error loading vote counts:', countsError);
                this.voteCounts = { yes: 0, no: 0 };
            } else {
                this.voteCounts = {
                    yes: voteCounts.yes_votes || 0,
                    no: voteCounts.no_votes || 0
                };
            }

            // Update legacy stats for compatibility
            this.stats.votesYes = this.voteCounts.yes;
            this.stats.votesNo = this.voteCounts.no;

            console.log('Vote data loaded:', this.voteCounts);
        } catch (error) {
            console.error('Error in loadVoteData:', error);
            this.voteCounts = { yes: 0, no: 0 };
        }
    }

    async getUserVoteStatus() {
        try {
            const { data: session, error } = await this.supabase
                .from('voting_sessions')
                .select('current_vote, first_visit')
                .eq('session_id', this.sessionId)
                .single();

            if (error) {
                console.error('Error getting user vote status:', error);
                return {
                    hasVoted: false,
                    currentVote: null,
                    voteCount: 0,
                    firstVisit: null
                };
            }

            return {
                hasVoted: session && session.current_vote !== null,
                currentVote: session?.current_vote,
                voteCount: session?.current_vote ? 1 : 0,
                firstVisit: session?.first_visit
            };
        } catch (error) {
            console.error('Error in getUserVoteStatus:', error);
            return {
                hasVoted: false,
                currentVote: null,
                voteCount: 0,
                firstVisit: null
            };
        }
    }

    exportInteractionLog() {
        const exportData = {
            exportedAt: Date.now(),
            totalSessions: Object.keys(this.voteData.sessions).length,
            totalInteractions: this.voteData.interactionLog.length,
            currentCounts: this.voteData.voteCounts,
            sessions: this.voteData.sessions,
            interactions: this.voteData.interactionLog,
            buffer: this.voteData.tempBuffer
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `alumni_match_interactions_${Date.now()}.json`;
        link.click();

        this.logInteraction('data_exported');
        console.log('Interaction data exported');
    }

    showVoteStatus(message, type = 'info') {
        // Remove any existing vote status
        const existing = document.querySelector('.vote-status-notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `vote-status-notification vote-status-${type}`;
        notification.innerHTML = `
            <div class="vote-status-content">
                <div class="vote-status-icon">
                    ${type === 'success' ? '✅' : type === 'change' ? '🔄' : 'ℹ️'}
                </div>
                <div class="vote-status-message">${message}</div>
            </div>
        `;

        // Add to page
        const voteContainer = document.querySelector('.vote-container');
        if (voteContainer) {
            voteContainer.appendChild(notification);

            // Animate in
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);

            // Remove after delay
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }, type === 'info' ? 2000 : 3000);
        }
    }

    // Admin/Debug Methods
    clearAllData() {
        if (confirm('Are you sure you want to clear all voting data? This cannot be undone.')) {
            localStorage.removeItem('alumniMatchVoteData');
            localStorage.removeItem('alumniMatchSessionId');
            localStorage.removeItem('alumniMatchStats');
            location.reload();
        }
    }

    async getSessionInfo() {
        try {
            // Get total session count
            const { count: sessionCount } = await this.supabase
                .from('voting_sessions')
                .select('*', { count: 'exact', head: true });

            // Get total interactions count
            const { count: interactionCount } = await this.supabase
                .from('voting_interactions')
                .select('*', { count: 'exact', head: true });

            // Get buffer info
            const { data: bufferData } = await this.supabase
                .from('vote_buffer')
                .select('processed');

            const bufferSize = bufferData?.length || 0;
            const unprocessedVotes = bufferData?.filter(v => !v.processed).length || 0;

            return {
                sessionId: this.sessionId,
                totalSessions: sessionCount || 0,
                totalInteractions: interactionCount || 0,
                bufferSize: bufferSize,
                unprocessedVotes: unprocessedVotes,
                voteCounts: this.voteCounts
            };
        } catch (error) {
            console.error('Error getting session info:', error);
            return {
                sessionId: this.sessionId,
                totalSessions: 0,
                totalInteractions: 0,
                bufferSize: 0,
                unprocessedVotes: 0,
                voteCounts: this.voteCounts
            };
        }
    }

    // Keyboard shortcuts for admin
    setupAdminShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+E = Export data
            if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.exportInteractionLog();
            }
            // Ctrl+Shift+I = Show session info
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                this.getSessionInfo().then(info => console.table(info));
            }
            // Ctrl+Shift+C = Clear all data
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.clearAllData();
            }
            // Ctrl+Shift+L = Show interaction log
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.supabase
                    .from('voting_interactions')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(20)
                    .then(({ data }) => console.table(data));
            }
        });
    }

    // UI Update Methods
    updateSessionStatusUI() {
        const sessionStatus = document.getElementById('sessionStatus');
        const displaySessionId = document.getElementById('displaySessionId');
        const voteHistory = document.getElementById('voteHistory');

        if (!sessionStatus || !displaySessionId || !voteHistory) return;

        const userStatus = this.getUserVoteStatus();
        const shortSessionId = this.sessionId.split('_').slice(-1)[0];

        displaySessionId.textContent = shortSessionId;

        if (userStatus.hasVoted) {
            const voteText = userStatus.currentVote === 'yes' ? 'Hell YEAHH!' : 'Naah! I\'ll see tomorrow';
            voteHistory.innerHTML = `
                <span class="current-vote">Current Vote: ${voteText}</span>
                <span class="vote-count">(${userStatus.voteCount} ${userStatus.voteCount === 1 ? 'vote' : 'votes'} total)</span>
            `;
            sessionStatus.style.display = 'block';
        } else {
            voteHistory.innerHTML = '<span style="color: rgba(255,255,255,0.6);">No vote yet</span>';
            // Show for debug purposes, hide in production
            sessionStatus.style.display = 'block';
        }
    }

    toggleAdminDashboard() {
        const dashboard = document.getElementById('adminDashboard');
        const toggle = document.getElementById('adminToggle');
        const toggleBtn = document.getElementById('adminToggleBtn');

        if (!dashboard) return;

        const isVisible = dashboard.classList.contains('show');

        if (isVisible) {
            dashboard.classList.remove('show');
            if (toggle) toggle.style.display = 'none';
            if (toggleBtn) toggleBtn.textContent = 'Show Admin';
            document.body.classList.remove('admin-mode');
        } else {
            dashboard.classList.add('show');
            if (toggle) toggle.style.display = 'block';
            if (toggleBtn) toggleBtn.textContent = 'Hide Admin';
            document.body.classList.add('admin-mode');
            this.updateAdminDashboard();
        }

        this.logInteraction('admin_dashboard_toggled', { visible: !isVisible });
    }

    async updateAdminDashboard() {
        const statsContainer = document.getElementById('adminStats');
        const recentInteractions = document.getElementById('recentInteractions');

        if (!statsContainer || !recentInteractions) return;

        try {
            const info = await this.getSessionInfo();

            // Update stats
            statsContainer.innerHTML = `
                <div class="admin-stat">
                    <span class="admin-stat-label">Sessions</span>
                    <span class="admin-stat-value">${info.totalSessions}</span>
                </div>
                <div class="admin-stat">
                    <span class="admin-stat-label">Yes Votes</span>
                    <span class="admin-stat-value">${this.voteCounts.yes}</span>
                </div>
                <div class="admin-stat">
                    <span class="admin-stat-label">No Votes</span>
                    <span class="admin-stat-value">${this.voteCounts.no}</span>
                </div>
                <div class="admin-stat">
                    <span class="admin-stat-label">Buffer</span>
                    <span class="admin-stat-value">${info.unprocessedVotes}</span>
                </div>
                <div class="admin-stat">
                    <span class="admin-stat-label">Interactions</span>
                    <span class="admin-stat-value">${info.totalInteractions}</span>
                </div>
            `;

            // Get recent interactions
            const { data: recentLogs } = await this.supabase
                .from('voting_interactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            // Update recent interactions
            if (recentLogs) {
                recentInteractions.innerHTML = recentLogs.map(log => {
                    const time = new Date(log.created_at).toLocaleTimeString();
                    const shortSession = log.session_id.split('_').slice(-1)[0];
                    return `<div style="margin: 2px 0; padding: 2px 4px; background: rgba(255,255,255,0.1); border-radius: 2px;">
                        [${time}] ${shortSession}: ${log.action}
                    </div>`;
                }).join('');
            }
        } catch (error) {
            console.error('Error updating admin dashboard:', error);
        }
    }

    // Update UI when page changes
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
                if (document.body.classList.contains('admin-mode')) {
                    this.updateAdminDashboard();
                }
                break;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.alumniMatch = new AlumniMatch();
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
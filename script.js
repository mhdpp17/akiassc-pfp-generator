document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const photoInput = document.getElementById('photoInput');
    const photoBtn = document.getElementById('photoBtn');
    
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvasWrapper');
    const placeholderContent = document.getElementById('placeholderContent');
    
    const scaleGroup = document.getElementById('scaleGroup');
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    // Loader Elements
    const loader = document.getElementById('loader');
    const uploadIcon = document.getElementById('uploadIcon');
    const placeholderText = document.getElementById('placeholderText');

    // State
    let frameImage = null;
    let userPhoto = null;
    
    // Photo transformations
    let photoOriginX = 0;
    let photoOriginY = 0;
    let photoScale = 1;
    let photoOffsetX = 0;
    let photoOffsetY = 0;
    let isDragging = false;
    // Render Optimization State
    let isRendering = false;
    let renderRequested = false;
    let lastRenderTime = 0;
    const RENDER_THROTTLE = 16; // ~60fps on mobile
    let startDragX = 0;
    let startDragY = 0;
    
    // Detect mobile for performance optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // --- 1. Load Frame Automatically ---
    function loadFrame() {
        // Show loader
        loader.style.display = 'inline-block';
        uploadIcon.style.display = 'none';
        placeholderText.innerText = 'Loading official frame...';
        
        const img = new Image();
        // Optimize image loading for mobile
        img.decoding = 'async';
        
        img.onload = () => {
            frameImage = img;
            
            // Set virtual resolution to match the frame exactly
            virtualWidth = img.width;
            virtualHeight = img.height;
            
            // Set canvas actual size (high res)
            canvas.width = virtualWidth;
            canvas.height = virtualHeight;
            
            // Apply aspect ratio to container for CSS rendering
            canvasContainer.style.aspectRatio = `${virtualWidth} / ${virtualHeight}`;
            canvasContainer.classList.add('has-frame');
            
            // Hide loader text "Upload your photo to begin", show regular prompt if no photo yet
            if (!userPhoto) {
                loader.style.display = 'none';
                uploadIcon.style.display = 'inline-block';
                placeholderText.innerText = 'Upload your photo to begin';
            }
            
            render();
        };
        img.loading = 'lazy';
        img.src = 'frame.png'; // Load from same directory
    }
    
    // Initialize frame loading on startup
    loadFrame();

    // --- 2. Handle Photo Upload ---
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show loading state for photo parsing
        placeholderContent.style.display = 'flex';
        placeholderContent.style.opacity = '1';
        loader.style.display = 'inline-block';
        uploadIcon.style.display = 'none';
        placeholderText.innerText = 'Processing your photo...';

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.decoding = 'async';
            
            img.onload = () => {
                userPhoto = img;
                
                // Reset transformations when new photo is loaded
                photoScale = 1;
                photoOffsetX = 0;
                photoOffsetY = 0;
                scaleSlider.value = 100;
                scaleValue.innerText = '100%';
                
                // Calculate initial scale to cover the frame area (mimic object-fit: cover)
                const scaleX = virtualWidth / img.width;
                const scaleY = virtualHeight / img.height;
                photoScale = Math.max(scaleX, scaleY);
                
                // Center the image initially
                photoOriginX = (virtualWidth - (img.width * photoScale)) / 2;
                photoOriginY = (virtualHeight - (img.height * photoScale)) / 2;
                
                // Enable controls
                scaleGroup.style.display = 'block';
                downloadBtn.removeAttribute('disabled');
                
                // Hide placeholder when photo is uploaded
                placeholderContent.style.opacity = '0';
                setTimeout(() => {
                    placeholderContent.style.display = 'none';
                }, 300);

                resetBtn.style.display = 'flex';
                
                render();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- 3. Render Loop ---
    function render() {
        if (!frameImage) return;

        // Set rendering flag
        isRendering = true;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Setup smoothing - optimize for mobile
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = isMobile ? 'medium' : 'high';

        // 3a. Draw User Photo (Behind)
        if (userPhoto) {
            const finalWidth = userPhoto.width * photoScale;
            const finalHeight = userPhoto.height * photoScale;
            const finalX = photoOriginX + photoOffsetX;
            const finalY = photoOriginY + photoOffsetY;
            
            ctx.drawImage(userPhoto, finalX, finalY, finalWidth, finalHeight);
        }

        // 3b. Draw Frame (On top)
        ctx.drawImage(frameImage, 0, 0, virtualWidth, virtualHeight);
        
        isRendering = false;
        if (renderRequested) {
            renderRequested = false;
            requestAnimationFrame(render);
        }
    }
    
    function queueRender() {
        // Throttle renders during drag to prevent excessive reflows
        const now = performance.now();
        if (now - lastRenderTime >= RENDER_THROTTLE) {
            lastRenderTime = now;
            if (!isRendering) {
                renderRequested = false;
                requestAnimationFrame(render);
            } else {
                renderRequested = true;
            }
        }
    }

    // --- 4. Controls & Interactions ---

    // Slider
    scaleSlider.addEventListener('input', (e) => {
        // Base scale * multiplier from slider (50% to 300%)
        const multiplier = e.target.value / 100;
        
        // Recalculate base scale
        if (userPhoto) {
            const scaleX = virtualWidth / userPhoto.width;
            const scaleY = virtualHeight / userPhoto.height;
            const baseScale = Math.max(scaleX, scaleY);
            
            // Adjust offset to zoom toward center (basic implementation)
            const oldWidth = userPhoto.width * photoScale;
            const oldHeight = userPhoto.height * photoScale;
            
            photoScale = baseScale * multiplier;
            
            const newWidth = userPhoto.width * photoScale;
            const newHeight = userPhoto.height * photoScale;
            
            // Adjust offsets to keep roughly centered on zoom
            photoOffsetX -= (newWidth - oldWidth) / 2;
            photoOffsetY -= (newHeight - oldHeight) / 2;
            
            scaleValue.innerText = `${e.target.value}%`;
            queueRender();
        }
    });

    // Mouse/Touch Dragging
    function getEventPos(e) {
        // Find canvas bounds
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        // Handle touch events vs mouse events
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    const startDrag = (e) => {
        if (!userPhoto) return;
        isDragging = true;
        
        // For touch devices, prevent default scrolling behavior when grabbing canvas
        if (e.type === 'touchstart') {
            e.preventDefault();
        }
        
        const pos = getEventPos(e);
        startDragX = pos.x;
        startDragY = pos.y;
        canvas.style.cursor = 'grabbing';
    };

    const doDrag = (e) => {
        if (!isDragging || !userPhoto) return;
        
        // Only prevent default for touch events
        if (e.touches || e.changedTouches) {
            e.preventDefault();
        }
        
        const pos = getEventPos(e);
        
        // Calculate raw pixel difference on screen
        const screenDx = pos.x - startDragX;
        const screenDy = pos.y - startDragY;
        
        // The canvas is scaled via CSS. We need to translate those screen pixels 
        // back to our high-res virtual canvas coordinates.
        const rect = canvas.getBoundingClientRect();
        const scaleX = virtualWidth / rect.width;
        const scaleY = virtualHeight / rect.height;
        
        const virtualDx = screenDx * scaleX;
        const virtualDy = screenDy * scaleY;
        
        photoOffsetX += virtualDx;
        photoOffsetY += virtualDy;
        
        // Update purely based on previous screen position
        startDragX = pos.x;
        startDragY = pos.y;
        
        queueRender(); 
    };

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        if (userPhoto) canvas.style.cursor = 'grab';
    };

    // Mouse Events
    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag, { passive: true });
    window.addEventListener('mouseup', endDrag, { passive: true });

    // Touch Events - non-passive for preventDefault in doDrag
    canvas.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', endDrag, { passive: true });
    window.addEventListener('touchcancel', endDrag, { passive: true });

    // --- 5. Download & Reset ---
    downloadBtn.addEventListener('click', () => {
        if (!frameImage || !userPhoto) return;
        
        // Create an invisible high-res canvas for final export if needed
        // Since we already draw at native virtualWidth/virtualHeight, 
        // we can just export the current canvas directly!
        
        const dataURL = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `dp-generator-${Date.now()}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    resetBtn.addEventListener('click', () => {
        // Reset state
        userPhoto = null;
        photoScale = 1;
        photoOffsetX = 0;
        photoOffsetY = 0;
        
        // Reset UI
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redraw frame only
        render();
        
        // Show default placeholder prompt again
        loader.style.display = 'none';
        uploadIcon.style.display = 'inline-block';
        placeholderText.innerText = 'Upload your photo to begin';
        
        placeholderContent.style.display = 'flex';
        setTimeout(() => placeholderContent.style.opacity = '1', 10);
        
        photoInput.value = '';
        
        scaleGroup.style.display = 'none';
        downloadBtn.setAttribute('disabled', 'true');
        resetBtn.style.display = 'none';
    });
});

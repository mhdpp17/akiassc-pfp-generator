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
    let startDragX = 0;
    let startDragY = 0;
    
    // Virtual resolution (we edit at the frame's native resolution for quality)
    let virtualWidth = 0;
    let virtualHeight = 0;

    // --- 1. Load Frame Automatically ---
    function loadFrame() {
        const img = new Image();
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
            
            // Hide placeholder text "Upload your photo to begin"
            // We want it to show so user knows to upload, but we'll fade it if needed later when photo uploads
            
            render();
        };
        img.src = 'frame.png'; // Load from same directory
    }
    
    // Initialize frame loading on startup
    loadFrame();

    // --- 2. Handle Photo Upload ---
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
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

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Setup smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

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
            render();
        }
    });

    // Mouse/Touch Dragging
    function getEventPos(e, canvasElem) {
        const rect = canvasElem.getBoundingClientRect();
        
        // Handle touch and mouse events uniformly
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Calculate position relative to the ACTUAL canvas DOM element bounds
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // Map to internal virtual resolution
        const scaleX = virtualWidth / rect.width;
        const scaleY = virtualHeight / rect.height;
        
        return {
            x: x * scaleX,
            y: y * scaleY
        };
    }

    const startDrag = (e) => {
        if (!userPhoto) return;
        isDragging = true;
        const pos = getEventPos(e, canvas);
        startDragX = pos.x;
        startDragY = pos.y;
        canvas.style.cursor = 'grabbing';
    };

    const doDrag = (e) => {
        if (!isDragging || !userPhoto) return;
        e.preventDefault(); // Prevent scrolling on touch devices
        
        const pos = getEventPos(e, canvas);
        const dx = pos.x - startDragX;
        const dy = pos.y - startDragY;
        
        photoOffsetX += dx;
        photoOffsetY += dy;
        
        startDragX = pos.x;
        startDragY = pos.y;
        
        render(); // Immediately render
    };

    const endDrag = () => {
        isDragging = false;
        if(userPhoto) canvas.style.cursor = 'grab';
    };

    // Mouse Events
    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);

    // Touch Events
    canvas.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', endDrag);

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
        
        placeholderContent.style.display = 'block';
        setTimeout(() => placeholderContent.style.opacity = '1', 10);
        
        photoInput.value = '';
        
        scaleGroup.style.display = 'none';
        downloadBtn.setAttribute('disabled', 'true');
        resetBtn.style.display = 'none';
    });
});

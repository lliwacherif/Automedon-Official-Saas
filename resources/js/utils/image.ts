/**
 * Compress an image file using HTML5 Canvas
 * @param file Source file
 * @param maxWidth Maximum width (default 1920)
 * @param maxHeight Maximum height (default 1920)
 * @param quality Quality (0 to 1, default 0.8)
 */
export const compressImage = async (
    file: File,
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8
): Promise<File> => {
    // Only compress images
    if (!file.type.match(/image.*/)) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Image compression failed'));
                            return;
                        }

                        // Create new file
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg', // Always convert to JPEG for consistency
                            lastModified: Date.now(),
                        });

                        resolve(newFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

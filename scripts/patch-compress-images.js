const fs = require('fs');
let code = fs.readFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', 'utf8');

// Replace handleAddPhotos with compressed version
const oldHandler = `    const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setSiteVisitPhotos(prev => {
                    const nextNum = String(prev.length + 1).padStart(2, '0');
                    return [
                        ...prev,
                        {
                            id: \`photo-\${Date.now()}-\${index}-\${Math.random().toString(36).substring(2, 5)}\`,
                            photoNumber: nextNum,
                            url: dataUrl,
                            caption: '',
                            elevation: elevations[0]?.name || ''
                        }
                    ];
                });
            };
            reader.readAsDataURL(file);
        });
    };`;

const newHandler = `    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1200;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        // Compress to JPEG with 0.75 quality (~80-120 KB)
                        const compressed = canvas.toDataURL('image/jpeg', 0.75);
                        resolve(compressed);
                    } else {
                        resolve(e.target?.result as string);
                    }
                };
                img.onerror = () => resolve(e.target?.result as string);
                img.src = e.target?.result as string;
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    };

    const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const dataUrl = await compressImage(file);
            setSiteVisitPhotos(prev => {
                const nextNum = String(prev.length + 1).padStart(2, '0');
                return [
                    ...prev,
                    {
                        id: \`photo-\${Date.now()}-\${i}-\${Math.random().toString(36).substring(2, 5)}\`,
                        photoNumber: nextNum,
                        url: dataUrl,
                        caption: '',
                        elevation: elevations[0]?.name || ''
                    }
                ];
            });
        }
    };`;

const normOld = oldHandler.replace(/\r\n/g, '\n');
const normCode = code.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
    code = normCode.replace(normOld, newHandler.replace(/\r\n/g, '\n'));
    fs.writeFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', code, 'utf8');
    console.log('compressImage and handleAddPhotos updated successfully!');
} else {
    console.error('Target oldHandler not found in AeroWashQuoteBuilder.tsx');
}

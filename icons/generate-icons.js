const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function generateIcon(size) {
    canvas.width = size;
    canvas.height = size;
    
    // 背景
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, size, size);
    
    // 文字
    ctx.fillStyle = 'white';
    ctx.font = `${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('{ }', size/2, size/2);
    
    return canvas.toDataURL('image/png');
}

// 生成不同尺寸的图标
[16, 48, 128].forEach(size => {
    const link = document.createElement('a');
    link.download = `icon${size}.png`;
    link.href = generateIcon(size);
    link.click();
});

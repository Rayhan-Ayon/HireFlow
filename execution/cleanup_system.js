/**
 * System Cleanup Script
 * Removes unnecessary files and optimizes performance
 */

const fs = require('fs').promises;
const path = require('path');

async function cleanupSystem() {
    console.log('🧹 Starting system cleanup...\n');

    const rootDir = path.join(__dirname, '..');
    let totalCleaned = 0;

    // 1. Clean .wwebjs_cache
    try {
        const cacheDir = path.join(rootDir, '.wwebjs_cache');
        const files = await fs.readdir(cacheDir);
        for (const file of files) {
            await fs.unlink(path.join(cacheDir, file));
            totalCleaned++;
        }
        console.log(`✅ Cleaned ${files.length} cache files from .wwebjs_cache`);
    } catch (err) {
        console.log('⚠️  .wwebjs_cache already clean or not found');
    }

    // 2. Clean .tmp directory (keep structure)
    try {
        const tmpDir = path.join(rootDir, '.tmp');
        const files = await fs.readdir(tmpDir);
        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile() && file !== '.gitkeep') {
                await fs.unlink(filePath);
                totalCleaned++;
            }
        }
        console.log(`✅ Cleaned .tmp directory`);
    } catch (err) {
        console.log('⚠️  .tmp already clean or not found');
    }

    // 3. Remove debug files
    const debugFiles = ['debug_oauth.txt', 'test_resume.txt'];
    for (const file of debugFiles) {
        try {
            await fs.unlink(path.join(rootDir, file));
            console.log(`✅ Removed ${file}`);
            totalCleaned++;
        } catch (err) {
            // File doesn't exist, skip
        }
    }

    // 4. Clean old uploads (optional - keep last 5)
    try {
        const uploadsDir = path.join(rootDir, 'uploads');
        const files = await fs.readdir(uploadsDir);
        const fileStats = await Promise.all(
            files.map(async (file) => ({
                name: file,
                time: (await fs.stat(path.join(uploadsDir, file))).mtime.getTime()
            }))
        );

        fileStats.sort((a, b) => b.time - a.time);
        const toDelete = fileStats.slice(5); // Keep only 5 most recent

        for (const file of toDelete) {
            await fs.unlink(path.join(uploadsDir, file.name));
            totalCleaned++;
        }

        if (toDelete.length > 0) {
            console.log(`✅ Cleaned ${toDelete.length} old uploads`);
        }
    } catch (err) {
        console.log('⚠️  Uploads directory clean');
    }

    console.log(`\n✨ Cleanup complete! Removed ${totalCleaned} files`);
    console.log('💡 Tip: Restart your browser for best performance');
}

cleanupSystem().catch(console.error);

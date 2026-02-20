#!/usr/bin/env node

/**
 * Script to populate the question cache database
 * Generates and stores one question for each AP class and unit combination
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const questionCache = require('../services/questionCache');
const connectDb = require('../config/dbConn');

// Load AP classes data
const apClassesPath = path.join(__dirname, '..', 'data', 'ap-classes.json');
let apClassesData;

try {
    const data = fs.readFileSync(apClassesPath, 'utf8');
    apClassesData = JSON.parse(data);
} catch (error) {
    console.error('Failed to load AP classes data:', error.message);
    process.exit(1);
}

// Configuration
const PROVIDER = process.env.PROVIDER || 'openai'; // Use 'openai' by default for quality
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay to avoid rate limits
const MAX_CONCURRENT = 3; // Maximum concurrent requests

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate questions with rate limiting
async function generateQuestionsWithRateLimit(tasks) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
        const batch = tasks.slice(i, i + MAX_CONCURRENT);
        
        const batchPromises = batch.map(async (task) => {
            try {
                console.log(`[${task.index}/${tasks.length}] Generating: ${task.className} - ${task.unit}`);
                const result = await questionCache.generateAndStoreQuestion(
                    task.className,
                    task.unit,
                    PROVIDER
                );
                console.log(`  ✓ Success: ${task.className} - ${task.unit}`);
                return { success: true, task };
            } catch (error) {
                console.error(`  ✗ Failed: ${task.className} - ${task.unit}: ${error.message}`);
                return { success: false, task, error: error.message };
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(r => {
            if (r.success) results.push(r.task);
            else errors.push(r);
        });
        
        // Delay between batches (except for the last one)
        if (i + MAX_CONCURRENT < tasks.length) {
            console.log(`  Waiting ${DELAY_BETWEEN_REQUESTS}ms before next batch...\n`);
            await sleep(DELAY_BETWEEN_REQUESTS);
        }
    }
    
    return { results, errors };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Question Cache Population Script');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Provider: ${PROVIDER}`);
    console.log(`Max Concurrent: ${MAX_CONCURRENT}`);
    console.log(`Delay Between Batches: ${DELAY_BETWEEN_REQUESTS}ms`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect to database
    try {
        await connectDb();
        console.log('✓ Connected to MongoDB\n');
    } catch (error) {
        console.error('✗ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }

    // Build list of all class/unit combinations
    const tasks = [];
    let taskIndex = 1;

    if (!apClassesData || !apClassesData.courses) {
        console.error('Invalid AP classes data structure');
        process.exit(1);
    }

    for (const course of apClassesData.courses) {
        const className = course.name;
        const allUnits = [...(course.semester1 || []), ...(course.semester2 || [])];
        
        if (allUnits.length === 0) {
            console.warn(`⚠ Skipping ${className} - no units found`);
            continue;
        }

        // Generate for each unit
        for (const unit of allUnits) {
            tasks.push({
                index: taskIndex++,
                className,
                unit
            });
        }
    }

    console.log(`Found ${tasks.length} class/unit combinations to cache\n`);
    
    const startTime = Date.now();
    const { results, errors } = await generateQuestionsWithRateLimit(tasks);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Tasks: ${tasks.length}`);
    console.log(`Successful: ${results.length}`);
    console.log(`Failed: ${errors.length}`);
    console.log(`Duration: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (errors.length > 0) {
        console.log('Failed tasks:');
        errors.forEach(({ task, error }) => {
            console.log(`  - ${task.className} - ${task.unit}: ${error}`);
        });
        console.log('');
    }

    // Get final cache stats
    try {
        const stats = await questionCache.getCacheStats();
        console.log('Cache Statistics:');
        console.log(`Total cached questions: ${stats.total}`);
        console.log('\nBy class:');
        stats.byClass.forEach(({ _id, count }) => {
            console.log(`  ${_id}: ${count} questions`);
        });
    } catch (error) {
        console.error('Failed to get cache stats:', error.message);
    }

    console.log('\n✓ Cache population complete!');
    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

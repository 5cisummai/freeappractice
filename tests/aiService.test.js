const path = require('path');
const fs = require('fs');
const { getUnitContextData, selectModelForClass } = require('../services/aiService');

describe('aiService helpers', () => {
    test('getUnitContextData returns null for missing class or unit', () => {
        expect(getUnitContextData()).toBeNull();
        expect(getUnitContextData('AP Calculus AB')).toBeNull();
        expect(getUnitContextData('', 'Unit 1')).toBeNull();
    });

    test('getUnitContextData pulls data from revised descriptions', () => {
        // pick a known class/unit that exists in the JSON
        const data = getUnitContextData('AP Calculus AB', 'Unit 1');
        expect(data).not.toBeNull();
        expect(data).toHaveProperty('description');
        expect(Array.isArray(data.topics)).toBe(true);
    });

    test('selectModelForClass prefers GPT-4 for humanities courses', () => {
        expect(selectModelForClass('AP US History')).toBe('gpt-4.1-mini');
        expect(selectModelForClass('AP Computer Science Principles')).toBe('gpt-4.1-mini');
        expect(selectModelForClass('AP Biology')).toBe('gpt-5-mini');
    });
});
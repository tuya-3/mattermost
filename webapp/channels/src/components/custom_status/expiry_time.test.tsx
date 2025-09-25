// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Import Japanese translation to verify our fix
import {langFiles} from 'i18n/imports';

describe('components/custom_status/expiry_time - Japanese translation fix', () => {
    describe('Japanese translation improvement', () => {
        it('should have natural Japanese translation without space before まで', () => {
            // Get the Japanese messages
            const jaMessages = langFiles.ja;
            
            // Verify the translation key exists and has the corrected value
            expect(jaMessages).toBeDefined();
            expect(jaMessages['custom_status.expiry.until']).toBeDefined();
            
            // The fix: should be "{time}まで" (no space) instead of "{time} まで" (with space)
            expect(jaMessages['custom_status.expiry.until']).toBe('{time}まで');
            
            // Ensure it doesn't have the old unnatural format with space
            expect(jaMessages['custom_status.expiry.until']).not.toBe('{time} まで');
        });

        it('should demonstrate the improvement with example text', () => {
            const jaMessages = langFiles.ja;
            const translation = jaMessages['custom_status.expiry.until'];
            
            // Example: How "Today" would be displayed
            const todayInJapanese = '今日';
            const result = translation.replace('{time}', todayInJapanese);
            
            // Should produce natural "今日まで" instead of unnatural "今日 まで"
            expect(result).toBe('今日まで');
            expect(result).not.toContain(' まで'); // No space before まで
            
            // Test with other common time expressions
            const tomorrowResult = translation.replace('{time}', '明日');
            expect(tomorrowResult).toBe('明日まで');
            
            const fridayResult = translation.replace('{time}', '金曜日');
            expect(fridayResult).toBe('金曜日まで');
            
            // Test with custom date format  
            const customDateResult = translation.replace('{time}', '2024年12月25日');
            expect(customDateResult).toBe('2024年12月25日まで');
        });

        it('should provide comparison with the old translation format', () => {
            const jaMessages = langFiles.ja;
            const newTranslation = jaMessages['custom_status.expiry.until'];
            const oldTranslation = '{time} まで'; // What it was before (with space)
            
            // Demonstrate the improvement
            const sampleTime = '今日'; // "Today" in Japanese
            const oldResult = oldTranslation.replace('{time}', sampleTime); // "今日 まで" (unnatural)
            const newResult = newTranslation.replace('{time}', sampleTime); // "今日まで" (natural)
            
            expect(oldResult).toBe('今日 まで'); // Unnatural with space
            expect(newResult).toBe('今日まで'); // Natural without space
            
            // Confirm the improvement
            expect(newResult).not.toBe(oldResult); // Changed
            expect(newResult).not.toContain(' まで'); // No space before まで
        });
    });
});
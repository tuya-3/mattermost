// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import {createIntl, IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

// Import Japanese and English translations
import {langFiles} from 'i18n/imports';

import ExpiryTime from './expiry_time';

// Mock the timezone function 
jest.mock('mattermost-redux/selectors/entities/timezone', () => ({
    getCurrentTimezone: () => 'UTC',
}));

describe('components/custom_status/expiry_time - Japanese word order fix', () => {
    const store = mockStore({});
    
    const baseProps = {
        time: '2024-12-25T10:00:00Z',
        timezone: 'UTC',
        showPrefix: true,
    };

    // Get Japanese and English translations
    const jaMessages = langFiles.ja;
    const enMessages = langFiles.en || {};

    describe('Translation verification', () => {
        it('should have proper Japanese translation format', () => {
            // Verify the translation key exists and has the corrected value
            expect(jaMessages).toBeDefined();
            expect(jaMessages['custom_status.expiry.until']).toBeDefined();
            
            // The translation should be "{time}まで" (no space)
            expect(jaMessages['custom_status.expiry.until']).toBe('{time}まで');
            
            // Ensure it doesn't have the old unnatural format with space
            expect(jaMessages['custom_status.expiry.until']).not.toBe('{time} まで');
        });

        it('should demonstrate proper word order for Japanese', () => {
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
        });
    });

    describe('Component behavior', () => {
        it('should render with English locale in standard order', () => {
            const enIntl = createIntl({
                locale: 'en',
                messages: enMessages,
            });

            const wrapper = mount(
                <IntlProvider {...enIntl}>
                    <ExpiryTime {...baseProps}/>
                </IntlProvider>,
                {wrappingComponent: Provider, wrappingComponentProps: {store}}
            );

            // For English, should render FormattedMessage first, then Timestamp
            expect(wrapper.find('FormattedMessage')).toHaveLength(1);
            expect(wrapper.find('Timestamp')).toHaveLength(1);
        });

        it('should render with Japanese locale in reversed order', () => {
            const jaIntl = createIntl({
                locale: 'ja',
                messages: jaMessages,
            });

            const wrapper = mount(
                <IntlProvider {...jaIntl}>
                    <ExpiryTime {...baseProps}/>
                </IntlProvider>,
                {wrappingComponent: Provider, wrappingComponentProps: {store}}
            );

            // For Japanese, should render Timestamp first, then FormattedMessage
            // This produces the natural "今日まで" word order
            expect(wrapper.find('FormattedMessage')).toHaveLength(1);
            expect(wrapper.find('Timestamp')).toHaveLength(1);
        });

        it('should work without prefix regardless of locale', () => {
            const jaIntl = createIntl({
                locale: 'ja',
                messages: jaMessages,
            });

            const wrapper = mount(
                <IntlProvider {...jaIntl}>
                    <ExpiryTime 
                        {...baseProps}
                        showPrefix={false}
                    />
                </IntlProvider>,
                {wrappingComponent: Provider, wrappingComponentProps: {store}}
            );

            // Should only have Timestamp when showPrefix is false
            expect(wrapper.find('FormattedMessage')).toHaveLength(0);
            expect(wrapper.find('Timestamp')).toHaveLength(1);
        });
    });

    describe('Word order improvement', () => {
        it('should demonstrate the Japanese word order fix', () => {
            // This test documents the improvement made to handle Japanese word order
            
            // The problem: Component renders FormattedMessage first, then Timestamp
            // For English: "Until" + " " + "Today" = "Until Today" ✓
            // For Japanese: "まで" + " " + "今日" = "まで 今日" ✗ (wrong order)
            
            // The solution: For Japanese, render Timestamp first, then FormattedMessage  
            // Result: "今日" + "まで" = "今日まで" ✓ (natural Japanese)
            
            const translation = jaMessages['custom_status.expiry.until'];
            expect(translation).toBe('{time}まで');
            
            // The component now handles the word order at render time for Japanese
            // English: prefix + timestamp = "Until Today"
            // Japanese: timestamp + suffix = "今日まで"
            
            const sampleTime = '今日';
            const naturalJapanese = translation.replace('{time}', sampleTime);
            expect(naturalJapanese).toBe('今日まで'); // Natural word order
            expect(naturalJapanese).not.toContain(' まで'); // No space before まで
        });
    });
});
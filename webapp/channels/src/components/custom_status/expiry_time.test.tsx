// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {render, screen} from 'tests/react_testing_utils';

import ExpiryTime from './expiry_time';

// Mock Timestamp component
jest.mock('components/timestamp', () => {
    return function MockTimestamp(props: any) {
        if (props.ranges && props.ranges.includes('today')) {
            return <span data-testid="timestamp">今日</span>;
        }
        return <span data-testid="timestamp">Tomorrow</span>;
    };
});

describe('ExpiryTime', () => {
    const baseProps = {
        time: '2023-12-25T23:59:59.000Z',
        timezone: 'UTC',
    };

    const renderWithIntl = (component: React.ReactElement, locale = 'en', messages = {}) => {
        const defaultMessages = {
            'custom_status.expiry.until': 'Until {time}',
            ...messages,
        };

        return render(
            <IntlProvider locale={locale} messages={defaultMessages}>
                {component}
            </IntlProvider>
        );
    };

    it('should render with prefix in English', () => {
        renderWithIntl(<ExpiryTime {...baseProps} />);
        
        expect(screen.getByText(/until/i)).toBeInTheDocument();
        expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });

    it('should render with Japanese translation in correct order', () => {
        const japaneseMessages = {
            'custom_status.expiry.until': '{time} まで',
        };

        renderWithIntl(
            <ExpiryTime {...baseProps} />,
            'ja',
            japaneseMessages
        );
        
        // The timestamp should be rendered within the FormattedMessage
        expect(screen.getByTestId('timestamp')).toBeInTheDocument();
        expect(screen.getByText(/まで/)).toBeInTheDocument();
    });

    it('should render without prefix when showPrefix is false', () => {
        renderWithIntl(
            <ExpiryTime {...baseProps} showPrefix={false} />
        );
        
        expect(screen.queryByText(/until/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });

    it('should render with brackets when withinBrackets is true', () => {
        const {container} = renderWithIntl(
            <ExpiryTime {...baseProps} withinBrackets={true} />
        );
        
        expect(container.textContent).toMatch(/^\(.*\)$/);
    });
});
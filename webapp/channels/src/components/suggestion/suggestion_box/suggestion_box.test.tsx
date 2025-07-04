// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {act} from 'react-dom/test-utils';

import {renderWithContext, screen, userEvent, waitFor, fireEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SuggestionBox from './suggestion_box';

import AtMentionProvider from '../at_mention_provider';
import type {ResultsCallback} from '../provider';
import Provider from '../provider';
import SuggestionList from '../suggestion_list';

jest.mock('utils/utils', () => ({
    ...jest.requireActual('utils/utils'),
    getSuggestionBoxAlgn() {
        return {
            pixelsToMoveX: 0,
            pixelsToMoveY: 0,
        };
    },
}));

function TestWrapper(props: React.ComponentPropsWithoutRef<typeof SuggestionBox>) {
    // eslint-disable-next-line react/prop-types
    const [value, setValue] = useState(props.value);

    const handleChange = useCallback((e) => {
        
        setValue(e.target.value);
    }, []);

    return (
        <SuggestionBox
            {...props}
            onChange={handleChange}
            value={value}
        />
    );
}

const TestSuggestion = React.forwardRef<HTMLDivElement, {term: string}>((props, ref) => {
    return <div ref={ref}>{'Suggestion: ' + props.term}</div>;
});

class TestProvider extends Provider {
    private repeatResults: boolean;

    constructor(repeatResults = false) {
        super();

        this.repeatResults = repeatResults;
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<string>) {
        if (pretext.trim().length === 0) {
            return false;
        }

        const terms = [pretext + pretext];
        
        // Always call the callback with results
        setTimeout(() => {
            resultCallback({
                matchedPretext: pretext,
                terms,
                items: terms,
                component: TestSuggestion,
            });
        }, 0);

        if (this.repeatResults) {
            setTimeout(() => {
                resultCallback({
                    matchedPretext: pretext,
                    terms,
                    items: terms,
                    component: TestSuggestion,
                });
            }, 10);
        }

        return true;
    }
}

describe('SuggestionBox', () => {
    function makeBaseProps(): React.ComponentProps<typeof SuggestionBox> {
        return {
            listComponent: SuggestionList,
            value: '',
            providers: [],
            actions: {
                addMessageIntoHistory: jest.fn(),
            },
            placeholder: 'test input',
        };
    }

    test('should list suggestions based on typed text', async () => {
        const provider = new TestProvider();
        const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

        const {getByPlaceholderText} = renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        // Start with no suggestions rendered
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        const input = getByPlaceholderText('test input');
        
        // Focus the input to set focused state to true
        act(() => {
            fireEvent.focus(input);
        });
        
        // Type text to trigger suggestions
        act(() => {
            fireEvent.change(input, {target: {value: 'test'}});
            fireEvent.input(input, {target: {value: 'test'}});
        });

        // Wait for debouncing to complete (100ms + buffer)
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        await waitFor(() => {
            expect(providerSpy).toHaveBeenCalledTimes(1);
        }, {timeout: 2000});

        // Wait for suggestions to be processed and rendered
        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
        }, {timeout: 1000});

        expect(screen.getByText('Suggestion: testtest')).toBeVisible();

        // Typing more text should cause the suggestion to be updated
        act(() => {
            fireEvent.change(input, {target: {value: 'testwords'}});
            fireEvent.input(input, {target: {value: 'testwords'}});
        });

        // Wait for debouncing again
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        await waitFor(() => {
            expect(providerSpy).toHaveBeenCalledTimes(2);
        }, {timeout: 2000});

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testwordstestwords')).toBeVisible();
        }, {timeout: 1000});

        // Clearing the textbox hides all suggestions
        await userEvent.clear(screen.getByPlaceholderText('test input'));

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('should hide suggestions on pressing escape', async () => {
        const provider = new TestProvider();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        // Start with no suggestions rendered
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        const input = screen.getByPlaceholderText('test input');
        
        // Focus and type text to show suggestions
        act(() => {
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'test'}});
            fireEvent.input(input, {target: {value: 'test'}});
        });

        // Wait for debouncing and suggestions to appear
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeVisible();
        }, {timeout: 1000});

        // Pressing escape hides all suggestions
        act(() => {
            fireEvent.keyDown(input, {key: 'Escape', code: 'Escape'});
        });

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        }, {timeout: 500});
    });

    test('should autocomplete suggestions by pressing enter', async () => {
        const provider = new TestProvider();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        const input = screen.getByPlaceholderText('test input');
        
        // Focus and type text to show suggestions
        act(() => {
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'test'}});
            fireEvent.input(input, {target: {value: 'test'}});
        });

        // Wait for debouncing and suggestions to appear
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testtest')).toBeVisible();
        }, {timeout: 1000});

        // Pressing enter should update the textbox value and hide the suggestion list
        act(() => {
            fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('test input')).toHaveValue('testtest ');
        }, {timeout: 1000});

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('MM-57320 completing text with enter and calling resultCallback twice should not erase text following caret', async () => {
        const provider = new TestProvider(true);
        const onSuggestionsReceived = jest.fn();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
                onSuggestionsReceived={onSuggestionsReceived}
            />,
        );

        userEvent.click(screen.getByPlaceholderText('test input'));
        await userEvent.keyboard('This is important');

        // The provider will send results to the SuggestionBox twice to simulate loading results from the server
        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(2);
        });

        onSuggestionsReceived.mockClear();

        expect(screen.getByPlaceholderText('test input')).toHaveValue('This is important');
        expect(screen.getByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: This is importantThis is important')).toBeVisible();

        // Move the caret back to the start of the textbox and then use escape to clear the suggestions because
        // we don't support moving the caret with the autocomplete open yet
        await userEvent.keyboard('{home}{escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Type a space and then start typing something again to show results
        onSuggestionsReceived.mockClear();

        await userEvent.keyboard('@us');

        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(2);
        });

        expect(screen.getByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: @us@us')).toBeVisible();

        onSuggestionsReceived.mockClear();

        // Type some more and then hit enter before the second set of results is received
        await userEvent.keyboard('e{enter}');

        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');

        // Wait for the second set of results has been received to ensure the contents of the textbox aren't lost
        await new Promise((resolve) => setTimeout(resolve, 20));

        // expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');
    });

    test('keyboard support and ARIA', async () => {
        const channelId = 'channelId';
        const userA = TestHelper.getUserMock({id: 'userA', username: 'apple'});
        const userB = TestHelper.getUserMock({id: 'userB', username: 'banana'});

        const provider = new AtMentionProvider({
            autocompleteGroups: null,
            autocompleteUsersInChannel: jest.fn().mockResolvedValue({data: []}),
            priorityProfiles: [],
            channelId: 'channelId',
            currentUserId: 'currentUserId',
            searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
            useChannelMentions: false,
        });

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
            {
                entities: {
                    users: {
                        profilesInChannel: {
                            [channelId]: new Set([userA.id, userB.id]),
                        },
                        profiles: {
                            [userA.id]: userA,
                            [userB.id]: userB,
                        },
                    },
                },
            },
        );

        const input = screen.getByPlaceholderText('test input');
        
        // Focus the input first
        act(() => {
            fireEvent.focus(input);
        });

        // Start without showing the autocomplete list
        expect(input).toHaveAttribute('aria-autocomplete', 'list');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();

        // Type something that shouldn't trigger the autocomplete
        act(() => {
            fireEvent.change(input, {target: {value: 'Test '}});
            fireEvent.input(input, {target: {value: 'Test '}});
        });

        // Wait for debouncing
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        // The autocomplete still shouldn't be visible
        expect(input).toHaveAttribute('aria-autocomplete', 'list');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();

        // Type an at sign to trigger the user autocomplete
        act(() => {
            fireEvent.change(input, {target: {value: 'Test @'}});
            fireEvent.input(input, {target: {value: 'Test @'}});
        });

        // Wait for debouncing and suggestions to appear
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
        });

        await waitFor(() => {
            expect(input).toHaveAttribute('aria-expanded', 'true');
        }, {timeout: 1000});

        // Ensure that the input is correctly linked to the suggestion list
        expect(document.getElementById(input.getAttribute('aria-controls')!)).toBe(screen.getByRole('listbox'));
        
        // Wait for aria-activedescendant to be set
        await waitFor(() => {
            expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
        });
        
        expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByRole('listbox').firstElementChild);

        // The number of results should also be read out
        expect(screen.getByRole('status')).toHaveTextContent('2 suggestions available');

        // Pressing the down arrow should change the selection to the second user
        act(() => {
            fireEvent.keyDown(input, {key: 'ArrowDown', code: 'ArrowDown'});
        });

        expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByRole('listbox').lastElementChild);

        // Pressing the up arrow should change the selection back to the first user
        act(() => {
            fireEvent.keyDown(input, {key: 'ArrowUp', code: 'ArrowUp'});
        });

        expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByRole('listbox').firstElementChild);

        // Pressing enter should complete the result and close the suggestions
        act(() => {
            fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
        });

        await waitFor(() => {
            expect(input).toHaveValue('Test @apple ');
        }, {timeout: 1000});

        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

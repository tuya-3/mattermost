// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React, {useRef, useEffect, useState} from 'react';
import type {ReactNode} from 'react';

import {displayUsername} from 'mattermost-redux/utils/user_utils';
import type {UserProfile} from '@mattermost/types/users';

import {getMentionRanges} from 'utils/mention_utils';
import type {MentionRange} from 'utils/mention_utils';

// Constants for layout measurements
const OVERLAY_STYLES = {
    fontSize: '14px',
    lineHeight: '20px',
    padding: '16px',
    cursorWidth: '2px',
    cursorHeight: '20px',
} as const;

const POSITION_OFFSETS = {
    left: 16, // padding offset
    top: 13, // padding offset
    lineHeight: 20,
} as const;

export type Props = {
    value: string | null | undefined | any;
    className?: string;
    cursorPosition?: number;
    showCursor?: boolean;
    usersByUsername?: Record<string, UserProfile>;
    teammateNameDisplay?: string;
    currentUserId?: string;
};

type ParsedMentionPart = {
    type: 'text' | 'mention';
    content: string;
    range?: MentionRange;
};

/**
 * MentionOverlay renders text with highlighted mentions using full name display.
 * This component parses the input text and replaces @mentions with full names
 * while preserving other text as-is.
 */
const MentionOverlay: React.NamedExoticComponent<Props> & {
    propTypes?: any;
} = React.memo<Props>(({
    value, 
    className, 
    cursorPosition, 
    showCursor = false, 
    usersByUsername = {},
    teammateNameDisplay = 'username',
    currentUserId = ''
}) => {

    // React Hooks must be called before any conditional returns
    const overlayRef = useRef<HTMLDivElement>(null);
    const [actualCursorLeft, setActualCursorLeft] = useState<number>(0);
    const [actualCursorTop, setActualCursorTop] = useState<number>(0);

    const stringValue = typeof value === 'string' ? value : String(value);

    // Calculate actual cursor position using DOM measurement
    useEffect(() => {
        console.log('🔍 useEffect triggered:', {
            showCursor,
            cursorPosition,
            hasOverlayRef: !!overlayRef.current,
            stringValue
        });

        if (showCursor && cursorPosition !== undefined && overlayRef.current) {
            
            // Wait for next frame to ensure AtMention components are rendered
            requestAnimationFrame(() => {
                if (!overlayRef.current) {
                    console.log('🔍 No overlayRef in requestAnimationFrame');
                    return;
                }

                // Re-parse the current value to ensure we have the latest state
                const currentParsedParts = parseMentionText(stringValue);
                // Get overlay mentions for content replacement
                const overlayMentions = overlayRef.current.querySelectorAll('.mention-highlight');

                console.log('🔍 Before calculateCursorPosition:', {
                    cursorPosition,
                    parsedPartsCount: currentParsedParts.length,
                    overlayWidth: overlayRef.current.offsetWidth,
                    mentionsCount: overlayMentions.length
                });

                // Calculate cursor position using helper function
                const {left, top} = calculateCursorPosition(
                    cursorPosition,
                    currentParsedParts,
                    overlayRef.current.offsetWidth,
                    overlayMentions,
                    usersByUsername,
                    teammateNameDisplay,
                    stringValue, // Pass original value for debugging
                );

                console.log('🔍 Calculated position:', { left, top });

                setActualCursorLeft(left);
                setActualCursorTop(top);
            });
        }
    }, [stringValue, cursorPosition, showCursor]);

    if (!value || value === '') {
        return null;
    }

    const parseMentionText = (text: string): ParsedMentionPart[] => {
        if (!text || typeof text !== 'string') {
            return [];
        }

        let mentionRanges: MentionRange[] = [];
        try {
            mentionRanges = getMentionRanges(text);
        } catch (error) {
            // Fallback to plain text rendering on parsing errors
            return createTextPart(text);
        }

        if (mentionRanges.length === 0) {
            return createTextPart(text);
        }

        const parts: ParsedMentionPart[] = [];
        let lastIndex = 0;

        for (const range of mentionRanges) {
            // Add text before the mention
            if (range.start > lastIndex) {
                const textContent = text.substring(lastIndex, range.start);
                parts.push(createTextPartFromContent(textContent));
            }

            // Add the mention part
            const mentionPart = {
                type: 'mention' as const,
                content: range.text.substring(1), // Remove @ symbol
                range,
            };
            parts.push(mentionPart);

            lastIndex = range.end;
        }

        // Add remaining text after the last mention
        if (lastIndex < text.length) {
            const textContent = text.substring(lastIndex);
            parts.push(createTextPartFromContent(textContent));
        }

        return parts;
    };

    const renderParts = (parts: ParsedMentionPart[]): ReactNode[] => {
        return parts.map((part, index) => {
            if (part.type === 'mention') {
                // Get user information for display name
                const user = usersByUsername[part.content];
                const displayName = user ? 
                    displayUsername(user, teammateNameDisplay) : 
                    part.content;

                return (
                    <span
                        key={`mention-${part.range?.start ?? index}`}
                        className='mention-highlight'
                        style={{
                            display: 'inline',
                            padding: '2px 4px',
                            margin: '0',
                            border: 'none',
                            background: 'rgba(var(--mention-color-rgb, 0, 115, 230), 0.1)',
                            borderRadius: '3px',
                            color: 'var(--mention-color, #0073e6)',
                            fontWeight: '600',
                        }}
                    >
                        {`@${displayName}`}
                    </span>
                );
            }

            // Return text parts with a key for React reconciliation
            return (
                <React.Fragment key={`text-${index}`}>
                    {part.content}
                </React.Fragment>
            );
        });
    };

    try {
        const parsedParts = parseMentionText(stringValue);
        const renderedParts = renderParts(parsedParts);


        return (
            <div
                ref={overlayRef}
                className={`suggestion-box-mention-overlay ${className || ''}`}
                style={{ position: 'relative' }}
            >
                {renderedParts.length > 0 ? renderedParts : stringValue}
                {showCursor && cursorPosition !== undefined && (() => {
                    console.log('🔍 Rendering cursor:', {
                        showCursor,
                        cursorPosition,
                        actualCursorLeft,
                        actualCursorTop,
                        overlayRect: overlayRef.current?.getBoundingClientRect()
                    });
                    return (
                        <div
                            className='mention-overlay-cursor'
                            style={{
                                left: `${(overlayRef.current?.getBoundingClientRect().left || 0) + actualCursorLeft}px`,
                                top: `${(overlayRef.current?.getBoundingClientRect().top || 0) + actualCursorTop}px`,
                                width: OVERLAY_STYLES.cursorWidth,
                                height: OVERLAY_STYLES.cursorHeight,
                                backgroundColor: 'var(--center-channel-color)',
                                pointerEvents: 'none',
                                zIndex: 9999999,
                                display: 'block',
                                opacity: 1,
                            }}
                        />
                    );
                })()}
            </div>
        );
    } catch (error) {
        // Fallback to plain text rendering on any rendering errors
        return (
            <div className={`suggestion-box-mention-overlay ${className || ''}`}>
                {stringValue}
            </div>
        );
    }
});

MentionOverlay.displayName = 'MentionOverlay';

MentionOverlay.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
    className: PropTypes.string,
    cursorPosition: PropTypes.number,
    showCursor: PropTypes.bool,
};

/**
 * Creates and styles a temporary div for text measurement
 */
const createMeasurementDiv = (overlayWidth: number): HTMLDivElement => {
    const tempDiv = document.createElement('div');
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.position = 'absolute';
    tempDiv.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
    tempDiv.style.fontSize = OVERLAY_STYLES.fontSize;
    tempDiv.style.lineHeight = OVERLAY_STYLES.lineHeight;
    tempDiv.style.fontFamily = 'inherit';
    tempDiv.style.padding = OVERLAY_STYLES.padding; // Match the overlay padding
    tempDiv.style.margin = '0';
    tempDiv.style.border = 'none';
    tempDiv.style.wordWrap = 'break-word';
    tempDiv.style.wordBreak = 'break-word';
    tempDiv.style.width = overlayWidth + 'px'; // Match overlay width for proper line wrapping

    return tempDiv;
};

/**
 * Creates a mention span element for measurement
 */
const createMentionSpan = (content: string, usersByUsername: Record<string, UserProfile>, teammateNameDisplay: string): HTMLSpanElement => {
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention-highlight';
    mentionSpan.style.display = 'inline';
    mentionSpan.style.padding = '2px 4px';
    mentionSpan.style.margin = '0';
    mentionSpan.style.border = 'none';
    mentionSpan.style.background = 'rgba(var(--mention-color-rgb, 0, 115, 230), 0.1)';
    mentionSpan.style.borderRadius = '3px';
    mentionSpan.style.color = 'var(--mention-color, #0073e6)';
    mentionSpan.style.fontWeight = '600';
    
    // Extract username from @username format
    const username = content.startsWith('@') ? content.substring(1) : content;
    const user = usersByUsername[username];
    const displayName = user ? displayUsername(user, teammateNameDisplay) : username;
    
    mentionSpan.textContent = `@${displayName}`;

    return mentionSpan;
};

/**
 * Calculates cursor position based on text measurement
 */
const calculateCursorPosition = (
    cursorPosition: number,
    currentParsedParts: ParsedMentionPart[],
    overlayWidth: number,
    overlayMentions: NodeListOf<Element>,
    usersByUsername: Record<string, UserProfile>,
    teammateNameDisplay: string,
    originalValue: string,
): { left: number; top: number } => {
    const tempDiv = createMeasurementDiv(overlayWidth);

    // Build content up to cursor position by mapping input positions to display positions
    let inputPosition = 0;
    let foundCursor = false;

    for (const part of currentParsedParts) {
        if (foundCursor) {
            break;
        }

        if (part.type === 'mention') {
            // Use the range from the parsed mention to get the actual input length
            const originalMentionLength = part.range ? (part.range.end - part.range.start) : (part.content.length + 1);
            const user = usersByUsername[part.content];
            const displayName = user ?
                displayUsername(user, teammateNameDisplay) :
                part.content;

            // Check if cursor is anywhere within the mention range or immediately after
            const mentionEndPosition = inputPosition + originalMentionLength;

            // If cursor is within or at the end of this mention
            if (cursorPosition >= inputPosition && cursorPosition <= mentionEndPosition) {
                // Add the full mention
                const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                tempDiv.appendChild(mentionSpan);
                
                // If cursor is exactly at the end of mention, add a space
                if (cursorPosition === mentionEndPosition) {
                    const spaceNode = document.createTextNode(' ');
                    tempDiv.appendChild(spaceNode);
                }
                
                foundCursor = true;
                break;
            }

            // Cursor is after this mention - add mention and continue
            const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
            tempDiv.appendChild(mentionSpan);

            // Cursor is after this mention - continue
            inputPosition += originalMentionLength;
        } else {
            const textLength = part.content.length;

            if (inputPosition + textLength >= cursorPosition) {
                // Cursor is within this text part
                const offsetInText = cursorPosition - inputPosition;
                const textToCursor = part.content.substring(0, offsetInText);
                const textNode = document.createTextNode(textToCursor);
                tempDiv.appendChild(textNode);
                foundCursor = true;
                break;
            }

            const textNode = document.createTextNode(part.content);
            tempDiv.appendChild(textNode);
            inputPosition += textLength;
        }
    }

    document.body.appendChild(tempDiv);

    // Try to get the actual rendered width from the AtMention components
    const tempMentions = tempDiv.querySelectorAll('.mention-highlight');

    // Replace temp mention content with actual rendered content if available
    tempMentions.forEach((tempMention, index) => {
        const overlayMention = overlayMentions[index];
        if (overlayMention) {
            tempMention.textContent = overlayMention.textContent;
        }
    });

    // Measure the actual width of the content in tempDiv
    document.body.appendChild(tempDiv);
    
    // Create a range to measure the exact position
    const range = document.createRange();
    const textNodes: Node[] = [];
    
    // Collect all text nodes
    const collectTextNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        } else {
            for (const child of node.childNodes) {
                collectTextNodes(child);
            }
        }
    };
    
    collectTextNodes(tempDiv);
    
    let width = 0;
    
    if (textNodes.length > 0) {
        // Set range to the end of the last text node
        const lastTextNode = textNodes[textNodes.length - 1];
        range.setStart(tempDiv, 0);
        range.setEnd(lastTextNode, lastTextNode.textContent?.length || 0);
        
        const rect = range.getBoundingClientRect();
        const tempDivRect = tempDiv.getBoundingClientRect();
        width = rect.width;
        
        console.log('🎯 Width measurement:', {
            width,
            rectWidth: rect.width,
            tempDivWidth: tempDiv.offsetWidth,
            tempDivContent: tempDiv.textContent,
            tempDivHTML: tempDiv.innerHTML,
            cursorPosition,
            originalValue,
            foundCursor
        });
    }
    
    document.body.removeChild(tempDiv);
    
    // Count lines by checking for line breaks in the original value up to cursor
    const textUpToCursor = originalValue.substring(0, cursorPosition);
    const lines = textUpToCursor.split('\n');
    const lineNumber = lines.length - 1;

    // Calculate position
    const left = width + POSITION_OFFSETS.left; // Position at the end of content
    const top = (lineNumber * POSITION_OFFSETS.lineHeight) + POSITION_OFFSETS.top; // Line height + padding offset
    return {left, top};
};

/**
 * Creates a text part with zero-width character removal
 */
const createTextPart = (text: string): ParsedMentionPart[] => {
    return [{type: 'text', content: text.replace(/[\u200B\u200C]/g, '')}]; // Remove zero-width characters for display
};

/**
 * Creates a text part from content with zero-width character removal
 */
const createTextPartFromContent = (content: string): ParsedMentionPart => {
    return {
        type: 'text' as const,
        content: content.replace(/[\u200B\u200C]/g, ''), // Remove zero-width characters for display
    };
};

export default MentionOverlay;

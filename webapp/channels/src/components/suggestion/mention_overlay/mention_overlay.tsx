// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React, {useRef, useEffect, useState} from 'react';
import type {ReactNode} from 'react';

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
};

type ParsedMentionPart = {
    type: 'text' | 'mention';
    content: string;
    range?: MentionRange;
};

/**
 * MentionOverlay renders text with highlighted mentions using AtMention components.
 * This component parses the input text and replaces @mentions with interactive AtMention components
 * while preserving other text as-is.
 *
 * Based on the patterns established in at_mention_provider for consistent mention handling.
 */
const MentionOverlay: React.NamedExoticComponent<Props> & {
    propTypes?: any;
} = React.memo<Props>(({value, className, cursorPosition, showCursor = false}) => {
    // React Hooks must be called before any conditional returns
    const overlayRef = useRef<HTMLDivElement>(null);
    const [actualCursorLeft, setActualCursorLeft] = useState<number>(0);
    const [actualCursorTop, setActualCursorTop] = useState<number>(0);

    const stringValue = typeof value === 'string' ? value : String(value);

    // Calculate actual cursor position using DOM measurement
    useEffect(() => {
        if (showCursor && cursorPosition !== undefined && overlayRef.current) {
            // Wait for next frame to ensure AtMention components are rendered
            requestAnimationFrame(() => {
                if (!overlayRef.current) {
                    return;
                }

                // Re-parse the current value to ensure we have the latest state
                const currentParsedParts = parseMentionText(stringValue);

                // Get overlay mentions for content replacement
                const overlayMentions = overlayRef.current.querySelectorAll('.mention-highlight');

                // Calculate cursor position using helper function
                const {left, top} = calculateCursorPosition(
                    overlayRef.current.offsetWidth,
                    currentParsedParts,
                    cursorPosition,
                    overlayMentions,
                );

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
                return (
                    <span
                        key={`mention-${part.range?.start ?? index}`}
                        className='mention-highlight'
                        style={{
                            display: 'inline',
                            padding: '2px 4px',
                            margin: '0',
                            border: 'none',
                            background: 'rgba(255, 212, 0, 0.2)',
                            borderRadius: '3px',
                            fontWeight: 'bold',
                        }}
                    >
                        {`@${part.content}`}
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
            >
                {renderedParts.length > 0 ? renderedParts : stringValue}
                {showCursor && cursorPosition !== undefined && (
                    <span
                        className='mention-overlay-cursor'
                        style={{
                            position: 'absolute',
                            left: `${actualCursorLeft}px`, // Use calculated left position
                            top: `${actualCursorTop}px`, // Use calculated top position
                            width: OVERLAY_STYLES.cursorWidth,
                            height: OVERLAY_STYLES.cursorHeight, // Match line-height
                            backgroundColor: 'var(--center-channel-color)',
                            animation: 'blink 1s infinite',
                            pointerEvents: 'none',
                            zIndex: 10,
                        }}
                    />
                )}
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
const createMentionSpan = (content: string): HTMLSpanElement => {
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention-highlight';
    mentionSpan.style.display = 'inline';
    mentionSpan.style.padding = '2px 4px';
    mentionSpan.style.margin = '0';
    mentionSpan.style.border = 'none';
    mentionSpan.style.background = 'rgba(255, 212, 0, 0.2)';
    mentionSpan.style.borderRadius = '3px';
    mentionSpan.style.fontWeight = 'bold';
    mentionSpan.textContent = content;

    return mentionSpan;
};

/**
 * Calculates cursor position based on text measurement
 */
const calculateCursorPosition = (
    overlayWidth: number,
    currentParsedParts: ParsedMentionPart[],
    cursorPosition: number,
    overlayMentions: NodeListOf<Element>,
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
            const originalMentionLength = part.content.length + 1; // +1 for @

            if (inputPosition + originalMentionLength >= cursorPosition) {
                // Cursor is within or at end of this mention
                if (cursorPosition > inputPosition) {
                    // Create a mention element to measure its actual width
                    const mentionSpan = createMentionSpan(`@${part.content}`);
                    tempDiv.appendChild(mentionSpan);
                }
                foundCursor = true;
                break;
            }

            // Add the full mention
            const mentionSpan = createMentionSpan(`@${part.content}`);
            tempDiv.appendChild(mentionSpan);
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

    // Calculate line position by counting newlines up to cursor position
    const textUpToCursor = tempDiv.textContent || '';
    const lines = textUpToCursor.split('\n');
    const lineNumber = lines.length - 1;
    const lastLineText = lines[lines.length - 1] || '';

    // Create a temporary span to measure the width of the last line
    const lastLineSpan = document.createElement('span');
    lastLineSpan.style.visibility = 'hidden';
    lastLineSpan.style.position = 'absolute';
    lastLineSpan.style.whiteSpace = 'pre';
    lastLineSpan.style.fontSize = OVERLAY_STYLES.fontSize;
    lastLineSpan.style.fontFamily = 'inherit';
    lastLineSpan.textContent = lastLineText;
    document.body.appendChild(lastLineSpan);

    const lastLineWidth = lastLineSpan.offsetWidth;
    document.body.removeChild(lastLineSpan);
    document.body.removeChild(tempDiv);

    // Calculate position
    const left = lastLineWidth + POSITION_OFFSETS.left; // Add padding offset
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

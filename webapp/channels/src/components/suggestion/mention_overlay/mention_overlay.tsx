// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    displayName?: string;
} = React.memo(({
    value,
    className,
    cursorPosition,
    showCursor = false,
    usersByUsername = {},
    teammateNameDisplay = 'username',
    currentUserId = '',
}: Props) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [actualCursorLeft, setActualCursorLeft] = useState(0);
    const [actualCursorTop, setActualCursorTop] = useState(0);

    // Convert value to string
    const stringValue = value?.toString() || '';

    // Parse mentions from the text
    const parseMentionText = (text: string): ParsedMentionPart[] => {
        const mentionRanges = getMentionRanges(text);
        const parts: ParsedMentionPart[] = [];
        let lastEnd = 0;

        for (const range of mentionRanges) {
            // Add text before mention
            if (range.start > lastEnd) {
                parts.push(createTextPartFromContent(text.substring(lastEnd, range.start)));
            }

            // Add mention
            const mentionText = text.substring(range.start, range.end);
            const username = mentionText.substring(1); // Remove @ prefix
            parts.push({
                type: 'mention',
                content: username,
                range,
            });

            lastEnd = range.end;
        }

        // Add remaining text
        if (lastEnd < text.length) {
            parts.push(createTextPartFromContent(text.substring(lastEnd)));
        }

        return parts;
    };

    // Calculate cursor position whenever value or cursorPosition changes
    useEffect(() => {
        if (!showCursor || cursorPosition === undefined || !overlayRef.current) {
            return;
        }

        const parsedParts = parseMentionText(stringValue);
        const overlayMentions = overlayRef.current.querySelectorAll('.mention-highlight');
        const position = calculateCursorPosition(
            cursorPosition,
            parsedParts,
            overlayRef.current.offsetWidth,
            overlayMentions,
            usersByUsername,
            teammateNameDisplay,
            stringValue,
        );

        setActualCursorLeft(position.left);
        setActualCursorTop(position.top);
    }, [stringValue, cursorPosition, showCursor, usersByUsername, teammateNameDisplay]);

    // Render parts with mentions highlighted
    const renderParts = (parts: ParsedMentionPart[]): ReactNode[] => {
        return parts.map((part, index) => {
            if (part.type === 'mention') {
                const user = usersByUsername[part.content];
                const displayName = user ?
                    displayUsername(user, teammateNameDisplay) :
                    part.content;

                return (
                    <span
                        key={`mention-${index}`}
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
                        @{displayName}
                    </span>
                );
            }

            // For text parts, preserve line breaks
            const lines = part.content.split('\n');
            const elements: ReactNode[] = [];

            lines.forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    // Add line break before each line except the first
                    elements.push(<br key={`br-${index}-${lineIndex}`} />);
                }
                if (line) {
                    elements.push(
                        <React.Fragment key={`text-${index}-${lineIndex}`}>
                            {line}
                        </React.Fragment>
                    );
                }
            });

            return (
                <React.Fragment key={`text-${index}`}>
                    {elements}
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
                {showCursor && cursorPosition !== undefined && (
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
    // Count lines by checking for line breaks in the original value up to cursor
    const textUpToCursor = originalValue.substring(0, cursorPosition);
    const lines = textUpToCursor.split('\n');
    const lineNumber = lines.length - 1;
    const currentLineText = lines[lines.length - 1];
    const currentLineStartPos = cursorPosition - currentLineText.length;

    const tempDiv = createMeasurementDiv(overlayWidth);

    // Build content for the current line only
    let inputPosition = 0;
    let foundCursor = false;

    for (const part of currentParsedParts) {
        if (foundCursor) {
            break;
        }

        if (part.type === 'mention') {
            // Use the range from the parsed mention to get the actual input length
            const originalMentionLength = part.range ? (part.range.end - part.range.start) : (part.content.length + 1);
            const mentionEndPosition = inputPosition + originalMentionLength;

            // Skip parts before the current line
            if (mentionEndPosition <= currentLineStartPos) {
                inputPosition += originalMentionLength;
                continue;
            }

            // If mention starts before current line but extends into it or is on current line
            if (inputPosition < cursorPosition) {
                // Check if this mention is on the current line
                if (mentionEndPosition > currentLineStartPos) {
                    const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                    tempDiv.appendChild(mentionSpan);
                    
                    // If cursor is at the end of mention, add a space
                    if (cursorPosition === mentionEndPosition) {
                        const spaceNode = document.createTextNode(' ');
                        tempDiv.appendChild(spaceNode);
                        foundCursor = true;
                        break;
                    }
                }
            }

            inputPosition += originalMentionLength;
        } else {
            const textLength = part.content.length;
            const textEndPosition = inputPosition + textLength;

            // Skip parts before the current line
            if (textEndPosition <= currentLineStartPos) {
                inputPosition += textLength;
                continue;
            }

            // Process text that might span multiple lines
            let currentTextPos = inputPosition;
            const lines = part.content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineStart = currentTextPos;
                const lineEnd = currentTextPos + line.length;
                
                // Check if this line intersects with our current line
                if (lineEnd > currentLineStartPos && lineStart <= cursorPosition) {
                    // Calculate what portion of this line to include
                    const startInLine = Math.max(0, currentLineStartPos - lineStart);
                    const endInLine = Math.min(line.length, cursorPosition - lineStart);
                    
                    if (endInLine > startInLine) {
                        const textToAdd = line.substring(startInLine, endInLine);
                        const textNode = document.createTextNode(textToAdd);
                        tempDiv.appendChild(textNode);
                    }
                    
                    if (lineEnd >= cursorPosition) {
                        foundCursor = true;
                        break;
                    }
                }
                
                currentTextPos += line.length + (i < lines.length - 1 ? 1 : 0); // +1 for newline
            }

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
        width = rect.width;
    }
    
    document.body.removeChild(tempDiv);

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

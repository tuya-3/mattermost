// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useEffect, useState} from 'react';
import type {ReactNode} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {displayUsername} from 'mattermost-redux/utils/user_utils';

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
    onCursorPositionChange?: (position: number) => void;
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
/* eslint-disable react/prop-types */
const MentionOverlay: React.NamedExoticComponent<Props> & {
    displayName?: string;
} = React.memo(({
    value,
    className,
    cursorPosition,
    showCursor = false,
    usersByUsername = {},
    teammateNameDisplay = 'username',
    onCursorPositionChange,
}: Props) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [actualCursorLeft, setActualCursorLeft] = useState(0);
    const [actualCursorTop, setActualCursorTop] = useState(0);

    // Convert value to string
    const stringValue = value?.toString() || '';

    // Handle click events on the overlay to calculate cursor position
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent the click from propagating to avoid conflicts
        e.preventDefault();
        e.stopPropagation();

        if (!onCursorPositionChange || !overlayRef.current) {
            return;
        }

        const rect = overlayRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left - POSITION_OFFSETS.left;
        const clickY = e.clientY - rect.top - POSITION_OFFSETS.top;

        // Calculate line number based on click Y position
        const lineNumber = Math.floor(clickY / POSITION_OFFSETS.lineHeight);
        const lines = stringValue.split('\n');
        
        if (lineNumber >= lines.length) {
            // Clicked below the last line, set cursor to end of text
            onCursorPositionChange(stringValue.length);
            return;
        }

        if (lineNumber < 0) {
            // Clicked above the first line, set cursor to beginning
            onCursorPositionChange(0);
            return;
        }

        // Get the content of the clicked line
        const currentLine = lines[lineNumber] || '';
        const lineStartPosition = lines.slice(0, lineNumber).reduce((acc: number, line: string) => acc + line.length + 1, 0);

        // Parse the current line to understand mentions vs text
        const parsedParts = parseMentionText(stringValue);
        let currentLineStartInParts = 0;
        let currentLineEndInParts = 0;
        let inputPos = 0;

        // Find which parts belong to the current line
        for (const part of parsedParts) {
            const partLength = part.type === 'mention' 
                ? (part.range ? (part.range.end - part.range.start) : (part.content.length + 1))
                : part.content.length;
            
            const partEndPos = inputPos + partLength;
            
            if (inputPos <= lineStartPosition && partEndPos > lineStartPosition) {
                currentLineStartInParts = inputPos;
            }
            if (inputPos < lineStartPosition + currentLine.length && partEndPos >= lineStartPosition + currentLine.length) {
                currentLineEndInParts = partEndPos;
                break;
            }
            
            inputPos += partLength;
        }

        // Create a measurement div to find the cursor position on this line
        const tempDiv = createMeasurementDiv(overlayRef.current.offsetWidth);
        if (typeof document !== 'undefined' && document.body) {
            document.body.appendChild(tempDiv);
        } else {
            // Fallback - set cursor to end of line
            onCursorPositionChange(lineStartPosition + currentLine.length);
            return;
        }

        // Build the visual representation of the current line with mentions
        let visualContent = '';
        inputPos = 0;
        for (const part of parsedParts) {
            const partLength = part.type === 'mention' 
                ? (part.range ? (part.range.end - part.range.start) : (part.content.length + 1))
                : part.content.length;
            
            const partEndPos = inputPos + partLength;
            
            // If this part intersects with the current line
            if (inputPos < lineStartPosition + currentLine.length && partEndPos > lineStartPosition) {
                if (part.type === 'mention') {
                    const user = usersByUsername[part.content];
                    const displayName = user 
                        ? displayUsername(user, teammateNameDisplay) 
                        : part.content;
                    const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                    tempDiv.appendChild(mentionSpan);
                    visualContent += `@${displayName}`;
                } else {
                    // Handle text that might be partially on this line
                    const startInPart = Math.max(0, lineStartPosition - inputPos);
                    const endInPart = Math.min(part.content.length, (lineStartPosition + currentLine.length) - inputPos);
                    const textContent = part.content.substring(startInPart, endInPart);
                    
                    if (textContent) {
                        const textNode = document.createTextNode(textContent);
                        tempDiv.appendChild(textNode);
                        visualContent += textContent;
                    }
                }
            }
            
            inputPos += partLength;
        }
        
        // Use range to find the character position closest to the click
        const range = document.createRange();
        let bestPosition = 0;
        let bestDistance = Infinity;
        let bestInputPosition = lineStartPosition;

        // Try to find the closest position by walking through all child nodes
        const walkNode = (node: Node, currentInputPos: number): void => {
            if (node.nodeType === Node.TEXT_NODE) {
                const textContent = node.textContent || '';
                for (let i = 0; i <= textContent.length; i++) {
                    try {
                        range.setStart(node, i);
                        range.setEnd(node, i);
                        
                        if (typeof range.getBoundingClientRect === 'function') {
                            const rangeRect = range.getBoundingClientRect();
                            const distance = Math.abs(rangeRect.left - (rect.left + POSITION_OFFSETS.left + clickX));
                            
                            if (distance < bestDistance) {
                                bestDistance = distance;
                                bestPosition = i;
                                bestInputPosition = currentInputPos + i;
                            }
                        }
                    } catch (e) {
                        console.warn('Range setting failed', e);
                    }
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.classList.contains('mention-highlight')) {
                    // This is a mention element
                    const mentionText = element.textContent || '';
                    for (let i = 0; i <= mentionText.length; i++) {
                        try {
                            if (element.firstChild) {
                                range.setStart(element.firstChild, Math.min(i, mentionText.length));
                                range.setEnd(element.firstChild, Math.min(i, mentionText.length));
                                
                                if (typeof range.getBoundingClientRect === 'function') {
                                    const rangeRect = range.getBoundingClientRect();
                                    const distance = Math.abs(rangeRect.left - (rect.left + POSITION_OFFSETS.left + clickX));
                                    
                                    if (distance < bestDistance) {
                                        bestDistance = distance;
                                        bestPosition = i;
                                        bestInputPosition = currentInputPos + i;
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Mention range setting failed', e);
                        }
                    }
                }
            }
        };

        // Walk through all child nodes
        let nodeInputPos = lineStartPosition;
        for (const childNode of tempDiv.childNodes) {
            walkNode(childNode, nodeInputPos);
            
            // Update position for next node
            if (childNode.nodeType === Node.TEXT_NODE) {
                nodeInputPos += (childNode.textContent || '').length;
            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                const element = childNode as Element;
                if (element.classList.contains('mention-highlight')) {
                    // Find the original mention length
                    const mentionText = element.textContent || '';
                    const username = mentionText.startsWith('@') ? mentionText.substring(1) : mentionText;
                    // Original mention length is @username format
                    nodeInputPos += username.length + 1;
                } else {
                    nodeInputPos += (element.textContent || '').length;
                }
            }
        }

        // Clean up
        if (tempDiv.parentNode) {
            tempDiv.parentNode.removeChild(tempDiv);
        }

        // Use the best input position we found
        const clampedPosition = Math.min(bestInputPosition, stringValue.length);
        
        onCursorPositionChange(clampedPosition);
    };

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
                        {'@'}{displayName}
                    </span>
                );
            }

            // For text parts, preserve line breaks
            const lines = part.content.split('\n');
            const elements: ReactNode[] = [];

            lines.forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    // Add line break before each line except the first
                    elements.push(<br key={`br-${index}-${lineIndex}`}/>);
                }
                if (line) {
                    elements.push(
                        <React.Fragment key={`text-${index}-${lineIndex}`}>
                            {line}
                        </React.Fragment>,
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
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    cursor: 'text',
                    zIndex: 10,
                }}
                onClick={handleOverlayClick}
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
 * Creates a text part from content with zero-width character removal
 */
const createTextPartFromContent = (content: string): ParsedMentionPart => {
    return {
        type: 'text' as const,
        content: content.replace(/[\u200B\u200C]/g, ''), // Remove zero-width characters for display
    };
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

    // Ensure the div is properly added to the DOM for measurement
    // In test environments, this might not work properly
    if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(tempDiv);
    } else {
        // Fallback for test environments - return a default position
        return {left: POSITION_OFFSETS.left, top: (lineNumber * POSITION_OFFSETS.lineHeight) + POSITION_OFFSETS.top};
    }

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

            // Check if cursor is within this mention
            if (inputPosition <= cursorPosition && cursorPosition <= mentionEndPosition) {
                // Check if this mention is on the current line
                if (mentionEndPosition > currentLineStartPos) {
                    const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                    tempDiv.appendChild(mentionSpan);

                    // Calculate position within the mention display
                    const positionInMention = cursorPosition - inputPosition;
                    const user = usersByUsername[part.content];
                    const displayName = user ? displayUsername(user, teammateNameDisplay) : part.content;
                    const fullDisplayText = `@${displayName}`;
                    
                    // Calculate proportional position in display text
                    const displayPosition = Math.min(
                        Math.floor((positionInMention / originalMentionLength) * fullDisplayText.length),
                        fullDisplayText.length
                    );

                    // Add partial mention text for measurement
                    const partialText = fullDisplayText.substring(0, displayPosition);
                    
                    if (partialText) {
                        // Replace the full mention with partial text
                        tempDiv.removeChild(mentionSpan);
                        const partialSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                        partialSpan.textContent = partialText;
                        tempDiv.appendChild(partialSpan);
                    }

                    foundCursor = true;
                    break;
                }
            } else if (inputPosition < cursorPosition) {
                // Cursor is after this mention, include the full mention
                if (mentionEndPosition > currentLineStartPos) {
                    const mentionSpan = createMentionSpan(`@${part.content}`, usersByUsername, teammateNameDisplay);
                    tempDiv.appendChild(mentionSpan);
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

    // Try to get the actual rendered width from the AtMention components
    const tempMentions = tempDiv.querySelectorAll('.mention-highlight');

    // Replace temp mention content with actual rendered content if available
    // BUT only if we didn't create a partial mention (foundCursor = true means we have partial content)
    if (!foundCursor) {
        tempMentions.forEach((tempMention, index) => {
            const overlayMention = overlayMentions[index];
            if (overlayMention) {
                tempMention.textContent = overlayMention.textContent;
            }
        });
    }

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

        // Check if getBoundingClientRect is available (it might not be in test environments like JSDOM)
        if (typeof range.getBoundingClientRect === 'function') {
            const rect = range.getBoundingClientRect();
            width = rect.width;
        } else {
            // Fallback for test environments - approximate width based on text content
            const textContent = tempDiv.textContent || '';
            width = textContent.length * 8; // Rough approximation: 8px per character
        }
    }

    // Safely remove the temporary div from DOM
    if (tempDiv.parentNode) {
        tempDiv.parentNode.removeChild(tempDiv);
    }

    // Calculate position
    const left = width + POSITION_OFFSETS.left; // Position at the end of content
    const top = (lineNumber * POSITION_OFFSETS.lineHeight) + POSITION_OFFSETS.top; // Line height + padding offset
    
    return {left, top};
};

export default MentionOverlay;

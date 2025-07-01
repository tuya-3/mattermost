// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useEffect, useState} from 'react';
import type {ReactNode} from 'react';

import AtMention from 'components/at_mention';

import {getMentionRanges} from 'utils/mention_utils';
import type {MentionRange} from 'utils/mention_utils';

export type Props = {
    value: string;
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
const MentionOverlay = React.memo<Props>(({value, className, cursorPosition, showCursor = false}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [actualCursorLeft, setActualCursorLeft] = useState<number>(0);
    const [actualCursorTop, setActualCursorTop] = useState<number>(0);

    // Calculate actual cursor position using DOM measurement
    // Must be called before any conditional returns to maintain Hook order
    useEffect(() => {
        if (showCursor && cursorPosition !== undefined && overlayRef.current) {
            // Wait for next frame to ensure AtMention components are rendered
            requestAnimationFrame(() => {
                if (!overlayRef.current) return;
                
                // Re-parse the current value to ensure we have the latest state
                const currentParsedParts = parseMentionText(value);
                
                // Create a temporary range to measure text up to cursor position
                const tempDiv = document.createElement('div');
                tempDiv.style.visibility = 'hidden';
                tempDiv.style.position = 'absolute';
                tempDiv.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
                tempDiv.style.fontSize = '14px';
                tempDiv.style.lineHeight = '20px';
                tempDiv.style.fontFamily = 'inherit';
                tempDiv.style.padding = '16px'; // Match the overlay padding
                tempDiv.style.margin = '0';
                tempDiv.style.border = 'none';
                tempDiv.style.wordWrap = 'break-word';
                tempDiv.style.wordBreak = 'break-word';
                tempDiv.style.width = overlayRef.current.offsetWidth + 'px'; // Match overlay width for proper line wrapping
                
                // Build content up to cursor position by mapping input positions to display positions
                let inputPosition = 0;
                let foundCursor = false;
                
                for (const part of currentParsedParts) {
                    if (foundCursor) break;
                    
                    if (part.type === 'mention') {
                        const originalMentionLength = part.content.length + 1; // +1 for @
                        
                        if (inputPosition + originalMentionLength >= cursorPosition) {
                            // Cursor is within or at end of this mention
                            if (cursorPosition > inputPosition) {
                                // Create a mention element to measure its actual width
                                // Use button element to match AtMention component structure
                                const mentionSpan = document.createElement('button');
                                mentionSpan.className = 'style--none mention--highlight';
                                mentionSpan.style.display = 'inline';
                                mentionSpan.style.padding = '0';
                                mentionSpan.style.margin = '0';
                                mentionSpan.style.border = 'none';
                                mentionSpan.style.background = 'transparent';
                                mentionSpan.style.cursor = 'default';
                                // Use a placeholder full name for measurement - this will be replaced by actual display name
                                mentionSpan.textContent = `@${part.content}`;
                                tempDiv.appendChild(mentionSpan);
                            }
                            foundCursor = true;
                            break;
                        }
                        
                        // Add the full mention
                        // Use button element to match AtMention component structure
                        const mentionSpan = document.createElement('button');
                        mentionSpan.className = 'style--none mention--highlight';
                        mentionSpan.style.display = 'inline';
                        mentionSpan.style.padding = '0';
                        mentionSpan.style.margin = '0';
                        mentionSpan.style.border = 'none';
                        mentionSpan.style.background = 'transparent';
                        mentionSpan.style.cursor = 'default';
                        mentionSpan.textContent = `@${part.content}`;
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
                // AtMention components render as buttons with mention--highlight class, not .at-mention
                const overlayMentions = overlayRef.current.querySelectorAll('button.mention--highlight');
                const tempMentions = tempDiv.querySelectorAll('button.mention--highlight');
                                
                // Replace temp mention content with actual rendered content if available
                tempMentions.forEach((tempMention, index) => {
                    const overlayMention = overlayMentions[index];
                    if (overlayMention) {
                        tempMention.textContent = overlayMention.textContent;
                    }
                });
                
                // Simple approach: measure width and calculate line position
                const width = tempDiv.offsetWidth;
                
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
                lastLineSpan.style.fontSize = '14px';
                lastLineSpan.style.fontFamily = 'inherit';
                lastLineSpan.textContent = lastLineText;
                document.body.appendChild(lastLineSpan);
                
                const lastLineWidth = lastLineSpan.offsetWidth;
                document.body.removeChild(lastLineSpan);
                document.body.removeChild(tempDiv);
                                
                // Calculate position
                const left = lastLineWidth + 16; // Add 16px padding offset
                const top = (lineNumber * 20) + 13; // 20px line height + 13px padding offset
                
                setActualCursorLeft(left);
                setActualCursorTop(top);
            });
        }
    }, [value, cursorPosition, showCursor]);

    const parseMentionText = (text: string): ParsedMentionPart[] => {
        
        if (!text || typeof text !== 'string') {
            return [];
        }

        let mentionRanges: MentionRange[] = [];
        try {
            mentionRanges = getMentionRanges(text);
        } catch (error) {
            // Fallback to plain text rendering on parsing errors
            return [{type: 'text', content: text.replace(/[\u200B\u200C]/g, '')}]; // Remove zero-width characters for display
        }

        if (mentionRanges.length === 0) {
            return [{type: 'text', content: text.replace(/[\u200B\u200C]/g, '')}]; // Remove zero-width characters for display
        }

        const parts: ParsedMentionPart[] = [];
        let lastIndex = 0;

        for (const range of mentionRanges) {
            
            // Add text before the mention
            if (range.start > lastIndex) {
                const textContent = text.substring(lastIndex, range.start);
                const textPart = {
                    type: 'text' as const,
                    content: textContent.replace(/[\u200B\u200C]/g, ''), // Remove zero-width characters for display
                };
                parts.push(textPart);
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
            const textPart = {
                type: 'text' as const,
                content: textContent.replace(/[\u200B\u200C]/g, ''), // Remove zero-width characters for display
            };
            parts.push(textPart);
        }

        return parts;
    };

    const renderParts = (parts: ParsedMentionPart[]): ReactNode[] => {
        
        return parts.map((part, index) => {
            
            if (part.type === 'mention') {
                
                // For debugging: create a simple styled mention instead of AtMention to test cursor positioning
                const isDebugMode = false; // Set to true for debugging
                
                if (isDebugMode) {
                    return (
                        <button
                            key={`mention-${part.range?.start ?? index}`}
                            className="style--none mention--highlight"
                            style={{
                                display: 'inline',
                                padding: '0',
                                margin: '0',
                                border: 'none',
                                background: 'rgba(255, 212, 0, 0.2)',
                                cursor: 'default',
                            }}
                        >
                            {`@${part.content}`}
                        </button>
                    );
                }
                
                return (
                    <AtMention
                        key={`mention-${part.range?.start ?? index}`}
                        mentionName={part.content}
                        displayMode='fullname'
                    >
                        <button
                            className="style--none mention--highlight"
                            style={{
                                display: 'inline',
                                padding: '0',
                                margin: '0',
                                border: 'none',
                                background: 'rgba(255, 212, 0, 0.2)',
                                cursor: 'default',
                            }}
                        >
                            {`@${part.content}`}
                        </button>
                    </AtMention>
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
        const parsedParts = parseMentionText(value);
        const renderedParts = renderParts(parsedParts);
        
        return (
            <div ref={overlayRef} className={`suggestion-box-mention-overlay ${className || ''}`}>
                {renderedParts.length > 0 ? renderedParts : value}
                {showCursor && cursorPosition !== undefined && (
                    <span
                        className="mention-overlay-cursor"
                        style={{
                            position: 'absolute',
                            left: `${actualCursorLeft}px`, // Use calculated left position
                            top: `${actualCursorTop}px`, // Use calculated top position
                            width: '2px',
                            height: '20px', // Match line-height (20px from CSS)
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
                {value}
            </div>
        );
    }
});

MentionOverlay.displayName = 'MentionOverlay';

export default MentionOverlay;

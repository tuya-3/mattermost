// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface MentionRange {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

export interface CursorPositionInfo {
    readonly inArea: boolean;
    readonly range?: MentionRange;
    readonly position?: number;
}

export interface MentionDeletionResult {
    readonly shouldDelete: boolean;
    readonly newPosition?: number;
    readonly newText?: string;
}

export interface MentionInvasionResult {
    readonly willInvade: boolean;
    readonly safePosition?: number;
}

// Cached regular expression for mention detection (performance optimization)
// Use word boundary to ensure mentions don't expand beyond valid username characters
const MENTION_REGEX = /@([a-z0-9.\-_]+)\b/gi;

/**
 * Detects and returns mention ranges in text
 * @param text - The text to search for mentions
 * @returns Array of mention ranges
 */
export function getMentionRanges(text: string): MentionRange[] {
    if (!text || typeof text !== 'string') {
        return [];
    }

    // Clean text by removing zero-width characters for mention detection
    // but keep track of original positions
    const cleanText = text.replace(/[\u200B\u200C]/g, ''); // Remove zero-width spaces and non-joiners
    const ranges: MentionRange[] = [];
    
    // Reset regex lastIndex to ensure proper execution
    MENTION_REGEX.lastIndex = 0;
    let match;

    while ((match = MENTION_REGEX.exec(cleanText)) !== null) {
        // Map clean text positions back to original text positions
        const originalStart = mapCleanToOriginalPosition(text, match.index);
        const originalEnd = mapCleanToOriginalPosition(text, match.index + match[0].length);
        
        const range = {
            start: originalStart,
            end: originalEnd,
            text: match[0],
        };
        ranges.push(range);
    }

    return ranges;
}

/**
 * Maps position in clean text (without zero-width characters) to original text position
 */
function mapCleanToOriginalPosition(originalText: string, cleanPosition: number): number {
    let originalPos = 0;
    let cleanPos = 0;
    
    while (cleanPos < cleanPosition && originalPos < originalText.length) {
        const char = originalText[originalPos];
        if (char === '\u200B' || char === '\u200C') {
            // Skip zero-width characters in original text
            originalPos++;
        } else {
            // Regular character, advance both positions
            originalPos++;
            cleanPos++;
        }
    }
    
    return originalPos;
}

/**
 * Checks if cursor position is within a mention area
 * @param text - The text to check
 * @param cursorPosition - Current cursor position
 * @returns Detailed cursor position information
 */
export function getCursorPositionInfo(text: string, cursorPosition: number): CursorPositionInfo {
    if (!text || typeof text !== 'string' || cursorPosition < 0) {
        return { inArea: false };
    }

    const mentionRanges = getMentionRanges(text);

    for (const range of mentionRanges) {
        // Check if cursor is within mention area (inclusive start, exclusive end)
        if (cursorPosition >= range.start && cursorPosition < range.end) {
            return {
                inArea: true,
                range,
                position: cursorPosition,
            };
        }
    }

    return { inArea: false };
}

/**
 * Calculates safe cursor position avoiding mention areas
 * @param text - Target text
 * @param targetPosition - Target cursor position
 * @returns Safe cursor position
 */
export function getSafeCursorPosition(text: string, targetPosition: number): number {
    if (!text || typeof text !== 'string' || targetPosition < 0) {
        return 0;
    }

    const mentionRanges = getMentionRanges(text);
    let newPosition = targetPosition;

    for (const range of mentionRanges) {
        // If targetPosition is within mention area, move to end of mention
        if (targetPosition >= range.start && targetPosition < range.end) {
            newPosition = range.end;
            break;
        }
    }

    // Ensure cursor position doesn't exceed text length
    return Math.max(0, Math.min(newPosition, text.length));
}

/**
 * Checks if key input will invade mention areas
 * @param text - Target text
 * @param currentPosition - Current cursor position
 * @param key - Pressed key
 * @param ctrlKey - Whether Ctrl key is pressed
 * @param metaKey - Whether Meta key (Cmd) is pressed
 * @returns Invasion result and safe position
 */
export function willInvadeMentionArea(
    text: string,
    currentPosition: number,
    key: string,
    ctrlKey = false,
    metaKey = false
): MentionInvasionResult {
    if (!text || typeof text !== 'string' || currentPosition < 0) {
        return { willInvade: false };
    }

    const mentionRanges = getMentionRanges(text);

    // If no mentions found, allow normal processing
    if (mentionRanges.length === 0) {
        return { willInvade: false };
    }

    // Handle Home/Ctrl+Left/Cmd+Left navigation
    if ((key === 'Home') || (key === 'ArrowLeft' && (ctrlKey || metaKey))) {
        const targetPosition = 0;
        for (const range of mentionRanges) {
            if (targetPosition < range.end) {
                return { willInvade: true, safePosition: range.end };
            }
        }
        return { willInvade: false };
    }

    // Handle regular arrow key navigation
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPosition = key === 'ArrowLeft' ? currentPosition - 1 : currentPosition + 1;
        
        for (const range of mentionRanges) {
            // Right arrow: skip over mention completely when entering from the left
            if (key === 'ArrowRight' && currentPosition < range.start && nextPosition >= range.start) {
                return { willInvade: true, safePosition: range.end };
            }
            
            // Left arrow: handle navigation into and within mentions
            if (key === 'ArrowLeft') {
                // Coming from right of mention, allow entry to mention's end
                if (currentPosition > range.end && nextPosition === range.end) {
                    return { willInvade: false }; // Allow normal movement to mention end
                }
                
                // Within mention area: skip to mention start when moving left
                if (currentPosition <= range.end && currentPosition > range.start && nextPosition >= range.start) {
                    return { willInvade: true, safePosition: range.start };
                }
                
                // At mention start, allow normal left movement
                if (currentPosition === range.start) {
                    return { willInvade: false }; // Allow normal movement out of mention
                }
            }
        }
    }

    return { willInvade: false };
}

/**
 * Handles mention deletion logic
 * @param text - Target text
 * @param cursorPosition - Current cursor position
 * @param key - Delete key ('Backspace' | 'Delete')
 * @returns Deletion processing result
 */
export function handleMentionDeletion(
    text: string,
    cursorPosition: number,
    key: 'Backspace' | 'Delete'
): MentionDeletionResult {
    if (!text || typeof text !== 'string' || cursorPosition < 0) {
        return { shouldDelete: false };
    }

    const mentionRanges = getMentionRanges(text);

    for (const range of mentionRanges) {
        if (key === 'Backspace' && cursorPosition === range.end) {
            // Backspace right after mention → delete entire mention
            const newText = text.substring(0, range.start) + text.substring(range.end);
            return {
                shouldDelete: true,
                newPosition: range.start,
                newText,
            };
        }

        // Check if we're deleting the space right after a mention
        if (key === 'Backspace' &&
            cursorPosition > range.end &&
            cursorPosition <= range.end + 1 &&
            text.charAt(range.end) === ' ') {
            
            const afterSpace = text.substring(range.end + 1);
            
            // If there's text after the space, prevent deletion to avoid mention expansion
            if (afterSpace.trim().length > 0) {
                return {
                    shouldDelete: false, // Don't delete anything
                    newPosition: cursorPosition, // Keep cursor in same position
                };
            } else {
                // If no text after space, allow normal space deletion
                const newText = text.substring(0, range.end) + text.substring(range.end + 1);
                return {
                    shouldDelete: true,
                    newPosition: range.end,
                    newText,
                };
            }
        }

        if (key === 'Backspace' && cursorPosition === range.start) {
            // Backspace at start of mention → delete entire mention
            const newText = text.substring(0, range.start) + text.substring(range.end);
            return {
                shouldDelete: true,
                newPosition: range.start,
                newText,
            };
        }

        if (key === 'Delete' && cursorPosition === range.start) {
            // Delete at start of mention → delete entire mention
            const newText = text.substring(0, range.start) + text.substring(range.end);
            return {
                shouldDelete: true,
                newPosition: range.start,
                newText,
            };
        }

        if (key === 'Delete' && cursorPosition >= range.start && cursorPosition < range.end) {
            // Delete within mention → move to mention end
            return {
                shouldDelete: false,
                newPosition: range.end,
            };
        }
        
        if (key === 'Backspace' && cursorPosition > range.start && cursorPosition <= range.end) {
            // Backspace within mention → move to mention start
            return {
                shouldDelete: false,
                newPosition: range.start,
            };
        }
    }

    return { shouldDelete: false };
}

/**
 * Mention control keydown handler for SuggestionBox
 * High-level helper function including DOM operations
 */
export function handleMentionKeyDown(
    e: KeyboardEvent,
    value: string,
    textbox: HTMLInputElement | HTMLTextAreaElement | null,
    onChange: (event: any) => void
): boolean {
    if (!textbox || !value) {
        return false;
    }

    const currentPosition = textbox.selectionStart || 0;

    // Handle deletion keys
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const deletionResult = handleMentionDeletion(
            value,
            currentPosition,
            e.key as 'Backspace' | 'Delete'
        );

        if (deletionResult.shouldDelete && deletionResult.newText !== undefined) {
            e.preventDefault();
            updateTextboxValue(textbox, deletionResult.newText, deletionResult.newPosition || 0, onChange);
            return true;
        }

        if (deletionResult.newPosition !== undefined) {
            e.preventDefault();
            textbox.setSelectionRange(deletionResult.newPosition, deletionResult.newPosition);
            return true;
        }
    }

    // Handle navigation keys
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        const invasionResult = willInvadeMentionArea(
            value,
            currentPosition,
            e.key,
            e.ctrlKey,
            e.metaKey
        );

        if (invasionResult.willInvade && invasionResult.safePosition !== undefined) {
            e.preventDefault();
            textbox.setSelectionRange(invasionResult.safePosition, invasionResult.safePosition);
            return true;
        }
    }

    return false;
}

/**
 * Mention control mouse up handler for SuggestionBox
 */
export function handleMentionMouseUp(
    value: string,
    textbox: HTMLInputElement | HTMLTextAreaElement | null
): void {
    if (!textbox || !value) {
        return;
    }

    // Validate cursor position after mouse click
    setTimeout(() => {
        const currentPosition = textbox.selectionStart || 0;
        const positionInfo = getCursorPositionInfo(value, currentPosition);

        if (positionInfo.inArea && positionInfo.range) {
            const safePosition = getSafeCursorPosition(value, currentPosition);
            textbox.setSelectionRange(safePosition, safePosition);
        }
    }, 0);
}

/**
 * Helper to update textbox value and cursor position
 */
function updateTextboxValue(
    textbox: HTMLInputElement | HTMLTextAreaElement,
    value: string,
    cursorPosition: number,
    onChange: (event: any) => void
): void {
    textbox.value = value;
    textbox.setSelectionRange(cursorPosition, cursorPosition);
    
    // Force caret visibility for transparent inputs
    if (textbox.classList.contains('suggestion-box-input-transparent')) {
        // Use a small delay to ensure proper caret rendering
        setTimeout(() => {
            textbox.setSelectionRange(cursorPosition, cursorPosition);
            textbox.focus();
        }, 0);
    }
    
    // Update React state
    onChange({
        target: textbox,
        currentTarget: textbox,
    });
}

/**
 * Force caret visibility in transparent input elements
 */
export function ensureCaretVisibility(textbox: HTMLInputElement | HTMLTextAreaElement | null): void {
    if (!textbox) {
        return;
    }
    
    if (textbox.classList.contains('suggestion-box-input-transparent')) {
        const position = textbox.selectionStart || 0;
        
        // Use requestAnimationFrame to ensure proper timing
        requestAnimationFrame(() => {
            textbox.setSelectionRange(position, position);
            
            // Force a style recalculation to ensure caret visibility
            const computedStyle = window.getComputedStyle(textbox);
            if (computedStyle.caretColor === 'transparent' || computedStyle.caretColor === 'rgba(0, 0, 0, 0)') {
                textbox.style.caretColor = 'var(--center-channel-color)';
            }
        });
    }
}

/**
 * Prevents mention expansion when typing directly after a mention
 * @param text - Current text
 * @param cursorPosition - Current cursor position
 * @param newChar - Character being typed
 * @returns Modified text and cursor position
 */
export function preventMentionExpansion(
    text: string,
    cursorPosition: number,
    newChar: string
): { text: string; cursorPosition: number } {
    if (!text || typeof text !== 'string' || cursorPosition < 0 || !newChar) {
        return { text, cursorPosition };
    }

    const mentionRanges = getMentionRanges(text);
    
    for (const range of mentionRanges) {
        // Check if cursor is right after a mention (at range.end)
        if (cursorPosition === range.end) {
            // Insert space before the new character to prevent mention expansion
            const newText = text.substring(0, cursorPosition) + ' ' + newChar + text.substring(cursorPosition);
            return {
                text: newText,
                cursorPosition: cursorPosition + 2, // Move cursor after space and new character
            };
        }
    }

    // No mention expansion prevention needed
    return { text, cursorPosition };
}

/**
 * Detects and fixes mention expansion that occurred after input
 * @param text - Current text after input
 * @param previousText - Text before the input
 * @returns Corrected text or original text if no correction needed
 */
export function detectAndFixMentionExpansion(text: string, previousText?: string): string {
    if (!text || typeof text !== 'string') {
        return text;
    }

    const mentionRanges = getMentionRanges(text);
    
    // If we have previous text, we can do more sophisticated detection
    if (previousText && typeof previousText === 'string') {
        const previousRanges = getMentionRanges(previousText);
        
        // Look for mentions that have expanded (become longer)
        for (const currentRange of mentionRanges) {
            for (const prevRange of previousRanges) {
                // Check if a mention has expanded by comparing positions and content
                if (prevRange.start === currentRange.start &&
                    currentRange.end > prevRange.end &&
                    currentRange.text.startsWith(prevRange.text)) {
                    
                    // Extract the expanded part and separate it with zero-width characters
                    const expandedPart = currentRange.text.substring(prevRange.text.length);
                    const separators = '\u200B\u200C\u200B'; // Zero-width space + Zero-width non-joiner + Zero-width space
                    const correctedText = text.substring(0, prevRange.end) + separators + expandedPart + text.substring(currentRange.end);
                    
                    return correctedText;
                }
            }
        }
    }

    // Enhanced fallback: Look for mentions that seem to contain non-mention text
    for (const range of mentionRanges) {
        const mentionText = range.text.substring(1); // Remove @
        
        // Check if mention contains suspicious patterns that suggest expansion
        const suspiciousPatterns = [
            /\s/, // Contains space
            /[^a-z0-9.\-_]/i, // Contains non-username characters
        ];
        
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(mentionText)) ||
                           mentionText.length > 50; // Too long
        
        if (isSuspicious) {
            // Try to find where the original mention should end
            const usernameMatch = mentionText.match(/^([a-z0-9.\-_]+)/i);
            if (usernameMatch && usernameMatch[1].length < mentionText.length) {
                const originalMention = '@' + usernameMatch[1];
                const expandedPart = mentionText.substring(usernameMatch[1].length);
                const separator = '\u200B'; // Zero-width space
                const correctedText = text.substring(0, range.start) + originalMention + separator + expandedPart + text.substring(range.end);
                
                return correctedText;
            }
        }
    }

    return text;
}

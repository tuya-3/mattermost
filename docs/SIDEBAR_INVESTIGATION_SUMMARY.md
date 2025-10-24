# Sidebar Display Logic Investigation Summary

This investigation examined the display logic for channels and direct messages (DMs) in the Mattermost sidebar, with a focus on understanding how the system handles display limits and determines which channels/DMs to show or hide.

## Quick Reference

### Display Limit
- **User-configurable**: 10, 15, 20, or 40 channels
- **Default**: 20 channels
- **Location**: User Settings → Sidebar → "Number of direct messages to show"
- **Preference**: `sidebar_settings.limit_visible_dms_gms`

### Display Priority (Highest to Lowest)
1. **Unread channels** - Always shown (overrides limit)
2. **Current channel** - Always shown
3. **Recently viewed** - Sorted by `last_viewed_at` timestamp

### Channels Hidden First (When Limit Exceeded)
1. Oldest viewed channels (lowest `last_viewed_at`)
2. Never viewed channels (`last_viewed_at = 0`)
3. DMs with deactivated users (where user deactivated before last view)

### Key Formula
```javascript
remaining = Math.max(limitPref, unreadCount)
```
This ensures all unread channels are always visible, even if they exceed the configured limit.

## Investigation Deliverables

### 1. Comprehensive Documentation
**File**: [`docs/SIDEBAR_CHANNEL_DM_DISPLAY_LOGIC.md`](./SIDEBAR_CHANNEL_DM_DISPLAY_LOGIC.md)

Complete documentation covering:
- Display logic components and key files
- Display limit configuration and validation
- Filtering and sorting rules (3-tier filtering system)
- Deletion/hide priority with example scenarios
- PC/Mobile synchronization mechanism
- Technical implementation details
- Database schema
- Testing coverage
- Troubleshooting guide
- Future improvement suggestions

### 2. Enhanced Code Comments
**File**: `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/channel_categories.ts`

Added detailed inline documentation to:
- `makeFilterAutoclosedDMs()` - Auto-close logic with priority hierarchy
- `makeFilterManuallyClosedDMs()` - Manual close behavior and exceptions

## Key Technical Findings

### Three-Tier Filtering System

1. **Archived Channel Filter** (`makeFilterArchivedChannels`)
   - Removes deleted/archived channels
   - Exception: Current channel always visible

2. **Manually Closed DM Filter** (`makeFilterManuallyClosedDMs`)
   - Filters based on user preferences (`direct_channel_show`, `group_channel_show`)
   - Exceptions: Unread DMs and current channel always visible

3. **Auto-closed DM Filter** (`makeFilterAutoclosedDMs`)
   - Enforces the user-configured limit
   - Implements priority-based sorting
   - Automatically hides least recently viewed DMs

### Auto-Close Algorithm

**Step 1: Filter**
- Keep all unread channels (count them)
- Keep current channel
- Keep active DMs (filter deactivated users)

**Step 2: Sort by Priority**
1. Current channel first
2. Unread channels second
3. Most recently viewed last

**Step 3: Apply Limit**
- Calculate: `Math.max(limitPref, unreadCount)`
- Slice array to keep top N channels
- Channels at the end (oldest viewed) are hidden

### Synchronization Between PC and Mobile

**Synchronized via**:
- User preferences database
- WebSocket real-time events
- Consistent algorithms across platforms

**Potential Discrepancies**:
- Network timing differences
- Preference migration (old vs new format)
- Deactivated user event timing
- Local caching on mobile

## Example Scenarios

### Scenario 1: Standard Limit Enforcement
- **Configuration**: Limit = 10, Unread = 3, Total DMs = 15
- **Result**: Shows 10 channels (3 unread + current + 6 most recent)
- **Hidden**: 5 oldest viewed DMs

### Scenario 2: Unread Override
- **Configuration**: Limit = 10, Unread = 12
- **Result**: Shows all 12 unread channels
- **Hidden**: None (unread count overrides limit)

### Scenario 3: Opening a Hidden DM
- **Configuration**: Limit = 10, User opens a hidden DM
- **Result**: Current DM shown + 9 most recent others
- **Hidden**: The 10th oldest DM that was previously visible

## Files Modified

1. Created: `docs/SIDEBAR_CHANNEL_DM_DISPLAY_LOGIC.md`
   - 14KB comprehensive documentation

2. Modified: `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/channel_categories.ts`
   - Added detailed comments to `makeFilterAutoclosedDMs()`
   - Added detailed comments to `makeFilterManuallyClosedDMs()`

## Testing

Existing test coverage in:
- `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/channel_categories.test.ts`

Tests verify:
- Unread channels always shown
- Current channel always shown
- Exact limit enforcement
- Priority ordering (current > unread > recent)
- Legacy preference compatibility
- Deactivated user filtering

## Usage for Future Development

This documentation can be used for:

1. **Feature Development**
   - Understanding existing behavior before modifications
   - Avoiding breaking changes to display logic
   - Planning enhancements to DM management

2. **Bug Fixing**
   - Diagnosing unexpected DM visibility issues
   - Understanding why certain DMs appear or disappear
   - Troubleshooting sync issues between devices

3. **Onboarding**
   - Helping new developers understand sidebar logic
   - Explaining complex preference interactions
   - Clarifying auto-close vs manual-close behavior

4. **Support**
   - Answering user questions about DM limits
   - Explaining why DMs auto-hide
   - Troubleshooting discrepancies between platforms

## Conclusion

The investigation successfully documented the complete sidebar channel/DM display logic, including:

✅ Clear specification of display limits and configuration  
✅ Detailed explanation of filtering and sorting rules  
✅ Priority hierarchy for channel visibility  
✅ Deletion/hide order when limits are exceeded  
✅ Synchronization mechanism between PC and mobile  
✅ Technical implementation details for developers  
✅ Enhanced code comments for maintainability  

The documentation provides a solid foundation for future feature improvements, troubleshooting, and understanding of this critical user-facing feature.

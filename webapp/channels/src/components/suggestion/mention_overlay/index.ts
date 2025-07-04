// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getUsersByUsername} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import MentionOverlay from './mention_overlay';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        usersByUsername: getUsersByUsername(state),
        teammateNameDisplay: getTeammateNameDisplaySetting(state),
        currentUserId: getCurrentUserId(state),
    };
}

export default connect(mapStateToProps)(MentionOverlay);

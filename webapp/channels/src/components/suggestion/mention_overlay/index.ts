// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUsersByUsername} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import MentionOverlay from './mention_overlay';

function mapStateToProps(state: GlobalState) {
    return {
        usersByUsername: getUsersByUsername(state),
        teammateNameDisplay: getTeammateNameDisplaySetting(state),
    };
}

export default connect(mapStateToProps)(MentionOverlay);

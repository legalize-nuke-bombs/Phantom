package com.example.phantom.topic;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class TopicMemberRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final Long timestamp;

    public TopicMemberRepresentation(TopicMember tm) {
        this.id = tm.getId();
        this.user = new UserShortRepresentation(tm.getUser());
        this.timestamp = tm.getTimestamp();
    }
}
